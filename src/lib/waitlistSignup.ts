import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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

async function postWaitlistSignup(
  payload: WaitlistInput,
  options?: { optional?: boolean },
): Promise<{ created: boolean }> {
  let lastError = "Could not complete signup. Please try again.";

  for (const path of WAITLIST_PATHS) {
    const url = path.startsWith("/.") ? path : apiUrl(path);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: boolean;
      };
      if (res.ok) {
        return { created: data.created !== false };
      }
      lastError = data.error ?? lastError;
    } catch {
      /* try next endpoint */
    }
  }

  if (options?.optional) {
    console.warn("[waitlist] server backup failed:", lastError);
    return { created: true };
  }

  throw new Error(lastError);
}

async function saveToFirestore(input: Required<Pick<WaitlistInput, "phone">> & WaitlistInput) {
  const id = phoneDocId(input.phone);
  const ref = doc(getFirestoreDb(), "waitlist", id);
  const existing = await getDoc(ref);
  if (existing.exists()) return false;
  await setDoc(ref, {
    phone: input.phone,
    email: input.email ?? "",
    createdAt: serverTimestamp(),
    source: "web",
    consentSms: true,
    seqStep: 0,
  });
  return true;
}

/** Join the waitlist with a phone (primary) and optional email. */
export async function joinWaitlist(input: WaitlistInput): Promise<{ created: boolean }> {
  const phone = input.phone?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!phone) {
    throw new Error("A valid phone number is required.");
  }

  let created = true;
  let savedInFirestore = false;

  if (isFirebaseConfigured()) {
    try {
      created = await saveToFirestore({ phone, email });
      savedInFirestore = true;
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "permission-denied") {
        console.warn("[waitlist] Firestore rules blocked write — using server backup");
      } else {
        throw err;
      }
    }
  }

  if (isFirebaseConfigured() && savedInFirestore && !created) {
    // Already on the list — still ping server so a newly-added email/SMS goes out.
    await postWaitlistSignup({ phone, email }, { optional: true });
    return { created: false };
  }

  // New signups must reach the server (Twilio SMS + Resend). Only skip hard-fail on retry when already on the list.
  const server = await postWaitlistSignup(
    { phone, email },
    { optional: savedInFirestore && !created },
  );
  return { created: savedInFirestore ? created : server.created };
}

/** @deprecated legacy email-only entry point kept for compatibility. */
export async function joinWaitlistByEmail(email: string): Promise<{ created: boolean }> {
  return postWaitlistSignup({ email: email.trim().toLowerCase() });
}
