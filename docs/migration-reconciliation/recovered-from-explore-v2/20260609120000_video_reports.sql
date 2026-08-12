-- EXPLORE-144 · video_reports audit table + RLS to mark videos as reported

CREATE TABLE video_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL
              CHECK (reason IN (
                'spam',
                'inappropriate',
                'misleading',
                'harassment',
                'other'
              )),
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, reported_by)
);

CREATE INDEX idx_video_reports_video_id ON video_reports(video_id);

ALTER TABLE video_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY video_reports_insert_authenticated ON video_reports
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = reported_by);

CREATE POLICY video_reports_select_own ON video_reports
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reported_by);

-- Authenticated users can flag someone else's video as reported (not their own).
DROP POLICY IF EXISTS videos_update_report ON videos;

CREATE POLICY videos_update_report ON videos
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by != (SELECT auth.uid())
    AND state = 'published'::video_state
  )
  WITH CHECK (state = 'reported'::video_state);
