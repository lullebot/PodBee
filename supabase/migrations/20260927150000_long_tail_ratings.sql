-- Community ratings for every show and every episode — including the ~4.7M
-- long-tail shows that live only in the open Podcast Index, and every episode
-- of every show read from its RSS feed (the pipeline stores only the newest
-- 60 per show in full). See docs/FULL_CATALOG.md.
--
-- Ratings, reviews and Listen List rows reference podcasts.id / episodes.id,
-- so a long-tail show, or a feed episode without a row, gets a lightweight row
-- the first time a signed-in user rates, reviews or lists it. These rows carry
-- only what search, episode lists and the profile page need (title, cover,
-- feed/enclosure URL); pages keep rendering live from Podcast Index and RSS.
-- ~1 KB per touched show/episode, so the database grows with engagement, not
-- with the size of the catalog.
--
-- Trust model: users still cannot write to podcasts/episodes. These rows are
-- created only by ensure_podcast_row / ensure_episode_row, which accept a
-- payload that the Next.js server built from Podcast Index / RSS data and
-- signed with HMAC-SHA256. The same secret (>= 32 chars) lives in
-- Vercel as LONG_TAIL_SIGNING_SECRET (server-only, never NEXT_PUBLIC_*) and in
-- Supabase Vault — set it once in the SQL editor, never in a migration:
--
--   select vault.create_secret('<same value as Vercel>', 'long_tail_signing_secret');
--
-- Without the Vault secret both RPCs refuse to run.
--
-- Promotion: when the pipeline later ingests the same feed (or the same
-- episode) in full, the adoption triggers at the bottom move the lightweight
-- row's ratings, Listen List entries and episodes onto the new row, so
-- nothing is orphaned.

-- ---------------------------------------------------------------------
-- 1) Identity columns (nullable)
-- ---------------------------------------------------------------------

alter table public.podcasts add column podcast_index_id bigint unique;
alter table public.episodes add column feed_item_key text;
alter table public.episodes
  add constraint episodes_podcast_feed_item_key_key unique (podcast_id, feed_item_key);

comment on column public.podcasts.podcast_index_id is
  'Podcast Index feed id. Set on long-tail rows (slug pi-{id}-…) and on catalog rows matched to one.';
comment on column public.episodes.feed_item_key is
  '12-hex key of the RSS item (sha1 of guid, else enclosure URL, else title+date). Set on rows created for feed episodes (slug e-{key}-…) and on catalog episodes matched to one.';

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

-- Enclosure URL without query/fragment (hosts add `?updated=…` that changes on
-- re-publish) and a normalized title — fallbacks for matching an RSS item to
-- an existing episode row. Mirrors DbEpisodeMatcher in src/lib/feed-episodes.ts.
create or replace function public.long_tail_audio_base(url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(split_part(split_part(url, '?', 1), '#', 1)), '')
$$;

create or replace function public.long_tail_title_key(title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(regexp_replace(lower(title), '[^a-z0-9]+', ' ', 'g')), '')
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
    raise exception 'row signing is not configured' using errcode = '55000';
  end if;

  if payload is null
     or signature is null
     or encode(extensions.hmac(payload, secret, 'sha256'), 'hex') <> lower(signature) then
    raise exception 'invalid payload signature' using errcode = '42501';
  end if;

  body := payload::jsonb;
  if coalesce((body ->> 'exp')::bigint, 0) < extract(epoch from now())::bigint then
    raise exception 'payload expired' using errcode = '42501';
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
    raise exception 'invalid show payload' using errcode = '22023';
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

