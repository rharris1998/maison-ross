import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';
import {CLIMATE_FIXTURES, CLIMATE_NOW} from '../fixtures/climate-fixtures.js';
import {CLIMATE_CONTRACT, TOWEL_RAILS} from '../../../config/www/maison/model.js';

// Maison's Climate (#29 step 4, v32) and its sheets on a touch
// screen, over the Climate fixtures' states at the fixtures' time, with the
// preview's sample history so every sheet draws its charts: every zone row,
// Details, house action and rail button on the page, and every stepper,
// segment, switch, disclosure, date field and button in the House, Attic
// and rails sheets, takes a 44px touch; from 700px each Details reaches 44px
// round its title and ends where the control under it begins, and a touch
// anywhere on a zone widget, its bar included, opens that zone's sheet;
// nothing scrolls sideways at 320, 375 or 393px, on the page or in any sheet
// with its disclosures open, and nothing logs an error; a sideways drag on
// a chart scrubs it and lifting clears it, while a vertical swipe that
// starts on a chart scrolls the sheet and never shows the scrub, frame by
// frame, nor moves the sheet; a busy Dry towels and a busy Cancel override
// keep their focus, through the write and what it turns them into; the
// House sheet's disclosures open and close by touch, add no height while
// closed and keep a closed panel out of the Tab order; the Away date field
// in the real sheet sends away-until with its value and keeps its draft; and
// nothing above the phone tab bar gives it a containing block. On the
// Chromium projects a swipe is a real touch (CDP touch events, as in
// sheet.touch.spec.mjs); WebKit has no touch input in Playwright, so
// there a drag on a chart is pointer events dispatched on the plot, which
// checks the chart's own rule (a finger scrubs only once it moves sideways)
// but not touch-action's; Alex's iPhone checks that.
test.beforeEach(exposeIPhonePlatform);

const host = page => page.locator('maison-dashboard');
const byId = id => CLIMATE_FIXTURES.find(fixture => fixture.id === id);
const HOUSE_HEATING = CLIMATE_CONTRACT.houseHeating, ENSUITE_DRYING = TOWEL_RAILS[0].drying;
// What the page offers to press on a phone and in the grid: the zones (rows,
// or widgets whose press covers them), each widget's Details, the House
// card's one action and the rails' buttons.
const PAGE_CONTROLS = {
  row: '.m-climate .m-row--pressable', press: '.m-climate .m-widget__press', details: '.m-climate .m-widget__action',
  house: '.m-climate [data-widget=house] .m-button', rail: '.m-climate [data-widget=rails] .m-row .m-button',
};
// What a sheet body offers, by kind, the kinds the task names first; every
// other button (Hold, Cancel, Set Away, Full history, the links) is a button.
const SHEET_CONTROLS = {
  step: '.m-stepper__step', segment: '.m-segmented__item', switch: 'label.m-switch', disclosure: '.m-disclosure__trigger',
  date: 'input.m-date-field__input', button: 'button:not(.m-stepper__step, .m-segmented__item, .m-disclosure__trigger)',
};

// Climate over fixture `id`'s states, pinned so a reused
// preview's snapshot never reaches it, with the clock at the fixtures'
// time, so it reads as the Node tests read it, at `hash`; then the
// preview's sample history and schedules, so the sheets draw their charts.
// The clock and the registry are set once per page, the states on each load.
// A page already on the preview leaves it first, since a goto that changes
// only the fragment would not reload the states.
const prepared = new WeakSet();
async function openClimate(page, id, hash = 'climate') {
  if (!prepared.has(page)) {
    prepared.add(page);
    await page.addInitScript(fixed => {
      const NativeDate = Date;
      globalThis.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
    }, CLIMATE_NOW);
    await page.route('**/registry.json', route => route.fulfill({json: {areas: [], devices: [], entities: []}}));
  }
  await page.unroute('**/states.json');
  await page.route('**/states.json', route => route.fulfill({json: {source: `Synthetic touch regression · Climate ${id}`, states: byId(id).states}}));
  if (page.url() !== 'about:blank') await page.goto('about:blank');
  await page.goto(`/#${hash}`);
  await expect(host(page).locator('.m-climate')).toBeAttached();
  await page.locator('#data-mode').selectOption('sample');
}

