import { useEffect, useRef, useState } from "react";
import { fetchPioneerLanding } from "@/features/pioneers/api/pioneersApi";
import type { PioneerLandingSnapshot } from "@/features/pioneers/types";

type PioneerLandingState = {
  snapshot: PioneerLandingSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

/**
 * Single owner of pioneers landing data.
 * - Does not seed with mock (avoids mock→API flash)
 * - Keeps previous snapshot while a refresh is in flight
 * - Aborts in-flight requests on unmount / StrictMode remount
 */
export function usePioneerLanding(): PioneerLandingState {
  const [snapshot, setSnapshot] = useState<PioneerLandingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSnapshotRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    setError(null);
    if (hasSnapshotRef.current) setRefreshing(true);
    else setLoading(true);

    void fetchPioneerLanding({ range: "7d", category: "total" }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        hasSnapshotRef.current = true;
        setSnapshot(data);
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
