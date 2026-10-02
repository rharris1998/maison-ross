import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';
import {HOME_FIXTURES, HOME_NOW} from '../fixtures/home-fixtures.js';

// Maison's Home status and the dialogs (#29 step 4, v35) on a touch
// screen, over the home fixtures' states at their time: every row is at
// least 44px high, and every pressable row, the search field, its clear
// button and the category picker take a 44px touch, on a phone and from
// 700px, the field and the picker drawing their text at 16px or more (so
// iOS doesn't zoom in on focus); typing a query keeps the field focused
// keystroke by keystroke with the caret at its end, and filters the
// readings, and the clear button empties it and leaves it focused; the
// Search key (Enter) blurs it, its query and readings kept; the picker
// changes the category; Show more adds the next page of readings
// until none is left; a reading opens its more-info; nothing scrolls
// sideways at 320, 375 or 393px; a #life link lands on #today, and Back
// never comes back to it; the alerts (from the header's bell), an event
// (from a Coming up row) and the full calendar (from the event, and from
// Coming up's note) open as sheets and close, and the alerts' button leads
// to Home status; and the tab bar has four tabs. Checks are structural
// (classes, counts, geometry, and strings read from the fixtures or the
// page), not wording, and there are no accessibility checks (30/09). WebKit
// has no touch input in Playwright beyond tap, which is all this spec needs.
test.beforeEach(exposeIPhonePlatform);

const host = page => page.locator('maison-dashboard');
const byId = id => HOME_FIXTURES.find(fixture => fixture.id === id);
const MINUTE = 60_000;
// The full house with seventy readings more, so All sensors holds more than
// a page of them: Show more, twice.
const MANY = {...byId('full').states, ...Object.fromEntries(Array.from({length: 70}, (_, i) => {
  const entity_id = `sensor.synthetic_reading_${String(i + 1).padStart(2, '0')}`, at = new Date(HOME_NOW - MINUTE).toISOString();
  return [entity_id, {entity_id, state: String(100 + i), attributes: {friendly_name: `Synthetic reading ${i + 1}`, unit_of_measurement: 'W', device_class: 'power'},
    last_changed: at, last_updated: at, last_reported: at}];
}))};
// A reading whose name no other reading shares a word with, and so the
// query its first word makes matches it alone.
const GARDEN = 'sensor.garden_illuminance';
// Home status's parts: its readings (pressable rows with a tile), Show more
// (the list's bare pressable row), the field, its clear button and the
// picker's select, laid over its capsule.
const READINGS = '.m-system-page__readings .m-row--pressable:not(.m-row--bare)';
const MORE = '.m-system-page__readings .m-row--pressable.m-row--bare';
const FIELD = '.m-system-page .m-search-field__input', CLEAR = '.m-system-page .m-search-field__clear', PICKER = '.m-system-page .m-picker__select';

// The dashboard over `states` at `hash`, pinned so a reused preview's
// snapshot never reaches it, with the clock at the home fixtures' time, so
// it reads as the Node tests read it. The clock, the registry and a log of
// every more-info the element asks Home Assistant for (maisonMoreInfo, by
// entity) are set once per page, the states on each load. A page already on
// the preview leaves it first, since a goto that changes only the fragment
// would not reload the states.
const prepared = new WeakSet();
async function openDashboard(page, states, hash = 'system') {
  if (!prepared.has(page)) {
    prepared.add(page);
    await page.addInitScript(fixed => {
      const NativeDate = Date;
      globalThis.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
      globalThis.maisonMoreInfo = [];
      addEventListener('hass-more-info', event => globalThis.maisonMoreInfo.push(event.detail.entityId));
    }, HOME_NOW);
    await page.route('**/registry.json', route => route.fulfill({json: {areas: [], devices: [], entities: []}}));
  }
  await page.unroute('**/states.json');
  await page.route('**/states.json', route => route.fulfill({json: {source: 'Synthetic touch regression · Home status', states}}));
  if (page.url() !== 'about:blank') await page.goto('about:blank');
  await page.goto(`/#${hash}`);
}

