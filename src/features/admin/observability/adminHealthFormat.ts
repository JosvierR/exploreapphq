export type HealthTone = "green" | "amber" | "red" | "slate";

export function configuredLabel(value?: boolean) {
  if (value === undefined) return "Not available";
  return value ? "Configured" : "Not configured";
}

export function healthStatusLabel(value?: string | boolean) {
  if (value === true || value === "ok") return "Healthy";
  if (value === false) return "Not configured";
  if (value === "warning") return "Needs attention";
  if (!value) return "Not available";
  return String(value);
}

export function healthTone(value?: string | boolean): HealthTone {
  if (value === true || value === "ok") return "green";
  if (value === "warning" || value === false) return "amber";
  if (!value) return "slate";
  return String(value).toLowerCase().includes("error") ? "red" : "slate";
}

export function formatVersion(value?: string) {
  if (!value || value === "unknown") return "Not available";
  return value.length > 12 ? value.slice(0, 12) : value;
}
