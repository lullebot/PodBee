-- Community ratings for every show — including the ~4.7M long-tail shows that
-- live only in the open Podcast Index (see docs/FULL_CATALOG.md).
--
-- Ratings, reviews and Listen List rows reference podcasts.id / episodes.id,
-- so a long-tail show (or episode) gets a lightweight row the first time a
-- signed-in user rates, reviews or lists it. These rows carry only what
-- search and the profile page need (title, cover, feed URL); the page itself
-- keeps rendering live from Podcast Index. ~1 KB per touched show/episode, so
-- the database grows with engagement, not with the size of the catalog.
--
-- Trust model: users still cannot write to podcasts/episodes. Long-tail rows
-- are created only by materialize_index_podcast / materialize_index_episode,
-- which accept a payload that the Next.js server built from Podcast Index
-- data and signed with HMAC-SHA256. The same secret (>= 32 chars) lives in
-- Vercel as LONG_TAIL_SIGNING_SECRET (server-only, never NEXT_PUBLIC_*) and in
-- Supabase Vault — set it once in the SQL editor, never in a migration:
--
--   select vault.create_secret('<same value as Vercel>', 'long_tail_signing_secret');
--
-- Without the Vault secret both RPCs refuse to run.
--
-- Promotion: when the pipeline later ingests the same feed as a full catalog
-- show, the adoption triggers at the bottom move the long-tail row's ratings,
-- Listen List entries and episodes onto the new row, so nothing is orphaned.

-- ---------------------------------------------------------------------
-- 1) Podcast Index ids (nullable; unique when set)
-- ---------------------------------------------------------------------

alter table public.podcasts add column podcast_index_id bigint unique;
alter table public.episodes add column podcast_index_id bigint unique;

comment on column public.podcasts.podcast_index_id is
  'Podcast Index feed id. Set on long-tail rows (slug pi-{id}-…) and on catalog rows matched to one.';
comment on column public.episodes.podcast_index_id is
  'Podcast Index episode id. Set on long-tail episode rows and on catalog episodes matched to one.';

-- ---------------------------------------------------------------------
-- 2) Show score: fall back to real ratings when there is no placeholder
-- ---------------------------------------------------------------------
-- Long-tail shows have no pipeline-seeded placeholder (rating_average is
-- null), so they show the real crowd score immediately instead of "—" until
-- use_real_ratings flips. The real score is null (not 0.0) while a show has
-- zero ratings. Shows with a placeholder behave exactly as before. Column
-- list/order/types match the live view; podcast_index_id is appended.

create or replace view public.podcasts_display as
select
  p.id,
  p.slug,
  p.title,
  p.subtitle,
  p.description,
  p.language,
  p.explicit,
  p.status,
  p.cover_image_url,
  p.website_url,
  p.rss_url,
  p.primary_company_id,
  p.published_at,
  p.created_at,
  p.updated_at,
  p.rating_average,
  p.rating_count,
  p.trend_score,
  p.freshness_score,
  p.volume_score,
  p.podbee_score,
  p.score_updated_at,
  p.latest_episode_at,
  p.avg_rating,
  p.real_rating_count,
  (case
    when s.use_real_ratings or p.rating_average is null
      then case when p.real_rating_count > 0 then p.avg_rating end
    else p.rating_average
  end)::numeric as display_score,
  case
    when s.use_real_ratings or p.rating_average is null then p.real_rating_count
    else p.rating_count
  end as display_count,
  p.podcast_index_id
from public.podcasts p
cross join public.app_settings s;

alter view public.podcasts_display set (security_invoker = true);

-- ---------------------------------------------------------------------
-- 3) Internal helpers (not callable over the API)
-- ---------------------------------------------------------------------

-- Comparable feed URL: no scheme, lowercase, no trailing slash.
create or replace function public.long_tail_feed_key(url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(regexp_replace(lower(trim(url)), '^https?://', ''), '/+$', ''), '')
$$;

