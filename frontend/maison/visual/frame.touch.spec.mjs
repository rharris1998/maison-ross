import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';

// Maison's frame (#29) on a touch screen: the phone tab bar is fixed
// to the screen, so beside Home Assistant's docked sidebar it must stay over
// Maison and leave the sidebar its taps; every tab and header tool takes a
// 44px touch; and the status line's live region is in the page before any
// text arrives, so a screen reader hears it.
test.beforeEach(exposeIPhonePlatform);

const host = page => page.locator('maison-dashboard');
async function openDashboard(page, hash = 'today') {
  await page.goto(`/#${hash}`);
  await expect(host(page).locator('.m-app')).toBeVisible();
}

// Where a probe at (x, y) lands: inside Maison, the shadow root's element.
const landsOn = (page, x, y) => page.evaluate(([x, y]) => {
  const outer = document.elementFromPoint(x, y);
  if (outer?.tagName !== 'MAISON-DASHBOARD') return outer?.tagName ?? null;
  const inner = outer.shadowRoot.elementFromPoint(x, y);
  return inner?.closest('.m-tab, .m-button')?.className ?? inner?.tagName ?? null;
}, [x, y]);

// A 44px square around each control's centre lands on the control itself,
// through its own box or its ::after extension: the four tabs (Life left
// in v35) and the header's two tools.
async function expectTouchTargets(page) {
  const controls = host(page).locator('.m-tab, .m-header__tools .m-button');
  expect(await controls.count()).toBe(6);
  for (const control of await controls.all()) {
    const box = await control.boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const own = await control.getAttribute('class');
    for (const [dx, dy] of [[0, -21.5], [0, 21.5], [-21.5, 0], [21.5, 0]])
      expect(await landsOn(page, cx + dx, cy + dy), `${own} at ${dx},${dy}`).toBe(own);
  }
}

test('Every tab and header tool takes a 44px touch on a phone', async ({page}) => {
  await openDashboard(page);
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  await expectTouchTargets(page);
});

test.describe('beside Home Assistant', () => {
  test.use({viewport: {width: 900, height: 800}});

  test('Every tab and header tool takes a 44px touch in the top pill', async ({page}) => {
    await openDashboard(page);
    await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'wide');
    await expectTouchTargets(page);
  });

  test('The phone tab bar stays over Maison, clear of the docked sidebar', async ({page}) => {
    await openDashboard(page);
    // Home Assistant's expanded, docked sidebar: its width on an ancestor, and
    // Maison laid out beside it, narrower than the viewport.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--ha-sidebar-width', '256px');
      Object.assign(document.querySelector('maison-dashboard').style, {display: 'block', marginLeft: '256px'});
    });
    const app = host(page).locator('.m-app'), bar = host(page).locator('.m-tabbar');
    await expect(app).toHaveAttribute('data-layout', 'phone');
    const maison = await app.boundingBox(), tabs = await bar.boundingBox();
    expect(maison.x).toBeCloseTo(256, 0);
    expect(tabs.x).toBeGreaterThanOrEqual(maison.x + 14 - 0.5);
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(maison.x + maison.width - 14 + 0.5);
    // Centred over Maison.
    expect(tabs.x + tabs.width / 2).toBeCloseTo(maison.x + maison.width / 2, 0);
    // A tap on the sidebar at the bar's height reaches the page beside
    // Maison, never the bar.
    for (const x of [8, 128, 250]) expect(await landsOn(page, x, tabs.y + tabs.height / 2)).not.toBe('MAISON-DASHBOARD');
    await expect(bar.getByRole('button', {name: 'Today'})).toHaveAttribute('aria-current', 'page');
  });
});

test('The status line’s live region is in the page while it is empty', async ({page}) => {
  await openDashboard(page, 'climate');
  const region = host(page).locator('.m-status-region');
  await expect(region).toHaveCount(1);
  await expect(region).toHaveAttribute('role', 'status');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  await expect(region).toBeEmpty();
  await expect(host(page).locator('.m-status')).toHaveCount(0);
});
