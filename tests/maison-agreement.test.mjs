// Every control does what it shows (#27): for every Climate, Car, Today and
// home fixture, on every page, pressing an enabled control reaches service()
// or changes the house draft, and pressing a disabled one does nothing. Each
// press goes through a fresh Maison element, online, offline and with the
// control's own key busy. Every page's controls are read from screen(), as
// the element hands it to React.
import test from 'node:test';
import assert from 'node:assert/strict';
import {E} from '../config/www/maison/model.js';
import {CLIMATE_DETAILS, localInput} from '../config/www/maison/climate.js';
import {ENERGY_DETAILS} from '../config/www/maison/energy.js';
import {CAR_DETAILS} from '../config/www/maison/car.js';
import {guard} from '../config/www/maison/guard.js';
import {screen, controls} from '../config/www/maison/screen.js';
import {CLIMATE_FIXTURES, CLIMATE_NOW} from '../frontend/maison/fixtures/climate-fixtures.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {TODAY_FIXTURES, TODAY_NOW, TODAY_WEEK} from '../frontend/maison/fixtures/today-fixtures.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {ENERGY_FIXTURES} from '../frontend/maison/fixtures/energy-fixtures.js';
const registered = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {get: key => registered.get(key), define: (key, value) => registered.set(key, value)};
globalThis.window = {customCards: []};
await import('../config/www/maison/maison-dashboard.js');
const Maison = registered.get('maison-dashboard');
const tz = 'Europe/Brussels';

// Links only navigate, open or close a dialog or a drawer, or filter the
// sensor catalogue; they are never a write.
const LINKS = new Set(['alerts', 'detail', 'more', 'native-history', 'navigate', 'close', 'agenda-event', 'native-calendar',
  'ha-energy', 'ha-settings', 'sensor-search', 'sensor-category', 'sensor-more']);
// Away's date: four days ahead is in the field's range, and the field is
// pressed with a fifth, so choosing it always changes the draft.
const DAY = 86400000, AWAY = localInput(CLIMATE_NOW + 4 * DAY, tz), AWAY_PRESSED = localInput(CLIMATE_NOW + 5 * DAY, tz);
// What the matrix pressed, for the last test's coverage check: each page's
// commands pressed while enabled, and `<page> <command>` pressed while
// disabled; upcoming is which of Coming up's own ways to the Full calendar (a
// failed calendar's note, "N more") were on show.
const pressed = {climate: new Set(), car: new Set(), today: new Set(), energy: new Set(), system: new Set(), refused: new Set(), links: new Set(), upcoming: new Set(),
  enabled: 0, disabled: 0};

// A fresh Maison element. A press can act in two ways only, a service() call
// or a new draft, and both are recorded; Home Assistant itself is never called.
// `loaded` is what the element keeps beside the states: the Car's kept
// headline, the agenda and the forecast.
function element(states, {online = true, busy = [], draft = {}, page = 'climate', detail = null, loaded = {}} = {}) {
  const card = Object.create(Maison.prototype), sent = [];
  card._hass = {states, connected: online, config: {time_zone: tz}, callService: async () => assert.fail('only service() may call Home Assistant')};
  card._busy = new Set(busy); card._climate = {house: null, houseEnd: null, awayUntil: '', ...draft};
  card._page = page; card._modal = detail; Object.assign(card, loaded);
  card.render = () => {}; card.toast = () => {};
  card.service = async (...call) => {sent.push(call);};
  return {card, sent};
}
// Presses one intent on a fresh element: did it act?
async function acts(states, condition, intent) {
  const {card, sent} = element(states, condition), before = JSON.stringify(card._climate);
  await card.command(intent);
  return sent.length > 0 || JSON.stringify(card._climate) !== before;
}
// The intent a press sends: Away's field sends the date chosen in it.
const intentOf = c => c.command === 'away-until' ? {command: c.command, entity: c.entity, value: AWAY_PRESSED}
  : {command: c.command, entity: c.entity, ...(c.direction === undefined ? {} : {direction: c.direction})};
const named = c => `${c.command} ${c.entity}${c.direction === undefined ? '' : ` ${c.direction}`}${c.label ? ` (“${c.label}”)` : ''}`;

