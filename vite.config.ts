import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  },
  vite: {
    build: {
      sourcemap: false, // 🔒 Locks down production source code against browser DevTools inspection
    },
    ssr: {
      external: ["firebase-admin", "@google-cloud/firestore"],
    },
  },
});