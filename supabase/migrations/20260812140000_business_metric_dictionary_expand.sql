-- Expand Business metric dictionary to satisfy production schema gate
-- (verify_business_intelligence_schema requires count(*) >= 10).
-- Additive seed only; no historical rewrite.

insert into public.business_metric_definitions(metric_key, version, label, description, formula, format) values
  ('route_views', 'v1', 'Route views', 'Eligible route_view / route_impression events after event-id deduplication.', 'count(route_view)', 'number'),
  ('route_starts', 'v1', 'Route starts', 'Eligible route_start events after event-id deduplication.', 'count(route_start)', 'number'),
  ('saves', 'v1', 'Saves', 'Eligible place_save / route_save events after event-id deduplication.', 'count(save)', 'number'),
  ('search_volume', 'v1', 'Search volume', 'Eligible search_performed / search_submitted events after event-id deduplication.', 'count(search)', 'number'),
  ('intent_actions', 'v1', 'Intent actions', 'Map opens, directions starts, and similar mid-funnel intent signals.', 'count(intent_actions)', 'number')
on conflict (metric_key, version) do update set
  label = excluded.label,
  description = excluded.description,
  formula = excluded.formula,
  format = excluded.format;
