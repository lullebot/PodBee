# Turning on the full catalog — setup checklist

Everything here is a one-time setup. It takes about 20 minutes and costs nothing: Supabase
free tier, Vercel Hobby, and a free Podcast Index API key. Do the steps in order. Design
background is in [`FULL_CATALOG.md`](FULL_CATALOG.md).

| What you get | Needs |
| --- | --- |
| **Every episode of every catalog show** (e.g. all ~2,400 Joe Rogan episodes), sortable by Newest / Oldest / Top rated / Lowest rated | Step 1 only. It works as soon as PR #21 is deployed. |
| **Ratings, reviews and Listen List on every episode** (including ones the pipeline never stored) | Steps 1–3 + 5 |
| **Every Podcast Index show (~4.7M) searchable, with its own page, ratings and all episodes** | Steps 1–5 |

---

## 1. Merge the PR

1. Open [lullebot/podbee#21](https://github.com/lullebot/PodBee/pull/21) and check that CI is green.
2. Click **Merge**. Vercel deploys `main` automatically.

## 2. Apply the database migration

Use the Supabase SQL editor, **not** `supabase db push`. The live migration history uses
different version numbers from the files in `supabase/migrations/`, so the CLI would try to
re-run old migrations.

1. Open the SQL editor:
   <https://supabase.com/dashboard/project/kbstedomrylyomotacer/sql/new>
2. Paste the **entire** contents of
   [`supabase/migrations/20260927150000_long_tail_ratings.sql`](../supabase/migrations/20260927150000_long_tail_ratings.sql)
   and click **Run**. It should report "Success. No rows returned".
3. Check it worked. Run this and expect **2 rows** (`ensure_episode_row`, `ensure_podcast_row`):

   ```sql
   select proname from pg_proc where proname in ('ensure_podcast_row', 'ensure_episode_row');
   ```

It adds two nullable columns, a few functions, an updated `podcasts_display` view and two
triggers. It adds no tables and changes no existing data.

## 3. Create the signing secret (in Supabase)

This secret lets the database trust show and episode data that the website fetched. Use the
**same value** in Supabase (now) and Vercel (step 5).

1. Generate it on your Mac/Linux terminal and copy the 64-character output:

   ```bash
   openssl rand -hex 32
   ```

   Keep it in your password manager. Never commit it or paste it into chat.
2. In the Supabase SQL editor, run (with your value):

   ```sql
   select vault.create_secret('PASTE-THE-64-CHARACTERS-HERE', 'long_tail_signing_secret');
   ```

3. Check it: `select name from vault.secrets where name = 'long_tail_signing_secret';` should
   return 1 row.

To rotate it later, run `select vault.update_secret(id, 'NEW-VALUE') from vault.secrets where
name = 'long_tail_signing_secret';`, then update the Vercel value and redeploy.

## 4. Get a Podcast Index API key (free)

1. Sign up at <https://api.podcastindex.org/signup>. The key and secret arrive by email.
2. Use a **separate** key from the pipeline's (`pipeline/`), so either can be revoked on its own.

## 5. Add the environment variables in Vercel, then redeploy

1. Vercel dashboard → project **podbee** (not `apkguiden`) → **Settings → Environment
   Variables**.
2. Add these three. Do **not** add a `NEXT_PUBLIC_` prefix, and tick **Sensitive**. Set the
   environment to **Production**, and also **Preview** if you want preview deploys to have it:

   | Name | Value |
   | --- | --- |
   | `PODCAST_INDEX_API_KEY` | the key from step 4 |
   | `PODCAST_INDEX_API_SECRET` | the secret from step 4 |
   | `LONG_TAIL_SIGNING_SECRET` | the 64 characters from step 3 (same as in Vault) |

   Leave `PODBEE_LONG_TAIL_INDEXABLE` **unset**, so long-tail pages stay out of Google and
   crawlers can't burn the free quota.
3. **Deployments** → the latest Production deployment → **⋯ → Redeploy**. Environment
   variables only reach new deployments.

## 6. Smoke test (5 minutes)

1. **All episodes:** open `/podcasts/the-joe-rogan-experience`. The header should say
   "1–50 of 2,xxx" (the full feed), not ~120. Click **Oldest**, and episode #1 (2009) should
   be first. Click **Next page** and it should go on.
2. **Rate an old episode:** sign in, open an old episode (its URL looks like
   `/podcasts/the-joe-rogan-experience/e-…`), and tap a rating. Go back, click **Top
   rated**, and it should be first.
3. **Long tail:** search for a show that isn't in the catalog, e.g. "Hardcore History". Open
   the result (its URL starts `/podcasts/pi-…`), rate the show, then rate one of its episodes.
4. **Check the database (optional):**

   ```sql
   select slug, title from podcasts where podcast_index_id is not null;      -- rated long-tail shows
   select slug, title from episodes where feed_item_key is not null limit 20; -- rated feed episodes
   ```

If a rating shows "Ratings for this show aren't available yet", `LONG_TAIL_SIGNING_SECRET` is
missing in Vercel or you didn't redeploy. If it shows "Could not save — please try again", the
migration (step 2) or the Vault secret (step 3) is missing, or the two secret values differ.

---

## What you do *not* need to change

- **The pipeline's 60-episode cap** (`--max-episodes 60`). It now only limits which episodes
  get a full database row with credits/cast. Pages list every episode from the show's RSS feed
  regardless, and any episode gets a row as soon as someone rates or lists it. Raising the cap
  to "all" would cost ~2.3 KB per episode. Joe Rogan alone would be ~5.5 MB, and the whole
  catalog would blow past the 500 MB free database.
- **Your Vercel plan**, for now. At a few hundred visitors, Hobby's limits are nowhere near
  reached. **Before you switch on AdSense banners**, move to Vercel Pro ($20/month): Vercel's
  fair-use rules treat ads as commercial use, which Hobby doesn't allow.

## Optional follow-ups (not blocking)

- **Pipeline chart refresh:** make it skip rows whose slug starts with `pi-`, so rated
  long-tail shows don't enter charts without genres. This wasn't verified in PR #21.
- **Migration history:** add the live-only migration `ratings_listen_list_indexes_and_rls_perf`
  to `supabase/migrations/` so the repo matches the database.