// The sheet has finished entering (React Aria drops data-entering when the
// animations end) and every chart in it is drawn.
async function sheetAtRest(page) {
  const sheet = page.locator('.m-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.m-sheet[data-entering], .m-sheet-overlay[data-entering]')).toHaveCount(0);
  await expect.poll(() => sheet.evaluate(el => el.querySelectorAll('.m-history').length > 0 && el.querySelectorAll('.m-history').length === el.querySelectorAll('.m-history__plot').length)).toBe(true);
  return sheet;
}

// Opens `detail`'s sheet over the page by its route, as a row or a link does.
async function openSheet(page, detail) {
  await page.evaluate(detail => { location.hash = `climate/${detail}`; }, detail);
  return sheetAtRest(page);
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
// box, or its ::after extension: a zone widget's press is the title's
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
// is how many of each kind there are, or, where it is a function, a check
// on that number. Returns how many were probed.
async function expectTouchTargets(page, scope, kinds, counts) {
  let probed = 0;
  for (const [kind, selector] of Object.entries(kinds)) {
    const controls = scope.locator(selector);
    if (typeof counts[kind] === 'number') await expect(controls, kind).toHaveCount(counts[kind]);
    else if (counts[kind]) counts[kind](await controls.count(), kind);
    for (const [index, control] of (await controls.all()).entries()) {
      if (!await control.evaluate(el => el.getClientRects().length > 0)) continue;
      await expectTouchTarget(page, control, `${kind} ${index + 1}: ${await control.getAttribute('aria-label') ?? (await control.textContent()).trim()}`);
      probed++;
    }
  }
  return probed;
}
const some = (count, kind) => expect(count, kind).toBeGreaterThan(0);

test('Every zone row, Details, house action and rail button on the Climate page takes a 44px touch on a phone', async ({page}) => {
  await openClimate(page, 'house_running');
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  // Four zones as rows, the House's and the rails' Details, "Set an
  // override…", and each rail's Dry towels.
  await expectTouchTargets(page, host(page), PAGE_CONTROLS, {row: 4, press: 0, details: 2, house: 1, rail: 2});
});

test('Every stepper, segment, switch, disclosure, date field and button in the House, Attic and rails sheets takes a 44px touch', async ({page}) => {
  // The House over its override (a stepper, the ends, two disclosures, the
  // Away date once open); the Attic over an override the house can't serve
  // (the warm offer, three steppers, the Airco's switches); the rails, one
  // drying.
  for (const [fixture, detail, counts] of [
    ['house_running', 'house', {step: 2, segment: some, switch: 0, disclosure: 2, date: 1, button: some}],
    ['zone_override', 'attic', {step: 6, segment: 0, switch: 2, disclosure: 0, date: 0, button: some}],
    ['house_override', 'towel-rails', {step: 0, segment: 0, switch: 0, disclosure: 0, date: 0, button: some}],
  ]) {
    await openClimate(page, fixture, `climate/${detail}`);
    const sheet = await sheetAtRest(page);
    await openDisclosures(sheet);
    expect(await expectTouchTargets(page, sheet.locator('.m-sheet__body'), SHEET_CONTROLS, counts), detail).toBeGreaterThan(0);
  }
});

// A control's reach round its box's centre: how far a touch can land above,
// below, left and right of it (scanned every quarter pixel, to 40px) and
// still hit it, and what takes a touch just past its reach below.
function reach(el) {
  const root = el.getRootNode(), box = el.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  const scan = (dx, dy) => { for (let d = 0; d <= 40; d += .25) { const hit = root.elementFromPoint(cx + dx * d, cy + dy * d); if (hit !== el && !el.contains(hit)) return {d, hit}; } return {d: 40, hit: null}; };
  const down = scan(0, 1), under = down.hit?.closest('button');
  return {up: scan(0, -1).d, down: down.d, left: scan(-1, 0).d, right: scan(1, 0).d,
    under: under && el.closest('[data-widget]').contains(under) ? under.className.split(/\s+/).filter(name => name.startsWith('m-button')).join('.') : `${down.hit?.localName}.${String(down.hit?.className).trim().split(/\s+/)[0]}`};
}

// In the page: every hit of an 11 × 11 grid over `area` (inset 2px from its
// edges) that doesn't land on its press, which should take them all: the
// element `press` selects in it, or the area itself. The points a rounded
// corner cuts off (the area's own, its list's or its widget's) are left
// out: nothing is drawn there.
function missesOver(area, press) {
  press = press ? area.querySelector(press) : area;
  const box = area.getBoundingClientRect(), root = area.getRootNode(), misses = [];
  const radius = Math.max(...[area, area.closest('.m-list'), area.closest('.m-widget')].filter(Boolean).map(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0));
  const drawn = (x, y) => Math.hypot(Math.max(box.left + radius - x, x - box.right + radius, 0), Math.max(box.top + radius - y, y - box.bottom + radius, 0)) <= radius;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    const x = box.left + 2 + (box.width - 4) * i / 10, y = box.top + 2 + (box.height - 4) * j / 10, hit = root.elementFromPoint(x, y);
    if (drawn(x, y) && hit !== press && !press.contains(hit)) misses.push(`(${i}, ${j}) lands on ${hit?.localName}.${String(hit?.className?.baseVal ?? hit?.className).trim().split(/\s+/)[0]}`);
  }
  return misses;
}

