import {defineConfig, devices} from '@playwright/test';

// Parallel sessions each give their own port; 8767 otherwise.
const port = Number(process.env.MAISON_PREVIEW_PORT || 8767);

export default defineConfig({
  testDir: '.',
  testMatch: '*.visual.spec.mjs',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  updateSnapshots: 'none',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.001,
    },
  },
  snapshotPathTemplate: '{testDir}/__snapshots__/{projectName}/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'Europe/Brussels',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'phone-375',
      use: {...devices['Desktop Chrome'], viewport: {width: 375, height: 812}},
    },
    {
      name: 'desktop-1280',
      use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 900}},
    },
  ],
  webServer: {
    command: `node ../../tools/maison-preview.mjs --port ${port}`,
    cwd: new URL('..', import.meta.url).pathname,
    url: `http://127.0.0.1:${port}/gallery`,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
