export type AccessResponse =
  | { access: "password_required" }
  | { access: "full"; token: string }
  | { access: "waitlist"; created: boolean; message: string };

export async function requestAccess(email: string, password?: string): Promise<AccessResponse> {
  const res = await fetch("/api/access", {
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
