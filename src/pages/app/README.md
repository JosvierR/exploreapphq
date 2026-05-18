# Web app (future)

Reserved for the authenticated Explore Atlas web application.

Suggested structure when you add it:

```
src/pages/app/          # Route-level screens (feed, map, profile…)
src/features/           # Domain modules (auth, places, routes, videos)
src/components/app/     # App-specific UI (not marketing)
```

Mount under `/app/*` in `src/app/router.tsx` when ready.