// Home status over `states`.
async function openSystem(page, states = byId('full').states) {
  await openDashboard(page, states);
  await expect(host(page).locator('.m-system-page')).toBeVisible();
}

// Two frames: long enough for a layout or a render to have landed.
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// A 44px square around the centre of `control` lands on the control itself,
// probed ±21.5px on each axis, once it sits mid-screen (clear of the tab
// bar and the pill).
async function expectTouchTarget(page, control, name) {
  await control.evaluate(el => el.scrollIntoView({block: 'center', inline: 'nearest'}));
  await frames(page);
  const misses = await control.evaluate(el => {
    const box = el.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    return [[cx, cy - 21.5], [cx, cy + 21.5], [cx - 21.5, cy], [cx + 21.5, cy]].map(([x, y]) => {
      const hit = el.getRootNode().elementFromPoint(x, y);
      return hit === el || el.contains(hit) ? null : `(${Math.round(x - cx)}, ${Math.round(y - cy)}) lands on ${hit?.localName}.${String(hit?.className?.baseVal ?? hit?.className).trim().split(/\s+/).join('.')}`;
    }).filter(Boolean);
  });
  expect(misses, name).toEqual([]);
}

// Each shown control `selector` finds takes a 44px touch; returns how many.
async function expectTouchTargets(page, selector) {
  let probed = 0;
  for (const [index, control] of (await host(page).locator(selector).all()).entries()) {
    if (!await control.evaluate(el => el.getClientRects().length > 0)) continue;
    await expectTouchTarget(page, control, `${selector} ${index + 1}: ${(await control.textContent()).trim().slice(0, 40)}`);
    probed++;
  }
  return probed;
}

// Every row on the page at least 44px high: the rows that are shorter.
const shortRows = page => host(page).locator('.m-system-page .m-row').evaluateAll(rows => rows
  .filter(row => row.getClientRects().length && row.getBoundingClientRect().height < 44 - .5)
  .map(row => `${row.textContent.trim().slice(0, 40)}: ${row.getBoundingClientRect().height}`));
// A control's text size, in px.
const fontSize = control => control.evaluate(el => parseFloat(getComputedStyle(el).fontSize));

// The page's every row, its pressable rows, the field, the clear button
// (once there is a query) and the picker take their 44px, and the field and
// the picker draw 16px text or more.
async function expectSystemTargets(page) {
  expect(await shortRows(page)).toEqual([]);
  expect(await expectTouchTargets(page, '.m-system-page .m-row--pressable')).toBeGreaterThan(0);
  const field = host(page).locator(FIELD), picker = host(page).locator(PICKER);
  for (const control of [field, picker]) expect(await fontSize(control)).toBeGreaterThanOrEqual(16);
  await expectTouchTarget(page, field, 'search field');
  await expectTouchTarget(page, picker, 'category picker');
  await field.fill('a');
  await expect(host(page).locator(CLEAR)).toBeVisible();
  await expectTouchTarget(page, host(page).locator(CLEAR), 'clear button');
}

test('Every row on Home status is 44px high, and every pressable row, the field, its clear button and the picker take a 44px touch on a phone', async ({page}) => {
  await openSystem(page);
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  await expectSystemTargets(page);
});

// From 700px: two columns, at a wide 700px and a desktop 1,100px.
for (const [width, layout] of [[700, 'wide'], [1100, 'desktop']]) {
  test.describe(`from 700px, at ${width}px`, () => {
    test.use({viewport: {width, height: 900}});

    test('Every row is 44px high, and every pressable row, the field, its clear button and the picker take a 44px touch', async ({page}) => {
      await openSystem(page);
      await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', layout);
      await expectSystemTargets(page);
    });
  });
}

