-- Auto-create a public.users row whenever a new auth.users row is created.
-- Handle is generated as user_<12 hex chars of uid> (matches ^[a-zA-Z0-9_]{3,30}$).
-- display_name is pulled from provider metadata (Google: full_name, Apple: name)
-- with a fallback so the NOT NULL constraint never fires.
-- on conflict (id) do nothing keeps the trigger idempotent.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, handle, display_name, email, language, email_verified)
  values (
    new.id,
    'user_' || left(replace(new.id::text, '-', ''), 12),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1),
      'Usuario'
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'language', 'es'),
    coalesce((new.email_confirmed_at is not null), false)
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
