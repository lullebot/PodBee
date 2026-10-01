# Full catalog on the free tier — the long-tail design

**Status:** built; off until the env vars below are set on Vercel (and, for ratings, the
long-tail ratings migration is applied).
**Cost:** $0/month. No new vendors, no new tables. The catalog itself adds **0 bytes** to
Supabase; only shows/episodes someone rates or lists get a ~1 KB row.

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
- **Show pages** `/podcasts/pi-{feedId}-{title}` render title, cover, author, genres and
  description from `podcasts/byfeedid`, and **every episode** from the show's own RSS feed
  (see [Every episode of every show](#every-episode-of-every-show)).
- **Episode pages** `/podcasts/{show}/e-{key}-{title}` work on any show, catalog or long-tail.
  They are read from the show's RSS feed.
- **Promotion is automatic on the URL side.** When the pipeline ingests a feed (same RSS URL,
  http/https and trailing-slash tolerant), its long-tail URL redirects to the catalog page
  (episode URLs redirect to the matching catalog episode by enclosure URL). Links and search
  results keep working as the catalog grows.
- **Ratings, reviews, and Listen List work on every show and episode** — see
  [Community ratings everywhere](#community-ratings-everywhere). Cast/credits stay catalog-only
  (they come from the pipeline's RSS heuristics).
- **Every show page lists and sorts all its episodes** by Newest, Oldest, Top rated or Lowest
  rated (rating sorts keep unrated episodes last), on catalog and long-tail shows alike.
- **No media player.** Enclosure URLs are used only to match episodes on promotion.

## Why this fits Vercel Hobby

Hobby includes 1M function invocations, 1M ISR reads, and 200k ISR writes a month, with cache
reads/writes metered in 8 KB units.

- Every cached payload is **trimmed before caching**: episode lists keep key, title, date,
  duration and enclosure URL only, packed as arrays (~180 B per episode, so 2,500 episodes ≈
  440 KB, under Next's 2 MB cache-entry limit). Descriptions are capped. At a few hundred
  visitors a month this is a rounding error against the quota.
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

## Every episode of every show

The pipeline stores the newest episodes of each catalog show in full (with credits). The ops
cap is 60 per show, because storing everything would cost ~2.3 KB per episode: Joe Rogan alone
is ~5.5 MB, and the whole catalog would exceed the free database. Podcast Index can't fill
the gap either: `episodes/byfeedid` stops at the newest 1,000, with no paging. So every show
page reads the **show's own RSS feed**, the complete source the pipeline already uses
(`src/lib/feed-episodes.ts`, `src/lib/show-episodes.ts`):

- **Fetched server-side** (20 s timeout, ≤ 60 MB), parsed with `fast-xml-parser` (show notes
  kept as raw text, not parsed), trimmed, packed, and cached 12 h with `unstable_cache`. A
  Joe Rogan-sized feed (2,500 episodes, 3.4 MB XML) parses in ~0.2 s into ~440 KB.
- **Merged with the show's database rows:** each feed item is matched by feed key, then
  enclosure URL. A pipeline row keeps its catalog page (credits); every other item gets an
  `e-{key}-{title}` page. Rated episodes always have a row, so **"Top rated" ranks every
  rated episode of the show**, however old.
- **Sorted and paged on the server** (`?sort=newest|oldest|top|lowest&season=N&page=N`, 50 per
  page). Only one page is sent to the browser: a 2,400-episode show page is ~90 KB of HTML.
- **Feed key:** a 12-hex sha1 of the item's `guid` (else enclosure URL, else title + date),
  stable across refreshes. It's stored on `episodes.feed_item_key` once the episode has a row.
- **Degrades safely:** if a feed is down or blocked, the page lists the episodes in the
  database and says so.

## Community ratings everywhere

Ratings, reviews, and Listen List rows reference `podcasts.id` / `episodes.id`, so a long-tail
show, or any feed episode without a row (including old episodes of catalog shows), gets a
**lightweight Supabase row the first time a signed-in user rates, reviews, or lists it**
(migration `20260927150000_long_tail_ratings.sql`):

- The row holds only what search, episode lists and the profile page need (title, cover,
  feed/enclosure URL, `pi-` or `e-` slug, `podcast_index_id` / `feed_item_key`). Pages keep
  rendering live from Podcast Index and RSS; the row just anchors ratings. ~1 KB per touched show/episode + ~150 B per rating, so the database grows with
  engagement (10k rated shows + 200k ratings ≈ 40 MB), not with the 4.7M-show catalog.
- **Trust:** users still can't write to `podcasts`/`episodes`. Rows are created only by the
  `ensure_podcast_row` / `ensure_episode_row` RPCs, which accept a payload the Next.js server
  built from Podcast Index / RSS data and signed with HMAC-SHA256
  (`LONG_TAIL_SIGNING_SECRET`, also stored in Supabase Vault). Forged, tampered, expired, or
  signed-out calls are refused. No `service_role` anywhere near Vercel.
- **Scores show immediately.** Shows without a pipeline placeholder score display their real
  crowd average (the `podcasts_display` view now falls back to it), and a show with zero
  ratings shows "—" instead of "0.0".
- **Catalog shows too:** `ensure_episode_row` also accepts an existing show's `podcast_id`,
  so an old Joe Rogan episode the pipeline never stored is rated the same way. If the pipeline
  already has that episode (same enclosure URL), the existing row is used, not duplicated.
- **Promotion keeps the ratings.** If the pipeline later ingests the same feed, database
  triggers move the long-tail row's ratings, Listen List entries, and episodes onto the new
  catalog row (and merge episodes by enclosure URL), then drop the long-tail row. The old
  `pi-` URLs redirect to the catalog page.

Verified by running the real migration files on Postgres 17 (PGlite) against a replica of the
live schema. Also verified by a signed-in browser run against the built app with mocked
Supabase, Podcast Index and RSS:
- a 2,400-episode catalog show is fully listed and paged;
- Top rated surfaces a rated 2010 episode;
- an old episode of a catalog show is rated;
- a long-tail show and episode are rated and listed.

## Degrades safely

- No `PODCAST_INDEX_*` env (local dev, CI, preview) → search is catalog-only and `pi-` URLs
  show the existing "Not in the catalog yet" state. The build never needs the key.
- Podcast Index down or slow (4s timeout) → search still returns catalog results, cached
  long-tail pages keep rendering, and nothing bad gets cached (verified against a mock that
  returns 503).
- No `LONG_TAIL_SIGNING_SECRET` (or migration not applied yet) → long-tail pages and feed
  episode pages render without the rating widget / Listen List button; everything else
  (including full episode lists) works.
- A show's RSS feed down or blocked → its page lists the database episodes with a note.

## Code map

| File | Role |
| --- | --- |
| `src/lib/podcast-index.ts` | Pure: slugs, auth hash, HTML→text, response mapping + trimming, search merge/dedupe, signed payloads. Unit-tested. |
| `src/lib/feed-episodes.ts` | Pure: RSS → episode list, feed keys, `e-` slugs, cache packing, merge with database rows. Unit-tested (incl. a 2,500-episode feed). |
| `src/lib/show-episodes.ts` | Server: fetch + cache feeds, load a show's database episodes, find an episode's row. |
| `src/lib/podcast-index.test.ts` | Tests for the above (`npm test`). |
| `src/lib/long-tail.ts` | Server: cached Podcast Index client, promotion lookup, long-tail show resolver, feed-episode resolver for any show (+ crowd scores). |
| `src/app/actions/long-tail.ts` | Rate / review / Listen List on long-tail shows and on any feed episode: sign → RPC → existing rating actions. Returns readable `{ error }`s. |
| `supabase/migrations/20260927150000_long_tail_ratings.sql` | `podcasts.podcast_index_id`, `episodes.feed_item_key`, signed RPCs, score fallback, promotion triggers. |
| `src/lib/episode-sort.ts` | Newest / Oldest / Top rated / Lowest rated + URL query + server-side paging. |
| `src/components/podcast/EpisodeList.tsx` | Server-rendered episode list: sort/season/page are links. |
| `src/components/podcast/IndexPodcastProfile.tsx`, `FeedEpisodeProfile.tsx` | Long-tail show page; feed episode page (any show). |
| `src/app/podcasts/[slug]/page.tsx`, `[episodeSlug]/page.tsx` | `pi-` slugs resolve via the long tail first; `e-` episode slugs via the show's feed; noindex metadata for both. |
| `src/lib/search.ts` → `searchAllPodcasts` | Catalog + long-tail top-up for `/search` and `/api/search`. |

## Env

| Variable | Where | Notes |
| --- | --- | --- |
| `PODCAST_INDEX_API_KEY` / `PODCAST_INDEX_API_SECRET` | Vercel **server** env (Production) | Enables the long tail. Never `NEXT_PUBLIC_*`. Use a **separate** free PI key from the pipeline's so either can be revoked alone. |
| `LONG_TAIL_SIGNING_SECRET` | Vercel **server** env + Supabase Vault | ≥ 32 random chars (e.g. `openssl rand -hex 32`). Same value in both places: `select vault.create_secret('<value>', 'long_tail_signing_secret');` in the SQL editor. Enables ratings/Listen List on long-tail shows and feed episodes. Never commit it. |
| `PODBEE_LONG_TAIL_INDEXABLE` | Vercel server env | `1` lets search engines index long-tail pages. Default: noindex. |
| `PODCAST_INDEX_API_BASE` | local only | Points the client at a mock for testing. |

Podcast Index ToS: these are per-visitor lookups, which is the API's intended use. There's no
pagination, no crawl, and no bulk export. The pipeline's "never crawl the full index" rule still
holds.

## Setup

Step-by-step instructions (merge, migration, Vault secret, Podcast Index key, Vercel env,
smoke test) are in [`FULL_CATALOG_SETUP.md`](FULL_CATALOG_SETUP.md).

## Next: promote by demand

The rows created by ratings are the demand signal — no extra request table needed. A nightly
job can promote the most-rated long-tail shows into the full catalog (credits, genres, charts)
with the existing `ingest_feed`, inside the ops caps; the promotion triggers keep every rating.
Before that, the pipeline's chart refresh should skip long-tail rows (`slug like 'pi-%'`) so
they don't enter charts without genres or episodes — not verified in this change.

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
