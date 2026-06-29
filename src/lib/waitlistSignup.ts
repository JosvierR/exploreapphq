import { apiUrl } from "@/lib/api";

const WAITLIST_PATH = "/api/waitlist/signup";

export type WaitlistInput = {
  phone?: string;
  email?: string;
};

export type JoinWaitlistResult = {
  created: boolean;
  addedEmail?: boolean;
  welcomeEmailSent?: boolean;
  emailAlreadySent?: boolean;
  emailError?: string | null;
  welcomeSmsSent?: boolean;
  alreadyWelcomed?: boolean;
  smsError?: string | null;
  smsConfigured?: boolean;
};

async function postWaitlistSignup(payload: WaitlistInput): Promise<JoinWaitlistResult> {
  const url = apiUrl(WAITLIST_PATH);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        "Signup API returned an invalid response. Redeploy or check server logs for waitlist-signup.",
      );
    }

    const data = (await res.json()) as {
      error?: string;
      created?: boolean;
      addedEmail?: boolean;
      welcomeEmailSent?: boolean;
      emailAlreadySent?: boolean;
      emailError?: string | null;
      welcomeSmsSent?: boolean;
      alreadyWelcomed?: boolean;
      smsError?: string | null;
      smsConfigured?: boolean;
    };

    if (res.ok) {
      return {
        created: data.created !== false,
        addedEmail: data.addedEmail === true,
        welcomeEmailSent: data.welcomeEmailSent === true,
        emailAlreadySent: data.emailAlreadySent === true,
        emailError: data.emailError ?? null,
        welcomeSmsSent: data.welcomeSmsSent === true,
        alreadyWelcomed: data.alreadyWelcomed === true,
        smsError: data.smsError ?? null,
        smsConfigured: data.smsConfigured === true,
      };
    }
    throw new Error(data.error ?? "Could not reach the signup service. Try again in a moment.");
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Could not reach the signup service. Try again in a moment.");
  }
}

/**
 * Join waitlist via server API (Firestore admin + Resend + Twilio).
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
