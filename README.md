# PodBee

The IMDb for podcasts — Apple-inspired catalog UI. **Not a media player.**

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
- `/podcasts/[slug]` — podcast profile
- `/people/[slug]` — person profile

## Design law

Monochrome, extreme whitespace, massive typography, `rounded-[24px]` cards, Apple Blue `#007AFF` actions. No player bars.

## Data ingest (Sprint 2)

RSS-first catalog loader lives in [`pipeline/`](pipeline/). It uses the **service_role** key via env and upserts podcasts, episodes, people/credits, genres, and the four home charts.

```bash
python -m pip install -r pipeline/requirements.txt
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
python -m pipeline.ingest --feeds feeds.txt
```

See [`pipeline/README.md`](pipeline/README.md) for flags, env vars, and the starter feed list. Never put `service_role` in frontend env.

## Free tier

Hobby / free plans only unless Lukas explicitly approves paid upgrades.
