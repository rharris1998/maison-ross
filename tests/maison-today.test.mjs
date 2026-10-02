// The Today page (#27, #29 step 4): the glance chips, Needs you, Coming up,
// power now, the zones, the Car's ring, today's energy, the vacuum's quiet
// line and the widgets they fill, as screen() works them out from one
// snapshot. Every test reads the value, never HTML: its words, its
// accessible names and its links. How the page draws them is in
// maison-today-page.test.mjs, whether pressing a control does what it shows
// in maison-agreement.test.mjs, and the Car glance's own wording in
// maison-car.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {E} from '../config/www/maison/model.js';
import {WIDGET_ROWS, CAR_GLANCE_STATES} from '../config/www/maison/today.js';
import {CHARGE_SOURCE} from '../config/www/maison/car.js';
import {screen, controls, words} from '../config/www/maison/screen.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {TODAY_FIXTURES, TODAY_NOW, TODAY_WEEK} from '../frontend/maison/fixtures/today-fixtures.js';
import {CAR_FIXTURES} from '../frontend/maison/fixtures/car-fixtures.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
const registered = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {get: key => registered.get(key), define: (key, value) => registered.set(key, value)};
globalThis.window = {customCards: []};
await import('../config/www/maison/maison-dashboard.js');
const Maison = registered.get('maison-dashboard');

const tz = 'Europe/Brussels', HOUR = 3600000, DAY = 24 * HOUR;
// Sunday 27 September 2026 at midnight in Brussels, TODAY_NOW's day.
const MIDNIGHT = Date.parse('2026-09-27T00:00:00+02:00');
const fixture = id => structuredClone(TODAY_FIXTURES.find(f => f.id === id));
const state = (value, attributes = {}) => ({state: String(value), attributes});
const watts = value => state(value, {unit_of_measurement: 'W'});
// A fixture with some states changed: a state object replaces, undefined removes.
const patched = (id, changes) => {
  const f = fixture(id);
  for (const [entity, value] of Object.entries(changes)) if (value === undefined) delete f.states[entity]; else f.states[entity] = value;
  return f;
};
// A Today fixture's snapshot at its own time (the night's), else TODAY_NOW,
// with the agenda and forecast the element loads beside it. `extra` is
// merged in: online, busy, now, carLast, loaded.
const snapshot = (f, {loaded = {}, ...extra} = {}) => fixtureSnapshot({now: f.now ?? TODAY_NOW, ...extra, states: f.states, route: {page: 'today'},
  loaded: {agenda: f.agenda, agendaLoading: f.agendaLoading, forecasts: f.forecasts, ...loaded}});
const page = (f, extra) => screen(snapshot(f, extra)).page;
const event = (summary, startMs, hours, extra = {}) => ({summary, startMs, endMs: startMs + hours * HOUR, allDay: false, partial: false,
  calendarId: 'calendar.alex_personal', location: '', description: '', ...extra});
const agenda = (events, errors = {}) => ({events, errors, status: {'calendar.alex_personal': 'ok'}});
const intentOf = link => [link.intent.command, link.intent.entity];
const ZERO = /(?<![\d.,])0(?:[.,]0+)?\s?(?:°|%|W|kW|kWh|m²|h|€)(?!\w)/;
// The alerts the enumeration raises, one per binary sensor.
const ALERTS = ['binary_sensor.roborock_s8_pro_ultra_water_shortage', 'binary_sensor.solar_zero_export_suspected', 'binary_sensor.rate_card_ends_within_30_days'];
const NO_BINS = {'sensor.residual_waste': state('unknown'), 'sensor.pmc': state('unknown'), 'sensor.paper': state('unknown')};

// What Today draws on a phone, and from 700px: the chips stand in for the
// Car, power now and Climate widgets.
const PHONE = ['glance', 'needs', 'upcoming', 'energyToday', 'vacuumLine'];
const WIDE = value => [...value.widgets.flatMap(w => w.id === 'car' ? ['car', 'carRing'] : [w.id]), 'vacuumLine'];
const drawn = (value, keys) => keys.map(key => value[key]);
// Everything a reader or a screen reader meets in some values: words, names and link labels.
const everything = value => [...words(value), ...controls(value).map(c => c.label ?? '')].join('\n');
// The rows a list widget draws: its rows, the loading row, the note, and "more" as a row.
const drawnRows = value => value.rows.length + (value.loading ? 1 : 0) + (value.note ? 1 : 0) + (value.more ? 1 : 0);

// Each field in one line, or a few.
function summary(value) {
  const {glance, needs, upcoming, live, climate, carRing, energyToday, vacuumLine, widgets} = value;
  const more = link => link ? [`${link.label} → ${link.intent.command}`] : [];
  return {
    glance: glance.items.map(i => `${i.title} · ${i.line} (${i.icon}, ${i.tone})`),
    needs: needs && [...needs.rows.map(r => [r.title, r.detail].filter(Boolean).join(' · ')), ...more(needs.more)],
    upcoming: upcoming && [...(upcoming.loading ? ['loading'] : []), ...upcoming.rows.map(r => [r.title, r.detail, r.value].filter(Boolean).join(' · ')),
      ...(upcoming.note ? [upcoming.note.text] : []), ...more(upcoming.more)],
    live: [[live.figure.value, live.figure.unit].filter(Boolean).join(' '), live.line, live.icon, live.tone],
    climate: [climate.note, ...climate.chart.zones.map(z => `${z.name} ${z.reading}`)],
    carRing: [carRing.label, carRing.tone],
    energyToday: [[energyToday.figure.value, energyToday.figure.unit].filter(Boolean).join(' '), ...energyToday.legend.map(l => l.text),
      `${energyToday.bar.kind}: ${energyToday.bar.segments.map(s => s.key).join(' ')}`.trim()],
    vacuumLine: vacuumLine && [vacuumLine.text, vacuumLine.active],
    widgets: widgets.map(w => `${w.id} ${w.size}`),
  };
}

