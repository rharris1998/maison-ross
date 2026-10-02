// Home status (#27, #29), route #system: Needs attention, Key devices,
// Vacuum maintenance, All sensors (with the viewer's search, category and
// page) and Home Assistant, as screen() works them out from one snapshot over
// every Home status fixture and React draws them. Every test reads the value
// through controls() and words(), never HTML. How the element keeps the
// search, the category and the page is in maison-dashboard.test.mjs; the home
// alerts dialog in maison-chrome.test.mjs; whether pressing a link does what
// it shows in maison-agreement.
import test from 'node:test';
import assert from 'node:assert/strict';
import {E, MAINTENANCE} from '../config/www/maison/model.js';
import {NO_ALERTS, alertRows, categoryIcon, readingValue} from '../config/www/maison/system.js';
import {allReadings} from '../config/www/maison/data.js';
import {iconNames} from '../config/www/maison/icons.js';
import {screen, controls, words, kit} from '../config/www/maison/screen.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';

const MINUTE = 60000, DAY = 24 * 60 * MINUTE;
const CORE_UPDATE = 'update.home_assistant_core_update';
const fixture = id => structuredClone(HOME_FIXTURES.find(f => f.id === id));
// A fixture with some states changed: an object merges over the state and
// its attributes, undefined removes it.
const patched = (id, changes) => {
  const f = fixture(id);
  for (const [entity, change] of Object.entries(changes)) {
    if (change === undefined) delete f.states[entity];
    else f.states[entity] = {entity_id: entity, ...f.states[entity], ...change, attributes: {...f.states[entity]?.attributes, ...change.attributes}};
  }
  return f;
};
// A home fixture's snapshot on Home status. `extra` is merged into it: online, busy, sensors, tz.
const snapshot = (f, extra = {}) => fixtureSnapshot({now: HOME_NOW, ...extra, states: f.states, route: {page: 'system', detail: null, dialog: null},
  loaded: {agenda: f.agenda, agendaLoading: f.agendaLoading, forecasts: f.forecasts}});
const page = (f, extra) => screen(snapshot(f, extra)).page;
const sensors = (f, filters = {}, extra = {}) => page(f, {...extra, sensors: {query: '', category: 'all', limit: 60, ...filters}}).sensors;
// The checks: every section but All sensors.
const checks = ({needs, devices, vacuum, homeAssistant}) => ({needs, devices, vacuum, homeAssistant});
// A value's words and its controls' names: everything a reader or a screen reader meets.
const everything = value => [...words(value), ...controls(value).map(c => c.label ?? '')].join('\n');
const intentOf = link => [link.intent.command, link.intent.entity];
// A reading of zero with a unit: what a missing reading must never become.
const ZERO = /(?<![\d.,])0(?:[.,]0+)?\s?(?:h|%|W|kW|kWh|°C|bar)(?!\w)/;
const KEY_DEVICES = [E.weather, E.grid, E.solar, E.vacuum, E.airco, E.boilerPressure];

// ---- Each fixture ------------------------------------------------------------------
// Each section in a few lines: what a glance at the page says.
function summary(value) {
  const {needs, devices, vacuum, sensors: catalogue, homeAssistant} = value;
  return {
    needs: [needs.title, ...needs.rows.map(r => `${r.title} · ${r.detail}`), needs.empty],
    devices: [devices.title, ...devices.rows.map(r => `${r.title} · ${r.detail}`), devices.line, devices.note],
    vacuum: [vacuum.title, ...vacuum.rows.map(r => `${r.title} ${r.value}${r.tone ? ` (${r.tone})` : ''}`)],
    sensors: [catalogue.count, catalogue.summary, ...(catalogue.empty ? [catalogue.empty] : [])],
    homeAssistant: [homeAssistant.title, ...homeAssistant.rows.map(r => `${r.title} ${r.value ?? '·'}`)],
  };
}

