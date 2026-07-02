# Supabase Moderation Admin

This Vite project exposes the moderation API through Vercel Functions in `api/` and serves the admin UI at `/admin` and `/admin/reports`.

## Required Vercel Environment

Set these in Vercel for Production and Preview:

```env
VITE_SUPABASE_URL=https://ookbeuiavzjhvezvamfu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<production publishable key>
SUPABASE_SECRET_KEY=<production service role key>
```

Optional temporary fallback while bootstrapping the `admin_users` table:

```env
EXPLORE_ADMIN_ALLOWED_EMAILS=you@example.com
```

`SUPABASE_SECRET_KEY` is only read by serverless functions and the local Express API. Do not add it to any `VITE_` variable.

## Migration

Run this migration against the production Supabase project:

```text
supabase/migrations/20260629170000_moderation.sql
supabase/migrations/20260630120000_moderation_hide_for_reporter.sql
```

It creates:

- `content_reports`
- `admin_users`
- `moderation_actions`
- `user_hidden_content`

It also adds `videos.moderation_status` and `places.moderation_status` for global public visibility. User reports should not write `videos.state = 'reported'` or `places.state = 'reported'`.

It also enables RLS and adds policies for user report inserts, per-user hidden content, plus admin/moderator reads and updates.

## Add Your User As Admin

After creating or signing in with your Supabase Auth user, run:

```sql
insert into public.admin_users (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('you@example.com')
on conflict (user_id) do update set role = excluded.role;
```

Use `moderator` instead of `admin` for limited moderation staff.

## API Endpoints

All moderation and legacy API routes are served by **one** Vercel function: `api/index.js` (rewrites in `vercel.json`).

- `GET /api/health` — config check (no auth)
- `POST /api/reports`
- `GET /api/user/hidden-content`
- `POST /api/user/hidden-content`
- `POST /api/user/hidden-content/unhide`
- `GET /api/admin/reports`
- `GET /api/admin/moderation/summary` for dashboard metrics, visibility counts, and recent admin actions
- `GET /api/admin/ops/summary` for the full admin operations console summary
- `GET /api/admin/users` for recent/searchable user operations rows
- `PATCH /api/admin/reports/:id`
- `POST /api/admin/moderation/action`
- `GET /api/admin/me` for the admin UI role check

All endpoints require `Authorization: Bearer <supabase_access_token>`.

## End-to-End Test Flow

1. Sign in to Supabase from the mobile app or Supabase client and copy the user access token.
2. Submit a report:

```bash
curl -X POST https://www.exploreapphq.com/api/reports \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content_type\":\"video\",\"content_id\":\"VIDEO_ID\",\"reason\":\"spam\",\"details\":\"test report\",\"metadata\":{},\"hide_for_reporter\":true}"
```

3. Send the same request again. It should return `already_reported: true` and still ensure `user_hidden_content` exists for the reporter.
4. Sign in at `https://www.exploreapphq.com/admin` with a Supabase admin/moderator account.
5. Open `https://www.exploreapphq.com/admin/reports`.
6. Mark the report reviewed or dismissed. This updates only `content_reports.status`.
7. Use an explicit content visibility action such as Hide video, Restore video, or Remove content. Only these actions change `videos.moderation_status` or `places.moderation_status`.

For local development, use `npm run dev:all`, then call `http://localhost:5173/api/reports` through the Vite proxy.
