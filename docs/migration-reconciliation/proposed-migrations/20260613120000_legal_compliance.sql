-- ============================================================================
-- EXPLORE-204 · Legal compliance: consent, privacy preferences, blocks
-- ============================================================================

-- ─── LEGAL CONSENT (registro) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_legal_consent (
  user_id                        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  terms_accepted                 BOOLEAN NOT NULL DEFAULT false,
  privacy_accepted               BOOLEAN NOT NULL DEFAULT false,
  community_guidelines_accepted  BOOLEAN NOT NULL DEFAULT false,
  data_ads_policy_accepted       BOOLEAN NOT NULL DEFAULT false,
  policy_version                 TEXT NOT NULL,
  locale                         TEXT NOT NULL DEFAULT 'es',
  platform                       TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  accepted_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_legal_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_legal_consent_select_own ON user_legal_consent
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_legal_consent_insert_own ON user_legal_consent
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY user_legal_consent_update_own ON user_legal_consent
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─── PRIVACY PREFERENCES (anuncios / datos) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS user_privacy_preferences (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  personalized_ads     BOOLEAN NOT NULL DEFAULT false,
  ad_measurement       BOOLEAN NOT NULL DEFAULT false,
  aggregated_insights  BOOLEAN NOT NULL DEFAULT false,
  do_not_sell_or_share BOOLEAN NOT NULL DEFAULT true,
  version              TEXT NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_privacy_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_privacy_preferences_select_own ON user_privacy_preferences
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_privacy_preferences_insert_own ON user_privacy_preferences
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY user_privacy_preferences_update_own ON user_privacy_preferences
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─── SAFETY CONSENT (rutas) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_safety_consent (
  user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  route_safety_accepted  BOOLEAN NOT NULL DEFAULT false,
  version                TEXT NOT NULL,
  accepted_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_safety_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_safety_consent_select_own ON user_safety_consent
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_safety_consent_insert_own ON user_safety_consent
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY user_safety_consent_update_own ON user_safety_consent
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ─── BLOCKED USERS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocked_users_no_self CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users (blocked_id);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocked_users_select_own ON blocked_users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = blocker_id);

CREATE POLICY blocked_users_insert_own ON blocked_users
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = blocker_id);

CREATE POLICY blocked_users_delete_own ON blocked_users
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = blocker_id);

-- ─── CONTENT REPORTS — status para moderación ───────────────────────────────

ALTER TABLE content_reports
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_content_reports_status
  ON content_reports (status)
  WHERE status = 'pending';
