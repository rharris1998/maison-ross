import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';
import {TODAY_FIXTURES, TODAY_NOW} from '../fixtures/today-fixtures.js';

// Maison's Today (#29 step 4) on a touch screen, over the busy
// fixture's states (three alerts, so one row and "2 more"; a collection
// coming up; the vacuum cleaning) at the fixture's time: every glance chip,
// widget press, list row and "N more" takes a 44px touch, on a phone and
// from 700px; a sideways swipe on the chips scrolls the chips, never the
// page or the document; the last of Today clears the phone tab bar, with a
// safe area under it or none; and a busy button keeps its focus and ignores
// another Enter, in the gallery's In flight specimens and on Today's own
// vacuum line once it is pressed. On the Chromium projects the swipe is a
// real touch (CDP touch events, as in sheet.touch.spec.mjs); WebKit has
// no touch input in Playwright, so there the chips scroll by scrollBy.
test.beforeEach(exposeIPhonePlatform);

const BUSY = TODAY_FIXTURES.find(fixture => fixture.id === 'busy');
const host = page => page.locator('maison-dashboard');
// What Today offers to press: the chips, the widgets that open a page, the
// rows that open what they name, and "N more".
const PRESSABLE = {chip: '.m-glance__chip', press: '.m-widget__press', row: '.m-today .m-row--pressable', more: '.m-widget__more'};

// Today over the busy fixture's states, pinned so a
// reused preview's snapshot never reaches it, with the clock at the
// fixture's time, so it reads as the Node tests read it.
async function openToday(page) {
  await page.addInitScript(fixed => {
    const NativeDate = Date;
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
  }, TODAY_NOW);
  await page.route('**/states.json', route => route.fulfill({json: {source: 'Synthetic touch regression · busy Today', states: BUSY.states}}));
  await page.route('**/registry.json', route => route.fulfill({json: {areas: [], devices: [], entities: []}}));
  await page.goto('/#today');
  await expect(host(page).locator('.m-today')).toBeVisible();
}

// A 44px square around the centre of `control`'s area lands on the control
// itself, probed ±21.5px on each axis, once the area sits mid-screen (clear
// of the tab bar and the pill) and, in the chips, scrolled into view. The
// area is the control's own box, or its ::after extension: a widget's press
// is the title's button, whose ::after covers the whole widget, so its area
// is the widget, and it also takes a touch just inside each of its edges.
async function expectTouchTarget(page, control, name) {
  await control.evaluate(el => (el.closest('.m-widget__press') ? el.closest('[data-widget]') : el).scrollIntoView({block: 'center', inline: 'nearest'}));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const misses = await control.evaluate(el => {
    const area = el.closest('.m-widget__press') ? el.closest('[data-widget]') : el, box = area.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const probes = [[cx, cy - 21.5], [cx, cy + 21.5], [cx - 21.5, cy], [cx + 21.5, cy]];
    if (area !== el) probes.push([cx, box.top + 4], [cx, box.bottom - 4], [box.left + 4, cy], [box.right - 4, cy]);
    return probes.map(([x, y]) => {
      const hit = el.getRootNode().elementFromPoint(x, y);
      return hit === el || el.contains(hit) ? null : `(${Math.round(x - cx)}, ${Math.round(y - cy)}) lands on ${hit?.localName}.${String(hit?.className?.baseVal ?? hit?.className).trim().split(/\s+/).join('.')}`;
    }).filter(Boolean);
  });
  expect(misses, name).toEqual([]);
}

// Every pressable of each kind in Today takes a 44px touch; `counts` is how
// many of each Today draws at this layout.
async function expectTouchTargets(page, counts) {
  for (const [kind, selector] of Object.entries(PRESSABLE)) {
    const controls = host(page).locator(selector);
    await expect(controls, kind).toHaveCount(counts[kind]);
    for (const [index, control] of (await controls.all()).entries())
      await expectTouchTarget(page, control, `${kind} ${index + 1}: ${await control.getAttribute('aria-label') ?? (await control.textContent()).trim()}`);
  }
}