// Checks every write control shown under one condition and returns them with their keys.
async function agree(shown, states, condition, where, domain) {
  const {snap, list} = shown(condition), checked = [];
  for (const c of list.filter(c => LINKS.has(c.command))) pressed.links.add(`${domain} ${c.command}`);
  for (const c of list.filter(c => !LINKS.has(c.command))) {
    const intent = intentOf(c), a = guard(intent, snap);
    assert.equal(c.enabled, snap.online && a !== null && !snap.busy.has(a.key), `${where}: ${named(c)} is enabled by any rule but the kit’s`);
    const acted = await acts(states, condition, intent);
    assert.equal(acted, c.enabled, `${where}: ${named(c)} ${c.enabled ? 'is enabled but did nothing' : 'is disabled but acted'}`);
    if (c.enabled) {pressed[domain].add(c.command); pressed.enabled++;} else {pressed.refused.add(`${domain} ${c.command}`); pressed.disabled++;}
    checked.push({...c, key: a?.key ?? null});
  }
  return checked;
}
// Online (and, given one, online with an Away date chosen); offline; then each
// control's key busy.
async function everyCondition(shown, states, where, domain, chosen = null) {
  let online = await agree(shown, states, {}, `${where}, online`, domain);
  if (chosen) online = await agree(shown, states, chosen, `${where}, online, an Away date chosen`, domain);
  chosen ??= {};
  const offline = await agree(shown, states, {...chosen, online: false}, `${where}, offline`, domain);
  assert.ok(offline.every(c => !c.enabled), `${where}: offline disables every control`);
  for (const key of new Set(online.map(c => c.key).filter(Boolean))) {
    const busy = await agree(shown, states, {...chosen, busy: [key]}, `${where}, ${key} busy`, domain);
    const own = busy.filter(c => c.key === key);
    assert.ok(own.length && own.every(c => !c.enabled), `${where}: ${key} busy disables its controls`);
  }
}

// ---- Climate -------------------------------------------------------------------
test('the Away date the matrix chooses is one the field accepts', () => {
  const field = screen(element(CLIMATE_FIXTURES[0].states, {detail: 'house'}).card.snapshot()).drawer.body.control.away.field;
  for (const value of [AWAY, AWAY_PRESSED]) assert.ok(field.min <= value && value <= field.max, `${value} within ${field.min}–${field.max}`);
});

for (const f of CLIMATE_FIXTURES) {
  test(`Climate, ${f.title}: every control on the page and in each drawer does what it shows`, async t => {
    t.mock.timers.enable({apis: ['Date'], now: CLIMATE_NOW});
    const states = structuredClone(f.states);
    for (const detail of [null, ...CLIMATE_DETAILS.map(d => d.id)]) {
      // What the element's own snapshot shows under a condition.
      const shown = condition => {
        const snap = element(states, {...condition, detail}).card.snapshot(), s = screen(snap);
        return {snap, list: controls(detail === null ? s.page : s.drawer)};
      };
      await everyCondition(shown, states, `${f.id}, ${detail ?? 'the page'}`, 'climate', {draft: {awayUntil: AWAY}});
    }
  });
}

test('choosing an Away date enables Set Away exactly where Set Away then sends', async t => {
  t.mock.timers.enable({apis: ['Date'], now: CLIMATE_NOW});
  const offered = [];
  for (const f of CLIMATE_FIXTURES) {
    // Away is set in the House sheet.
    const {card, sent} = element(structuredClone(f.states), {detail: 'house'});
    await card.command({command: 'away-until', entity: 'house', value: AWAY});
    const set = controls(screen(card.snapshot()).drawer).find(c => c.command === 'house-away');
    if (!set) continue;
    await card.command({command: set.command, entity: set.entity});
    assert.equal(sent.length > 0, set.enabled, `${f.id}: Set Away is ${set.enabled ? 'enabled' : 'disabled'}`);
    if (set.enabled) offered.push(f.id);
  }
  assert.ok(offered.length > 0, 'somewhere Away can be set');
});

// ---- Car ---------------------------------------------------------------------------
// Every Car fixture, and the Car page's own edges (v34): an override while
// the Car sleeps or the Charger drops out, at the charge limit, the Car
// awake without fresh data or verification, and the rest.
const CARS = [...CAR_FIXTURES, ...CAR_PAGE_FIXTURES];
// The charging scripts exist, as they do in Home Assistant.
const carStates = id => {
  const states = structuredClone(CARS.find(f => f.id === id).states);
  for (const script of [E.carNow, E.carAutomatic, E.carRefresh]) states[script] = {entity_id: script, state: 'off', attributes: {}};
  return states;
};

// The Car's sheets (v34) are pressed as Energy's are: the page, then each
// sheet open over it.
for (const f of CARS) {
  test(`Car, ${f.title}: every control on the Car page and in each sheet does what it shows`, async t => {
    t.mock.timers.enable({apis: ['Date'], now: CAR_NOW});
    const states = carStates(f.id), loaded = {_carLast: f.last ?? null};
    for (const detail of [null, ...CAR_DETAILS.map(d => d.id)]) {
      const shown = condition => {
        const snap = element(states, {...condition, page: 'car', detail, loaded}).card.snapshot(), s = screen(snap);
        return {snap, list: controls(detail === null ? s.page : s.drawer)};
      };
      await everyCondition(shown, states, `${f.id}${detail ? `, ${detail}` : ''}`, 'car');
    }
  });
}

