# PodBee Roadmap

Owned by Business Lead. Update when a sprint opens/closes or a bet is parked/opened. Management GC is for live status; this file is the archive + plan.

## North star sequence
1. Denser catalog (charts, title pages, search feel real)
2. Free website ads (only near-term revenue)
3. Accounts + ratings/reviews (Apple / Google / email login)
4. "People like you also liked" recommendations

Hard rules: free-tier only (Supabase + Vercel Hobby); never touch Vercel project apkguiden; no media player; structured audio database / IMDb for podcasts.

## Sprint 1 — Foundation (done)
- [x] Catalog schema + RLS (public read)
- [x] Charts/genres + chart_rankings seed
- [x] Next.js home charts + title/person pages (navy IMDb UI)
- [x] Vercel Hobby deploy https://podbee.vercel.app
- [x] Similar podcasts views

## Sprint 2 — Catalog depth + ad readiness (in progress)
**Goal:** Dense credible charts/title pages + search; reserve tasteful ad slots. Ads network not wired until catalog feels real.
**Success:** 4 full charts with covers; title pages with cast/episodes/related; search by name; ad placeholders ready.

Checklist:
- [x] Frontend: search `/search`, sticky header, ad placeholders on home + title
- [x] Pipeline: ingest PR merged; first Podcast Index + RSS load running
- [x] DevOps: free-tier watch; write keys local only (never on Vercel)
- [x] Database: standby — schema ready (trigram search, credits, similar views)
- [ ] Pipeline: first load complete; charts/search filled with real shows
- [ ] Frontend: polish empty states / episode lists once real episodes land
- [ ] Business: greenlight free ad network only after catalog looks real (DevOps confirms $0 first)

Out of scope this sprint: freemium/CAST Pro, auth UI, ratings tables, Podcast Index full crawl, paid anything, player.

## Parked (do not build until Business Lead opens the bet)
- [ ] Supabase Auth profiles + Apple / Google / email login
- [ ] User ratings + reviews on podcasts (community track record)
- [ ] Similar-taste recommendations from ratings
- [ ] Freemium / CAST Pro / other non-ad revenue

## Notes
- Short-term revenue = website ads only.
- Community ratings + easy login are the eventual IMDb moat — later, after catalog + ads.
