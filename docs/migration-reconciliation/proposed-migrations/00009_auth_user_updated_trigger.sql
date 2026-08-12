-- Sync public.users when auth.users is updated (email confirmation, email change).
-- The 00007 trigger only fires on INSERT; this complements it so that
-- email_verified flips to true automatically once auth.users.email_confirmed_at
-- is set by GoTrue (after OTP verification). Also keeps email columns aligned.

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set
    email = coalesce(new.email, public.users.email),
    email_verified = case
      when new.email_confirmed_at is not null then true
      else public.users.email_verified
    end
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();