test('A touch anywhere on a zone row lands on its press on a phone', async ({page}) => {
  await openClimate(page, 'house_running');
  const rows = host(page).locator(PAGE_CONTROLS.row);
  await expect(rows).toHaveCount(4);
  for (const row of await rows.all()) {
    await row.evaluate(el => el.scrollIntoView({block: 'center'}));
    await frames(page);
    expect(await row.evaluate(missesOver), await row.getAttribute('aria-label')).toEqual([]);
  }
});

// From 700px: the grid's narrowest widgets in each layout, a wide 700px and
// a desktop 1,100px.
for (const width of [700, 1100]) {
  test.describe(`from 700px, at ${width}px`, () => {
    test.use({viewport: {width, height: 900}});

    test('Every zone widget, house action and rail button takes a 44px touch in the grid', async ({page}) => {
      await openClimate(page, 'house_running');
      await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', width < 1100 ? 'wide' : 'desktop');
      // The zones as widgets, "Set an override…", each rail's Dry towels;
      // the Details have a test of their own.
      const {row, press, house, rail} = PAGE_CONTROLS;
      await expectTouchTargets(page, host(page), {row, press, house, rail}, {row: 0, press: 4, house: 1, rail: 2});
    });

    // A Details sits on its title's row, the widget's first control under it
    // (the House's action, the first rail's button) 12px below the title:
    // its touch is 44px tall round the title, no taller, reaching down to
    // where that control's begins, so no touch between them lands on
    // nothing, and wider than 44px.
    test('Each Details takes 44px round its title and ends where the control under it begins', async ({page}) => {
      await openClimate(page, 'house_running');
      const actions = host(page).locator(PAGE_CONTROLS.details);
      await expect(actions).toHaveCount(2);
      for (const action of await actions.all()) {
        await action.evaluate(el => el.scrollIntoView({block: 'center'}));
        await frames(page);
        const {up, down, left, right, under} = await action.evaluate(reach);
        const name = await action.getAttribute('aria-label');
        expect(up, `${name} above`).toBeGreaterThanOrEqual(21.5);
        expect(down, `${name} below`).toBeGreaterThanOrEqual(21.5);
        expect(up + down, `${name} height`).toBeLessThanOrEqual(45.5);
        expect(left + right, `${name} width`).toBeGreaterThanOrEqual(44);
        expect(under, `${name}: what a touch just below it lands on`).toMatch(/^m-button\b/);
      }
    });

    // A zone widget is one press, its title's button, whose ::after covers
    // it: every point of it lands there, and a tap on its bar (hidden from
    // assistive technology, with no role) opens the zone's sheet, which
    // gives focus back to the press when it closes.
    test('A touch anywhere on a zone widget lands on its press, and a tap on its bar opens its sheet', async ({page}) => {
      await openClimate(page, 'house_running');
      const widgets = host(page).locator('.m-climate [data-widget]:has(.m-widget__press)');
      await expect(widgets).toHaveCount(4);
      for (const widget of await widgets.all()) {
        const id = await widget.getAttribute('data-widget'), press = widget.locator('.m-widget__press');
        await widget.evaluate(el => el.scrollIntoView({block: 'center'}));
        await frames(page);
        expect(await widget.evaluate(missesOver, '.m-widget__press'), id).toEqual([]);
        // Where the bar is drawn: the press's ::after takes the touch there.
        const bar = await widget.locator('.m-target-bar').boundingBox();
        await page.touchscreen.tap(bar.x + bar.width / 2, bar.y + bar.height / 2);
        await expect(page).toHaveURL(new RegExp(`#climate/${id}$`));
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.locator('.m-sheet[data-entering], .m-sheet-overlay[data-entering]')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.locator('.m-sheet')).toHaveCount(0);
        await expect(press).toBeFocused();
      }
    });
  });
}

