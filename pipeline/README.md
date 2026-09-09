# PodBee RSS ingest

Sprint 2 catalog loader. Fetches **public podcast RSS feeds** and upserts into the live Supabase schema (`podcasts`, `seasons`, `episodes`, `people`, credits, `podcast_genres`, `chart_entries`).

This is **not** a media player. Enclosure URLs are stored as episode metadata only. No Podcast Index API.

The Next.js app keeps using the **anon** key. This package is the only place that should see `SUPABASE_SERVICE_ROLE_KEY`.

## Setup

Python 3.11+ from the repo root:

```bash
python -m pip install -r pipeline/requirements.txt
```

## Environment

Set these in the shell or a gitignored `.env` / `.env.local` (never commit secrets):

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes (writes) | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (writes) | **service_role** key from Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | fallback | Used only if `SUPABASE_URL` is unset |
| `PODCAST_INDEX_API_KEY` | no | Optional. Enables 4 small trending lookups |
| `PODCAST_INDEX_API_SECRET` | no | Optional. Pair with the key above |

Do **not** put `service_role` or Podcast Index secrets in `NEXT_PUBLIC_*` vars or any frontend code.

### Two modes

1. **RSS-only (default when PI env is missing)** — ingest `feeds.txt` and any other public RSS URLs you pass. This is the supported free-tier path.
2. **RSS + trending discovery** — if both `PODCAST_INDEX_*` vars are set, the CLI makes **four** targeted `GET /podcasts/trending` calls (`Comedy`, `True Crime`, `News`, and uncategorized overall), `max≤25` each, then RSS-fetches those feed URLs for episodes and covers.

Force RSS-only even when PI credentials are present:

```bash
python -m pipeline.ingest --feeds feeds.txt --rss-only
```

**Podcast Index ToS:** do **not** scrape or crawl the entire index via the API (no full-catalog pagination, no `bytag` walk, no dump-scale loops). Weekly database dump is the bulk path and is out of scope here. Episode/cover detail always comes from each show’s public RSS.

## Run

```bash
python -m pipeline.ingest --feeds feeds.txt
```

`feeds.txt` resolves relative to the current directory **or** `pipeline/` (so the command works from the repo root).

Useful flags:

```bash
# parse only — no database writes, no service_role required
python -m pipeline.ingest --feeds feeds.txt --dry-run --limit-feeds 3 --rss-only

# keep a smaller episode window (default 80 most-recent per show)
python -m pipeline.ingest --feeds feeds.txt --max-episodes 40

# skip chart_entries rebuild
python -m pipeline.ingest --feeds feeds.txt --skip-charts
```

## What it writes

Idempotent upserts (select + update, or `ON CONFLICT` on unique keys):

- `podcasts` on `slug` — `cover_image_url` from `itunes:image` / feed artwork, `rss_url`, description, language, explicit, status
- `seasons` on `(podcast_id, number)` when `itunes:season` is present
- `episodes` on `(podcast_id, slug)`
- `people` on `slug` derived from `display_name`; merged on re-run
- `podcast_credits` / `episode_credits` on `(work_id, person_id, role_id)`
- `genres` + `podcast_genres` (primary = first iTunes category)
- `charts` + `chart_entries` for slugs `top-overall`, `top-comedy`, `top-true-crime`, `top-news`

Roles are mapped onto existing `credit_roles` ids only: `host`, `co_host`, `guest`, `producer`, `executive_producer`.

Credit sources (heuristics, not a credits API):

- channel `itunes:author` / `itunes:owner` when the value looks like a person
- show notes: “hosted by”, “join your host”, “best friend”, “produced by”, “executive producer”, “guest:”
- episode titles that are a person name and appear in the notes (interview shows)

Organization names (`NPR`, `The New York Times`, `Audiochuck`, …) are skipped.

## Charts

After upserts, `chart_entries` for the four home-page slugs is replaced with a **dense** 1…N ranking:

1. Genre charts only include shows tagged with that genre (`comedy`, `true-crime`, `news`).
2. Score = `rating_average` (and a log count boost) when ratings exist; otherwise recency of the latest episode + episode count + a cover-art bonus so posters stay populated.

## Starter feeds

`pipeline/feeds.txt` lists ~30 public feeds (This American Life, Serial, Radiolab, The Daily, Wait Wait, Crime Junkie, My Favorite Murder, Conan O’Brien Needs a Friend, Stuff You Should Know, NPR News Now, Up First, and more). One URL per line; `#` comments allowed.

## Tests

```bash
python -m unittest discover -s pipeline/tests -t .
```
