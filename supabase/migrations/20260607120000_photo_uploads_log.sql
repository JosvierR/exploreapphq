-- Photo contribution rate-limit log (EXPLORE-147 / PLACE-02-G).
-- Tracks photo uploads per user to enforce the per-hour anti-spam quota.

CREATE TABLE photo_uploads_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id    UUID REFERENCES places(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_uploads_log_user_time
  ON photo_uploads_log (user_id, uploaded_at DESC);

CREATE OR REPLACE FUNCTION count_user_uploads_in_window(
  uid UUID,
  window_seconds INTEGER DEFAULT 3600
)
RETURNS INTEGER
LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INTEGER
  FROM photo_uploads_log
  WHERE user_id = uid
    AND uploaded_at > now() - (window_seconds || ' seconds')::interval;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_upload_logs()
RETURNS void
LANGUAGE sql AS $$
  DELETE FROM photo_uploads_log
  WHERE uploaded_at < now() - interval '24 hours';
$$;
