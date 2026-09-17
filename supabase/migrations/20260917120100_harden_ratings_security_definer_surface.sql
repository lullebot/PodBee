-- Make podcasts_display run with the querying role's own RLS (not the
-- view owner's) -- podcasts and app_settings both already have public-read
-- policies, so this changes nothing observable, it just closes the
-- security-definer-view lint on newly-added code.
alter view public.podcasts_display set (security_invoker = true);

-- Trigger functions are only ever meant to run inside a trigger; block the
-- PostgREST /rpc/<fn> surface the linter flagged (calling them directly as
-- RPC would error anyway since they RETURN TRIGGER, but revoke explicitly
-- as defense in depth).
revoke execute on function public.recompute_podcast_rating() from public, anon, authenticated;
revoke execute on function public.recompute_episode_rating() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
