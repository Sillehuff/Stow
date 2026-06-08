import { defineConfig } from "@playwright/test";

const PORT = 4273;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: `${BASE_URL}/spaces`,
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-stow.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "demo-stow",
      VITE_FIREBASE_STORAGE_BUCKET: "demo-stow.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
      VITE_FIREBASE_APP_ID: "1:1234567890:web:abc123",
      VITE_FUNCTIONS_REGION: "us-central1",
      VITE_USE_FIREBASE_EMULATORS: "true"
    }
  }
});
