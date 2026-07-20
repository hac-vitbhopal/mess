import admin from "firebase-admin";

function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("[Firebase Admin] Missing required environment variables on Vercel.");
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

// Initialize Firestore
const firestore = admin.firestore(app);

// Enable REST fallback settings to prevent gRPC constructor crashes on Vercel
firestore.settings({ preferRest: true });

export const adminDb = firestore;
export const adminMessaging = admin.messaging(app);