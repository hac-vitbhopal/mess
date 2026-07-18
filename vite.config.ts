import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // ⚡ Add this block right here to silence the CSRF terminal warning:
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  },
});