// Whether the document scrolls sideways: wider than the viewport, or moved
// by a scroll to the right. Then, with a sheet open, the sheet's own box in
// the viewport, its body's, and every field's font size (iOS zooms into one
// under 16px).
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
  return {inside: box.left >= -.5 && box.right <= innerWidth + .5, body: body.scrollWidth > body.clientWidth || moved !== 0 ? `${body.scrollWidth} > ${body.clientWidth}, scrolled ${moved}` : null,
    small: [...el.querySelectorAll('input, select, textarea')].map(field => getComputedStyle(field).fontSize).filter(size => parseFloat(size) < 16)};
});

test('Nothing scrolls sideways at 320, 375 and 393px, on the page or in any sheet with its disclosures open', async ({page}) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Every sheet over the running house; the Attic's warm offer and Airco;
  // the flags, whose badges sit by the zones' names.
  const VIEWS = [['house_running', ['house', 'attic', 'sam', 'noah', 'bedroom-suite', 'towel-rails']], ['zone_override', ['attic']], ['dry_humid', ['bedroom-suite']]];
  for (const width of [320, 375, 393]) {
    await page.setViewportSize({width, height: 800});
    for (const [fixture, details] of VIEWS) {
      await openClimate(page, fixture);
      await expect(host(page).locator('.m-climate')).toBeVisible();
      expect(await documentSideways(page), `${width}px ${fixture} page`).toEqual({wider: false, scrolled: 0});
      for (const detail of details) {
        const sheet = await openSheet(page, detail);
        await openDisclosures(sheet);
        await frames(page);
        expect(await documentSideways(page), `${width}px ${fixture} ${detail}`).toEqual({wider: false, scrolled: 0});
        expect(await sheetSideways(sheet), `${width}px ${fixture} ${detail}`).toEqual({inside: true, body: null, small: []});
        await page.keyboard.press('Escape');
        await expect(page.locator('.m-sheet')).toHaveCount(0);
      }
    }
  }
  expect(errors).toEqual([]);
});

// The House sheet's first chart (Temperature and target) scrolled into the
// middle of the body, with room to scroll on, and what it shows at rest.
async function houseChart(page) {
  await openClimate(page, 'house_running', 'climate/house');
  const sheet = await sheetAtRest(page), chart = sheet.locator('.m-history').first(), plot = chart.locator('.m-history__plot');
  await plot.evaluate(el => el.scrollIntoView({block: 'center'}));
  await frames(page);
  const body = sheet.locator('.m-sheet__body');
  expect(await body.evaluate(el => el.scrollTop + el.clientHeight < el.scrollHeight - 100), 'room to scroll on').toBe(true);
  return {sheet, chart, plot, body, rest: await read(chart)};
}
// What a chart shows: its scrub rule, its subtitle (the scrubbed time while
// scrubbing), its legend's values; and its sheet's drag and scroll.
const read = chart => chart.evaluate(el => ({rule: el.querySelectorAll('.m-history__rule').length, subtitle: el.querySelector('.m-history__subtitle').textContent,
  legend: [...el.querySelectorAll('.m-history__legend dd')].map(dd => dd.textContent).join(' | '),
  sheet: el.closest('.m-sheet').style.transform, top: el.closest('.m-sheet__body').scrollTop}));
const isChromium = page => page.context().browser().browserType().name() === 'chromium';

// A finger's drag across the plot from its point at `from` (fractions of
// its box) by `steps` moves of (dx, dy), 30ms apart, then `during`, then
// lifted: a real touch on Chromium; on WebKit, touch pointer events
// dispatched on the plot, which is what React listens to, ending in a
// pointercancel where `scrolls` says the sheet would have taken the swipe
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

