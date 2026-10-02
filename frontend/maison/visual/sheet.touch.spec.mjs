import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';

// Maison's Sheet (#29) stays open through touches in plain and slotted
// ancestry, as the drawer it replaced did, and more: the grabber and header
// drag it down, a short drag goes back, the body scrolls itself, the scrim
// and Escape close it with focus given back, and Tab stays inside. On the
// Chromium projects a swipe is a real touch (CDP touch events, so
// touch-action decides who gets it); WebKit has no touch input in
// Playwright, so there a swipe is a mouse pointer and the body scrolls by
// wheel only where WebKit takes one. The waits are on state (animations
// ending, transforms clearing), except the 1000ms ones that sit past React
// Aria's 500ms VoiceOver refocus on purpose.
test.beforeEach(exposeIPhonePlatform);

const SLOTTED = ['maison-preview-shell', 'maison-preview-panel'];
const slotsInert = page => Promise.all(SLOTTED.map(tag => page.locator(tag).evaluate(el => el.shadowRoot.querySelector('slot').hasAttribute('inert'))));
const transformOf = sheet => sheet.evaluate(el => el.closest('.m-sheet').style.transform);
const comfort = 'input_number.attic_comfort_temperature';

// The sheet has finished entering: React Aria drops data-entering when the
// animations end.
const atRest = page => expect(page.locator('.m-sheet[data-entering], .m-sheet-overlay[data-entering]')).toHaveCount(0);
// A dragged sheet is back where it rests, with nothing left moving, and open.
async function backAtRest(page, sheet) {
  await expect.poll(() => sheet.evaluate(el => { const s = el.closest('.m-sheet'); return [s.style.transform, s.getAnimations().length]; })).toEqual(['', 0]);
  await expect(page.locator('.m-sheet[data-exiting]')).toHaveCount(0);
  await expect(sheet).toBeVisible();
}
// Two frames: long enough for a dismiss to have reached React and the DOM.
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
// Where focus is, through every shadow root: in the sheet, in the tab bar, and its name.
const focusIn = page => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return {inSheet: !!el?.closest('.m-sheet'), inTabbar: !!el?.closest('.m-tabbar'), name: el?.getAttribute('aria-label') || el?.textContent.trim().slice(0, 30)};
});

// A vertical swipe from the middle of `target` by `dy` px in `steps` moves
// `pause` ms apart, held still for `hold` ms before letting go (so it is no
// flick). `during` runs before the release.
async function swipe(page, target, dy, {steps = 8, pause = 30, hold = 160, during} = {}) {
  const box = await target.boundingBox();
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  const at = i => ({x, y: Math.round(y + dy * i / steps)});
  if (page.context().browser().browserType().name() === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: point ? [point] : []});
    await touch('touchStart', at(0));
    for (let i = 1; i <= steps; i++) { await page.waitForTimeout(pause); await touch('touchMove', at(i)); }
    await page.waitForTimeout(hold);
    await during?.();
    await touch('touchEnd');
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.waitForTimeout(pause); await page.mouse.move(at(i).x, at(i).y); }
    await page.waitForTimeout(hold);
    await during?.();
    await page.mouse.up();
  }
}

async function openZoneSheet(page, query = '') {
  await page.goto(`/gallery?theme=light${query}`);
  const opener = page.getByRole('button', {name: 'Open zone sheet', exact: true});
  await opener.tap();
  const sheet = page.getByRole('dialog', {name: 'Attic', exact: true});
  await expect(sheet).toBeVisible();
  await atRest(page);
  return {opener, sheet};
}

// The full dashboard, on Climate, with the Attic's comfort helper.
async function dashboard(page) {
  await page.route('**/states.json', route => route.fulfill({json: {
    source: 'Synthetic touch regression',
    states: {[comfort]: {entity_id: comfort, state: '21', attributes: {
      friendly_name: 'Attic comfort temperature', min: 16, max: 24, step: 0.5, unit_of_measurement: '°C',
    }}},
  }}));
  await page.goto('/?host=slotted#climate');
  const opener = page.getByRole('button', {name: /^Attic: .*Open Attic$/});
  await expect(opener).toBeVisible();
  return {opener, sheet: page.getByRole('dialog', {name: 'Attic', exact: true})};
}

