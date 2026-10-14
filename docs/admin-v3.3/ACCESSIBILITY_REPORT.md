# Accessibility Report

## Web application

Playwright/axe evaluated Executive Overview, Product Analytics, Tourism Intelligence, Revenue & Monetization, Intelligence Reports, and Reports against WCAG 2 A/AA and WCAG 2.1 A/AA tags. Result: zero critical or serious violations in the deterministic test environment.

Keyboard-accessible native controls are used for filters, density modes, report inputs, section selection, and chart data disclosure. The chart table mounts lazily after first expansion but remains a real table with an accessible disclosure label. Status information includes text, not color alone. Focus styling and reduced-motion behavior are inherited from the admin design system.

Five viewports (375×812, 768×1024, 1024×768, 1440×900, 1920×1080) were checked in light and dark themes across eight principal destinations. Every document-overflow assertion passed. Loading, empty, error, access-denied, collapsed-sidebar, mobile navigation, and chart-hover states are captured.

## PDFs

All PDFs have selectable/searchable text, document title/author/subject/creator metadata, language tags, readable contrast, non-color labels, and exact supporting tables in analyst products. Vector charts retain sharp print output.

Known limitation: the custom PDF writer does not emit a full logical tag tree, semantic table tags, bookmarks, or alternate text for the decorative brand mark. The PDFs therefore are not claimed to be PDF/UA compliant. A future migration to a tagged-PDF library should be evaluated without weakening deterministic rendering or privacy controls.
