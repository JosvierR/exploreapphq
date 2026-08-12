-- Extend production seed audit entity types for video engagement batches.
-- Adds comment + like; does not create seed content.

ALTER TABLE public.production_seed_entries
  DROP CONSTRAINT IF EXISTS production_seed_entries_entity_type_check;

ALTER TABLE public.production_seed_entries
  ADD CONSTRAINT production_seed_entries_entity_type_check
  CHECK (entity_type IN (
    'auth_user', 'user', 'place', 'place_photo', 'existing_place_photo',
    'route', 'gps_segment', 'route_place', 'review', 'route_rating',
    'favorite', 'follower', 'storage_object', 'comment', 'like'
  ));

-- Allow service-role seed scripts to bump denormalized counters.
GRANT EXECUTE ON FUNCTION public.increment_video_likes(UUID, INT) TO service_role;

GRANT EXECUTE ON FUNCTION public.increment_video_comments(UUID, INT) TO service_role;
