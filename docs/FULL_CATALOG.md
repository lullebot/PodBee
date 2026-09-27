# Full catalog on the free tier — the long-tail design

**Status:** v1 shipped behind env vars (off until `PODCAST_INDEX_*` is set on Vercel).
**Cost:** $0/month. No new vendors, no new tables, **0 bytes** added to Supabase.

## The roadblock, in numbers

Measured on the live Supabase project, 2026-09-27:

| | Rows | Size | Per row |
| --- | --- | --- | --- |
| Whole database | — | 84 MB | — |
| `episodes` (heap + indexes + TOAST) | 26,878 | 60 MB | ≈ 2.3 KB |
| `podcasts` | 426 | 1.4 MB | ≈ 3.4 KB |

The open Podcast Index lists **~4.73M feeds** (Sept 2026), of which ~478k published an
episode in the last 90 days. Copying that into Postgres:

| What we'd store | Estimate | vs. free tier (500 MB, ops stop-line 350 MB) |
| --- | --- | --- |
| Every show at today's row size | 4.73M × 3.4 KB ≈ **16 GB** | 32× over |
| Every show, slimmed to a ~350 B directory row + trigram index | ≈ **1.6 GB** | 3× over |
| Episodes at our 60/show cap | 4.73M × 60 × 2.3 KB ≈ **650 GB** | not on any plan we'd pay for |

That's why every earlier plan to *store* FULL (Supabase Pro, a hosted search cluster, a
separate DB) was expensive. **Storage isn't what we need to solve. We need to make the full
catalog addressable without copying it.**

## The idea: address the catalog, don't copy it

IMDb's value to a visitor is that *every* title has a page and search finds it. It doesn't
matter to them where the row lives. So PodBee runs as two tiers behind one URL space:

```
                    /podcasts/{slug}
                           │
             ┌─────────────┴──────────────┐
      slug in Supabase?              slug = pi-{feedId}-…
             │                             │
   CORE CATALOG (curated)          LONG TAIL (everything else)
   ~1,200 shows, deep data:        ~4.7M shows, rendered live from the
   credits, charts, ratings,       Podcast Index API, trimmed, cached
   reviews, Listen List            (unstable_cache, 12h–7d). 0 DB rows.
             ▲                             │
             └──── promotion ◄─────────────┘
       feed URL lands in Supabase → long-tail URL 307s to the catalog page
```

- **Search** (`/search` and the header typeahead) asks the catalog first. Only when the catalog
  can't fill the list does it top up from Podcast Index `search/byterm`. Popular queries never
  touch the API. Long-tail results whose feed is already in the catalog are dropped, so a show
  never appears twice.
- **Show pages** `/podcasts/pi-{feedId}-{title}` render title, cover, author, genres,
  description, and the 25 newest episodes from `podcasts/byfeedid` + `episodes/byfeedid`.
- **Episode pages** `/podcasts/pi-{feedId}-{title}/{episodeId}-{title}` use `episodes/byid`.
- **Promotion is automatic on the URL side.** When the pipeline ingests a feed (same RSS URL,
  http/https and trailing-slash tolerant), its long-tail URL redirects to the catalog page
  (episode URLs redirect to the matching catalog episode by enclosure URL). Links and search
  results keep working as the catalog grows.
- **Ratings, reviews, cast, and Listen List** need a `podcasts` row (FKs), so long-tail pages
  say so and link to Podcast Index for attribution. Phase 2 below turns that into a
  demand signal.
- **No media player.** Enclosure URLs are used only to match episodes on promotion.

## Why this fits Vercel Hobby

Hobby includes 1M function invocations, 1M ISR reads, and 200k ISR writes a month, with cache
reads/writes metered in 8 KB units.

- Every cached Podcast Index payload is **trimmed before caching** to about one 8 KB unit:
  episode lists keep id/title/date/duration only and drop covers identical to the show cover;
  descriptions are capped.
- A long-tail show page costs **2 API calls + 2 cache writes on a miss**, **2 cache reads on a
  hit**, and 1 anon Supabase query for the promotion check. Repeat views within 12h hit the
  cache (verified against a mock: many views of a show → one API call per resource).
- Rough headroom: ~500k long-tail page views/month (reads) and ~100k distinct long-tail
  shows refreshed/month (writes). Check the Vercel Usage tab after launch. Next.js' data
  cache is metered as ISR/Runtime Cache usage, and we should confirm which line it shows up on.
- **Bots are the main cost risk**: 4.7M crawlable URLs against a 1M-invocation quota.
  Long-tail pages are therefore `noindex, follow` by default, and wrong/missing title slugs
  307 to one canonical URL so variants don't multiply cache entries. Flip
  `PODBEE_LONG_TAIL_INDEXABLE=1` only after watching usage. Adding a Vercel Firewall
  rate-limit rule on `/podcasts/pi-*` is a good next step if crawl traffic appears.

### A Next.js gotcha worth knowing

