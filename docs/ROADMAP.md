# PodBee Roadmap

Owned by Business Lead. Update when a sprint opens/closes or a bet is parked/opened. Management GC is for live status; this file is the archive + plan.

## North star sequence
1. Denser capped catalog + IMDb UI polish (Sprint 3 — current)
2. Free website ads (AdSense approved; banners parked until Sprint 3 feels done)
3. Accounts + ratings/reviews (email/password login; Sprint 4 — shipped, see below)
4. "People like you also liked" recommendations

Hard rules: free-tier only (Supabase + Vercel Hobby); never touch Vercel project apkguiden; no media player; structured audio database / IMDb for podcasts.

## Sprint 1 — Foundation (done)
- [x] Catalog schema + RLS (public read)
- [x] Charts/genres + chart_rankings seed
- [x] Next.js home charts + title/person pages (navy IMDb UI)
- [x] Vercel Hobby deploy https://podbee.vercel.app
- [x] Similar podcasts views

## Sprint 2 — Catalog depth + ad readiness (done)
**Goal:** Search, ad placeholders, RSS/Podcast Index ingest, real charts; AdSense verified/approved (banners not wired).

Checklist:
- [x] Frontend: search `/search`, sticky header, ad placeholders on home + title
- [x] Pipeline: ingest PR merged; Podcast Index + RSS ingest
- [x] Charts filled with real shows
- [x] DevOps: free-tier watch; write keys local only (never on Vercel)
- [x] Database: schema ready (trigram search, credits, similar views)
- [x] AdSense account verified/approved (banners not wired)

Out of scope this sprint: freemium/CAST Pro, auth UI, ratings tables, Podcast Index full crawl, paid anything, player.

## Sprint 3 — Capped catalog + UI polish (in progress)
**Goal:** Feel like real IMDb browse under a free-tier cap.
**Cap (DevOps):** ~1,200 podcasts total, ≤60 newest episodes/show; stop if DB est. >~350 MB. No uncapped dump.

Checklist:
- [x] Free-tier growth cap locked
- [x] Bridge densify baseline (~122 shows / ~9k eps; genre charts filled)
- [x] Frontend IMDb polish on production (chart counts/thin states, title cast/episodes/More like this, person Known for, search popular-when-empty)
- [x] AdSense ownership verified + approved; ads.txt/robots/indexable; client script live; **banners parked**
- [ ] Pipeline Sprint 3 batch 1 (~302 trending feeds @ 60 eps/show) finish + chart refresh
- [ ] DevOps size check vs ~350 MB after batch
- [ ] Further capped batches toward ~1,200 shows if under cap
- [ ] Lukas “closer to done” → reopen banner wiring (home 5273997618 / title 8669105698)

Out of scope: freemium, uncapped dump, paid upgrades, player.

## Sprint 4 — Accounts, ratings (shows + episodes), Listen List (bet opened + shipped)
**Goal:** IMDb-style accounts — bare 1–10 ratings, private unless reviewed, real crowd-sourced
score behind a settings toggle (shows keep the pipeline-seeded placeholder score until flipped),
Listen List for shows and episodes.

Checklist:
- [x] Supabase Auth (email/password; schema leaves room for Google OAuth later, no migration needed)
- [x] `profiles` table + trigger from `auth.users`
- [x] `podcast_ratings` / `episode_ratings` — RLS: private unless `review_text` is set
- [x] Aggregate triggers recompute `avg_rating`/count over ALL ratings, including anonymous ones
- [x] `app_settings.use_real_ratings` + `podcasts_display` view — one `update` flips every show page
      to real ratings with no deploy (episodes always show real ratings, no fake data existed for them)
- [x] Rating widget + optional review, "Your rating: X", Reviews section on both page types
- [x] `listen_list_shows` / `listen_list_episodes` + toggle buttons
- [x] Profile page — Your Ratings / Your Listen List tabs
- [ ] Flip `app_settings.use_real_ratings` to true once real show ratings have enough volume
- [ ] Apple / Google OAuth (schema already supports it — UI not built yet)

Note: `podbee_score` (the popularity/ranking input for `charts`/`chart_entries`) is untouched —
separate curated-chart system, per AGENTS.md. The placeholder score this sprint's fake/real switch
replaces on show pages is `podcasts.rating_average`/`rating_count` (pipeline-seeded from RSS/iTunes),
not `podbee_score`.

## Parked (do not build until Business Lead opens the bet)
- [ ] AdSense banners — parked until Sprint 3 feels done
- [ ] Similar-taste recommendations from ratings
- [ ] Freemium / CAST Pro / other non-ad revenue

## Product goals (Lukas — 2026-09-10)
Inform next bets after Business Lead opens them. Sprint 3 still = capped catalog + IMDb polish (charts list pages, title densify, person Known-for). Ask Database before new entities/columns.

1. **Interim show ranking** — how charts rank shows until we have enough on-site user reviews/ratings (auth/reviews still parked).
2. **Person → episode appearance search** — e.g. search “Barack Obama” and see every podcast episode they appeared on (not just people/podcast title match).
3. **Richer people & credits** — starring/hosts on titles; person pages with bio/basic facts (e.g. birthdate when known), appearance counts, podcasts list.

## Notes
- Short-term revenue = website ads only (banners parked until Sprint 3 feels done).
- Community ratings + easy login (Sprint 4) are the IMDb moat — shipped behind a fake/real score
  toggle so the catalog keeps its placeholder scores until real rating volume is worth switching to.
