import admin from "firebase-admin";

function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // Fallback to VITE_ prefixed keys if running in local dev server
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Sanitize quotes and escaped newline characters from .env files
    privateKey = privateKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error("[Firebase Admin] Missing credentials:", {
      projectId: !!projectId,
      clientEmail: !!clientEmail,
      privateKey: !!privateKey,
    });
    throw new Error("Missing Firebase Admin Service Account credentials in environment variables.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const app = getAdminApp();
const firestore = admin.firestore(app);

// ⚡ SAFE CHECK: Wrap settings() to prevent re-initialization crashes during Vite reloads
try {
  firestore.settings({ preferRest: true });
} catch (e) {
  // Ignore duplicate settings application during Vite HMR reloads
}

export const adminDb = firestore;
export const adminMessaging = admin.messaging(app);