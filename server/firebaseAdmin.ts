import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | null = null;

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

function getFirebaseAdminApp(): App {
  if (!app) {
    app = getApps()[0] ?? null;
  }
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
    app = initializeApp({
      credential: cert(JSON.parse(raw) as ServiceAccount),
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
