import {expect, test} from '@playwright/test';
import {exposeIPhonePlatform} from './iphone-platform.mjs';
import {CAR_FIXTURES, CAR_NOW} from '../fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../fixtures/car-page-fixtures.js';
import {E} from '../../../config/www/maison/model.js';

// Maison's Car (#29 step 4, v34) and its two sheets on a touch
// screen, over the Car fixtures' states at their time: every linked card
// (Battery, Charging energy), Charge now or Return to automatic, the charge
// limit's stepper, Wake and Automatic charging's switch on the page takes a
// 44px touch, on a phone and in the grid from 700px, and so does every row
// and Why in the two sheets; a touch anywhere on a linked card lands on its
// press; tapping a card opens its sheet at #car/<id>, and Back closes it
// to #car; a direct #car/battery opens Battery; nothing scrolls sideways at
// 320, 375 or 393px, on the page or in either sheet with its Why open,
// Automatic charging's row (its switch unavailable too) breaks no word, and
// nothing logs an error; a sleeping Car offers Wake and neither Charge now
// nor the limit's stepper; a charging control in flight stays drawn,
// pending; through a Charger dropout the Car draws the headline it kept;
// and nothing above the phone tab bar gives it a containing block. Checks
// are structural (classes, counts, geometry), not wording, and there are
// no accessibility checks (30/09).
test.beforeEach(exposeIPhonePlatform);

const host = page => page.locator('maison-dashboard');
const byId = id => [...CAR_FIXTURES, ...CAR_PAGE_FIXTURES].find(fixture => fixture.id === id);
// Each sheet's body by its id, as car.js's CAR_DETAILS and carDrawerValue
// draw it (their ?v= imports Playwright's loader can't follow): Battery's,
// and Charging energy's, whose kind is `sources`.
const BODIES = {battery: '.m-car-sheet--battery', 'charging-energy': '.m-car-sheet--sources'};
// What the page offers to press: the linked cards (Battery and Charging
// energy), whose press covers them; the charging action (Charge now or
// Return to automatic); the limit's stepper; Wake, a row's accessory; and
// Automatic charging's switch.
const PAGE_CONTROLS = {
  press: '.m-car-page .m-widget__press', action: '.m-car-page__charge > .m-button', step: '.m-car-page .m-stepper__step',
  wake: '.m-car-page__charge .m-row__accessory > .m-button', switch: '.m-car-page label.m-switch',
};
// What a sheet body offers: its rows, each opening a reading, and Why. The
// sheet's own close button, in its header, is the shared Sheet's and is
// left out, as in Energy's spec: its hit area is exactly 44px (36px and a
// 4px ::after), which a ±21.5px probe misses by rounding in Chromium.
const SHEET_CONTROLS = {row: '.m-row--pressable', disclosure: '.m-disclosure__trigger'};
// The page's controls by fixture: ready (Charge now and the stepper),
// Charge now on (Return to automatic and the stepper), asleep (Wake) and
// unplugged (no Charging card).
const CONTROLS = {
  solar: {press: 2, action: 1, step: 2, wake: 0, switch: 1},
  charge_now: {press: 2, action: 1, step: 2, wake: 0, switch: 1},
  not_verified: {press: 2, action: 0, step: 0, wake: 1, switch: 1},
  unplugged: {press: 2, action: 0, step: 0, wake: 0, switch: 1},
};

