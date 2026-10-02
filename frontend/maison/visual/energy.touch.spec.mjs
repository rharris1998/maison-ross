import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';
import {ENERGY_FIXTURES} from '../fixtures/energy-fixtures.js';

// Maison's Energy (#29 step 4, v33) and its sheets on a touch
// screen, over the Energy fixtures' states at each fixture's time, with the
// preview's sample history so the page draws its chart: every linked card
// (the price, the billing year), money row, rate row and the chart's
// Details on the page takes a 44px touch, and so does every row, link and
// Why in the four sheets; a touch anywhere on a linked widget lands on
// its press, a rate row's included; tapping a card or a row opens its sheet
// at #energy/<id>, and Back closes it; a direct #energy/bill opens Bill;
// nothing scrolls sideways at 320, 375 or 393px, on the page or in any
// sheet with its Why open, and nothing logs an error; a sideways drag on
// the phone's chart scrubs it and lifting clears it, while a vertical swipe
// that starts on it scrolls the page and never shows the scrub, frame by
// frame; and nothing above the phone tab bar gives it a containing block.
// No accessibility checks (30/09). On the Chromium projects a swipe is a
// real touch (CDP touch events, as in climate.touch.spec.mjs); WebKit
// has no touch input in Playwright, so there a drag on the chart is pointer
// events dispatched on the plot, which checks the chart's own rule (a
// finger scrubs only once it moves sideways) but not touch-action's; Alex's
// iPhone checks that.
test.beforeEach(exposeIPhonePlatform);

const host = page => page.locator('maison-dashboard');
const byId = id => ENERGY_FIXTURES.find(fixture => fixture.id === id);
// Each sheet's title, by its id, as the sheet's dialog shows it: energy.js's
// ENERGY_DETAILS, whose ?v= imports Playwright's loader can't follow.
const TITLES = {price: 'Price', 'billing-year': 'Billing year', bill: 'Bill so far', 'energy-today': 'Energy today'};
// What the page offers to press: the linked widgets (price and year on a
// phone; bill, cap and rates too from 700px), whose press covers them; the
// phone's money rows; the chart's Details (v37: Energy today's sheet).
const PAGE_CONTROLS = {press: '.m-energy .m-widget__press', row: '.m-energy .m-row--pressable', action: '.m-energy .m-widget__action'};
// What a sheet body offers: the day sheet's reading rows, the Bill's links
// and each sheet's Why.
const SHEET_CONTROLS = {row: '.m-row--pressable', link: '.m-energy-sheet__links .m-button', disclosure: '.m-disclosure__trigger'};

// Energy over fixture `id`'s states, pinned so a reused
// preview's snapshot never reaches it, with the clock at the fixture's
// time, so it reads as the Node tests read it, at `hash`; then the
// preview's sample history, so the page draws its chart. The registry is
// set once per page, the states on each load, and the clock whenever the
// fixture's time differs from the last one set: a later init script's
// Date wraps the earlier's, so the latest time wins. A page already on the
// preview leaves it first, since a goto that changes only the fragment
// would neither reload the states nor reset the clock.
const clocks = new WeakMap();
async function openEnergy(page, id, hash = 'energy') {
  const {now, states} = byId(id);
  if (!clocks.has(page)) await page.route('**/registry.json', route => route.fulfill({json: {areas: [], devices: [], entities: []}}));
  if (clocks.get(page) !== now) {
    clocks.set(page, now);
    await page.addInitScript(fixed => {
      const NativeDate = Date;
      globalThis.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
    }, now);
  }
  await page.unroute('**/states.json');
  await page.route('**/states.json', route => route.fulfill({json: {source: `Synthetic touch regression · Energy ${id}`, states}}));
  if (page.url() !== 'about:blank') await page.goto('about:blank');
  await page.goto(`/#${hash}`);
  await expect(host(page).locator('.m-energy')).toBeAttached();
  await page.locator('#data-mode').selectOption('sample');
}