test('every Home status fixture reads in household language', () => {
  const NOTE = 'Solar can stop reporting overnight. An unavailable reading is shown as missing, never as zero.';
  const expected = {
    full: {
      needs: ['Needs attention', 'Vacuum filter needs cleaning · Maintenance interval reached', 'Hallway motion battery · 12% · Battery running low', null],
      devices: ['Key devices', 'All 6 key devices are reporting.', NOTE],
      vacuum: ['Vacuum maintenance', 'Vacuum filter Due (orange)', 'Dock strainer 12 h', 'Side brush 49 h', 'Vacuum sensors —'],
      sensors: ['56', '56 matching readings · 2 unavailable'],
      homeAssistant: ['Home Assistant', 'Settings ·', 'Core updates 2026.10.0 available'],
    },
    quiet: {
      needs: ['Needs attention', 'No household alerts right now.'],
      devices: ['Key devices', 'Solar inverter · No current reading', 'Airco · No current reading', null, NOTE],
      vacuum: ['Vacuum maintenance', 'Vacuum filter 40 h', 'Dock strainer 12 h', 'Side brush 49 h', 'Vacuum sensors 90 h'],
      sensors: ['27', '27 matching readings · 6 unavailable'],
      homeAssistant: ['Home Assistant', 'Settings ·', 'Core updates —'],
    },
    missing: {
      needs: ['Needs attention', 'No household alerts right now.'],
      devices: ['Key devices', 'Weather · No current reading', 'Grid meter · No current reading', 'Solar inverter · No current reading',
        'Vacuum · No current reading', 'Airco · No current reading', 'Boiler pressure · No current reading', null, NOTE],
      vacuum: ['Vacuum maintenance', 'Vacuum filter —', 'Dock strainer —', 'Side brush —', 'Vacuum sensors —'],
      sensors: ['0', '0 matching readings · 0 unavailable', 'No sensors match these filters.'],
      homeAssistant: ['Home Assistant', 'Settings ·', 'Core updates —'],
    },
  };
  assert.deepEqual(HOME_FIXTURES.map(f => f.id).sort(), Object.keys(expected).sort(), 'one expectation per fixture');
  for (const f of HOME_FIXTURES) {
    const value = page(f);
    assert.deepEqual(summary(value), expected[f.id], f.id);
    assert.deepEqual([value.sensors.title, value.sensors.note], ['All sensors',
      'Update times describe the last report. A reading that has not changed recently is not automatically a fault.'], f.id);
    // The page holds only what it draws, in a phone's drawing order.
    assert.deepEqual(Object.keys(value), ['id', 'needs', 'devices', 'vacuum', 'sensors', 'homeAssistant'], f.id);
    assert.equal(value.id, 'system', f.id);
  }
});

// ---- The checks ----------------------------------------------------------------------
test('Needs attention lists the household alerts, each opening its entity in amber, as the alerts dialog does; with none, one quiet line', () => {
  const {needs} = page(fixture('full'));
  assert.deepEqual(needs.rows.map(r => [r.icon, r.tone, r.title, ...intentOf(r.link), r.link.enabled]), [
    ['vacuum', 'amber', 'Vacuum filter needs cleaning', 'more', MAINTENANCE[0][1], true],
    ['battery', 'amber', 'Hallway motion battery · 12%', 'more', 'sensor.hallway_motion_battery', true],
  ]);
  for (const f of HOME_FIXTURES) {
    // The home alerts dialog lists the very same rows.
    const snap = snapshot(f), value = screen(snap).page.needs;
    assert.deepEqual(value.rows, alertRows(snap, kit(snap)), `${f.id}: the dialog’s rows`);
    assert.equal(value.empty, value.rows.length ? null : NO_ALERTS[0], f.id);
  }
  assert.deepEqual(page(fixture('quiet')).needs, {title: 'Needs attention', rows: [], empty: 'No household alerts right now.'});
});

test('Key devices names each one that has stopped, never as zero, or says all six report; never both', () => {
  for (const f of HOME_FIXTURES) {
    const {devices} = page(f);
    assert.ok((devices.rows.length === 0) === (devices.line !== null), `${f.id}: rows or the line`);
    for (const r of devices.rows) {
      assert.deepEqual([r.icon, r.tone, r.detail], ['plug', 'amber', 'No current reading'], `${f.id}: ${r.title}`);
      if (r.link) assert.deepEqual([r.link.intent.command, r.link.enabled, KEY_DEVICES.includes(r.link.intent.entity)], ['more', true, true], `${f.id}: ${r.title}`);
    }
  }
  // An intended change in #27: like every other `more`, a key device Home
  // Assistant doesn't have can't be opened, so its row is a plain one with
  // no link; one that is there but unavailable still opens.
  assert.deepEqual(page(fixture('quiet')).devices.rows.map(r => [r.title, r.link && r.link.intent.entity]), [['Solar inverter', E.solar], ['Airco', null]]);
  assert.deepEqual(page(fixture('missing')).devices.rows.map(r => [r.title, Boolean(r.link)]),
    [['Weather', false], ['Grid meter', false], ['Solar inverter', false], ['Vacuum', true], ['Airco', false], ['Boiler pressure', false]]);
  // The line counts the key devices, whatever their number.
  const full = page(fixture('full')).devices;
  assert.deepEqual([full.rows, full.line], [[], `All ${KEY_DEVICES.length} key devices are reporting.`]);
});

