import { useEffect, useRef, useState } from "react";
import {
  fetchPioneerLanding,
  preferRicherSnapshot,
} from "@/features/pioneers/api/pioneersApi";
import type { PioneerLandingSnapshot } from "@/features/pioneers/types";

type PioneerLandingState = {
  snapshot: PioneerLandingSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

/** Keeps the last trustworthy snapshot across effect remounts and client-side revisits. */
let cachedLandingSnapshot: PioneerLandingSnapshot | null = null;

/**
 * Single owner of pioneers landing data.
 * - Does not seed with ranking rows (avoids fallback→API flash)
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