// Whether `field` holds focus (the active element of its shadow root, under
// the dashboard's in the document) and where its selection is.
const caret = field => field.evaluate(el => ({focused: el.getRootNode().activeElement === el && document.activeElement === el.getRootNode().host,
  start: el.selectionStart, end: el.selectionEnd}));

test('Typing a query keeps the field focused with the caret at its end and filters the readings, and the clear button empties it and keeps focus', async ({page}) => {
  await openSystem(page);
  const field = host(page).locator(FIELD), readings = host(page).locator(READINGS);
  const all = await readings.count(), name = byId('full').states[GARDEN].attributes.friendly_name, query = name.split(' ')[0];
  expect(all).toBeGreaterThan(1);
  await field.tap();
  await expect.poll(() => caret(field)).toEqual({focused: true, start: 0, end: 0});
  // Each keystroke renders the page at once; the field keeps focus, its
  // caret at the end of what is typed.
  for (const [index, key] of [...query].entries()) {
    await page.keyboard.type(key);
    await expect(field).toHaveValue(query.slice(0, index + 1));
    expect(await caret(field), `after ${query.slice(0, index + 1)}`).toEqual({focused: true, start: index + 1, end: index + 1});
  }
  await expect(readings).toHaveCount(1);
  await expect(readings.locator('.m-row__title')).toHaveText(name);
  // The clear button empties the field, every reading is back, and the
  // field still holds focus (the keyboard stays up).
  await host(page).locator(CLEAR).tap();
  await expect(field).toHaveValue('');
  await expect(readings).toHaveCount(all);
  await expect.poll(() => caret(field)).toEqual({focused: true, start: 0, end: 0});
  await expect(host(page).locator(CLEAR)).toBeHidden();
});

// The keyboard's Search key (Enter) puts the keyboard away, as iOS's search
// bars do: the field loses focus, and keeps its query and its readings.
test('The Search key blurs the field and keeps its query and readings', async ({page}) => {
  await openSystem(page);
  const field = host(page).locator(FIELD), readings = host(page).locator(READINGS);
  const name = byId('full').states[GARDEN].attributes.friendly_name, query = name.split(' ')[0];
  await field.tap();
  await page.keyboard.type(query);
  await expect(readings).toHaveCount(1);
  expect(await caret(field)).toEqual({focused: true, start: query.length, end: query.length});
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await caret(field)).focused).toBe(false);
  await expect(field).toHaveValue(query);
  await expect(readings).toHaveCount(1);
  await expect(readings.locator('.m-row__title')).toHaveText(name);
});

test('The category picker changes the category and the readings with it', async ({page}) => {
  await openSystem(page);
  const picker = host(page).locator(PICKER), label = host(page).locator('.m-system-page .m-picker__label'), readings = host(page).locator(READINGS);
  const all = await readings.count(), [first] = await picker.locator('option').evaluateAll(options => options.map(option => option.value));
  await expect(picker).toHaveValue(first);
  await expect(label).toHaveText(await picker.locator(`option[value="${first}"]`).textContent());
  // Temperature: the living room's and the cellar's, among others.
  await picker.selectOption('temperature');
  await expect(picker).toHaveValue('temperature');
  await expect(label).toHaveText(await picker.locator('option[value="temperature"]').textContent());
  await expect.poll(() => readings.count()).toBeLessThan(all);
  expect(await readings.count()).toBeGreaterThan(0);
  // Back to every reading.
  await picker.selectOption(first);
  await expect(label).toHaveText(await picker.locator(`option[value="${first}"]`).textContent());
  await expect(readings).toHaveCount(all);
});

test('Show more adds the next page of readings until none is left', async ({page}) => {
  await openSystem(page, MANY);
  const readings = host(page).locator(READINGS), more = host(page).locator(MORE);
  // The count beside the heading is every reading; the list shows a page.
  const total = Number(await host(page).locator('.m-system-page__section--sensors .m-chip__label').textContent()), pageSize = await readings.count();
  expect(total).toBeGreaterThan(2 * pageSize);
  for (let shown = pageSize; shown < total; shown = Math.min(total, shown + pageSize)) {
    await expect(more).toHaveCount(1);
    await expectTouchTarget(page, more, 'Show more');
    await more.tap();
    await expect(readings).toHaveCount(Math.min(total, shown + pageSize));
  }
  await expect(more).toHaveCount(0);
});

