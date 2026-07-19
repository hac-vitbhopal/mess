// import { createFileRoute } from '@tanstack/react-router'
// import { getApps, initializeApp, cert } from 'firebase-admin/app'
// import { getMessaging } from 'firebase-admin/messaging'

// // Initialize Firebase Admin securely so it doesn't initialize twice across server reloads
// if (getApps().length === 0) {
//   initializeApp({
//     credential: cert({
//       projectId: "messmenu-a387b",
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
//       privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
//     }),
//   });
// }

// export const Route = createFileRoute('/api/-send-broadcast' as any)({
//   server: {
//     handlers: {
//       POST: async ({ request }) => {
//         try {
//           const { topic, title, body } = await request.json() as {
//             topic: string;
//             title: string;
//             body: string;
//           };

//           // ⚡ FIX: Move 'title' and 'body' flat inside the data payload object.
//           // This stops the browser from automatically intercepting and dropping the message.
//           const message = {
//             data: {
//               title: title,
//               body: body,
//               url: "/",
//               tag: "meal-alert",
//             },
//             topic: topic,
//           };

//           // Forces the push payload through FCM straight into the device notification tray
//           const response = await getMessaging().send(message);

//           return new Response(JSON.stringify({ success: true, messageId: response }), {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//           });
//         } catch (error: any) {
//           console.error("FCM Background Broadcast Error:", error);
//           return new Response(JSON.stringify({ error: error.message }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' },
//           });
//         }
//       },
//     },
//   },
// })