// ---- Each fixture ------------------------------------------------------------
test('every Today fixture reads in household language', () => {
  const zones = readings => ['Living', 'Attic', 'Sam', 'Noah', 'Bedroom'].map((name, i) => `${name} ${readings[i]}`);
  const warm = zones(['19.6°', '19.8°', '19.2°', '20.1°', '16.8°']), split = 'split: home export import';
  const expected = {
    quiet: {
      glance: ['Climate · 16.8–20.2° inside (climate, temperature)', 'Energy · 2.84 kW solar (sun, yellow)', 'Car · 42% · waiting (car, gray)'],
      needs: null, upcoming: ['PMD recycling · Collection in 3 days · Wed'],
      live: ['2.84 kW', 'Solar · exporting 1.61 kW', 'sun', 'yellow'],
      climate: ['At target', ...zones(['19.6°', '20.2°', '19.2°', '20.1°', '16.8°'])], carRing: ['42%', 'gray'],
      energyToday: ['8.4 kWh', '5.3 used at home', '3.1 exported', '2.1 from the grid', split],
      vacuumLine: ['Roborock is docked, battery 100%', false],
      widgets: ['car small', 'live small', 'climate medium', 'upcoming medium', 'energyToday medium'],
    },
    busy: {
      glance: ['Climate · 16.8–20.1° inside (climate, temperature)', 'Energy · 2.84 kW solar (sun, yellow)', 'Car · Charging · 63% (car, green)'],
      needs: ['PMD recycling · tomorrow · Put the bin out', '2 more → alerts'],
      upcoming: ['School fair · Now · until 14:00', 'Recycling park · Tomorrow · All day', 'Residual waste · Collection in 5 days · Fri'],
      live: ['2.84 kW', 'Solar · house 1.23 kW', 'sun', 'yellow'],
      climate: ['Warming', ...warm], carRing: ['63%', 'green'],
      energyToday: ['8.4 kWh', '5.3 used at home', '3.1 exported', '2.1 from the grid', split],
      vacuumLine: ['Roborock is cleaning · 40% done', true],
      widgets: ['needs medium', 'car small', 'live small', 'climate medium', 'upcoming large', 'energyToday medium'],
    },
    paused: {
      glance: ['Climate · 16.8–20.1° inside (climate, temperature)', 'Energy · 2.84 kW solar (sun, yellow)', 'Car · 42% at 10:00 (car, gray)'],
      needs: null, upcoming: ['loading', 'PMD recycling · Collection in 3 days · Wed'],
      live: ['2.84 kW', 'Solar · exporting 1.61 kW', 'sun', 'yellow'],
      climate: ['Warming', ...warm], carRing: ['42%', 'gray'],
      energyToday: ['8.4 kWh', '5.3 used at home', '3.1 exported', '2.1 from the grid', split],
      vacuumLine: ['Roborock is paused', true],
      widgets: ['car small', 'live small', 'climate medium', 'upcoming medium', 'energyToday medium'],
    },
    unavailable: {
      glance: ['Climate · — (climate, gray)', 'Energy · — (grid, gray)', 'Car · 63% at 10:00 (car, gray)'],
      needs: null, upcoming: ['Calendar could not be loaded'],
      live: ['—', 'No power reading', 'energy', 'gray'],
      climate: ['Thermostat state unknown', ...zones(['—', '—', '—', '—', '—'])], carRing: ['63%', 'gray'],
      energyToday: ['—', '— used at home', '— exported', '— from the grid', 'missing:'],
      vacuumLine: ['Roborock: no reading', false],
      widgets: ['car small', 'live small', 'climate medium', 'upcoming medium', 'energyToday medium'],
    },
    night: {
      glance: ['Climate · 16.8–20.1° inside (climate, temperature)', 'Energy · 316 W from grid (grid, indigo)', 'Car · 80% · charged (car, gray)'],
      needs: null, upcoming: ['Swimming lesson · Tomorrow · 07:00', 'Dentist · Tomorrow · 09:30', 'PMD recycling · Collection in 3 days · Wed'],
      live: ['316 W', 'From the grid · off-peak', 'grid', 'indigo'],
      climate: ['Heating switched off on the thermostat', ...warm], carRing: ['80%', 'gray'],
      energyToday: ['11.5 kWh', '6.6 used at home', '4.9 exported', '4.6 from the grid', split],
      vacuumLine: ['Roborock is docked, battery 100%', false],
      widgets: ['car small', 'live small', 'climate large', 'upcoming large', 'energyToday medium'],
    },
  };
  assert.deepEqual(TODAY_FIXTURES.map(f => f.id).sort(), Object.keys(expected).sort(), 'one expectation per fixture');
  for (const f of TODAY_FIXTURES) {
    const value = page(f);
    assert.deepEqual(summary(value), expected[f.id], f.id);
    assert.deepEqual([value.glance.label, value.needs?.title ?? null, value.upcoming?.title, value.live.title, value.climate.title, value.energyToday.title,
      value.energyToday.figure.label], ['At a glance', expected[f.id].needs ? 'Needs you' : null, 'Coming up', 'Power now', 'Climate', 'Energy today', 'Solar generated'], f.id);
    assert.deepEqual([value.needs?.icon ?? null, value.upcoming.icon, value.climate.icon, value.energyToday.icon, value.carRing.icon],
      [expected[f.id].needs ? 'alert' : null, 'life', 'climate', 'sun', 'car'], `${f.id}: each widget's glyph`);
    assert.deepEqual(value.glance.items.map(i => [i.id, i.title]), [['climate', 'Climate'], ['energy', 'Energy'], ['car', 'Car']], f.id);
  }
});

test('each chip is named in words: commas, "to" in a range, and a missing reading as no reading', () => {
  const names = f => page(f).glance.items.map(i => i.link.ariaLabel);
  assert.deepEqual(names(fixture('night')), ['Climate: 16.8 to 20.1° inside. Open Climate', 'Energy: 316 W from the grid. Open Energy', 'Car: 80%, charged. Open Car']);
  assert.deepEqual(names(fixture('quiet')), ['Climate: 16.8 to 20.2° inside. Open Climate', 'Energy: 2.84 kW of solar. Open Energy', 'Car: 42%, waiting. Open Car']);
  assert.deepEqual(names(fixture('paused'))[2], 'Car: 42% at 10:00, waiting. Open Car');
  assert.deepEqual(names(fixture('unavailable')), ['Climate: no reading. Open Climate', 'Energy: no reading. Open Energy', 'Car: 63% at 10:00, unplugged. Open Car']);
});

// A widget with a link is read as one element: its body and note are hidden,
// so the link's name says everything they show.
test('a linked widget’s name says all its body shows: Power now, Climate and Energy today', () => {
  const night = page(fixture('night'));
  assert.equal(night.live.link.ariaLabel, 'Power now: 316 W from the grid, off-peak. Open Energy');
  assert.equal(night.climate.link.ariaLabel, 'Climate: Heating switched off on the thermostat. Zone temperatures: Living 19.6°, heating switched off; '
    + 'Attic 19.8°, target 21°; Sam 19.2°, target 20°; Noah 20.1°, target 20°; Bedroom 16.8°, target 17°. Open Climate');
  assert.equal(night.energyToday.link.ariaLabel, 'Energy today: 11.5 kWh solar generated. 6.6 kWh used at home, 4.9 kWh exported, 4.6 kWh from the grid. Open Energy');
  assert.equal(night.energyToday.bar.ariaLabel, 'Energy today, in kWh: 6.6 used at home, 4.9 exported, 4.6 from the grid');
  const gone = page(fixture('unavailable'));
  assert.deepEqual([gone.live.link.ariaLabel, gone.energyToday.link.ariaLabel], ['Power now: no reading. Open Energy',
    'Energy today: no solar reading. Some readings are missing. Open Energy']);
  // Every fixture: each number the body draws is in the name.
  for (const f of TODAY_FIXTURES) {
    const value = page(f), {live, climate, energyToday} = value;
    const said = (name, lines) => {for (const line of lines) for (const figure of line.match(/\d+(?:\.\d+)?/g) ?? []) assert.ok(name.includes(figure), `${f.id}: ${figure} of “${line}” in “${name}”`);};
    said(live.link.ariaLabel, [live.figure.value, live.line]);
    said(climate.link.ariaLabel, [climate.note ?? '', ...climate.chart.zones.map(z => z.reading)]);
    assert.ok(climate.link.ariaLabel.includes(climate.chart.ariaLabel) && (!climate.note || climate.link.ariaLabel.includes(climate.note)), f.id);
    said(energyToday.link.ariaLabel, [energyToday.figure.value, ...energyToday.legend.map(l => l.text)]);
  }
});

// ---- The chips and power now ----------------------------------------------------
test('the climate chip is the range of the zone readings, from room sensors only, gray without one', () => {
  const chip = changes => {const {line, tone, link} = page(patched('night', changes)).glance.items[0]; return [line, tone, link.ariaLabel];};
  assert.deepEqual(chip({}), ['16.8–20.1° inside', 'temperature', 'Climate: 16.8 to 20.1° inside. Open Climate']);
  // Every room sensor but one gone: one reading, and a valve's probe never stands in.
  const gone = ['sensor.living_room_sensor_temperature', 'sensor.office_sensor_temperature', 'sensor.sams_office_sensor_temperature', 'sensor.bedroom_sensor_temperature'];
  assert.deepEqual(chip(Object.fromEntries(gone.map(id => [id, state('unavailable')]))), ['20.1° inside', 'temperature', 'Climate: 20.1° inside. Open Climate']);
  assert.equal(chip({...Object.fromEntries(gone.map(id => [id, undefined])), 'sensor.noahs_room_sensor_temperature': state(23)})[0], '23.0° inside', 'one decimal, as the capsules print');
  assert.equal(chip({...Object.fromEntries(gone.map(id => [id, state(20.04)])), 'sensor.noahs_room_sensor_temperature': state(19.96)})[0], '20.0° inside', 'the same to a decimal');
  assert.deepEqual(chip({...Object.fromEntries(gone.map(id => [id, undefined])), 'sensor.noahs_room_sensor_temperature': undefined}),
    ['—', 'gray', 'Climate: no reading. Open Climate'], 'no reading: no room scale');
});

