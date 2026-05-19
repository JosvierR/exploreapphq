/** Comma-separated admin emails in VITE_ADMIN_EMAILS */
export function getAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS ?? "admin@example.com";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
