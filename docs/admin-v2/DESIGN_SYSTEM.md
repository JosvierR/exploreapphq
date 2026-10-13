# Explore Command Center design system

## Direction

The admin uses a quiet, data-first light theme: white analytical surfaces on `#F7F8FA`, restrained brand accents, compact navigation, tabular metrics, and short opacity/transform transitions. Brand color identifies focus and selection; it does not fill large surfaces.

The token authority is `src/styles/admin-apple.css`. Feature CSS may consume these variables but must not redefine the shell theme.

## Core tokens

| Role | Token | Value |
|---|---|---|
| Brand primary | `--admin-brand-primary` | `#00AEFF` |
| Brand secondary | `--admin-brand-secondary` | `#002AFF` |
| Brand accent | `--admin-brand-accent` | `#36F8FF` |
| Canvas | `--admin-bg` | `#F7F8FA` |
| Surface | `--admin-surface` | `#FFFFFF` |
| Text | `--admin-ink` | `#111318` |
| Secondary text | `--admin-muted` | `#667085` |
| Border | `--admin-border-soft` | `#E7EAF0` |
| Accessible action blue | `--admin-blue` | `#006EDC` |
| Positive | `--admin-green` | `#138A57` |
| Warning | `--admin-amber` | `#A96209` |
| Negative | `--admin-red` | `#C72C41` |

Brand primary is retained for accents. Text/buttons use the darker action blue where white text or a focus boundary needs stronger contrast.

## Typography and numbers

- Stack: Inter when already available, then system/SF/Segoe UI.
- Display headings: weight 690, tight tracking, restrained maximum size.
- UI labels: 620–650, small but not below practical legibility.
- Metrics use `font-variant-numeric: tabular-nums`.
- Missing numeric data renders `—`; it is never coerced to `0`.

## Geometry, elevation, and motion

- Base radius: 16 px; controls: 10 px; hero/elevated: 22 px.
- Shadows remain low-opacity and communicate layering, not decoration.
- Fast interaction: 130 ms. Panel motion: 190 ms.
- Only `opacity`, `transform`, color, border, and shadow are transitioned.
- Charts disable animation. `prefers-reduced-motion` reduces all transitions and animations to effectively zero.

## Shared component contract

- `AdminPageShell`: page composition, actions, and section stack.
- `SectionHeader`: consistent kicker/title/meta hierarchy.
- `KpiTrendCard`: metric, comparison semantics, and optional sparkline.
- `ChartCard`: loading, empty, insight, and chart framing.
- `AdminDataTable`: labelled, keyboard-focusable local horizontal scroll region.
- `StatusBadge`: semantic status with text in addition to color.
- `EmptyState`, `ErrorState`, `LoadingState`: stable explicit states.
- `ConfirmModal`, `Drawer`: Escape, focus trap, initial focus, and focus restoration.

Feature pages should adapt these primitives before introducing a parallel equivalent.

## Responsive rules

- 1440–1920: six executive KPIs and two-column analytical groups.
- 1024: analytical groups become one column; shell remains desktop.
- 768: mobile drawer navigation, compressed topbar context, two KPI columns.
- 375–520: one KPI/quick-link column; tables scroll inside their own region.

The page itself must not acquire horizontal overflow.

## Accessibility

- Every interactive element has a visible focus ring.
- Sidebar and tab states expose text and `aria-pressed`/current styling.
- Data tables have a labelled, focusable scroll region.
- Dialogs and drawers are labelled, modal, Escape-dismissible, focus-trapped, and restore focus.
- Charts have an `aria-label` and adjacent textual/tabular context.
- Status is never communicated only through color.

## Dark mode

Not enabled in this iteration. The light theme is complete and authoritative; a partial dark theme would create inconsistent feature CSS and contrast risk.
