import { useMemo } from "react";

type AdminClientEvent =
  | "admin_page_load_error"
  | "admin_api_call_failed"
  | "moderation_action_failed"
  | "health_check_failed";

type AdminClientEventMeta = {
  requestId?: string;
  status?: number;
  route?: string;
  section?: string;
  action?: string;
};

function safeMeta(meta: AdminClientEventMeta = {}) {
  return {
    requestId: meta.requestId,
    status: meta.status,
    route: meta.route,
    section: meta.section,
    action: meta.action,
  };
}

export function reportAdminClientEvent(event: AdminClientEvent, meta: AdminClientEventMeta = {}) {
  const payload = {
    event,
    ...safeMeta(meta),
    timestamp: new Date().toISOString(),
  };

  if (import.meta.env.DEV) {
    console.info("[admin-observability]", payload);
  }

  return payload;
}

export function useAdminObservability() {
  return useMemo(
    () => ({
      report: reportAdminClientEvent,
    }),
    [],
  );
}
