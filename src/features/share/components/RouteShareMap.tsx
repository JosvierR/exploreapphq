import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicRoutePreview } from "@/features/share/types";
import {
  formatDifficulty,
  formatDistanceMeters,
  formatEstimatedDuration,
} from "@/features/share/lib/formatRoutePreview";
import { T } from "@/components/ui/T";

function FitStops({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0] as [number, number], 14);
      return;
    }
    map.fitBounds(positions as [number, number][], { padding: [36, 36], maxZoom: 15 });
  }, [map, positions]);
  return null;
}

type RouteShareMapProps = {
  preview: PublicRoutePreview;
};

export function RouteShareMap({ preview }: RouteShareMapProps) {
  const stopsWithGeo = useMemo(
    () => preview.stops.filter((s) => s.lat != null && s.lng != null) as Array<{
      position: number;
      placeId: string;
      name: string;
      category: string | null;
      photoUrl: string | null;
      lat: number;
      lng: number;
    }>,
    [preview.stops],
  );

  const positions = useMemo<LatLngExpression[]>(
    () => stopsWithGeo.map((s) => [s.lat, s.lng]),
    [stopsWithGeo],
  );

  const distance = formatDistanceMeters(preview.distanceM);
  const duration = formatEstimatedDuration(preview.estimatedDuration);
  const difficulty = formatDifficulty(preview.difficulty);
  const center: LatLngExpression = positions[0] ?? [18.4861, -69.9312];

  if (positions.length === 0) {
    return (
      <aside className="route-share-map route-share-map--empty" aria-label="Route map">
        <div className="route-share-map__empty">
          <p>
            <T k="routeShare.map.empty" />
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="route-share-map" aria-label="Route map">
      <div className="route-share-map__frame">
        <MapContainer
          className="route-share-map__leaflet"
          center={center}
          zoom={13}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO'
          />
          <FitStops positions={positions} />
          {positions.length > 1 ? (
            <Polyline positions={positions} pathOptions={{ color: "#009bff", weight: 4, opacity: 0.85 }} />
          ) : null}
          {stopsWithGeo.map((stop, index) => (
            <CircleMarker
              key={stop.placeId}
              center={[stop.lat, stop.lng]}
              radius={index === 0 || index === stopsWithGeo.length - 1 ? 11 : 8}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: index === 0 ? "#5ac8fa" : index === stopsWithGeo.length - 1 ? "#009bff" : "#3d8fd1",
                fillOpacity: 1,
              }}
            >
              <Popup>
                <strong>
                  {index + 1}. {stop.name}
                </strong>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="route-share-map__hud" aria-label="Route stats">
          <div className="route-share-map__hud-title">{preview.name}</div>
          <ul>
            {distance ? (
              <li>
                <span>
                  <T k="routeShare.stat.distance" />
                </span>
                <strong>{distance}</strong>
              </li>
            ) : null}
            {duration ? (
              <li>
                <span>
                  <T k="routeShare.stat.duration" />
                </span>
                <strong>{duration}</strong>
              </li>
            ) : null}
            <li>
              <span>
                <T k="routeShare.stat.stops" />
              </span>
              <strong>{preview.stops.length}</strong>
            </li>
            {difficulty ? (
              <li>
                <span>
                  <T k="routeShare.stat.difficulty" />
                </span>
                <strong className="route-share-stat-cap">{difficulty}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </aside>
  );
}