test('vacuum maintenance: hours left, Under 1 h, Due in orange at zero, — without a reading, each opening its sensor', () => {
  const rows = f => page(f).vacuum.rows.map(r => [r.icon, r.title, r.value, r.tone, r.link.ariaLabel, ...intentOf(r.link), r.link.enabled]);
  assert.deepEqual(rows(fixture('full')), [
    ['vacuum', 'Vacuum filter', 'Due', 'orange', 'Vacuum filter details', 'more', MAINTENANCE[0][1], true],
    ['vacuum', 'Dock strainer', '12 h', null, 'Dock strainer details', 'more', MAINTENANCE[1][1], true],
    ['vacuum', 'Side brush', '49 h', null, 'Side brush details', 'more', MAINTENANCE[2][1], true],
    ['vacuum', 'Vacuum sensors', '—', null, 'Vacuum sensors details', 'more', MAINTENANCE[3][1], true],
  ]);
  assert.deepEqual(rows(fixture('missing')).map(r => [r[2], r[3], r.at(-1)]), Array(4).fill(['—', null, false]), 'never 0 h, and nothing to open');
  for (const f of HOME_FIXTURES) assert.deepEqual(page(f).vacuum.rows.map(r => intentOf(r.link)), MAINTENANCE.map(([, id]) => ['more', id]), f.id);
  const values = changes => page(patched('quiet', changes)).vacuum.rows.map(r => [r.value, r.tone]);
  assert.deepEqual(values({[MAINTENANCE[0][1]]: {state: '0'}, [MAINTENANCE[1][1]]: {state: '-3'}, [MAINTENANCE[2][1]]: {state: 'unknown'}, [MAINTENANCE[3][1]]: undefined}),
    [['Due', 'orange'], ['Due', 'orange'], ['—', null], ['—', null]], 'zero and overdue are Due; no reading is —, never 0 h');
  // v35 (#29): under an hour left isn't due yet: it is said so, in gray, not rounded to a 0 h.
  const left = hours => values({[MAINTENANCE[1][1]]: {state: String(hours)}})[1];
  assert.deepEqual([0.01, 0.27, 0.5, 0.99, 1, 1.4].map(left), [['Under 1 h', null], ['Under 1 h', null], ['Under 1 h', null], ['Under 1 h', null], ['1 h', null], ['1 h', null]]);
});

test('Core updates says whether an update waits: Up to date, the version available, Installing…, or — while Home Assistant doesn’t know', () => {
  const core = changes => {
    const [settings, updates] = page(patched('full', {[CORE_UPDATE]: changes})).homeAssistant.rows;
    assert.deepEqual([settings.title, settings.value, settings.icon, intentOf(settings.link), settings.link.enabled], ['Settings', null, 'settings', ['ha-settings', undefined], true]);
    return [updates.title, updates.icon, ...intentOf(updates.link), updates.link.enabled, updates.value];
  };
  const versions = (installed, latest) => ({attributes: {installed_version: installed, latest_version: latest}});
  assert.deepEqual(core({state: 'off', ...versions('2026.10.1', '2026.10.1')}), ['Core updates', 'home', 'more', CORE_UPDATE, true, 'Up to date']);
  assert.deepEqual(core({state: 'on', ...versions('2026.9.3', '2026.10.1')}).at(-1), '2026.10.1 available');
  // A skipped version leaves Home Assistant's own state off: nothing waits.
  assert.equal(core({state: 'off', attributes: {installed_version: '2026.9.3', latest_version: '2026.10.1', skipped_version: '2026.10.1'}}).at(-1), 'Up to date');
  assert.equal(core({state: 'on', ...versions('2026.9.3', null)}).at(-1), '—', 'on with no version to name');
  // While it installs, as Home Assistant says: in_progress true, or a percentage on older versions; false is not.
  for (const in_progress of [true, 0, 45]) assert.equal(core({state: 'on', attributes: {installed_version: '2026.9.3', latest_version: '2026.10.1', in_progress}}).at(-1), 'Installing…', String(in_progress));
  assert.equal(core({state: 'on', attributes: {installed_version: '2026.9.3', latest_version: '2026.10.1', in_progress: false}}).at(-1), '2026.10.1 available');
  for (const state of ['unknown', 'unavailable']) assert.equal(core({state, ...versions('2026.9.3', '2026.10.1')}).at(-1), '—', state);
  assert.deepEqual(core(undefined).slice(-2), [false, '—'], 'no update entity: nothing to open, nothing to say');
});