test('power now is solar while it produces, else the grid by Energy’s 10 W threshold, else nothing to read; the register only in its line', () => {
  const now = changes => {const v = page(patched('night', changes)); return [v.glance.items[1].line, v.glance.items[1].tone, ...summary(v).live, v.live.link.ariaLabel];};
  assert.deepEqual(now({}), ['316 W from grid', 'indigo', '316 W', 'From the grid · off-peak', 'grid', 'indigo', 'Power now: 316 W from the grid, off-peak. Open Energy']);
  assert.deepEqual(now({[E.offPeakNow]: state('off')}).slice(3), ['From the grid · peak', 'grid', 'indigo', 'Power now: 316 W from the grid, peak. Open Energy']);
  assert.deepEqual(now({[E.offPeakNow]: state('unavailable')}).slice(3), ['From the grid', 'grid', 'indigo', 'Power now: 316 W from the grid. Open Energy'], 'an unknown register is left out');
  // Exporting with no solar reading, and past the threshold either way.
  assert.deepEqual(now({[E.grid]: watts(-1000)}), ['1.00 kW to grid', 'green', '1.00 kW', 'To the grid · off-peak', 'grid', 'green', 'Power now: 1.00 kW to the grid, off-peak. Open Energy']);
  assert.deepEqual(now({[E.grid]: watts(11)}).slice(0, 4), ['11 W from grid', 'indigo', '11 W', 'From the grid · off-peak']);
  assert.deepEqual(now({[E.grid]: watts(-11)}).slice(0, 4), ['11 W to grid', 'green', '11 W', 'To the grid · off-peak']);
  for (const w of [10, 5, 0, -5, -10])
    assert.deepEqual(now({[E.grid]: watts(w)}), ['Grid idle', 'gray', `${Math.abs(w)} W`, 'Grid idle · off-peak', 'grid', 'gray', 'Power now: grid idle, off-peak. Open Energy'], `${w} W`);
  // Solar producing: exporting past the threshold, or the house's use, or neither without a reading.
  assert.deepEqual(now({[E.solar]: watts(2840), [E.grid]: watts(-1606)}), ['2.84 kW solar', 'yellow', '2.84 kW', 'Solar · exporting 1.61 kW', 'sun', 'yellow',
    'Power now: 2.84 kW of solar, exporting 1.61 kW. Open Energy']);
  assert.deepEqual(now({[E.solar]: watts(2840), [E.grid]: watts(-8), [E.load]: watts(2848)}).slice(3), ['Solar · house 2.85 kW', 'sun', 'yellow',
    'Power now: 2.84 kW of solar, the house using 2.85 kW. Open Energy'], 'an export within the threshold is the house’s');
  assert.deepEqual(now({[E.solar]: watts(2840), [E.grid]: undefined, [E.load]: undefined}).slice(3), ['Solar', 'sun', 'yellow', 'Power now: 2.84 kW of solar. Open Energy']);
  // Solar below 10 W isn't producing.
  assert.deepEqual(now({[E.solar]: watts(4)}).slice(0, 4), ['316 W from grid', 'indigo', '316 W', 'From the grid · off-peak']);
  assert.deepEqual(now({[E.grid]: state('unavailable')}), ['—', 'gray', '—', 'No power reading', 'energy', 'gray', 'Power now: no reading. Open Energy']);
  // Nowhere else on Today says the register. The Car widget's own
  // wording is the Car tab's (maison-car.test.mjs): its plan may say when
  // off-peak starts.
  for (const f of TODAY_FIXTURES) {
    const value = page(f), others = [...drawn(value, PHONE), ...drawn(value, WIDE(value)).filter(v => v !== value.live && v !== value.car)];
    assert.doesNotMatch(everything(others), /\b(off-)?peak\b/i, f.id);
  }
  assert.doesNotMatch(everything(page(fixture('night')).glance), /peak|register/i);
});

// Today says the register only in power now's line, by its name.
test('Maison calls a tariff period a register, never a band (CONTEXT.md)', () => {
  const states = {[E.offPeakNow]: state('on'), [E.priceAllIn]: state('0.3'), [E.elapsedDays]: state('86'), [E.grid]: watts(316)};
  const value = screen(fixtureSnapshot({states, route: {page: 'today'}})).page;
  assert.equal(value.live.line, 'From the grid · off-peak');
  for (const shown of [value, ...TODAY_FIXTURES.map(f => page(f))]) assert.doesNotMatch(everything(shown), /\bbands?\b/i);
});

test('the Car chip is its battery and a word or two, Charging while it draws, when a stale level was confirmed, or its state alone', () => {
  assert.deepEqual(Object.keys(CAR_GLANCE_STATES).sort(), Object.keys(CHARGE_SOURCE).sort(), 'a short state for every headline key car.js can give');
  const chips = {};
  for (const f of CAR_FIXTURES) {
    const value = page({...fixture('quiet'), states: {...fixture('quiet').states, ...structuredClone(f.states)}}, {carLast: f.last ?? null});
    const chip = value.glance.items[2];
    chips[f.id] = `${chip.line} (${chip.tone}, ring ${value.carRing.label} ${value.carRing.tone}) “${chip.link.ariaLabel}”`;
    assert.ok(chip.line.length <= 23, `${f.id}: ${chip.line}`);
  }
  assert.deepEqual(chips, {
    solar: 'Charging · 63% (green, ring 63% green) “Car: 63%, charging. Open Car”', solar_ridethrough: 'Charging · 63% (green, ring 63% green) “Car: 63%, charging. Open Car”',
    offpeak: 'Charging · 38% (green, ring 38% green) “Car: 38%, charging. Open Car”', charge_now: 'Charging · 63% (green, ring 63% green) “Car: 63%, charging. Open Car”',
    economical: 'Charging · 63% (green, ring 63% green) “Car: 63%, charging. Open Car”',
    wait_offpeak: '42% · waiting (gray, ring 42% gray) “Car: 42%, waiting. Open Car”', wait_offpeak_asleep: '42% at 10:00 (gray, ring 42% gray) “Car: 42% at 10:00, waiting. Open Car”',
    wait_sun: '63% · waiting (gray, ring 63% gray) “Car: 63%, waiting. Open Car”', solar_paused: '63% · waiting (gray, ring 63% gray) “Car: 63%, waiting. Open Car”',
    house_busy: '63% · waiting (gray, ring 63% gray) “Car: 63%, waiting. Open Car”', complete: '80% · charged (gray, ring 80% gray) “Car: 80%, charged. Open Car”',
    unplugged: '63% at 10:00 (gray, ring 63% gray) “Car: 63% at 10:00, unplugged. Open Car”',
    never_confirmed: 'Unplugged (gray, ring — gray) “Car: unplugged, battery unknown. Open Car”',
    automatic_off: '63% · auto charging off (gray, ring 63% gray) “Car: 63%, auto charging off. Open Car”',
    // Another vehicle charging is never the Car.
    other_vehicle: '63% · Charger in use (gray, ring 63% gray) “Car: 63%, Charger in use. Open Car”',
    not_verified: '63% at 10:00 (gray, ring 63% gray) “Car: 63% at 10:00, not verified. Open Car”',
    stale: '63% at 10:00 (gray, ring 63% gray) “Car: 63% at 10:00, out of date. Open Car”',
    dropout: '63% · waiting (gray, ring 63% gray) “Car: 63%, waiting. Open Car”',
    charger_offline: '63% · Charger offline (gray, ring 63% gray) “Car: 63%, Charger offline. Open Car”',
    power_missing: '63% · paused (gray, ring 63% gray) “Car: 63%, paused. Open Car”', initializing: '63% · starting up (gray, ring 63% gray) “Car: 63%, starting up. Open Car”',
  });
});

test('charging with no battery reading, the chip says Charging and the ring keeps its tone', () => {
  const solar = structuredClone(CAR_FIXTURES.find(f => f.id === 'solar').states);
  for (const id of [E.carBattery, E.carLastBattery]) solar[id] = {...solar[id], state: 'unavailable'};
  const value = page({...fixture('quiet'), states: {...fixture('quiet').states, ...solar}}), chip = value.glance.items[2];
  assert.deepEqual([chip.line, chip.tone, chip.link.ariaLabel, value.carRing], ['Charging', 'green', 'Car: charging, battery unknown. Open Car', {icon: 'car', label: '—', tone: 'green'}]);
  // A level confirmed on an earlier day says when.
  const stale = structuredClone(CAR_FIXTURES.find(f => f.id === 'stale').states);
  stale[E.carLastBattery] = {...stale[E.carLastBattery], attributes: {...stale[E.carLastBattery].attributes, confirmed_at: new Date(TODAY_NOW - 2 * DAY).toISOString()}};
  assert.equal(page({...fixture('quiet'), states: {...fixture('quiet').states, ...stale}}).glance.items[2].line, '63% at Fri 12:30');
  stale[E.carLastBattery].attributes.confirmed_at = new Date(TODAY_NOW - 9 * DAY).toISOString();
  assert.match(page({...fixture('quiet'), states: {...fixture('quiet').states, ...stale}}).glance.items[2].line, /^63% on 18 Sept?$/);
});

