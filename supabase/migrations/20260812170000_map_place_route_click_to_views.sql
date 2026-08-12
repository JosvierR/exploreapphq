-- Map production mobile legacy click events to canonical view metrics.
-- Without this, fact_place_daily / fact_route_daily rows are created for
-- place_click / route_click but all metric counters stay at 0.

insert into public.analytics_event_name_mappings(
  original_event_name,
  canonical_event_name,
  canonical_version,
  notes
) values
  ('place_click', 'place_view', 1, 'Production mobile place detail / pin click.'),
  ('route_click', 'route_view', 1, 'Production mobile route detail / card click.')
on conflict (original_event_name) do update set
  canonical_event_name = excluded.canonical_event_name,
  canonical_version = excluded.canonical_version,
  notes = excluded.notes,
  status = 'active',
  updated_at = now();
