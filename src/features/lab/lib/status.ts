import type { FeedbackCategory, FeedbackStatus, LabTab } from "../types";

/** Interview-style pipeline labels (EN). ES via i18n on UI. */
export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  listening: "Submitted",
  considering: "Under review",
  planned: "Shortlisted",
  building: "Building",
  shipped: "Shipped",
  not_now: "Not moving forward",
};

export const STATUS_LABELS_ES: Record<FeedbackStatus, string> = {
  listening: "Enviado",
  considering: "En revisión",
  planned: "Preseleccionado",
  building: "En construcción",
  shipped: "Lanzado",
  not_now: "No seguimos",
};

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  discover: "Discover",
  places: "Places",
  routes: "Routes",
  community: "Community",
  ai: "AI",
  profile: "Profile",
  events: "Events",
  other: "Other",
};

export const CATEGORY_LABELS_ES: Record<FeedbackCategory, string> = {
  discover: "Descubrir",
  places: "Lugares",
  routes: "Rutas",
  community: "Comunidad",
  ai: "IA",
  profile: "Perfil",
  events: "Eventos",
  other: "Otro",
};

export const LAB_TABS: { id: LabTab; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "newest", label: "Newest" },
];

/** Public pipeline stages after Accept (like an interview process). */
export const PIPELINE_STEPS: FeedbackStatus[] = [
  "listening",
  "considering",
  "planned",
  "building",
  "shipped",
];

export const PROGRESS_STEPS = PIPELINE_STEPS;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
