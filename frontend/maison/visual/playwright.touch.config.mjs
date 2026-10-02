import {defineConfig, devices} from '@playwright/test';

// Parallel sessions each give their own port; 8767 otherwise.
const port = Number(process.env.MAISON_PREVIEW_PORT || 8767);

export default defineConfig({
  testDir: '.',
  testMatch: '*.touch.spec.mjs',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
  },
  projects: [
    {name: 'iphone-webkit', use: {
      ...devices['iPhone 13'],
      launchOptions: {executablePath: process.env.MAISON_WEBKIT_EXECUTABLE},
    }},
    {name: 'iphone-chromium', use: {
      ...devices['iPhone 13'],
      browserName: 'chromium',
      launchOptions: {executablePath: process.env.MAISON_CHROMIUM_EXECUTABLE},
    }},
    {name: 'touch-chromium', use: {
      ...devices['Pixel 5'],
      launchOptions: {executablePath: process.env.MAISON_CHROMIUM_EXECUTABLE},
    }},
  ],
  webServer: {
    command: `node ../../tools/maison-preview.mjs --port ${port}`,
    cwd: new URL('..', import.meta.url).pathname,
    url: `http://127.0.0.1:${port}/gallery`,
    reuseExistingServer: true,
  },
});
