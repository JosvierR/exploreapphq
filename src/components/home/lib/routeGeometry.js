export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smoothstep = (start, end, value) => {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};

export function coordinateToVector(lat, lon, radius = 1) {
  const latitude = lat * Math.PI / 180;
  const longitude = lon * Math.PI / 180;
  return {
    x: radius * Math.cos(latitude) * Math.cos(longitude),
    y: radius * Math.sin(latitude),
    z: -radius * Math.cos(latitude) * Math.sin(longitude),
  };
}

// Seeded bends create uneven, winding paths without moving their endpoints.
// Geographic validation in generate-route-network.py uses the same equation.
export function networkCoordinateAt(curve, seed, progress) {
  const inverse = 1 - progress;
  const latitude = inverse * inverse * curve[0] + 2 * inverse * progress * curve[2] + progress * progress * curve[4];
  const longitude = inverse * inverse * curve[1] + 2 * inverse * progress * curve[3] + progress * progress * curve[5];
  const cosine = Math.max(0.25, Math.cos((curve[0] + curve[4]) * 0.5 * Math.PI / 180));
  const dx = (curve[5] - curve[1]) * cosine;
  const dy = curve[4] - curve[0];
  const length = Math.hypot(dx, dy);
  const waves = Math.sin(progress * Math.PI * (2 + Math.floor(seed * 4)) + seed * 12) * 0.55
    + Math.sin(progress * Math.PI * (6 + Math.floor(seed * 7)) + seed * 24) * 0.3
    + Math.sin(progress * Math.PI * 11 + seed * 36) * 0.15;
  const bend = length * (0.22 + 0.27 * seed) * Math.sin(progress * Math.PI) * waves;
  return [latitude - dx / length * bend, longitude + dy / length * bend / cosine];
}
