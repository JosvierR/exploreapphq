/**
 * Parse PostGIS EWKB / WKB hex Point (little-endian) → { lat, lng }.
 * Prod PostgREST returns geography as EWKB hex (e.g. 0101000020E6100000...).
 */
export function parsePostgisPoint(raw: unknown): { lat: number; lng: number } | null {
  if (raw == null) return null;

  if (typeof raw === "object") {
    const obj = raw as { type?: string; coordinates?: unknown; lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
    if (obj.type === "Point" && Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
      const lng = Number(obj.coordinates[0]);
      const lat = Number(obj.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const lat = Number(obj.lat ?? obj.latitude);
    const lng = Number(obj.lng ?? obj.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }

  if (typeof raw !== "string") return null;
  const hex = raw.trim();
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 42) return null;

  try {
    const bytes = hexToBytes(hex);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    const littleEndian = view.getUint8(offset) === 1;
    offset += 1;

    let typeWord = view.getUint32(offset, littleEndian);
    offset += 4;
    const hasSrid = (typeWord & 0x20000000) !== 0;
    typeWord &= ~0x20000000;
    typeWord &= ~0x40000000;
    typeWord &= ~0x80000000;
    if (typeWord !== 1) return null;
    if (hasSrid) offset += 4;

    const x = view.getFloat64(offset, littleEndian);
    offset += 8;
    const y = view.getFloat64(offset, littleEndian);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    // Geo: x=lng, y=lat
    return { lat: y, lng: x };
  } catch {
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
