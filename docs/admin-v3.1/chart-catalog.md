# Chart and Decision Catalog

Every visualization follows the same grammar: question, definition/source, visual, context, explanation, and drilldown or exact accessible table where the UI supports it.

| Destination / visual | Decision question | Canonical source | Chosen form | Why this form | Example bounded conclusion |
| --- | --- | --- | --- | --- | --- |
| Executive KPI row | What changed at company level? | Business Analytics Core snapshot | Four compact value cards with exact deltas | Gives the leadership scan before supporting evidence | “Active users increased 14.3% versus the exact previous period.” |
| Executive activity trend | Is product activity gaining or losing momentum? | Canonical timeseries | Line/area trend with selectable metric and comparison | Direction and inflection matter more than composition | “Route starts grew faster than active users in this period.” |
| Product active-user trend | How are people using Explore over time? | Canonical users/sessions series | Time series | Preserves time order and avoids categorical clutter | “Session activity declined compared with the previous period.” |
| Product feature usage | Which supported behaviors receive attention? | Canonical event taxonomy | Horizontal bars and exact table | Ranking supports comparison across behaviors | “Route starts represent the strongest measured planning action.” |
| Growth funnel | Where does observed engagement change? | Only supported observed stages | Funnel/table with explicit stage definitions | Used only where instrumentation supports the represented progression | “The largest observed decline is between discovery and saved intent.” |
| Tourism map | Where is destination activity concentrated? | Destination geography from canonical place/route enrichment | Geographic map plus ranked table | Spatial relationship is material to the question | “Most measured destination activity came from three markets.” |
| Market comparison | Which markets combine demand and momentum? | Canonical geography, demand, and comparison metrics | Ranked bars/table | Exact ranking is more useful than decorative map area | “The leading market also recorded positive period growth.” |
| Category demand | Which experiences attract interest? | Canonical category aggregation | Horizontal bars | Labels remain readable and magnitudes comparable | “Dining demand leads measured category activity.” |
| Opportunity matrix | Where may demand outpace supply? | Versioned opportunity score with minimum samples | Demand/supply matrix plus evidence cards | Separates signal from recommendation and exposes confidence | “Validate supply coverage before prioritizing the high-demand category.” |
| Revenue verified value | What revenue is actually measured? | Authorized financial source only | Availability card, not a fabricated chart | A chart would imply a time series that does not exist | “Verified revenue is unavailable, not zero.” |
| Revenue stream maturity | Which monetization systems are report-ready? | Integration readiness contract | Status table | The decision is operational readiness, not monetary performance | “Advertising and subscriptions require verified reporting integrations.” |
| PDF engagement trend | What product signal should an investor understand? | Same snapshot as dashboard | Vector line chart | Sharp at any zoom and compact on paper/slides | “User activity moved upward in the selected fixture period.” |
| PDF market/category rankings | What demand is concentrated where? | Investor-safe market/category rows | Vector horizontal bars | Fits portrait and slide layouts with exact values | “The leading destination accounts for the largest measured aggregate.” |

Adaptive aggregation is owned by the Business Analytics Core (`daily`, `weekly`, or `monthly`), not invented in the renderer. The PDF limits rows and pages for readability but does not alter metric values.
