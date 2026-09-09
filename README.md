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

## Free tier

Hobby / free plans only unless Lukas explicitly approves paid upgrades.