Podcast Index auth sends `X-Auth-Date`/`Authorization` headers that change every second, and
Next.js includes request headers in the `fetch` cache key. A cached `fetch` to the API would
**never hit**. The loaders in `src/lib/long-tail.ts` cache the trimmed result with
`unstable_cache` keyed by feed/episode id or search term instead. (`use cache` would be the
Next 16 way, but it needs the app-wide `cacheComponents` migration.) Failures throw inside the
cached function, so outages are never cached.

## Degrades safely

- No `PODCAST_INDEX_*` env (local dev, CI, preview) → search is catalog-only and `pi-` URLs
  show the existing "Not in the catalog yet" state. The build never needs the key.
- Podcast Index down or slow (4s timeout) → search still returns catalog results, cached
  long-tail pages keep rendering, and nothing bad gets cached (verified against a mock that
  returns 503).

## Code map

| File | Role |
| --- | --- |
| `src/lib/podcast-index.ts` | Pure: slugs, auth hash, HTML→text, response mapping + trimming, search merge/dedupe. Unit-tested. |
| `src/lib/podcast-index.test.ts` | Tests for the above (`npm test`). |
| `src/lib/long-tail.ts` | Server: cached API client, promotion lookup, show/episode resolvers. |
| `src/components/podcast/IndexPodcastProfile.tsx`, `IndexEpisodeProfile.tsx` | Long-tail pages (reuse `Cover`, `EpisodeList`, `TitleSubnav`). |
| `src/app/podcasts/[slug]/page.tsx`, `[episodeSlug]/page.tsx` | Catalog first, then long tail; noindex metadata for `pi-` pages. |
| `src/lib/search.ts` → `searchAllPodcasts` | Catalog + long-tail top-up for `/search` and `/api/search`. |

## Env

| Variable | Where | Notes |
| --- | --- | --- |
| `PODCAST_INDEX_API_KEY` / `PODCAST_INDEX_API_SECRET` | Vercel **server** env (Production) | Enables the long tail. Never `NEXT_PUBLIC_*`. Use a **separate** free PI key from the pipeline's so either can be revoked alone. |
| `PODBEE_LONG_TAIL_INDEXABLE` | Vercel server env | `1` lets search engines index long-tail pages. Default: noindex. |
| `PODCAST_INDEX_API_BASE` | local only | Points the client at a mock for testing. |

Podcast Index ToS: these are per-visitor lookups, which is the API's intended use. There's no
pagination, no crawl, and no bulk export. The pipeline's "never crawl the full index" rule still
holds.

## Decisions needed

1. **DevOps / Lukas:** OK to add the two `PODCAST_INDEX_*` vars (server-only) to the PodBee
   Vercel project? This is the only change needed to turn v1 on. It's a read-only key for a
   free public API, and the `service_role` rule is untouched.
2. **Lukas:** keep long-tail pages `noindex` at launch? (Recommended; revisit with usage data.)
3. **Lukas / Database:** open Phase 2?

## Phase 2 — demand-driven promotion (needs Database sign-off, not built)

Let usage decide what joins the deep catalog instead of guessing with trending lists:

- New table `catalog_requests (feed_id int primary key, request_count int, first_requested_at,
  last_requested_at)` plus a rate-limited `security definer` RPC. The long-tail page gets a
  "Rate this show" / "Add to Listen List" button for signed-in users that records a request.
- Nightly GitHub Action: `python -m pipeline.ingest --promote-requested N` looks up each
  requested feed with `podcasts/byfeedid` and runs the existing `ingest_feed` + upsert,
  inside the existing ops caps (~1,200 shows, 60 eps/show, 350 MB stop-line). The redirect
  from the long-tail URL already works.
- Smaller first step without a table: a `--pi-feed-ids` flag so an operator can promote a
  show by the id in its long-tail URL.

## Phase 3 — only if we want charts/browse over the long tail (optional)

A slim directory table of shows active in the last 90 days (~478k × ~350 B ≈ 170 MB) loaded
from the weekly Podcast Index dump would allow DB-native browse/filter across the long tail.
It would use half the 350 MB stop-line, so it needs DevOps approval. It isn't needed for
search or pages, which v1 already covers.

## Alternatives considered

| Option | Monthly cost | Why not (now) |
| --- | --- | --- |
| Supabase Pro / bigger DB | $25+ | Paid, and episodes still don't fit. |
| Hosted search (Algolia/Typesense/Meilisearch Cloud) | paid at 4.7M docs | Paid; also a new vendor. |
| Self-hosted search on an "always free" VM | $0 (card on file) | New vendor + infra to run; outside the Supabase + Vercel stack rule. |
| Static SQLite/Parquet of the dump over HTTP range requests | ~$0 | 1–2 GB artifact to rebuild weekly and host; heavy per-query downloads; new infra. |
| Slim directory table in Supabase | $0 until it isn't | ≥1.6 GB for all shows; ~170 MB for active-only (Phase 3). |
| **Live index + cache (chosen)** | **$0** | Ships now; the only trade-off is no ratings until promotion. |