// The Car widget's own wording is the Car tab's (maison-car.test.mjs).
test('the Car widget reads as the Car tab’s header and Battery sheet do, and opens the Car tab', () => {
  for (const f of TODAY_FIXTURES) {
    const snap = snapshot(f), glance = screen(snap).page.car, line = screen({...snap, route: {...snap.route, page: 'car'}}).chrome.line;
    const battery = screen({...snap, route: {page: 'car', detail: 'battery', dialog: null}}).drawer.body.summary;
    assert.equal(glance.headline, battery.headline, f.id);
    assert.ok(line.startsWith(glance.headline), `${f.id}: “${glance.headline}” heads “${line}”`);
    assert.deepEqual(controls(glance).map(c => [c.command, c.entity, c.enabled]), [['navigate', 'car', true]], f.id);
  }
});

// ---- Needs you -------------------------------------------------------------------
test('Needs you holds every alert up to its two rows, else the most urgent and "N more"', () => {
  const needs = changes => page(patched('quiet', changes)).needs;
  const on = count => Object.fromEntries(ALERTS.slice(0, count).map(id => [id, state('on')]));
  assert.equal(needs(on(0)), null, 'nothing needs attention: no widget');
  assert.equal(WIDGET_ROWS.medium, 2);
  for (const count of [1, 2]) assert.deepEqual([needs(on(count)).rows.length, needs(on(count)).more], [count, null], `${count}`);
  const three = needs(on(3));
  assert.deepEqual([three.title, three.icon], ['Needs you', 'alert']);
  assert.deepEqual(three.rows.map(r => [r.title, r.detail, r.icon, r.tone, ...intentOf(r.link), r.link.enabled]),
    [['Vacuum needs water', '', 'alert', 'orange', 'more', ALERTS[0], true]], 'no generic "Open for details"');
  assert.deepEqual([three.more.label, three.more.ariaLabel, three.more.intent, three.more.enabled], ['2 more', '2 more alerts. Open Home alerts', {command: 'alerts'}, true]);
  // Five: a bin today and a low battery too; the bin is the one shown.
  const five = needs({...on(3), 'sensor.pmc': state(0),
    'sensor.door_battery': {entity_id: 'sensor.door_battery', state: '12', attributes: {device_class: 'battery', unit_of_measurement: '%', friendly_name: 'Front door sensor'}}});
  assert.deepEqual([five.rows.map(r => `${r.title} · ${r.detail}`), five.more.label], [['PMD recycling · today · Put the bin out'], '4 more']);
});

test('the most urgent first: bins due today or tomorrow, then device errors, then the rest, each in the alerts’ order', () => {
  const rows = changes => page(patched('quiet', changes)).needs.rows.map(r => [r.title, r.detail]);
  const water = {[ALERTS[0]]: state('on')}, filter = {'sensor.roborock_s8_pro_ultra_filter_time_left': state(0)};
  const vacuumError = {'sensor.roborock_s8_pro_ultra_vacuum_error': state('main_brush_jammed')}, dockError = {'sensor.roborock_s8_pro_ultra_dock_dock_error': state('water_empty')};
  assert.deepEqual(rows({...water, 'sensor.pmc': state(1)}), [['PMD recycling · tomorrow', 'Put the bin out'], ['Vacuum needs water', '']]);
  assert.deepEqual(rows({...filter, ...vacuumError}), [['Vacuum: Main brush jammed', 'Device reported an error'], ['Vacuum filter needs cleaning', 'Maintenance interval reached']]);
  assert.deepEqual(rows({...water, ...dockError}), [['Vacuum dock: Water empty', 'Device reported an error'], ['Vacuum needs water', '']]);
  assert.deepEqual(rows({...vacuumError, 'sensor.residual_waste': state(0)}), [['Residual waste · today', 'Put the bin out'], ['Vacuum: Main brush jammed', 'Device reported an error']]);
  assert.deepEqual(rows({'sensor.residual_waste': state(1), 'sensor.pmc': state(0)}), [['Residual waste · tomorrow', 'Put the bin out'], ['PMD recycling · today', 'Put the bin out']],
    'bins keep the alerts’ order');
  assert.deepEqual(rows({...water, ...filter}), [['Vacuum filter needs cleaning', 'Maintenance interval reached'], ['Vacuum needs water', '']], 'the rest keep it too');
});

// ---- Coming up -------------------------------------------------------------------
test('Coming up: each event that hasn’t ended, named by when it is, with its start time', () => {
  const rows = (events, now = TODAY_NOW) => page(patched('quiet', NO_BINS), {now, loaded: {agenda: agenda(events)}}).upcoming.rows
    .map(r => [r.title, r.detail.replace(/Sept?/, 'Sep'), r.value]);
  const monday = TODAY_NOW + 18.5 * HOUR;
  assert.deepEqual(rows([event('Ended', TODAY_NOW - 2 * HOUR, 1), event('On now', TODAY_NOW - HOUR, 2), event('Tea', TODAY_NOW + 3 * HOUR, 1),
    event('Swim', monday, 1), event('Fair', MIDNIGHT + 3 * DAY, 24, {allDay: true, partial: true})]), [
    ['On now', 'Now · until 13:30', ''], ['Tea', 'Today', '15:30'], ['Swim', 'Tomorrow', '07:00'], ['Fair', 'Wed 30 Sep · All day', '']]);
  // Midnight to one in the morning: the hour cycle is 00, never 24.
  assert.deepEqual(rows([event('Late', TODAY_NOW + 11.5 * HOUR, 1)]), [['Late', 'Tomorrow', '00:00']]);
  // Tomorrow is the next date in the house's time zone, not 24 hours on.
  assert.deepEqual(rows([event('Swim', monday, 1)], TODAY_NOW + 11 * HOUR), [['Swim', 'Tomorrow', '07:00']], '23:30 on Sunday');
  assert.deepEqual(rows([event('Swim', monday, 1)], TODAY_NOW + 12 * HOUR), [['Swim', 'Today', '07:00']], '00:30 on Monday');
  // On now past midnight, or since yesterday.
  assert.deepEqual(rows([event('Film', TODAY_NOW - 0.5 * HOUR, 13)]), [['Film', 'Now · until tomorrow 01:00', '']]);
  assert.deepEqual(rows([event('Shift', MIDNIGHT - 2 * HOUR, 16)]), [['Shift', 'Now · until 14:00', '']]);
  assert.deepEqual(rows([event('Film', Date.parse('2026-09-27T23:30:00+02:00'), 2)], Date.parse('2026-09-28T00:30:00+02:00')), [['Film', 'Now · until 01:30', '']]);
});

test('an all-day event never says now: today’s is Today, one that began on an earlier day says its last day', () => {
  const rows = events => page(patched('quiet', NO_BINS), {loaded: {agenda: agenda(events)}}).upcoming.rows.map(r => [r.title, r.detail.replace(/Sept?/, 'Sep'), r.value]);
  const allDay = (summary, from, days) => event(summary, MIDNIGHT + from * DAY, days * 24, {allDay: true});
  assert.deepEqual(rows([allDay('Birthday', 0, 1), allDay('Weekend', -1, 2), allDay('Trip', -1, 3), allDay('Holiday week', -2, 5), allDay('Course', -1, 10)]), [['Birthday', 'Today · All day', ''], ['Weekend', 'Today · All day', ''], ['Trip', 'Until tomorrow', ''], ['Holiday week', 'Until Tue', ''],
    ['Course', 'Until Mon 5 Oct', '']]);
  assert.deepEqual(rows([allDay('Fair', 1, 1), allDay('Market', 3, 2)]), [['Fair', 'Tomorrow · All day', ''], ['Market', 'Wed 30 Sep · All day', '']]);
  assert.deepEqual(rows([allDay('Birthday', 0, 1)]).length, 1);
  // Partial calendars are the event dialog's to explain: Today never says so.
  const partial = page(fixture('busy'));
  assert.doesNotMatch(everything([partial.upcoming, partial.glance]), /Partial|Current-event/);
});