test('A reading opens its more-info', async ({page}) => {
  await openSystem(page);
  const query = byId('full').states[GARDEN].attributes.friendly_name.split(' ')[0];
  await host(page).locator(FIELD).fill(query);
  const reading = host(page).locator(READINGS);
  await expect(reading).toHaveCount(1);
  await reading.evaluate(el => el.scrollIntoView({block: 'center'}));
  await frames(page);
  await reading.tap();
  await expect.poll(() => page.evaluate(() => globalThis.maisonMoreInfo)).toEqual([GARDEN]);
});

// Whether the document scrolls sideways: wider than the viewport, or moved
// by a scroll to the right; and whether Home status sits in the viewport.
const sideways = page => page.evaluate(() => {
  const y = scrollY;
  scrollTo(10_000, y);
  const scrolled = scrollX;
  scrollTo(0, y);
  const box = document.querySelector('maison-dashboard').shadowRoot.querySelector('.m-system-page').getBoundingClientRect();
  return {wider: document.documentElement.scrollWidth > document.documentElement.clientWidth, scrolled, inside: box.left >= -.5 && box.right <= innerWidth + .5};
});

test('Nothing scrolls sideways at 320, 375 and 393px', async ({page}) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Each house, then the full one with a query nothing matches, and with
  // every reading of the long list shown.
  const VIEWS = [['full', byId('full').states], ['quiet', byId('quiet').states], ['missing', byId('missing').states], ['many', MANY]];
  for (const width of [320, 375, 393]) {
    await page.setViewportSize({width, height: 800});
    for (const [id, states] of VIEWS) {
      await openSystem(page, states);
      expect(await sideways(page), `${width}px ${id}`).toEqual({wider: false, scrolled: 0, inside: true});
    }
    await host(page).locator(FIELD).fill('zzzz');
    await expect(host(page).locator(READINGS)).toHaveCount(0);
    expect(await sideways(page), `${width}px no match`).toEqual({wider: false, scrolled: 0, inside: true});
    await openSystem(page, MANY);
    while (await host(page).locator(MORE).count()) {
      const shown = await host(page).locator(READINGS).count();
      await host(page).locator(MORE).evaluate(el => el.click());
      await expect.poll(() => host(page).locator(READINGS).count()).toBeGreaterThan(shown);
    }
    expect(await sideways(page), `${width}px every reading`).toEqual({wider: false, scrolled: 0, inside: true});
  }
  expect(errors).toEqual([]);
});

