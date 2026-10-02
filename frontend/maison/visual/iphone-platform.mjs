// Shared by the touch specs; the name stays outside `*.touch.spec.mjs`.
export async function exposeIPhonePlatform({page}, testInfo) {
  if (testInfo.project.name.startsWith('iphone-')) {
    // Playwright's iPhone user-agent still exposes MacIntel on macOS WebKit.
    // React Aria detects iOS via platform, so exercise that branch explicitly.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', {get: () => 'iPhone'});
      Object.defineProperty(navigator, 'maxTouchPoints', {get: () => 5});
      Object.defineProperty(navigator, 'userAgentData', {get: () => undefined});
    });
  }
}