test('Every glance chip, widget press, list row and "N more" takes a 44px touch on a phone', async ({page}) => {
  await openToday(page);
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  // On a phone the chips stand in for the Car, power now and Climate; of the
  // stacked widgets only Energy today opens a page.
  await expectTouchTargets(page, {chip: 3, press: 1, row: 2, more: 1});
});

test.describe('from 700px', () => {
  test.use({viewport: {width: 900, height: 800}});

  test('Every widget press, list row and "N more" takes a 44px touch in the grid', async ({page}) => {
    await openToday(page);
    await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'wide');
    await expectTouchTargets(page, {chip: 0, press: 4, row: 2, more: 1});
  });
});

// The chips' scroller, the document's and every flat-tree ancestor's
// sideways scroll, and whether the document is wider than the viewport.
const sideways = page => host(page).locator('.m-glance').evaluate(scroller => {
  const up = el => el.assignedSlot ?? el.parentElement ?? el.parentNode?.host ?? null;
  const ancestors = [];
  for (let el = up(scroller); el; el = up(el)) if (el.scrollLeft) ancestors.push(`${el.localName}.${[...el.classList].join('.')} ${el.scrollLeft}`);
  return {chips: scroller.scrollLeft, window: scrollX, ancestors, wider: document.documentElement.scrollWidth > document.documentElement.clientWidth};
});

test('A sideways swipe on the glance chips moves the chips, never the page or the document', async ({page}, testInfo) => {
  await openToday(page);
  const scroller = host(page).locator('.m-glance');
  expect(await scroller.evaluate(el => [el.scrollWidth > el.clientWidth, getComputedStyle(el).overscrollBehaviorX])).toEqual([true, 'contain']);
  expect(await sideways(page)).toEqual({chips: 0, window: 0, ancestors: [], wider: false});
  const box = await scroller.boundingBox(), y = Math.round(box.y + box.height / 2);
  // Right to left over the chips, then far past their end, where an
  // overscroll would reach the page if nothing contained it.
  for (const [from, to] of [[box.x + box.width - 40, box.x + box.width - 200], [box.x + box.width - 20, box.x + 20]]) {
    if (testInfo.project.name === 'iphone-webkit') await scroller.evaluate((el, left) => el.scrollBy({left, behavior: 'instant'}), Math.round(from - to));
    else {
      const cdp = await page.context().newCDPSession(page), steps = 10;
      const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: x === undefined ? [] : [{x: Math.round(x), y}]});
      await touch('touchStart', from);
      for (let i = 1; i <= steps; i++) { await page.waitForTimeout(16); await touch('touchMove', from + (to - from) * i / steps); }
      await touch('touchEnd');
      await cdp.detach();
    }
    await expect.poll(async () => (await sideways(page)).chips).toBeGreaterThan(0);
    // Once any fling and snap have settled.
    await expect.poll(async () => { const first = (await sideways(page)).chips; await page.waitForTimeout(150); return (await sideways(page)).chips === first; }).toBe(true);
    const {window, ancestors, wider} = await sideways(page);
    expect({window, ancestors, wider}).toEqual({window: 0, ancestors: [], wider: false});
  }
});

// The phone tab bar floats over the foot of the screen, lifted over any
// safe area (Home Assistant's --safe-area-inset-bottom, else env()): with
// the page scrolled to its end, the last of Today sits above the bar.
test('The last of Today clears the phone tab bar, with a safe area and without', async ({page}) => {
  await openToday(page);
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  for (const inset of [0, 34]) {
    const {last, bar, screen} = await host(page).evaluate(async (el, inset) => {
      document.documentElement.style.setProperty('--safe-area-inset-bottom', `${inset}px`);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const today = el.shadowRoot.querySelector('.m-today'), bar = el.shadowRoot.querySelector('.m-tabbar').getBoundingClientRect();
      return {last: Math.max(...[...today.children].map(child => child.getBoundingClientRect().bottom)), bar: {top: bar.top, bottom: bar.bottom}, screen: innerHeight};
    }, inset);
    expect(bar.bottom, `the bar over a ${inset}px safe area`).toBeLessThanOrEqual(screen - Math.max(16, inset) + 0.5);
    expect(last, `the last of Today over a ${inset}px safe area`).toBeLessThanOrEqual(bar.top);
  }
});

