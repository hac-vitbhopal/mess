import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  },
  // ⚡ Place ssr inside the native vite config block:
  vite: {
    ssr: {
      external: ["firebase-admin"],
    },
  },
});