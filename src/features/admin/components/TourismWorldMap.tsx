import { useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatNumber } from "@/lib/analyticsDisplay";

export type TourismMarketPoint = {
  country: string;
  events: number;
  sessions: number;
};

/** Approximate country centroids as [lat, lng] for Leaflet markers. */
const COUNTRY_LAT_LNG: Record<string, [number, number]> = {
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
  HN: [14.1, -86.2],
  NI: [12.9, -85.2],
  SV: [13.8, -88.9],
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
};

type MappedMarket = TourismMarketPoint & {
  position: LatLngExpression;
  radius: number;
  opacity: number;
};

export function resolveMarketMarkers(countries: TourismMarketPoint[]): {
  markers: MappedMarket[];
  missing: string[];
} {
  const maxEvents = Math.max(1, ...countries.map((item) => item.events));
  const markers: MappedMarket[] = [];
  const missing: string[] = [];

  for (const item of countries) {
    const coords = COUNTRY_LAT_LNG[item.country.toUpperCase()];
    if (!coords) {
      missing.push(item.country);
      continue;
    }
    const intensity = item.events / maxEvents;
    markers.push({
      ...item,
      position: coords,
      radius: 8 + intensity * 28,
      opacity: 0.35 + intensity * 0.55,
    });
  }

  return { markers, missing };
}

export function TourismWorldMap({ countries }: { countries: TourismMarketPoint[] }) {
  const { markers, missing } = useMemo(() => resolveMarketMarkers(countries), [countries]);

  const center = useMemo<LatLngExpression>(() => {
    if (!markers.length) return [20, 0];
    const top = [...markers].sort((a, b) => b.events - a.events)[0];
    return top.position;
  }, [markers]);

  const zoom = markers.length === 1 ? 5 : markers.some((item) => item.country === "DO" && item.events > 100) ? 3 : 2;

  return (
    <>
      <MapContainer
        className="admin-tourism-map__leaflet"
        center={center}
        zoom={zoom}
        minZoom={2}
        maxZoom={8}
        scrollWheelZoom={false}
        worldCopyJump
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {markers.map((marker) => (
          <CircleMarker
            key={marker.country}
            center={marker.position}
            radius={marker.radius}
            pathOptions={{
              color: "#ffffff",
              weight: 1.5,
              fillColor: "#0071e3",
              fillOpacity: marker.opacity,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={1}>
              <strong>{marker.country}</strong>
              {` · ${formatNumber(marker.events)} events · ${formatNumber(marker.sessions)} sessions`}
            </Tooltip>
            <Popup>
              <div className="admin-tourism-map__popup">
                <strong>{marker.country}</strong>
                <span>{formatNumber(marker.events)} events</span>
                <span>{formatNumber(marker.sessions)} sessions</span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="admin-tourism-map__legend">
        <span>Low activity</span>
        <span className="admin-tourism-map__legend-bar" aria-hidden="true" />
        <span>High activity</span>
        {missing.length ? (
          <small>
            {missing.length} market{missing.length === 1 ? "" : "s"} without map pin ({missing.join(", ")})
          </small>
        ) : null}
      </div>
    </>
  );
}
