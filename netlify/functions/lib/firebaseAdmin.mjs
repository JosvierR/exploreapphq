import admin from "firebase-admin";

let initialized = false;

export function getFirestoreAdmin() {
  if (!initialized) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
    }
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
  }
  return admin.firestore();
}

export function getAuthAdmin() {
  getFirestoreAdmin();
  return admin.auth();
}