// The page's chart has drawn its plot from the sample history.
const chartReady = page => expect(host(page).locator('.m-energy [data-widget=chart] .m-power__plot')).toBeVisible();

// The sheet has finished entering (React Aria drops data-entering when the
// animations end), showing `detail`'s title.
async function sheetAtRest(page, detail) {
  const sheet = page.locator('.m-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.m-sheet[data-entering], .m-sheet-overlay[data-entering]')).toHaveCount(0);
  await expect(sheet.locator('.m-sheet__title')).toHaveText(TITLES[detail]);
  return sheet;
}

// Opens `detail`'s sheet over the page by its route, as a card or a row does.
async function openSheet(page, detail) {
  await page.evaluate(detail => { location.hash = `energy/${detail}`; }, detail);
  return sheetAtRest(page, detail);
}

// Taps every closed disclosure in the sheet open.
async function openDisclosures(sheet) {
  for (const trigger of await sheet.locator('.m-disclosure__trigger').all()) {
    if (await trigger.getAttribute('aria-expanded') === 'true') continue;
    await trigger.scrollIntoViewIfNeeded();
    await trigger.tap();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  }
}

// Two frames: long enough for a layout or a render to have landed.
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// A 44px square around the centre of `control`'s area lands on the control
// itself, probed ±21.5px on each axis, once the area sits mid-screen (clear
// of the tab bar and the pill, or mid-sheet). The area is the control's own
// box, or its ::after extension: a linked widget's press is the title's
// button, whose ::after covers the whole widget, so its area is the widget,
// and it also takes a touch just inside each of its edges.
async function expectTouchTarget(page, control, name) {
  await control.evaluate(el => (el.closest('.m-widget__press') ? el.closest('[data-widget]') : el).scrollIntoView({block: 'center', inline: 'nearest'}));
  await frames(page);
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

// Each shown control `kinds` selects in `scope` takes a 44px touch; `counts`
// is how many of each kind there are. Returns how many were probed.
async function expectTouchTargets(page, scope, kinds, counts) {
  let probed = 0;
  for (const [kind, selector] of Object.entries(kinds)) {
    const controls = scope.locator(selector);
    await expect(controls, kind).toHaveCount(counts[kind]);
    for (const [index, control] of (await controls.all()).entries()) {
      if (!await control.evaluate(el => el.getClientRects().length > 0)) continue;
      await expectTouchTarget(page, control, `${kind} ${index + 1}: ${await control.getAttribute('aria-label') ?? (await control.textContent()).trim()}`);
      probed++;
    }
  }
  return probed;
}

// In the page: every hit of an 11 × 11 grid over `area` (inset 2px from its
// edges) that doesn't land on its press, which should take them all: the
// element `press` selects in the area's widget (a rate row's is its
// widget's), or the area itself. The points a rounded corner cuts off (the
// area's own, its list's or its widget's) are left out: nothing is drawn
// there.
function missesOver(area, press) {
  press = press ? area.closest('[data-widget]').querySelector(press) : area;
  const box = area.getBoundingClientRect(), root = area.getRootNode(), misses = [];
  const radius = Math.max(...[area, area.closest('.m-list'), area.closest('.m-widget')].filter(Boolean).map(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0));
  const drawn = (x, y) => Math.hypot(Math.max(box.left + radius - x, x - box.right + radius, 0), Math.max(box.top + radius - y, y - box.bottom + radius, 0)) <= radius;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    const x = box.left + 2 + (box.width - 4) * i / 10, y = box.top + 2 + (box.height - 4) * j / 10, hit = root.elementFromPoint(x, y);
    if (drawn(x, y) && hit !== press && !press.contains(hit)) misses.push(`(${i}, ${j}) lands on ${hit?.localName}.${String(hit?.className?.baseVal ?? hit?.className).trim().split(/\s+/)[0]}`);
  }
  return misses;
}

