-- Explore Lab: community feedback + public roadmap (V1)
-- Tables: feedback_ideas, feedback_boosts, feedback_comments, feedback_updates

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.feedback_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'listening',
  boost_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  team_response text,
  is_visible boolean NOT NULL DEFAULT true,
  is_team_created boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  duplicate_of uuid REFERENCES public.feedback_ideas(id) ON DELETE SET NULL,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_ideas_title_len CHECK (char_length(title) BETWEEN 4 AND 80),
  CONSTRAINT feedback_ideas_description_len CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT feedback_ideas_category_check CHECK (
    category IN ('discover', 'places', 'routes', 'community', 'ai', 'profile', 'events', 'other')
  ),
  CONSTRAINT feedback_ideas_status_check CHECK (
    status IN ('listening', 'considering', 'planned', 'building', 'shipped', 'not_now')
  ),
  CONSTRAINT feedback_ideas_boost_count_nonneg CHECK (boost_count >= 0),
  CONSTRAINT feedback_ideas_comment_count_nonneg CHECK (comment_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS feedback_ideas_slug_uidx
  ON public.feedback_ideas (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS feedback_ideas_status_idx ON public.feedback_ideas (status);
CREATE INDEX IF NOT EXISTS feedback_ideas_category_idx ON public.feedback_ideas (category);
CREATE INDEX IF NOT EXISTS feedback_ideas_featured_idx ON public.feedback_ideas (is_featured, is_visible);
CREATE INDEX IF NOT EXISTS feedback_ideas_created_at_idx ON public.feedback_ideas (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_ideas_updated_at_idx ON public.feedback_ideas (updated_at DESC);
CREATE INDEX IF NOT EXISTS feedback_ideas_visible_status_idx
  ON public.feedback_ideas (is_visible, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS feedback_ideas_title_trgm_idx
  ON public.feedback_ideas USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS feedback_ideas_description_trgm_idx
  ON public.feedback_ideas USING gin (description gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.feedback_boosts (
  idea_id uuid NOT NULL REFERENCES public.feedback_ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, user_id)
);

CREATE INDEX IF NOT EXISTS feedback_boosts_user_id_idx ON public.feedback_boosts (user_id);
CREATE INDEX IF NOT EXISTS feedback_boosts_idea_id_idx ON public.feedback_boosts (idea_id);

CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.feedback_ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_comments_body_len CHECK (char_length(body) BETWEEN 2 AND 1000)
);

CREATE INDEX IF NOT EXISTS feedback_comments_idea_id_idx
  ON public.feedback_comments (idea_id, created_at);

CREATE TABLE IF NOT EXISTS public.feedback_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.feedback_ideas(id) ON DELETE CASCADE,
  status text,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_updates_status_check CHECK (
    status IS NULL
    OR status IN ('listening', 'considering', 'planned', 'building', 'shipped', 'not_now')
  )
);

CREATE INDEX IF NOT EXISTS feedback_updates_idea_id_idx
  ON public.feedback_updates (idea_id, created_at);

-- Counters via triggers (concurrency-safe)
CREATE OR REPLACE FUNCTION public.feedback_bump_boost_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feedback_ideas
    SET boost_count = boost_count + 1, updated_at = now()
    WHERE id = NEW.idea_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feedback_ideas
    SET boost_count = GREATEST(0, boost_count - 1), updated_at = now()
    WHERE id = OLD.idea_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS feedback_boosts_count_ai ON public.feedback_boosts;
CREATE TRIGGER feedback_boosts_count_ai
  AFTER INSERT ON public.feedback_boosts
  FOR EACH ROW EXECUTE FUNCTION public.feedback_bump_boost_count();

DROP TRIGGER IF EXISTS feedback_boosts_count_ad ON public.feedback_boosts;
CREATE TRIGGER feedback_boosts_count_ad
  AFTER DELETE ON public.feedback_boosts
  FOR EACH ROW EXECUTE FUNCTION public.feedback_bump_boost_count();

CREATE OR REPLACE FUNCTION public.feedback_bump_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feedback_ideas
    SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = NEW.idea_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feedback_ideas
    SET comment_count = GREATEST(0, comment_count - 1), updated_at = now()
    WHERE id = OLD.idea_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_visible IS DISTINCT FROM NEW.is_visible THEN
      UPDATE public.feedback_ideas
      SET comment_count = GREATEST(
            0,
            comment_count + CASE WHEN NEW.is_visible THEN 1 ELSE -1 END
          ),
          updated_at = now()
      WHERE id = NEW.idea_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS feedback_comments_count_ai ON public.feedback_comments;
CREATE TRIGGER feedback_comments_count_ai
  AFTER INSERT ON public.feedback_comments
  FOR EACH ROW EXECUTE FUNCTION public.feedback_bump_comment_count();

DROP TRIGGER IF EXISTS feedback_comments_count_ad ON public.feedback_comments;
CREATE TRIGGER feedback_comments_count_ad
  AFTER DELETE ON public.feedback_comments
  FOR EACH ROW EXECUTE FUNCTION public.feedback_bump_comment_count();

DROP TRIGGER IF EXISTS feedback_comments_count_au ON public.feedback_comments;
CREATE TRIGGER feedback_comments_count_au
  AFTER UPDATE OF is_visible ON public.feedback_comments
  FOR EACH ROW EXECUTE FUNCTION public.feedback_bump_comment_count();

CREATE OR REPLACE FUNCTION public.feedback_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_ideas_updated_at ON public.feedback_ideas;
CREATE TRIGGER feedback_ideas_updated_at
  BEFORE UPDATE ON public.feedback_ideas
  FOR EACH ROW EXECUTE FUNCTION public.feedback_set_updated_at();

DROP TRIGGER IF EXISTS feedback_comments_updated_at ON public.feedback_comments;
CREATE TRIGGER feedback_comments_updated_at
  BEFORE UPDATE ON public.feedback_comments
  FOR EACH ROW EXECUTE FUNCTION public.feedback_set_updated_at();

-- Admin helper (reuse admin_users roster)
CREATE OR REPLACE FUNCTION public.feedback_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
  );
$$;

-- Rate limit: ideas
CREATE OR REPLACE FUNCTION public.feedback_assert_idea_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  IF public.feedback_is_admin() THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO recent_count
  FROM public.feedback_ideas
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'rate_limit: max 3 ideas per 24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_ideas_rate_limit ON public.feedback_ideas;
CREATE TRIGGER feedback_ideas_rate_limit
  BEFORE INSERT ON public.feedback_ideas
  FOR EACH ROW EXECUTE FUNCTION public.feedback_assert_idea_rate_limit();

-- Guard columns users must not set
CREATE OR REPLACE FUNCTION public.feedback_ideas_guard_user_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.feedback_is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'listening';
    NEW.boost_count := 0;
    NEW.comment_count := 0;
    NEW.team_response := NULL;
    NEW.is_visible := true;
    NEW.is_team_created := false;
    NEW.is_featured := false;
    NEW.duplicate_of := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.status := OLD.status;
    NEW.boost_count := OLD.boost_count;
    NEW.comment_count := OLD.comment_count;
    NEW.team_response := OLD.team_response;
    NEW.is_visible := OLD.is_visible;
    NEW.is_team_created := OLD.is_team_created;
    NEW.is_featured := OLD.is_featured;
    NEW.duplicate_of := OLD.duplicate_of;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_ideas_guard ON public.feedback_ideas;
CREATE TRIGGER feedback_ideas_guard
  BEFORE INSERT OR UPDATE ON public.feedback_ideas
  FOR EACH ROW EXECUTE FUNCTION public.feedback_ideas_guard_user_columns();

ALTER TABLE public.feedback_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_updates ENABLE ROW LEVEL SECURITY;

-- Ideas policies
DROP POLICY IF EXISTS feedback_ideas_select ON public.feedback_ideas;
CREATE POLICY feedback_ideas_select ON public.feedback_ideas
  FOR SELECT
  USING (is_visible = true OR user_id = auth.uid() OR public.feedback_is_admin());

DROP POLICY IF EXISTS feedback_ideas_insert ON public.feedback_ideas;
CREATE POLICY feedback_ideas_insert ON public.feedback_ideas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS feedback_ideas_update_admin ON public.feedback_ideas;
CREATE POLICY feedback_ideas_update_admin ON public.feedback_ideas
  FOR UPDATE
  USING (public.feedback_is_admin())
  WITH CHECK (public.feedback_is_admin());

-- Boosts
DROP POLICY IF EXISTS feedback_boosts_select ON public.feedback_boosts;
CREATE POLICY feedback_boosts_select ON public.feedback_boosts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS feedback_boosts_insert ON public.feedback_boosts;
CREATE POLICY feedback_boosts_insert ON public.feedback_boosts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS feedback_boosts_delete ON public.feedback_boosts;
CREATE POLICY feedback_boosts_delete ON public.feedback_boosts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
DROP POLICY IF EXISTS feedback_comments_select ON public.feedback_comments;
CREATE POLICY feedback_comments_select ON public.feedback_comments
  FOR SELECT
  USING (is_visible = true OR user_id = auth.uid() OR public.feedback_is_admin());

DROP POLICY IF EXISTS feedback_comments_insert ON public.feedback_comments;
CREATE POLICY feedback_comments_insert ON public.feedback_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS feedback_comments_update ON public.feedback_comments;
CREATE POLICY feedback_comments_update ON public.feedback_comments
  FOR UPDATE
  USING (auth.uid() = user_id OR public.feedback_is_admin())
  WITH CHECK (auth.uid() = user_id OR public.feedback_is_admin());

DROP POLICY IF EXISTS feedback_comments_delete ON public.feedback_comments;
CREATE POLICY feedback_comments_delete ON public.feedback_comments
  FOR DELETE
  USING (auth.uid() = user_id OR public.feedback_is_admin());

-- Updates (read public; write admin)
DROP POLICY IF EXISTS feedback_updates_select ON public.feedback_updates;
CREATE POLICY feedback_updates_select ON public.feedback_updates
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS feedback_updates_insert ON public.feedback_updates;
CREATE POLICY feedback_updates_insert ON public.feedback_updates
  FOR INSERT
  WITH CHECK (public.feedback_is_admin());

DROP POLICY IF EXISTS feedback_updates_update ON public.feedback_updates;
CREATE POLICY feedback_updates_update ON public.feedback_updates
  FOR UPDATE
  USING (public.feedback_is_admin())
  WITH CHECK (public.feedback_is_admin());

DROP POLICY IF EXISTS feedback_updates_delete ON public.feedback_updates;
CREATE POLICY feedback_updates_delete ON public.feedback_updates
  FOR DELETE
  USING (public.feedback_is_admin());

GRANT SELECT ON public.feedback_ideas TO anon, authenticated;
GRANT INSERT ON public.feedback_ideas TO authenticated;
GRANT UPDATE ON public.feedback_ideas TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.feedback_boosts TO authenticated;
GRANT SELECT ON public.feedback_boosts TO anon;

GRANT SELECT ON public.feedback_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feedback_comments TO authenticated;

GRANT SELECT ON public.feedback_updates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feedback_updates TO authenticated;

-- Extend content_reports insert policy to include Lab content types when present
DO $$
BEGIN
  IF to_regclass('public.content_reports') IS NOT NULL THEN
    DROP POLICY IF EXISTS content_reports_insert ON public.content_reports;
    CREATE POLICY content_reports_insert ON public.content_reports
      FOR INSERT
      WITH CHECK (
        auth.uid() = reported_by
        AND content_type IN (
          'place_photo', 'place', 'user', 'video',
          'feedback_idea', 'feedback_comment'
        )
      );
  END IF;
END $$;
