# Explore Atlas Web

Marketing site and future web app for **Explore Atlas** — a geospatial social network for real-world discovery.

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [React Router](https://reactrouter.com/) for client-side routing
- [Express](https://expressjs.com/) API + **SQLite** waitlist
- [Mailpit](https://mailpit.axllent.dev/) for local email (SMTP)
- CSS design system in `src/styles/global.css`

## Project structure

```
├── public/                 # Static assets (favicon, redirects)
├── src/
│   ├── app/                # App shell (router)
│   ├── pages/
│   │   ├── marketing/      # Landing, legal, 404
│   │   └── app/            # Future authenticated web app
│   ├── components/
│   │   ├── layout/         # Header, footer, layouts
│   │   ├── sections/       # Landing page sections
│   │   └── ui/             # Reusable UI primitives
│   ├── features/           # Cross-cutting features (i18n, auth later)
│   ├── hooks/
│   ├── lib/                # Constants, utilities
│   ├── locales/            # EN / ES copy
│   └── styles/
├── server/                 # API (auth + waitlist + email)
├── data/                   # SQLite DB (gitignored)
├── legacy/                 # Old static template (reference only)
└── dist/                   # Production build output
```

## Access / sign up

| Email | Behavior |
|--------|----------|
| `admin@example.com` | Asks for password → full site access |
| Any other email | Saved to SQLite + confirmation email via Mailpit |

Default admin password: `Admin12345678` (override with `ADMIN_PASSWORD` in `.env`).

Entry route: **http://localhost:5173/access**

## Commands

```bash
npm install

# Terminal 1 — Mailpit (Docker)
docker compose up -d
# Web UI: http://localhost:8025

# Terminal 2 — web + API together
npm run dev:all

# Or separately:
npm run dev       # frontend → http://localhost:5173
npm run dev:api   # API → http://localhost:3001
```

```bash
npm run build    # Output → dist/
npm run preview  # Preview production build
```

Copy `.env.example` to `.env` to customize admin credentials and SMTP.

## Deploy

Build `dist/` and host on any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).

For SPA routing, `public/_redirects` is included for Netlify-style hosts. On GitHub Pages, enable “single-page app” or copy `index.html` to `404.html`.

## Waitlist & emails

Every non-admin signup is stored in **SQLite** (`data/explore.db`, table `waitlist`).

| What | How |
|------|-----|
| **Who registered?** | `GET /api/admin/waitlist` with admin Bearer token, or open the DB |
| **How many?** | Response includes `stats.total`, `stats.pendingLaunch`, `stats.notified` |
| **Welcome email** | Sent automatically on signup (HTML, Explore branding) |
| **“App is ready” blast** | When the app launches, run once (see below) |

### View registrants (admin)

1. Log in at `/access` as `admin@example.com`.
2. Copy the token from DevTools → Application → sessionStorage → `explore-auth-token` (or your auth key).
3. Call the API:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/admin/waitlist
```

### Notify everyone the app is ready

**Dry run** (list emails only, no send):

```bash
npm run waitlist:notify:dry
```

**Send launch email** to everyone not yet notified:

```bash
npm run waitlist:notify
```

Or via HTTP:

```bash
# Preview
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/admin/waitlist/notify-launch?dryRun=1"

# Send
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/admin/waitlist/notify-launch
```

Each successful send sets `launch_notified_at` so you do not double-email the same person.

**Production:** point `SMTP_*` to a real provider (Resend, SendGrid, SES). Mailpit is for local testing only — open http://localhost:8025 to preview emails.

## i18n

Toggle **EN / ES** in the header. Preference is stored in `localStorage` (`explore-lang`).

Copy lives in `src/locales/messages.ts`.

## Roadmap: web app

When adding the product UI, mount routes under `/app/*` in `src/app/router.tsx` and build features in `src/pages/app/` + `src/features/`.
