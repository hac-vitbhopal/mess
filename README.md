Here is a comprehensive, production-ready `README.md` for **MessHub**, detailing its architecture, file structure, tech stack, routes, and complete Firebase integration.

---

# 🍽️ MessHub: Campus Dining & Mess Management Companion
 
**MessHub** is a modern, real-time campus dining companion application designed to streamline mess management, live menu tracking, student onboarding, and targeted push notifications. Built for high performance and reliability, it connects students and mess operators seamlessly.

---

## 🚀 Tech Stack

### **Frontend & Core**

* **Framework:** React / TanStack Start (Vite-powered Single Page / SSR application)
* **Language:** TypeScript
* **Styling:** Tailwind CSS & Lucide Icons
* **Build Tool:** Vite (`v8.1.5+`)

### **Backend & Cloud Services**

* **Database & Auth:** Firebase Firestore & Firebase Authentication (Google OAuth)
* **Cloud Messaging:** Firebase Cloud Messaging (FCM) with custom Service Workers (`firebase-messaging-sw.js`) for web push alerts
* **Server Infrastructure:** Vercel Serverless Functions & Server Actions (`"use server"`)
* **Analytics:** Firebase Analytics (`firebase/analytics`)

---

## 📂 Project Architecture & File Structure

```text
campus-dining-companion/
├── public/
│   ├── favicon.ico
│   ├── firebase-messaging-sw.js   # Background web push notification worker
│   ├── manifest.webmanifest       # PWA manifest configurations
│   └── mess_logo.png              # App branding asset
├── src/
│   ├── components/
│   │   └── messhub/
│   │       ├── AddAndMenuModal.tsx  # Modal for adding/updating mess schedules
│   │       ├── NutritionistAdmin.tsx# Nutritionist management panel
│   │       ├── Onboarding.tsx       # Student onboarding flow with email deduplication
│   │       └── StudentHome.tsx      # Live meal countdown and daily menu viewer
│   ├── lib/
│   │   ├── broadcast-action.ts      # Server action for dispatching FCM broadcasts
│   │   ├── error-capture.ts         # Global error logging utilities
│   │   ├── error-page.ts            # Fallback error UI components
│   │   ├── excel-importer.ts        # Bulk student data importer
│   │   ├── firebase.ts              # Client-side Firebase & Analytics initialization
│   │   ├── firebase-admin.ts        # Server-side Firebase Admin SDK setup
│   │   ├── messhub.ts               # Core mess business logic helpers
│   │   ├── register-token-action.ts # Secure FCM device token registration
│   │   ├── security.ts              # Input sanitization and role verification
│   │   └── utils.ts                 # General utility functions
│   ├── routes/
│   │   ├── api/
│   │   │   └── send-broadcast.api.ts# Backend API endpoint for broadcast triggers
│   │   ├── __root.tsx               # Root application layout wrapper
│   │   ├── add-mess.tsx             # Mess registration route
│   │   ├── admin.tsx                # Operator dashboard for menu & meal control
│   │   ├── AdminNotifications.tsx   # Broadcast push notification control center
│   │   ├── DishFeedbackViewer.tsx   # Student feedback & dish rating viewer
│   │   ├── index.tsx                # Main student dashboard (Live meal tracking)
│   │   ├── nutritionist.tsx         # Nutritionist management portal
│   │   ├── privacy.tsx              # Privacy policy & data usage page
│   │   └── super-admin.tsx          # System-wide super admin oversight
│   ├── router.tsx                   # Application routing configuration
│   └── routeTree.gen.ts             # Auto-generated route tree definitions
├── .env                             # Local environment variables
├── package.json
├── tsconfig.json
└── vite.config.ts

```

---

## 🗺️ Application Routes & What They Do

| Route | File Path | Description |
| --- | --- | --- |
| **`/`** | `src/routes/index.tsx` | **Student Home Dashboard:** Displays live meal status, real-time countdown timers to service hours, and today's menu selections.

 |
| **`/admin`** | `src/routes/admin.tsx` | **Operator Dashboard:** Allows mess managers to update daily menus, manage operations, and view real-time data. |
| **`/AdminNotifications`** | `src/routes/AdminNotifications.tsx` | **Broadcast Panel:** Operators use this interface to trigger push notifications to specific messes or all campus users. |
| **`/DishFeedbackViewer`** | `src/routes/DishFeedbackViewer.tsx` | **Feedback Portal:** Aggregates student ratings and reviews for individual food items. |
| **`/nutritionist`** | `src/routes/nutritionist.tsx` | **Nutritionist Portal:** Dedicated view for reviewing meal nutritional profiles and dietary planning. |
| **`/super-admin`** | `src/routes/super-admin.tsx` | **Super Admin Hub:** System-level access for managing multiple messes and global configurations. |
| **`/privacy`** | `src/routes/privacy.tsx` | **Privacy Policy:** Compliance document outlining user data protection practices. |

---

## 🔥 Firebase Implementation Details

MessHub utilizes a dual-tier Firebase architecture separating client-side browser behavior from privileged server-side administrative tasks.

### 1. Client-Side Firebase (`src/lib/firebase.ts`)

* Initializes Firebase App using environment variables prefixed with `VITE_`.
* Configures **Firestore** for real-time data synchronization.
* Configures **Firebase Authentication** with Google Provider.
* Initializes **Firebase Analytics** to track active student engagement metrics.

### 2. Server-Side Firebase Admin (`src/lib/firebase-admin.ts`)

* Uses non-prefixed server credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) to safely initialize the Admin SDK.
* Powers secure server actions without exposing private keys to the client browser.

### 3. Key Firebase Features Built into MessHub:

* **Anti-Duplicate Student Directory (`setDoc` Architecture):**
Student onboarding leverages email-based document IDs (`setDoc`) instead of auto-generated IDs (`addDoc`), completely eliminating duplicate directory entries during repeat sign-ins or onboarding updates.
* **Smart Push Notifications & Dynamic Menu Fallbacks:**
* Background web pushes are handled via `public/firebase-messaging-sw.js`.
* The server-side broadcast action (`broadcast-action.ts`) queries Firestore menus dynamically—if a broadcast title lacks a specific message body, it automatically pulls today's menu items (e.g., Breakfast, Lunch, Snacks, Dinner) to populate push notifications dynamically.


* **Device Token Lifecycle Management:**
* FCM tokens are stored per device/browser session using the token string as the Firestore document ID (`.doc(token)`), preventing multi-device cross-talk or duplicate pushes.
* Automatically purges invalid or expired FCM tokens (`messaging/registration-token-not-registered`) during broadcast sweeps.



---

## 🔐 Environment Variable Management

MessHub strictly segregates environment variables into client and server domains:

### **Frontend / Client Variables (Required by Vite)**

Must begin with `VITE_` to be bundled into the browser:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=messmenu-a387b
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-645NRPY6QT
VITE_FIREBASE_VAPID_KEY=your_vapid_key

```

### **Backend / Admin Variables (Server-Side Only)**

Must remain un-prefixed for Vercel Serverless & Firebase Admin SDK:

```env
FIREBASE_PROJECT_ID=messmenu-a387b
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@messmenu-a387b.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

```

---

## 🚀 Getting Started & Local Development

1. **Clone the Repository:**
```bash
git clone https://github.com/your-username/campus-dining-companion.git
cd campus-dining-companion

```


2. **Install Dependencies:**
```bash
npm install

```


3. **Configure Environment Variables:**
Create a `.env` file in the root directory and populate your client and server variables as shown above.
4. **Run the Development Server:**
```bash
npm run dev

```


5. **Build for Production:**
```bash
npm run build

```