test('A #life link lands on #today, and Back never comes back to it', async ({page}) => {
  // Followed from another page, the #life entry becomes #today in place, so
  // Back returns to the page before it.
  await openDashboard(page, byId('full').states, 'energy');
  await expect(host(page).locator('.m-page')).toBeVisible();
  await expect(host(page).locator('.m-today')).toHaveCount(0);
  await page.evaluate(() => { location.hash = 'life'; });
  await expect(page).toHaveURL(/#today$/);
  await expect(host(page).locator('.m-today')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#energy$/);
  await expect(host(page).locator('.m-today')).toHaveCount(0);
  // Loaded at #life, the dashboard opens Today at #today, and Back leaves it
  // for where the browser was.
  await openDashboard(page, byId('full').states, 'life');
  await expect(page).toHaveURL(/#today$/);
  await expect(host(page).locator('.m-today')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
});

// The sheet has finished entering (React Aria drops data-entering when the
// animations end), drawing the dialog body `kind`.
async function dialogAtRest(page, kind) {
  const sheet = page.locator('.m-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.m-sheet[data-entering], .m-sheet-overlay[data-entering]')).toHaveCount(0);
  await expect(sheet.locator(`.m-sheet__body > .m-dialog.m-dialog--${kind}`)).toBeVisible();
  return sheet;
}

// Closes the open sheet by its close button.
async function closeSheet(page, sheet) {
  await sheet.locator('.m-sheet__close').tap();
  await expect(page.locator('.m-sheet')).toHaveCount(0);
}

// The full house's first event, which Coming up draws first.
const FIRST_EVENT = byId('full').agenda.events.reduce((first, event) => event.startMs < first.startMs ? event : first);

// Today over the full house, with its week's agenda
// handed to the element once the preview's own (empty) load has settled:
// the clock is frozen, so it doesn't load again. Coming up then draws the
// first event.
async function openToday(page) {
  const {states, agenda} = byId('full');
  await openDashboard(page, states, 'today');
  await expect(host(page).locator('.m-today')).toBeVisible();
  await expect.poll(() => host(page).evaluate(el => Boolean(el._agendaTime) && !el._agendaLoading)).toBe(true);
  await host(page).evaluate((el, agenda) => { el._agenda = agenda; el.render(); }, agenda);
  await expect(host(page).locator('[data-widget=upcoming] .m-row__title').filter({hasText: FIRST_EVENT.summary})).toHaveCount(1);
}

test('The header’s bell opens the alerts, which close, and whose button leads to Home status', async ({page}) => {
  await openToday(page);
  const bell = host(page).locator('.m-header__tools .m-button').first();
  await bell.tap();
  let sheet = await dialogAtRest(page, 'alerts');
  // The full house's alerts, each a row.
  const alerts = await sheet.locator('.m-dialog--alerts .m-list .m-row--pressable').count();
  expect(alerts).toBeGreaterThan(0);
  await closeSheet(page, sheet);
  await bell.tap();
  sheet = await dialogAtRest(page, 'alerts');
  await sheet.locator('.m-dialog--alerts > .m-button').tap();
  await expect(page.locator('.m-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/#system$/);
  await expect(host(page).locator('.m-system-page')).toBeVisible();
  // Needs attention there holds the same alerts.
  await expect(host(page).locator('.m-system-page__section--needs .m-row--pressable')).toHaveCount(alerts);
});

test('A Coming up row opens its event, whose button opens the full calendar, which closes', async ({page}) => {
  await openToday(page);
  const row = host(page).locator('[data-widget=upcoming] .m-row--pressable').filter({has: page.locator('.m-row__title', {hasText: FIRST_EVENT.summary})});
  await expect(row).toHaveCount(1);
  await row.evaluate(el => el.scrollIntoView({block: 'center'}));
  await frames(page);
  await row.tap();
  let sheet = await dialogAtRest(page, 'event');
  await expect(sheet.locator('.m-sheet__title')).toHaveText(FIRST_EVENT.summary);
  await sheet.locator('.m-dialog--event > .m-button').tap();
  sheet = await dialogAtRest(page, 'native');
  await expect(sheet.locator('.m-dialog--native > .m-native > .native')).toHaveCount(1);
  await closeSheet(page, sheet);
  // Coming up's note (a calendar failed) opens the full calendar too.
  const note = host(page).locator('[data-widget=upcoming] .m-row--pressable.m-row--bare');
  await expect(note).toHaveCount(1);
  await note.evaluate(el => el.scrollIntoView({block: 'center'}));
  await frames(page);
  await note.tap();
  sheet = await dialogAtRest(page, 'native');
  await closeSheet(page, sheet);
  await expect(page).toHaveURL(/#today$/);
});

test('The tab bar has four tabs, on a phone and from 700px', async ({page}) => {
  await openDashboard(page, byId('full').states, 'today');
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
  await expect(host(page).locator('.m-tabbar .m-tab')).toHaveCount(4);
  await page.setViewportSize({width: 900, height: 800});
  await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'wide');
  await expect(host(page).locator('.m-tabbar .m-tab')).toHaveCount(4);
});
