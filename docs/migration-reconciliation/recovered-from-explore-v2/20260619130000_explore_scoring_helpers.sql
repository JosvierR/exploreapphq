-- ─── Helpers de scoring para Explore (descubrimiento) ────────────────────────
-- Funciones matemáticas puras y reutilizables por todas las RPCs de las líneas de
-- la pantalla Explore (Rutas favoritas, Tendencia, Joyas ocultas, Recién publicado,
-- Creadores). Se definen una sola vez para no reescribir la misma fórmula en cada
-- query y mantener consistencia con el scoring del feed (20260619120000_feed_scoring).
--
-- Todas son IMMUTABLE: no leen tablas y `as_of` se pasa por parámetro (nunca now()
-- interno), de modo que el score es determinista entre páginas del mismo keyset —
-- exactamente como exige la paginación (score, id).

-- Decaimiento exponencial de recencia en [0,1]; vale 0.5 a las `half_life_hours`.
CREATE OR REPLACE FUNCTION explore_recency_decay(
  ts               TIMESTAMPTZ,
  half_life_hours  FLOAT,
  as_of            TIMESTAMPTZ
)
RETURNS FLOAT8 LANGUAGE sql IMMUTABLE AS $$
  SELECT exp(
    -(EXTRACT(EPOCH FROM (as_of - ts)) / 3600.0)
    * ln(2) / GREATEST(half_life_hours, 0.0001)
  );
$$;

-- Saturación logarítmica hacia [0,1]; refleja ln(1+x)/ln(1+50) del feed_scoring.
CREATE OR REPLACE FUNCTION explore_norm_log(value FLOAT, k FLOAT)
RETURNS FLOAT8 LANGUAGE sql IMMUTABLE AS $$
  SELECT ln(1 + GREATEST(value, 0)) / ln(1 + GREATEST(k, 1));
$$;

-- Rating bayesiano: encoge hacia el promedio global. `m` = pseudo-conteo previo.
-- Evita que un lugar/ruta con 1 reseña de 5★ supere a otro con 40 reseñas de 4.6★.
CREATE OR REPLACE FUNCTION explore_bayesian_rating(
  avg         FLOAT,
  cnt         INT,
  global_avg  FLOAT,
  m           FLOAT
)
RETURNS FLOAT8 LANGUAGE sql IMMUTABLE AS $$
  SELECT (cnt * avg + m * global_avg) / NULLIF(cnt + m, 0);
$$;

-- Proximidad lineal en [0,1]; 1.0 en el centro, 0.0 en el borde del radio.
CREATE OR REPLACE FUNCTION explore_proximity_score(dist_m FLOAT, radius_m FLOAT)
RETURNS FLOAT8 LANGUAGE sql IMMUTABLE AS $$
  SELECT 1.0 - LEAST(dist_m / NULLIF(radius_m, 0), 1.0);
$$;

GRANT EXECUTE ON FUNCTION explore_recency_decay(TIMESTAMPTZ, FLOAT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION explore_norm_log(FLOAT, FLOAT)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION explore_bayesian_rating(FLOAT, INT, FLOAT, FLOAT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION explore_proximity_score(FLOAT, FLOAT)                   TO anon, authenticated;
