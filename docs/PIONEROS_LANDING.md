# Pioneros Explore Landing

## Scope

`/pioneros` is a new community landing page for activating early Explore contributors. The existing consumer home at `/` remains unchanged.

## Legacy Backups

These files preserve the current home implementation:

- `src/pages/marketing/legacy/HomePageLegacy.tsx`
- `src/components/sections/legacy/LandingSectionsLegacy.tsx`
- `src/components/sections/legacy/HeroVisualLegacy.tsx`

Route:

- `/home-classic` renders the legacy backup.

## Current Routes

- `/` renders `HomePage`.
- `/home-classic` renders `HomePageLegacy`.
- `/pioneros` lazy-loads `PioneersPage`.

## Animate UI Components

Installed through `shadcn` after dry-runs:

- `@animate-ui/components-backgrounds-gradient`
- `@animate-ui/primitives-texts-shimmering`
- `@animate-ui/primitives-texts-sliding-number`
- `@animate-ui/components-buttons-liquid`
- `@animate-ui/components-animate-avatar-group`

`components.json` registers:

```json
"@animate-ui": "https://animate-ui.com/r/{name}.json"
```

## Backend TODOs

The current pioneers data is mock-only and centralized in:

- `src/features/pioneers/mocks/pioneerMock.ts`
- `src/features/pioneers/api/pioneersApi.ts`

TODO markers:

- `GET /api/pioneers/leaderboard?range=7d&category=total`
- `GET /api/pioneers/challenges/active`

Components consume data through `pioneersApi.ts` or props derived from it, so replacing mock data should not require section rewrites.

## Future Promotion To Home

If product wants `/pioneros` as the default home later, update `src/app/router.tsx`:

```tsx
{ path: "/", element: <PioneersPage /> },
{ path: "/explorar", element: <HomePage /> },
```

Do not apply this until product explicitly promotes the pioneer landing.

## Validation

Run:

```bash
npm run lint
npm run build
npm run preview
```

Manual routes:

- `http://localhost:4173/`
- `http://localhost:4173/home-classic`
- `http://localhost:4173/pioneros`

Also verify reduced motion in DevTools and confirm the pioneers page is emitted as a separate lazy chunk.

## Page meta / social sharing

`/pioneros` sets document title and Open Graph / Twitter tags via `usePageMeta` in `PioneersPage.tsx`.
Helpers live in `src/lib/pageMeta.ts` and `src/hooks/usePageMeta.ts`.

When sharing `/pioneros`, crawlers that do not execute JavaScript still see the default tags from `index.html`.
For full OG support on share bots, a future prerender or edge meta route may be needed.