// ---- Today -------------------------------------------------------------------------
// And the full week (v35), whose Coming up says "N more".
for (const f of [...TODAY_FIXTURES, TODAY_WEEK]) {
  test(`Today, ${f.title}: every control on the page does what it shows`, async t => {
    t.mock.timers.enable({apis: ['Date'], now: f.now ?? TODAY_NOW});
    const states = structuredClone(f.states), loaded = {_agenda: structuredClone(f.agenda), _agendaLoading: f.agendaLoading, _forecasts: structuredClone(f.forecasts)};
    const shown = condition => {
      const snap = element(states, {...condition, page: 'today', loaded}).card.snapshot(), {page} = screen(snap);
      for (const key of ['note', 'more']) if (controls(page.upcoming?.[key] ?? {}).some(c => c.command === 'native-calendar')) pressed.upcoming.add(key);
      return {snap, list: controls(page)};
    };
    await everyCondition(shown, states, f.id, 'today');
  });
}

// ---- Energy, Home status and Today, over the home fixtures ---------------------------
// Energy's sheets (v33) are pressed as Climate's drawers are: the page, then
// each sheet open over it. Home status shows three readings a page, so its
// Show more is on show too.
const SHORT_CATALOGUE = {_sensorQuery: '', _sensorCategory: 'all', _sensorLimit: 3};
for (const f of HOME_FIXTURES) {
  for (const page of ['energy', 'system', 'today']) {
    test(`${page[0].toUpperCase()}${page.slice(1)}, ${f.title}: every control on the page${page === 'energy' ? ' and in each sheet' : ''} does what it shows`, async t => {
      t.mock.timers.enable({apis: ['Date'], now: HOME_NOW});
      const states = structuredClone(f.states), loaded = {_agenda: structuredClone(f.agenda), _agendaLoading: f.agendaLoading, _forecasts: structuredClone(f.forecasts),
        ...(page === 'system' ? SHORT_CATALOGUE : {})};
      for (const detail of page === 'energy' ? [null, ...ENERGY_DETAILS.map(d => d.id)] : [null]) {
        const shown = condition => {
          const snap = element(states, {...condition, page, detail, loaded}).card.snapshot(), s = screen(snap);
          return {snap, list: controls(detail === null ? s.page : s.drawer)};
        };
        await everyCondition(shown, states, `${f.id} on ${page}${detail ? `, ${detail}` : ''}`, page);
      }
    });
  }
}

// ---- Energy over its own fixtures (v33) ------------------------------------------------
for (const f of ENERGY_FIXTURES) {
  test(`Energy, ${f.title}: every control on the page and in each sheet does what it shows`, async t => {
    t.mock.timers.enable({apis: ['Date'], now: f.now});
    const states = structuredClone(f.states), loaded = {_agenda: structuredClone(f.agenda), _agendaLoading: f.agendaLoading, _forecasts: structuredClone(f.forecasts)};
    for (const detail of [null, ...ENERGY_DETAILS.map(d => d.id)]) {
      const shown = condition => {
        const snap = element(states, {...condition, page: 'energy', detail, loaded}).card.snapshot(), s = screen(snap);
        return {snap, list: controls(detail === null ? s.page : s.drawer)};
      };
      await everyCondition(shown, states, `${f.id} on energy${detail ? `, ${detail}` : ''}`, 'energy');
    }
  });
}

// Pressing a figure opens the sheet its link names, and the sheet's close
// closes it: the links do what they show, on a real element.
test('Energy: each figure’s link opens the sheet it names, and each sheet’s close closes it', async () => {
  const f = ENERGY_FIXTURES.find(x => x.id === 'billing'), opened = new Set();
  globalThis.location = {hash: '#energy', pathname: '/maison-home/home', search: ''};
  globalThis.history = {state: null, pushState(state, _b, url) {this.state = state; location.hash = url.split('#')[1];}, back() {}, replaceState(_a, _b, url) {location.hash = url.split('#')[1];}};
  globalThis.document = {scrollingElement: null};
  globalThis.requestAnimationFrame = () => {};
  try {
    for (const c of controls(screen(element(structuredClone(f.states), {page: 'energy'}).card.snapshot()).page).filter(c => c.command === 'detail')) {
      const {card} = element(structuredClone(f.states), {page: 'energy'});
      card.loadViewData = () => {}; card.scrollContainers = () => []; location.hash = '#energy';
      await card.command({command: c.command, entity: c.entity});
      assert.equal(card._modal, c.entity, `${c.entity} opens`);
      const {drawer} = screen(card.snapshot());
      assert.equal(drawer.id, c.entity);
      await card.command(drawer.close.intent);
      assert.equal(card._modal, null, `${c.entity} closes`);
      opened.add(c.entity);
    }
  } finally {delete globalThis.location; delete globalThis.history; delete globalThis.document; delete globalThis.requestAnimationFrame;}
  assert.deepEqual([...opened].sort(), ENERGY_DETAILS.map(d => d.id).sort(), 'every sheet is one press away');
});

