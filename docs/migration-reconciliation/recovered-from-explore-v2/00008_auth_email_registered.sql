-- Safe email lookup for login UX (no password / profile data exposed).
CREATE OR REPLACE FUNCTION public.auth_email_registered(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(trim(p_email))
      AND coalesce(is_anonymous, false) = false
  );
$$;

REVOKE ALL ON FUNCTION public.auth_email_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_registered(text) TO anon, authenticated;
