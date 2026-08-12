-- ─── Tabla video_impressions ──────────────────────────────────────────────────
-- Registra qué videos ha visto cada usuario (viewability ≥ N segundos).
-- La ventana de olvido es 7 días: viewed_at < NOW() - INTERVAL '7 days'
-- implica que el video vuelve a ser elegible como "fresco" en el feed.

CREATE TABLE video_impressions (
  user_id    UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  video_id   UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- Índice para la query "vídeos NO vistos por uid en los últimos N días"
CREATE INDEX idx_video_impressions_user_viewed_desc
  ON video_impressions (user_id, viewed_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE video_impressions ENABLE ROW LEVEL SECURITY;

-- Solo el propio usuario puede ver sus impresiones
CREATE POLICY video_impressions_select ON video_impressions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Solo puede insertar sus propias impresiones
CREATE POLICY video_impressions_insert ON video_impressions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Necesario para el UPSERT (ON CONFLICT DO UPDATE)
CREATE POLICY video_impressions_update ON video_impressions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Borrado explícito (además del CASCADE por eliminación de cuenta)
CREATE POLICY video_impressions_delete ON video_impressions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ─── RPC videos_within_radius — reemplaza versión anterior ────────────────────
-- Añade uid_param y exclude_seen_since (opcionales, NULL = comportamiento previo).

CREATE OR REPLACE FUNCTION videos_within_radius(
  lat_param           FLOAT,
  lng_param           FLOAT,
  radius_meters       FLOAT,
  max_results         INT         DEFAULT 20,
  cursor_at           TIMESTAMPTZ DEFAULT NULL,
  uid_param           UUID        DEFAULT NULL,
  exclude_seen_since  TIMESTAMPTZ DEFAULT NULL
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
    AND (
      uid_param IS NULL
      OR exclude_seen_since IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM video_impressions vi
        WHERE vi.user_id  = uid_param
          AND vi.video_id = v.id
          AND vi.viewed_at >= exclude_seen_since
      )
    )
  ORDER BY v.created_at DESC
  LIMIT max_results;
$$;

-- ─── RPC videos_recycled_nearby ───────────────────────────────────────────────
-- Fallback cuando no quedan videos frescos: devuelve los ya vistos ordenados
-- por viewed_at ASC (los más antiguos primero) para el reciclaje.
-- Usa OFFSET en vez de cursor porque viewed_at puede cambiar con cada impresión.

CREATE OR REPLACE FUNCTION videos_recycled_nearby(
  lat_param     FLOAT,
  lng_param     FLOAT,
  radius_meters FLOAT,
  uid_param     UUID,
  max_results   INT DEFAULT 20,
  offset_param  INT DEFAULT 0
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
  updated_at       TIMESTAMPTZ,
  last_viewed_at   TIMESTAMPTZ
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
    v.updated_at,
    vi.viewed_at AS last_viewed_at
  FROM videos v
  LEFT JOIN video_impressions vi
    ON vi.video_id = v.id AND vi.user_id = uid_param
  WHERE
    v.state = 'published'
    AND ST_DWithin(
      v.location,
      ST_MakePoint(lng_param, lat_param)::geography,
      radius_meters
    )
  ORDER BY vi.viewed_at ASC NULLS FIRST, v.created_at DESC
  LIMIT max_results OFFSET offset_param;
$$;