test('each event opens its dialog by its place in the agenda', () => {
  const f = fixture('busy'), value = page(f), events = value.upcoming.rows.filter(r => r.link.intent.command === 'agenda-event');
  assert.deepEqual(events.map(r => [r.title, ...intentOf(r.link), r.link.enabled]), [['School fair', 'agenda-event', '1', true], ['Recycling park', 'agenda-event', '2', true]],
    'the ended Coffee keeps its place');
  for (const r of events) assert.equal(f.agenda.events[Number(r.link.intent.entity)].summary, r.title);
  // An event without a readable time is left out without moving the others.
  const odd = agenda([event('No start', NaN, 1), null, ...f.agenda.events]);
  assert.deepEqual(page(f, {loaded: {agenda: odd}}).upcoming.rows.filter(r => r.icon === 'life').map(r => [r.title, r.link.intent.entity]),
    [['School fair', '3'], ['Recycling park', '4']]);
});

test('a forecast day or an event without a readable time is left out, and never stops the page', () => {
  const f = fixture('busy'), odd = agenda([event('No start', NaN, 1), {...event('No end', TODAY_NOW, 1), endMs: undefined}, ...f.agenda.events]);
  const {chrome, page: value} = screen(snapshot(f, {loaded: {agenda: odd, forecasts: [{datetime: 'soon', condition: 'rainy', temperature: 3}, {condition: 'sunny', temperature: 20}, ...f.forecasts]}}));
  assert.deepEqual(chrome.hero.days.map(d => d.name), ['Today', 'Mon', 'Tue', 'Wed']);
  const events = value.upcoming.rows.filter(r => r.link.intent.command === 'agenda-event');
  assert.deepEqual(events.map(r => r.title), ['School fair', 'Recycling park']);
  assert.deepEqual(events.map(r => odd.events[Number(r.link.intent.entity)].summary), ['School fair', 'Recycling park'], 'each opens the event it shows');
});

test('the next collection two days or more away sorts among the events by day, after that day’s own', () => {
  const titles = (bins, events) => page(patched('quiet', {'sensor.residual_waste': state(bins[0]), 'sensor.pmc': state(bins[1]), 'sensor.paper': state(bins[2])}),
    {loaded: {agenda: agenda(events)}}).upcoming?.rows.map(r => `${r.title}${r.icon === 'life' ? '' : ` · ${r.detail} · ${r.value}`}`) ?? null;
  const monday = TODAY_NOW + 18.5 * HOUR, events = [event('Swim', monday, 1), event('Choir', monday + 2 * DAY, 1), event('Market', monday + 3 * DAY, 1)];
  assert.deepEqual(titles([5, 3, 9], events), ['Swim', 'Choir', 'PMD recycling · Collection in 3 days · Wed', 'Market'], 'Wednesday, after its Choir');
  assert.deepEqual(titles([5, 2, 9], events), ['Swim', 'PMD recycling · Collection in 2 days · Tue', 'Choir', 'Market']);
  // From a week away, its date rather than a weekday.
  assert.deepEqual(titles([9, 'unknown', 12], events), ['Swim', 'Choir', 'Market', 'Residual waste · Collection in 9 days · Tue 6 Oct']);
  assert.deepEqual(titles([7, 'unknown', 'unknown'], []), ['Residual waste · Collection in 7 days · Sun 4 Oct']);
  assert.deepEqual(titles([6, 'unknown', 'unknown'], []), ['Residual waste · Collection in 6 days · Sat']);
  // A bin due today or tomorrow is an alert, so Coming up leaves it out and shows the next one.
  assert.deepEqual(titles([5, 1, 9], []), ['Residual waste · Collection in 5 days · Fri']);
  assert.deepEqual(titles([0, 1, 'unknown'], []), null, 'nothing else: no widget');
  const bin = page(fixture('quiet')).upcoming.rows[0];
  assert.deepEqual([bin.icon, bin.tone, ...intentOf(bin.link), bin.link.enabled], ['recycle', 'gray', 'more', 'sensor.pmc', true], 'the bin opens its sensor');
});

test('while the calendar loads there are no event rows and the placeholder is named; a failed calendar is a note opening the Full calendar', () => {
  const upcoming = (f, loaded) => page(f, {loaded}).upcoming;
  const loading = upcoming(fixture('busy'), {agendaLoading: true});
  assert.deepEqual([loading.loading, loading.loadingLabel, loading.rows.map(r => r.title), loading.note], [true, 'Loading the calendar', ['Residual waste'], null], 'the collection stays');
  assert.ok(!('loadingLabel' in upcoming(fixture('busy'), {})), 'named only while loading');
  assert.equal(upcoming(fixture('busy'), {agendaLoading: true, agenda: {...fixture('busy').agenda, errors: {'calendar.kids': 'offline'}}}).note, null, 'no note while loading');
  const note = value => value.note && [value.note.text, ...intentOf(value.note.link), value.note.link.ariaLabel, value.note.link.enabled];
  const failing = upcoming(fixture('busy'), {agenda: {...fixture('busy').agenda, errors: {'calendar.kids': 'offline'}}});
  assert.deepEqual([failing.rows.map(r => r.title), note(failing)], [['School fair', 'Recycling park', 'Residual waste'],
    ['Some calendars could not be loaded', 'native-calendar', undefined, 'Some calendars could not be loaded. Open the full calendar', true]], 'the events that did load stay');
  assert.deepEqual(note(page(fixture('unavailable')).upcoming), ['Calendar could not be loaded', 'native-calendar', undefined, 'Calendar could not be loaded. Open the full calendar', true]);
  assert.deepEqual(words(page(fixture('unavailable')).upcoming), ['Coming up', 'Calendar could not be loaded'], 'the note is one line');
  const nothing = patched('quiet', {'sensor.residual_waste': undefined, 'sensor.pmc': state('unknown'), 'sensor.paper': state(1)});
  assert.equal(upcoming(nothing, {}), null);
  assert.deepEqual(page(nothing).widgets.map(w => w.id), ['needs', 'car', 'live', 'climate', 'energyToday'], 'the bin is under Needs you only');
});

test('Coming up holds two rows at medium and five at large, a loading row or note taking one; past it, "N more" opens the Full calendar', () => {
  assert.deepEqual({...WIDGET_ROWS}, {medium: 2, large: 5});
  const monday = TODAY_NOW + 18.5 * HOUR;
  for (const extra of ['none', 'loading', 'note']) for (let count = 0; count <= 8; count += 1) {
    const events = Array.from({length: count}, (_, i) => event(`Event ${i + 1}`, monday + i * HOUR, 0.5));
    const value = page(patched('quiet', NO_BINS), {loaded: {agenda: agenda(events, extra === 'note' ? {'calendar.kids': 'offline'} : {}), agendaLoading: extra === 'loading'}});
    const where = `${count} events, ${extra}`, {upcoming} = value, slot = value.widgets.find(w => w.id === 'upcoming');
    if (count === 0 && extra === 'none') {assert.deepEqual([upcoming, slot], [null, undefined], where); continue;}
    const shown = extra === 'loading' ? 0 : count, used = drawnRows(upcoming);
    assert.equal(slot.size, shown + (extra === 'none' ? 0 : 1) <= 2 ? 'medium' : 'large', where);
    assert.ok(used <= WIDGET_ROWS[slot.size], `${where}: ${used} rows in a ${slot.size} widget`);
    assert.deepEqual(upcoming.rows.map(r => r.title), Array.from({length: shown}, (_, i) => `Event ${i + 1}`).slice(0, upcoming.rows.length), `${where}: the first ones`);
    const hidden = shown - upcoming.rows.length;
    if (!hidden) {assert.equal(upcoming.more, null, where); continue;}
    assert.equal(used, WIDGET_ROWS[slot.size], `${where}: full`);
    assert.deepEqual([upcoming.more.label, upcoming.more.ariaLabel, ...intentOf(upcoming.more), upcoming.more.enabled],
      [`${hidden} more`, `${hidden} more coming up. Open the full calendar`, 'native-calendar', undefined, true], where);
  }
  // With a collection after every event (v35): it is on no calendar, so it is never behind "N more". It stays the
  // last row shown, and "N more" counts the hidden events only, every one of them on the Full calendar.
  for (let count = 0; count <= 8; count += 1) {
    const events = Array.from({length: count}, (_, i) => event(`Event ${i + 1}`, monday + i * HOUR, 0.5));
    const {upcoming, widgets} = page(patched('quiet', {...NO_BINS, 'sensor.residual_waste': state(5)}), {loaded: {agenda: agenda(events)}});
    const titles = upcoming.rows.map(r => r.title), size = widgets.find(w => w.id === 'upcoming').size, where = `${count} events and a bin`;
    assert.equal(titles.at(-1), 'Residual waste', where);
    assert.deepEqual(titles.slice(0, -1), events.slice(0, titles.length - 1).map(e => e.summary), `${where}: the first events`);
    assert.equal(upcoming.more?.label ?? null, count > titles.length - 1 ? `${count - (titles.length - 1)} more` : null, where);
    assert.ok(drawnRows(upcoming) <= WIDGET_ROWS[size], `${where}: ${drawnRows(upcoming)} rows in a ${size} widget`);
  }
  const week = page(structuredClone(TODAY_WEEK)).upcoming;
  assert.deepEqual([week.rows.map(r => r.title), week.more.label], [['Swimming lesson', 'Dentist', 'Choir', 'Residual waste'], '4 more'], 'the full week');
});