// ---- All sensors ---------------------------------------------------------------------
test('the catalogue lists every sensor, a page at a time, each opening its entity', () => {
  const all = sensors(fixture('full'));
  assert.equal(all.rows.length, 56);
  assert.equal(all.more, null, 'nothing left to show');
  assert.equal(all.empty, null);
  assert.ok(all.rows.every(r => r.link.intent.command === 'more' && r.link.enabled && r.link.intent.entity));
  const first = sensors(fixture('full'), {limit: 5});
  assert.deepEqual(first.rows.map(r => r.title), ['<script>alert(1)</script> sensor', 'binary_sensor.electricity_off_peak_now', 'Boiler problem', 'Cellar temperature', 'Dishwasher plug power']);
  assert.deepEqual([first.summary, first.count], ['56 matching readings · 2 unavailable', '56'], 'the summary counts every match, not the page');
  assert.deepEqual([first.more.label, first.more.icon, first.more.intent, first.more.enabled], ['Show more (51 remaining)', 'plus', {command: 'sensor-more'}, true]);
  assert.equal(sensors(fixture('full'), {limit: 55}).more.label, 'Show more (1 remaining)');
  assert.equal(sensors(fixture('full'), {limit: 56}).more, null);
});

test('the search finds readings by name or entity, and the category narrows them', () => {
  const titles = value => value.rows.map(r => `${r.title} ${r.value}`);
  const temp = sensors(fixture('full'), {query: 'temp'});
  assert.deepEqual([temp.summary, titles(temp)], ['2 matching readings · 1 unavailable', ['Cellar temperature Unavailable', 'Living room temperature 21.4 °C']]);
  assert.equal(temp.search.value, 'temp', 'the field holds the query');
  assert.deepEqual(titles(sensors(fixture('full'), {query: 'sensor.office'})), ['Office CO2 612 ppm'], 'by entity id');
  const battery = sensors(fixture('full'), {category: 'battery'});
  assert.deepEqual([battery.summary, titles(battery)], ['2 matching readings · 0 unavailable', ['Hallway motion battery 12 %', 'sensor.roborock_s8_pro_ultra_battery 100 %']]);
  assert.equal(battery.category.selected, 'battery');
  assert.deepEqual(titles(sensors(fixture('full'), {query: 'hallway', category: 'presence'})), ['Hallway motion Motion detected'], 'both at once');
  const none = sensors(fixture('full'), {query: 'zzz'});
  assert.deepEqual([none.summary, none.rows, none.empty, none.more, none.count], ['0 matching readings · 0 unavailable', [], 'No sensors match these filters.', null, '56']);
});

// v35 (#29): counts are grouped as the readings are, and one match is singular.
test('the catalogue counts in British English: grouped in thousands, one reading in the singular', () => {
  const many = Object.fromEntries(Array.from({length: 1234}, (_, i) => [`sensor.s${i}`, {entity_id: `sensor.s${i}`, state: String(i), attributes: {}}]));
  const big = screen(fixtureSnapshot({now: HOME_NOW, states: many, route: {page: 'system'}})).page.sensors;
  assert.deepEqual([big.count, big.summary, big.more.label], ['1,234', '1,234 matching readings · 0 unavailable', 'Show more (1,174 remaining)']);
  assert.equal(sensors(fixture('full'), {query: 'front door'}).summary, '1 matching reading · 0 unavailable');
  assert.equal(sensors(fixture('full'), {query: 'cellar'}).summary, '1 matching reading · 1 unavailable');
});

