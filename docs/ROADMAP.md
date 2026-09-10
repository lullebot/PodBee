# PodBee Roadmap

Owned by Business Lead. Update when a sprint opens/closes or a bet is parked/opened. Management GC is for live status; this file is the archive + plan.

## North star sequence
1. Denser capped catalog + IMDb UI polish (Sprint 3 — current)
2. Free website ads (AdSense approved; banners parked until Sprint 3 feels done)
3. Accounts + ratings/reviews (Apple / Google / email login)
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

Out of scope: auth/ratings, freemium, uncapped dump, paid upgrades, player.

## Parked (do not build until Business Lead opens the bet)
- [ ] AdSense banners — parked until Sprint 3 feels done
- [ ] Supabase Auth profiles + Apple / Google / email login
- [ ] User ratings + reviews on podcasts (community track record)
- [ ] Similar-taste recommendations from ratings
- [ ] Freemium / CAST Pro / other non-ad revenue

## Notes
- Short-term revenue = website ads only (banners parked until Sprint 3 feels done).
- Community ratings + easy login are the eventual IMDb moat — later, after catalog + ads.
