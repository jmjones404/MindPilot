import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}/MindPilot/`;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 45_000,
  use: { baseURL, timezoneId: 'America/New_York', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: { command: `npm run preview -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: !process.env.CI },
});
