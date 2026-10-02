// What Maison shows (#27): screen(snapshot) and its kit, and the two helpers
// the tests read values with, controls() and words(). Each page's own wording
// and rules are in maison-climate, -car, -today, -energy and
// -system.test.mjs, the chrome and the dialogs in maison-chrome.test.mjs;
// whether pressing a control does what it shows is in maison-agreement.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {E, ZONES, CLIMATE_CONTRACT} from '../config/www/maison/model.js';
import {CLIMATE_DETAILS} from '../config/www/maison/climate.js';
import {ENERGY_DETAILS} from '../config/www/maison/energy.js';
import {CAR_DETAILS} from '../config/www/maison/car.js';
import {guard, WRITE_COMMANDS} from '../config/www/maison/guard.js';
import {screen, controls, words, allowed, control, link, kit, PAGE_IDS} from '../config/www/maison/screen.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {TODAY_FIXTURES, TODAY_NOW} from '../frontend/maison/fixtures/today-fixtures.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {ENERGY_FIXTURES, ENERGY_POWER_HISTORY} from '../frontend/maison/fixtures/energy-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';

const HOUSE_KEY = CLIMATE_CONTRACT.houseHeating, ATTIC = ZONES.find(z => z.id === 'attic'), ZONE_TARGET = ATTIC.target;
const climateStates = id => structuredClone(CLIMATE_FIXTURES.find(f => f.id === id).states);
const at = (states, extra = {}) => fixtureSnapshot({states, ...extra});
const onClimate = (states, detail = null, extra = {}) => fixtureSnapshot({...extra, states, route: {page: 'climate', detail}});
const onPage = (page, states, extra = {}) => fixtureSnapshot({...extra, states, route: {page, detail: null}});
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {Object.freeze(value); Object.values(value).forEach(deepFreeze);}
  return value;
};

// ---- controls() ------------------------------------------------------------
test('controls() lists every control and link in reading order, and never looks inside one', () => {
  const value = {
    title: 'A card',
    opener: {intent: {command: 'detail', entity: 'attic'}, ariaLabel: 'Open Attic', enabled: true},
    rows: [
      null, 'a line', 7,
      {name: 'Noah’s room', stepper: {minus: {intent: {command: 'zone-step', entity: 'noah', direction: -1}, label: 'Lower', ariaLabel: 'Lower the target', enabled: false}}},
      {intent: {command: 'house-end', entity: '3h'}, label: '3 h', enabled: true, selected: true,
        inner: {intent: {command: 'house-override', entity: 'house'}, label: 'Never listed', enabled: true}},
    ],
    link: {intent: {command: 'more', entity: 'schedule.attic_occupied'}, label: 'Open the schedule', enabled: false},
  };
  assert.deepEqual(controls(value), [
    {command: 'detail', entity: 'attic', direction: undefined, label: 'Open Attic', enabled: true, selected: undefined},
    {command: 'zone-step', entity: 'noah', direction: -1, label: 'Lower', enabled: false, selected: undefined},
    {command: 'house-end', entity: '3h', direction: undefined, label: '3 h', enabled: true, selected: true},
    {command: 'more', entity: 'schedule.attic_occupied', direction: undefined, label: 'Open the schedule', enabled: false, selected: undefined},
  ], 'label, else the accessible name; a control inside a control is not listed');
  assert.deepEqual(controls([value.link, [value.opener]]).map(c => c.command), ['more', 'detail'], 'arrays in order, nested or not');
  for (const nothing of [null, undefined, 'text', 3, [], {}]) assert.deepEqual(controls(nothing), [], String(nothing));
});