test('A sideways drag on a chart scrubs it, never moves or scrolls the sheet, and lifting clears the scrub', async ({page}) => {
  const {chart, plot, rest} = await houseChart(page);
  expect(rest.rule).toBe(0);
  let during;
  await drag(page, plot, {dx: 15, during: async () => { during = await read(chart); }});
  // The rule at the scrubbed time, which the subtitle gives in place of the
  // chart's own; the sheet stays where it was.
  expect(during.rule).toBe(1);
  expect(during.subtitle).not.toBe(rest.subtitle);
  expect({sheet: during.sheet, top: during.top}).toEqual({sheet: '', top: rest.top});
  await expect.poll(() => read(chart)).toEqual(rest);
  // A tap on the plot scrubs nothing and leaves nothing.
  await plot.tap({position: {x: 60, y: 40}});
  await frames(page);
  expect(await read(chart)).toEqual(rest);
});

test('A vertical swipe that starts on a chart scrolls the sheet and never shows the scrub', async ({page}) => {
  const {chart, plot, rest} = await houseChart(page);
  // Each frame's rule, subtitle and sheet transform while the finger moves,
  // and the plot's pointer events.
  await chart.evaluate(el => {
    const sheet = el.closest('.m-sheet');
    globalThis.maisonFrames = [];
    globalThis.maisonEvents = [];
    globalThis.maisonSampling = true;
    const tick = () => {
      globalThis.maisonFrames.push({rule: el.querySelectorAll('.m-history__rule').length, subtitle: el.querySelector('.m-history__subtitle').textContent, sheet: sheet.style.transform});
      if (globalThis.maisonSampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) el.querySelector('.m-history__plot').addEventListener(type, event => globalThis.maisonEvents.push(event.type));
  });
  // Up the plot, with a little sideways wander: 10 moves of 12px.
  await drag(page, plot, {from: [.5, .6], dx: .8, dy: -12, steps: 10, scrolls: true});
  const {samples, events} = await page.evaluate(() => { globalThis.maisonSampling = false; return {samples: globalThis.maisonFrames, events: globalThis.maisonEvents}; });
  expect(samples.length, 'frames sampled').toBeGreaterThan(5);
  expect(samples.filter(frame => frame.rule || frame.subtitle !== rest.subtitle), 'frames showing a scrub').toEqual([]);
  expect(samples.filter(frame => frame.sheet), 'frames with the sheet moved').toEqual([]);
  expect(events[0]).toBe('pointerdown');
  if (isChromium(page)) {
    // The sheet took the swipe as a scroll, and cancelled the plot's pointer.
    await expect.poll(async () => (await read(chart)).top).toBeGreaterThan(rest.top);
    expect(events).toContain('pointercancel');
  } else expect(events.at(-1)).toBe('pointercancel');
  const after = await read(chart);
  expect({rule: after.rule, subtitle: after.subtitle, legend: after.legend, sheet: after.sheet}).toEqual({rule: 0, subtitle: rest.subtitle, legend: rest.legend, sheet: ''});
});

// Where focus is, through every shadow root: the element's probe mark (set
// by the test on the control it pressed), its label, and whether it is busy.
const focused = page => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return {probe: el?.dataset.probe ?? null, label: el?.querySelector('.m-button__label')?.textContent.trim(), pending: el?.hasAttribute('data-pending')};
});

// The element's service calls, counted as they go out; the preview answers
// after 15s, so a write stays in flight until the test confirms it by
// replacing `id`'s state with `state`, as Home Assistant would.
async function holdWrites(page) {
  await page.locator('#behavior').selectOption('delay');
  await host(page).evaluate(el => {
    const send = el.hass.callService;
    globalThis.maisonCalls = [];
    el.hass.callService = (domain, service, data) => { globalThis.maisonCalls.push(`${domain}.${service} ${data?.entity_id ?? ''}`.trim()); return send(domain, service, data); };
  });
  return {calls: () => page.evaluate(() => globalThis.maisonCalls), confirm: (id, state) => host(page).evaluate((el, [id, state]) => { el.hass = {...el.hass, states: {...el.hass.states, [id]: state}}; }, [id, state])};
}