// ---- Each thing once -------------------------------------------------------------
test('each thing is said once on Today: an alert only under Needs you, each event once', () => {
  const monday = TODAY_NOW + 18.5 * HOUR;
  const variants = [...TODAY_FIXTURES.map(f => [f.id, f, {}]),
    ['busy, a bin today and three events', patched('busy', {'sensor.residual_waste': state(0)}), {loaded: {agenda: agenda([event('Swim', monday, 1), event('Choir', monday + HOUR, 1), event('Swim', monday + DAY, 1)])}}],
    ['quiet, a bin tomorrow', patched('quiet', {'sensor.pmc': state(1)}), {}]];
  for (const [where, f, extra] of variants) {
    const value = page(f, extra), found = [...(value.needs?.rows ?? [])].map(r => r.title), upcoming = value.upcoming?.rows ?? [];
    for (const title of found) assert.ok(!upcoming.some(r => title.startsWith(r.title)), `${where}: ${title} is also coming up`);
    // A bin due within a day is never a collection row.
    for (const r of upcoming.filter(r => r.link.intent.command === 'more')) assert.match(r.detail, /^Collection in ([2-9]|\d{2,}) days$/, where);
    // An event row per agenda event that hasn't ended, each once.
    const events = upcoming.filter(r => r.link.intent.command === 'agenda-event').map(r => r.link.intent.entity);
    assert.equal(new Set(events).size, events.length, `${where}: an event twice`);
    for (const keys of [PHONE, WIDE(value)]) {
      const shown = words(drawn(value, keys));
      for (const r of upcoming.filter(r => r.icon === 'life')) {
        const same = upcoming.filter(other => other.title === r.title).length;
        assert.equal(shown.filter(line => line === r.title).length, same, `${where}: ${r.title} in ${keys.join(', ')}`);
      }
    }
  }
});

// ---- Today's energy and the vacuum -------------------------------------------------
test('today’s energy splits solar into home and export beside the grid, as the legend prints them; zero and missing split nothing', () => {
  const energy = changes => page(patched('night', changes)).energyToday;
  const shares = value => value.bar.segments.map(s => `${s.key} ${s.tone} ${s.share.toFixed(3)}`);
  assert.deepEqual([energy({}).bar.kind, shares(energy({}))], ['split', ['home yellow 0.410', 'export green 0.304', 'import indigo 0.286']]);
  assert.deepEqual(energy({}).legend.map(l => l.tone), ['yellow', 'green', 'indigo']);
  // Home never goes below 0, and a part at 0 has no segment.
  const over = energy({[E.exportToday]: state(12)});
  assert.deepEqual([over.legend[0].text, shares(over)], ['0.0 used at home', ['export green 0.723', 'import indigo 0.277']]);
  assert.deepEqual(shares(energy({[E.importToday]: state(0)})), ['home yellow 0.574', 'export green 0.426']);
  // The shares are the legend's own numbers, and home and export add up to the figure.
  for (const changes of [{}, {[E.solarToday]: state(8.45), [E.exportToday]: state(3.15), [E.importToday]: state(2.05)}, {[E.solarToday]: state(0.06), [E.exportToday]: state(0.04), [E.importToday]: state(0.26)}]) {
    const value = energy(changes), printed = value.legend.map(l => Number(l.text.split(' ')[0])), sum = printed.reduce((a, b) => a + b, 0);
    assert.deepEqual(value.bar.segments.map(s => s.share), printed.filter(v => v > 0).map(v => v / sum), JSON.stringify(changes));
    assert.equal((printed[0] + printed[1]).toFixed(1), value.figure.value, JSON.stringify(changes));
  }
  // Nothing yet: all three at 0, to the tenth.
  for (const changes of [{[E.solarToday]: state(0), [E.exportToday]: state(0), [E.importToday]: state(0)}, {[E.solarToday]: state(0.04), [E.exportToday]: state(0.01), [E.importToday]: state(0.04)}]) {
    const value = energy(changes);
    assert.deepEqual([value.bar.kind, value.bar.segments, value.bar.ariaLabel, value.link.ariaLabel],
      ['zero', [], 'Energy today: nothing generated or used yet', 'Energy today: nothing generated or used yet. Open Energy']);
  }
  for (const missing of [E.solarToday, E.exportToday, E.importToday]) {
    const value = energy({[missing]: state('unavailable')});
    assert.deepEqual([value.bar.kind, value.bar.segments, value.bar.ariaLabel], ['missing', [], 'Energy today: some readings are missing'], missing);
    assert.ok(value.legend.some(l => l.text.startsWith('— ')), missing);
    assert.match(value.link.ariaLabel, /some readings are missing\. Open Energy$/i, missing);
  }
  assert.deepEqual(energy({[E.exportToday]: undefined}).legend.map(l => l.text), ['— used at home', '— exported', '4.6 from the grid']);
  assert.equal(energy({[E.exportToday]: undefined}).link.ariaLabel, 'Energy today: 11.5 kWh solar generated. 4.6 kWh from the grid; some readings are missing. Open Energy');
  assert.deepEqual(energy({[E.solarToday]: state('unknown')}).figure, {label: 'Solar generated', value: '—', unit: ''});
});

// Today's energy is Energy's breakdown from v33 (energy.js's energyBreakdown,
// shared with Energy's widget and its Energy today sheet). Today's value is
// pinned whole, to the last share, as v32 drew it.
test('today’s energy is the breakdown v32 drew, whole: every fixture’s value, to the last share', () => {
  const TONES = ['yellow', 'green', 'indigo'], KEYS = ['home', 'export', 'import'];
  const legend = texts => texts.map((text, i) => ({tone: TONES[i], text}));
  const link = said => ({intent: {command: 'navigate', entity: 'energy'}, ariaLabel: `Energy today: ${said} Open Energy`, enabled: true});
  const split = (solar, shares, texts, said) => ({title: 'Energy today', icon: 'sun', figure: {label: 'Solar generated', value: solar, unit: 'kWh'},
    bar: {kind: 'split', segments: shares.map((share, i) => ({key: KEYS[i], tone: TONES[i], share})), ariaLabel: `Energy today, in kWh: ${texts.join(', ')}`},
    legend: legend(texts), link: link(said)});
  const day = split('8.4', [0.5047619047619047, 0.29523809523809524, 0.2], ['5.3 used at home', '3.1 exported', '2.1 from the grid'],
    '8.4 kWh solar generated. 5.3 kWh used at home, 3.1 kWh exported, 2.1 kWh from the grid.');
  const expected = {
    quiet: day, busy: day, paused: day,
    unavailable: {title: 'Energy today', icon: 'sun', figure: {label: 'Solar generated', value: '—', unit: ''},
      bar: {kind: 'missing', segments: [], ariaLabel: 'Energy today: some readings are missing'},
      legend: legend(['— used at home', '— exported', '— from the grid']), link: link('no solar reading. Some readings are missing.')},
    night: split('11.5', [0.4099378881987577, 0.30434782608695654, 0.28571428571428564], ['6.6 used at home', '4.9 exported', '4.6 from the grid'],
      '11.5 kWh solar generated. 6.6 kWh used at home, 4.9 kWh exported, 4.6 kWh from the grid.'),
  };
  assert.deepEqual(TODAY_FIXTURES.map(f => f.id).sort(), Object.keys(expected).sort(), 'one expectation per fixture');
  for (const f of TODAY_FIXTURES) for (const online of [true, false]) assert.deepEqual(page(f, {online}).energyToday, expected[f.id], `${f.id}${online ? '' : ', offline'}`);
});