// ---- words() ---------------------------------------------------------------
test('words() is the visible wording in drawing order, one line per string', () => {
  const value = {
    title: 'Attic',
    now: {reading: '19.8°', target: '21° until 18:00, then 16°', status: {label: 'Warming', tone: 'accent'}},
    facts: [{icon: 'droplet', text: '45%', flag: 'Dry air'}, {icon: 'sun', text: 'Outside 6.5°', flag: null}],
    rows: [{name: 'Office radiator', line: 'Heating to 21°', probe: '34.5°', probeCaption: 'Valve probe'}],
    note: 'The end.',
  };
  assert.deepEqual(words(value), ['Attic', '19.8°', '21° until 18:00, then 16°', 'Warming', '45%', 'Dry air', 'Outside 6.5°',
    'Office radiator', 'Heating to 21°', '34.5°', 'Valve probe', 'The end.']);
  assert.deepEqual(words([['one', ['two']], 'three']), ['one', 'two', 'three'], 'arrays depth-first');
  assert.deepEqual(words('A line'), ['A line']);
  for (const nothing of [null, undefined, 3, true, [], {}]) assert.deepEqual(words(nothing), [], String(nothing));
});

test('words() drops empty strings, numbers and booleans', () => {
  assert.deepEqual(words({feedback: '', note: 'Kept', count: 3, open: true, missing: null, gone: undefined, list: ['', 'one', '']}), ['Kept', 'one']);
});

test('words() reads only a control’s label, never its name, intent or anything else inside it', () => {
  const value = {
    dry: {intent: {command: 'drying-start', entity: 'bathroom'}, label: 'Dry towels', ariaLabel: 'Dry towels on the Bathroom towel rail for an hour',
      icon: 'droplet', enabled: true, hint: 'Never a line'},
    field: {intent: {command: 'away-until', entity: 'house', value: '2026-10-18T15:00'}, enabled: true},
    link: {intent: {command: 'more', entity: 'climate.ec3a56bc6527'}, label: 'Airco controls', icon: 'climate', enabled: false},
    feedback: 'Bathroom · request sent',
  };
  assert.deepEqual(words(value), ['Dry towels', 'Airco controls', 'Bathroom · request sent'], 'the block’s own feedback line is a visible line');
});

test('words() skips accessible names and the structural keys', () => {
  const value = {
    id: 'attic', kind: 'zone', key: 'k', icon: 'home', tone: 'accent', width: 'w', min: '2026-10-14T09:35', max: '2027-01-12T08:30',
    plot: ['a plot'], model: {title: 'Temperature · 24 hours', status: 'empty'},
    ariaLabel: 'a name', outputLabel: 'Attic target', endsLabel: 'Override ends',
    label: 'Visible', output: '21°',
  };
  assert.deepEqual(words(value), ['Visible', '21°'], '`label` is visible text; any key ending in Label is a name only');
});

test('words() joins a line with strong parts into one line', () => {
  assert.deepEqual(words({source: [{strong: 'Airco, cheaper now'}, ' · Airco heating']}), ['Airco, cheaper now · Airco heating']);
  assert.deepEqual(words({source: ['Heat source: ', {strong: 'Radiators'}, ' · Airco off']}), ['Heat source: Radiators · Airco off'], 'in order, wherever the strong part is');
  assert.deepEqual(words({lines: ['Comfort', 'Setback']}), ['Comfort', 'Setback'], 'plain strings stay separate lines');
  assert.deepEqual(words({facts: [{strong: 'A'}, {text: 'B'}]}), ['A', 'B'], 'not a rich line unless every part is a string or {strong}');
});

// ---- screen() ---------------------------------------------------------------
test('screen() draws every page from values: no page is left to a legacy renderer', () => {
  const states = climateStates('house_running');
  assert.deepEqual([...PAGE_IDS], ['today', 'climate', 'car', 'energy', 'system']);
  for (const page of PAGE_IDS) for (const snap of [fixtureSnapshot({route: {page}}), fixtureSnapshot({states, route: {page}})]) {
    const shown = screen(snap);
    assert.equal(shown.page.id, page);
    assert.ok(!('legacy' in shown.page) && !('html' in shown.page), `${page} is a value`);
    assert.equal(shown.drawer, null, `${page}: no drawer open`);
  }
  for (const page of ['nowhere', '', undefined, 'rooms']) assert.equal(screen(fixtureSnapshot({route: {page}})).page.id, 'today', `${page} shows Today`);
  for (const page of PAGE_IDS.filter(id => id !== 'climate'))
    assert.equal(screen(fixtureSnapshot({states, route: {page, detail: 'attic'}})).drawer, null, `${page}: the Attic's drawer is Climate's`);
});

