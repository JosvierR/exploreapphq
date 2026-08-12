-- Production regression (2026-08-12):
-- PostgREST service_role callers of aggregate_analytics_events_for_day hit
-- SQLSTATE 21000 "DELETE requires a WHERE clause" on bare affinity table
-- deletes, even though the function is SECURITY DEFINER owned by postgres.
-- Replace bare deletes with WHERE TRUE (same semantics, guard-compatible).

DO $$
DECLARE
  fn_oid oid;
  def text;
  patched text;
BEGIN
  SELECT p.oid
    INTO fn_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'aggregate_analytics_events_for_day'
    AND pg_get_function_identity_arguments(p.oid) = 'target_day date';

  IF fn_oid IS NULL THEN
    RAISE EXCEPTION 'public.aggregate_analytics_events_for_day(date) not found';
  END IF;

  def := pg_get_functiondef(fn_oid);

  IF def ~* 'DELETE FROM public\.user_content_affinity\s+WHERE'
     AND def ~* 'DELETE FROM public\.user_category_affinity\s+WHERE' THEN
    RAISE NOTICE 'affinity deletes already include WHERE; no function body change';
  ELSE
    patched := regexp_replace(
      def,
      'DELETE FROM public\.user_content_affinity\s*;',
      'DELETE FROM public.user_content_affinity WHERE TRUE;',
      'gi'
    );
    patched := regexp_replace(
      patched,
      'DELETE FROM public\.user_category_affinity\s*;',
      'DELETE FROM public.user_category_affinity WHERE TRUE;',
      'gi'
    );

    IF patched = def THEN
      RAISE EXCEPTION
        'Could not locate bare affinity DELETE statements in aggregate_analytics_events_for_day';
    END IF;

    IF patched !~* 'DELETE FROM public\.user_content_affinity\s+WHERE\s+TRUE'
       OR patched !~* 'DELETE FROM public\.user_category_affinity\s+WHERE\s+TRUE' THEN
      RAISE EXCEPTION
        'Affinity DELETE patch did not produce WHERE TRUE for both tables';
    END IF;

    EXECUTE patched;
  END IF;
END;
$$;

ALTER FUNCTION public.aggregate_analytics_events_for_day(date) OWNER TO postgres;
ALTER FUNCTION public.aggregate_analytics_events_for_day(date) SECURITY DEFINER;
ALTER FUNCTION public.aggregate_analytics_events_for_day(date) SET search_path TO public, extensions;
REVOKE ALL ON FUNCTION public.aggregate_analytics_events_for_day(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_analytics_events_for_day(date) TO service_role;