// The Car over fixture `id`'s states, pinned so a
// reused preview's snapshot never reaches it, at `hash`, with the clock at
// the fixtures' time (every Car fixture's is CAR_NOW), so it reads as the
// Node tests read it. The clock and the registry are set once per page, the
// states on each load. A page already on the preview leaves it first, since
// a goto that changes only the fragment would not reload the states. A
// fixture with a headline kept through a Charger dropout (`last`) hands it
// to the element, which keeps it in memory (`_carLast`), not in the states,
// and is drawn again with it, so the page is the fixture's own state.
const prepared = new WeakSet();
async function openCar(page, id, hash = 'car') {
  if (!prepared.has(page)) {
    prepared.add(page);
    await page.addInitScript(fixed => {
      const NativeDate = Date;
      globalThis.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      };
    }, CAR_NOW);
    await page.route('**/registry.json', route => route.fulfill({json: {areas: [], devices: [], entities: []}}));
  }
  await page.unroute('**/states.json');
  await page.route('**/states.json', route => route.fulfill({json: {source: `Synthetic touch regression · Car ${id}`, states: byId(id).states}}));
  if (page.url() !== 'about:blank') await page.goto('about:blank');
  await page.goto(`/#${hash}`);
  await expect(host(page).locator('.m-car-page')).toBeAttached();
  const {last} = byId(id);
  if (last) {
    await page.evaluate(last => { const card = document.querySelector('maison-dashboard'); card._carLast = last; card.hass = {...card.hass}; }, last);
    await frames(page);
  }
}

// The sheet has finished entering (React Aria drops data-entering when the
// animations end), drawing `detail`'s body.
async function sheetAtRest(page, detail) {
  const sheet = page.locator('.m-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.m-sheet[data-entering], .m-sheet-overlay[data-entering]')).toHaveCount(0);
  await expect(sheet.locator(BODIES[detail])).toBeVisible();
  return sheet;
}

// Opens `detail`'s sheet over the page by its route, as a card does.
async function openSheet(page, detail) {
  await page.evaluate(detail => { location.hash = `car/${detail}`; }, detail);
  return sheetAtRest(page, detail);
}

// Closes the open sheet as Back does, back at #car.
async function goBack(page) {
  await page.goBack();
  await expect(page.locator('.m-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/#car$/);
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
// box, or its ::after extension: a linked card's press is the title's
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
    else counts[kind](await controls.count(), kind);
    for (const [index, control] of (await controls.all()).entries()) {
      if (!await control.evaluate(el => el.getClientRects().length > 0)) continue;
      await expectTouchTarget(page, control, `${kind} ${index + 1}: ${await control.getAttribute('aria-label') ?? (await control.textContent()).trim()}`);
      probed++;
    }
  }
  return probed;
}

// In the page: every hit of an 11 × 11 grid over a linked widget (inset 2px
// from its edges) that doesn't land on its press, which should take them
// all. The points a rounded corner cuts off (the widget's) are left out:
// nothing is drawn there.
function missesOver(widget) {
  const press = widget.querySelector('.m-widget__press'), box = widget.getBoundingClientRect(), root = widget.getRootNode(), misses = [];
  const radius = parseFloat(getComputedStyle(widget).borderTopLeftRadius) || 0;
  const drawn = (x, y) => Math.hypot(Math.max(box.left + radius - x, x - box.right + radius, 0), Math.max(box.top + radius - y, y - box.bottom + radius, 0)) <= radius;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    const x = box.left + 2 + (box.width - 4) * i / 10, y = box.top + 2 + (box.height - 4) * j / 10, hit = root.elementFromPoint(x, y);
    if (drawn(x, y) && hit !== press && !press.contains(hit)) misses.push(`(${i}, ${j}) lands on ${hit?.localName}.${String(hit?.className?.baseVal ?? hit?.className).trim().split(/\s+/)[0]}`);
  }
  return misses;
}

// Every point of each linked card lands on its press, once it sits
// mid-screen.
async function expectPressesCover(page) {
  const widgets = host(page).locator('.m-car-page [data-widget]:has(.m-widget__press)');
  await expect(widgets).toHaveCount(2);
  for (const widget of await widgets.all()) {
    await widget.evaluate(el => el.scrollIntoView({block: 'center'}));
    await frames(page);
    expect(await widget.evaluate(missesOver), await widget.getAttribute('data-widget')).toEqual([]);
  }
}

