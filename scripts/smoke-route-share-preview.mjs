/**
 * Smoke: anon/publishable key can read a published public route (+ stops) for /r/:id preview.
 * Usage: node --env-file-if-exists=.env.local scripts/smoke-route-share-preview.mjs [routeId]
 */
import { createClient } from "@supabase/supabase-js";

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const key = (
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

if (!url || !key) {
  console.error("Missing SUPABASE_URL and publishable/anon key.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const select = `
  id,
  name,
  description,
  category,
  difficulty,
  distance_m,
  estimated_duration,
  average_rating,
  total_ratings,
  route_places (
    position,
    places (
      id,
      name,
      category,
      state,
      place_photos ( url, position )
    )
  )
`;

const argId = process.argv[2]?.trim();

async function pickSampleRouteId() {
  const { data, error } = await supabase
    .from("routes")
    .select("id, name")
    .eq("state", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
    .limit(5);

  if (error) throw new Error(`list routes failed: ${error.message}`);
  if (!data?.length) return null;
  return data[0];
}

const sample = argId ? { id: argId, name: "(cli)" } : await pickSampleRouteId();

if (!sample) {
  console.log("OK: anon can query routes, but no published+public route exists yet.");
  console.log("Create a public published route in the app, then re-run with its UUID.");
  process.exit(0);
}

const { data, error } = await supabase
  .from("routes")
  .select(select)
  .eq("id", sample.id)
  .eq("state", "published")
  .eq("is_public", true)
  .is("deleted_at", null)
  .maybeSingle();

if (error) {
  console.error("FAIL: fetch route preview", error.message);
  process.exit(1);
}

if (!data) {
  console.error(`FAIL: route ${sample.id} not visible to anon (not published/public or RLS blocked).`);
  process.exit(1);
}

const stops = Array.isArray(data.route_places) ? data.route_places.length : 0;
console.log("OK: public route preview readable");
console.log(
  JSON.stringify(
    {
      id: data.id,
      name: data.name,
      stops,
      share: `https://www.exploreapphq.com/r/${data.id}`,
    },
    null,
    2,
  ),
);