// From v33 Energy has sheets too, each its own: #energy/bill opens Bill, and
// neither page opens the other's.
test('screen() opens each Energy sheet by its id, titled by its name, and closes it with close detail', () => {
  const states = structuredClone(HOME_FIXTURES.find(f => f.id === 'full').states);
  const onEnergy = detail => fixtureSnapshot({states, now: HOME_NOW, route: {page: 'energy', detail}});
  for (const d of ENERGY_DETAILS) {
    const {page, drawer} = screen(onEnergy(d.id));
    assert.equal(page.id, 'energy', d.id);
    assert.deepEqual([drawer.id, drawer.title, drawer.eyebrow], [d.id, d.name, 'Energy'], d.id);
    assert.deepEqual(drawer.close, {intent: {command: 'close', entity: 'detail'}, enabled: true}, d.id);
  }
  assert.equal(screen(onEnergy('bill')).drawer.body.kind, 'bill');
  for (const id of ['attic', 'house', 'missing', '', null]) assert.equal(screen(onEnergy(id)).drawer, null, String(id));
  for (const d of ENERGY_DETAILS) assert.equal(screen(onClimate(states, d.id)).drawer, null, `climate/${d.id}`);
});

// And from v34 the Car's: #car/battery opens Battery, and no other page
// opens a Car sheet, nor the Car another page's.
test('screen() opens each Car sheet only on the Car, and the Car no other page’s drawer', () => {
  const f = CAR_FIXTURES.find(x => x.id === 'solar'), on = (page, detail) => screen(fixtureSnapshot({states: f.states, now: CAR_NOW, route: {page, detail}}));
  for (const d of CAR_DETAILS) {
    const {page, drawer} = on('car', d.id);
    assert.deepEqual([page.id, drawer.id, drawer.title, drawer.eyebrow], ['car', d.id, d.name, 'Car'], d.id);
    for (const other of PAGE_IDS.filter(id => id !== 'car')) assert.equal(on(other, d.id).drawer, null, `${other}/${d.id}`);
  }
  for (const id of [...CLIMATE_DETAILS, ...ENERGY_DETAILS].map(d => d.id)) assert.equal(on('car', id).drawer, null, `car/${id}`);
});

test('screen() opens each Climate drawer by its id, titled by its name and eyebrowed by its rooms', () => {
  const states = climateStates('house_running'), kinds = {house: 'house', 'towel-rails': 'rails'};
  for (const d of CLIMATE_DETAILS) {
    const {page, drawer} = screen(onClimate(states, d.id));
    assert.equal(page.id, 'climate', d.id);
    assert.deepEqual([drawer.id, drawer.title, drawer.eyebrow, drawer.body.kind], [d.id, d.name, d.rooms, kinds[d.id] ?? 'zone'], d.id);
  }
  for (const id of ['missing', 'hallway', 'car', 'climate', '', null, undefined]) assert.equal(screen(onClimate(states, id)).drawer, null, String(id));
});

// For one snapshot: screen() doesn't throw, shows plain data, shows the same
// each time and leaves the snapshot as it was.
function steady(snap, where) {
  const before = JSON.stringify(snap);
  let first;
  assert.doesNotThrow(() => {first = screen(snap);}, where);
  assert.doesNotThrow(() => structuredClone(first), `${where}: plain data, no functions`);
  assert.deepEqual(screen(snap), first, `${where}: the same snapshot shows the same screen`);
  assert.equal(JSON.stringify(snap), before, where);
}

// Replaces Date while `run` runs, so that reading the clock, by Date.now() or
// by a Date made from nothing, throws.
function withoutClock(run) {
  const RealDate = Date, stop = () => {throw new Error('screen() read the clock');};
  class NoClock extends RealDate {constructor(...args) {if (!args.length) stop(); super(...args);}}
  NoClock.now = stop;
  globalThis.Date = NoClock;
  try {run();} finally {globalThis.Date = RealDate;}
}
// Every dialog kind for a home fixture: the alerts, each of its events, the
// natives, a chart's full history, and one Maison doesn't know.
const DIALOGS = f => [null, {kind: 'alerts'}, ...(f?.agenda?.events ?? [{startMs: HOME_NOW, endMs: HOME_NOW + 3600000}]).map(event => ({kind: 'event', event})),
  {kind: 'event', event: {summary: 'No times'}}, {kind: 'native', native: 'calendar'},
  {kind: 'native', native: 'history', chart: 'power'}, {kind: 'native', native: 'history', chart: 'climate-attic-temperature'}, {kind: 'weird'}];