test('the vacuum’s quiet line: its state in words, active while it cleans or pauses, null only without a vacuum', () => {
  const line = changes => {const v = page(patched('quiet', changes)).vacuumLine; return v && [v.icon, v.text, v.active];};
  assert.deepEqual(line({}), ['vacuum', 'Roborock is docked, battery 100%', false]);
  assert.deepEqual(line({[E.vacuumBattery]: state('unavailable')}), ['vacuum', 'Roborock is docked', false], 'no battery reading, no battery');
  assert.deepEqual(line({[E.vacuum]: state('cleaning'), [E.vacuumProgress]: state(40)}), ['vacuum', 'Roborock is cleaning · 40% done', true]);
  assert.deepEqual(line({[E.vacuum]: state('cleaning'), [E.vacuumProgress]: state(140)}), ['vacuum', 'Roborock is cleaning · 100% done', true]);
  assert.deepEqual(line({[E.vacuum]: state('cleaning'), [E.vacuumProgress]: undefined}), ['vacuum', 'Roborock is cleaning', true]);
  assert.deepEqual(line({[E.vacuum]: state('paused')}), ['vacuum', 'Roborock is paused', true]);
  assert.deepEqual(line({[E.vacuum]: state('returning')}), ['vacuum', 'Roborock is returning to the dock', false]);
  assert.deepEqual(line({[E.vacuum]: state('idle')}), ['vacuum', 'Roborock is idle', false]);
  assert.deepEqual(line({[E.vacuum]: state('zone_cleaning')}), ['vacuum', 'Roborock: Zone cleaning', false]);
  assert.deepEqual(line({[E.vacuum]: state('unavailable')}), ['vacuum', 'Roborock: no reading', false]);
  assert.equal(line({[E.vacuum]: undefined}), null);
  // An error is Needs you's to name: the line only says the vacuum stopped.
  const failed = page(patched('quiet', {[E.vacuum]: state('error'), 'sensor.roborock_s8_pro_ultra_vacuum_error': state('main_brush_jammed')}));
  assert.deepEqual([failed.vacuumLine.text, failed.needs.rows[0].title], ['Roborock has stopped', 'Vacuum: Main brush jammed']);
  // While active, the page's own run and dock are what the line carries.
  const {vacuum} = page(fixture('busy'));
  assert.deepEqual([vacuum.run.label, vacuum.dock.label], ['Pause', 'Dock']);
});

test('the vacuum offers Clean, Pause or Resume by its state, and Dock', () => {
  const vacuum = id => page(fixture(id)).vacuum;
  const run = v => [v.run.intent, v.run.label, v.run.icon];
  assert.deepEqual(run(vacuum('quiet')), [{command: 'vacuum', entity: 'start'}, 'Clean', 'start']);
  assert.deepEqual(run(vacuum('busy')), [{command: 'vacuum', entity: 'pause'}, 'Pause', 'pause']);
  assert.deepEqual(run(vacuum('paused')), [{command: 'vacuum', entity: 'start'}, 'Resume', 'start']);
  const docked = vacuum('quiet');
  assert.deepEqual([docked.dock.intent, docked.dock.label, docked.dock.icon], [{command: 'vacuum', entity: 'return_to_base'}, 'Dock', 'dock']);
  assert.deepEqual(controls(docked).map(c => [c.command, c.entity, c.enabled]), [['vacuum', 'start', true], ['vacuum', 'return_to_base', true]]);
});

test('the vacuum’s commands wait while it is unavailable, offline or a request is in flight', () => {
  const enabled = (f, extra) => {const v = page(f, extra).vacuum; return [v.run.enabled, v.dock.enabled];};
  assert.deepEqual(enabled(fixture('unavailable')), [false, false], 'unavailable');
  assert.deepEqual(enabled(fixture('quiet'), {online: false}), [false, false], 'offline');
  // All three commands share the vacuum's busy key, so one in flight holds both buttons.
  for (const id of ['quiet', 'busy', 'paused']) {
    assert.deepEqual(enabled(fixture(id), {busy: new Set([E.vacuum])}), [false, false], id);
    assert.deepEqual(enabled(fixture(id), {busy: new Set([E.carLimit])}), [true, true], `${id}: another key busy`);
  }
});

test('a vacuum request in flight holds Dock until Home Assistant confirms it', async t => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: TODAY_NOW});
  const f = fixture('quiet'), card = Object.create(Maison.prototype), calls = [];
  let finish;
  card._hass = {states: f.states, connected: true, config: {time_zone: tz}, callService: (...args) => {calls.push(args); return new Promise(resolve => {finish = resolve;});}};
  card._busy = new Set(); card._page = 'today'; card.render = () => {}; card.toast = () => {};
  const shown = () => screen(card.snapshot()).page.vacuum;
  const clean = card.command(shown().run.intent);
  assert.deepEqual([shown().run.enabled, shown().dock.enabled], [false, false]);
  await card.command(shown().dock.intent);
  assert.deepEqual(calls, [['vacuum', 'start', {entity_id: E.vacuum}]], 'Dock is refused while Clean is in flight');
  finish(); await clean;
  card._hass.states = {...f.states, [E.vacuum]: {...f.states[E.vacuum], state: 'cleaning'}};
  card.reconcileActions();
  assert.deepEqual([shown().run.label, shown().run.enabled, shown().dock.enabled], ['Pause', true, true]);
  assert.match(card._feedback.get(E.vacuum), /confirmed by Home Assistant/);
});

// ---- Unavailable is never 0 ----------------------------------------------------------
test('with nothing to read, Today says — or no reading, never 0, and every widget still has its place', () => {
  const DRAWN = ['glance', 'needs', 'upcoming', 'live', 'climate', 'car', 'carRing', 'energyToday', 'vacuumLine', 'widgets'];
  for (const [where, value] of [['nothing', screen(fixtureSnapshot({now: TODAY_NOW, route: {page: 'today'}})).page],
    ['nothing, offline', screen(fixtureSnapshot({now: TODAY_NOW, online: false, route: {page: 'today'}})).page], ['unavailable', page(fixture('unavailable'))]]) {
    const shown = drawn(value, DRAWN), strings = JSON.stringify(shown);
    assert.doesNotMatch(everything(shown), ZERO, where);
    assert.doesNotMatch(strings, ZERO, `${where}: accessible names too`);
    assert.deepEqual([value.live.figure, value.energyToday.figure.value, value.energyToday.bar.kind, value.glance.items[1].line], [{value: '—', unit: ''}, '—', 'missing', '—'], where);
    assert.ok(value.climate.chart.zones.every(z => z.reading === '—'), where);
  }
  const nothing = screen(fixtureSnapshot({now: TODAY_NOW, route: {page: 'today'}})).page;
  assert.deepEqual([nothing.glance.items.map(i => [i.line, i.tone]), nothing.carRing, nothing.needs, nothing.upcoming, nothing.vacuumLine],
    [[['—', 'gray'], ['—', 'gray'], ['Charger offline', 'gray']], {icon: 'car', label: '—', tone: 'gray'}, null, null, null]);
  assert.equal(nothing.glance.items[2].link.ariaLabel, 'Car: Charger offline, battery unknown. Open Car');
  assert.deepEqual(nothing.widgets, [{id: 'car', size: 'small'}, {id: 'live', size: 'small'}, {id: 'climate', size: 'large'}, {id: 'energyToday', size: 'medium'}]);
});

