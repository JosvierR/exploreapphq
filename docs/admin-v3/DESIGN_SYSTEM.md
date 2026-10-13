# Explore Admin 3.0 — design system

## Token authority

`src/styles/admin-apple.css` is the admin token authority. The system uses neutral surfaces, one restrained Explore blue accent, semantic success/warning/danger colors, 4/8/12/16/20/24/32 spacing, 12–14px standard radii, minimal shadow, tabular analytics values, and 130–190ms transitions.

Light surfaces use `#F5F5F7`, `#FFFFFF`, and `#FAFAFB` with `#16181D` primary text. Dark mode uses deliberate charcoal surfaces and independently tuned contrast tokens; it is not an automatic inversion. The selected theme persists in `admin:theme`.

## Component architecture

```text
AdminLayout
  SystemStatusMenu
  ProfileMenu / ThemeToggle
  Sidebar / responsive drawer
  Outlet
    AdminDashboardPage
      ExecutiveOverview
        TimeRangeSelector
        KpiTrendCard × 4
        ChartCard + LineTrendChart + ChartDataTable
        ChartCard + HorizontalBarChart
        GrowthSignals
        OperationalAttention
```

Existing canonical primitives remain shared across Product Analytics, Tourism Intelligence, Analytics Operations, Reports, Users, Content, Moderation, Waitlist, and System Health.

## Interaction and responsive rules

- Desktop: 244px persistent sidebar, four executive KPIs, full-width focal chart, two secondary columns.
- Laptop/tablet: reporting controls wrap, KPI cards become two columns, secondary panels stack.
- Mobile: drawer navigation, compact topbar, horizontally scrollable period selector only when necessary, one-column KPIs below 480px, full-width chart controls, fixed-width-safe popovers.
- Sidebar collapse and theme persist locally.
- All controls have visible focus rings; motion collapses under `prefers-reduced-motion`.
- The primary chart has an operable semantic table equivalent.

No decorative gradient, oversized hero, count-up animation, gauge, 3D chart, or continuous motion is used.
