-- ============================================================================
-- 00006_rls_policies.sql
-- Row Level Security + GraphQL exposure control + PostGIS security
-- ============================================================================
-- All policies use (select auth.uid()) instead of auth.uid() to avoid
-- re-evaluation per row (auth_rls_initplan optimization).
-- ============================================================================

-- ═══════════ USERS ══════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_insert_own ON users FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY users_delete_none ON users FOR DELETE TO authenticated
  USING (false);

-- ═══════════ FOLLOWERS ══════════════════════════════════════════════════════

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY followers_select ON followers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY followers_insert_own ON followers FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = follower_id);

CREATE POLICY followers_delete_own ON followers FOR DELETE TO authenticated
  USING ((select auth.uid()) = follower_id);

-- ═══════════ COLLECTIONS ════════════════════════════════════════════════════

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY collections_select_own ON collections FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY collections_insert_own ON collections FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY collections_update_own ON collections FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY collections_delete_own ON collections FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ═══════════ FAVORITES ══════════════════════════════════════════════════════

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY favorites_select_own ON favorites FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY favorites_insert_own ON favorites FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY favorites_delete_own ON favorites FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ═══════════ PLACES ═════════════════════════════════════════════════════════

ALTER TABLE places ENABLE ROW LEVEL SECURITY;

CREATE POLICY places_select ON places FOR SELECT TO authenticated
  USING ((state = 'published'::place_state) OR (created_by = (select auth.uid())));

CREATE POLICY places_insert ON places FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY places_update_own ON places FOR UPDATE TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY places_delete_own ON places FOR DELETE TO authenticated
  USING ((select auth.uid()) = created_by);

-- ═══════════ RATINGS ════════════════════════════════════════════════════════

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ratings_select ON ratings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY ratings_insert ON ratings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY ratings_update_own ON ratings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY ratings_delete_own ON ratings FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ═══════════ ROUTES ═════════════════════════════════════════════════════════

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY routes_select ON routes FOR SELECT TO authenticated
  USING (
    ((state = 'published'::route_state) AND (is_public = true))
    OR (created_by = (select auth.uid()))
  );

CREATE POLICY routes_insert ON routes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY routes_update_own ON routes FOR UPDATE TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY routes_delete_own ON routes FOR DELETE TO authenticated
  USING ((select auth.uid()) = created_by);

-- ═══════════ ROUTE SEGMENTS ═════════════════════════════════════════════════

ALTER TABLE route_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY segments_select_route_owner ON route_segments FOR SELECT TO authenticated
  USING (route_id IN (
    SELECT id FROM routes WHERE created_by = (select auth.uid())
  ));

CREATE POLICY segments_insert_route_owner ON route_segments FOR INSERT TO authenticated
  WITH CHECK (route_id IN (
    SELECT id FROM routes WHERE created_by = (select auth.uid())
  ));

CREATE POLICY segments_delete_route_owner ON route_segments FOR DELETE TO authenticated
  USING (route_id IN (
    SELECT id FROM routes WHERE created_by = (select auth.uid())
  ));

-- ═══════════ ROUTE PLACES ═══════════════════════════════════════════════════

ALTER TABLE route_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY route_places_select ON route_places FOR SELECT TO authenticated
  USING (route_id IN (
    SELECT id FROM routes
    WHERE ((state = 'published'::route_state) AND (is_public = true))
       OR (created_by = (select auth.uid()))
  ));

CREATE POLICY route_places_insert_owner ON route_places FOR INSERT TO authenticated
  WITH CHECK (route_id IN (
    SELECT id FROM routes WHERE created_by = (select auth.uid())
  ));

-- ═══════════ ROUTE PARTICIPANTS ═════════════════════════════════════════════

ALTER TABLE route_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY participants_select ON route_participants FOR SELECT TO authenticated
  USING (route_id IN (
    SELECT id FROM routes
    WHERE ((state = 'published'::route_state) AND (is_public = true))
       OR (created_by = (select auth.uid()))
  ));

CREATE POLICY participants_insert_self ON route_participants FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY participants_update_self ON route_participants FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ═══════════ VIDEOS ═════════════════════════════════════════════════════════

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY videos_select ON videos FOR SELECT TO authenticated
  USING ((state = 'published'::video_state) OR (created_by = (select auth.uid())));

CREATE POLICY videos_insert ON videos FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY videos_update_own ON videos FOR UPDATE TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY videos_delete_own ON videos FOR DELETE TO authenticated
  USING ((select auth.uid()) = created_by);

-- ═══════════ LIKES ══════════════════════════════════════════════════════════

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY likes_select ON likes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY likes_insert_own ON likes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY likes_delete_own ON likes FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ═══════════ COMMENTS ═══════════════════════════════════════════════════════

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select ON comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY comments_insert ON comments FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY comments_delete ON comments FOR DELETE TO authenticated
  USING (
    ((select auth.uid()) = user_id)
    OR ((select auth.uid()) IN (
      SELECT videos.created_by FROM videos WHERE videos.id = comments.video_id
    ))
  );

-- ═══════════ GRAPHQL EXPOSURE CONTROL ═══════════════════════════════════════
-- Revoke SELECT from anon on private/internal tables.
-- Public content (places, routes, videos, users, etc.) stays accessible.

-- Private user data
REVOKE SELECT ON public.collections FROM anon;
REVOKE SELECT ON public.favorites FROM anon;

-- Internal route data
REVOKE SELECT ON public.route_participants FROM anon;
REVOKE SELECT ON public.route_segments FROM anon;
REVOKE SELECT ON public.route_places FROM anon;

-- ═══════════ POSTGIS SECURITY ═══════════════════════════════════════════════
-- Enable RLS on spatial_ref_sys (PostGIS system table) with open read policy.
-- Revoke st_estimatedextent SECURITY DEFINER from public API roles.

-- ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY spatial_ref_sys_select ON public.spatial_ref_sys
--   FOR SELECT USING (true);

-- REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM anon, authenticated;
