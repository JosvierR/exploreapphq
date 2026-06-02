import { useEffect, useRef, useState } from "react";
import { loadCannySdk, renderCannyBoard } from "@/lib/canny";

type Props = {
  boardToken: string;
  portalUrl?: string;
};

export function CannyBoard({ boardToken, portalUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadCannySdk();
        if (cancelled) return;
        renderCannyBoard({
          boardToken,
          basePath: "/feedback",
          theme: "dark",
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load feedback board.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [boardToken]);

  return (
    <div className="feedback-embed">
      {error && (
        <p className="access-error" role="alert">
          {error}
          {portalUrl && (
            <>
              {" "}
              <a href={portalUrl} target="_blank" rel="noreferrer">
                Open board in a new tab
              </a>
            </>
          )}
        </p>
      )}
      <div ref={containerRef} data-canny className="feedback-canny" />
      {portalUrl && (
        <p className="feedback-fallback">
          Prefer full screen?{" "}
          <a href={portalUrl} target="_blank" rel="noreferrer">
            Open {portalUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
      )}
    </div>
  );
}