// Every point of each linked widget (and of each rate row in it) lands on
// the widget's press, once it sits mid-screen.
async function expectPressesCover(page) {
  const widgets = host(page).locator('.m-energy [data-widget]:has(.m-widget__press)');
  for (const widget of await widgets.all()) {
    const id = await widget.getAttribute('data-widget');
    await widget.evaluate(el => el.scrollIntoView({block: 'center'}));
    await frames(page);
    expect(await widget.evaluate(missesOver, '.m-widget__press'), id).toEqual([]);
    for (const [index, row] of (await widget.locator('.m-row').all()).entries()) expect(await row.evaluate(missesOver, '.m-widget__press'), `${id} row ${index + 1}`).toEqual([]);
  }
}

// Taps the middle of `area` (a widget, whose press's ::after takes it, or
// a row) once it sits mid-screen; `detail`'s sheet opens at #energy/<id>
// with its title, and Back closes it, back at #energy.
async function expectTapOpens(page, area, detail) {
  await area.evaluate(el => el.scrollIntoView({block: 'center'}));
  await frames(page);
  const box = await area.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(new RegExp(`#energy/${detail}$`));
  await sheetAtRest(page, detail);
  await page.goBack();
  await expect(page.locator('.m-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/#energy$/);
}

test('Every linked card, money row and the chart’s Details on the Energy page takes a 44px touch on a phone', async ({page}) => {
  await openEnergy(page, 'billing');
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  await chartReady(page);
  // The price and the billing year; the bill and the cap credit as rows;
  // the chart's Details.
  await expectTouchTargets(page, host(page), PAGE_CONTROLS, {press: 2, row: 2, action: 1});
  await expectPressesCover(page);
});

test('Tapping each card, money row or the chart’s Details on a phone opens its sheet, and Back closes it', async ({page}) => {
  await openEnergy(page, 'billing');
  const energy = host(page).locator('.m-energy');
  for (const [id, detail] of [['price', 'price'], ['year', 'billing-year']]) await expectTapOpens(page, energy.locator(`[data-widget=${id}]`), detail);
  await expectTapOpens(page, energy.locator('[data-widget=chart] .m-widget__action'), 'energy-today');
  const rows = energy.locator('.m-row--pressable');
  await expect(rows).toHaveCount(2);
  for (const row of await rows.all()) await expectTapOpens(page, row, 'bill');
});

// From 700px: a wide 700px, with the price first, and a desktop 1,100px,
// the grid's narrowest widgets in each layout.
for (const [width, layout, linked] of [[700, 'wide', ['price', 'year', 'rates', 'bill', 'cap']], [1100, 'desktop', ['year', 'rates', 'bill', 'cap']]]) {
  test.describe(`from 700px, at ${width}px`, () => {
    test.use({viewport: {width, height: 900}});

    test('Every linked widget, rate row and the chart’s Details takes a 44px touch in the grid, and a touch anywhere on a linked widget lands on its press', async ({page}) => {
      await openEnergy(page, 'billing');
      await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', layout);
      await chartReady(page);
      await expectTouchTargets(page, host(page), PAGE_CONTROLS, {press: linked.length, row: 0, action: 1});
      await expect(host(page).locator('.m-energy [data-widget=rates] .m-row')).toHaveCount(2);
      await expectPressesCover(page);
    });

    test('Tapping each linked widget opens its sheet, and Back closes it', async ({page}) => {
      await openEnergy(page, 'billing');
      const energy = host(page).locator('.m-energy');
      const DETAIL = {price: 'price', year: 'billing-year', bill: 'bill', cap: 'bill', rates: 'price'};
      await expect(energy.locator('[data-widget]:has(.m-widget__press)')).toHaveCount(linked.length);
      for (const id of linked) await expectTapOpens(page, energy.locator(`[data-widget=${id}]`), DETAIL[id]);
      await expectTapOpens(page, energy.locator('[data-widget=chart] .m-widget__action'), 'energy-today');
      // A rate row is its widget's too.
      await expectTapOpens(page, energy.locator('[data-widget=rates] .m-row').last(), 'price');
    });
  });
}

test('Every row, link and Why in the four sheets takes a 44px touch', async ({page}) => {
  // Over the billing house: each sheet's Why, the day sheet's seven readings
  // and its Full history, and the Bill's two links.
  for (const [detail, counts] of [
    ['price', {row: 0, link: 0, disclosure: 1}],
    ['billing-year', {row: 0, link: 0, disclosure: 1}],
    ['bill', {row: 0, link: 2, disclosure: 1}],
    ['energy-today', {row: 7, link: 1, disclosure: 1}],
  ]) {
    await openEnergy(page, 'billing', `energy/${detail}`);
    const sheet = await sheetAtRest(page, detail);
    await openDisclosures(sheet);
    expect(await expectTouchTargets(page, sheet.locator('.m-sheet__body'), SHEET_CONTROLS, counts), detail).toBeGreaterThan(0);
  }
});

test('A direct #energy/bill opens the Bill sheet over Energy', async ({page}) => {
  await openEnergy(page, 'billing', 'energy/bill');
  const sheet = await sheetAtRest(page, 'bill');
  await expect(sheet.locator('.m-energy-sheet--bill')).toBeVisible();
  await expect(host(page).locator('.m-tabbar').getByRole('button', {name: 'Energy', exact: true})).toHaveAttribute('aria-current', 'page');
  // Closed, it leaves Energy at #energy.
  await sheet.locator('.m-sheet__close').tap();
  await expect(page.locator('.m-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/#energy$/);
  await expect(host(page).locator('.m-energy')).toBeVisible();
});

// Whether the document scrolls sideways: wider than the viewport, or moved
// by a scroll to the right. Then, with a sheet open, the sheet's own box in
// the viewport and its body's sideways scroll.
const documentSideways = page => page.evaluate(() => {
  const y = scrollY;
  scrollTo(10_000, y);
  const scrolled = scrollX;
  scrollTo(0, y);
  return {wider: document.documentElement.scrollWidth > document.documentElement.clientWidth, scrolled};
});
const sheetSideways = sheet => sheet.evaluate(el => {
  const box = el.getBoundingClientRect(), body = el.querySelector('.m-sheet__body');
  const before = body.scrollLeft; body.scrollLeft = 10_000; const moved = body.scrollLeft; body.scrollLeft = before;
  return {inside: box.left >= -.5 && box.right <= innerWidth + .5, body: body.scrollWidth > body.clientWidth || moved !== 0 ? `${body.scrollWidth} > ${body.clientWidth}, scrolled ${moved}` : null};
});

test('Nothing scrolls sideways at 320, 375 and 393px, on the page or in any sheet with its Why open', async ({page}) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Every sheet over the billing and the missing house; the Bill's covered
  // row; the night's price and day.
  const ALL = Object.keys(TITLES);
  const VIEWS = [['billing', ALL], ['covered', ['bill', 'billing-year']], ['night', ['price', 'energy-today']], ['missing', ALL]];
  for (const width of [320, 375, 393]) {
    await page.setViewportSize({width, height: 800});
    for (const [fixture, details] of VIEWS) {
      await openEnergy(page, fixture);
      await expect(host(page).locator('.m-energy')).toBeVisible();
      expect(await documentSideways(page), `${width}px ${fixture} page`).toEqual({wider: false, scrolled: 0});
      for (const detail of details) {
        const sheet = await openSheet(page, detail);
        await openDisclosures(sheet);
        await frames(page);
        expect(await documentSideways(page), `${width}px ${fixture} ${detail}`).toEqual({wider: false, scrolled: 0});
        expect(await sheetSideways(sheet), `${width}px ${fixture} ${detail}`).toEqual({inside: true, body: null});
        await page.keyboard.press('Escape');
        await expect(page.locator('.m-sheet')).toHaveCount(0);
      }
    }
  }
  expect(errors).toEqual([]);
});

// The phone's chart scrolled into the middle of the screen, or as near as
// the page's end lets it come (it is the last but one widget), with room to
// scroll back up, and what it shows at rest.
async function phoneChart(page) {
  await openEnergy(page, 'billing');
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  await chartReady(page);
  const chart = host(page).locator('.m-energy [data-widget=chart] .m-power'), plot = chart.locator('.m-power__plot');
  await plot.evaluate(el => el.scrollIntoView({block: 'center'}));
  await frames(page);
  expect(await page.evaluate(() => scrollY), 'room to scroll back').toBeGreaterThan(100);
  return {chart, plot, rest: await read(chart)};
}
// What the chart shows: its scrub rule, its line over the figures (the
// scrubbed half hour while scrubbing, 'Today' otherwise), its figures; and
// the page's scroll.
const read = chart => chart.evaluate(el => ({rule: el.querySelectorAll('.m-power__rule').length, subtitle: el.querySelector('.m-power__when').textContent,
  legend: [...el.querySelectorAll('.m-power__figure dd')].map(dd => dd.textContent).join(' | '), top: Math.round(scrollY)}));
const isChromium = page => page.context().browser().browserType().name() === 'chromium';

// A finger's drag across the plot from its point at `from` (fractions of
// its box) by `steps` moves of (dx, dy), 30ms apart, then `during`, then
// lifted: a real touch on Chromium; on WebKit, touch pointer events
// dispatched on the plot, which is what React listens to, ending in a
// pointercancel where `scrolls` says the page would have taken the swipe
// for a scroll, as a browser does.
async function drag(page, plot, {from = [.3, .5], dx = 0, dy = 0, steps = 8, scrolls = false, during} = {}) {
  const box = await plot.boundingBox(), x = Math.round(box.x + box.width * from[0]), y = Math.round(box.y + box.height * from[1]);
  const at = i => ({x: Math.round(x + dx * i), y: Math.round(y + dy * i)});
  if (isChromium(page)) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: point ? [point] : []});
    await touch('touchStart', at(0));
    for (let i = 1; i <= steps; i++) { await page.waitForTimeout(30); await touch('touchMove', at(i)); }
    await page.waitForTimeout(80);
    await during?.();
    await touch('touchEnd');
    await cdp.detach();
  } else {
    const fire = (type, point) => plot.evaluate((el, [type, {x, y}]) => el.dispatchEvent(new PointerEvent(type, {pointerId: 7, pointerType: 'touch', isPrimary: true,
      bubbles: true, cancelable: true, composed: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y})), [type, point]);
    await fire('pointerdown', at(0));
    for (let i = 1; i <= steps; i++) await fire('pointermove', at(i));
    await frames(page);
    await during?.();
    await fire(scrolls ? 'pointercancel' : 'pointerup', at(steps));
  }
  await frames(page);
}

