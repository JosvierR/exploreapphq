import { HARDCODED_ADMIN_EMAIL } from "@/lib/hardcodedAdmin";

/** Comma-separated admin emails in VITE_ADMIN_EMAILS */
export function getAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS ?? "admin@example.com";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([HARDCODED_ADMIN_EMAIL, ...fromEnv])];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
