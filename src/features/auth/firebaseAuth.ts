import {
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { apiUrl } from "@/lib/api";
import { isAdminEmail } from "@/lib/admin";
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";

export function mapFirebaseAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Authentication failed. Please try again.";
  }
}

/** Team-only sign-in (use /team — not linked on the public site). */
export async function firebaseAdminSignIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  if (!isAdminEmail(cred.user.email)) {
    await signOut(getFirebaseAuth());
    throw new Error("This account does not have team access.");
  }
  return cred.user;
}

/** Public waitlist: email only, no password, no Auth session for the user. */
export async function joinWaitlistByEmail(email: string): Promise<{ created: boolean }> {
  const normalized = email.trim().toLowerCase();

  let created = true;

  if (isFirebaseConfigured()) {
    const ref = doc(getFirestoreDb(), "waitlist", normalized);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      created = false;
    } else {
      await setDoc(ref, {
        email: normalized,
        createdAt: serverTimestamp(),
      });
    }
  }

  await sendWelcomeEmail(normalized);
  return { created };
}

async function sendWelcomeEmail(email: string) {
  const res = await fetch(apiUrl("/api/waitlist/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not complete your request. Try again later.",
    );
  }
}

export async function firebaseSignOut() {
  if (isFirebaseConfigured()) {
    await signOut(getFirebaseAuth());
  }
}
