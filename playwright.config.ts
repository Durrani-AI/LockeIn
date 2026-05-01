import { defineConfig } from "@playwright/test";

const baseURL = process.env.LOCKEDIN_E2E_BASE_URL || "http://127.0.0.1:8080";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
});