// Tapped, `button` (labelled `label`) sends one write, turns busy with its
// label kept, keeps focus and ignores a second tap (forced: a busy button
// is aria-disabled, which Playwright would wait out); once its write lands
// (`id` becomes `state`), the button it turns into, labelled `next`, is the
// same element and still holds focus.
async function expectBusyKeepsFocus(page, button, {label, next, id, state}) {
  const {calls, confirm} = await holdWrites(page);
  await button.evaluate(el => { el.dataset.probe = 'pressed'; });
  await button.scrollIntoViewIfNeeded();
  await button.tap();
  await expect.poll(calls).toHaveLength(1);
  await expect(button).toHaveAttribute('data-pending', 'true');
  expect(await focused(page)).toEqual({probe: 'pressed', label, pending: true});
  await button.tap({force: true});
  await page.waitForTimeout(300);
  expect(await calls()).toHaveLength(1);
  expect(await focused(page)).toEqual({probe: 'pressed', label, pending: true});
  await confirm(id, state);
  await expect(button).not.toHaveAttribute('data-pending');
  await expect.poll(() => focused(page)).toEqual({probe: 'pressed', label: next, pending: false});
}

test('Tapped, Dry towels turns busy, keeps its focus and hands it to Stop', async ({page}) => {
  await openClimate(page, 'house_running');
  const button = host(page).locator(PAGE_CONTROLS.rail).first();
  await expect(button.locator('.m-button__label')).toHaveText('Dry towels');
  // House override's Ensuite rail is drying until 10:15.
  await expectBusyKeepsFocus(page, button, {label: 'Dry towels', next: 'Stop', id: ENSUITE_DRYING, state: byId('house_override').states[ENSUITE_DRYING]});
});

test('Tapped, Cancel override turns busy, keeps its focus and hands it to Set an override…', async ({page}) => {
  await openClimate(page, 'house_override');
  const button = host(page).locator(PAGE_CONTROLS.house);
  await expect(button.locator('.m-button__label')).toHaveText('Cancel override');
  // Cancelled, the house heating runs on its schedule again, as House running's does.
  await expectBusyKeepsFocus(page, button, {label: 'Cancel override', next: 'Set an override…', id: HOUSE_HEATING, state: byId('house_running').states[HOUSE_HEATING]});
});

// Where focus is, through every shadow root, as the element's tag and name.
const focusName = page => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return `${el?.localName} ${el?.getAttribute('aria-label') || el?.textContent.trim().slice(0, 40)}`;
});