test('screen() never throws, never reads the clock and never changes the snapshot', () => {
  withoutClock(() => {
    const busy = new Set([HOUSE_KEY, E.atticComfort]), feedback = new Map([[HOUSE_KEY, 'House heating · sending request…']]);
    const bases = [{states: {}}, {states: {}, online: false}, ...CLIMATE_FIXTURES.map(f => ({states: climateStates(f.id)})),
      {states: climateStates('house_running'), online: false, busy, feedback, draft: {house: {base: 20, temperature: 21}, houseEnd: '3h', awayUntil: 'not a date'}}];
    for (const base of bases) for (const detail of [null, ...CLIMATE_DETAILS.map(d => d.id), 'missing']) steady(deepFreeze(onClimate(base.states, detail, base)), `climate ${detail}`);
    // The Car and Today, with nothing, with every fixture, and offline with requests in flight and
    // an event and a forecast day missing their words.
    const inFlight = new Set([E.carLimit, E.carNow, E.vacuum]), lines = new Map([[E.carLimit, 'Charge limit · sending request…'], [E.vacuum, 'Roborock · request sent']]);
    const pages = [{states: {}}, {states: {}, online: false, carLast: {key: 'wait_sun', headline: 'Waiting', detail: 'For sun', tone: 'default', icon: 'sun'}},
      ...CAR_FIXTURES.map(f => ({states: structuredClone(f.states), now: CAR_NOW, carLast: f.last ?? null})),
      ...TODAY_FIXTURES.map(f => ({states: structuredClone(f.states), now: f.now ?? TODAY_NOW, loaded: {agenda: structuredClone(f.agenda), agendaLoading: f.agendaLoading, forecasts: structuredClone(f.forecasts)}})),
      {states: structuredClone(TODAY_FIXTURES[1].states), now: TODAY_NOW, online: false, busy: inFlight, feedback: lines, loaded: {agenda: {events: [{startMs: TODAY_NOW + 3600000, endMs: TODAY_NOW + 7200000}], errors: null}, forecasts: [{datetime: '2026-09-28T10:00:00Z'}]}}];
    for (const base of pages) for (const page of ['today', 'car']) steady(deepFreeze(onPage(page, base.states, base)), page);
    // Energy and Home status, the chrome and every dialog: with nothing, with every home fixture, and
    // offline with the vacuum in flight, a narrowed catalogue and the agenda loading.
    const homes = [{states: {}}, {states: {}, online: false, user: 'Alex Martin'},
      ...HOME_FIXTURES.map(f => ({f, states: structuredClone(f.states), now: HOME_NOW, user: 'Alex Martin', loaded: {agenda: structuredClone(f.agenda), agendaLoading: f.agendaLoading}})),
      ...HOME_FIXTURES.map(f => ({f, states: structuredClone(f.states), now: HOME_NOW, online: false, status: 'Roborock S8 Pro Ultra · waiting for device update…',
        busy: new Set([E.vacuum]), feedback: new Map([[E.vacuum, 'Roborock S8 Pro Ultra · waiting for device update…']]),
        sensors: {query: 'o', category: 'all', limit: 3}, loaded: {agenda: {events: [null, {summary: 'Odd'}], errors: null}, agendaLoading: true}}))];
    for (const {f, ...base} of homes) for (const page of PAGE_IDS) for (const dialog of DIALOGS(f))
      steady(deepFreeze(fixtureSnapshot({...base, route: {page, detail: null, dialog}})), `${page} ${dialog?.kind ?? 'no dialog'}`);
    // Each Energy sheet (v33), with nothing, with every Energy and home fixture and its power chart, online and
    // offline, with and without a dialog over it, and one the page doesn't have.
    const energies = [{states: {}}, ...[...ENERGY_FIXTURES, ...HOME_FIXTURES].map(f => ({states: structuredClone(f.states), now: f.now ?? HOME_NOW,
      loaded: {agenda: structuredClone(f.agenda), agendaLoading: f.agendaLoading, forecasts: structuredClone(f.forecasts), history: {energy: structuredClone(ENERGY_POWER_HISTORY)}}}))];
    for (const base of energies) for (const online of [true, false]) for (const detail of [...ENERGY_DETAILS.map(d => d.id), 'attic'])
      for (const dialog of [null, {kind: 'alerts'}]) steady(deepFreeze(fixtureSnapshot({...base, online, route: {page: 'energy', detail, dialog}})), `energy/${detail}`);
    // Each Car sheet (v34), with nothing, with every Car fixture and the page's own edges, online and
    // offline with the Car's requests in flight, with and without a dialog over it, and one the page doesn't have.
    const cars = [{states: {}}, ...[...CAR_FIXTURES, ...CAR_PAGE_FIXTURES].map(f => ({states: structuredClone(f.states), now: CAR_NOW, carLast: f.last ?? null}))];
    const carBusy = new Set([E.carNow, E.carLimit, E.carRefresh]), carLines = new Map([[E.carNow, 'Charge now · request sent'], [E.carRefresh, 'Wake · request sent']]);
    for (const base of cars) for (const extra of [{online: true}, {online: false, busy: carBusy, feedback: carLines}]) for (const detail of [...CAR_DETAILS.map(d => d.id), 'bill'])
      for (const dialog of [null, {kind: 'alerts'}]) steady(deepFreeze(fixtureSnapshot({...base, ...extra, route: {page: 'car', detail, dialog}})), `car/${detail}`);
  });
});

