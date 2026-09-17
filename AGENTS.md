# PodBee — agent conventions

PodBee is a structured audio database and discovery product — **the IMDb for
podcasts, not a media player.** Apple-like design; see "Design law" in
[`README.md`](README.md).

## Stack

- Next.js App Router + TypeScript + Tailwind, deployed on **Vercel Hobby**
- Supabase (free tier) — the app uses the **anon key only**
  (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `pipeline/` (Python) is the only place that holds `SUPABASE_SERVICE_ROLE_KEY`,
  set locally/in CI secrets — never on Vercel, never in `NEXT_PUBLIC_*`

## Hard rules

- Free tier only: Supabase free tier + Vercel Hobby. No paid upgrades without
  explicit sign-off from Lukas (Business Lead).
- Never touch the `apkguiden` Vercel project — unrelated to PodBee.
- No media player. This is a structured database/discovery product.
- `service_role` never leaves `pipeline/`'s local/CI env — never in frontend
  code, never on Vercel.
- Respect the ingest ops caps in [`pipeline/README.md`](pipeline/README.md)
  (episodes/show cap, DB size stop-limit) — ask DevOps before any load or
  schema change that could grow cost or size materially.
- Ask Database before adding new tables/entities.

## Source of truth

- [`README.md`](README.md) — setup, routes, design law.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — current sprint, priorities, what's
  parked. Owned by Business Lead; update it when a bet opens/closes rather
  than relying on a one-off handoff message.
- [`pipeline/README.md`](pipeline/README.md) — ingest flags, env vars,
  free-tier ops caps.
- [`supabase/migrations/`](supabase/migrations/) — schema history, applied in
  order. Add new schema changes as a new migration file; don't hand-edit the
  live database outside of one.

## Before pushing

CI (`.github/workflows/ci.yml`) runs these on every PR — run them locally
first so PRs land green instead of round-tripping through CI:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

```bash
python -m pip install -r pipeline/requirements.txt
python -m unittest discover -s pipeline/tests -t .
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
