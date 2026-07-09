# Pioneros Explore Landing

## Scope

`/` is the **Pioneros Explore** community landing for activating early contributors. The consumer discovery page lives at `/explorar`.

## Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `PioneersPage` | Main home — pioneer program |
| `/pioneros` | redirect → `/` | Legacy URL alias |
| `/explorar` | `HomePage` | Consumer discovery landing |
| `/challenges/:type` | `ChallengeMissionPage` | Mission deep-link fallback (`places`, `routes`, `videos`) |

## Feature module layout

```
src/features/pioneers/
├── api/pioneersApi.ts          # Client fetch + mock fallback
├── components/                 # Section UI (hero, challenges, leaderboard, …)
├── hooks/usePioneerLanding.ts  # Landing data hook
├── lib/
│   ├── paths.ts                # isPioneersHomePath()
│   ├── challengeConfig.ts      # Mission metadata + web paths
│   └── exploreAppLink.ts       # App scheme + open helpers
├── mocks/pioneerMock.ts        # Fallback when API unavailable
├── pages/
│   ├── PioneersPage.tsx
│   └── ChallengeMissionPage.tsx
├── styles/pioneers.css         # Scoped via PioneersPageShell
├── types.ts
└── index.ts                    # Public exports
```

## Backend

`GET /api/pioneers/landing?range=7d&category=total`

- `server/api-lib/pioneers/pioneersService.mjs` — Supabase queries
- `server/api-lib/pioneers/pioneersRouter.mjs` — HTTP handler

Returns: stats, challenges, leaderboard users, top videos/places/routes. Rewards and video showcase cards still fall back to client mocks when not returned by API.

## Deep links

- Web: `/challenges/places|routes|videos`
- App scheme: `explore://challenges/{type}`
- Universal Links: paths registered in `public/.well-known/apple-app-site-association`

## Page meta

`/` sets title and OG tags via `usePageMeta` in `PioneersPage.tsx`. Helpers: `src/lib/pageMeta.ts`, `src/hooks/usePageMeta.ts`.

## Validation

```bash
npm run lint
npm run build
npm run dev:all
```

Manual routes:

- `http://localhost:4173/`
- `http://localhost:4173/explorar`
- `http://localhost:4173/challenges/places`
- `http://localhost:4173/pioneros` (redirects to `/`)
