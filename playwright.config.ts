import { defineConfig, devices } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

// Backend port for the E2E stack. Override with E2E_BACKEND_PORT when 8000 is
// already taken (e.g. another service is bound to it).
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "8000";

// End-to-end self-validation: boots the real backend (which serves the demo app)
// and the Vite dev server, then drives the portal in a browser. The backend
// launches its own headless browser to execute runs, so this exercises the whole
// stack: UI → API → engine → demo app → artifacts → UI.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `../backend/.venv/bin/uvicorn app.main:app --app-dir ../backend --port ${BACKEND_PORT}`,
      url: `http://127.0.0.1:${BACKEND_PORT}/api/apps`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      // Point the Vite proxy at whichever port the backend is on.
      env: { L3_BACKEND: `http://127.0.0.1:${BACKEND_PORT}` },
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
