import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (`npm run e2e`). They drive the running web app (`WEB_URL`, default the local
 * preview build on :3109, which talks to a local CMS backend) and record a video of every test in
 * `test-results/`. Start the backend and `npm run dev` first; nothing is started from here.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3109',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    trace: 'retain-on-failure',
    // Previews start by themselves only when muted; the tests never need sound.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
});