test('The House sheet’s disclosures open and close by touch, add no height while closed, and keep a closed panel out of the Tab order', async ({page}) => {
  await openClimate(page, 'house_running', 'climate/house');
  const sheet = await sheetAtRest(page), disclosures = sheet.locator('.m-disclosure');
  await expect(disclosures).toHaveCount(2);
  // A disclosure's height beyond its heading's, its trigger's state, and
  // whether what its panel holds is drawn (closed, React Aria hides the
  // panel until found: its box stays, its content is skipped).
  const state = disclosure => disclosure.evaluate(el => ({extra: Math.round((el.getBoundingClientRect().height - el.querySelector('.m-disclosure__heading').getBoundingClientRect().height) * 2) / 2,
    expanded: el.querySelector('.m-disclosure__trigger').getAttribute('aria-expanded'), shown: el.querySelector('.m-disclosure__panel').firstElementChild?.checkVisibility() ?? false}));
  const [away, why] = await disclosures.all();
  const [awayTrigger, whyTrigger] = [away, why].map(el => el.locator('.m-disclosure__trigger'));
  for (const disclosure of [away, why]) {
    expect(await state(disclosure)).toEqual({extra: 0, expanded: 'false', shown: false});
    expect((await disclosure.locator('.m-disclosure__trigger').boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  // Closed, Away's panel is skipped: Tab goes from its trigger to Why's.
  const whyName = await whyTrigger.textContent();
  await awayTrigger.focus();
  await page.keyboard.press('Tab');
  expect(await focusName(page)).toBe(`button ${whyName.trim()}`);
  for (const disclosure of [away, why]) {
    const trigger = disclosure.locator('.m-disclosure__trigger');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.tap();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const open = await state(disclosure);
    expect(open.shown).toBe(true);
    expect(open.extra).toBeGreaterThan(0);
  }
  // Open, its panel follows its trigger: Tab reaches the date field next.
  await awayTrigger.focus();
  await page.keyboard.press('Tab');
  expect(await focusName(page)).toMatch(/^input /);
  for (const disclosure of [away, why]) {
    await disclosure.locator('.m-disclosure__trigger').tap();
    await expect(disclosure.locator('.m-disclosure__trigger')).toHaveAttribute('aria-expanded', 'false');
    await frames(page);
    expect(await state(disclosure)).toEqual({extra: 0, expanded: 'false', shown: false});
  }
});

test('The Away date field in the real sheet takes focus, sends away-until with its value, and keeps focus and its draft', async ({page}) => {
  await openClimate(page, 'house_running', 'climate/house');
  let sheet = await sheetAtRest(page);
  await host(page).evaluate(el => {
    const command = el.command.bind(el);
    globalThis.maisonIntents = [];
    el.command = intent => { globalThis.maisonIntents.push(JSON.parse(JSON.stringify(intent))); return command(intent); };
  });
  const trigger = sheet.locator('.m-disclosure__trigger').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.tap();
  const input = sheet.locator('input.m-date-field__input');
  await expect(input).toBeVisible();
  expect(await input.evaluate(el => ({font: parseFloat(getComputedStyle(el).fontSize) >= 16, tall: el.getBoundingClientRect().height >= 44, labelled: Boolean(el.labels?.[0]?.textContent.trim())})))
    .toEqual({font: true, tall: true, labelled: true});
  await input.tap();
  await expect(input).toBeFocused();
  // Two days after the earliest it takes, at 17:00: inside its min and max.
  const value = await input.evaluate(el => {
    const date = new Date(el.min), pad = n => String(n).padStart(2, '0');
    date.setDate(date.getDate() + 2);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T17:00`;
  });
  const max = await input.getAttribute('max');
  if (max) expect(value <= max, `${value} within ${max}`).toBe(true);
  const body = sheet.locator('.m-sheet__body'), top = await body.evaluate(el => el.scrollTop);
  await input.fill(value);
  await expect.poll(() => page.evaluate(() => globalThis.maisonIntents)).toContainEqual({command: 'away-until', entity: 'house', value});
  // It keeps focus through the render its value brings, and its value.
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(value);
  // iOS's Done blurs it with nowhere to go: focus stays in the sheet, which
  // stays open where it was.
  await input.evaluate(el => el.blur());
  await frames(page);
  expect(await page.evaluate(() => { let el = document.activeElement; while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement; return Boolean(el?.closest('.m-sheet')); })).toBe(true);
  await expect(page.locator('.m-sheet')).toHaveCount(1);
  expect(Math.abs(await body.evaluate(el => el.scrollTop) - top)).toBeLessThan(2);
  // Closed and opened again, the sheet shows the draft.
  await page.keyboard.press('Escape');
  await expect(page.locator('.m-sheet')).toHaveCount(0);
  sheet = await openSheet(page, 'house');
  await sheet.locator('.m-disclosure__trigger').first().tap();
  await expect(sheet.locator('input.m-date-field__input')).toHaveValue(value);
});

// The phone tab bar floats over the foot of the screen, so nothing above it
// may give it a containing block (a transform, a filter, containment, a
// will-change or a perspective): with Climate scrolled to its end, the bar
// is still at the screen's foot and the last of Climate sits above it.
test('Nothing above the phone tab bar on Climate gives it a containing block, and the last of Climate clears it', async ({page}) => {
  await openClimate(page, 'house_running');
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
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
    const climate = el.shadowRoot.querySelector('.m-climate'), bar = el.shadowRoot.querySelector('.m-tabbar').getBoundingClientRect();
    return {last: Math.max(...[...climate.children].map(child => child.getBoundingClientRect().bottom)), bar: {top: bar.top, bottom: bar.bottom}, screen: innerHeight};
  });
  expect(bar.bottom).toBeLessThanOrEqual(screen - 16 + 0.5);
  expect(bar.bottom).toBeGreaterThan(screen - 60);
  expect(last).toBeLessThanOrEqual(bar.top);
});
