-- Extend place_category and route_category with 9 new categories to cover more
-- of what users can share in the app. Inserted before 'other' so the catch-all
-- stays last. Each ADD VALUE must run outside the transaction that uses it,
-- so this migration only adds enum values — no other schema changes.

ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'nightlife' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'culture' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'history' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'shopping' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'wellness' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'adventure' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'camping' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'events' BEFORE 'other';
ALTER TYPE place_category ADD VALUE IF NOT EXISTS 'family' BEFORE 'other';

ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'nightlife' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'culture' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'history' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'shopping' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'wellness' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'adventure' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'camping' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'events' BEFORE 'other';
ALTER TYPE route_category ADD VALUE IF NOT EXISTS 'family' BEFORE 'other';
