import { useEffect, useRef, useState } from "react";
import { fetchPioneerLanding } from "@/features/pioneers/api/pioneersApi";
import type { PioneerLandingSnapshot } from "@/features/pioneers/types";

type PioneerLandingState = {
  snapshot: PioneerLandingSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

/** Survives StrictMode remount so a second empty response cannot wipe a good first paint. */
let cachedLandingSnapshot: PioneerLandingSnapshot | null = null;

function rankingWeight(snapshot: PioneerLandingSnapshot): number {
  return (
    snapshot.leaderboardUsers.length +
    snapshot.topVideos.length +
    snapshot.topPlaces.length +
    snapshot.topRoutes.length
  );
}

/**
 * Prefer non-empty ranking lists. An API response can be ok:true with [] when
 * Supabase briefly fails inside fetchSince — never let that erase a good snapshot.
 */
function preferRicherSnapshot(
  previous: PioneerLandingSnapshot | null,
  next: PioneerLandingSnapshot,
): PioneerLandingSnapshot {
  if (!previous || rankingWeight(previous) === 0) return next;
  if (rankingWeight(next) === 0) {
    return {
      ...next,
      leaderboardUsers: previous.leaderboardUsers,
      topVideos: previous.topVideos,
      topPlaces: previous.topPlaces,
      topRoutes: previous.topRoutes,
      stats: {
        ...next.stats,
        placesThisWeek: Math.max(next.stats.placesThisWeek, previous.stats.placesThisWeek),
        routesThisWeek: Math.max(next.stats.routesThisWeek, previous.stats.routesThisWeek),
        videosThisWeek: Math.max(next.stats.videosThisWeek, previous.stats.videosThisWeek),
        activePioneers: Math.max(next.stats.activePioneers, previous.stats.activePioneers),
      },
      warnings: [
        ...(next.warnings ?? []),
        "Kept previous ranking snapshot because the latest response had empty lists.",
      ],
    };
  }

  return {
    ...next,
    leaderboardUsers: next.leaderboardUsers.length ? next.leaderboardUsers : previous.leaderboardUsers,
    topVideos: next.topVideos.length ? next.topVideos : previous.topVideos,
    topPlaces: next.topPlaces.length ? next.topPlaces : previous.topPlaces,
    topRoutes: next.topRoutes.length ? next.topRoutes : previous.topRoutes,
  };
}

/**
 * Single owner of pioneers landing data.
 * - Does not seed with mock (avoids mock→API flash)
 * - Keeps previous / cached snapshot across StrictMode remount and empty API responses
 * - Aborts in-flight requests on unmount / StrictMode remount
 */
export function usePioneerLanding(): PioneerLandingState {
  const [snapshot, setSnapshot] = useState<PioneerLandingSnapshot | null>(
    () => cachedLandingSnapshot,
  );
  const [loading, setLoading] = useState(() => !cachedLandingSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSnapshotRef = useRef(Boolean(cachedLandingSnapshot));
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    setError(null);
    if (hasSnapshotRef.current || cachedLandingSnapshot) setRefreshing(true);
    else setLoading(true);

    void fetchPioneerLanding({ range: "7d", category: "total" }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        const merged = preferRicherSnapshot(cachedLandingSnapshot, data);
        cachedLandingSnapshot = merged;
        hasSnapshotRef.current = true;
        setSnapshot(merged);
      })
      .catch((err) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        // Abort is expected under StrictMode; ignore it.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load pioneers landing.");
      })
      .finally(() => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return {
    snapshot,
    loading,
    refreshing,
    error,
  };
}