// Taps the middle of a linked card once it sits mid-screen; `detail`'s
// sheet opens at #car/<id>, and Back closes it, back at #car.
async function expectTapOpens(page, widget, detail) {
  await widget.evaluate(el => el.scrollIntoView({block: 'center'}));
  await frames(page);
  const box = await widget.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(new RegExp(`#car/${detail}$`));
  await sheetAtRest(page, detail);
  await goBack(page);
}

// The linked cards by widget id, each with the sheet it opens.
const LINKED = [['battery', 'battery'], ['energy', 'charging-energy']];

test('Every linked card, charging control and switch on the Car page takes a 44px touch on a phone', async ({page}) => {
  for (const [fixture, counts] of Object.entries(CONTROLS)) {
    await openCar(page, fixture);
    await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', 'phone');
    expect(await expectTouchTargets(page, host(page), PAGE_CONTROLS, counts), fixture).toBeGreaterThan(0);
  }
  await openCar(page, 'solar');
  await expectPressesCover(page);
});

test('Tapping the Battery or Charging energy card on a phone opens its sheet, and Back closes it', async ({page}) => {
  await openCar(page, 'solar');
  const car = host(page).locator('.m-car-page');
  for (const [id, detail] of LINKED) await expectTapOpens(page, car.locator(`[data-widget=${id}]`), detail);
});

// From 700px: a wide 700px and a desktop 1,100px, the grid's narrowest
// widgets in each layout, where the charging controls are 36px and reach
// 44px by their hit areas; plugged in (four mediums), asleep and unplugged
// (Battery large).
for (const [width, layout] of [[700, 'wide'], [1100, 'desktop']]) {
  test.describe(`from 700px, at ${width}px`, () => {
    test.use({viewport: {width, height: 900}});

    test('Every linked card, charging control and switch takes a 44px touch in the grid, and a touch anywhere on a linked card lands on its press', async ({page}) => {
      for (const [fixture, counts] of Object.entries(CONTROLS)) {
        await openCar(page, fixture);
        await expect(host(page).locator('.m-app')).toHaveAttribute('data-layout', layout);
        expect(await expectTouchTargets(page, host(page), PAGE_CONTROLS, counts), fixture).toBeGreaterThan(0);
        await expectPressesCover(page);
      }
    });

    test('Tapping each linked card opens its sheet, and Back closes it', async ({page}) => {
      for (const fixture of ['solar', 'unplugged']) {
        await openCar(page, fixture);
        const car = host(page).locator('.m-car-page');
        for (const [id, detail] of LINKED) await expectTapOpens(page, car.locator(`[data-widget=${id}]`), detail);
      }
    });
  });
}

test('Every row and Why in the two sheets takes a 44px touch', async ({page}) => {
  // Battery awake and asleep, Charging energy with a meter missing: each
  // sheet's readings or sources, and its Why.
  const some = (count, kind) => expect(count, kind).toBeGreaterThan(0);
  for (const [fixture, detail] of [['solar', 'battery'], ['not_verified', 'battery'], ['solar', 'charging-energy'], ['meter_missing', 'charging-energy']]) {
    await openCar(page, fixture, `car/${detail}`);
    const sheet = await sheetAtRest(page, detail);
    await openDisclosures(sheet);
    expect(await expectTouchTargets(page, sheet.locator('.m-sheet__body'), SHEET_CONTROLS, {row: some, disclosure: 1}), `${fixture} ${detail}`).toBeGreaterThan(1);
  }
});

