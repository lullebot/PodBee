-- Accounts, ratings (shows + episodes), and Listen List — IMDb-style.
--
-- Schema-inspection note (STEP 2 of the request): the request assumed the
-- placeholder score on show pages is a column named `podbee_score`. In the
-- live schema, `podbee_score` (0-1, on public.podcasts) is actually the
-- popularity/ranking input for the separate curated chart system
-- (chart_entries / chart_rankings — see PODBEE_SCORE_LABEL in
-- src/lib/types.ts: "never a user ★ rating"). AGENTS.md says not to touch
-- that system. The score genuinely displayed on show pages today is
-- `podcasts.rating_average` / `podcasts.rating_count` (pipeline-seeded from
-- RSS/iTunes feed data, not first-party PodBee user votes) — that pair is
-- the real "fake side" of the switch below. Because `rating_count` is
-- already taken by that pipeline-owned column, the new real-rating count
-- column on podcasts is named `real_rating_count` instead of `rating_count`
-- to avoid clobbering pipeline writes. Episodes have no pre-existing rating
-- columns, so they use the plain `avg_rating` / `rating_count` names.

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_public_read" on public.profiles
  for select using (true);

create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth.users row is inserted.
-- security definer + owned by postgres (bypasses RLS) since this must
-- write to public.profiles on behalf of a not-yet-authenticated session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1),
    'user'
  );
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]+', '_', 'g');
  final_username := base_username || '_' || substr(new.id::text, 1, 8);

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), base_username),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Ratings (private unless reviewed)
-- ---------------------------------------------------------------------

create table public.podcast_ratings (
  user_id uuid references auth.users on delete cascade,
  podcast_id uuid references public.podcasts on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, podcast_id)
);

create index podcast_ratings_podcast_id_idx on public.podcast_ratings (podcast_id);

create table public.episode_ratings (
  user_id uuid references auth.users on delete cascade,
  episode_id uuid references public.episodes on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

create index episode_ratings_episode_id_idx on public.episode_ratings (episode_id);

alter table public.podcast_ratings enable row level security;
alter table public.episode_ratings enable row level security;

-- Owner can always write their own rating row.
create policy "podcast_ratings_owner_insert" on public.podcast_ratings
  for insert with check (auth.uid() = user_id);
create policy "podcast_ratings_owner_update" on public.podcast_ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "podcast_ratings_owner_delete" on public.podcast_ratings
  for delete using (auth.uid() = user_id);

-- Anonymous number-only ratings stay private: a row is only visible to
-- everyone else once it carries a non-empty written review. The owner can
-- always see their own row (for "Your rating: X"). Reading review_text back
-- down to empty makes the row anonymous again automatically.
create policy "podcast_ratings_select" on public.podcast_ratings
  for select using (
    (review_text is not null and length(trim(review_text)) > 0)
    or auth.uid() = user_id
  );

create policy "episode_ratings_owner_insert" on public.episode_ratings
  for insert with check (auth.uid() = user_id);
create policy "episode_ratings_owner_update" on public.episode_ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "episode_ratings_owner_delete" on public.episode_ratings
  for delete using (auth.uid() = user_id);

create policy "episode_ratings_select" on public.episode_ratings
  for select using (
    (review_text is not null and length(trim(review_text)) > 0)
    or auth.uid() = user_id
  );

-- ---------------------------------------------------------------------
-- Listen List (private, like a watchlist — shows and episodes independently)
-- ---------------------------------------------------------------------

create table public.listen_list_shows (
  user_id uuid references auth.users on delete cascade,
  podcast_id uuid references public.podcasts on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, podcast_id)
);

create index listen_list_shows_user_id_idx on public.listen_list_shows (user_id);

create table public.listen_list_episodes (
  user_id uuid references auth.users on delete cascade,
  episode_id uuid references public.episodes on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

create index listen_list_episodes_user_id_idx on public.listen_list_episodes (user_id);

alter table public.listen_list_shows enable row level security;
alter table public.listen_list_episodes enable row level security;

create policy "listen_list_shows_owner_all" on public.listen_list_shows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "listen_list_episodes_owner_all" on public.listen_list_episodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Aggregate columns — real crowd-sourced score, kept separate from the
-- pipeline-owned podcasts.rating_average / podcasts.rating_count fake pair.
-- ---------------------------------------------------------------------

alter table public.podcasts
  add column avg_rating numeric(3,1) not null default 0,
  add column real_rating_count integer not null default 0;

alter table public.episodes
  add column avg_rating numeric(3,1) not null default 0,
  add column rating_count integer not null default 0;

-- Recompute over ALL rows (including anonymous number-only ratings that the
-- public SELECT policy above hides) — security definer + owned by postgres
-- so the aggregate bypasses RLS on the ratings tables.
create or replace function public.recompute_podcast_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_podcast_id uuid := coalesce(new.podcast_id, old.podcast_id);
begin
  update public.podcasts
  set avg_rating = coalesce(
        (select round(avg(rating)::numeric, 1)
         from public.podcast_ratings
         where podcast_id = affected_podcast_id),
        0),
      real_rating_count = (
        select count(*) from public.podcast_ratings where podcast_id = affected_podcast_id
      )
  where id = affected_podcast_id;
  return coalesce(new, old);
end;
$$;

create trigger podcast_ratings_aggregate
  after insert or update or delete on public.podcast_ratings
  for each row execute function public.recompute_podcast_rating();

create or replace function public.recompute_episode_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_episode_id uuid := coalesce(new.episode_id, old.episode_id);
begin
  update public.episodes
  set avg_rating = coalesce(
        (select round(avg(rating)::numeric, 1)
         from public.episode_ratings
         where episode_id = affected_episode_id),
        0),
      rating_count = (
        select count(*) from public.episode_ratings where episode_id = affected_episode_id
      )
  where id = affected_episode_id;
  return coalesce(new, old);
end;
$$;

create trigger episode_ratings_aggregate
  after insert or update or delete on public.episode_ratings
  for each row execute function public.recompute_episode_rating();

-- ---------------------------------------------------------------------
-- Fake/real ratings switch — shows only. Episodes always read avg_rating /
-- rating_count directly (they have no fake data to fall back to).
-- ---------------------------------------------------------------------

create table public.app_settings (
  id boolean primary key default true,
  use_real_ratings boolean not null default false,
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id, use_real_ratings) values (true, false);

alter table public.app_settings enable row level security;

create policy "app_settings_public_read" on public.app_settings
  for select using (true);

-- Switching to real crowd-sourced ratings on shows is exactly this:
--   update public.app_settings set use_real_ratings = true;
-- Every show page reads display_score/display_count from this view (never
-- rating_average/rating_count or avg_rating/real_rating_count directly), so
-- flipping the flag is the entire migration — no code change, no deploy.
create view public.podcasts_display as
select
  p.*,
  case when s.use_real_ratings then p.avg_rating else p.rating_average end as display_score,
  case when s.use_real_ratings then p.real_rating_count else p.rating_count end as display_count
from public.podcasts p
cross join public.app_settings s;