test('with nothing in Home Assistant, every Climate value says "Not set up yet" or "—", never 0', () => {
  const values = [null, ...CLIMATE_DETAILS.map(d => d.id)].map(detail => {const s = screen(onClimate({}, detail)); return detail ? s.drawer : s.page;});
  const shown = words(values);
  assert.ok(shown.includes('Not set up yet') && shown.includes('—'));
  assert.doesNotMatch(shown.join('\n'), /(?<![\d.])0(?:\.0)?(?:°|%)/);
  assert.deepEqual(controls(values).filter(c => c.enabled && !['detail', 'native-history', 'close'].includes(c.command)), [], 'nothing to press');
});

test('with nothing in Home Assistant, Today and the Car say "—", never 0, and only navigate', () => {
  const values = ['today', 'car'].map(page => screen(onPage(page, {})).page);
  const shown = [...words(values), ...controls(values).map(c => c.label ?? '')].join('\n');
  assert.ok(words(values).includes('—'));
  assert.doesNotMatch(shown, /(?<![\d.])0(?:\.0+)?\s?(?:°|%|W|kW|kWh|m²)(?!\w)/);
  assert.deepEqual(controls(values).filter(c => c.enabled && WRITE_COMMANDS.has(c.command)), [], 'nothing to press');
  assert.deepEqual(controls(values).filter(c => c.enabled && c.command === 'more'), [], 'no details for what Home Assistant doesn’t have');
});

test('with nothing in Home Assistant, every page, the chrome and every dialog say "—" or No reading, never 0, and only navigate', () => {
  const shown = PAGE_IDS.flatMap(page => DIALOGS(null).map(dialog => screen(fixtureSnapshot({now: HOME_NOW, route: {page, detail: null, dialog}}))));
  const text = [...words(shown), ...controls(shown).map(c => c.label ?? '')].join('\n');
  assert.ok(words(shown).includes('—') && words(shown).includes('No reading'));
  // The header charts are read too, accessible names and all.
  assert.deepEqual([...new Set(shown.map(s => s.chrome.hero?.kind ?? null))], ['weather', 'zones', 'car', 'flows', null]);
  assert.doesNotMatch(JSON.stringify(shown.map(s => [s.chrome.line, s.chrome.hero])), /(?<![\d.,])0(?:[.,]0+)?\s?(?:°|%|W|kW|kWh|m²|h|€)(?!\w)/);
  assert.doesNotMatch(text, /(?<![\d.,])0(?:[.,]0+)?\s?(?:°|%|W|kW|kWh|m²|h|€)(?!\w)/);
  assert.deepEqual(controls(shown).filter(c => c.enabled && WRITE_COMMANDS.has(c.command)), [], 'nothing to press');
  assert.deepEqual(controls(shown).filter(c => c.enabled && c.command === 'more'), [], 'no details for what Home Assistant doesn’t have');
});

