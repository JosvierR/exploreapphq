create extension if not exists pgcrypto;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('video', 'user', 'place', 'place_photo')),
  content_id text not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'harassment', 'violence', 'sexual_content', 'fake', 'other')),
  details text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'removed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, content_type, content_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  report_id uuid references public.content_reports(id) on delete set null,
  target_type text not null check (target_type in ('video', 'user', 'place', 'place_photo')),
  target_id text not null,
  action_type text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists content_reports_status_created_at_idx
  on public.content_reports (status, created_at desc);

create index if not exists content_reports_content_type_status_idx
  on public.content_reports (content_type, status);

create index if not exists content_reports_content_type_content_id_idx
  on public.content_reports (content_type, content_id);

create index if not exists moderation_actions_target_type_target_id_idx
  on public.moderation_actions (target_type, target_id);

create index if not exists moderation_actions_admin_id_created_at_idx
  on public.moderation_actions (admin_id, created_at desc);

alter table public.admin_users enable row level security;
alter table public.content_reports enable row level security;
alter table public.moderation_actions enable row level security;

create or replace function public.is_explore_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role in ('admin', 'moderator')
  );
$$;

grant execute on function public.is_explore_admin() to authenticated;

drop policy if exists "admin users can read own row or admins can read all" on public.admin_users;
create policy "admin users can read own row or admins can read all"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_explore_admin());

drop policy if exists "admins can manage admin users" on public.admin_users;
create policy "admins can manage admin users"
  on public.admin_users
  for all
  to authenticated
  using (public.is_explore_admin())
  with check (public.is_explore_admin());

drop policy if exists "authenticated users can insert own reports" on public.content_reports;
create policy "authenticated users can insert own reports"
  on public.content_reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "admins can read reports" on public.content_reports;
create policy "admins can read reports"
  on public.content_reports
  for select
  to authenticated
  using (public.is_explore_admin());

drop policy if exists "admins can update reports" on public.content_reports;
create policy "admins can update reports"
  on public.content_reports
  for update
  to authenticated
  using (public.is_explore_admin())
  with check (public.is_explore_admin());

drop policy if exists "admins can read moderation actions" on public.moderation_actions;
create policy "admins can read moderation actions"
  on public.moderation_actions
  for select
  to authenticated
  using (public.is_explore_admin());

drop policy if exists "admins can insert moderation actions" on public.moderation_actions;
create policy "admins can insert moderation actions"
  on public.moderation_actions
  for insert
  to authenticated
  with check (public.is_explore_admin() and admin_id = auth.uid());