// v35 (#29): the placeholder stops promising rooms, which the search never
// read, and the select offers every category data.js files a reading under
// (Pressure, Moisture, Safety and Signal strength joined; the category
// select's own test checks the coverage).
test('the search field and the category select say what they hold, and are always there to use', () => {
  const {search, category} = sensors(fixture('full'), {query: 'hall', category: 'presence'}, {online: false});
  assert.deepEqual(search, {intent: {command: 'sensor-search'}, ariaLabel: 'Find a sensor', placeholder: 'Search sensors', value: 'hall', enabled: true});
  assert.deepEqual([category.intent, category.ariaLabel, category.selected, category.enabled], [{command: 'sensor-category'}, 'Sensor category', 'presence', true]);
  assert.deepEqual(category.options.map(o => `${o.id}: ${o.label}`), ['all: All readings', 'temperature: Temperature', 'humidity: Humidity', 'pressure: Pressure',
    'presence: Motion', 'illuminance: Light level', 'battery: Battery', 'power: Power', 'energy: Energy', 'air-quality: Air quality', 'opening: Doors & windows',
    'moisture: Moisture', 'safety: Safety', 'signal-strength: Signal strength', 'other: Other']);
  // An element with no filters set yet shows everything.
  const bare = screen(fixtureSnapshot({states: fixture('full').states, now: HOME_NOW, route: {page: 'system'}, sensors: {query: undefined, category: undefined, limit: undefined}})).page.sensors;
  assert.deepEqual([bare.search.value, bare.category.selected, bare.rows.length], ['', 'all', 56]);
});

// The placeholder fits the field at 320px (199px of room beside the clear
// button's kept place, measured in Chromium and WebKit), and promises no
// room: the search reads a name or an entity id.
test('the search promises only what it reads: a name or an entity id', () => {
  const {search} = page(fixture('full')).sensors;
  assert.equal(search.placeholder, 'Search sensors');
  assert.ok(search.placeholder.length <= 20, 'short enough for a 320px phone');
  const found = query => page(fixture('full'), {sensors: {query}}).sensors.rows.map(r => r.link.intent.entity);
  assert.deepEqual(found('Front door'), ['binary_sensor.front_door'], 'by name');
  assert.deepEqual(found('binary_sensor.front'), ['binary_sensor.front_door'], 'by entity id');
});

// Every device class Home Assistant gives a sensor or a binary sensor, and
// none, and a unit with no class: the readings data.js files under every
// category it knows.
const SENSOR_CLASSES = ['absolute_humidity', 'apparent_power', 'aqi', 'area', 'atmospheric_pressure', 'battery', 'blood_glucose_concentration', 'carbon_dioxide',
  'carbon_monoxide', 'conductivity', 'current', 'data_rate', 'data_size', 'date', 'distance', 'duration', 'energy', 'energy_distance', 'energy_storage', 'enum',
  'frequency', 'gas', 'humidity', 'illuminance', 'irradiance', 'moisture', 'monetary', 'nitrogen_dioxide', 'nitrogen_monoxide', 'nitrous_oxide', 'ozone', 'ph',
  'pm1', 'pm10', 'pm25', 'pm4', 'power', 'power_factor', 'precipitation', 'precipitation_intensity', 'pressure', 'reactive_energy', 'reactive_power',
  'signal_strength', 'sound_pressure', 'speed', 'sulphur_dioxide', 'temperature', 'timestamp', 'volatile_organic_compounds', 'volatile_organic_compounds_parts',
  'voltage', 'volume', 'volume_flow_rate', 'volume_storage', 'water', 'weight', 'wind_direction', 'wind_speed', ''];
const BINARY_CLASSES = ['battery', 'battery_charging', 'carbon_monoxide', 'cold', 'connectivity', 'door', 'garage_door', 'gas', 'heat', 'light', 'lock', 'moisture',
  'motion', 'moving', 'occupancy', 'opening', 'plug', 'power', 'presence', 'problem', 'running', 'safety', 'smoke', 'sound', 'tamper', 'update', 'vibration', 'window', ''];
const EVERY_CLASS = Object.fromEntries([
  ...SENSOR_CLASSES.map(c => [`sensor.class_${c || 'none'}`, {state: '1', attributes: c ? {device_class: c} : {}}]),
  ...BINARY_CLASSES.map(c => [`binary_sensor.class_${c || 'none'}`, {state: 'off', attributes: c ? {device_class: c} : {}}]),
  ['sensor.unit_celsius', {state: '20', attributes: {unit_of_measurement: '°C'}}], ['sensor.unit_rh', {state: '50', attributes: {unit_of_measurement: '%RH'}}],
].map(([entity_id, s]) => [entity_id, {entity_id, ...s}]));