// ---- The kit -------------------------------------------------------------------
test('allowed() is the guard’s action while online and not busy, and null otherwise', () => {
  const states = climateStates('house_running'), step = {command: 'house-step', entity: 'house', direction: 1};
  assert.deepEqual(allowed(step, at(states)), guard(step, at(states)));
  assert.equal(allowed(step, at(states, {online: false})), null, 'offline');
  assert.equal(allowed(step, at(states, {busy: new Set([HOUSE_KEY])})), null, 'its own key busy');
  assert.deepEqual(allowed(step, at(states, {busy: new Set([E.atticComfort])})), guard(step, at(states)), 'another key busy');
  assert.equal(allowed({...step, direction: 2}, at(states)), null, 'refused by guard()');
  for (const command of ['navigate', 'more', 'detail', 'house-reboot']) assert.equal(allowed({command, entity: 'house'}, at(states)), null, command);
});
test('a control is enabled exactly when online, allowed by guard() and not busy', () => {
  const states = climateStates('house_running'), step = {command: 'house-step', entity: 'house', direction: 1};
  assert.equal(control(step, at(states)).enabled, true);
  assert.equal(control(step, at(states, {online: false})).enabled, false, 'offline');
  assert.equal(control(step, at(states, {busy: new Set([HOUSE_KEY])})).enabled, false, 'its own key busy');
  assert.equal(control(step, at(states, {busy: new Set([E.atticComfort])})).enabled, true, 'another key busy');
  assert.equal(control({...step, direction: 2}, at(states)).enabled, false, 'refused by guard()');
  assert.equal(control({command: 'house-reboot', entity: 'house'}, at(states)).enabled, false, 'an unknown command');
  // The rule, for every intent the Climate page can hold, in every state.
  const intents = [step, {command: 'house-end', entity: '3h'}, {command: 'away-until', entity: 'house', value: ''}, {command: 'house-away', entity: 'house'},
    {command: 'zone-override', entity: 'attic', direction: 1}, {command: 'zone-step', entity: 'noah', direction: -1}, {command: 'step', entity: E.atticComfort, direction: 1},
    {command: 'drying-start', entity: 'bathroom'}, {command: 'toggle', entity: CLIMATE_CONTRACT.aircoCooling}, {command: 'house-override-cancel', entity: 'house'}];
  for (const f of CLIMATE_FIXTURES) for (const online of [true, false]) for (const busy of [[], [HOUSE_KEY], [ZONE_TARGET], [E.atticComfort]]) for (const intent of intents) {
    const snap = at(f.states, {online, busy: new Set(busy)}), a = guard(intent, snap);
    assert.equal(control(intent, snap).enabled, online && a !== null && !busy.includes(a.key), `${f.id} ${intent.command} online=${online} busy=${busy}`);
    assert.equal(control(intent, snap).enabled, allowed(intent, snap) !== null);
  }
});