// And the Car's (v34): the Battery card and Charging energy open their
// sheets on a real element, and each sheet's close closes it.
test('Car: each card’s link opens the sheet it names, and each sheet’s close closes it', async () => {
  const opened = new Set();
  globalThis.location = {hash: '#car', pathname: '/maison-home/home', search: ''};
  globalThis.history = {state: null, pushState(state, _b, url) {this.state = state; location.hash = url.split('#')[1];}, back() {}, replaceState(_a, _b, url) {location.hash = url.split('#')[1];}};
  globalThis.document = {scrollingElement: null};
  globalThis.requestAnimationFrame = () => {};
  try {
    for (const f of CARS) {
      const states = carStates(f.id), loaded = {_carLast: f.last ?? null};
      for (const c of controls(screen(element(states, {page: 'car', loaded}).card.snapshot()).page).filter(c => c.command === 'detail')) {
        const {card} = element(states, {page: 'car', loaded});
        card.loadViewData = () => {}; card.scrollContainers = () => []; location.hash = '#car';
        await card.command({command: c.command, entity: c.entity});
        assert.equal(card._modal, c.entity, `${f.id}: ${c.entity} opens`);
        const {drawer} = screen(card.snapshot());
        assert.equal(drawer.id, c.entity);
        await card.command(drawer.close.intent);
        assert.equal(card._modal, null, `${f.id}: ${c.entity} closes`);
        opened.add(c.entity);
      }
    }
  } finally {delete globalThis.location; delete globalThis.history; delete globalThis.document; delete globalThis.requestAnimationFrame;}
  assert.deepEqual([...opened].sort(), CAR_DETAILS.map(d => d.id).sort(), 'every sheet is one press away');
});

// ---- Coverage ------------------------------------------------------------------------
test('the matrix pressed every write on every page while enabled, and refused ones too', t => {
  assert.deepEqual([...pressed.climate].sort(), ['away-until', 'drying-start', 'drying-stop', 'house-away', 'house-away-cancel', 'house-end', 'house-override',
    'house-override-cancel', 'house-step', 'house-warm', 'step', 'toggle', 'zone-override', 'zone-override-cancel', 'zone-step']);
  assert.deepEqual([...pressed.car].sort(), ['charge-automatic', 'charge-limit', 'charge-now', 'charge-refresh', 'toggle']);
  assert.deepEqual([...pressed.today].sort(), ['vacuum']);
  assert.deepEqual([[...pressed.energy], [...pressed.system]], [[], []], 'Energy and Home status write nothing');
  for (const refused of ['car charge-now', 'car charge-limit', 'car toggle', 'today vacuum'])
    assert.ok(pressed.refused.has(refused), refused);
  // And every link was on show: the matrix saw each page's own. Climate's
  // zones, Details and "Set an override…" open sheets, whose schedule and
  // Airco open their entities and whose charts open Full history, as
  // Energy's figures do (v33) and the Car's Battery and Charging energy
  // (v34), whose readings open their own. Today's events open their dialog,
  // its rows their entities and its widgets their pages, and the Full
  // calendar opens from Today (v35, Life gone); Home status's rows open
  // their entities, and Show more the next readings.
  for (const shown of ['car close', 'car detail', 'car more', 'climate close', 'climate detail', 'climate more', 'climate native-history', 'energy close', 'energy detail',
    'energy ha-energy', 'energy more', 'energy native-history', 'system more', 'system sensor-search', 'system sensor-category', 'system sensor-more', 'system ha-settings',
    'today alerts', 'today agenda-event', 'today more', 'today native-calendar', 'today navigate'])
    assert.ok(pressed.links.has(shown), shown);
  assert.deepEqual([...pressed.upcoming].sort(), ['more', 'note'], 'Coming up’s note and “N more” open the Full calendar');
  assert.ok(pressed.disabled > 0);
  t.diagnostic(`${pressed.enabled + pressed.disabled} presses: ${pressed.enabled} enabled, ${pressed.disabled} disabled`);
});
