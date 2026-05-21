import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { apiUrl } from "@/lib/api";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";

const WAITLIST_PATHS = [
  "/.netlify/functions/waitlist-signup",
  "/api/waitlist/signup",
] as const;

async function postWaitlistSignup(
  email: string,
  options?: { optional?: boolean },
): Promise<{ created: boolean }> {
  let lastError = "Could not complete signup. Please try again.";

  for (const path of WAITLIST_PATHS) {
    const url = path.startsWith("/.") ? path : apiUrl(path);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

async function saveToFirestore(email: string): Promise<boolean> {
  const ref = doc(getFirestoreDb(), "waitlist", email);
  const existing = await getDoc(ref);
  if (existing.exists()) return false;
  await setDoc(ref, {
    email,
    createdAt: serverTimestamp(),
  });
  return true;
}

/** Join waitlist: Firestore (if configured) + Netlify Function / API for storage + email. */
export async function joinWaitlistByEmail(email: string): Promise<{ created: boolean }> {
  const normalized = email.trim().toLowerCase();
  let created = true;
  let savedInFirestore = false;

  if (isFirebaseConfigured()) {
    try {
      created = await saveToFirestore(normalized);
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

  if (isFirebaseConfigured() && !created) {
    return { created: false };
  }

  const server = await postWaitlistSignup(normalized, {
    optional: savedInFirestore,
  });
  return { created: isFirebaseConfigured() ? created : server.created };
}
