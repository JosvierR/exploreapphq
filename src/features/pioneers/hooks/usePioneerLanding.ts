import { useEffect, useState } from "react";
import { fetchPioneerLanding, getPioneerLandingSnapshot } from "@/features/pioneers/api/pioneersApi";
import type { PioneerLandingSnapshot } from "@/features/pioneers/types";

export function usePioneerLanding() {
  const [snapshot, setSnapshot] = useState<PioneerLandingSnapshot>(() => getPioneerLandingSnapshot());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchPioneerLanding({ range: "7d", category: "total" })
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { snapshot, loading };
}