test('the category select offers every category data.js files a reading under, each one filters, and none is empty', () => {
  const options = page({states: EVERY_CLASS}).sensors.category.options.map(o => o.id);
  assert.equal(options[0], 'all');
  const filed = new Set(allReadings({states: EVERY_CLASS}).map(r => r.category));
  for (const category of filed) assert.ok(options.includes(category), `${category} can be chosen`);
  assert.deepEqual(options.slice(1).filter(id => !filed.has(id)), [], 'every option matches some reading');
  // Each reading is under exactly one option, so the options partition the list.
  const total = allReadings({states: EVERY_CLASS}).length;
  const counts = options.slice(1).map(id => page({states: EVERY_CLASS}, {sensors: {category: id}}).sensors.summary.match(/^[\d,]+/)[0].replaceAll(',', ''));
  assert.equal(counts.reduce((sum, n) => sum + Number(n), 0), total);
  // Every gas and particulate Home Assistant measures files under Air quality.
  const air = page({states: EVERY_CLASS}, {sensors: {category: 'air-quality', limit: 200}}).sensors.rows.map(r => r.link.intent.entity.replace(/^\w+\.class_/, '')).sort();
  assert.deepEqual(air, ['aqi', 'carbon_dioxide', 'carbon_monoxide', 'carbon_monoxide', 'nitrogen_dioxide', 'nitrogen_monoxide', 'nitrous_oxide', 'ozone',
    'pm1', 'pm10', 'pm25', 'pm4', 'sulphur_dioxide', 'volatile_organic_compounds', 'volatile_organic_compounds_parts']);
  // A binary sensor no class claims files under Other, as in the full house.
  const other = page(fixture('full'), {sensors: {category: 'other'}}).sensors.rows.map(r => r.link.intent.entity);
  assert.ok(other.includes('binary_sensor.electricity_off_peak_now') && other.includes('sensor.odd_name'), other.join(', '));
  assert.ok(page({states: EVERY_CLASS}, {sensors: {category: 'other'}}).sensors.rows.some(r => r.link.intent.entity === 'binary_sensor.class_none'));
  // Each option's icon is one Maison draws; moisture is a droplet.
  for (const id of options) assert.ok(iconNames.includes(categoryIcon(id)), `${id}: ${categoryIcon(id)}`);
  assert.deepEqual(['moisture', 'pressure', 'safety', 'signal-strength'].map(categoryIcon), ['droplet', 'climate', 'alert', 'signal']);
});

test('a reading reads as what it means: never 0 for a missing one, a zero is still a reading, a time is a time', () => {
  const read = id => sensors(fixture('full')).rows.find(r => r.link.intent.entity === id);
  const shown = id => {const r = read(id); return [r.icon, r.value, r.unavailable];};
  assert.deepEqual(shown('sensor.cellar_temperature'), ['climate', 'Unavailable', true]);
  // v35 (#29): a number and its unit are joined by a no-break space, so they never part.
  assert.deepEqual(shown('sensor.garage_socket_power'), ['energy', '0 W', false], 'a real zero');
  assert.deepEqual(shown('sensor.garden_illuminance'), ['sun', '12,500 lx', false], 'grouped in British English');
  assert.deepEqual(shown('binary_sensor.hallway_motion'), ['motion', 'Motion detected', false]);
  assert.deepEqual(shown('binary_sensor.front_door'), ['lock', 'Closed', false]);
  assert.deepEqual(shown('binary_sensor.boiler_problem'), ['alert', 'Off', false]);
  assert.deepEqual(shown('sensor.odd_name'), ['info', '3', false], 'no unit, no trailing space');
  assert.equal(readingValue({available: true, domain: 'binary_sensor', category: 'presence', state: 'off'}), 'No motion detected');
  assert.equal(readingValue({available: true, domain: 'binary_sensor', category: 'opening', state: 'on'}), 'Open');
  assert.equal(readingValue({available: true, domain: 'sensor', category: 'other', state: 'heating_up', unit: ''}), 'Heating up');
  assert.equal(readingValue({available: false, domain: 'sensor', state: '0', unit: 'W'}), 'Unavailable');
  // v35 (#29): a timestamp reads as a reading's detail says a time, in Home Assistant's time zone.
  const time = (state, deviceClass, tz) => readingValue({available: true, domain: 'sensor', deviceClass, state, unit: ''}, tz);
  assert.equal(time('2026-09-30T01:00:00+00:00', 'timestamp', 'Europe/Brussels'), '30 Sept, 03:00');
  assert.equal(time('2026-09-30T01:00:00Z', '', 'UTC'), '30 Sept, 01:00', 'an ISO time with no class');
  assert.equal(time('soon', 'timestamp'), 'Soon', 'not a time: as it is');
  const backup = 'sensor.last_backup', withBackup = patched('full', {[backup]: {state: '2026-09-26T23:15:00+00:00',
    attributes: {friendly_name: 'Last backup', device_class: 'timestamp'}, last_reported: new Date(HOME_NOW).toISOString()}});
  assert.equal(page(withBackup, {sensors: {query: 'backup'}}).sensors.rows[0].value, '27 Sept, 01:15', 'on the page, in Brussels');
  assert.equal(page(withBackup, {tz: 'UTC', sensors: {query: 'backup'}}).sensors.rows[0].value, '26 Sept, 23:15');
  assert.deepEqual(['signal-strength', 'pressure', 'moisture', 'safety', 'air-quality', 'nothing'].map(categoryIcon), ['signal', 'climate', 'droplet', 'alert', 'leaf', 'info']);
});

