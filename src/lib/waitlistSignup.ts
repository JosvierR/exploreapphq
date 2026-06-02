import { apiUrl } from "@/lib/api";

const WAITLIST_PATHS = [
  "/.netlify/functions/waitlist-signup",
  "/api/waitlist/signup",
] as const;

export type WaitlistInput = {
  phone?: string;
  email?: string;
};

export type JoinWaitlistResult = {
  created: boolean;
  welcomeSmsSent?: boolean;
  alreadyWelcomed?: boolean;
  smsError?: string | null;
  smsConfigured?: boolean;
};

async function postWaitlistSignup(payload: WaitlistInput): Promise<JoinWaitlistResult> {
  let lastError = "Could not reach the signup service. Try again in a moment.";

  for (const path of WAITLIST_PATHS) {
    const url = path.startsWith("/.") ? path : apiUrl(path);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        lastError =
          "Signup API returned an invalid response. Redeploy Netlify or check Functions → waitlist-signup.";
        continue;
      }

      const data = (await res.json()) as {
        error?: string;
        created?: boolean;
        welcomeSmsSent?: boolean;
        alreadyWelcomed?: boolean;
        smsError?: string | null;
        smsConfigured?: boolean;
      };

      if (res.ok) {
        return {
          created: data.created !== false,
          welcomeSmsSent: data.welcomeSmsSent === true,
          alreadyWelcomed: data.alreadyWelcomed === true,
          smsError: data.smsError ?? null,
          smsConfigured: data.smsConfigured === true,
        };
      }
      lastError = data.error ?? lastError;
    } catch (err) {
      if (err instanceof Error) lastError = err.message;
    }
  }

  throw new Error(lastError);
}

/**
 * Join waitlist via Netlify function (Firestore admin + Resend + Twilio).
 * Client does not write Firestore — avoids permission errors and duplicate docs.
 */
export async function joinWaitlist(input: WaitlistInput): Promise<JoinWaitlistResult> {
  const phone = input.phone?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!phone) {
    throw new Error("A valid phone number is required.");
  }

  return postWaitlistSignup({ phone, email });
}

/** @deprecated legacy email-only entry point */
export async function joinWaitlistByEmail(email: string): Promise<JoinWaitlistResult> {
  return postWaitlistSignup({ email: email.trim().toLowerCase() });
}
