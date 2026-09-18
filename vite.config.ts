import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// This config runs in Node; declare `process` here since the project carries no
// @types/node (and this file is outside the app's tsc scope).
declare const process: { env: Record<string, string | undefined> };

// Backend origin the dev server proxies to. Override with L3_BACKEND when the
// backend runs on a non-default port (e.g. when 8000 is already taken).
const backend = process.env.L3_BACKEND ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: backend, ws: true },
      "/runs": { target: backend },
    },
  },
});
