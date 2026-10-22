import { defineConfig, devices } from '@playwright/test';

// Serves the static site on 4501; Playwright starts and stops this server itself.
export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:4501',
    video: process.env.EVIDENCE ? 'on' : 'off',
  },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: 'python3 -m http.server 4501 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4501',
    reuseExistingServer: false,
  },
});
