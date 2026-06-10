import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.test" });

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:4321" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