test('names are raw text: a sensor named like markup shows exactly as named, and React escapes it', () => {
  const value = page(fixture('full'));
  assert.ok(words(value).includes('<script>alert(1)</script> sensor'));
  assert.doesNotMatch(everything(value), /&lt;|&gt;|&amp;/);
});

test('each reading says when it last reported, from the snapshot’s time, in Home Assistant’s time zone', () => {
  const detail = (id, extra) => sensors(fixture('full'), {}, extra).rows.find(r => r.link.intent.entity === id).detail;
  assert.equal(detail('sensor.cellar_temperature'), 'Updated 25 Sept, 12:30', 'two days old: the date and time in Brussels');
  assert.equal(detail('sensor.cellar_temperature', {tz: 'UTC'}), 'Updated 25 Sept, 10:30');
  assert.equal(detail('sensor.odd_name'), 'Update time unavailable');
  assert.equal(detail('binary_sensor.hallway_motion'), 'Updated just now');
  assert.equal(detail('sensor.living_room_temperature'), 'Updated 3 min ago');
  assert.equal(detail('sensor.living_room_humidity'), 'Updated 3 h ago');
  assert.equal(detail('binary_sensor.boiler_problem'), 'Updated yesterday');
  // The snapshot's time, not the wall clock: an hour on, the reading is an hour older.
  assert.equal(detail('sensor.living_room_temperature', {now: HOME_NOW + 60 * MINUTE}), 'Updated 1 h ago');
  assert.equal(detail('sensor.living_room_temperature', {now: HOME_NOW + 3 * DAY}), 'Updated 27 Sept, 12:27');
});

// ---- Links -------------------------------------------------------------------------------
test('Home status only opens and filters: every control is a link, the same online or offline', () => {
  for (const f of HOME_FIXTURES) for (const limit of [60, 5]) {
    const online = controls(page(f, {sensors: {limit}})), offline = controls(page(f, {online: false, sensors: {limit}}));
    const commands = new Set(online.map(c => c.command));
    for (const command of commands) assert.ok(['more', 'sensor-search', 'sensor-category', 'sensor-more', 'ha-settings'].includes(command), `${f.id}: ${command}`);
    assert.deepEqual(offline, online, `${f.id}: offline changes nothing`);
  }
});

test('every link in the checks is a more or Home Assistant’s settings, and offline, busy or another page of sensors changes nothing', () => {
  for (const f of HOME_FIXTURES) {
    const value = page(f), shown = controls(checks(value));
    assert.ok(shown.every(c => ['more', 'ha-settings'].includes(c.command)), `${f.id}: ${shown.map(c => c.command).join(', ')}`);
    assert.deepEqual(shown.filter(c => c.command === 'ha-settings').map(c => c.enabled), [true], `${f.id}: Settings once, always open`);
    const opened = shown.filter(c => c.command === 'more').map(c => c.entity);
    assert.deepEqual(opened, [...value.needs.rows, ...value.devices.rows].filter(r => r.link).map(r => r.link.intent.entity).concat(MAINTENANCE.map(([, id]) => id), CORE_UPDATE), f.id);
    // A more opens only what Home Assistant has.
    for (const c of shown.filter(c => c.command === 'more')) assert.equal(c.enabled, Boolean(f.states[c.entity]), `${f.id}: ${c.entity}`);
    // The sensors only open their readings and filter.
    assert.ok(controls(value.sensors).every(c => ['more', 'sensor-search', 'sensor-category', 'sensor-more'].includes(c.command)), f.id);
    for (const extra of [{online: false}, {busy: new Set(['more', 'ha-settings'])}, {sensors: {limit: 5, query: 'a', category: 'battery'}}])
      assert.deepEqual(checks(page(f, extra)), checks(value), `${f.id}: ${Object.keys(extra)[0]} changes nothing`);
    assert.deepEqual(page(f, {online: false}), value, `${f.id}: offline, the whole page is the same`);
  }
});

