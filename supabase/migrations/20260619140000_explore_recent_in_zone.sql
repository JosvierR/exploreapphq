-- ─── Explore · "Recién publicado en tu zona" (lugares + videos) ──────────────
-- Zona de recencia pura: lo más nuevo dentro del radio, sin engagement ni rating
-- (mezclar engagement aquí dejaría de ser "recién publicado"). La proximidad la
-- garantiza el filtro de radio; el orden es created_at DESC. Son DOS RPCs (una por
-- dominio dueño: places y community/videos), nunca un UNION — el merge places+videos
-- es una preocupación de presentación que resuelve el cliente por created_at DESC.

-- Lugares recién publicados en la zona. Devuelve SETOF places para que el cliente
-- reutilice hydratePhotos + rowToPlace sin cambios.
CREATE OR REPLACE FUNCTION places_recent_nearby(
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
  SELECT p.*
  FROM places p
  WHERE p.state = 'published'
    AND ST_DWithin(p.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
    AND (filter_category IS NULL OR p.category = filter_category)
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT max_results;
$$;

-- Videos recién publicados en la zona. Devuelve lat/lng planos (mismo shape que
-- videos_within_radius) para que rowToVideo lo mapee sin cambios.
CREATE OR REPLACE FUNCTION videos_recent_nearby(
  in_lat        FLOAT,
  in_lng        FLOAT,
  radius_m      FLOAT,
  filter_tag    TEXT DEFAULT NULL,
  max_results   INT  DEFAULT 12
)
RETURNS TABLE (
  id               UUID,
  video_url        TEXT,
  thumbnail_url    TEXT,
  lat              FLOAT,
  lng              FLOAT,
  route_id         UUID,
  description      TEXT,
  tags             TEXT[],
  duration_seconds INT,
  total_likes      INT,
  total_comments   INT,
  created_by       UUID,
  state            TEXT,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    v.id,
    v.video_url,
    v.thumbnail_url,
    ST_Y(v.location::geometry) AS lat,
    ST_X(v.location::geometry) AS lng,
    v.route_id,
    v.description,
    v.tags::text[],
    v.duration_seconds,
    v.total_likes,
    v.total_comments,
    v.created_by,
    v.state::text,
    v.created_at,
    v.updated_at
  FROM videos v
  WHERE v.state = 'published'
    AND ST_DWithin(v.location, ST_MakePoint(in_lng, in_lat)::geography, radius_m)
    AND (filter_tag IS NULL OR filter_tag = ANY(v.tags::text[]))
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION places_recent_nearby(FLOAT, FLOAT, FLOAT, place_category, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION videos_recent_nearby(FLOAT, FLOAT, FLOAT, TEXT, INT)            TO anon, authenticated;
