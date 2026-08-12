import { createHash } from "node:crypto";

const text = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

function first(address, keys) {
  for (const key of keys) {
    const value = text(address?.[key]);
    if (value) return { key, value };
  }
  return { key: null, value: null };
}

export function coordinateHash(latitude, longitude) {
  const value = `${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeNominatimResult(payload) {
  const address = payload?.address || {};
  const countryCode = text(address.country_code)?.toUpperCase() || null;
  const countryName = text(address.country);
  if (!countryCode || countryCode.length !== 2 || !countryName) {
    return {
      status: "unknown",
      country_code: null,
      country_name: null,
      admin_level_1: null,
      admin_level_1_code: null,
      admin_level_2: null,
      admin_level_2_code: null,
      locality: null,
      locality_type: null,
      sub_locality: null,
      confidence: 0,
      provider_ref: null,
      evidence: { reason: "country_not_resolved" },
    };
  }

  const locality = first(address, ["city", "municipality", "town", "village"]);
  const adminLevel2 = first(address, ["state_district", "county"]);
  const localityType = locality.key === "municipality" ? "municipality" : locality.value ? "city" : null;
  const adminLevel1 = text(address.state);
  const confidence = locality.value && adminLevel1 ? 0.95 : adminLevel1 ? 0.8 : 0.6;
  const providerRef = payload?.osm_type && payload?.osm_id ? `${payload.osm_type}:${payload.osm_id}` : null;

  return {
    status: "applied",
    country_code: countryCode,
    country_name: countryName,
    admin_level_1: adminLevel1,
    admin_level_1_code: text(address["ISO3166-2-lvl4"]),
    admin_level_2: adminLevel2.value,
    admin_level_2_code: text(address["ISO3166-2-lvl6"]),
    locality: locality.value,
    locality_type: localityType,
    // Zoom 12 intentionally avoids neighborhood-level guesses. A sub-locality
    // must come from a future structured/catalog or reviewed source.
    sub_locality: null,
    confidence,
    provider_ref: providerRef,
    evidence: {
      provider_category: text(payload?.category),
      provider_type: text(payload?.type),
      provider_address_type: text(payload?.addresstype),
      locality_field: locality.key,
      admin_level_2_field: adminLevel2.key,
      attribution: text(payload?.licence),
    },
  };
}

export function buildNominatimReverseUrl(endpoint, latitude, longitude) {
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("layer", "address");
  url.searchParams.set("zoom", "12");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  return url;
}

