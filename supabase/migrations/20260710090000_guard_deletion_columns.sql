-- EXPLORE-254 hardening: prevent bypassing the account-deletion grace period via direct RLS UPDATE.
-- users_update_own currently allows any authenticated user to freely set
-- is_deactivated / deletion_requested_at / deletion_scheduled_at on their own row,
-- letting a client skip the 14-day grace period before calling finalize_own_expired_account().
--
-- Fix: a trigger rejects changes to those columns unless the change goes through a
-- SECURITY DEFINER RPC that sets a local bypass flag first. Client code must call
-- request_account_deletion() / restore_account() instead of updating those columns directly.

CREATE OR REPLACE FUNCTION guard_deletion_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.is_deactivated IS DISTINCT FROM OLD.is_deactivated
    OR NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at
    OR NEW.deletion_scheduled_at IS DISTINCT FROM OLD.deletion_scheduled_at
  ) AND current_setting('app.bypass_deletion_guard', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'is_deactivated, deletion_requested_at and deletion_scheduled_at can only be changed via request_account_deletion() / restore_account()';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_deletion_columns_trigger ON users;
CREATE TRIGGER guard_deletion_columns_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION guard_deletion_columns();

-- ─── Client-facing RPCs (replace direct .update() calls from the repository) ──

CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.bypass_deletion_guard', 'on', true);

  UPDATE users
  SET
    is_deactivated = true,
    deletion_requested_at = now(),
    deletion_scheduled_at = now() + interval '14 days'
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION request_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_account_deletion() TO authenticated;

CREATE OR REPLACE FUNCTION restore_account()
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.bypass_deletion_guard', 'on', true);

  UPDATE users
  SET
    is_deactivated = false,
    deletion_requested_at = null,
    deletion_scheduled_at = null
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION restore_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_account() TO authenticated;

-- ─── Concurrency hardening for the sweep (EXPLORE-254) ──────────────────────
-- Two concurrent sweep invocations (e.g. overlapping cron runs) could pick the
-- same expired user and race to finalize it. FOR UPDATE SKIP LOCKED makes each
-- runner claim disjoint rows instead of double-processing the same account.

CREATE OR REPLACE FUNCTION sweep_expired_account_deletions(p_limit INT DEFAULT 50)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INT := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 50;
  END IF;

  FOR v_user_id IN
    SELECT id
    FROM users
    WHERE is_deactivated = true
      AND is_ghost = false
      AND deletion_scheduled_at IS NOT NULL
      AND deletion_scheduled_at <= now()
    ORDER BY deletion_scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM finalize_account_deletion_server(v_user_id);
      v_count := v_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'finalize_account_deletion_server failed for %: %', v_user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION sweep_expired_account_deletions(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sweep_expired_account_deletions(INT) TO service_role;

-- finalize_user_account_pii (20260708120000) sets is_deactivated = true defensively even
-- though it should already be true by the time it runs — set the bypass flag so that path
-- never trips the guard trigger regardless of the row's prior state.
CREATE OR REPLACE FUNCTION finalize_user_account_pii(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND is_ghost = true
      AND handle LIKE 'deleted_%'
  ) THEN
    RETURN;
  END IF;

  v_handle := 'deleted_' || replace(substring(p_user_id::text, 1, 13), '-', '');

  PERFORM set_config('app.bypass_deletion_guard', 'on', true);

  UPDATE users
  SET
    handle = v_handle,
    display_name = 'Deleted user',
    email = NULL,
    avatar_url = NULL,
    bio = NULL,
    categories_preferred = '{}',
    is_deactivated = true,
    is_ghost = true,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;
