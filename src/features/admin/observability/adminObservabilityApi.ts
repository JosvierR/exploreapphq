import {
  fetchAdminSystemHealth,
  fetchAdminSystemMetrics,
  fetchApiHealth,
  type AdminHealth,
  type AdminMetricsSnapshot,
  type AdminSystemHealth,
} from "@/lib/moderationAdminApi";

export type { AdminHealth, AdminMetricsSnapshot, AdminSystemHealth };

export function getPublicHealth() {
  return fetchApiHealth();
}

export function getAdminSystemHealth() {
  return fetchAdminSystemHealth();
}

export function getAdminSystemMetrics() {
  return fetchAdminSystemMetrics();
}
