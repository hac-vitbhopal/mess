import admin from "firebase-admin";

function getAdminApp(): admin.app.App | null {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[Firebase Admin] Service account credentials not found. Admin features will be unavailable in local dev until set.", {
      projectId: !!projectId,
      clientEmail: !!clientEmail,
      privateKey: !!privateKey,
    });
    return null;
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (err) {
    console.error("[Firebase Admin] Initialization error:", err);
    return null;
  }
}

const app = getAdminApp();

let firestoreInstance: admin.firestore.Firestore | null = null;
if (app) {
  firestoreInstance = admin.firestore(app);
  try {
    firestoreInstance.settings({ preferRest: true });
  } catch (e) {
    // Ignore duplicate settings application during Vite HMR reloads
  }
}

export const adminDb = firestoreInstance;
export const adminMessaging = app ? admin.messaging(app) : null;
export const adminAuth = app ? admin.auth(app) : null;