for (const host of ['plain', 'slotted']) {
  test(`Zone sheet stays open after touches in ${host} ancestry`, async ({page}) => {
    const {opener, sheet} = await openZoneSheet(page, host === 'slotted' ? '&host=slotted' : '');
    if (host === 'slotted') expect(await slotsInert(page)).toEqual([false, false]);
    // useDialog blurs/refocuses at 500 ms for iOS VoiceOver. Assert afterwards.
    await page.waitForTimeout(1000);
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', {name: 'Raise comfort', exact: true}).tap();
    await page.waitForTimeout(1000);
    await expect(sheet).toBeVisible();
    if (host === 'slotted') expect(await slotsInert(page)).toEqual([false, false]);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}

test('A tap on the scrim closes the sheet and gives focus back', async ({page}) => {
  const {opener, sheet} = await openZoneSheet(page, '&host=slotted');
  const top = await sheet.evaluate(el => el.closest('.m-sheet').getBoundingClientRect().top);
  expect(top).toBeGreaterThan(12);
  await page.touchscreen.tap(Math.round(page.viewportSize().width / 2), Math.floor(top / 2));
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
});

// Maison's alerts body (v35): the full house's alerts as pressable
// rows in an inset list, then the way to Home status, a wide button at its
// end.
test('The alerts sheet opens, closes by its close button, and gives focus back', async ({page}) => {
  await page.goto('/gallery?theme=dark&host=slotted');
  const opener = page.getByRole('button', {name: 'Open alerts sheet', exact: true});
  await opener.tap();
  const sheet = page.getByRole('dialog', {name: 'Home alerts', exact: true});
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', {name: 'Home alerts', level: 2})).toBeVisible();
  const body = sheet.locator('.m-sheet__body > .m-dialog.m-dialog--alerts');
  await expect(body).toBeVisible();
  expect(await body.locator('.m-list .m-row--pressable').count()).toBeGreaterThan(0);
  await expect(body.locator(':scope > .m-button')).toHaveCount(1);
  await expect(body.locator(':scope > .m-button')).toBeVisible();
  await atRest(page);
  await sheet.getByRole('button', {name: 'Close', exact: true}).tap();
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Swiping the grabber down past 30% of the sheet dismisses it', async ({page}) => {
  const {opener, sheet} = await openZoneSheet(page, '&host=slotted');
  const height = await sheet.evaluate(el => el.closest('.m-sheet').offsetHeight);
  let dragged = '';
  await swipe(page, sheet.locator('.m-sheet__grabber'), Math.round(height * 0.3) + 60, {during: async () => { dragged = await transformOf(sheet); }});
  expect(dragged).toMatch(/^translateY\((\d+(\.\d+)?)px\)$/);
  expect(Number(dragged.match(/[\d.]+/)[0])).toBeGreaterThan(height * 0.3);
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Swiping the header down a little sends the sheet back, and it stays open', async ({page}) => {
  const {sheet} = await openZoneSheet(page);
  const scrim = () => sheet.evaluate(el => el.closest('.m-sheet-overlay').style.backgroundColor);
  let dragged = '', dimmed = '';
  await swipe(page, sheet.locator('.m-sheet__eyebrow'), 48, {steps: 6, pause: 40, during: async () => { dragged = await transformOf(sheet); dimmed = await scrim(); }});
  expect(dragged).toMatch(/^translateY\(\d/);
  expect(dimmed).toContain('color-mix');
  await backAtRest(page, sheet);
  expect(await scrim()).toBe('');
});

// Pointer events dispatched with a timeline the test controls: 20px every
// 10ms, 2 px/ms, released at once. 80px is well under 30% of the sheet, so
// only the flick speed (over 0.5 px/ms) can dismiss it.
test('A quick flick down the header dismisses the sheet, however short', async ({page}) => {
  const {sheet} = await openZoneSheet(page);
  const height = await sheet.evaluate(el => el.closest('.m-sheet').offsetHeight);
  expect(80).toBeLessThan(height * 0.3);
  await sheet.locator('.m-sheet__title').evaluate(title => {
    const box = title.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
    const fire = (type, dy) => title.dispatchEvent(new PointerEvent(type, {pointerId: 91, pointerType: 'touch', isPrimary: true, bubbles: true,
      cancelable: true, composed: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y + dy}));
    const spin = ms => { const end = performance.now() + ms; while (performance.now() < end) { /* hold the timeline */ } };
    fire('pointerdown', 0);
    for (let i = 1; i <= 4; i++) { spin(10); fire('pointermove', i * 20); }
    fire('pointerup', 80);
  });
  await expect(sheet).toHaveCount(0);
});

test('The close button never starts a drag', async ({page}) => {
  const {sheet} = await openZoneSheet(page);
  let dragged = null;
  await swipe(page, sheet.getByRole('button', {name: 'Close', exact: true}), 200, {during: async () => { dragged = await transformOf(sheet); }});
  expect(dragged).toBe('');
  await frames(page);
  await backAtRest(page, sheet);
});

test('A swipe or wheel on the body scrolls the body, not the page, and never dismisses', async ({page}, testInfo) => {
  const {sheet} = await openZoneSheet(page, '&host=slotted');
  const body = sheet.locator('.m-sheet__body');
  const scrolled = () => body.evaluate(el => el.scrollTop);
  const backgroundTop = () => page.locator('maison-preview-shell').evaluate(el => el.shadowRoot.querySelector('.ha-view').scrollTop);
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await body.evaluate(el => [getComputedStyle(el).touchAction, getComputedStyle(el).overscrollBehaviorY])).toEqual(['pan-y', 'contain']);
  const backgroundBefore = await backgroundTop();
  let dragged = null;
  await swipe(page, body, -260, {hold: 0, during: async () => { dragged = await transformOf(sheet); }});
  expect(dragged).toBe('');
  if (testInfo.project.name !== 'iphone-webkit') await expect.poll(scrolled).toBeGreaterThan(0);
  await body.evaluate(el => { el.scrollTop = 0; });
  const box = await body.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const wheeled = await page.mouse.wheel(0, 400).then(() => true, error => {
    // Playwright can't wheel in mobile WebKit; the Chromium projects cover it.
    if (testInfo.project.name === 'iphone-webkit') return false;
    throw error;
  });
  if (wheeled) await expect.poll(scrolled).toBeGreaterThan(0);
  expect(await backgroundTop()).toBe(backgroundBefore);
  await backAtRest(page, sheet);
});

// React Aria sets --visual-viewport-height from window.visualViewport, which
// the iPhone keyboard shrinks. A browser can't open that keyboard here, so a
// shorter viewport stands in for it: this checks the sheet follows the
// variable, not the keyboard itself.
test('The sheet follows --visual-viewport-height as the visual viewport shrinks', async ({page}) => {
  const {sheet} = await openZoneSheet(page);
  const overlay = sheet.locator('xpath=ancestor::*[contains(@class,"m-sheet-overlay")]');
  const bounds = () => sheet.evaluate(el => { const box = el.closest('.m-sheet').getBoundingClientRect(); return {top: box.top, bottom: box.bottom}; });
  expect(await overlay.evaluate(el => el.style.getPropertyValue('--visual-viewport-height'))).toMatch(/^\d+(\.\d+)?px$/);
  const {width} = page.viewportSize();
  await page.setViewportSize({width, height: 420});
  await expect.poll(() => overlay.evaluate(el => el.style.getPropertyValue('--visual-viewport-height'))).toBe('420px');
  const {top, bottom} = await bounds();
  expect(bottom).toBeLessThanOrEqual(420 - 8 + 0.5);
  expect(top).toBeGreaterThanOrEqual(20 - 0.5);
  await expect(sheet).toBeVisible();
});

test('Under reduced motion the sheet closes at once', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  const {opener, sheet} = await openZoneSheet(page);
  expect(await sheet.evaluate(el => getComputedStyle(el).getPropertyValue('--m-dur-sheet').trim())).toBe('0ms');
  // Timed in the page, from just before Escape to the overlay leaving the DOM.
  const gone = sheet.evaluate(el => {
    const root = el.getRootNode(), start = performance.now();
    return new Promise(resolve => { const check = () => root.querySelector('.m-sheet-overlay') ? requestAnimationFrame(check) : resolve(performance.now() - start); check(); });
  });
  await page.keyboard.press('Escape');
  expect(await gone).toBeLessThan(200);
  await expect(opener).toBeFocused();
});

test('The Attic sheet stays open in the dashboard during state updates and a comfort change', async ({page}) => {
  const {opener, sheet} = await dashboard(page);
  await page.locator('#theme').selectOption('dark');
  await opener.tap();
  await expect(sheet).toBeVisible();
  expect(await slotsInert(page)).toEqual([false, false]);
  // Ten state replacements over a second; the promise settles once the last is in.
  await page.evaluate(() => new Promise(resolve => {
    const dashboard = document.querySelector('maison-dashboard');
    for (let index = 0; index < 10; index++) {
      setTimeout(() => { dashboard.hass = {...dashboard.hass, states: {...dashboard.hass.states}}; if (index === 9) requestAnimationFrame(resolve); }, index * 100);
    }
  }));
  await expect(sheet).toBeVisible();
  await expect(page.locator('.m-sheet[data-exiting]')).toHaveCount(0);
  await sheet.getByRole('button', {name: 'Raise comfort', exact: true}).tap();
  await expect.poll(() => page.locator('maison-dashboard').evaluate((el, id) => el.hass.states[id].state, comfort)).toBe('21.5');
  await expect(sheet).toBeVisible();
  expect(await slotsInert(page)).toEqual([false, false]);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('A swipe dismiss in the dashboard goes back to Climate with focus on the opener', async ({page}) => {
  const {opener, sheet} = await dashboard(page);
  await opener.tap();
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/#climate\/attic$/);
  await atRest(page);
  const height = await sheet.evaluate(el => el.closest('.m-sheet').offsetHeight);
  await swipe(page, sheet.locator('.m-sheet__grabber'), Math.round(height * 0.3) + 60);
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/#climate$/);
  await expect(opener).toBeFocused();
});

test('Tab and Shift+Tab stay inside the sheet, and the tab bar is out of reach', async ({page}) => {
  const {opener, sheet} = await dashboard(page);
  await expect(page.locator('nav.m-tabbar')).toHaveCount(1);
  await opener.tap();
  await expect(sheet).toBeVisible();
  await atRest(page);
  // Enough presses to go round the sheet's controls and wrap, each way.
  const stops = await sheet.evaluate(el => [...el.querySelectorAll('button,[href],input,select,textarea,[tabindex]')]
    .filter(node => !node.disabled && node.getAttribute('tabindex') !== '-1').length);
  expect(stops).toBeGreaterThanOrEqual(3);
  for (const key of ['Tab', 'Shift+Tab']) {
    const seen = new Set();
    for (let press = 0; press < stops + 3; press++) {
      await page.keyboard.press(key);
      const where = await focusIn(page);
      expect(where.inTabbar, `${key} #${press} reached the tab bar`).toBe(false);
      expect(where.inSheet, `${key} #${press} left the sheet for ${where.name}`).toBe(true);
      seen.add(where.name);
    }
    expect(seen.size, `${key} visited every control once round`).toBe(stops);
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});
