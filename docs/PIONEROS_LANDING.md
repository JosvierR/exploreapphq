# Pioneros Explore Landing

## Scope

`/` is now the **Pioneros Explore** community landing for activating early contributors. The consumer discovery page moved to `/explorar`.

## Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `PioneersPage` | Main home — pioneer program |
| `/pioneros` | redirect → `/` | Legacy URL alias |
| `/explorar` | `HomePage` | Consumer discovery landing |
| `/home-classic` | `HomePageLegacy` | Frozen backup of the original home |

## Legacy Backups

- `src/pages/marketing/legacy/HomePageLegacy.tsx`
- `src/components/sections/legacy/LandingSectionsLegacy.tsx`
- `src/components/sections/legacy/HeroVisualLegacy.tsx`

## Animate UI Components

Installed through `shadcn` after dry-runs:

- `@animate-ui/components-backgrounds-gradient`
- `@animate-ui/primitives-texts-shimmering`
- `@animate-ui/primitives-texts-sliding-number`
- `@animate-ui/components-buttons-liquid`
- `@animate-ui/components-animate-avatar-group`

## Backend TODOs

Mock data:

- `src/features/pioneers/mocks/pioneerMock.ts`
- `src/features/pioneers/api/pioneersApi.ts`

TODO markers:

- `GET /api/pioneers/leaderboard?range=7d&category=total`
- `GET /api/pioneers/challenges/active`

## Page meta / social sharing

`/` sets document title and Open Graph / Twitter tags via `usePageMeta` in `PioneersPage.tsx`.
Helpers: `src/lib/pageMeta.ts`, `src/hooks/usePageMeta.ts`.

## Revert to consumer home

```tsx
{ path: "/", element: <HomePage /> },
{ path: "/pioneros", element: <PioneersPage /> },
```

## Validation

```bash
npm run lint
npm run build
npm run preview
```

Manual routes:

- `http://localhost:4173/`
- `http://localhost:4173/explorar`
- `http://localhost:4173/home-classic`
- `http://localhost:4173/pioneros` (redirects to `/`)