// Where focus is, through every shadow root, and that element's state.
const focused = page => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return {name: el?.getAttribute('aria-label') || el?.querySelector('.m-button__label')?.textContent.trim(), pending: el?.hasAttribute('data-pending'), pressed: el?.hasAttribute('data-pressed'),
    disabled: el?.getAttribute('aria-disabled'), ring: el?.hasAttribute('data-focus-visible')};
});

test('A busy button in the gallery takes keyboard focus, keeps it and ignores Enter', async ({page}) => {
  await page.goto('/gallery?theme=light');
  await expect(page.locator('[data-gallery-ready="true"]')).toBeVisible();
  // The house stepper's steps in the In flight specimens: pending, so named
  // by their plain names.
  const group = page.locator('[data-gallery-state="buttons"] .m-gallery__group').filter({has: page.getByRole('heading', {name: 'In flight, from values'})});
  const cooler = group.getByRole('button', {name: 'Cooler', exact: true}), warmer = group.getByRole('button', {name: 'Warmer', exact: true});
  for (const step of [cooler, warmer]) {
    await expect(step).toHaveAttribute('aria-disabled', 'true');
    await expect(step).toHaveAttribute('data-pending', 'true');
  }
  await cooler.focus();
  await page.keyboard.press('Tab');
  await expect(warmer).toBeFocused();
  expect(await focused(page)).toEqual({name: 'Warmer', pending: true, pressed: false, disabled: 'true', ring: true});
  // Held down, Enter never presses it; let go, focus stays.
  await page.keyboard.down('Enter');
  expect(await focused(page)).toEqual({name: 'Warmer', pending: true, pressed: false, disabled: 'true', ring: true});
  await page.keyboard.up('Enter');
  await expect(warmer).toBeFocused();
  await expect(warmer).toHaveAttribute('data-pending', 'true');
});

test('Pressed by keyboard, Today’s vacuum button turns busy, keeps its focus and sends nothing more', async ({page}) => {
  await openToday(page);
  // The preview answers after 15s, so the request stays in flight; each
  // service call is counted as it goes out.
  await page.locator('#behavior').selectOption('delay');
  await host(page).evaluate(el => {
    const send = el.hass.callService;
    globalThis.maisonCalls = [];
    el.hass.callService = (domain, service, data) => { globalThis.maisonCalls.push(`${domain}.${service}`); return send(domain, service, data); };
  });
  const calls = () => page.evaluate(() => globalThis.maisonCalls);
  const line = host(page).locator('.m-quiet');
  const pause = line.getByRole('button', {name: 'Pause', exact: true}), dock = line.getByRole('button', {name: 'Dock', exact: true});
  await expect(pause).not.toHaveAttribute('data-pending');
  await pause.focus();
  await page.keyboard.press('Enter');
  await expect.poll(calls).toEqual(['vacuum.pause']);
  // Its key is in flight: both of the vacuum's buttons are pending, and the
  // one pressed still holds focus, its ring shown.
  for (const button of [pause, dock]) {
    await expect(button).toHaveAttribute('data-pending', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
  }
  await expect(pause).toBeFocused();
  expect(await focused(page)).toMatchObject({name: 'Pause', pending: true, disabled: 'true', ring: true});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await calls()).toEqual(['vacuum.pause']);
  await expect(pause).toBeFocused();
});
