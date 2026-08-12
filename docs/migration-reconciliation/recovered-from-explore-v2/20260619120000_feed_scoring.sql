-- ─── Feed Cercanos con scoring determinista (COMMUNITY-06-B) ──────────────────
-- Reemplaza el orden `created_at DESC` de videos_within_radius por un score de 3
-- señales calculado en SQL: recencia (0.50) + proximidad (0.30) + engagement (0.20).
-- La paginación pasa de cursor temporal (cursor_at) a keyset por (score, id).
--
-- Se DROPea la firma de 7 params anterior porque cambian los tipos de parámetro y
-- la tabla de retorno (se añade `score`), lo que CREATE OR REPLACE no permite, y
-- para evitar otro PGRST203 por overloads ambiguos (igual que hizo
-- 20260611120000_drop_videos_within_radius_overload.sql).

DROP FUNCTION IF EXISTS public.videos_within_radius(
  double precision,           -- lat_param
  double precision,           -- lng_param
  double precision,           -- radius_meters
  integer,                    -- max_results
  timestamp with time zone,   -- cursor_at
  uuid,                       -- uid_param
  timestamp with time zone    -- exclude_seen_since
);

CREATE OR REPLACE FUNCTION videos_within_radius(
  lat_param           FLOAT,
  lng_param           FLOAT,
  radius_meters       FLOAT,
  max_results         INT     DEFAULT 20,
  cursor_score        FLOAT8  DEFAULT NULL,   -- antes: cursor_at
  cursor_id           UUID    DEFAULT NULL,   -- nuevo: desempate del keyset
  uid_param           UUID    DEFAULT NULL,
  exclude_seen_since  TIMESTAMPTZ DEFAULT NULL,
  -- Instante de referencia para la recencia. El cliente fija uno por sesión de
  -- feed y lo reusa en todas las páginas: si fuera siempre now(), la recencia
  -- cambiaría entre llamadas y el keyset (score, id) repetiría o saltaría videos.
  -- NULL → now() (primera página / llamadas sueltas).
  as_of               TIMESTAMPTZ DEFAULT NULL
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
  score            FLOAT8                     -- nueva columna: lo lee el store para el keyset
)
LANGUAGE sql STABLE AS $$
  -- El keyset (score, id) < (cursor_score, cursor_id) exige que `score` sea una
  -- columna materializada, no un alias del SELECT, así que se calcula en el CTE
  -- y se filtra/ordena en el nivel externo.
  WITH scored AS (
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
      -- Se redondea a 6 decimales para que el score viaje al cliente y vuelva como
      -- cursor_score sin perder precisión: un float8 sin redondear no round-trippea
      -- exacto por JSON y el keyset (score, id) repetiría el video del borde.
      ROUND((
        -- recencia: decaimiento exponencial, tau=72h (vida media ~50h)
          0.50 * exp(-EXTRACT(EPOCH FROM (COALESCE(as_of, now()) - v.created_at)) / 259200.0)
        -- proximidad: lineal, 1.0 en el centro, 0.0 en el borde del radio activo
        + 0.30 * (1.0 - LEAST(
            ST_Distance(v.location, ST_MakePoint(lng_param, lat_param)::geography) / radius_meters,
            1.0
          ))
        -- engagement: logarítmico, comments cuentan 2x, saturación K=50
        + 0.20 * (ln(1 + v.total_likes + 2 * v.total_comments) / ln(1 + 50))
      )::numeric, 6)::float8 AS score
    FROM videos v
    WHERE
      v.state = 'published'
      AND ST_DWithin(
        v.location,
        ST_MakePoint(lng_param, lat_param)::geography,
        radius_meters
      )
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
  )
  SELECT
    scored.id,
    scored.video_url,
    scored.thumbnail_url,
    scored.lat,
    scored.lng,
    scored.route_id,
    scored.description,
    scored.tags,
    scored.duration_seconds,
    scored.total_likes,
    scored.total_comments,
    scored.created_by,
    scored.state,
    scored.created_at,
    scored.updated_at,
    scored.score
  FROM scored
  WHERE
    cursor_score IS NULL
    OR (scored.score, scored.id) < (cursor_score, cursor_id)
  ORDER BY scored.score DESC, scored.id DESC
  LIMIT max_results;
$$;
