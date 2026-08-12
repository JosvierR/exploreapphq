-- ============================================================================
-- EXPLORE-256 · Conteo global del creador para la tarjeta de Explore
-- ============================================================================
-- El perfil ahora muestra el total global de contribuciones del creador, pero
-- la tarjeta de "Creadores locales" mostraba publications_in_zone (acotado al
-- radio), produciendo números distintos. Añadimos una columna publications_total
-- (videos + lugares + rutas publicados, sin filtro geográfico) a ambas RPCs de
-- creadores para que la UI pueda mostrar el mismo total que el perfil. El score
-- y el ranking siguen basándose en la agregación por zona; publications_total es
-- solo para presentación. Las rutas no tienen moderation_status → solo state.

-- Total global de contribuciones publicadas de un creador: videos + lugares +
-- rutas. Sin filtro geográfico ni de zona. Refleja el mismo universo que los
-- contadores del perfil (posts = videos; travels = rutas + lugares).
CREATE OR REPLACE FUNCTION public.explore_creator_publications_total(creator UUID)
RETURNS INT
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT (
      (SELECT count(*) FROM videos v
        WHERE v.created_by = creator
          AND v.state = 'published'
          AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review'))
    + (SELECT count(*) FROM places p
        WHERE p.created_by = creator
          AND p.state = 'published'
          AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review'))
    + (SELECT count(*) FROM routes r
        WHERE r.created_by = creator
          AND r.state = 'published')
  )::int;
$$;

GRANT EXECUTE ON FUNCTION public.explore_creator_publications_total(UUID) TO anon, authenticated;

-- La forma de RETURNS TABLE cambia (nueva columna) → CREATE OR REPLACE no basta.
DROP FUNCTION IF EXISTS public.explore_local_creators(
  FLOAT, FLOAT, FLOAT, TEXT, place_category, INT, INT, TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS public.explore_trending_creators_global(
  TEXT, place_category, INT, INT, TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.explore_local_creators(
  in_lat                FLOAT,
  in_lng                FLOAT,
  radius_m              FLOAT,
  filter_video_tag      TEXT           DEFAULT NULL,
  filter_place_category place_category DEFAULT NULL,
  max_results           INT            DEFAULT 10,
  offset_param          INT            DEFAULT 0,
  as_of                 TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  creator_id           UUID,
  handle               TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  accent_color         TEXT,
  publications_in_zone INT,
  publications_total   INT,
  engagement_received  INT,
  last_publication     TIMESTAMPTZ,
  score                FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH contrib AS (
    SELECT v.created_by AS uid, v.created_at AS at, (v.total_likes + v.total_comments) AS eng
    FROM videos v
    WHERE v.state = 'published'
      AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'video'
          AND uh.content_id = v.id::TEXT
      )
      AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_video_tag IS NULL OR filter_video_tag = ANY(v.tags::text[]))
    UNION ALL
    SELECT p.created_by, p.created_at, p.total_ratings
    FROM places p
    WHERE p.state = 'published'
      AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'place'
          AND uh.content_id = p.id::TEXT
      )
      AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
      AND (filter_place_category IS NULL OR p.category = filter_place_category)
  ),
  agg AS (
    SELECT uid, count(*) AS pub_count, sum(eng) AS eng_total, max(at) AS last_pub
    FROM contrib
    WHERE uid <> '00000000-0000-0000-0000-000000000001'
    GROUP BY uid
    HAVING count(*) >= 1
  )
  SELECT
    u.id, u.handle, u.display_name, u.avatar_url, u.accent_color,
    a.pub_count::int,
    explore_creator_publications_total(u.id) AS publications_total,
    a.eng_total::int, a.last_pub,
    ROUND((
        0.40 * explore_norm_log(a.pub_count, 10)
      + 0.35 * explore_norm_log(a.eng_total, 100)
      + 0.25 * explore_recency_decay(a.last_pub, 168, COALESCE(as_of, now()))
    )::numeric, 6)::float8 AS score
  FROM agg a
  JOIN users u ON u.id = a.uid
  WHERE u.is_deactivated = false AND u.is_ghost = false
  ORDER BY score DESC, u.id DESC
  OFFSET offset_param
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.explore_local_creators(
  FLOAT, FLOAT, FLOAT, TEXT, place_category, INT, INT, TIMESTAMPTZ
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.explore_trending_creators_global(
  filter_video_tag      TEXT           DEFAULT NULL,
  filter_place_category place_category DEFAULT NULL,
  max_results           INT            DEFAULT 10,
  offset_param          INT            DEFAULT 0,
  as_of                 TIMESTAMPTZ    DEFAULT NULL
)
RETURNS TABLE (
  creator_id           UUID,
  handle               TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  accent_color         TEXT,
  publications_in_zone INT,
  publications_total   INT,
  engagement_received  INT,
  last_publication     TIMESTAMPTZ,
  score                FLOAT8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH contrib AS (
    SELECT v.created_by AS uid, v.created_at AS at, (v.total_likes + v.total_comments) AS eng
    FROM videos v
    WHERE v.state = 'published'
      AND COALESCE(v.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'video'
          AND uh.content_id = v.id::TEXT
      )
      AND (filter_video_tag IS NULL OR filter_video_tag = ANY(v.tags::text[]))
    UNION ALL
    SELECT p.created_by, p.created_at, p.total_ratings
    FROM places p
    WHERE p.state = 'published'
      AND COALESCE(p.moderation_status, 'active') IN ('active', 'under_review')
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_hidden_content uh
        WHERE uh.user_id = auth.uid()
          AND uh.content_type = 'place'
          AND uh.content_id = p.id::TEXT
      )
      AND (filter_place_category IS NULL OR p.category = filter_place_category)
  ),
  agg AS (
    SELECT uid, count(*) AS pub_count, sum(eng) AS eng_total, max(at) AS last_pub
    FROM contrib
    WHERE uid <> '00000000-0000-0000-0000-000000000001'
    GROUP BY uid
    HAVING count(*) >= 1
  )
  SELECT
    u.id, u.handle, u.display_name, u.avatar_url, u.accent_color,
    a.pub_count::int,
    explore_creator_publications_total(u.id) AS publications_total,
    a.eng_total::int, a.last_pub,
    ROUND((
        0.40 * explore_norm_log(a.pub_count, 10)
      + 0.35 * explore_norm_log(a.eng_total, 100)
      + 0.25 * explore_recency_decay(a.last_pub, 168, COALESCE(as_of, now()))
    )::numeric, 6)::float8 AS score
  FROM agg a
  JOIN users u ON u.id = a.uid
  WHERE u.is_deactivated = false AND u.is_ghost = false
  ORDER BY score DESC, u.id DESC
  OFFSET offset_param
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.explore_trending_creators_global(TEXT, place_category, INT, INT, TIMESTAMPTZ) TO anon, authenticated;
