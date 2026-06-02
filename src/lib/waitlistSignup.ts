import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { apiUrl } from "@/lib/api";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { phoneDocId } from "@/lib/phone";

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
  smsError?: string | null;
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
        smsError?: string | null;
        smsConfigured?: boolean;
      };

      if (res.ok) {
        return {
          created: data.created !== false,
          welcomeSmsSent: data.welcomeSmsSent === true,
          smsError: data.smsError ?? null,
        };
      }
      lastError = data.error ?? lastError;
    } catch (err) {
      if (err instanceof Error) lastError = err.message;
    }
  }

  throw new Error(lastError);
}

/** Mirror server data in Firestore for admin panel (merge, never blocks SMS). */
async function mirrorToFirestoreClient(input: Required<Pick<WaitlistInput, "phone">> & WaitlistInput) {
  const ref = doc(getFirestoreDb(), "waitlist", phoneDocId(input.phone));
  await setDoc(
    ref,
    {
      phone: input.phone,
      email: input.email ?? "",
      source: "web",
      consentSms: true,
      seqStep: 0,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Join waitlist: server first (Twilio SMS + Resend + Firestore admin),
 * then optional client mirror for /admin UI.
 */
export async function joinWaitlist(input: WaitlistInput): Promise<JoinWaitlistResult> {
  const phone = input.phone?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!phone) {
    throw new Error("A valid phone number is required.");
  }

  const server = await postWaitlistSignup({ phone, email });

  if (isFirebaseConfigured()) {
    try {
      await mirrorToFirestoreClient({ phone, email });
    } catch (err) {
      console.warn("[waitlist] Firestore mirror failed:", err);
    }
  }

  return server;
}

/** @deprecated legacy email-only entry point */
export async function joinWaitlistByEmail(email: string): Promise<JoinWaitlistResult> {
  return postWaitlistSignup({ email: email.trim().toLowerCase() });
}
