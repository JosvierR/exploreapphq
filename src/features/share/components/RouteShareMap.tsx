import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L, { type DivIcon, type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicRoutePreview } from "@/features/share/types";
import {
  budgetLevelSymbol,
  estimateDurationFromDistanceM,
  formatDifficulty,
  formatDistanceMeters,
  formatElevationMeters,
  formatEstimatedDuration,
  formatRating,
  resolveDisplayDistanceM,
} from "@/features/share/lib/formatRoutePreview";
import { T } from "@/components/ui/T";

function MapLifecycle({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    invalidate();
    const t1 = window.setTimeout(invalidate, 80);
    const t2 = window.setTimeout(invalidate, 320);

    const container = map.getContainer();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => invalidate()) : null;
    ro?.observe(container);
    window.addEventListener("orientationchange", invalidate);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro?.disconnect();
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);

  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0] as [number, number], 14);
      return;
    }
    map.fitBounds(positions as [number, number][], {
      paddingTopLeft: [36, 48],
      paddingBottomRight: [36, 150],
      maxZoom: 14,
    });
  }, [map, positions]);

  return null;
}

function stopIcon(index: number, total: number): DivIcon {
  const kind = index === 0 ? "start" : index === total - 1 ? "end" : "mid";
  return L.divIcon({
    className: `route-share-pin route-share-pin--${kind}`,
    html: `<span>${index + 1}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

type RouteShareMapProps = {
  preview: PublicRoutePreview;
};

export function RouteShareMap({ preview }: RouteShareMapProps) {
  const stopsWithGeo = useMemo(
    () =>
      preview.stops.filter((s) => s.lat != null && s.lng != null) as Array<{
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

  const displayDistanceM = resolveDisplayDistanceM(preview.distanceM, preview.stops);
  const distance = formatDistanceMeters(displayDistanceM);
  const duration =
    formatEstimatedDuration(preview.estimatedDuration) || estimateDurationFromDistanceM(displayDistanceM);
  const difficulty = formatDifficulty(preview.difficulty);
  const elevation = formatElevationMeters(preview.elevationGain);
  const rating = formatRating(preview.averageRating, preview.totalRatings);
  const budget = budgetLevelSymbol(preview.budgetLevel);
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
        {preview.coverUrl ? (
          <div className="route-share-map__cover-glow" aria-hidden="true">
            <img src={preview.coverUrl} alt="" />
          </div>
        ) : null}

        <div className="route-share-map__topchip">
          <T k="routeShare.map.live" />
        </div>

        <MapContainer
          className="route-share-map__leaflet"
          center={center}
          zoom={13}
          scrollWheelZoom={false}
          attributionControl={false}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM &copy; CARTO"
          />
          <MapLifecycle positions={positions} />
          {positions.length > 1 ? (
            <Polyline
              positions={positions}
              pathOptions={{
                color: "#009bff",
                weight: 6,
                opacity: 0.92,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          ) : null}
          {stopsWithGeo.map((stop, index) => (
            <Marker key={stop.placeId} position={[stop.lat, stop.lng]} icon={stopIcon(index, stopsWithGeo.length)}>
              <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                <strong>
                  {index + 1}. {stop.name}
                </strong>
              </Tooltip>
              <Popup>
                <strong>
                  {index + 1}. {stop.name}
                </strong>
                {stop.category ? <div className="route-share-stat-cap">{stop.category.replace(/_/g, " ")}</div> : null}
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="route-share-map__hud" aria-label="Route stats">
          <p className="route-share-map__invite">
            <T k="routeShare.map.invite" />
          </p>
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
                <T k="routeShare.stat.budget" />
              </span>
              <strong>{budget}</strong>
            </li>
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
            {elevation ? (
              <li>
                <span>
                  <T k="routeShare.stat.elevation" />
                </span>
                <strong>{elevation}</strong>
              </li>
            ) : null}
            {rating ? (
              <li>
                <span>
                  <T k="routeShare.stat.rating" />
                </span>
                <strong>{rating}</strong>
              </li>
            ) : null}
            {preview.category ? (
              <li>
                <span>
                  <T k="routeShare.stat.category" />
                </span>
                <strong className="route-share-stat-cap">{preview.category.replace(/_/g, " ")}</strong>
              </li>
            ) : null}
          </ul>
          <p className="route-share-map__hud-foot">
            <T k="routeShare.map.foot" />
          </p>
        </div>
      </div>
    </aside>
  );
}