-- Verify the server's HMAC signature + expiry; return the parsed payload.
create or replace function public.long_tail_verified_payload(payload text, signature text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  secret text;
  body jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'long_tail_signing_secret'
  limit 1;
  if secret is null or length(secret) < 32 then
    raise exception 'long-tail ratings are not configured' using errcode = '55000';
  end if;

  if payload is null
     or signature is null
     or encode(extensions.hmac(payload, secret, 'sha256'), 'hex') <> lower(signature) then
    raise exception 'invalid long-tail payload signature' using errcode = '42501';
  end if;

  body := payload::jsonb;
  if coalesce((body ->> 'exp')::bigint, 0) < extract(epoch from now())::bigint then
    raise exception 'long-tail payload expired' using errcode = '42501';
  end if;
  return body;
end;
$$;

-- Find or create the podcasts row for a Podcast Index feed.
create or replace function public.long_tail_upsert_podcast(show jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feed_id bigint := (show ->> 'feed_id')::bigint;
  v_title text := left(trim(show ->> 'title'), 300);
  v_cover text := nullif(show ->> 'cover_image_url', '');
  v_keys text[] := array(
    select public.long_tail_feed_key(u)
    from jsonb_array_elements_text(coalesce(show -> 'feed_urls', '[]'::jsonb)) as u
  );
  pid uuid;
begin
  if v_feed_id is null or v_feed_id <= 0
     or nullif(v_title, '') is null
     or coalesce(show ->> 'slug', '') !~ '^pi-[0-9]+(-[a-z0-9-]*)?$' then
    raise exception 'invalid long-tail show payload' using errcode = '22023';
  end if;

  select id into pid from public.podcasts where podcast_index_id = v_feed_id;

  -- Same feed already present (a pipeline catalog row wins over an older
  -- long-tail row): attach the Podcast Index id instead of duplicating it.
  if pid is null and cardinality(v_keys) > 0 then
    select id into pid
    from public.podcasts
    where public.long_tail_feed_key(rss_url) = any (v_keys)
    order by (slug like 'pi-%'), created_at
    limit 1;
    if pid is not null then
      update public.podcasts set podcast_index_id = v_feed_id
      where id = pid and podcast_index_id is null;
    end if;
  end if;

  if pid is null then
    insert into public.podcasts (
      slug, title, cover_image_url, website_url, rss_url, language, explicit, podcast_index_id
    )
    values (
      show ->> 'slug',
      v_title,
      v_cover,
      nullif(show ->> 'website_url', ''),
      nullif(show ->> 'rss_url', ''),
      coalesce(nullif(lower(left(show ->> 'language', 16)), ''), 'en'),
      coalesce((show ->> 'explicit')::boolean, false),
      v_feed_id
    )
    on conflict (podcast_index_id) do update set podcast_index_id = excluded.podcast_index_id
    returning id into pid;
  else
    -- Keep long-tail rows fresh; never touch rows the pipeline owns.
    update public.podcasts
    set title = v_title,
        cover_image_url = v_cover
    where id = pid
      and slug like 'pi-%'
      and (title is distinct from v_title
           or cover_image_url is distinct from v_cover);
  end if;

  return pid;
end;
$$;

-- Find or create the episodes row for a Podcast Index episode under pid.
create or replace function public.long_tail_upsert_episode(pid uuid, ep jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ep_id bigint := (ep ->> 'episode_id')::bigint;
  v_title text := left(trim(ep ->> 'title'), 500);
  v_audio text := nullif(ep ->> 'audio_url', '');
  v_duration integer := (ep ->> 'duration_seconds')::integer;
  eid uuid;
begin
  if pid is null or v_ep_id is null or v_ep_id <= 0
     or nullif(v_title, '') is null
     or coalesce(ep ->> 'slug', '') !~ '^[0-9]+(-[a-z0-9-]*)?$' then
    raise exception 'invalid long-tail episode payload' using errcode = '22023';
  end if;

  select id into eid from public.episodes where podcast_index_id = v_ep_id;

  if eid is null and v_audio is not null then
    select id into eid
    from public.episodes
    where podcast_id = pid and audio_url = v_audio
    order by created_at
    limit 1;
    if eid is not null then
      update public.episodes set podcast_index_id = v_ep_id
      where id = eid and podcast_index_id is null;
    end if;
  end if;

  if eid is null then
    insert into public.episodes (
      podcast_id, slug, title, published_at, duration_seconds, episode_type,
      explicit, audio_url, cover_image_url, podcast_index_id
    )
    values (
      pid,
      ep ->> 'slug',
      v_title,
      (ep ->> 'published_at')::timestamptz,
      case when v_duration >= 0 then v_duration end,
      case when ep ->> 'episode_type' in ('full', 'trailer', 'bonus')
        then ep ->> 'episode_type' else 'full' end,
      coalesce((ep ->> 'explicit')::boolean, false),
      v_audio,
      nullif(ep ->> 'cover_image_url', ''),
      v_ep_id
    )
    on conflict (podcast_index_id) do update set podcast_index_id = excluded.podcast_index_id
    returning id into eid;
  end if;

  return eid;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Public RPCs — signed-in users only, signed payloads only
-- ---------------------------------------------------------------------

create or replace function public.materialize_index_podcast(payload text, signature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  body jsonb := public.long_tail_verified_payload(payload, signature);
begin
  if body ->> 'kind' is distinct from 'podcast' then
    raise exception 'wrong long-tail payload kind' using errcode = '22023';
  end if;
  return public.long_tail_upsert_podcast(body -> 'show');
end;
$$;

create or replace function public.materialize_index_episode(payload text, signature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  body jsonb := public.long_tail_verified_payload(payload, signature);
begin
  if body ->> 'kind' is distinct from 'episode' then
    raise exception 'wrong long-tail payload kind' using errcode = '22023';
  end if;
  return public.long_tail_upsert_episode(
    public.long_tail_upsert_podcast(body -> 'show'),
    body -> 'episode'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Promotion: adopt long-tail rows when the pipeline ingests the feed
-- ---------------------------------------------------------------------

create or replace function public.adopt_long_tail_podcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stub record;
begin
  for stub in
    select id, podcast_index_id
    from public.podcasts
    where id <> new.id
      and slug like 'pi-%'
      and podcast_index_id is not null
      and public.long_tail_feed_key(rss_url) = public.long_tail_feed_key(new.rss_url)
  loop
    update public.podcasts set podcast_index_id = null where id = stub.id;
    update public.podcasts
    set podcast_index_id = coalesce(podcast_index_id, stub.podcast_index_id)
    where id = new.id;
    update public.podcast_ratings set podcast_id = new.id where podcast_id = stub.id;
    update public.listen_list_shows set podcast_id = new.id where podcast_id = stub.id;
    update public.episodes set podcast_id = new.id where podcast_id = stub.id;
    delete from public.podcasts where id = stub.id;
  end loop;
  return null;
end;
$$;

create trigger podcasts_adopt_long_tail
  after insert on public.podcasts
  for each row
  when (new.rss_url is not null and new.slug not like 'pi-%')
  execute function public.adopt_long_tail_podcast();

create or replace function public.adopt_long_tail_episode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stub record;
begin
  for stub in
    select id, podcast_index_id
    from public.episodes
    where id <> new.id
      and podcast_id = new.podcast_id
      and audio_url = new.audio_url
      and podcast_index_id is not null
      and slug ~ '^[0-9]+(-|$)'
  loop
    update public.episodes set podcast_index_id = null where id = stub.id;
    update public.episodes
    set podcast_index_id = coalesce(podcast_index_id, stub.podcast_index_id)
    where id = new.id;
    update public.episode_ratings set episode_id = new.id where episode_id = stub.id;
    update public.listen_list_episodes set episode_id = new.id where episode_id = stub.id;
    delete from public.episodes where id = stub.id;
  end loop;
  return null;
end;
$$;

create trigger episodes_adopt_long_tail
  after insert on public.episodes
  for each row
  when (new.audio_url is not null and new.podcast_index_id is null)
  execute function public.adopt_long_tail_episode();

-- ---------------------------------------------------------------------
-- 6) Grants — Supabase grants EXECUTE on new public functions to anon and
--    authenticated by default, so revoke explicitly.
-- ---------------------------------------------------------------------

revoke execute on function public.long_tail_verified_payload(text, text) from public, anon, authenticated;
revoke execute on function public.long_tail_upsert_podcast(jsonb) from public, anon, authenticated;
revoke execute on function public.long_tail_upsert_episode(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.adopt_long_tail_podcast() from public, anon, authenticated;
revoke execute on function public.adopt_long_tail_episode() from public, anon, authenticated;

revoke execute on function public.materialize_index_podcast(text, text) from public, anon;
revoke execute on function public.materialize_index_episode(text, text) from public, anon;
grant execute on function public.materialize_index_podcast(text, text) to authenticated;
grant execute on function public.materialize_index_episode(text, text) to authenticated;
