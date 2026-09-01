type LabEvent =
  | "explore_lab_view"
  | "feedback_idea_view"
  | "feedback_idea_created"
  | "feedback_idea_boosted"
  | "feedback_idea_unboosted"
  | "feedback_comment_created"
  | "feedback_filter_changed"
  | "feedback_search"
  | "feedback_roadmap_view"
  | "feedback_team_response_view";

export function trackLab(event: LabEvent, metadata: Record<string, string | number | boolean | null | undefined> = {}) {
  if (typeof window === "undefined") return;
  const payload = {
    event,
    ...metadata,
    ts: Date.now(),
  };
  // Prefer existing analytics if present; otherwise console in dev.
  const w = window as Window & { exploreAnalytics?: { track?: (e: string, m?: object) => void } };
  if (w.exploreAnalytics?.track) {
    w.exploreAnalytics.track(event, metadata);
    return;
  }
  if (import.meta.env.DEV) {
    console.debug("[explore-lab]", payload);
  }
}
