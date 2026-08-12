-- EXPLORE-254 gap: finalize_user_account_pii anonymized public.users but never
-- touched auth.users. auth.users.email keeps a unique index
-- (users_email_partial_key), so a permanently-deleted user's email stayed
-- locked forever — a new signup attempt with that same email resolved back to
-- the old, already-ghosted auth.users row instead of creating a fresh account,
-- landing the user in an infinite "finalizing deletion" loop.
--
-- Fix: also clear the auth-layer identity for the user being finalized, and
-- drop any lingering sessions/refresh tokens/identities tied to the old
-- credentials. Runs unconditionally (not gated by the public.users idempotency
-- check) so it also backfills accounts that were already finalized before this
-- fix existed.

CREATE OR REPLACE FUNCTION finalize_user_account_pii(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle TEXT;
  v_already_ghost BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND is_ghost = true
      AND handle LIKE 'deleted_%'
  ) INTO v_already_ghost;

  IF NOT v_already_ghost THEN
    v_handle := 'deleted_' || replace(substring(p_user_id::text, 1, 13), '-', '');

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
  END IF;

  -- Frees the email (users_email_partial_key ignores NULLs) so a new signup
  -- with the same address creates a brand new account instead of resolving
  -- back to this one. Not gated on v_already_ghost: also backfills accounts
  -- finalized before this auth-layer cleanup existed.
  UPDATE auth.users
  SET
    email = NULL,
    phone = NULL,
    encrypted_password = '',
    email_confirmed_at = NULL,
    phone_confirmed_at = NULL
  WHERE id = p_user_id
    AND email IS NOT NULL;

  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
END;
$$;

REVOKE ALL ON FUNCTION finalize_user_account_pii(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_user_account_pii(UUID) TO service_role;

-- The orchestrator's "already permanently deleted" early-return used to skip
-- finalize_user_account_pii entirely for already-ghosted accounts, so the auth
-- backfill above would never run for users finalized before this fix. Still
-- call it (cheap: it only does the auth cleanup for already-ghost users,
-- skipping the public.users update and the purge_* calls).
CREATE OR REPLACE FUNCTION finalize_account_deletion_server(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row users%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT * INTO v_row FROM users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_row.is_ghost = true AND v_row.handle LIKE 'deleted_%' THEN
    PERFORM finalize_user_account_pii(p_user_id);
    RETURN;
  END IF;

  IF v_row.is_deactivated IS NOT TRUE
     OR v_row.deletion_scheduled_at IS NULL
     OR v_row.deletion_scheduled_at > now() THEN
    RAISE EXCEPTION 'Account not eligible for permanent deletion (grace period active or not scheduled)';
  END IF;

  PERFORM purge_community_user_data_service(p_user_id);
  PERFORM purge_places_user_data(p_user_id);
  PERFORM purge_routes_user_data(p_user_id);
  PERFORM finalize_user_account_pii(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION finalize_account_deletion_server(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_account_deletion_server(UUID) TO service_role;
