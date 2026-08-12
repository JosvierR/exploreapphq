-- ============================================================================
-- Internal Explore map search over published places only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_places_for_map(
  search_query    TEXT,
  center_lat      DOUBLE PRECISION DEFAULT NULL,
  center_lng      DOUBLE PRECISION DEFAULT NULL,
  category_filter place_category DEFAULT NULL,
  result_limit    INT DEFAULT 25
)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  description       TEXT,
  category          place_category,
  location          GEOGRAPHY(Point, 4326),
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  distance_m        DOUBLE PRECISION,
  average_rating    NUMERIC,
  total_ratings     INTEGER,
  state             place_state,
  created_by        UUID,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  primary_photo_url TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      trim(search_query) AS q,
      CASE
        WHEN center_lat IS NOT NULL AND center_lng IS NOT NULL THEN
          ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ELSE NULL
      END AS center_point
  )
  SELECT
    p.id,
    p.name,
    p.description,
    p.category,
    p.location,
    ST_Y(p.location::geometry) AS latitude,
    ST_X(p.location::geometry) AS longitude,
    CASE
      WHEN n.center_point IS NULL THEN NULL
      ELSE ST_Distance(p.location, n.center_point)
    END::DOUBLE PRECISION AS distance_m,
    p.average_rating,
    p.total_ratings,
    p.state,
    p.created_by,
    p.created_at,
    p.updated_at,
    photo.url AS primary_photo_url
  FROM normalized n
  JOIN public.places p ON p.state = 'published'
  LEFT JOIN LATERAL (
    SELECT pp.url
    FROM public.place_photos pp
    WHERE pp.place_id = p.id
    ORDER BY pp.created_at ASC
    LIMIT 1
  ) photo ON TRUE
  WHERE length(n.q) >= 2
    AND (category_filter IS NULL OR p.category = category_filter)
    AND (
      p.name ILIKE '%' || n.q || '%'
      OR COALESCE(p.description, '') ILIKE '%' || n.q || '%'
      OR p.category::TEXT ILIKE '%' || n.q || '%'
      OR (
        CASE p.category
          WHEN 'hiking' THEN 'hiking senderismo hike trail ruta camino'
          WHEN 'gastronomy' THEN 'gastronomy gastronomia gastronomía food comida restaurant restaurante pizza'
          WHEN 'beach' THEN 'beach playa mar costa'
          WHEN 'urban' THEN 'urban urbano city ciudad sector calle'
          WHEN 'nature' THEN 'nature naturaleza natural parque'
          ELSE 'other otro'
        END
      ) ILIKE '%' || n.q || '%'
    )
  ORDER BY
    CASE WHEN p.name ILIKE n.q || '%' THEN 0 ELSE 1 END,
    CASE
      WHEN n.center_point IS NULL THEN 0
      ELSE ST_Distance(p.location, n.center_point)
    END ASC,
    p.name ASC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 25), 1), 25);
$$;

GRANT EXECUTE ON FUNCTION public.search_places_for_map(
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  place_category,
  INT
) TO anon, authenticated;
