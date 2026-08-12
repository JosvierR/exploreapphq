/**
 * Feed de videos por proximidad geográfica.
 * Filtra solo videos publicados dentro del radio especificado.
 * Devuelve los videos más recientes primero (cursor-based por created_at).
 */
CREATE OR REPLACE FUNCTION videos_within_radius(
  lat_param       FLOAT,
  lng_param       FLOAT,
  radius_meters   FLOAT,
  max_results     INT     DEFAULT 20,
  cursor_at       TIMESTAMPTZ DEFAULT NULL  -- para paginación: última created_at de la página anterior
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
LANGUAGE sql STABLE AS $$
  SELECT
    v.id,
    v.video_url,
    v.thumbnail_url,
    ST_Y(v.location::geometry) AS lat,
    ST_X(v.location::geometry) AS lng,
    v.route_id,
    v.description,
    v.tags,
    v.duration_seconds,
    v.total_likes,
    v.total_comments,
    v.created_by,
    v.state,
    v.created_at,
    v.updated_at
  FROM videos v
  WHERE
    v.state = 'published'
    AND ST_DWithin(
      v.location,
      ST_MakePoint(lng_param, lat_param)::geography,
      radius_meters
    )
    AND (cursor_at IS NULL OR v.created_at < cursor_at)
  ORDER BY v.created_at DESC
  LIMIT max_results;
$$;

