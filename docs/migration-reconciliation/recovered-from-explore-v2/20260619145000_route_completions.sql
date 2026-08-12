-- EXPLORE-183 · ROUTE-06-B — Completitud verificada al seguir una ruta

CREATE TABLE route_completions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  places_reached INTEGER NOT NULL,
  places_total   INTEGER NOT NULL,
  distance_m     DECIMAL(10, 2),
  duration_sec   INTEGER,
  verified       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (route_id, user_id)
);

CREATE INDEX idx_route_completions_route ON route_completions (route_id);
CREATE INDEX idx_route_completions_user ON route_completions (user_id);

ALTER TABLE route_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY route_completions_select ON route_completions
  FOR SELECT USING (true);

CREATE POLICY route_completions_insert_own ON route_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION count_route_completions(p_route_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::int FROM route_completions WHERE route_id = p_route_id;
$$;

REVOKE ALL ON FUNCTION count_route_completions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_route_completions(UUID) TO anon, authenticated;