// ---- — is never 0 ------------------------------------------------------------------------
test('— is never 0: a missing reading is —, No current reading or Unavailable, in the checks and in every sensor row', () => {
  const empty = {id: 'nothing', states: {}};
  for (const f of [...HOME_FIXTURES, empty]) {
    const value = page(f);
    assert.doesNotMatch(everything(checks(value)), ZERO, f.id);
    for (const r of [...value.vacuum.rows, ...value.homeAssistant.rows]) assert.ok(r.value === null || !/^0(?![\d.,])/.test(r.value), `${f.id}: ${r.title} reads ${r.value}`);
  }
  // With nothing to read, the whole page says — and never 0.
  for (const value of [page(fixture('missing')), page(empty)]) {
    assert.doesNotMatch(everything(value), ZERO);
    assert.ok(words(value).includes('—'));
  }
  // Every sensor of the full house without a reading: each row says so, and no row reads 0.
  const gone = patched('full', Object.fromEntries(Object.keys(fixture('full').states).filter(id => /^(?:binary_)?sensor\./.test(id)).map((id, i) => [id, {state: i % 2 ? 'unknown' : 'unavailable'}])));
  const {sensors: catalogue} = page(gone);
  assert.ok(catalogue.rows.length > 40);
  for (const r of catalogue.rows) assert.deepEqual([r.value, r.unavailable], ['Unavailable', true], r.title);
  assert.doesNotMatch(everything(page(gone)), ZERO);
});

// ---- Words -------------------------------------------------------------------------------
// What Home status draws from the checks and from All sensors.
const checkWords = ({needs, devices, vacuum, homeAssistant}) => [needs.title, ...needs.rows.flatMap(r => [r.title, r.detail]), needs.empty,
  devices.title, ...devices.rows.flatMap(r => [r.title, r.detail]), devices.line, devices.note,
  vacuum.title, ...vacuum.rows.flatMap(r => [r.title, r.value]), homeAssistant.title, ...homeAssistant.rows.flatMap(r => [r.title, r.value])];
const sensorWords = s => [s.title, s.count, s.search.placeholder, s.search.value, ...s.category.options.map(o => o.label), s.summary,
  ...s.rows.flatMap(r => [r.title, r.detail, r.value]), s.empty, s.more?.label, s.note];
// A string under a key words() skips is a token (an id, an icon, a tone), never words.
const TOKEN = /^[a-z][a-z0-9_.-]*$/;
function structural(value, found = []) {
  const skipped = new Set(['id', 'kind', 'key', 'icon', 'tone', 'width', 'min', 'max', 'plot', 'model', 'config', 'size']);
  const leaves = node => typeof node === 'string' ? [node] : node && typeof node === 'object' ? Object.values(node).flatMap(leaves) : [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) if (skipped.has(key)) found.push(...leaves(child).map(text => [key, text])); else walk(child);
  };
  walk(value);
  return found;
}

test('every word Home status draws is one words() reads, and nothing drawn sits under a key it skips', () => {
  for (const f of HOME_FIXTURES) for (const filters of [{}, {limit: 5, query: 'e'}]) {
    const value = page(f, {sensors: filters}), shown = checks(value), said = words(shown);
    for (const text of checkWords(shown).filter(Boolean)) assert.ok(said.includes(text), `${f.id}: ${text}`);
    // A control's own text is the control's to draw, as words() reads only a link's label: the
    // field's placeholder and query, and the select's option labels.
    const {search, category} = value.sensors, inSensors = [...words(value.sensors), search.placeholder, search.value, ...category.options.map(o => o.label)];
    for (const text of sensorWords(value.sensors).filter(Boolean)) assert.ok(inSensors.includes(text), `${f.id}, sensors: ${text}`);
    for (const [key, text] of structural([shown, value.sensors])) assert.match(text, TOKEN, `${f.id}: ${key} holds “${text}”`);
    for (const r of [...shown.needs.rows, ...shown.devices.rows, ...shown.vacuum.rows, ...shown.homeAssistant.rows, ...value.sensors.rows])
      assert.ok(iconNames.includes(r.icon), `${f.id}: ${r.icon}`);
    for (const r of [...shown.needs.rows, ...shown.devices.rows, ...shown.vacuum.rows]) assert.ok([null, 'amber', 'orange'].includes(r.tone), `${f.id}: ${r.tone}`);
    // No icon or tone leaks as words: 'vacuum', 'orange', 'plug'…
    assert.deepEqual(said.filter(text => TOKEN.test(text)), [], `${f.id}: no bare token is drawn`);
  }
});
