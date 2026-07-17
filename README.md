# MessHub — Campus Dining Companion

MessHub is a lightweight, installable PWA that answers one question:
**"What's being served right now, and when is the next meal?"**

## Roles
- **Student** — sees today's menu, live meal timeline, broadcasts; submits complaints.
- **Mess admin** — manages menus, broadcasts, and complaints for one mess.
- **Super admin** — platform-wide overview across all messes.

## Stack
- TanStack Start (React 19, Vite 7) · TypeScript · Tailwind CSS v4 · shadcn/ui · Zod
- Firebase (Cloud Firestore + Cloud Messaging) — **scaffolded, not connected**

## Firebase setup
Create `.env.local`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```
Then `bun add firebase` and wire the commented sections in `src/lib/firebase.ts`.

Recommended Firestore collections: `students`, `admins`, `messes`, `dailyMenus`, `weeklyMenus`, `broadcasts`, `complaints`, `notifications`, `analytics`.

FCM topics per mess: `crcl`, `jmb`, `mayuri_boys`, `mayuri_girls`, `safal`, `ab_catering`.

## Run
```
bun install
bun run dev
```