// ---- Links -------------------------------------------------------------------------
test('every press on Today is a link to its page or dialog, and the vacuum’s own two', () => {
  for (const f of TODAY_FIXTURES) {
    const value = page(f), where = f.id;
    assert.deepEqual(value.glance.items.map(i => [...intentOf(i.link), i.link.enabled]), [['navigate', 'climate', true], ['navigate', 'energy', true], ['navigate', 'car', true]], where);
    assert.deepEqual([value.live, value.climate, value.energyToday].map(v => [...intentOf(v.link), v.link.enabled]),
      [['navigate', 'energy', true], ['navigate', 'climate', true], ['navigate', 'energy', true]], where);
    assert.deepEqual([...intentOf(value.car.link), value.car.link.enabled], ['navigate', 'car', true], `${where}: the Car widget opens the Car tab`);
    for (const r of value.needs?.rows ?? []) assert.equal(r.link.intent.command, 'more', where);
    // An event opens its dialog and a collection its bin's sensor; the calendar's note and "N more" the Full calendar.
    for (const r of value.upcoming?.rows ?? []) assert.ok(['agenda-event', 'more'].includes(r.link.intent.command), where);
    for (const link of [value.upcoming?.note?.link, value.upcoming?.more].filter(Boolean)) assert.deepEqual(intentOf(link), ['native-calendar', undefined], where);
    const widgets = drawn(value, ['glance', 'needs', 'upcoming', 'live', 'climate', 'car', 'carRing', 'energyToday', 'vacuumLine', 'widgets']);
    assert.deepEqual([...new Set(controls(widgets).map(c => c.command))].filter(c => !['navigate', 'more', 'alerts', 'agenda-event', 'native-calendar'].includes(c)), [], `${where}: links only`);
    assert.ok(controls(widgets).every(c => c.enabled), `${where}: every link opens`);
    assert.deepEqual(controls(value.vacuum).map(c => c.command), ['vacuum', 'vacuum'], `${where}: the vacuum's own two`);
  }
});

// ---- Every row fills ---------------------------------------------------------------
test('every row of the widget grid fills at two and four columns, and no list draws more rows than its size holds', () => {
  const COLLECTIONS = {'due soon': [5, 3, 9], alert: ['unknown', 1, 'unknown'], unknown: ['unknown', 'unknown', 'unknown']};
  const monday = TODAY_NOW + 18.5 * HOUR, seen = new Set();
  let checked = 0;
  for (const alertCount of [0, 1, 3]) for (let eventCount = 0; eventCount <= 6; eventCount += 1)
    for (const [collection, bins] of Object.entries(COLLECTIONS)) for (const loading of [false, true]) for (const failing of [false, true]) {
      const f = patched('quiet', {...Object.fromEntries(ALERTS.slice(0, alertCount).map(id => [id, state('on')])),
        'sensor.residual_waste': state(bins[0]), 'sensor.pmc': state(bins[1]), 'sensor.paper': state(bins[2])});
      const events = Array.from({length: eventCount}, (_, i) => event(`Event ${i + 1}`, monday + i * HOUR, 0.5));
      const value = page(f, {loaded: {agenda: agenda(events, failing ? {'calendar.kids': 'offline'} : {}), agendaLoading: loading}});
      const where = `${alertCount} alerts, ${eventCount} events, collection ${collection}${loading ? ', loading' : ''}${failing ? ', calendar error' : ''}`;
      assert.deepEqual(value.widgets.map(w => w.id), ['needs', 'car', 'live', 'climate', 'upcoming', 'energyToday'].filter(id => !['needs', 'upcoming'].includes(id) || value[id]), where);
      for (const columns of Object.values(COLUMNS)) {
        const {holes, placements} = placeWidgets(value.widgets, columns);
        assert.deepEqual(holes, [], `${where} at ${columns} columns: ${placements.map(p => `${p.id} c${p.column} r${p.row}`).join(', ')}`);
      }
      for (const slot of value.widgets.filter(w => ['needs', 'upcoming'].includes(w.id)))
        assert.ok(drawnRows(value[slot.id]) <= WIDGET_ROWS[slot.size], `${where}: ${slot.id} draws ${drawnRows(value[slot.id])} rows at ${slot.size}`);
      seen.add(value.widgets.map(w => `${w.id} ${w.size}`).join(', '));
      checked += 1;
    }
  assert.equal(checked, 3 * 7 * 3 * 2 * 2);
  assert.equal(seen.size, 6, `the six compositions: ${[...seen].join(' | ')}`);
});

// ---- Busy ----------------------------------------------------------------------------
test('a control says busy, In progress, only while its request is in flight: online, allowed and its key busy', () => {
  const vacuum = (f, extra) => {const {run, dock} = page(f, extra).vacuum; return [run, dock].map(c => [c.enabled, c.busy, c.busyLabel]);};
  const idle = [[true, undefined, undefined], [true, undefined, undefined]], none = [[false, undefined, undefined], [false, undefined, undefined]];
  for (const id of ['quiet', 'busy', 'paused', 'night']) {
    assert.deepEqual(vacuum(fixture(id)), idle, `${id}: nothing in flight`);
    assert.deepEqual(vacuum(fixture(id), {busy: new Set([E.vacuum])}), [[false, true, 'In progress'], [false, true, 'In progress']], `${id}: the vacuum in flight holds both`);
    assert.deepEqual(vacuum(fixture(id), {busy: new Set([E.vacuum]), online: false}), none, `${id}: offline, nothing is in flight`);
    assert.deepEqual(vacuum(fixture(id), {busy: new Set([E.carLimit])}), idle, `${id}: another key`);
  }
  assert.deepEqual(vacuum(fixture('unavailable'), {busy: new Set([E.vacuum])}), none, 'refused by the guard');
  // Not in flight, there is neither key; in flight, the rest of the control is as it was.
  const run = page(fixture('busy')).vacuum.run, held = page(fixture('busy'), {busy: new Set([E.vacuum])}).vacuum.run;
  assert.ok(!('busy' in run) && !('busyLabel' in run));
  assert.deepEqual(held, {...run, enabled: false, busy: true, busyLabel: 'In progress'});
  // Nothing else on Today is ever busy: only the vacuum's controls are controls.
  const all = [], walk = node => {if (node && typeof node === 'object') {if (!Array.isArray(node) && 'intent' in node) all.push(node); else Object.values(node).forEach(walk);}};
  walk(page(fixture('busy'), {busy: new Set([E.vacuum, E.carLimit, E.carNow])}));
  assert.deepEqual(all.filter(a => 'busy' in a || 'busyLabel' in a).map(a => a.intent), [{command: 'vacuum', entity: 'pause'}, {command: 'vacuum', entity: 'return_to_base'}]);
});

// ---- What Today leaves to others ----------------------------------------------------
// Life left in v35 (#29), and the shopping list with it; nothing on Today leads to either.
test('Today has no shopping list and no way to Life', () => {
  for (const f of TODAY_FIXTURES) for (const online of [true, false]) {
    const value = page(structuredClone(f), {online});
    assert.ok(!('shopping' in value), f.id);
    assert.deepEqual(controls(value).filter(c => c.command === 'shopping' || c.entity === 'life'), [], f.id);
  }
});

// The Climate page owns every climate control (#21), and the Hue app every
// light. From #29 step 4 Today shows the zones' readings, as #29's approved
// desktop layout does, and its only way to Climate is the navigation.
test('Today carries no lighting and no climate controls', () => {
  const states = {...fixture('busy').states, ...structuredClone(CLIMATE_FIXTURES.find(f => f.id === 'house_running').states)};
  const value = screen(fixtureSnapshot({states, now: TODAY_NOW, route: {page: 'today'}})).page;
  assert.doesNotMatch(everything(value), /Rooms lit|Goodnight|Lights off|Dinner time/);
  assert.deepEqual(controls(value).filter(c => ['room', 'detail', 'toggle', 'step'].includes(c.command) || /^(house|zone|drying)-/.test(c.command)
    || (c.entity === 'climate' && c.command !== 'navigate')), []);
  assert.ok(words(value).some(line => line.startsWith('Roborock')));
});
