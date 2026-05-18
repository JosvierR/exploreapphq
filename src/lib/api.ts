/** Empty = same origin (Netlify proxy /api → API host). Set VITE_API_URL if API is on another domain without proxy. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type AccessResponse =
  | { access: "password_required" }
  | { access: "full"; token: string }
  | { access: "waitlist"; created: boolean; message: string };

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export async function requestAccess(email: string, password?: string): Promise<AccessResponse> {
  const res = await fetch(apiUrl("/api/access"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data as AccessResponse;
}