// A button in flight keeps its focus (#29 step 4), so a control says so,
// and what to say ('In progress'); nothing else changes, and enabled stays
// false.
test('a control says busy, In progress, only while its request is in flight: online, allowed and its key busy; else it has neither key', () => {
  const states = climateStates('house_running'), step = {command: 'house-step', entity: 'house', direction: 1}, own = new Set([HOUSE_KEY]);
  const held = {busy: true, busyLabel: 'In progress'};
  assert.deepEqual(control(step, at(states, {busy: own})), {intent: step, enabled: false, ...held}, 'its own key busy');
  for (const [where, snap, intent] of [['idle', at(states), step], ['offline', at(states, {online: false, busy: own}), step],
    ['another key busy', at(states, {busy: new Set([E.atticComfort])}), step], ['refused by guard()', at(states, {busy: own}), {...step, direction: 2}]]) {
    const c = control(intent, snap);
    assert.ok(!('busy' in c) && !('busyLabel' in c), where);
  }
  assert.deepEqual(control(step, at(states), {label: 'Warmer', busy: true, busyLabel: 'Sending'}), {intent: step, label: 'Warmer', enabled: true}, 'no extra can set it');
  assert.deepEqual(control(step, at(states, {busy: own}), {busy: false, busyLabel: 'Sending'}), {intent: step, enabled: false, ...held}, 'or change it');
  // Controls that share a key wait together: the house's step and its override.
  const siblings = [step, {command: 'house-override', entity: 'house'}].map(intent => control(intent, at(states, {busy: own})));
  assert.deepEqual(siblings.map(c => [c.busy, c.busyLabel, c.enabled]), [[true, 'In progress', false], [true, 'In progress', false]]);
  // The rule, for every intent the Climate page can hold, in every state.
  const intents = [step, {command: 'house-end', entity: '3h'}, {command: 'zone-override', entity: 'attic', direction: 1}, {command: 'step', entity: E.atticComfort, direction: 1},
    {command: 'drying-start', entity: 'bathroom'}, {command: 'toggle', entity: CLIMATE_CONTRACT.aircoCooling}, {command: 'house-override-cancel', entity: 'house'}];
  for (const f of CLIMATE_FIXTURES) for (const online of [true, false]) for (const busy of [[], [HOUSE_KEY], [ZONE_TARGET], [E.atticComfort]]) for (const intent of intents) {
    const snap = at(f.states, {online, busy: new Set(busy)}), a = guard(intent, snap), c = control(intent, snap);
    assert.equal('busy' in c, online && a !== null && busy.includes(a.key), `${f.id} ${intent.command} online=${online} busy=${busy}`);
    assert.equal('busyLabel' in c, 'busy' in c);
    if ('busy' in c) assert.deepEqual([c.busy, c.busyLabel, c.enabled], [true, 'In progress', false]);
  }
  // controls() and words() never read them.
  const shown = {held: control(step, at(states, {busy: own}), {label: 'Warmer'})};
  assert.deepEqual(controls(shown), [{command: 'house-step', entity: 'house', direction: 1, label: 'Warmer', enabled: false, selected: undefined}]);
  assert.deepEqual(words(shown), ['Warmer']);
});

test('a control carries its extras, but no extra can decide its enabled', () => {
  const states = climateStates('house_running'), refused = {command: 'house-away', entity: 'house'};
  const value = control(refused, at(states), {label: 'Set Away', icon: 'home', selected: false, enabled: true});
  assert.deepEqual(value, {intent: refused, label: 'Set Away', icon: 'home', selected: false, enabled: false});
  assert.equal(control(refused, at(states)).intent, refused, 'the intent is the one given');
});

test('a control carries no feedback: the value draws its block’s line, from the snapshot', () => {
  const states = climateStates('house_running'), line = 'House heating 20° until 22:00 · waiting for the thermostat';
  const feedback = new Map([[HOUSE_KEY, line]]);
  for (const intent of [{command: 'house-override', entity: 'house'}, {command: 'house-step', entity: 'house', direction: 1}, {command: 'house-reboot'}])
    assert.ok(!('feedback' in control(intent, at(states, {feedback}))), intent.command);
  const house = screen(onClimate(states, null, {feedback})).page.house;
  assert.equal(house.feedback, line, 'the house card’s line');
  const actions = [], walk = node => {if (node && typeof node === 'object') {if (!Array.isArray(node) && 'intent' in node) actions.push(node); else Object.values(node).forEach(walk);}};
  for (const detail of [null, 'house', 'attic']) walk(screen(onClimate(states, detail, {feedback})));
  assert.ok(actions.length > 20);
  assert.deepEqual(actions.filter(a => 'feedback' in a), [], 'no control or link on the page or its drawers carries one');
});

