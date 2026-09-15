# MessHub — Campus Dining Companion 🍽️

MessHub is a lightweight, high-performance, and installable Progressive Web Application (PWA) built specifically for campus dining management. It solves a single, essential daily question for students: **"What's being served right now, and when is the next meal?"**

Created exclusively for **VIT Bhopal University**, MessHub streamlines campus dining operations with real-time menu tracking, targeted push notifications, role-based operator portals, and a robust security architecture.

---

## 🌟 Key Features & Roles

* **Student Portal** — Live meal status countdowns, multi-select dish ratings, instant access to daily/weekly menus, macro & micro-nutritional breakdowns ("Know More" drawer), broadcast announcements, and a fully integrated complaint & feedback logging system.
* **Mess Admin Console** — Facility-specific dashboard to manage daily menus, publish real-time overrides, monitor student feedback, and dispatch targeted announcements.
* **Nutritionist Studio** — Master platform for managing nutritional profiles, macro-caloric values, 12 essential micronutrients, and regional/cultural food descriptions across all campus messes.
* **Super Admin Overview** — Platform-wide visibility and monitoring across all campus dining facilities.

---

## 🛠️ Technology Stack

* **Framework & Routing:** TanStack Start (React 19, Vite 7, SSR-ready)
* **Language:** TypeScript
* **Styling:** Tailwind CSS v4, shadcn/ui components
* **Validation & Security:** Zod schema validation, DOMPurify
* **Backend & Database:** Google Firebase (Cloud Firestore + Cloud Messaging / FCM)
* **Logging Pipeline:** Google Apps Script Web App integrated directly with Google Sheets for audit logging and admin email alerts.

---

## 🔒 Enterprise-Grade Security Implementation

MessHub has undergone a rigorous, comprehensive security audit and systematic remediation process. The platform is fortified with the following production-grade protections:

1. **Passkey Isolation & Environment Hardening:** All plain-text passkeys have been completely purged from frontend bundles. Credentials are strictly isolated within secure server environment variables.
2. **Secure Session Management & Tab Locking:** Operator and nutritionist sessions have migrated from persistent `localStorage` to **`sessionStorage`** with transient tab-locking mechanics and automatic 8-hour timestamp expiration.
3. **Server-Function & FCM Push Security:** Server actions (`createServerFn`) enforce strict Zod input bounding, length caps, and URL schema sanitization (`/` or `https://` only) to block open-redirect phishing primitives.
4. **Domain-Restricted Onboarding & Token Binding:** Registration actions strictly validate user identities, enforcing mandatory `@vitbhopal.ac.in` domain whitelisting.
5. **Database Integrity & Default-Deny Policies:** Firestore operations utilize strict document merging (`{ merge: true }`) to prevent accidental menu wiping or data corruption during partial updates.
6. **Error Masking:** Internal server exceptions and raw Firebase stack traces are safely caught and masked, returning clean, generic responses to clients.

---

## 🚀 Getting Started

### 1. Environment Setup

Create a `.env.local` file in your root directory with your Firebase configuration variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key

```

### 2. Installation & Running

```bash
bun install
bun run dev

```

### 3. Production Build

```bash
bun run build

```

---

## 👨‍💻 Author

**Ishaan Mittal**

*Built exclusively for VIT Bhopal University*

[https://itsmeishaan.vercel.app/](https://itsmeishaan.vercel.app/)