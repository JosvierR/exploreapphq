-- EXPLORE-255: distinguish available vs pending vs fully registered emails.
CREATE OR REPLACE FUNCTION public.auth_email_signup_state(p_email text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM auth.users
      WHERE lower(email) = lower(trim(p_email))
        AND coalesce(is_anonymous, false) = false
    ) THEN 'available'
    WHEN EXISTS (
      SELECT 1
      FROM auth.users
      WHERE lower(email) = lower(trim(p_email))
        AND coalesce(is_anonymous, false) = false
        AND email_confirmed_at IS NULL
    ) THEN 'pending_confirmation'
    ELSE 'registered'
  END;
$$;

REVOKE ALL ON FUNCTION public.auth_email_signup_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_signup_state(text) TO anon, authenticated;
COMMENT ON FUNCTION public.auth_email_signup_state(text) IS
  'EXPLORE-255: available | pending_confirmation | registered - no PII beyond email lookup';