test('a link is always enabled, except more for an entity Home Assistant doesn’t have', () => {
  const states = climateStates('house_running');
  for (const command of ['detail', 'native-history', 'navigate', 'alerts', 'native-calendar', 'agenda-event', 'ha-energy', 'ha-settings', 'close'])
    assert.equal(link({command, entity: 'nowhere'}, at(states, {online: false, busy: new Set(['nowhere'])})).enabled, true, command);
  assert.equal(link({command: 'more', entity: 'schedule.attic_occupied'}, at(states)).enabled, true);
  assert.equal(link({command: 'more', entity: 'climate.nowhere'}, at(states)).enabled, false);
  assert.equal(link({command: 'more'}, at(states)).enabled, false);
  assert.deepEqual(link({command: 'more', entity: 'climate.nowhere'}, at(states), {label: 'Airco controls', icon: 'climate', enabled: true}),
    {intent: {command: 'more', entity: 'climate.nowhere'}, label: 'Airco controls', icon: 'climate', enabled: false});
  // On the Attic drawer: Airco controls while the Airco exists, and not without it.
  assert.equal(screen(onClimate(states, 'attic')).drawer.body.airco.link.enabled, true);
  delete states[ATTIC.airco];
  assert.equal(screen(onClimate(states, 'attic')).drawer.body.airco.link.enabled, false);
});

test('kit(snapshot) binds control and link to that one snapshot', () => {
  const snap = at(climateStates('house_override'), {busy: new Set([ZONE_TARGET])}), bound = kit(snap);
  for (const intent of [{command: 'house-override-cancel', entity: 'house'}, {command: 'zone-override', entity: 'attic', direction: 1}, {command: 'zone-step', entity: 'noah', direction: 1}])
    assert.deepEqual(bound.control(intent, {label: 'x'}), control(intent, snap, {label: 'x'}), intent.command);
  assert.deepEqual(bound.link({command: 'more', entity: 'nowhere'}), link({command: 'more', entity: 'nowhere'}, snap));
});

// ---- The import graph ------------------------------------------------------------
const MAISON = new URL('../config/www/maison/', import.meta.url);
// Every sibling module a served module imports: static, side-effect or dynamic.
const importsOf = file => [...readFileSync(new URL(file, MAISON), 'utf8')
  .matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]\.\/([\w-]+\.js)(?:\?[^'"]*)?['"]/g)].map(m => m[1]);
const reaches = file => {
  const seen = new Set(), walk = name => {for (const next of importsOf(name)) if (!seen.has(next)) {seen.add(next); walk(next);}};
  walk(file);
  return seen;
};

test('climate.js never imports guard.js or screen.js, directly or through another module', () => {
  assert.deepEqual(new Set(importsOf('climate.js')), new Set(['model.js', 'history.js']), 'the parser reads climate.js’s imports');
  const reached = reaches('climate.js');
  assert.ok(!reached.has('guard.js'), [...reached].join(', '));
  assert.ok(!reached.has('screen.js'), [...reached].join(', '));
});

test('the rules and values sit below guard.js and screen.js: guard → rules, screen → guard and the pages', () => {
  const imports = {'screen.js': ['guard.js', 'model.js', 'climate.js', 'car.js', 'today.js', 'energy.js', 'system.js', 'sky.js'],
    'guard.js': ['model.js', 'climate.js', 'car.js'], 'history.js': [], 'car.js': ['model.js'], 'today.js': ['model.js', 'car.js', 'climate.js', 'energy.js'],
    'energy.js': ['model.js', 'history.js', 'car.js'], 'system.js': ['model.js', 'data.js'], 'sky.js': ['model.js']};
  for (const [file, expected] of Object.entries(imports)) assert.deepEqual(new Set(importsOf(file)), new Set(expected), `${file}’s imports`);
  for (const rule of ['climate.js', 'car.js', 'today.js', 'energy.js', 'system.js', 'sky.js', 'history.js', 'data.js', 'model.js']) {
    const reached = reaches(rule);
    assert.ok(!reached.has('guard.js') && !reached.has('screen.js'), `${rule} reaches ${[...reached].join(', ')}`);
  }
  assert.ok(!reaches('guard.js').has('screen.js'), 'guard.js never needs what is shown');
});
