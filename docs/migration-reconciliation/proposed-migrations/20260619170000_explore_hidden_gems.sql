-- ─── Explore · "Joyas ocultas" (lugares) ────────────────────────────────────
-- Anti-popularidad: premia rating alto (bayesiano) con BAJA exposición.
--   hidden_gem = (bayesian/5) * (1 - exposure_norm)
-- Filtro duro: total_ratings >= 3 (no recomendar lugares sin validar).
--
-- La exposición se mide con place_impressions (espejo de video_impressions). Con la
-- tabla vacía, exposure_norm→0 y todo lugar validado se lee como joya: degradación
-- graciosa, no incorrecta. El cliente registra impresiones con el tiempo.

CREATE TABLE IF NOT EXISTS place_impressions (
  user_id    UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  place_id   UUID        NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_place_impressions_place
  ON place_impressions (place_id);

ALTER TABLE place_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY place_impressions_select ON place_impressions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY place_impressions_insert ON place_impressions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY place_impressions_update ON place_impressions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY place_impressions_delete ON place_impressions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Lugares "joya": rating alto + baja exposición. Devuelve SETOF places para reusar
-- hydratePhotos + rowToPlace. El score se usa solo para ordenar (no se expone).
CREATE OR REPLACE FUNCTION places_hidden_gems(
  in_lat           FLOAT,
  in_lng           FLOAT,
  radius_m         FLOAT,
  filter_category  place_category DEFAULT NULL,
  max_results      INT            DEFAULT 12
)
RETURNS SETOF places
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH g AS (
    SELECT AVG(average_rating)::float8 AS global_avg
    FROM places WHERE state = 'published' AND total_ratings > 0
  )
  SELECT p.*
  FROM places p, g
  WHERE p.state = 'published'
    AND p.total_ratings >= 3
    AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
    AND (filter_category IS NULL OR p.category = filter_category)
  ORDER BY
    (
      (explore_bayesian_rating(p.average_rating::float8, p.total_ratings, COALESCE(g.global_avg, 3.0), 5) / 5.0)
      * (1.0 - explore_norm_log(
          (SELECT count(*) FROM place_impressions pi WHERE pi.place_id = p.id), 50
        ))
    ) DESC,
    p.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION places_hidden_gems(FLOAT, FLOAT, FLOAT, place_category, INT) TO anon, authenticated;
