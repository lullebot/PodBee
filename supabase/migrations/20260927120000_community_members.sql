-- Community list: every registered user's email in one structured table,
-- plus explicit, timestamped marketing consent (GDPR: opt-in only, default
-- off, withdrawable any time via the profile page or an unsubscribe link).
--
-- Private by construction: anon has no access at all, a signed-in user can
-- read only their own row, and every write goes through the auth.users
-- triggers or the two functions below. To pull the mailing list (e.g. from
-- the Supabase SQL editor or an export job):
--
--   select email, unsubscribe_token
--   from public.community_members
--   where marketing_opt_in;
--
-- Every marketing email must include an unsubscribe link of the form
--   https://<site>/unsubscribe?token=<unsubscribe_token>

create table public.community_members (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  signup_method text not null default 'email',
  signed_up_at timestamptz not null default now(),
  marketing_opt_in boolean not null default false,
  marketing_opt_in_changed_at timestamptz,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

alter table public.community_members enable row level security;

revoke all on public.community_members from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.community_members from authenticated;

create policy "community_members_owner_read" on public.community_members
  for select to authenticated using (auth.uid() = user_id);

-- Signup: create the profile (now using Google's name/picture when present)
-- and the community_members row. marketing_opt_in comes from the email
-- signup form's checkbox via user metadata; OAuth signups start opted out
-- and opt in through /auth/callback or the profile page.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  display text;
  base_username text;
  opted_in boolean := coalesce(meta ->> 'marketing_opt_in' = 'true', false);
begin
  display := coalesce(
    nullif(trim(meta ->> 'display_name'), ''),
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(trim(meta ->> 'name'), '')
  );
  base_username := coalesce(
    nullif(trim(meta ->> 'username'), ''),
    display,
    split_part(new.email, '@', 1),
    'user'
  );
  base_username := trim(both '_' from regexp_replace(lower(base_username), '[^a-z0-9_]+', '_', 'g'));
  if base_username = '' then
    base_username := 'user';
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    base_username || '_' || substr(new.id::text, 1, 8),
    coalesce(display, base_username),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  )
  on conflict (id) do nothing;

  if new.email is not null then
    insert into public.community_members (
      user_id, email, signup_method, signed_up_at,
      marketing_opt_in, marketing_opt_in_changed_at
    )
    values (
      new.id,
      new.email,
      coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
      coalesce(new.created_at, now()),
      opted_in,
      case when opted_in then now() end
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Keep the community list's email in step with auth.users when a user
-- changes their address.
create or replace function public.sync_community_member_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    insert into public.community_members (user_id, email, signup_method, signed_up_at)
    values (
      new.id,
      new.email,
      coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
      coalesce(new.created_at, now())
    )
    on conflict (user_id) do update
      set email = excluded.email, updated_at = now();
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_community_member_email();

-- Signed-in user toggles their own consent. The timestamp only moves on an
-- actual change, so it records when consent was given or withdrawn.
create or replace function public.set_marketing_opt_in(opt_in boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.community_members
  set marketing_opt_in = opt_in,
      marketing_opt_in_changed_at = now(),
      updated_at = now()
  where user_id = auth.uid()
    and marketing_opt_in is distinct from opt_in;
end;
$$;

-- One-click unsubscribe from an email link, no sign-in needed. The token is
-- an unguessable per-user uuid.
create or replace function public.unsubscribe_by_token(token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_members
  set marketing_opt_in = false,
      marketing_opt_in_changed_at = case
        when marketing_opt_in then now() else marketing_opt_in_changed_at end,
      updated_at = now()
  where unsubscribe_token = token;
  return found;
end;
$$;

revoke execute on function public.sync_community_member_email() from public, anon, authenticated;
revoke execute on function public.set_marketing_opt_in(boolean) from public, anon;
grant execute on function public.set_marketing_opt_in(boolean) to authenticated;
revoke execute on function public.unsubscribe_by_token(uuid) from public;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;

-- Existing accounts join the list opted out.
insert into public.community_members (user_id, email, signup_method, signed_up_at)
select id, email, coalesce(raw_app_meta_data ->> 'provider', 'email'), created_at
from auth.users
where email is not null
on conflict (user_id) do nothing;
