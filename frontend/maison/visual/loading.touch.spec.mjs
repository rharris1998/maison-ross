import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';

// Maison renders only with React (ADR 0005): while the bundle loads it says
// so in the element's own shell (p.m-loading), and if the import fails it
// shows the notice (div.m-notice: its glyph, its title and Retry, a 44px
// capsule), and Retry imports the bundle again under a fresh URL because a
// browser may keep a failed module import for the page. Loaded at a URL
// with no design in it, Maison draws its frame on a host that carries no
// design, and a zone's sheet opens from Climate and closes.
const BUNDLE = '**/vendor/maison-react.js*';
const host = page => page.locator('maison-dashboard');

test.beforeEach(exposeIPhonePlatform);

test('the dashboard says it is loading, offers Retry when the bundle fails, and recovers', async ({page}) => {
  const comfort = 'input_number.attic_comfort_temperature';
  await page.route('**/states.json', route => route.fulfill({json: {
    source: 'Synthetic loading regression',
    states: {[comfort]: {entity_id: comfort, state: '21', attributes: {
      friendly_name: 'Attic comfort temperature', min: 16, max: 24, step: 0.5, unit_of_measurement: '°C',
    }}},
  }}));
  let hold;
  const held = new Promise(resolve => { hold = resolve; });
  await page.route(BUNDLE, route => hold(route));
  // The held import must not block navigation, so only wait for the response.
  await page.goto('/', {waitUntil: 'commit'});
  const firstImport = await held;
  expect(firstImport.request().url()).not.toContain('retry=');
  await expect(page.getByRole('status').filter({hasText: 'Loading Maison…'})).toBeVisible();
  await expect(host(page).locator('.wrap > p.m-loading')).toHaveText('Loading Maison…');

  await firstImport.abort();
  const notice = page.getByRole('alert').filter({hasText: 'Maison couldn’t load. Reload to retry.'});
  await expect(notice).toBeVisible();
  await expect(host(page).locator('.wrap > .m-notice > *')).toHaveCount(3);
  await expect(host(page).locator('.wrap > .m-notice > .m-notice__glyph > svg')).toHaveCount(1);
  const retry = notice.getByRole('button', {name: 'Retry', exact: true});
  await expect(retry).toBeVisible();
  await expect(retry).toHaveClass('m-notice__retry');
  expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(host(page).locator('.m-app')).toHaveCount(0);

  await page.unroute(BUNDLE);
  const retried = page.waitForRequest(request => /\/vendor\/maison-react\.js\?v=\d+&retry=1$/.test(request.url()));
  await retry.tap();
  await retried;
  const navigation = host(page).locator('nav.m-tabbar');
  await expect(navigation).toBeVisible();
  await expect(host(page)).not.toHaveAttribute('design');
  await expect(host(page).locator('.m-loading, .m-notice')).toHaveCount(0);

  await navigation.getByRole('button', {name: 'Climate', exact: true}).tap();
  await page.getByRole('button', {name: /^Attic: .*Open Attic$/}).tap();
  const sheet = page.getByRole('dialog', {name: 'Attic', exact: true});
  await expect(sheet).toBeVisible();
  await expect(page.locator('.m-sheet')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});
