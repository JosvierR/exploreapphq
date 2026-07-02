# Explore Admin Console

The admin UI at `/admin` is the operations console for Explore. It keeps user operations, content inventory, moderation workflow, product insights, and system health in one authenticated workspace.

## Routes

- `/admin?section=overview` - high-level users, content, moderation, and system snapshot.
- `/admin?section=users` - user totals, growth, deactivated users, ghost/test users, and recent user lookup.
- `/admin?section=content` - videos, places, and routes inventory with recent rows and state counts.
- `/admin?section=moderation` - report queue, content visibility state, and moderation lifecycle reminders.
- `/admin/reports` - full reports table, filters, detail drawer, and moderation actions.
- `/admin?section=insights` - operational insights from currently available tables.
- `/admin?section=analytics` - analytics/data foundation gaps.
- `/admin?section=system` - API, Supabase, server secret, admin authorization, and domain checks.

## API Endpoints

All admin endpoints require `Authorization: Bearer <supabase_access_token>` for an admin or moderator.

- `GET /api/admin/ops/summary` returns the console summary for overview, users, content, moderation, insights, and system sections.
- `GET /api/admin/users?query=&limit=25` returns recent users from the first available `profiles` or `users` table.
- `GET /api/admin/moderation/summary` remains available for existing moderation dashboard/report code.
- `GET /api/admin/reports`, `PATCH /api/admin/reports/:id`, and `POST /api/admin/moderation/action` remain the source for report review and visibility actions.

The ops summary is defensive around schema differences. If an optional table or column is not available, the API returns `null` for that metric and includes a warning instead of failing the whole console.

## Current Metrics

Available now when the backing tables/columns exist:

- Users: total users, new users in 24 hours, new users in 7 days, deactivated users, ghost/test users, recent user rows.
- Content: video, place, and route totals; published/processing/draft/public states; moderation visibility state for videos and places; recent content rows.
- Engagement: likes, comments, followers, user-hidden content, and analytics event table availability.
- Moderation: report totals, pending/reviewed/dismissed/removed counts, oldest pending report, admin actions, remove-content actions, reason/type breakdowns.
- System: API connectivity, Supabase public configuration, server secret configuration, admin authorization, runtime environment, and domain links.

## Current Data Sources

The console reads from these tables when present:

- `profiles` or `users` for user rows and account growth.
- `videos` for video totals, publication state, moderation state, thumbnails, creators, likes, and comments.
- `places` for place totals, publication state, moderation state, category, rating, and creators.
- `routes` for route totals, public/draft state, category, difficulty, and creators.
- `content_reports` for report workflow status, reasons, content types, and pending age.
- `moderation_actions` for recent admin actions and remove-content action counts.
- `user_hidden_content` for per-user hidden content totals.
- `likes`, `video_likes`, `comments`, `video_comments`, `followers`, `user_followers`, or `follows` for engagement-lite totals when available.
- `analytics_events` only as an availability signal until event definitions are stable.

## Analytics Foundation

The console intentionally labels the following as foundation work unless the product has a stable analytics event model:

- DAU and WAU
- retention
- impressions
- click-through rate
- route starts
- recommendation signal quality
- preference and personalization metrics

Do not fake these numbers from unrelated operational tables. Add an `analytics_events` model or warehouse view first, then wire the console to those validated definitions.

Future analytics foundation plan:

- Define canonical event names and required properties for content impressions, content opens, route starts, search, follows, likes, comments, reports, and recommendation interactions.
- Add server-validated ingestion or trusted client ingestion with bot/spam filtering.
- Build daily aggregate views for DAU, WAU, retention cohorts, CTR, content funnels, and recommendation quality.
- Backfill only when historical data is trustworthy enough to compare with new event definitions.
- Expose aggregates to the admin API instead of querying raw event streams from the browser.

## Moderation Model

Reports and visibility are separate:

- `content_reports.status` tracks workflow decisions such as pending, reviewed, dismissed, and removed.
- `videos.moderation_status` and `places.moderation_status` control global public visibility.
- `user_hidden_content` hides content for one reporting user only.

The Reports page remains the place to inspect individual reports, preserve reviewed/dismissed rows, and take explicit visibility actions such as hide, restore, or remove.

## Security Notes

- Never expose `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Only `VITE_` variables may be used client-side.
- The System section reports configured/not configured state only. It never renders secret values.
- Keep `/api/*` routed to API handlers and `/admin/*` routed to the React admin UI.

## Local Validation

Run:

```bash
npm run lint
npx tsc -p tsconfig.server.json --noEmit
npm run build
```

For local browser testing, use:

```bash
npm run dev:all
```

Then sign in as an admin and visit:

- `http://localhost:5173/admin?section=overview`
- `http://localhost:5173/admin?section=users`
- `http://localhost:5173/admin?section=content`
- `http://localhost:5173/admin?section=moderation`
- `http://localhost:5173/admin/reports`
- `http://localhost:5173/admin?section=insights`
- `http://localhost:5173/admin?section=system`

## QA Checklist

- `/admin` loads the Overview section and does not redirect to a broken route.
- Sidebar links open Overview, Users, Content, Moderation, Reports, Insights, Analytics Foundation, System, and Waitlist.
- `/admin/reports` still supports filters, search, priority sort, the detail drawer, action history, and confirmation modals.
- `GET /api/admin/ops/summary` returns partial data plus warnings when optional tables are missing.
- `GET /api/admin/users?limit=25&query=test` returns only limited admin-safe user fields.
- Report decisions still update only `content_reports.status`.
- Hide, remove, and restore actions still update global content visibility separately.
- The System section reports configured/not configured state without rendering secret values.
- Mobile widths show stacked cards/lists without overlapping copy or action buttons.

## Deployment Notes

Deploy through the usual Vercel flow. Confirm these production environment variables are set before relying on live admin data:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `EXPLORE_ADMIN_ALLOWED_EMAILS` only if temporary fallback admin access is still needed

After deploy, verify:

- `https://www.exploreapphq.com/admin`
- `https://www.exploreapphq.com/admin/reports`
- `https://www.exploreapphq.com/api/health`
- Authenticated `GET https://www.exploreapphq.com/api/admin/ops/summary`