test('A direct #car/battery opens the Battery sheet over the Car', async ({page}) => {
  await openCar(page, 'solar', 'car/battery');
  const sheet = await sheetAtRest(page, 'battery');
  await expect(host(page).locator('.m-tabbar').getByRole('button', {name: 'Car', exact: true})).toHaveAttribute('aria-current', 'page');
  // Closed, it leaves the Car at #car.
  await sheet.locator('.m-sheet__close').tap();
  await expect(page.locator('.m-sheet')).toHaveCount(0);
  await expect(page).toHaveURL(/#car$/);
  await expect(host(page).locator('.m-car-page')).toBeVisible();
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

// In the page: each place where a text node in `el` wraps to a new line in
// the middle of a word, the line starting with a letter whose neighbour
// before it, in the same text, is neither a space nor a hyphen.
function midWordBreaks(el) {
  const breaks = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let top = null;
    for (let i = 0; i < node.data.length; i++) {
      if (/\s/.test(node.data[i])) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const box = range.getClientRects()[0];
      if (!box) continue;
      if (top !== null && box.top > top + 1 && !/[\s\-\u2010\u2011]/.test(node.data[i - 1])) breaks.push(`"${node.data.slice(0, i)}|${node.data.slice(i)}"`);
      top = box.top;
    }
  }
  return breaks;
}

// Automatic charging's row, found by its switch (live or unavailable), so
// it is the same row whether a Widget holds it or a list stands alone.
const automaticRow = page => host(page).locator('.m-car-page .m-row:has(.m-switch)');

test('Nothing scrolls sideways at 320, 375 and 393px, on the page or in either sheet with its Why open, and Automatic charging breaks no word', async ({page}) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Each charging form (ready, Charge now on, asleep with and without an
  // override, reconnecting, and through a dropout with the headline kept),
  // unplugged, nothing confirmed, a meter missing and Automatic charging
  // unavailable (its note the row's longest word); both sheets where their
  // words are longest. On each page, Automatic charging's row wraps only
  // between words.
  const ALL = Object.keys(BODIES);
  const VIEWS = [['solar', ALL], ['charge_now', []], ['not_verified', ['battery']], ['override_asleep', []], ['charger_offline', ['battery']],
    ['dropout', ['battery']], ['override_dropout', []], ['unplugged', ALL], ['never_confirmed', ALL], ['meter_missing', ['charging-energy']],
    ['automatic_unavailable', []]];
  for (const width of [320, 375, 393]) {
    await page.setViewportSize({width, height: 800});
    for (const [fixture, details] of VIEWS) {
      await openCar(page, fixture);
      await expect(host(page).locator('.m-car-page')).toBeVisible();
      expect(await documentSideways(page), `${width}px ${fixture} page`).toEqual({wider: false, scrolled: 0});
      await expect(automaticRow(page), `${width}px ${fixture}`).toHaveCount(1);
      expect(await automaticRow(page).evaluate(midWordBreaks), `${width}px ${fixture} Automatic charging`).toEqual([]);
      for (const detail of details) {
        const sheet = await openSheet(page, detail);
        await openDisclosures(sheet);
        await frames(page);
        expect(await documentSideways(page), `${width}px ${fixture} ${detail}`).toEqual({wider: false, scrolled: 0});
        expect(await sheetSideways(sheet), `${width}px ${fixture} ${detail}`).toEqual({inside: true, body: null});
        await goBack(page);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('A sleeping Car offers Wake, and neither Charge now nor the limit’s stepper', async ({page}) => {
  // Asleep with no override (no action at all), then asleep while Charge
  // now is on (Return to automatic, gray, stays).
  for (const [fixture, actions] of [['not_verified', 0], ['override_asleep', 1]]) {
    await openCar(page, fixture);
    const charge = host(page).locator('.m-car-page [data-widget=charge]');
    await expect(charge.locator('.m-car-page__charge--asleep'), fixture).toBeVisible();
    await expect(charge.locator(PAGE_CONTROLS.wake), fixture).toHaveCount(1);
    await expect(charge.locator(PAGE_CONTROLS.wake), fixture).toBeVisible();
    await expect(charge.locator('.m-car-page__charge > .m-button'), fixture).toHaveCount(actions);
    await expect(charge.locator('.m-button--filled'), fixture).toHaveCount(0);
    await expect(host(page).locator('.m-car-page .m-stepper'), fixture).toHaveCount(0);
  }
});

// A charging control in flight stays drawn in its place, pending
// (data-pending), and its card keeps its form: Charge now, the limit's
// stepper, Return to automatic and Wake. The preview's service calls resolve
// at once, so each control's busy key (the one its script or number takes)
// is set on the element, which is drawn again.
test('A charging control in flight stays drawn, pending, in its place', async ({page}) => {
  for (const [fixture, key, kind] of [['solar', E.carNow, 'action'], ['solar', E.carLimit, 'step'], ['charge_now', E.carAutomatic, 'action'], ['not_verified', E.carRefresh, 'wake']]) {
    await openCar(page, fixture);
    const name = `${fixture} ${kind}`, charge = host(page).locator('.m-car-page__charge'), controls = host(page).locator(PAGE_CONTROLS[kind]);
    const form = await charge.getAttribute('class'), count = await controls.count();
    expect(count, name).toBeGreaterThan(0);
    await expect(host(page).locator(`${PAGE_CONTROLS[kind]}[data-pending]`), name).toHaveCount(0);
    await page.evaluate(key => { const card = document.querySelector('maison-dashboard'); card._busy.add(key); card.render(); }, key);
    await expect(controls, name).toHaveCount(count);
    for (const control of await controls.all()) {
      await expect(control, name).toHaveAttribute('data-pending', 'true');
      await expect(control, name).toBeVisible();
    }
    await expect(charge, name).toHaveAttribute('class', form);
  }
});

// Through a Charger dropout the Car keeps the headline from before it
// (openCar hands the fixture's to the element): the Battery sheet adds its
// hint that the Charger is reconnecting; the Charging card, reconnecting,
// keeps Return to automatic while Charge now is on; and another vehicle's
// kept headline draws no Charging card.
test('Through a Charger dropout the Car draws the headline it kept', async ({page}) => {
  for (const [fixture, actions] of [['dropout', 0], ['override_dropout', 1], ['other_vehicle_dropout', null]]) {
    await openCar(page, fixture, 'car/battery');
    const sheet = await sheetAtRest(page, 'battery');
    await expect(sheet.locator('.m-car-sheet__hint'), fixture).toHaveCount(1);
    await expect(sheet.locator('.m-car-sheet__hint'), fixture).toBeVisible();
    const charge = host(page).locator('.m-car-page [data-widget=charge]');
    if (actions === null) await expect(charge, fixture).toHaveCount(0);
    else {
      await expect(charge.locator('.m-car-page__charge--reconnecting'), fixture).toHaveCount(1);
      await expect(charge.locator('.m-car-page__charge > .m-button'), fixture).toHaveCount(actions);
      await expect(charge.locator('.m-button--filled'), fixture).toHaveCount(0);
    }
  }
});

// The phone tab bar floats over the foot of the screen, so nothing above it
// may give it a containing block (a transform, a filter, containment, a
// will-change or a perspective): with the Car scrolled to its end, the bar
// is still at the screen's foot and the last of the Car sits above it.
test('Nothing above the phone tab bar on the Car gives it a containing block, and the last of the Car clears it', async ({page}) => {
  await openCar(page, 'solar');
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
    const car = el.shadowRoot.querySelector('.m-car-page'), bar = el.shadowRoot.querySelector('.m-tabbar').getBoundingClientRect();
    return {last: Math.max(...[...car.querySelectorAll('.m-widgets > *')].map(child => child.getBoundingClientRect().bottom)), bar: {top: bar.top, bottom: bar.bottom}, screen: innerHeight};
  });
  expect(bar.bottom).toBeLessThanOrEqual(screen - 16 + 0.5);
  expect(bar.bottom).toBeGreaterThan(screen - 60);
  expect(last).toBeLessThanOrEqual(bar.top);
});
