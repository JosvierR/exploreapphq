import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app = null;

function getFirebaseAdminApp() {
  if (!app) {
    app = getApps()[0] ?? null;
  }
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
    }
    const serviceAccount = JSON.parse(raw);
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return app;
}

export function getFirestoreAdmin() {
  return getFirestore(getFirebaseAdminApp());
}

export function getAuthAdmin() {
  return getAuth(getFirebaseAdminApp());
}
