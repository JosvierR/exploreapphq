/** Dev / team bypass — matches netlify/functions/lib/verifyAdmin.mjs */
export const HARDCODED_ADMIN_EMAIL = "admin@example.com";
export const HARDCODED_ADMIN_PASSWORD = "Admin";

const SESSION_KEY = "explore-hardcoded-admin";

export function hardcodedAdminToken(): string {
  return `hc_${btoa(`${HARDCODED_ADMIN_EMAIL}:${HARDCODED_ADMIN_PASSWORD}`)}`;
}

export function isHardcodedAdminCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === HARDCODED_ADMIN_EMAIL &&
    password === HARDCODED_ADMIN_PASSWORD
  );
}

export function getHardcodedAdminSession(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw === HARDCODED_ADMIN_EMAIL ? raw : null;
  } catch {
    return null;
  }
}

export function setHardcodedAdminSession(): void {
  sessionStorage.setItem(SESSION_KEY, HARDCODED_ADMIN_EMAIL);
  window.dispatchEvent(new Event("explore-admin-session"));
}

export function clearHardcodedAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("explore-admin-session"));
}
