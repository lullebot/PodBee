# PodBee

The IMDb for podcasts — **Not a media player.**

## Stack

- Next.js App Router + TypeScript + Tailwind
- Supabase (free tier) via **anon key only** — never `service_role` in this app

## Setup

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase → Project Settings → API
npm install
npm run dev
```

## Routes

- `/` — home
- `/podcasts/[slug]` — podcast profile (rating widget, reviews, Listen List)
- `/podcasts/[slug]/[episodeSlug]` — episode profile (rating widget, reviews, Listen List)
- `/people/[slug]` — person profile
- `/login`, `/signup` — email/password auth (Supabase Auth; schema leaves room for Google OAuth
  later with no migration)
- `/profile` — signed-in user's Your Ratings + Your Listen List tabs

## Accounts, ratings, and Listen List

IMDb-style: a rating is a bare 1–10 number, submits instantly, and is **private** to the rater
unless they attach a written review — anonymous ratings still count toward the public average.
The public score is `avg(rating)` formatted `"X.X (N)"`.

Show pages read the displayed score from `public.podcasts_display` (`display_score` /
`display_count`), never `rating_average`/`rating_count` or `avg_rating`/`real_rating_count`
directly. That view switches between the pipeline-seeded placeholder score and the real
crowd-sourced one based on a single flag:

```sql
update public.app_settings set use_real_ratings = true;
```

No code change, no deploy — every show page starts showing real numbers on the next request.
Episode pages always show real ratings (`episodes.avg_rating` / `episodes.rating_count`) since
there was no placeholder data for episodes to begin with. See the migration comment in
`supabase/migrations/20260917120000_accounts_ratings_listen_list.sql` for the full rationale,
including why the real-rating count column on `podcasts` is named `real_rating_count` rather than
`rating_count` (that name is already used by the pipeline-seeded placeholder pair).

Schema lives in `supabase/migrations/` — apply with the Supabase CLI (`supabase db push`) or the
Supabase dashboard's SQL editor against a project's `SUPABASE_ACCESS_TOKEN`.

## Design law

Monochrome, extreme whitespace, massive typography, `rounded-[24px]` cards, Apple Blue `#007AFF` actions. No player bars.

## Data ingest (Sprint 2/3)

RSS-first catalog loader lives in [`pipeline/`](pipeline/). It uses the **service_role** key via env and upserts podcasts, episodes, people/credits, genres, and the four home charts. Optional Podcast Index trending (one small `/podcasts/trending` page per category, `max≤25`, rate-limited) is used only when `PODCAST_INDEX_*` env vars are set — never crawl the full index.

```bash
python -m pip install -r pipeline/requirements.txt
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
python -m pipeline.ingest --feeds feeds.txt --max-episodes 60
```

See [`pipeline/README.md`](pipeline/README.md) for flags, env vars, starter feeds, and Sprint 3 free-tier caps. Never put `service_role` in frontend env.

## Free tier

Hobby / free plans only unless Lukas explicitly approves paid upgrades.

Sprint 3 ops caps (keep the catalog on free-tier headroom):

- Max ~1200 podcasts
- Max 60 episodes per show (`--max-episodes 60`)
- Stop ingest if the database is near ~350 MB
