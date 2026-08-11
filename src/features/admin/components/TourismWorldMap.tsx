import { useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatNumber } from "@/lib/analyticsDisplay";

export type DemandMapChild = {
  key: string;
  label: string;
  level: string;
  events: number;
  users: number;
  sessions: number;
  place_views: number;
  route_views: number;
  intent: number;
  saves: number;
  searches: number;
  metric: number;
  share_pct: number | null;
  lat?: number | null;
  lng?: number | null;
};

/** Approximate centroids as [lat, lng]. Keys: ISO country or `COUNTRY:region|city`. */
const GEO_LAT_LNG: Record<string, [number, number]> = {
  US: [39.8, -98.5],
  CA: [56.1, -106.3],
  MX: [23.6, -102.5],
  BR: [-14.2, -51.9],
  AR: [-38.4, -63.6],
  CL: [-35.7, -71.5],
  CO: [4.6, -74.3],
  PE: [-9.2, -75.0],
  VE: [6.4, -66.6],
  DO: [18.7, -70.2],
  PR: [18.2, -66.5],
  CU: [21.5, -77.8],
  JM: [18.1, -77.3],
  HT: [18.9, -72.3],
  CR: [9.7, -84.1],
  PA: [8.5, -80.8],
  GT: [15.8, -90.2],
  GB: [52.4, -1.2],
  IE: [53.1, -8.2],
  FR: [46.2, 2.2],
  ES: [40.5, -3.7],
  PT: [39.4, -8.2],
  DE: [51.2, 10.5],
  IT: [41.9, 12.6],
  NL: [52.1, 5.3],
  BE: [50.5, 4.5],
  CH: [46.8, 8.2],
  AT: [47.5, 14.6],
  PL: [52.1, 19.1],
  SE: [60.1, 18.6],
  NO: [60.5, 8.5],
  DK: [56.3, 9.5],
  FI: [61.9, 25.7],
  GR: [39.1, 21.8],
  TR: [39.0, 35.2],
  RU: [61.5, 105.3],
  UA: [48.4, 31.2],
  EG: [26.8, 30.8],
  MA: [31.8, -7.1],
  ZA: [-29.0, 25.1],
  NG: [9.1, 8.7],
  KE: [0.0, 37.9],
  AE: [23.4, 53.8],
  SA: [23.9, 45.1],
  IL: [31.0, 34.9],
  IR: [32.4, 53.7],
  IQ: [33.2, 43.7],
  IN: [20.6, 78.9],
  PK: [30.4, 69.3],
  BD: [23.7, 90.4],
  CN: [35.9, 104.2],
  JP: [36.2, 138.3],
  KR: [35.9, 127.8],
  TH: [15.9, 100.9],
  VN: [14.1, 108.3],
  ID: [-0.8, 113.9],
  MY: [4.2, 101.9],
  PH: [12.9, 121.8],
  SG: [1.4, 103.8],
  AU: [-25.3, 133.8],
  NZ: [-40.9, 174.9],
  "DO:Santiago": [19.45, -70.7],
  "DO:Santo Domingo": [18.49, -69.93],
  "DO:Puerto Plata": [19.79, -70.69],
  "DO:La Altagracia": [18.58, -68.7],
  "DO:La Vega": [19.22, -70.53],
  "US:Florida": [27.8, -81.7],
  "US:California": [36.8, -119.4],
  "US:New York": [43.0, -75.5],
  "US:Florida:Miami": [25.76, -80.19],
  "US:Florida:Wynwood": [25.8, -80.2],
};

function resolvePosition(child: DemandMapChild, parentCountry: string | null): [number, number] | null {
  if (child.lat != null && child.lng != null && Number.isFinite(child.lat) && Number.isFinite(child.lng)) {
    return [child.lat, child.lng];
  }
  const key = child.key.toUpperCase();
  if (child.level === "country" && GEO_LAT_LNG[key]) return GEO_LAT_LNG[key];
  if (parentCountry) {
    const compound = `${parentCountry.toUpperCase()}:${child.key}`;
    if (GEO_LAT_LNG[compound]) return GEO_LAT_LNG[compound];
    const nested = Object.entries(GEO_LAT_LNG).find(
      ([entry]) => entry.endsWith(`:${child.key}`) && entry.startsWith(`${parentCountry.toUpperCase()}:`),
    );
    if (nested) return nested[1];
  }
  if (GEO_LAT_LNG[key]) return GEO_LAT_LNG[key];
  return null;
}

export function TourismWorldMap({
  zones,
  parentCountry,
  onSelect,
}: {
  zones: DemandMapChild[];
  parentCountry?: string | null;
  onSelect: (child: DemandMapChild) => void;
}) {
  const maxMetric = Math.max(1, ...zones.map((item) => item.metric));
  const markers = useMemo(() => {
    const mapped = [];
    const missing: string[] = [];
    for (const child of zones) {
      const position = resolvePosition(child, parentCountry || null);
      if (!position) {
        missing.push(child.label);
        continue;
      }
      const intensity = child.metric / maxMetric;
      mapped.push({
        child,
        position: position as LatLngExpression,
        radius: 8 + intensity * 30,
        opacity: 0.35 + intensity * 0.55,
      });
    }
    return { mapped, missing };
  }, [zones, parentCountry, maxMetric]);

  const center = useMemo<LatLngExpression>(() => {
    if (markers.mapped.length) return markers.mapped[0].position;
    if (parentCountry && GEO_LAT_LNG[parentCountry.toUpperCase()]) return GEO_LAT_LNG[parentCountry.toUpperCase()];
    return [20, 0];
  }, [markers.mapped, parentCountry]);

  const zoom = parentCountry ? (zones.some((item) => item.level === "city") ? 8 : 6) : 2;

  return (
    <>
      <MapContainer
        className="admin-tourism-map__leaflet"
        center={center}
        zoom={zoom}
        minZoom={2}
        maxZoom={12}
        scrollWheelZoom={false}
        worldCopyJump
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {markers.mapped.map((marker) => (
          <CircleMarker
            key={marker.child.key}
            center={marker.position}
            radius={marker.radius}
            pathOptions={{
              color: "#ffffff",
              weight: 1.5,
              fillColor: "#0071e3",
              fillOpacity: marker.opacity,
            }}
            eventHandlers={{
              click: () => onSelect(marker.child),
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1}>
              <strong>{marker.child.label}</strong>
              {` · ${formatNumber(marker.child.metric)} metric · ${formatNumber(marker.child.events)} events`}
            </Tooltip>
            <Popup>
              <div className="admin-tourism-map__popup">
                <strong>{marker.child.label}</strong>
                <span>{formatNumber(marker.child.events)} events</span>
                <span>{formatNumber(marker.child.users)} active users</span>
                <span>{formatNumber(marker.child.place_views)} place views</span>
                <span>{formatNumber(marker.child.route_views)} route views</span>
                <span>{formatNumber(marker.child.intent)} high-intent actions</span>
                <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => onSelect(marker.child)}>
                  View {marker.child.label} →
                </button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="admin-tourism-map__legend">
        <span>Low activity</span>
        <span className="admin-tourism-map__legend-bar" aria-hidden="true" />
        <span>High activity</span>
        {markers.missing.length ? (
          <small>
            {markers.missing.length} zone{markers.missing.length === 1 ? "" : "s"} without map pin (selectable in list)
          </small>
        ) : null}
      </div>
    </>
  );
}
