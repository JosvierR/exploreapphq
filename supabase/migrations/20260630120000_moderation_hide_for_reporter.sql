create extension if not exists pgcrypto;

-- Public content visibility is tracked separately from the report/case lifecycle.
-- These blocks are intentionally idempotent because production may already have
-- part of the moderation schema from earlier admin/report work.
do $$
begin
  if to_regclass('public.videos') is null then
    raise notice 'Skipping public.videos moderation_status setup because the table does not exist.';
    return;
  end if;

  alter table public.videos
    add column if not exists moderation_status text;

  update public.videos
  set moderation_status = 'active'
  where moderation_status is null
     or moderation_status not in ('active', 'under_review', 'hidden', 'removed');

  alter table public.videos
    alter column moderation_status set default 'active',
    alter column moderation_status set not null;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.videos'::regclass
      and conname = 'videos_moderation_status_check'
  ) then
    alter table public.videos
      add constraint videos_moderation_status_check
      check (moderation_status in ('active', 'under_review', 'hidden', 'removed'));
  end if;
end $$;

do $$
begin
  if to_regclass('public.videos') is not null then
    create index if not exists videos_moderation_status_idx
      on public.videos (moderation_status);
  end if;
end $$;

do $$
begin
  if to_regclass('public.places') is null then
    raise notice 'Skipping public.places moderation_status setup because the table does not exist.';
    return;
  end if;

  alter table public.places
    add column if not exists moderation_status text;

  update public.places
  set moderation_status = 'active'
  where moderation_status is null
     or moderation_status not in ('active', 'under_review', 'hidden', 'removed');

  alter table public.places
    alter column moderation_status set default 'active',
    alter column moderation_status set not null;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.places'::regclass
      and conname = 'places_moderation_status_check'
  ) then
    alter table public.places
      add constraint places_moderation_status_check
      check (moderation_status in ('active', 'under_review', 'hidden', 'removed'));
  end if;
end $$;

do $$
begin
  if to_regclass('public.places') is not null then
    create index if not exists places_moderation_status_idx
      on public.places (moderation_status);
  end if;
end $$;

create table if not exists public.user_hidden_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('video', 'place', 'user', 'place_photo')),
  content_id text not null,
  reason text not null default 'reported' check (reason in ('reported', 'hidden_by_user')),
  created_at timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

create index if not exists user_hidden_content_user_type_idx
  on public.user_hidden_content (user_id, content_type);

create index if not exists user_hidden_content_content_idx
  on public.user_hidden_content (content_type, content_id);

alter table public.user_hidden_content enable row level security;

drop policy if exists "users can read own hidden content" on public.user_hidden_content;
create policy "users can read own hidden content"
  on public.user_hidden_content
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users can insert own hidden content" on public.user_hidden_content;
create policy "users can insert own hidden content"
  on public.user_hidden_content
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users can delete own hidden content" on public.user_hidden_content;
create policy "users can delete own hidden content"
  on public.user_hidden_content
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Legacy backfill:
-- Older mobile flows may have written state = 'reported', which can make content
-- globally disappear. Move those rows into moderation_status = 'under_review'
-- and reset state only when the existing state column safely accepts a visible
-- value. Explicit past moderation_actions are preserved as hidden/removed.
do $$
declare
  state_attr record;
  can_publish boolean := false;
begin
  if to_regclass('public.videos') is null then
    return;
  end if;

  select a.atttypid, t.typtype
  into state_attr
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.videos'::regclass
    and a.attname = 'state'
    and not a.attisdropped;

  if not found then
    return;
  end if;

  if to_regclass('public.moderation_actions') is not null then
    update public.videos v
    set moderation_status = 'removed'
    where v.state::text = 'reported'
      and exists (
        select 1
        from public.moderation_actions ma
        where ma.target_type = 'video'
          and ma.target_id = v.id::text
          and ma.action_type = 'remove_content'
      );

    update public.videos v
    set moderation_status = 'hidden'
    where v.state::text = 'reported'
      and v.moderation_status <> 'removed'
      and exists (
        select 1
        from public.moderation_actions ma
        where ma.target_type = 'video'
          and ma.target_id = v.id::text
          and ma.action_type = 'hide_video'
      );
  end if;

  update public.videos
  set moderation_status = 'under_review'
  where state::text = 'reported'
    and moderation_status not in ('hidden', 'removed');

  if state_attr.typtype = 'e' then
    select exists (
      select 1
      from pg_enum
      where enumtypid = state_attr.atttypid
        and enumlabel = 'published'
    )
    into can_publish;
  else
    can_publish := true;
  end if;

  if can_publish then
    begin
      execute 'update public.videos set state = ''published'' where state::text = ''reported''';
    exception when others then
      raise notice 'Skipped resetting public.videos.state from reported to published: %', SQLERRM;
    end;
  else
    raise notice 'Skipped resetting public.videos.state because published is not an accepted state value.';
  end if;
end $$;

do $$
declare
  state_attr record;
  candidate text;
  chosen_state text := null;
  candidate_allowed boolean;
begin
  if to_regclass('public.places') is null then
    return;
  end if;

  select a.atttypid, t.typtype
  into state_attr
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.places'::regclass
    and a.attname = 'state'
    and not a.attisdropped;

  if not found then
    return;
  end if;

  if to_regclass('public.moderation_actions') is not null then
    update public.places p
    set moderation_status = 'removed'
    where p.state::text = 'reported'
      and exists (
        select 1
        from public.moderation_actions ma
        where ma.target_type = 'place'
          and ma.target_id = p.id::text
          and ma.action_type = 'remove_content'
      );

    update public.places p
    set moderation_status = 'hidden'
    where p.state::text = 'reported'
      and p.moderation_status <> 'removed'
      and exists (
        select 1
        from public.moderation_actions ma
        where ma.target_type = 'place'
          and ma.target_id = p.id::text
          and ma.action_type = 'hide_place'
      );
  end if;

  update public.places
  set moderation_status = 'under_review'
  where state::text = 'reported'
    and moderation_status not in ('hidden', 'removed');

  foreach candidate in array array['published', 'active', 'approved', 'visible', 'public']
  loop
    if state_attr.typtype = 'e' then
      select exists (
        select 1
        from pg_enum
        where enumtypid = state_attr.atttypid
          and enumlabel = candidate
      )
      into candidate_allowed;

      if not candidate_allowed then
        continue;
      end if;
    end if;

    begin
      execute format(
        'update public.places set state = %L where state::text = ''reported''',
        candidate
      );
      chosen_state := candidate;
      exit;
    exception when others then
      raise notice 'Skipped resetting public.places.state from reported to %: %', candidate, SQLERRM;
    end;
  end loop;

  if chosen_state is null then
    raise notice 'Skipped resetting public.places.state because no safe visible state value was accepted.';
  end if;
end $$;