-- Find or create the episodes row for a feed episode under pid.
create or replace function public.long_tail_upsert_episode(pid uuid, ep jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := ep ->> 'key';
  v_title text := left(trim(ep ->> 'title'), 500);
  v_audio text := nullif(ep ->> 'audio_url', '');
  v_published timestamptz := (ep ->> 'published_at')::timestamptz;
  v_duration integer := (ep ->> 'duration_seconds')::integer;
  eid uuid;
begin
  if pid is null
     or coalesce(v_key, '') !~ '^[0-9a-f]{12}$'
     or nullif(v_title, '') is null
     or coalesce(ep ->> 'slug', '') !~ '^e-[0-9a-f]{12}(-[a-z0-9-]*)?$' then
    raise exception 'invalid episode payload' using errcode = '22023';
  end if;

  select id into eid from public.episodes where podcast_id = pid and feed_item_key = v_key;

  -- A pipeline row for the same episode (exact audio URL, audio URL without
  -- query string, or same title on the same day): attach the key instead of
  -- duplicating it. Rows already keyed to another feed item are never taken.
  if eid is null then
    select id into eid
    from public.episodes
    where podcast_id = pid
      and feed_item_key is null
      and (
        (v_audio is not null and (
          audio_url = v_audio
          or public.long_tail_audio_base(audio_url) = public.long_tail_audio_base(v_audio)))
        or (v_published is not null
          and published_at::date = v_published::date
          and public.long_tail_title_key(title) = public.long_tail_title_key(v_title))
      )
    order by (audio_url = v_audio) desc nulls last,
      (public.long_tail_audio_base(audio_url) = public.long_tail_audio_base(v_audio)) desc nulls last,
      created_at
    limit 1;
    if eid is not null then
      update public.episodes set feed_item_key = v_key
      where id = eid and feed_item_key is null;
    end if;
  end if;

  if eid is null then
    insert into public.episodes (
      podcast_id, slug, title, published_at, duration_seconds, episode_type,
      explicit, audio_url, cover_image_url, feed_item_key
    )
    values (
      pid,
      ep ->> 'slug',
      v_title,
      v_published,
      case when v_duration >= 0 then v_duration end,
      case when ep ->> 'episode_type' in ('full', 'trailer', 'bonus')
        then ep ->> 'episode_type' else 'full' end,
      coalesce((ep ->> 'explicit')::boolean, false),
      v_audio,
      nullif(ep ->> 'cover_image_url', ''),
      v_key
    )
    on conflict (podcast_id, feed_item_key) do update set feed_item_key = excluded.feed_item_key
    returning id into eid;
  end if;

  return eid;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Public RPCs — signed-in users only, signed payloads only
-- ---------------------------------------------------------------------

create or replace function public.ensure_podcast_row(payload text, signature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  body jsonb := public.long_tail_verified_payload(payload, signature);
begin
  if body ->> 'kind' is distinct from 'podcast' then
    raise exception 'wrong payload kind' using errcode = '22023';
  end if;
  return public.long_tail_upsert_podcast(body -> 'show');
end;
$$;

-- The episode's show is either a long-tail show (created if needed) or an
-- existing row named by podcast_id (catalog show, e.g. an older episode that
-- the pipeline's 60-episode cap left out).
create or replace function public.ensure_episode_row(payload text, signature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  body jsonb := public.long_tail_verified_payload(payload, signature);
  pid uuid;
begin
  if body ->> 'kind' is distinct from 'episode' then
    raise exception 'wrong payload kind' using errcode = '22023';
  end if;
  if body ? 'podcast_id' then
    select id into pid from public.podcasts where id = (body ->> 'podcast_id')::uuid;
    if pid is null then
      raise exception 'unknown podcast' using errcode = '22023';
    end if;
  else
    pid := public.long_tail_upsert_podcast(body -> 'show');
  end if;
  return public.long_tail_upsert_episode(pid, body -> 'episode');
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Promotion: adopt lightweight rows when the pipeline ingests in full
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
    select id, feed_item_key
    from public.episodes
    where id <> new.id
      and podcast_id = new.podcast_id
      and feed_item_key is not null
      and slug like 'e-%'
      and (
        (new.audio_url is not null and (
          audio_url = new.audio_url
          or public.long_tail_audio_base(audio_url) = public.long_tail_audio_base(new.audio_url)))
        or (new.published_at is not null
          and published_at::date = new.published_at::date
          and public.long_tail_title_key(title) = public.long_tail_title_key(new.title))
      )
  loop
    update public.episodes set feed_item_key = null where id = stub.id;
    update public.episodes
    set feed_item_key = coalesce(feed_item_key, stub.feed_item_key)
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
  when (new.feed_item_key is null and new.slug not like 'e-%')
  execute function public.adopt_long_tail_episode();

-- ---------------------------------------------------------------------
-- 6) Grants — Supabase grants EXECUTE on new public functions to anon and
--    authenticated by default, so revoke explicitly.
-- ---------------------------------------------------------------------

revoke execute on function public.long_tail_feed_key(text) from public, anon, authenticated;
revoke execute on function public.long_tail_audio_base(text) from public, anon, authenticated;
revoke execute on function public.long_tail_title_key(text) from public, anon, authenticated;
revoke execute on function public.long_tail_verified_payload(text, text) from public, anon, authenticated;
revoke execute on function public.long_tail_upsert_podcast(jsonb) from public, anon, authenticated;
revoke execute on function public.long_tail_upsert_episode(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.adopt_long_tail_podcast() from public, anon, authenticated;
revoke execute on function public.adopt_long_tail_episode() from public, anon, authenticated;

revoke execute on function public.ensure_podcast_row(text, text) from public, anon;
revoke execute on function public.ensure_episode_row(text, text) from public, anon;
grant execute on function public.ensure_podcast_row(text, text) to authenticated;
grant execute on function public.ensure_episode_row(text, text) to authenticated;
