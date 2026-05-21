import admin from "firebase-admin";

let ready = false;

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

export function getFirestoreAdmin() {
  if (!ready) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw) as admin.ServiceAccount),
    });
    ready = true;
  }
  return admin.firestore();
}

export function getAuthAdmin() {
  getFirestoreAdmin();
  return admin.auth();
}
