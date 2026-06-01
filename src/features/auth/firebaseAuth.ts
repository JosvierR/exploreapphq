import {
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { joinWaitlist, joinWaitlistByEmail } from "@/lib/waitlistSignup";
import { isAdminEmail } from "@/lib/admin";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

export { joinWaitlist, joinWaitlistByEmail };

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

export async function firebaseSignOut() {
  if (isFirebaseConfigured()) {
    await signOut(getFirebaseAuth());
  }
}
