# Explore Atlas Web

Marketing site and future web app for **Explore Atlas** — a geospatial social network for real-world discovery.

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [React Router](https://reactrouter.com/) for client-side routing
- [Express](https://expressjs.com/) API + JSON waitlist (`data/waitlist.json`)
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

## Access / sign up (Firebase)

| Route | Who | What |
|--------|-----|------|
| `/access` | Everyone | Email only → Firestore waitlist + welcome email (no login UI) |
| `/team` | Admins only | Hidden team login (not linked on site) → Firebase Auth |

### Setup Firebase

1. [Firebase Console](https://console.firebase.google.com/) → create project → add **Web app** → copy config into `.env` as `VITE_FIREBASE_*`.
2. **Authentication** → Email/Password → enable.
3. **Authentication** → Users → Add user (your admin email + password).
4. Set `VITE_ADMIN_EMAILS=your@email.com` in `.env` and Netlify env vars.
5. **Firestore** → create database → deploy rules: `firebase deploy --only firestore:rules` (or paste `firestore.rules` in the console).

### Local dev

```bash
npm run dev:all   # web + API (for welcome emails via Mailpit)
docker compose up -d
```

- Public: http://localhost:5173/access  
- Team: http://localhost:5173/team  

Legacy API admin (`POST /api/access` + `ADMIN_PASSWORD`) still works for scripts; the site UI uses Firebase.

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

## Deploy on Vercel (production)

**Full checklist:** [docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md)

1. Import repo at [vercel.com/new](https://vercel.com/new) (Framework: **Vite**).
2. Run `npm run vercel:env` (copies `netlify.env` → `vercel.env` with Vercel URL) or use `vercel.env.example`.
3. Vercel → **Environment Variables → Import .env** → paste `vercel.env`.
4. Deploy. APIs: `/api/waitlist/signup`, `/api/feedback/submit`, `/api/admin/*`.
5. Firebase → Authorized domains → add `exploreapphq.vercel.app`.

## Deploy on Netlify (legacy)

Netlify hosts **only the frontend** (`dist/`). The API (`server/`) must run elsewhere (e.g. [Railway](https://railway.app), [Render](https://render.com)).

**Full Netlify checklist:** see [docs/NETLIFY_SETUP.md](docs/NETLIFY_SETUP.md)

### 1. Netlify (site)

Connect the GitHub repo in Netlify. Build settings are in `netlify.toml`:

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Publish directory | `dist` |

Deploy → `https://exploreapphq.com` shows the landing.

### 2. API (Railway / Render — example)

Create a **Web Service** from the same repo:

- **Start command:** `npx tsx server/index.ts` (or `npm run build:api` + `node dist/server/index.js` if you add a start script)
- **Root directory:** repo root
- Add env vars from `.env.example` (`JWT_SECRET`, `SMTP_*`, `DB_PATH`, store URLs, etc.)
- Attach a **persistent volume** for `data/explore.db` (SQLite)
- Use real SMTP (Resend, SendGrid, SES) — not Mailpit

Copy the public URL, e.g. `https://explore-api-production.up.railway.app`.

### 3. Connect Netlify → API

In `netlify.toml`, uncomment the `/api/*` redirect and set your API URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-API-URL.up.railway.app/api/:splat"
  status = 200
  force = true
```

Redeploy Netlify. The browser keeps calling `/api/access` on `exploreapphq.com`; Netlify forwards it to Railway.

**Alternative:** set `VITE_API_URL=https://your-api...` in Netlify → Site settings → Environment variables (build time), without the proxy rule.

### 4. Checklist

- [ ] Netlify build succeeds (`npm run build`)
- [ ] API health: `https://YOUR-API/api/health` → `{"ok":true}`
- [ ] Signup on `https://exploreapphq.com/access` works
- [ ] Confirmation email arrives (production SMTP)
- [ ] `data/waitlist.json` on a persistent disk (Railway volume)

### Other static hosts

`public/_redirects` works on Netlify-style hosts. For GitHub Pages, copy `index.html` to `404.html` for SPA routing.

## Waitlist & emails

Every signup email is also stored in **`data/waitlist.json`** (and Firestore when Firebase is configured).

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