test('A sideways drag on the phone’s chart scrubs it and never scrolls the page, and lifting clears the scrub', async ({page}) => {
  const {chart, plot, rest} = await phoneChart(page);
  expect(rest.rule).toBe(0);
  let during;
  // Across the morning: the chart is the day from midnight, and at 12:30
  // the record covers only its first half.
  await drag(page, plot, {from: [.1, .5], dx: 8, during: async () => { during = await read(chart); }});
  // The rule at the scrubbed half hour, which the line over the figures
  // gives in place of 'Today'; the page stays where it was.
  expect(during.rule).toBe(1);
  expect(during.subtitle).not.toBe(rest.subtitle);
  expect(during.subtitle).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
  expect(during.top).toBe(rest.top);
  await expect.poll(() => read(chart)).toEqual(rest);
});

test('A vertical swipe that starts on the phone’s chart scrolls the page and never shows the scrub', async ({page}) => {
  const {chart, plot, rest} = await phoneChart(page);
  // Each frame's rule and subtitle while the finger moves, and the plot's
  // pointer events.
  await chart.evaluate(el => {
    globalThis.maisonFrames = [];
    globalThis.maisonEvents = [];
    globalThis.maisonSampling = true;
    const tick = () => {
      globalThis.maisonFrames.push({rule: el.querySelectorAll('.m-power__rule').length, subtitle: el.querySelector('.m-power__when').textContent});
      if (globalThis.maisonSampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) el.querySelector('.m-power__plot').addEventListener(type, event => globalThis.maisonEvents.push(event.type));
  });
  // Down the plot, with a little sideways wander: 10 moves of 12px, which
  // scroll the page back up.
  await drag(page, plot, {from: [.5, .3], dx: .8, dy: 12, steps: 10, scrolls: true});
  const {samples, events} = await page.evaluate(() => { globalThis.maisonSampling = false; return {samples: globalThis.maisonFrames, events: globalThis.maisonEvents}; });
  expect(samples.length, 'frames sampled').toBeGreaterThan(5);
  expect(samples.filter(frame => frame.rule || frame.subtitle !== rest.subtitle), 'frames showing a scrub').toEqual([]);
  expect(events[0]).toBe('pointerdown');
  if (isChromium(page)) {
    // The page took the swipe as a scroll, and cancelled the plot's pointer.
    await expect.poll(async () => (await read(chart)).top).toBeLessThan(rest.top);
    expect(events).toContain('pointercancel');
  } else expect(events.at(-1)).toBe('pointercancel');
  const after = await read(chart);
  expect({rule: after.rule, subtitle: after.subtitle, legend: after.legend}).toEqual({rule: 0, subtitle: rest.subtitle, legend: rest.legend});
});

// The phone tab bar floats over the foot of the screen, so nothing above it
// may give it a containing block (a transform, a filter, containment, a
// will-change or a perspective): with Energy scrolled to its end, the bar
// is still at the screen's foot and the last of Energy sits above it.
test('Nothing above the phone tab bar on Energy gives it a containing block, and the last of Energy clears it', async ({page}) => {
  await openEnergy(page, 'billing');
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  await chartReady(page);
  const found = await host(page).evaluate(el => {
    const up = node => node.assignedSlot ?? node.parentElement ?? node.parentNode?.host ?? null;
    const initial = {transform: 'none', translate: 'none', rotate: 'none', scale: 'none', perspective: 'none', filter: 'none', backdropFilter: 'none',
      webkitBackdropFilter: 'none', contain: 'none', containerType: 'normal', contentVisibility: 'visible', willChange: 'auto'};
    const bar = el.shadowRoot.querySelector('.m-tabbar'), found = [];
    for (let node = up(bar); node && node.nodeType === Node.ELEMENT_NODE; node = up(node)) {
      const style = getComputedStyle(node);
      for (const [property, value] of Object.entries(initial)) if (style[property] !== undefined && style[property] !== value) found.push(`${node.localName}.${[...node.classList].join('.')} ${property}: ${style[property]}`);
    }
    return {position: getComputedStyle(bar).position, found};
  });
  expect(found).toEqual({position: 'fixed', found: []});
  const {last, bar, screen} = await host(page).evaluate(async el => {
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const energy = el.shadowRoot.querySelector('.m-energy'), bar = el.shadowRoot.querySelector('.m-tabbar').getBoundingClientRect();
    return {last: Math.max(...[...energy.querySelectorAll('.m-widgets > *')].map(child => child.getBoundingClientRect().bottom)), bar: {top: bar.top, bottom: bar.bottom}, screen: innerHeight};
  });
  expect(bar.bottom).toBeLessThanOrEqual(screen - 16 + 0.5);
  expect(bar.bottom).toBeGreaterThan(screen - 60);
  expect(last).toBeLessThanOrEqual(bar.top);
});
