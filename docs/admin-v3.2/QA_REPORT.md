# QA Report

## Automated gates

| Gate | Result |
|---|---|
| Unit/integration/source tests | 73 passed |
| TypeScript + production build | Passed; 7,181 modules transformed |
| OpenAPI | Admin, Edge, generated PostgREST all valid |
| Browser secret audit | Passed; 123 artifacts; no server secret exposed |
| Shared migration history | Passed; 76 baseline + 11 forward, zero duplicate timestamps/hash mismatches |
| Production business schema | Passed; no missing checks |
| PDF option matrix | 168/168 combinations passed |
| PDF rendered artifact validation | 5 PDFs / 28 pages passed |
| Visual regression | 80 primary light/dark + 7 state images generated; no horizontal overflow |
| Functional E2E | 15 tests passed in the full matrix run |
| Accessibility | Isolated rerun passed eight pages; zero critical/serious Axe violations |
| Performance E2E | Passed; no duplicate analytics requests |

The full E2E command’s final Axe test initially hit the 30-second test timeout after the other 15 tests passed. No violation was reported. Its timeout was raised to 120 seconds and the same eight-page Axe scan passed in 35.7 seconds.

## Manual/visual review

PDF inspection corrected a clipped long title and a 16:9 revenue-row overlap, then revalidated all sample pages. Admin screenshots were inspected at desktop/mobile and light/dark, including Analytics Operations and Revenue disconnected states. The UI preserves the established design system and clearly renders “Unavailable” rather than zero.

## React quality review

The modified TSX keeps request cancellation, derives inexpensive values directly, avoids new heavy dependencies and inline component definitions, uses stable list keys, and adds `aria-live` to operational alerts. New content follows existing responsive primitives; no global listener or storage pattern was introduced.

## Remaining QA

Production post-deploy smoke/monitoring, live AdMob totals, mobile producer-source validation, and historical replay are intentionally pending.
