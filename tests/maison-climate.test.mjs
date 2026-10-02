// Climate's values (#21–#27, #29): the status and request rules the guard
// shares, and what the page and its sheets show, as screen() works them out
// from one snapshot: each zone's and the house's reading against its target,
// the House card's note, Details and one action, the rails' one-line rows,
// the sheets' sections, headings and controls, the scale legend, the widget
// slots and the charts' names. Every test reads the value, never HTML: its
// words, its accessible names and its links. Whether pressing a control does
// what it shows is in maison-agreement.test.mjs, and the scripts' limits in
// maison-climate-constants.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {E, HOUSE, ZONES, TOWEL_RAILS, ROOM_DETAIL, CLIMATE_CONTRACT} from '../config/www/maison/model.js';
import {
  AT_TARGET_MARGIN, FROST_MAX, CLIMATE_DETAILS, CLIMATE_SCRIPTS, STEPPABLE_HELPERS, THERMOSTAT_CONFIRM_MS, houseStatus, zoneStatus, zoneTargetStep, railStatus,
  climateHistory, humidityFlag, houseEnds, houseEnd, houseDraftStep, houseDraftTemperature, houseProblem, climateRequest,
  houseOverrideRequest, houseAwayRequest, houseWarmRequest, zoneOverrideRequest, dryingRequest, warmOffer, confirms, zonedTime, isoIn, localInput,
  climateSchedules, todaysPeriods, periodsLine, houseNotCalling, climateTarget, zoneOverrideReady, dryingReady, helperSteppable,
} from '../config/www/maison/climate.js';
import {prepareHistoryChart} from '../config/www/maison/history.js';
import {iconNames} from '../config/www/maison/icons.js';
import {climateIds, toggleIds} from '../config/www/maison/guard.js';
import {screen, controls, words} from '../config/www/maison/screen.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {CLIMATE_FIXTURES, CLIMATE_NOW, CLIMATE_SCHEDULES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
const registered = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {get: key => registered.get(key), define: (key, value) => registered.set(key, value)};
globalThis.window = {customCards: []};
await import('../config/www/maison/maison-dashboard.js');
const Maison = registered.get('maison-dashboard');
const tz = 'Europe/Brussels', o = {now: CLIMATE_NOW, tz};
const S = CLIMATE_CONTRACT.scripts, HOUSE_KEY = CLIMATE_CONTRACT.houseHeating;
const fixture = id => structuredClone(CLIMATE_FIXTURES.find(f => f.id === id).states);
function harness(states, connected = true) {
  const card = Object.create(Maison.prototype), calls = [], messages = [];
  card._hass = {states, connected, config: {time_zone: tz}, callService: async (...args) => calls.push(args)};
  card._busy = new Set(); card.render = () => {}; card.toast = m => messages.push(m);
  return {card, calls, messages};
}
// A press reaches the element as an intent (#27).
const press = (card, command, entity = '', extras = {}) => card.command({command, entity, ...extras});
// What the Climate page and a drawer show, as screen() works it out from a
// snapshot (#27): read through its values, controls() and words(), never HTML.
// `extra` is merged into the snapshot: online, busy, feedback, draft, now.
const snapshot = (states, {detail = null, ...extra} = {}) => fixtureSnapshot({...extra, states, route: {page: 'climate', detail}});
const page = (states, extra) => screen(snapshot(states, extra)).page;
const detail = (states, id, extra = {}) => screen(snapshot(states, {...extra, detail: id})).drawer;
// The controls and links of a value with this command (and entity).
const find = (value, command, entity) => controls(value).filter(c => c.command === command && (entity === undefined || c.entity === entity));
// A value's words and its controls' names: everything a reader or a screen reader meets.
const everything = value => [...words(value), ...controls(value).map(c => c.label ?? '')].join('\n');
const zone = (states, id) => zoneStatus(id, states, o);
// A zone's definition, by id.
const zoneOf = id => ZONES.find(z => z.id === id);
// A link's or control's [command, entity].
const intentOf = link => [link.intent.command, link.intent.entity];
// A reading in one line: the figure, the flag, the line, and what the bar plots.
const said = r => `${r.reading}${r.flag ? ` [${r.flag}]` : ''} ${r.line} (${r.bar.plot.reading ?? '—'} → ${r.bar.plot.target ?? 'no target'})`;
const readings = value => ({house: said(value.house.reading), ...Object.fromEntries(value.zones.map(z => [z.id, said(z.reading)]))});
// A 0 where a reading should be: never, since a missing reading is a dash.
const ZERO = /(?<![\d.,])0(?:[.,]0+)?\s?(?:°|%)(?!\w)/;
// The element reads the clock when a control is pressed; pin it to the
// fixtures' morning.
function atFixtureTime(t) {t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: CLIMATE_NOW});}
const script = (id, variables) => ['script', 'turn_on', {variables, entity_id: id}];

test('every fixture reads in household language', () => {
  const expected = {
    house_running: {house: ['20° until 22:00, then 18°', 'Warming'], attic: ['21° until 18:00, then 16°', 'Warming'], sam: ['20° until 18:00, then 18°', 'Warming'],
      noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    house_override: {house: ['21.5° until 12:30 (override)', 'Warming'], attic: ['21° until 18:00, then 16°', 'Warming'], sam: ['20° until 18:00, then 18°', 'Warming'],
      noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Drying until 10:15', 'Off (frost)']},
    house_manual: {house: ['Holds 20° (thermostat schedule off)', 'Warming'], attic: ['21° until 18:00, then 16°', 'Warming'], sam: ['20° until 18:00, then 18°', 'Warming'],
      noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    house_off: {house: ['Heating switched off on the thermostat', 'Not heating'], attic: ['21° until 18:00, then 16°', 'Below target · house heating off'],
      sam: ['20° until 18:00, then 18°', 'Below target · house heating off'], noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    house_away: {house: ['Away until Sun 17:00', 'Holding 10°'], attic: ['21° until 18:00, then 16°', 'Below target · house heating off'],
      sam: ['20° until 18:00, then 18°', 'Below target · house heating off'], noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    house_unknown: {house: ['Thermostat state unknown', 'Warming'], attic: ['21° until 18:00, then 16°', 'Warming'], sam: ['20° until 18:00, then 18°', 'Warming'],
      noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    zone_override: {house: ['20° until 22:00, then 18°', 'At target'], attic: ['22° until 18:00 (override), then 16°', 'Below target · house heating off'],
      sam: ['20° until 18:00, then 18°', 'Below target · house heating off'], noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    airco_heating: {house: ['20° until 22:00, then 18°', 'At target'], attic: ['21° until 18:00, then 16°', 'Warming'], sam: ['20° until 18:00, then 18°', 'Below target · house heating off'],
      noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    dry_humid: {house: ['20° until 22:00, then 18°', 'Warming'], attic: ['21° until 18:00, then 16°', 'Warming'], sam: ['20° until 18:00, then 18°', 'Warming'],
      noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
    sensors_unavailable: {house: ['Thermostat state unknown', 'No reading'], attic: ['Target unknown', 'No reading'], sam: ['Target unknown', 'No reading'],
      noah: ['Target unknown', 'No reading'], 'bedroom-suite': ['Target unknown', 'No reading'], rails: ['Unavailable', 'Unavailable']},
    contract_missing: {house: ['Target unknown', 'Warming'], attic: ['21° until 18:00, then 16°', 'Warming'], sam: ['Schedule not set up yet', 'Warming'],
      noah: ['Always 20°', 'At target'], 'bedroom-suite': ['Always 17°', 'At target'], rails: ['Off (frost)', 'Off (frost)']},
  };
  assert.deepEqual(CLIMATE_FIXTURES.map(f => f.id).sort(), Object.keys(expected).sort(), 'one expectation per fixture');
  for (const f of CLIMATE_FIXTURES) {
    const want = expected[f.id], house = houseStatus(f.states, o);
    assert.deepEqual([house.targetLine, house.status.label], want.house, `${f.id} house`);
    for (const z of ZONES) {
      const s = zone(f.states, z.id);
      assert.deepEqual([s.targetLine, s.status.label], want[z.id], `${f.id} ${z.id}`);
    }
    assert.deepEqual(TOWEL_RAILS.map(r => railStatus(r, f.states, o).status.label), want.rails, `${f.id} rails`);
  }
});

test('the page shows House heating, the zones by floor, then the Towel rails, and no Hallway', () => {
  const value = page(fixture('house_running'));
  // What opens each sheet, in page order: the House card's and the rails'
  // Details, and each zone's row.
  const opens = [value.house.details, ...value.zones.map(z => z.link), value.rails.details];
  assert.deepEqual(opens.map(intentOf), ['house', 'attic', 'sam', 'noah', 'bedroom-suite', 'towel-rails'].map(id => ['detail', id]));
  assert.deepEqual([value.house.title, ...value.zones.map(z => z.opener.name), value.railsTitle],
    ['House heating', 'Attic', 'Sam’s office', 'Noah’s room', 'Bedroom suite', 'Towel rails']);
  assert.doesNotMatch(JSON.stringify(value), /Hallway|hallway/);
  assert.deepEqual(CLIMATE_DETAILS.map(d => d.id), ['house', 'attic', 'sam', 'noah', 'bedroom-suite', 'towel-rails']);
});

test('House heating is measured in the living room; the thermostat reading is only in the why line', () => {
  const states = fixture('house_running'), {house} = page(states), sheet = detail(states, 'house').body;
  assert.match(house.note, /^Measured in the living room/);
  assert.deepEqual([house.reading.reading, sheet.reading.reading], ['19.6°', '19.6°']);
  assert.doesNotMatch(JSON.stringify([house, sheet.reading, sheet.facts, sheet.control]), /19\.4/);
  const why = sheet.why.join('\n');
  assert.match(why, /corrected reading: 19\.4°/);
  assert.match(why, /Its target is 20°, and it is calling for heat\./, 'the why line says reading, target and calling');
  assert.match(house.note, /Outside 6\.5°\.$/, 'the boiler’s outdoor sensor');
  assert.equal(houseStatus(fixture('house_running'), o).outdoor, 6.5);
  assert.match(houseStatus(fixture('zone_override'), o).why[1], /Its target is 20°, and it isn’t calling for heat\./);
  assert.match(houseStatus(fixture('house_off'), o).why[1], /switched off on it, so it isn’t calling/);
});

test('a missing reading is never shown as 0', () => {
  const states = fixture('sensors_unavailable');
  for (const [id, s] of Object.entries(states)) if (s.state === 'unavailable' && !id.startsWith('climate.')) states[id] = {...s, state: 'unavailable', attributes: {...s.attributes, temperature: 0}};
  const values = [page(states), ...CLIMATE_DETAILS.map(d => detail(states, d.id))];
  assert.doesNotMatch(everything(values), /(?<![\d.])0(?:\.0)?(?:°|%)/);
  assert.ok(words(values).includes('—'), 'a missing reading reads —');
  const s = zone(states, 'noah');
  assert.equal(s.reading, null); assert.equal(s.target, null); assert.equal(s.humidity, null);
  assert.equal(houseStatus(states, o).outdoor, null);
  assert.equal(railStatus(TOWEL_RAILS[0], states, o).probe, null);
});

test('before the heating packages exist, every control reads "Not set up yet"', () => {
  const states = fixture('contract_missing');
  for (const id of [HOUSE_KEY, CLIMATE_CONTRACT.samTarget, CLIMATE_CONTRACT.samSchedule, CLIMATE_CONTRACT.ensuiteDrying, CLIMATE_CONTRACT.aircoCooling, ...CLIMATE_SCRIPTS]) assert.equal(states[id], undefined, id);
  const house = houseStatus(states, o);
  assert.equal(house.mode, null); assert.equal(house.target, null); assert.equal(house.targetLine, 'Target unknown');
  assert.match(house.why[0], /isn’t available here yet/);
  assert.equal(houseProblem(states), 'missing');
  assert.doesNotThrow(() => CLIMATE_DETAILS.map(d => detail(states, d.id)));
  const value = page(states), notSetUp = title => ({kind: 'missing', step: {title, detail: 'Not set up yet', stepper: null}});
  assert.deepEqual(detail(states, 'house').body.control, notSetUp('Override and Away'));
  // The Target row (title, line) says the same.
  assert.deepEqual(detail(states, 'attic').body.control, {...notSetUp('Override'), title: 'Override', line: 'Not set up yet'}, 'the Attic has no override without #24');
  assert.ok(value.rails.rows.every(r => r.line === 'Off · drying not set up yet' && r.action === null));
  const written = controls(value).filter(c => c.command !== 'detail');
  assert.deepEqual(written, [], 'no broken buttons');
  const sam = detail(states, 'sam');
  assert.ok(words(sam).includes('This zone’s schedule isn’t set up in Home Assistant yet.'));
  assert.deepEqual(find(sam, 'step'), [], 'Sam’s comfort and setback wait for their helpers');
  assert.deepEqual(detail(states, 'attic').body.airco.cooling, notSetUp('Airco cooling'));
  assert.match(detail(states, 'house').body.week.text, /weekly schedule isn’t readable here yet/);
  assert.ok(Object.isFrozen(CLIMATE_CONTRACT) && Object.isFrozen(CLIMATE_CONTRACT.scripts));
  assert.equal(ZONES.find(z => z.id === 'sam').target, CLIMATE_CONTRACT.samTarget);
});

test('"Not set up yet" follows the readiness predicates the guard shares', () => {
  const edit = (id, fn) => {const s = fixture(id); fn(s); return s;};
  const [attic, sam] = ZONES, [ensuite] = TOWEL_RAILS;
  // A zone override needs its target sensor and the zone override script.
  for (const [states, ready] of [[fixture('house_running'), true], [edit('house_running', x => {delete x[S.zoneOverride];}), false],
    [edit('house_running', x => {delete x[attic.target];}), false]]) {
    assert.equal(zoneOverrideReady(states, attic), ready);
    assert.equal(detail(states, 'attic').body.control.kind, ready ? 'override' : 'missing');
  }
  assert.equal(zoneOverrideReady(fixture('contract_missing'), sam), false);
  // Drying needs the rail's Drying sensor and both Drying scripts.
  for (const [states, ready] of [[fixture('house_running'), true], [edit('house_running', x => {delete x[S.dryingStop];}), false],
    [edit('house_running', x => {delete x[ensuite.drying];}), false]]) {
    assert.equal(dryingReady(states, ensuite), ready);
    assert.equal(page(states).rails.rows[0].action === null, !ready);
  }
  assert.equal(dryingReady(fixture('house_running'), undefined), false);
  // A helper: allowlisted, available, a reading and readable limits.
  const comfort = attic.comfort, steps = states => find(detail(states, 'attic'), 'step', comfort).length;
  assert.equal(helperSteppable(fixture('house_running'), comfort), true); assert.equal(steps(fixture('house_running')), 2);
  for (const broken of [x => {x[comfort].state = 'unavailable';}, x => {x[comfort].state = 'warm';}, x => {x[comfort].attributes.step = 0;},
    x => {x[comfort].attributes.max = 10;}, x => {delete x[comfort].attributes.min;}]) {
    const states = edit('house_running', broken);
    assert.equal(helperSteppable(states, comfort), false); assert.equal(steps(states), 0);
  }
  assert.equal(helperSteppable(fixture('house_running'), attic.override), false, 'only the comfort and setback helpers');
});

test('status lines: Warming needs the house heating running, or the Airco heating', () => {
  const states = fixture('house_off'), attic = zone(states, 'attic');
  assert.ok(attic.valves.every(v => v.heating), 'the valves still ask for heat');
  assert.equal(attic.status.label, 'Below target · house heating off');
  assert.equal(attic.warnHouseOff, true);
  assert.ok(words(detail(states, 'attic')).includes('Heating is switched off on the thermostat, so radiators won’t warm the Attic.'));
  // The thermostat calling while the pump heats hot water: still Warming.
  const hotWater = fixture('house_running'); hotWater[HOUSE.pump].state = 'hwc';
  assert.equal(zone(hotWater, 'attic').status.label, 'Warming');
  assert.equal(houseStatus(hotWater, o).running, true);
  // With the valves idle it is plain Below target: "house heating off" is the
  // thermostat's word, never the pump's (Q25).
  for (const v of ZONES[0].valves) hotWater[v.id].attributes.hvac_action = 'idle';
  assert.equal(zone(hotWater, 'attic').status.label, 'Below target');
  hotWater[HOUSE.pump].state = 'overrun';
  assert.equal(zone(hotWater, 'attic').status.label, 'Below target', 'the overrun while it calls');
  hotWater[HOUSE_KEY].attributes.calling = false;
  assert.equal(zone(hotWater, 'attic').status.label, 'Below target · house heating off', 'the thermostat not calling');
  assert.equal(houseStatus(hotWater, o).running, false);
  // The pump running on with the thermostat satisfied: the valves still warm.
  const overrun = fixture('zone_override'); overrun[HOUSE.pump].state = 'on';
  assert.equal(zone(overrun, 'attic').status.label, 'Warming');
  // A pump off while the thermostat calls is not "house heating off".
  const starting = fixture('house_running'); starting[HOUSE.pump].state = 'off';
  for (const v of ZONES[0].valves) starting[v.id].attributes.hvac_action = 'idle';
  assert.equal(zone(starting, 'attic').status.label, 'Below target');
  // Away counts as not calling.
  assert.equal(zone(fixture('house_away'), 'sam').status.label, 'Below target · house heating off');
  // Without the thermostat the page does not claim the house heating is off.
  const unknown = fixture('contract_missing'); unknown[HOUSE.pump].state = 'off';
  assert.equal(zone(unknown, 'attic').status.label, 'Below target');
  assert.doesNotMatch(words(detail(unknown, 'attic')).join('\n'), /Radiators only give heat/, 'no warning without the thermostat');
  const odd = fixture('zone_override'); odd[HOUSE_KEY].state = 'unknown';
  assert.equal(zone(odd, 'sam').status.label, 'Below target', 'an unknown thermostat is not "not calling"');
  const airco = zone(fixture('airco_heating'), 'attic');
  assert.deepEqual([airco.status.label, airco.source, airco.airco.sourceLabel, airco.warnHouseOff], ['Warming', 'airco', 'Airco, cheaper now', false]);
  // Within the margin is at target; beyond it above.
  const near = fixture('house_running'); near[ZONES[0].temperature].state = String(21 + AT_TARGET_MARGIN); near[HOUSE.pump].state = 'off'; near[HOUSE_KEY].attributes.calling = false;
  assert.equal(zone(near, 'attic').status.label, 'At target');
  near[ZONES[0].temperature].state = String(21 + AT_TARGET_MARGIN + 0.1);
  assert.equal(zone(near, 'attic').status.label, 'Above target');
  const cooling = fixture('house_running'); cooling[E.airco].state = 'cool';
  assert.equal(zone(cooling, 'attic').status.label, 'Cooling');
});

test('the Attic’s sheet says what is heating it', () => {
  const source = states => detail(states, 'attic').body.airco.source[0].strong;
  assert.equal(source(fixture('house_running')), 'Radiators');
  assert.equal(source(fixture('airco_heating')), 'Airco, cheaper now');
  const manual = fixture('airco_heating'); manual[E.heatingSource].state = 'gas';
  assert.equal(source(manual), 'Airco');
});

test('humidity is flagged outside 40–60 %', () => {
  assert.deepEqual([39.9, 40, 60, 60.1, null].map(humidityFlag), ['Dry air', null, null, 'Humid', null]);
  const states = fixture('dry_humid');
  assert.equal(zone(states, 'attic').flag, 'Dry air');
  assert.equal(zone(states, 'bedroom-suite').flag, 'Humid');
  assert.equal(houseStatus(states, o).flag, null);
  // The flag follows the reading on the page, and the humidity in the sheet.
  assert.deepEqual(page(states).zones.map(z => z.reading.flag), ['Dry air', null, null, 'Humid']);
  assert.deepEqual(detail(states, 'bedroom-suite').body.facts[0], {icon: 'droplet', text: '66%', flag: 'Humid', ariaLabel: '66% humidity'});
});

test('fixed zones read "Always", scheduled zones name the next change and what follows', () => {
  const states = fixture('house_running'), attic = ZONES[0];
  assert.equal(zone(states, 'bedroom-suite').targetLine, 'Always 17°');
  states[attic.schedule] = {...states[attic.schedule], state: 'off', attributes: {next_event: '2026-10-15T08:00:00+02:00'}};
  states[attic.target] = {...states[attic.target], state: '16', attributes: {mode: 'setback', next_change: '2026-10-15T08:00:00+02:00', next_target: 21}};
  assert.equal(zone(states, 'attic').targetLine, '16° until Thu 08:00, then 21°');
  delete states[attic.target].attributes.next_target;
  assert.equal(zone(states, 'attic').targetLine, '16° until Thu 08:00, then 21°', 'without next_target, the other helper');
  states[attic.target].attributes = {mode: 'setback'}; delete states[attic.schedule].attributes.next_event;
  assert.equal(zone(states, 'attic').targetLine, '16° now');
  const override = fixture('house_running');
  override[CLIMATE_CONTRACT.samTarget].attributes = {mode: 'override', override_until: '2026-10-14T18:00:00+02:00'};
  override[CLIMATE_CONTRACT.samTarget].state = '22';
  assert.equal(zone(override, 'sam').targetLine, '22° until 18:00 (override), then 18°');
  delete override[CLIMATE_CONTRACT.samTarget].attributes.override_until;
  assert.equal(zone(override, 'sam').targetLine, '22° (override)');
});

test('the house line follows the thermostat’s state and week', () => {
  const states = fixture('house_running');
  // The next change is 22:00 on the thermostat's clock, 16 s slow.
  assert.equal(houseStatus(states, o).then, 18);
  states[HOUSE_KEY].attributes.week = null;
  assert.equal(houseStatus(states, o).targetLine, '20° until 22:00', 'without the week, no "then"');
  states[HOUSE_KEY].attributes.next_change = null;
  assert.equal(houseStatus(states, o).targetLine, '20°');
  const away = fixture('house_away'); away[HOUSE_KEY].attributes.away_until = null;
  assert.equal(houseStatus(away, o).targetLine, 'Away');
  const manual = houseStatus(fixture('house_manual'), o);
  assert.deepEqual([manual.mode, manual.nextAt], ['manual', null]);
  const odd = fixture('house_running'); odd[HOUSE_KEY].state = 'holiday';
  assert.equal(houseStatus(odd, o).mode, 'unknown', 'a state outside the contract is unknown');
});

test('the house override: a 0.5° stepper from the current target, within 5–30', () => {
  const states = fixture('house_running');
  assert.equal(houseDraftTemperature(states, {}), 20);
  const up = houseDraftStep(states, {}, 1);
  assert.deepEqual(up, {base: 20, temperature: 20.5});
  assert.deepEqual(houseDraftStep(states, {house: up}, 1), {base: 20, temperature: 21});
  assert.equal(houseDraftStep(states, {}, 2), null);
  // Starts from the running override, then the target, then the day temperature.
  assert.equal(houseDraftTemperature(fixture('house_override'), {}), 21.5);
  assert.equal(houseDraftTemperature(fixture('house_off'), {}), 21, 'off: the week’s day temperature');
  assert.equal(houseDraftTemperature(states, {house: {base: 18, temperature: 25}}), 20, 'a draft from another base is dropped');
  const top = fixture('house_running'); top[HOUSE_KEY].attributes.target = 30;
  assert.equal(houseDraftStep(top, {}, 1), null); assert.deepEqual(houseDraftStep(top, {}, -1), {base: 30, temperature: 29.5});
  const bottom = fixture('house_running'); bottom[HOUSE_KEY].attributes.target = 5;
  assert.equal(houseDraftStep(bottom, {}, -1), null);
});

test('end chips: 1 h, 3 h and "Until <next change>", the default whenever there is one', () => {
  const states = fixture('house_running'), ends = houseEnds(states, o);
  assert.deepEqual(ends.map(e => [e.id, e.label, new Date(e.until).toISOString()]), [
    ['1h', '1 h', '2026-10-14T08:30:00.000Z'], ['3h', '3 h', '2026-10-14T10:30:00.000Z'], ['next', 'Until 22:00', '2026-10-14T20:00:16.000Z'],
  ]);
  assert.equal(houseEnd(states, {}, o).id, 'next');
  assert.equal(houseEnd(states, {houseEnd: '3h'}, o).id, '3h');
  assert.equal(houseEnd(states, {houseEnd: 'forever'}, o).id, 'next');
  // Rounded to the minute from the moment it is read.
  assert.equal(new Date(houseEnds(states, {now: CLIMATE_NOW + 40000, tz})[0].until).toISOString(), '2026-10-14T08:31:00.000Z');
  const manual = fixture('house_manual');
  assert.deepEqual(houseEnds(manual, o).map(e => e.id), ['1h', '3h'], 'no next change without a running schedule');
  assert.equal(houseEnd(manual, {}, o).id, '1h');
  const soon = fixture('house_running'); soon[HOUSE_KEY].attributes.next_change = new Date(CLIMATE_NOW + 4 * 60000).toISOString();
  assert.deepEqual(houseEnds(soon, o).map(e => e.id), ['1h', '3h'], 'a next change under 5 minutes away is no end');
  assert.deepEqual(find(detail(fixture('house_manual'), 'house'), 'house-end').map(c => c.entity), ['1h', '3h']);
  assert.deepEqual(find(detail(states, 'house'), 'house-end').filter(c => c.selected).map(c => [c.entity, c.label]), [['next', 'Until 22:00']]);
});

test('each Climate command sends one allowlisted script with the right data', async t => {
  atFixtureTime(t);
  const run = async (fixtureId, steps) => {
    const {card, calls} = harness(fixture(fixtureId));
    for (const [command, entity = '', extras = {}] of steps) await press(card, command, entity, extras);
    return {card, calls};
  };
  let r = await run('house_running', [['house-step', 'house', {direction: 1}], ['house-override', 'house']]);
  assert.deepEqual(r.calls, [script(S.houseOverrideSet, {temperature: 20.5, until: '2026-10-14T22:00:16+02:00'})]);
  assert.equal(r.card._climate.house, null, 'the draft is spent once sent');
  r = await run('house_running', [['house-end', '1h'], ['house-override', 'house']]);
  assert.deepEqual(r.calls, [script(S.houseOverrideSet, {temperature: 20, until: '2026-10-14T10:30:00+02:00'})]);
  r = await run('house_override', [['house-override-cancel', 'house']]);
  assert.deepEqual(r.calls, [script(S.houseOverrideCancel, {})]);
  r = await run('house_running', [['house-end', 'someday'], ['house-override', 'house']]);
  assert.deepEqual(r.calls, [script(S.houseOverrideSet, {temperature: 20, until: '2026-10-14T22:00:16+02:00'})], 'an unknown chip keeps the default');
  // Away is chosen in the house's time zone, whatever the browser's.
  r = harness(fixture('house_running'));
  await press(r.card, 'away-until', 'house', {value: '2026-10-18T15:00'});
  await press(r.card, 'house-away', 'house');
  assert.deepEqual(r.calls, [script(S.houseAwaySet, {until: '2026-10-18T15:00:00+02:00'})]);
  assert.equal(r.card._climate.awayUntil, '');
  r = await run('house_away', [['house-away-cancel', 'house']]);
  assert.deepEqual(r.calls, [script(S.houseAwayCancel, {})]);
  r = await run('zone_override', [['house-warm', 'attic']]);
  assert.deepEqual(r.calls, [script(S.houseWarmUntil, {until: '2026-10-14T18:00:00+02:00'})]);
  r = await run('house_running', [['zone-override', 'attic', {direction: 1}]]);
  assert.deepEqual(r.calls, [script(S.zoneOverride, {zone: 'attic', temperature: 21.5})]);
  r = await run('house_running', [['zone-override', 'sam', {direction: -1}]]);
  assert.deepEqual(r.calls, [script(S.zoneOverride, {zone: 'sams_office', temperature: 19.5})]);
  r = await run('zone_override', [['zone-override', 'attic', {direction: 1}]]);
  assert.deepEqual(r.calls, [script(S.zoneOverride, {zone: 'attic', temperature: 22.5})], 'from the running override');
  r = await run('zone_override', [['zone-override-cancel', 'attic']]);
  assert.deepEqual(r.calls, [script(S.zoneOverrideCancel, {zone: 'attic'})]);
  r = await run('house_running', [['drying-start', 'bathroom']]);
  assert.deepEqual(r.calls, [script(S.dryingStart, {rail: 'bathroom'})]);
  r = await run('house_override', [['drying-stop', 'ensuite']]);
  assert.deepEqual(r.calls, [script(S.dryingStop, {rail: 'ensuite'})]);
  r = await run('house_running', [['toggle', CLIMATE_CONTRACT.aircoCooling]]);
  assert.deepEqual(r.calls, [['input_boolean', 'turn_off', {entity_id: CLIMATE_CONTRACT.aircoCooling}]]);
  for (const call of [script(S.houseOverrideSet, {}), script(S.zoneOverride, {})]) assert.ok(CLIMATE_SCRIPTS.includes(call[2].entity_id));
});

test('the request rules refuse what the scripts would, and a refused press sends nothing', async t => {
  atFixtureTime(t);
  const refused = async (states, command, entity = 'house', extras = {}, connected = true) => {
    const {card, calls} = harness(states, connected); card._climate = {awayUntil: '2026-10-18T15:00'};
    await press(card, command, entity, extras); return calls.length === 0;
  };
  const edit = (id, fn) => {const s = fixture(id); fn(s); return s;};
  // Offline, unknown, away, a bad clock, missing parts.
  assert.ok(await refused(fixture('house_running'), 'house-override', 'house', {}, false), 'offline');
  assert.ok(await refused(fixture('house_unknown'), 'house-override'));
  assert.ok(await refused(fixture('house_unknown'), 'house-away'));
  assert.ok(await refused(fixture('house_away'), 'house-override'), 'no override while Away');
  assert.ok(await refused(fixture('house_away'), 'house-away'), 'Away is cancelled, not set again');
  assert.ok(await refused(fixture('house_running'), 'house-away-cancel'));
  assert.ok(await refused(fixture('house_running'), 'house-override-cancel'), 'nothing to cancel');
  for (const offset of [null, 600, -600]) {
    const s = edit('house_running', x => {x[HOUSE_KEY].attributes.clock_offset_s = offset;});
    assert.equal(houseProblem(s), 'clock', String(offset));
    assert.ok(await refused(s, 'house-override'), `clock ${offset}`);
    assert.ok(await refused(s, 'house-away'), `clock ${offset}`);
  }
  assert.equal(houseProblem(edit('house_running', x => {x[HOUSE_KEY].attributes.clock_offset_s = 599;})), null);
  // Cancels need no clock.
  const cancellable = edit('house_override', x => {x[HOUSE_KEY].attributes.clock_offset_s = null;});
  assert.equal(await refused(cancellable, 'house-override-cancel'), false);
  assert.ok(await refused(edit('house_running', x => {delete x[S.houseOverrideSet];}), 'house-override'), 'script missing');
  assert.ok(await refused(edit('house_running', x => {x[S.houseOverrideSet].state = 'unavailable';}), 'house-override'), 'script unavailable');
  // The request rules themselves: temperature and end bounds.
  const states = fixture('house_running'), end = CLIMATE_NOW + 3600000;
  assert.ok(houseOverrideRequest(states, {temperature: 20, until: end}, o));
  for (const temperature of [4.5, 30.5, 20.25, 'warm', null]) assert.equal(houseOverrideRequest(states, {temperature, until: end}, o), null, String(temperature));
  for (const until of [CLIMATE_NOW + 4 * 60000, CLIMATE_NOW + 7 * 86400000 + 60000, 'soon', null]) assert.equal(houseOverrideRequest(states, {temperature: 20, until}, o), null, String(until));
  assert.ok(houseAwayRequest(states, {until: CLIMATE_NOW + 89 * 86400000}, o));
  assert.equal(houseAwayRequest(states, {until: CLIMATE_NOW + 91 * 86400000}, o), null, 'Away ends within 90 days');
  assert.equal(houseAwayRequest(states, {until: CLIMATE_NOW + 60000}, o), null);
  assert.equal(await refused(fixture('house_running'), 'house-away'), false, 'a valid Away date is sent');
  const blank = harness(fixture('house_running')); blank.card._climate = {awayUntil: ''};
  await press(blank.card, 'house-away', 'house'); assert.equal(blank.calls.length, 0, 'no date, no Away');
  // Zones: only the scheduled ones, within the helper, with a next period.
  for (const id of ['noah', 'bedroom-suite', 'house', 'towel-rails', '']) assert.ok(await refused(fixture('house_running'), 'zone-override', id, {direction: 1}), id);
  assert.ok(await refused(fixture('house_running'), 'zone-override', 'attic', {direction: 2}));
  assert.ok(await refused(edit('house_running', x => {x[ZONES[0].target].state = '30';}), 'zone-override', 'attic', {direction: 1}), 'at the helper’s maximum');
  assert.ok(await refused(edit('house_running', x => {delete x[ZONES[0].schedule].attributes.next_event;}), 'zone-override', 'attic', {direction: 1}), 'no next period');
  assert.ok(await refused(fixture('house_running'), 'zone-override-cancel', 'attic'), 'no override to cancel');
  assert.equal(zoneOverrideRequest(fixture('sensors_unavailable'), 'attic', 1), null);
  // Drying: never while Away, only one way at a time.
  assert.ok(await refused(fixture('house_away'), 'drying-start', 'bathroom'));
  assert.ok(await refused(fixture('house_running'), 'drying-stop', 'bathroom'));
  assert.ok(await refused(fixture('house_override'), 'drying-start', 'ensuite'), 'already drying');
  assert.ok(await refused(fixture('house_running'), 'drying-start', 'hallway'));
  assert.equal(dryingRequest(fixture('sensors_unavailable'), 'bathroom', true), null);
  assert.ok(dryingRequest(fixture('house_off'), 'bathroom', true), 'allowed while off; the page says why it won’t warm');
  assert.equal(climateRequest('house-reboot', fixture('house_running'), {}, o), null);
});

test('the House sheet offers what the thermostat state allows, and says why otherwise', () => {
  const card = (states, extra) => detail(states, 'house', extra).body;
  const has = (value, command) => find(value, command);
  // The thermostat's own controls: the override, its end chips and Away's date.
  const houseWrites = value => controls(value).filter(c => c.command.startsWith('house-') || c.command === 'away-until');
  const running = card(fixture('house_running'));
  assert.equal(has(running, 'house-override')[0].enabled, true);
  assert.equal(has(running, 'house-override')[0].label, 'Hold 20° until 22:00');
  assert.deepEqual(has(running, 'house-end').map(c => c.entity), ['1h', '3h', 'next']);
  assert.equal(has(running, 'house-override-cancel').length, 0);
  assert.equal(running.control.away.summary, 'Away');
  assert.deepEqual(running.control.away.field.control.intent, {command: 'away-until', entity: 'house', value: ''}, 'Away’s date and time field');
  assert.ok(words(running).includes('Set it a few hours before you’re back, so the house is warm when you arrive.'));
  assert.equal(has(running, 'house-away')[0].enabled, false, 'Set Away waits for a date');
  const override = card(fixture('house_override'));
  assert.equal(override.reading.line, 'Warming · override 21.5° until 12:30');
  assert.equal(has(override, 'house-override-cancel')[0].enabled, true);
  const off = card(fixture('house_off'));
  assert.equal(off.reading.line, 'Switched off on the thermostat');
  assert.match(off.control.offWarning, /an override won’t warm the house until it is switched back on/);
  const away = card(fixture('house_away'));
  assert.equal(away.reading.line, 'Away until Sun 17:00');
  assert.equal(has(away, 'house-away-cancel')[0].enabled, true);
  assert.deepEqual(['house-override', 'house-step', 'house-away', 'house-end', 'away-until'].flatMap(c => has(away, c)), [], 'Away only offers Cancel');
  assert.match(away.control.text, /The Airco neither heats nor cools, and towels don’t dry/);
  const unknown = card(fixture('house_unknown'));
  assert.equal(unknown.control.text, 'The thermostat’s state is unknown, so Maison can’t change it right now.');
  assert.deepEqual(houseWrites(unknown), []);
  const drift = fixture('house_running'); drift[HOUSE_KEY].attributes.clock_offset_s = 8340;
  const skewed = card(drift), timed = controls(skewed).filter(c => ['house-override', 'house-step', 'house-away', 'house-end', 'away-until'].includes(c.command));
  assert.match(skewed.control.clockWarning, /its clock is unknown or more than 10 minutes out/);
  assert.equal(new Set(timed.map(c => c.command)).size, 5);
  assert.ok(timed.every(c => !c.enabled), 'nothing that sets a time');
  // Offline disables every write on the page and in the sheet; links still open.
  const offline = controls([page(fixture('house_running'), {online: false}), card(fixture('house_running'), {online: false})])
    .filter(c => !['detail', 'more', 'native-history'].includes(c.command));
  assert.ok(offline.length && offline.every(c => !c.enabled), 'offline disables every control');
  const busy = houseWrites(card(fixture('house_running'), {busy: new Set([HOUSE_KEY])}));
  assert.ok(busy.length && busy.every(c => !c.enabled), 'one thermostat write at a time');
});

test('"Warm the house too" appears only when a zone can’t warm on radiators', () => {
  const offer = (id, zoneId) => warmOffer(zoneId, fixture(id), o);
  const attic = offer('zone_override', 'attic');
  assert.deepEqual([attic.kind, attic.text, attic.label, attic.note], ['warm', 'House heating is aiming at 20°, so the Attic won’t warm.', 'Warm the house until 18:00 too', 'This also warms downstairs, to 21°.']);
  assert.equal(find(detail(fixture('zone_override'), 'attic'), 'house-warm', 'attic').length, 1);
  assert.equal(offer('house_running', 'attic'), null, 'the house heating is calling');
  assert.equal(offer('house_away', 'attic'), null, 'not while Away');
  assert.deepEqual(offer('house_off', 'attic'), {kind: 'off', text: 'Heating is switched off on the thermostat, so radiators won’t warm the Attic.'});
  assert.deepEqual(ZONES.flatMap(z => find(detail(fixture('house_off'), z.id), 'house-warm')), []);
  assert.equal(offer('airco_heating', 'attic'), null, 'not while the Airco heats the Attic');
  assert.equal(offer('airco_heating', 'sam').kind, 'warm', 'Sam’s office is always on radiators');
  // At or above target there is nothing to warm, whatever the house does.
  const warm = fixture('zone_override'); warm[ZONES[0].temperature].state = '21.8';
  assert.equal(warmOffer('attic', warm, o), null);
  // As script.house_heating_warm_until: only while the thermostat's own
  // reading is below its day temperature, so the override makes it call.
  const already = fixture('zone_override'); already[HOUSE_KEY].attributes.room_temperature = 21;
  const said = warmOffer('attic', already, o);
  assert.equal(said.request, null); assert.equal(said.label, '');
  assert.equal(said.note, 'Downstairs is already at its day temperature, so warming the house won’t start the boiler.');
  const value = detail(already, 'attic');
  assert.deepEqual(find(value, 'house-warm'), []);
  assert.deepEqual(words(value.body.warm), ['House heating is aiming at 20°, so the Attic won’t warm.', 'Downstairs is already at its day temperature, so warming the house won’t start the boiler.']);
  already[HOUSE_KEY].attributes.room_temperature = 20.9;
  assert.ok(houseWarmRequest(already, 'attic', o), 'just below the day temperature');
  // Not the old rule: a day temperature no warmer than the target still warms
  // while the thermostat reads below it.
  const target = fixture('zone_override'); target[HOUSE_KEY].attributes.target = 21;
  assert.ok(houseWarmRequest(target, 'attic', o));
  for (const [key, value, why] of [['room_temperature', null, 'its reading unknown'], ['day_temperature', null, 'its day temperature unknown'],
    ['calling', true, 'calling already'], ['calling', null, 'calling unknown']]) {
    const s = fixture('zone_override'); s[HOUSE_KEY].attributes[key] = value;
    assert.equal(houseWarmRequest(s, 'attic', o), null, why);
    const shown = warmOffer('attic', s, o);
    assert.ok(!shown || !shown.note.startsWith('Downstairs'), `${why}: no claim about downstairs`);
  }
  for (const mode of ['schedule', 'manual', 'override']) {
    const s = fixture('zone_override'); s[HOUSE_KEY].state = mode;
    if (mode === 'override') Object.assign(s[HOUSE_KEY].attributes, {override_temperature: 20, override_until: '2026-10-14T12:00:00+02:00'});
    assert.ok(houseWarmRequest(s, 'attic', o), mode);
  }
  for (const mode of ['off', 'away', 'unknown']) {
    const s = fixture('zone_override'); s[HOUSE_KEY].state = mode;
    assert.equal(houseWarmRequest(s, 'attic', o), null, mode);
  }
  // needs_house_heat from #24 wins; without it, the thermostat's call decides.
  const told = fixture('zone_override'); told[ZONES[0].target].attributes.needs_house_heat = false;
  assert.equal(warmOffer('attic', told, o), null);
  const unsaid = fixture('zone_override'); delete unsaid[ZONES[0].target].attributes.needs_house_heat;
  assert.equal(warmOffer('attic', unsaid, o).kind, 'warm');
  unsaid[HOUSE_KEY].attributes.calling = true;
  assert.equal(warmOffer('attic', unsaid, o), null);
  // A fixed zone has no end to warm until.
  const cold = fixture('zone_override'); cold['sensor.noahs_room_sensor_temperature'].state = '18.5';
  assert.equal(warmOffer('noah', cold, o).request, null);
  assert.equal(houseWarmRequest(cold, 'noah', o), null);
  // The end must be one the thermostat accepts.
  const late = fixture('zone_override'); late[ZONES[0].target].attributes.override_until = new Date(CLIMATE_NOW + 3 * 60000).toISOString();
  assert.equal(houseWarmRequest(late, 'attic', o), null);
});

test('confirmation predicates watch what each script changes', () => {
  const house = (state, attributes) => ({state, attributes});
  const until = Date.parse('2026-10-14T18:00:00+02:00');
  const override = confirms.houseOverride(21.5, until);
  assert.equal(override(house('override', {override_temperature: 21.5, override_until: '2026-10-14T18:01:00+02:00'})), true, 'within 2 minutes');
  assert.equal(override(house('override', {override_temperature: 21.5, override_until: '2026-10-14T18:03:00+02:00'})), false);
  assert.equal(override(house('override', {override_temperature: 21, override_until: '2026-10-14T18:00:00+02:00'})), false);
  assert.equal(override(house('schedule', {override_temperature: null})), false, 'a refusal never confirms');
  assert.equal(override(house('off', {override_temperature: 21.5})), true, 'switched off: the read-back is proof');
  assert.equal(override(house('unavailable', {override_temperature: 21.5})), false);
  assert.equal(confirms.houseOverrideCancel()(house('schedule', {override_until: null})), true);
  assert.equal(confirms.houseOverrideCancel()(house('override', {override_until: '2026-10-14T18:00:00+02:00'})), false);
  assert.equal(confirms.houseOverrideCancel()(house('off', {override_until: '2026-10-14T18:00:00+02:00'})), false);
  assert.equal(confirms.houseOverrideCancel()(house('unknown', {})), false);
  const away = confirms.houseAway(Date.parse('2026-10-18T15:00:00+02:00'));
  assert.equal(away(house('away', {away_until: '2026-10-18T15:00:00+02:00'})), true);
  assert.equal(away(house('schedule', {away_until: '2026-10-18T15:00:00+02:00'})), false);
  assert.equal(confirms.houseAwayCancel()(house('schedule', {})), true);
  assert.equal(confirms.houseAwayCancel()(house('away', {})), false);
  assert.equal(confirms.zoneOverride(22)(house('22.0', {mode: 'override'})), true);
  assert.equal(confirms.zoneOverride(22)(house('22.0', {mode: 'comfort'})), false);
  assert.equal(confirms.zoneOverrideCancel()(house('21', {mode: 'comfort'})), true);
  assert.equal(confirms.zoneOverrideCancel()(house('22', {mode: 'override'})), false);
  assert.equal(confirms.drying(true)(house('on', {})), true);
  assert.equal(confirms.drying(false)(house('on', {})), false);
  // Every request watches the entity it changes.
  const states = fixture('zone_override');
  assert.equal(houseWarmRequest(states, 'attic', o).watch, HOUSE_KEY);
  assert.equal(zoneOverrideRequest(states, 'attic', 1).watch, ZONES[0].target);
  assert.equal(dryingRequest(states, 'bathroom', true).watch, CLIMATE_CONTRACT.bathroomDrying);
});

test('a thermostat write is confirmed by sensor.house_heating, with a longer window', async t => {
  atFixtureTime(t);
  const states = fixture('house_running'), {card} = harness(states);
  card.scheduleRender = () => {};
  await press(card, 'house-override', 'house');
  assert.ok(card._busy.has(HOUSE_KEY), 'the thermostat controls wait together');
  assert.match(card._actionStatus, /House heating 20° until 22:00 · waiting for the thermostat, which can take a minute or two/);
  // The script "succeeding" proves nothing; only the read-back does.
  card.reconcileActions(); assert.match(card._actionStatus, /waiting for the thermostat/);
  t.mock.timers.tick(12000); assert.match(card._actionStatus, /waiting for the thermostat/, 'not released at 12 s');
  card.hass.states[HOUSE_KEY] = {...states[HOUSE_KEY], state: 'override', attributes: {...states[HOUSE_KEY].attributes, target: 20, override_temperature: 20, override_until: '2026-10-14T22:00:00+02:00'}};
  card.reconcileActions();
  assert.match(card._actionStatus, /House heating 20° until 22:00 · confirmed by the thermostat/);
  assert.equal(card._busy.size, 0);
  // Unconfirmed after the window: released and said plainly.
  const quiet = harness(fixture('house_running')).card; quiet.scheduleRender = () => {};
  await press(quiet, 'house-override', 'house');
  t.mock.timers.tick(THERMOSTAT_CONFIRM_MS);
  assert.match(quiet._actionStatus, /not confirmed by the thermostat yet\. Check the thermostat before trying again\./);
  assert.equal(quiet._busy.has(HOUSE_KEY), false);
  // Local scripts keep the usual 12 s.
  const zoneCard = harness(fixture('house_running')).card; zoneCard.scheduleRender = () => {};
  await press(zoneCard, 'zone-override', 'attic', {direction: 1});
  assert.ok(zoneCard._busy.has(ZONES[0].target));
  t.mock.timers.tick(12000);
  assert.match(zoneCard._actionStatus, /Attic override 21\.5° · not yet confirmed/);
});

test('Away pauses Drying and the Airco switches, and says so', () => {
  const states = fixture('house_away'), value = page(states);
  // No Dry towels on the page or in the sheet: each rail's line says why,
  // and the caption that would say what Dry towels does is gone.
  assert.deepEqual(controls([value, detail(states, 'towel-rails')]).filter(c => c.command.startsWith('drying-')), [], 'no Dry towels');
  assert.ok(value.rails.rows.every(r => r.line === 'Off while Away'));
  assert.equal(value.rails.caption, null);
  const airco = detail(states, 'attic').body.airco;
  assert.deepEqual([airco.heating.line, airco.cooling.line], ['Paused while Away', 'Paused while Away'], 'both Airco switches');
  const cooling = detail(fixture('house_running'), 'attic').body.airco.cooling;
  assert.deepEqual([cooling.title, cooling.line], ['Airco cooling', 'Cools to 23° when the attic passes 24° on hot days']);
  assert.equal(page(fixture('house_off')).rails.caption, 'Heating is switched off on the thermostat, so the rails won’t warm.');
  const drying = page(fixture('house_override'));
  assert.ok(words(drying).includes('Drying until 10:15'));
  // One Stop and one Dry towels among the rows' accessories.
  const rows = drying.rails.rows.map(r => r.action);
  assert.equal(find(rows, 'drying-stop', 'ensuite').length, 1);
  assert.equal(find(rows, 'drying-start', 'bathroom').length, 1);
});

test('switches: only Automatic charging and the two Airco switches', async () => {
  assert.deepEqual([...toggleIds].sort(), [E.carSmart, E.heatingAuto, CLIMATE_CONTRACT.aircoCooling].sort());
  const states = fixture('house_running');
  for (const id of [E.carOverride, 'input_boolean.airco_solar_session', 'input_boolean.guest_mode']) states[id] = {state: 'off', attributes: {}};
  const {card, calls} = harness(states);
  for (const id of [E.carOverride, 'input_boolean.airco_solar_session', 'input_boolean.guest_mode', 'switch.airco', 'climate.office_trv']) await press(card, 'toggle', id);
  assert.deepEqual(calls, []);
  const onPage = controls(CLIMATE_FIXTURES.flatMap(f => [page(f.states), ...CLIMATE_DETAILS.map(d => detail(f.states, d.id))])).filter(c => c.command === 'toggle').map(c => c.entity);
  assert.deepEqual([...new Set(onPage)].sort(), [E.heatingAuto, CLIMATE_CONTRACT.aircoCooling].sort());
});

test('the page and drawers write only through allowlisted commands, never to a managed valve', async t => {
  atFixtureTime(t);
  // Links only navigate; a drawer closes with close.
  const links = ['detail', 'more', 'native-history', 'close'];
  const allowed = [...links, 'zone-step', 'step', 'toggle', 'house-step', 'house-end', 'away-until', 'house-override', 'house-override-cancel',
    'house-away', 'house-away-cancel', 'house-warm', 'zone-override', 'zone-override-cancel', 'drying-start', 'drying-stop'];
  const managed = [...HOUSE.valves, ...ZONES.filter(z => z.kind === 'scheduled').flatMap(z => z.valves)].map(v => v.id).concat(TOWEL_RAILS.map(r => r.valve));
  for (const f of CLIMATE_FIXTURES) {
    const states = structuredClone(f.states), draft = {awayUntil: '2026-10-18T15:00'}, {card, calls} = harness(states); card._climate = {...draft};
    const shown = controls([page(states, {draft}), ...CLIMATE_DETAILS.map(d => detail(states, d.id, {draft}))]);
    for (const c of shown) {
      assert.ok(allowed.includes(c.command), `${f.id}: ${c.command}`);
      // Away's field keeps the date it shows.
      if (c.enabled && !links.includes(c.command)) await press(card, c.command, c.entity, c.command === 'away-until' ? {value: draft.awayUntil} : c.direction === undefined ? {} : {direction: c.direction});
    }
    for (const [domain, service, data] of calls) {
      if (domain === 'script') {assert.equal(service, 'turn_on'); assert.ok(CLIMATE_SCRIPTS.includes(data.entity_id), data.entity_id);}
      else if (domain === 'climate') {assert.equal(service, 'set_temperature'); assert.ok(climateIds.has(data.entity_id) && !managed.includes(data.entity_id), data.entity_id);}
      else if (domain === 'input_boolean') assert.ok(toggleIds.has(data.entity_id));
      else if (domain === 'input_number') assert.ok(STEPPABLE_HELPERS.includes(data.entity_id));
      else assert.fail(`${f.id}: ${domain}.${service}`);
    }
  }
});

test('the step command covers the Attic’s and Sam’s comfort and setback only', async () => {
  const states = fixture('house_running'), {card, calls} = harness(states);
  await press(card, 'step', CLIMATE_CONTRACT.atticOverride, {direction: 1});
  await press(card, 'step', 'input_number.guest_temperature', {direction: 1});
  assert.deepEqual(calls, []);
  await press(card, 'step', E.atticComfort, {direction: 1});
  await press(card, 'step', CLIMATE_CONTRACT.samSetback, {direction: -1});
  assert.deepEqual(calls, [['input_number', 'set_value', {value: 21.5, entity_id: E.atticComfort}], ['input_number', 'set_value', {value: 17.5, entity_id: CLIMATE_CONTRACT.samSetback}]]);
  assert.deepEqual(STEPPABLE_HELPERS, [E.atticComfort, E.atticSetback, CLIMATE_CONTRACT.samComfort, CLIMATE_CONTRACT.samSetback]);
  assert.deepEqual(find(detail(states, 'sam'), 'step', 'input_number.sams_office_comfort_temperature').map(c => c.direction), [-1, 1]);
});

test('zone-step moves only the fixed zones’ targets', async () => {
  const states = fixture('house_running'), {card, calls} = harness(states);
  for (const id of ['attic', 'sam', 'house', 'towel-rails', 'hallway', 'climate.bedroom_trv', '']) await press(card, 'zone-step', id, {direction: 1});
  await press(card, 'zone-step', 'noah', {direction: 2});
  assert.deepEqual(calls, []);
  await press(card, 'zone-step', 'noah', {direction: 1});
  await press(card, 'zone-step', 'bedroom-suite', {direction: -1});
  assert.deepEqual(calls, [
    ['climate', 'set_temperature', {temperature: 20.5, entity_id: 'climate.noahs_room_trv'}],
    ['climate', 'set_temperature', {temperature: 16.5, entity_id: 'climate.bedroom_trv'}],
  ]);
  for (const id of ['attic', 'sam', 'house', 'towel-rails']) assert.equal(zoneTargetStep(id, states, 1), null, id);
  const top = fixture('house_running'); top['climate.bedroom_trv'].attributes.temperature = 35;
  assert.equal(zoneTargetStep('bedroom-suite', top, 1), null, 'clamped at the valve maximum');
  const gone = fixture('sensors_unavailable');
  assert.equal(zoneTargetStep('noah', gone, 1), null, 'an unavailable valve cannot be stepped');
  const offline = harness(fixture('house_running'), false);
  await press(offline.card, 'zone-step', 'noah', {direction: 1});
  assert.deepEqual(offline.calls, []);
});

test('climate target requires capability and quantizes within entity bounds', () => {
  const attributes = {supported_features: 1, temperature: 20, min_temp: 16, max_temp: 24, target_temp_step: 0.5};
  const state = {entity_id: 'climate.room', state: 'heat', attributes};
  assert.equal(climateTarget(state, 21.26), 21.5);
  assert.equal(climateTarget(state, 40), 24);
  assert.equal(climateTarget(state, 10), 16);
  assert.equal(climateTarget({...state, state: 'unavailable'}, 20), null);
  assert.equal(climateTarget({...state, attributes: {...attributes, supported_features: 0}}, 20), null);
  assert.equal(climateTarget({...state, attributes: {...attributes, target_temp_step: 0}}, 20), null);
});

test('scheduled zone sheets: an override stepper and Cancel while one runs', () => {
  const attic = detail(fixture('zone_override'), 'attic').body;
  assert.equal(attic.reading.line, 'Won’t warm · override 22° until 18:00');
  assert.deepEqual([attic.control.title, attic.control.line], ['Override', 'Ends by itself at 18:00']);
  assert.equal(find(attic, 'zone-override', 'attic').filter(c => c.label === 'Override Attic warmer').length, 1);
  assert.equal(find(attic, 'zone-override-cancel', 'attic').length, 1);
  const sam = detail(fixture('house_running'), 'sam').body;
  assert.deepEqual([sam.control.title, sam.control.line], ['Target now', 'Changing it overrides until 18:00']);
  assert.deepEqual(find(sam, 'zone-override-cancel'), []);
});

test('zone drawers: charts, read-only valves with probes, and the schedule for scheduled zones', () => {
  const states = fixture('house_override'), charts = value => value.body.charts.map(c => [c.full.intent.command, c.full.intent.entity]);
  const attic = detail(states, 'attic');
  assert.deepEqual(charts(attic), [['native-history', 'climate-attic-temperature'], ['native-history', 'climate-attic-humidity']]);
  assert.deepEqual(attic.body.radiators.rows.map(r => [r.name, r.probeCaption]), [['Office radiator', 'Valve probe'], ['Playground radiator', 'Valve probe']]);
  assert.deepEqual([attic.body.reading.line, attic.body.schedule.caption], ['Warming · 21° until 18:00, then 16°', null], 'the line says where the schedule stands, so the caption says nothing');
  assert.deepEqual(find(attic, 'more', 'schedule.attic_occupied').map(c => c.label), ['Open the schedule in Home Assistant'], 'the Attic schedule is YAML, so not editable in HA');
  assert.equal(attic.body.airco.heating.title, 'Let the Airco heat when cheaper');
  assert.equal(attic.body.airco.cooling.line, 'Cools to 23° when the attic passes 24° on hot days');
  assert.deepEqual(find(attic, 'more', 'climate.ec3a56bc6527').map(c => c.label), ['Airco controls']);
  assert.equal(find(attic, 'zone-override', 'attic').length, 2);
  assert.deepEqual(find(attic, 'zone-step'), []);
  const sam = detail(states, 'sam');
  assert.equal(sam.body.schedule.link.label, 'Open the schedule in Home Assistant', 'Sam’s schedule is YAML too');
  const noah = detail(states, 'noah');
  assert.equal(find(noah, 'zone-step', 'noah').length, 2);
  assert.equal(noah.body.schedule, null);
  assert.doesNotMatch(everything(noah), /Today|schedule/);
  const house = detail(states, 'house');
  assert.deepEqual(house.body.radiators.rows.map(r => r.name), ['Living room radiator', 'Kitchen radiator']);
  assert.match(house.body.radiators.note, /Not controls: the house thermostat decides/);
  const rails = detail(states, 'towel-rails');
  assert.ok(words(rails).includes('Drying until 10:15'));
  assert.equal(find(rails.body.rows.map(r => r.action), 'drying-stop', 'ensuite').length, 1);
  assert.ok(charts(rails).some(([, entity]) => entity === 'climate-towel-rails-temperature'));
});

test('the House drawer shows the thermostat’s week read-only, today marked', () => {
  const week = (states, extra) => detail(states, 'house', extra).body.week;
  const running = week(fixture('house_running'));
  // `today` marks the day as today, for sight and for screen readers.
  assert.deepEqual(running.days.map(d => [d.name, d.today]), [['Mon', null], ['Tue', null], ['Wed', 'Today'], ['Thu', null], ['Fri', null], ['Sat', null], ['Sun', null]]);
  assert.ok(running.days.some(d => d.plan === '20° 06:30–22:00, otherwise 18°'));
  assert.ok(running.days.some(d => d.plan === '21° 08:00–23:00, otherwise 18°'));
  assert.match(running.note, /Read-only: times as set on the thermostat\. Change them there\./);
  assert.doesNotMatch(running.note, /Its clock is/, '16 s is no drift worth saying');
  const slow = fixture('house_running'); slow[HOUSE_KEY].attributes.clock_offset_s = 185;
  assert.match(week(slow).note, /Its clock is 3 min slow, so these run 3 min late\./);
  // Just after midnight real time, a slow thermostat is still on its yesterday.
  const late = fixture('house_running'); late[HOUSE_KEY].attributes.clock_offset_s = 300;
  assert.deepEqual(week(late, {now: Date.parse('2026-10-15T00:02:00+02:00')}).days.filter(d => d.today).map(d => d.name), ['Wed']);
  const flat = fixture('house_running'); flat[HOUSE_KEY].attributes.week = {...flat[HOUSE_KEY].attributes.week, sunday: [{start: '00:00', end: '24:00', temperature: 18}]};
  assert.ok(week(flat).days.some(d => d.plan === '18° all day'));
  const broken = fixture('house_running'); broken[HOUSE_KEY].attributes.week = {monday: []};
  assert.match(week(broken).text, /weekly schedule has no reading/);
});

test('date and time helpers read the input in the house’s time zone', () => {
  assert.equal(isoIn(zonedTime('2026-10-18T15:00', tz), tz), '2026-10-18T15:00:00+02:00');
  // Summer time ends on 25 October.
  assert.equal(isoIn(zonedTime('2026-10-26T15:00', tz), tz), '2026-10-26T15:00:00+01:00');
  assert.equal(localInput(Date.parse('2026-10-26T14:00:00Z'), tz), '2026-10-26T15:00');
  assert.equal(localInput(CLIMATE_NOW, tz), '2026-10-14T09:30');
  for (const bad of ['', '2026-10-18', '18/10/2026 15:00', null, undefined]) assert.equal(zonedTime(bad, tz), null, String(bad));
  const field = detail(fixture('house_running'), 'house').body.control.away.field;
  assert.deepEqual([field.min, field.max], ['2026-10-14T09:35', '2027-01-12T08:30'], 'Away within 5 minutes and 90 days');
});

test('towel rails: frost, Drying and unavailable stay distinct', () => {
  const states = fixture('house_running'), [ensuite, bathroom] = TOWEL_RAILS;
  assert.equal(railStatus(ensuite, states, o).status.label, 'Off (frost)', 'a rail switched off holds frost protection');
  states[bathroom.valve].attributes.temperature = FROST_MAX;
  assert.equal(railStatus(bathroom, states, o).status.label, 'Off (frost)');
  states[bathroom.valve].attributes.temperature = FROST_MAX + 14;
  assert.equal(railStatus(bathroom, states, o).status.label, 'Set to 21°');
  states[bathroom.valve].state = 'unavailable';
  assert.equal(railStatus(bathroom, states, o).status.label, 'Unavailable');
});

test('charts are cached per drawer as climate-<id>, leaving out ids Home Assistant does not have', () => {
  const all = climateHistory();
  assert.deepEqual([...new Set(all.map(h => h.group))], CLIMATE_DETAILS.map(d => `climate-${d.id}`));
  for (const h of all) assert.ok(h.key.startsWith(`${h.group}-`), h.key);
  const missing = climateHistory(fixture('contract_missing'));
  const sam = missing.find(h => h.key === 'climate-sam-temperature');
  assert.deepEqual(sam.ids, ['sensor.sams_office_sensor_temperature']);
  assert.equal(sam.title, 'Temperature · 24 hours');
  const attic = missing.find(h => h.key === 'climate-attic-temperature');
  assert.deepEqual(attic.ids, [ZONES[0].temperature, ZONES[0].target]);
  assert.deepEqual(attic.labels, ['Office sensor', 'Target']);
  assert.deepEqual(attic.stepped, [false, true], 'the target is drawn in steps');
  const rails = missing.find(h => h.group === 'climate-towel-rails');
  assert.deepEqual(rails.labels, ['Ensuite valve probe', 'Bathroom valve probe']);
  assert.equal(climateHistory({}).length, 0, 'nothing to chart when nothing exists');
});

test('the element loads the open drawer’s charts as one group', async () => {
  const states = fixture('house_running'), {card} = harness(states), requests = [];
  card.scheduleRender = () => {};
  card._hass.callApi = async (_method, path) => {requests.push(decodeURIComponent(path)); return [];};
  card._page = 'climate'; card._modal = 'attic';
  await card.loadViewData(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.length, 1);
  assert.match(requests[0], /filter_entity_id=sensor\.office_sensor_temperature,sensor\.attic_target_temperature,sensor\.office_sensor_humidity&/);
  assert.ok(card._historyPages['climate-attic']);
});

test('fixed zones chart their target sensor, and their cards read it before the valve', async () => {
  assert.equal(CLIMATE_CONTRACT.noahTarget, 'sensor.noahs_room_target_temperature');
  assert.equal(CLIMATE_CONTRACT.bedroomTarget, 'sensor.bedroom_suite_target_temperature');
  const all = climateHistory(fixture('house_running'));
  for (const id of ['noah', 'bedroom-suite']) {
    const z = ZONES.find(x => x.id === id), chart = all.find(h => h.key === `climate-${id}-temperature`);
    assert.deepEqual([chart.ids, chart.labels, chart.stepped, chart.title], [[z.temperature, z.target], [z.readingLabel, 'Target'], [false, true], 'Temperature and target · 24 hours'], id);
  }
  // Until the sensors exist: the reading alone, and the card reads the valve.
  const missing = fixture('contract_missing'), before = climateHistory(missing).find(h => h.key === 'climate-noah-temperature');
  assert.deepEqual([before.ids, before.title], [['sensor.noahs_room_sensor_temperature'], 'Temperature · 24 hours']);
  assert.equal(zone(missing, 'noah').targetLine, 'Always 20°');
  const states = fixture('house_running');
  states[CLIMATE_CONTRACT.bedroomTarget].state = '17.5';
  assert.equal(zone(states, 'bedroom-suite').targetLine, 'Always 17.5°', 'the sensor when it says');
  states[CLIMATE_CONTRACT.bedroomTarget].state = 'unavailable';
  assert.equal(zone(states, 'bedroom-suite').targetLine, 'Always 17°', 'the valve when it doesn’t');
  // The drawer loads the target with its reading.
  const {card} = harness(fixture('house_running')), requests = [];
  card.scheduleRender = () => {};
  card._hass.callApi = async (_method, path) => {requests.push(decodeURIComponent(path)); return [];};
  card._page = 'climate'; card._modal = 'noah';
  await card.loadViewData(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(requests[0], /filter_entity_id=sensor\.noahs_room_sensor_temperature,sensor\.noahs_room_target_temperature,sensor\.noahs_room_sensor_humidity&/);
});

test('a schedule change already due counts as made, and holds the zone override back', async t => {
  const due = Date.parse('2026-10-14T18:00:00+02:00');
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: due + 2000});
  const late = {now: due + 2000, tz}, attic = ZONES[0];
  // 18:00 has come; the schedule's own timer hasn't flipped it yet.
  const states = fixture('house_running');
  states[attic.target] = {...states[attic.target], state: '16', attributes: {...states[attic.target].attributes, mode: 'setback', next_change: null, next_target: 21}};
  const s = zoneStatus('attic', states, late);
  assert.deepEqual([s.schedule.period, s.schedule.changeMs, s.targetLine], ['setback', null, '16° now']);
  const sheet = detail(states, 'attic', {now: late.now}).body;
  assert.deepEqual([sheet.reading.line, sheet.schedule.caption], ['Warming · 16° now', null], 'setback now, with nothing held');
  assert.equal(zoneOverrideRequest(states, 'attic', 1, late), null);
  assert.ok(zoneOverrideRequest(states, 'attic', 1, {now: due - 60000, tz}), 'a minute earlier it is allowed');
  const stepper = find(detail(states, 'attic', {now: late.now}), 'zone-override');
  assert.ok(stepper.length === 2 && stepper.every(c => !c.enabled), 'the stepper is disabled in that instant');
  const {card: element, calls} = harness(states);
  await press(element, 'zone-override', 'attic', {direction: 1});
  assert.deepEqual(calls, [], 'and the element refuses it');
  // A target sensor lagging with a next_change already past is not shown.
  states[attic.target].attributes.next_change = '2026-10-14T18:00:00+02:00';
  assert.equal(zoneStatus('attic', states, late).schedule.changeMs, null);
});

test('the thermostat, not the pump, says the house heating is off', () => {
  const states = fixture('house_running');
  assert.equal(houseNotCalling(states), false);
  states[HOUSE_KEY].attributes.calling = false;
  assert.equal(houseNotCalling(states), true);
  for (const mode of ['off', 'away']) {const s = fixture('house_running'); s[HOUSE_KEY].state = mode; assert.equal(houseNotCalling(s), true, mode);}
  for (const mode of ['unknown', 'unavailable', 'holiday']) {const s = fixture('zone_override'); s[HOUSE_KEY].state = mode; assert.equal(houseNotCalling(s), false, mode);}
  assert.equal(houseNotCalling(fixture('contract_missing')), false);
});

test('a scheduled zone’s drawer shows today’s periods, read with schedule.get_schedule', async t => {
  atFixtureTime(t);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const answer = request => ({context: {}, response: {[request.target.entity_id]: CLIMATE_SCHEDULES[request.target.entity_id]}});
  const {card, calls} = harness(fixture('house_running')), requests = [];
  card.scheduleRender = () => {}; card._hass.callApi = async () => [];
  card._hass.callWS = async request => {requests.push(request); return answer(request);};
  card._page = 'climate'; card._modal = 'attic';
  // What the open drawer shows, from the element's own snapshot. The zone's
  // line says the current period whether or not today's periods have loaded.
  const sheet = (extra = {}) => screen({...card.snapshot(), ...extra}).drawer.body, schedule = extra => sheet(extra).schedule;
  const NOW = 'Warming · 21° until 18:00, then 16°';
  const fallback = schedule();
  assert.equal(fallback.today, null, 'nothing before it loads');
  assert.deepEqual([sheet().reading.line, fallback.caption], [NOW, null]);
  await card.loadViewData(); await flush();
  assert.deepEqual(requests, [{type: 'call_service', domain: 'schedule', service: 'get_schedule', target: {entity_id: 'schedule.attic_occupied'}, return_response: true}]);
  assert.deepEqual(calls, [], 'read-only: no service call');
  const attic = schedule();
  // One row like the thermostat's week, marked today, its bar in shares of the day.
  assert.deepEqual(attic.today, {name: 'Wed', today: 'Today', plan: 'Comfort 08:00–18:00 · setback otherwise',
    bar: [{width: 33.33, warm: false}, {width: 41.67, warm: true}, {width: 25, warm: false}]});
  assert.deepEqual([sheet().reading.line, attic.caption], [NOW, null], 'the current period stays');
  // Cached for 30 minutes.
  t.mock.timers.tick(29 * 60000); await card.loadViewData(); await flush();
  assert.equal(requests.length, 1);
  t.mock.timers.tick(60000); await card.loadViewData(); await flush();
  assert.equal(requests.length, 2);
  // Sam's office has no comfort at the weekend.
  card._modal = 'sam'; await card.loadViewData(); await flush();
  assert.equal(requests.at(-1).target.entity_id, 'schedule.sams_office_occupied');
  const saturday = schedule({now: Date.parse('2026-10-17T09:30:00+02:00'), route: {page: 'climate', detail: 'sam', dialog: null}}).today;
  assert.deepEqual([saturday.name, saturday.today, saturday.plan], ['Sat', 'Today', 'Setback all day']);
  // Only a scheduled zone's own schedule, and nothing while offline.
  assert.deepEqual(['house', 'attic', 'sam', 'noah', 'bedroom-suite', 'towel-rails'].map(climateSchedules),
    [[], ['schedule.attic_occupied'], ['schedule.sams_office_occupied'], [], [], []]);
  const offline = harness(fixture('house_running'), false).card;
  offline._hass.callWS = async request => {requests.push(request); return answer(request);};
  await offline.loadZoneSchedules(['schedule.attic_occupied']);
  assert.equal(requests.length, 3);
});

test('when today’s periods can’t be read, the drawer keeps the current period and retries', async t => {
  atFixtureTime(t);
  for (const reply of [async () => {throw new Error('Service schedule.get_schedule not found');}, async () => ({response: {}}),
    async () => ({response: {'schedule.attic_occupied': {monday: [{from: 'soon', to: '18:00:00'}]}}})]) {
    const {card} = harness(fixture('house_running'));
    let asked = 0;
    card.scheduleRender = () => {}; card._hass.callWS = async () => {asked++; return reply();};
    card._page = 'climate'; card._modal = 'attic';
    await card.loadZoneSchedules(['schedule.attic_occupied']);
    const body = screen(card.snapshot()).drawer.body;
    assert.equal(body.schedule.today, null);
    assert.deepEqual([body.reading.line, body.schedule.caption], ['Warming · 21° until 18:00, then 16°', null], 'the zone’s line keeps the current period');
    t.mock.timers.tick(4 * 60000); await card.loadZoneSchedules(['schedule.attic_occupied']);
    assert.equal(asked, 1, 'not again within five minutes');
    t.mock.timers.tick(60000); await card.loadZoneSchedules(['schedule.attic_occupied']);
    assert.equal(asked, 2, 'retried after five');
  }
  // A missing schedule helper is not asked for.
  const states = fixture('contract_missing'), {card} = harness(states);
  card._hass.callWS = async () => assert.fail('no helper, no call');
  await card.loadZoneSchedules(['schedule.sams_office_occupied']);
});

test('today’s periods read as household language', () => {
  const wed = {now: CLIMATE_NOW, tz};
  assert.deepEqual(todaysPeriods({wednesday: [{from: '08:00', to: '18:00'}]}, wed), [{from: '08:00', to: '18:00'}]);
  assert.equal(todaysPeriods(undefined, wed), null);
  assert.equal(todaysPeriods({monday: []}, wed), null, 'a day missing is unread, not setback');
  assert.equal(periodsLine([]), 'Setback all day');
  assert.equal(periodsLine([{from: '00:00', to: '24:00'}]), 'Comfort all day');
  assert.equal(periodsLine([{from: '08:00', to: '18:00'}]), 'Comfort 08:00–18:00 · setback otherwise');
  assert.equal(periodsLine([{from: '07:00', to: '09:00'}, {from: '17:00', to: '22:00'}]), 'Comfort 07:00–09:00 and 17:00–22:00 · setback otherwise');
  assert.equal(periodsLine([{from: '06:00', to: '08:00'}, {from: '12:00', to: '13:00'}, {from: '18:00', to: '24:00'}]), 'Comfort 06:00–08:00, 12:00–13:00 and 18:00–24:00 · setback otherwise');
});

test('old Rooms links open Climate and the room’s zone drawer', () => {
  const {card} = harness({});
  const destinations = {};
  globalThis.history = {replaceState: (_a, _b, url) => {destinations.last = url;}};
  try {
    for (const [from, to] of [['#rooms', '#climate'], ['#rooms/office', '#climate/attic'], ['#rooms/playground', '#climate/attic'], ['#rooms/hallway', '#climate'],
      ['#rooms/ensuite', '#climate/towel-rails'], ['#rooms/bathroom', '#climate/towel-rails'], ['#rooms/living', '#climate/house'], ['#rooms/kitchen', '#climate/house'],
      ['#rooms/dining', '#climate/house'], ['#rooms/bedroom', '#climate/bedroom-suite'], ['#rooms/noah', '#climate/noah'], ['#rooms/sam', '#climate/sam'],
      ['#rooms/missing', '#climate']]) {
      globalThis.location = {hash: from, pathname: '/maison-home/home', search: '?kiosk'};
      assert.equal(card.readPage(), 'climate', from);
      assert.equal(destinations.last, `/maison-home/home?kiosk${to}`, from);
      location.hash = to;
      assert.equal(card.routeDetail(), to.split('/')[1] || null, to);
    }
    location.hash = '#climate/missing';
    assert.equal(card.readPage(), 'climate'); assert.equal(card.routeDetail(), null);
  } finally {delete globalThis.location; delete globalThis.history;}
  assert.equal(ROOM_DETAIL.hallway, null);
  for (const id of Object.values(ROOM_DETAIL).filter(Boolean)) assert.ok(CLIMATE_DETAILS.some(d => d.id === id), id);
});

test('a zone drawer is titled by its zone and eyebrowed by its rooms', () => {
  const states = fixture('house_running'), shown = screen(snapshot(states, {detail: 'bedroom-suite'}));
  assert.deepEqual([shown.drawer.id, shown.drawer.title, shown.drawer.eyebrow], ['bedroom-suite', 'Bedroom suite', 'Bedroom · Ensuite']);
  assert.equal(shown.page.house.title, 'House heating'); assert.equal(shown.drawer.body.kind, 'zone');
  assert.equal(detail(states, 'missing'), null);
});

test('the house draft lives in memory and follows the chips and stepper', async () => {
  const {card} = harness(fixture('house_running'));
  const draft = () => card._climate;
  const realNow = Date.now;
  Date.now = () => CLIMATE_NOW;
  try {
    await press(card, 'house-step', 'house', {direction: 1});
    await press(card, 'house-step', 'house', {direction: 1});
    assert.deepEqual(draft().house, {base: 20, temperature: 21});
    await press(card, 'house-end', '3h');
    assert.equal(draft().houseEnd, '3h');
    await press(card, 'house-end', 'forever');
    assert.equal(draft().houseEnd, '3h', 'an unknown chip changes nothing');
    card._page = 'climate'; card._modal = 'house';
    const house = screen(card.snapshot()).drawer.body.control;
    assert.deepEqual([house.step.stepper.outputLabel, house.step.stepper.output], ['House heating override', '21°']);
    assert.equal(house.start.label, 'Hold 21° until 12:30');
    assert.deepEqual(house.ends.filter(e => e.selected).map(e => e.intent.entity), ['3h']);
  } finally {Date.now = realNow;}
});

// ---- The readings --------------------------------------------------------------------
const RUNNING = {attic: '19.8° Warming · 21° until 18:00, then 16° (19.8 → 21)', sam: '19.2° Warming · 20° until 18:00, then 18° (19.2 → 20)',
  noah: '20.1° At target · always 20° (20.1 → 20)', 'bedroom-suite': '16.8° At target · always 17° (16.8 → 17)'};
// The radiator zones below target while the house thermostat isn't calling
// won't warm: off, Away, or satisfied downstairs alike.
const WONT_WARM = {...RUNNING, attic: '19.8° Won’t warm · 21° until 18:00, then 16° (19.8 → 21)',
  sam: '19.2° Won’t warm · 20° until 18:00, then 18° (19.2 → 20)'};
const HOUSE_RUNNING = '19.6° Warming · 20° until 22:00, then 18° (19.6 → 20)';
const NO_READING = '— No reading or target (— → no target)';

test('every fixture reads each zone and the house against its target, in a line short enough for a small widget', () => {
  const expected = {
    house_running: {house: HOUSE_RUNNING, ...RUNNING},
    house_override: {house: '19.6° Warming · override 21.5° until 12:30 (19.6 → 21.5)', ...RUNNING},
    house_manual: {house: '19.6° Warming · holds 20°, schedule off (19.6 → 20)', ...RUNNING},
    house_off: {house: '19.6° Switched off on the thermostat (19.6 → no target)', ...WONT_WARM},
    // Away's holiday temperature is its target: 10°, below the scale.
    house_away: {house: '19.6° Away until Sun 17:00 (19.6 → 10)', ...WONT_WARM},
    house_unknown: {house: '19.6° Thermostat state unknown (19.6 → no target)', ...RUNNING},
    zone_override: {house: '20.4° At target · 20° until 22:00, then 18° (20.4 → 20)', ...WONT_WARM,
      attic: '19.8° Won’t warm · override 22° until 18:00 (19.8 → 22)'},
    airco_heating: {house: '19.6° At target · 20° until 22:00, then 18° (19.6 → 20)', ...WONT_WARM, attic: '20.2° Warming · 21° until 18:00, then 16° (20.2 → 21)'},
    dry_humid: {house: HOUSE_RUNNING, ...RUNNING, attic: '19.8° [Dry air] Warming · 21° until 18:00, then 16° (19.8 → 21)',
      'bedroom-suite': '16.8° [Humid] At target · always 17° (16.8 → 17)'},
    sensors_unavailable: {house: '— Thermostat state unknown (— → no target)', attic: NO_READING, sam: NO_READING, noah: NO_READING, 'bedroom-suite': NO_READING},
    // Without its sensor the house still says what it is doing, as the hero does.
    contract_missing: {house: '19.6° Warming · thermostat not set up yet (19.6 → no target)', ...RUNNING, sam: '19.2° Warming · schedule not set up yet (19.2 → no target)'},
  };
  assert.deepEqual(CLIMATE_FIXTURES.map(f => f.id).sort(), Object.keys(expected).sort(), 'one expectation per fixture');
  for (const f of CLIMATE_FIXTURES) {
    const value = page(f.states);
    assert.deepEqual(readings(value), expected[f.id], f.id);
    // The room scale the header's capsules share, for every bar.
    for (const r of [value.house.reading, ...value.zones.map(z => z.reading)]) assert.deepEqual([r.bar.plot.min, r.bar.plot.max], [14, 26], f.id);
    // A zone's line fits a small widget's two lines at 13px; the longest here is 45 characters.
    for (const z of value.zones) assert.ok(z.reading.line.length <= 50, `${f.id} ${z.id}: ${z.reading.line}`);
  }
});

// The House card, the hero and the zones under them must agree: a zone never
// says the heating is off while the thermostat runs its schedule, is held or
// overridden, however satisfied it is downstairs.
test('no zone line says the heating is off while the house heating runs its schedule, is held or overridden', () => {
  // The thermostat satisfied downstairs (not calling) in each running mode.
  const satisfied = mode => {
    const states = fixture('zone_override'), a = states[HOUSE_KEY].attributes;
    states[HOUSE_KEY] = {...states[HOUSE_KEY], state: mode};
    if (mode === 'manual') Object.assign(a, {next_change: null});
    if (mode === 'override') Object.assign(a, {target: 21.5, override_until: '2026-10-14T12:30:00+02:00', override_temperature: 21.5});
    return [`satisfied, ${mode}`, states];
  };
  const cases = [...CLIMATE_FIXTURES.map(f => [f.id, structuredClone(f.states)]), ...['schedule', 'manual', 'override'].map(satisfied)];
  let wontWarm = 0;
  for (const [where, states] of cases) {
    const mode = houseStatus(states, {now: CLIMATE_NOW, tz: 'Europe/Brussels'}).mode, value = page(states);
    const lines = [...value.zones.map(z => z.reading.line), ...ZONES.map(z => detail(states, z.id).body.reading.line)];
    if (['schedule', 'manual', 'override'].includes(mode)) for (const line of lines) assert.doesNotMatch(line, /\boff\b/i, `${where} (${mode}): ${line}`);
    for (const z of ZONES) {
      const below = zoneStatus(z.id, states, {now: CLIMATE_NOW, tz: 'Europe/Brussels'}).status.key === 'below_house_off';
      assert.equal(value.zones.find(v => v.id === z.id).reading.line.startsWith('Won’t warm · '), below, `${where} ${z.id}`);
      wontWarm += below;
    }
  }
  assert.ok(wontWarm >= 10, 'the cases include zones that won’t warm in every mode');
  assert.match(page(fixture('house_off')).house.reading.line, /\boff\b/i, 'the house says it is switched off, and only it');
});

test('with no target or no reading, the line takes its natural form, and an override and a held setpoint say so first', () => {
  const zoneLine = (states, id) => said(page(states).zones.find(z => z.id === id).reading);
  // The Attic overnight, above its setback until the morning.
  const above = fixture('house_running'), attic = zoneOf('attic');
  above[attic.temperature].state = '24.2';
  above[attic.target] = {...above[attic.target], state: '16', attributes: {...above[attic.target].attributes, mode: 'setback', next_change: '2026-10-15T08:00:00+02:00', next_target: 21}};
  for (const v of attic.valves) above[v.id].attributes.hvac_action = 'idle';
  assert.equal(zoneLine(above, 'attic'), '24.2° Above target · 16° until Thu 08:00, then 21° (24.2 → 16)');
  // Below target while the house heating calls: nothing more to say.
  const below = fixture('house_running');
  for (const v of attic.valves) below[v.id].attributes.hvac_action = 'idle';
  assert.equal(zoneLine(below, 'attic'), '19.8° Below target · 21° until 18:00, then 16° (19.8 → 21)');
  const cooling = fixture('house_running'); cooling[attic.airco].state = 'cool';
  assert.equal(zoneLine(cooling, 'attic'), '19.8° Cooling · 21° until 18:00, then 16° (19.8 → 21)');
  const blind = fixture('house_running'); blind[zoneOf('bedroom-suite').temperature].state = 'unavailable';
  assert.equal(zoneLine(blind, 'bedroom-suite'), '— No reading · always 17° (— → 17)');
  const lost = fixture('house_running'); lost[zoneOf('noah').target].state = 'unavailable'; lost[zoneOf('noah').valves[0].id].state = 'unavailable';
  assert.equal(zoneLine(lost, 'noah'), '20.1° Target unknown (20.1 → no target)');
  const endless = fixture('zone_override'); endless[attic.target].attributes.override_until = null;
  assert.equal(zoneLine(endless, 'attic'), '19.8° Won’t warm · override 22° (19.8 → 22)');
  const house = changes => {const states = fixture('house_running'); changes(states); return page(states).house;};
  assert.equal(said(house(s => {s[HOUSE_KEY] = fixture('house_override')[HOUSE_KEY]; s[HOUSE_KEY].attributes.override_until = null;}).reading),
    '19.6° Warming · override 21.5° (19.6 → 21.5)');
  assert.equal(said(house(s => {s[HOUSE_KEY].attributes.target = null;}).reading), '19.6° Warming · target unknown (19.6 → no target)');
  // The mode known but its scripts missing: the house still reads as it runs,
  // and there is nothing to press.
  const unscripted = house(s => {delete s[S.houseOverrideSet];});
  assert.deepEqual([said(unscripted.reading), unscripted.action], [HOUSE_RUNNING, null]);
});

test('the house carries its own humidity flag, and Away with no end reads Away alone', () => {
  const states = fixture('house_running');
  states[HOUSE.humidity] = {...states[HOUSE.humidity], state: '65'};
  const {house} = page(states);
  assert.equal(said(house.reading), '19.6° [Humid] Warming · 20° until 22:00, then 18° (19.6 → 20)');
  assert.equal(house.note, 'Measured in the living room, 65% humidity. Outside 6.5°.');
  assert.deepEqual(detail(states, 'house').body.facts[0], {icon: 'droplet', text: '65%', flag: 'Humid', ariaLabel: '65% humidity'});
  const endless = fixture('house_away'); endless[HOUSE_KEY].attributes.away_until = null;
  const away = page(endless).house;
  assert.deepEqual([said(away.reading), away.action.label, away.quiet], ['19.6° Away (19.6 → 10)', 'Cancel Away', true]);
});

test('each bar is named in words: its reading and its target, or why it has none', () => {
  const bar = (id, pick = v => v.house) => pick(page(fixture(id))).reading.bar.ariaLabel;
  assert.equal(bar('house_running'), '19.6°, target 20°');
  assert.equal(bar('house_override'), '19.6°, target 21.5°');
  assert.equal(bar('house_off'), '19.6°, no target while the heating is off');
  assert.equal(bar('house_away'), '19.6°, target 10°');
  assert.equal(bar('house_unknown'), '19.6°, target unknown');
  assert.equal(bar('sensors_unavailable'), 'No reading');
  assert.deepEqual(page(fixture('sensors_unavailable')).zones.map(z => z.reading.bar.ariaLabel), ['No reading', 'No reading', 'No reading', 'No reading']);
  assert.equal(bar('house_off', v => v.zones[0]), '19.8°, target 21°', 'a zone keeps its target while the house heating is off');
  const blind = fixture('house_running'); blind[zoneOf('bedroom-suite').temperature].state = 'unavailable';
  assert.equal(page(blind).zones[3].reading.bar.ariaLabel, 'No reading, target 17°');
});

test('— is never 0: a missing reading is a dash, with no dot on its bar, and a missing fact is left out', () => {
  for (const f of CLIMATE_FIXTURES) {
    const value = page(f.states), sheets = CLIMATE_DETAILS.map(d => detail(f.states, d.id));
    for (const r of [value.house.reading, ...value.zones.map(z => z.reading), ...sheets.map(d => d.body.reading).filter(Boolean)]) {
      assert.equal(r.reading === '—', r.bar.plot.reading === null, `${f.id}: ${r.reading}`);
      assert.doesNotMatch(`${r.reading} ${r.line} ${r.bar.ariaLabel}`, ZERO, f.id);
    }
    for (const line of [...words(value), ...sheets.flatMap(d => words(d))]) assert.doesNotMatch(line, ZERO, `${f.id}: ${line}`);
  }
  const gone = page(fixture('sensors_unavailable'));
  assert.equal(gone.house.note, 'Measured in the living room. Maison can’t change the thermostat right now.', 'no “Outside —.”');
  assert.deepEqual(gone.rails.rows.map(r => r.line), ['Unavailable', 'Unavailable']);
});

test('each zone is pressed with its link, named with what its row shows, the flag last', () => {
  // The same sheet as its row says it: named in the page's words, so it
  // never says the heating is off while the line says the zone won't warm.
  assert.deepEqual(page(fixture('zone_override')).zones.map(z => z.link.ariaLabel), ['Attic: 19.8°, won’t warm, override 22° until 18:00. Open Attic',
    'Sam’s office: 19.2°, won’t warm, 20° until 18:00, then 18°. Open Sam’s office', 'Noah’s room: 20.1°, at target, always 20°. Open Noah’s room',
    'Bedroom suite: 16.8°, at target, always 17°. Open Bedroom suite']);
  assert.deepEqual(page(fixture('sensors_unavailable')).zones[0].link.ariaLabel, 'Attic: no reading or target. Open Attic');
  assert.equal(page(fixture('dry_humid')).zones[0].link.ariaLabel, 'Attic: 19.8°, warming, 21° until 18:00, then 16°, Dry air. Open Attic');
  for (const f of CLIMATE_FIXTURES) for (const z of page(f.states).zones) {
    assert.deepEqual([...intentOf(z.link), z.link.enabled], ['detail', z.id, true], `${f.id} ${z.id}`);
    assert.match(z.link.ariaLabel, new RegExp(`^${z.opener.name}: .*Open ${z.opener.name}$`), `${f.id} ${z.id}`);
    assert.equal(z.link.ariaLabel.includes(`, ${z.reading.flag}. Open`), z.reading.flag !== null, `${f.id} ${z.id}`);
    assert.doesNotMatch(z.link.ariaLabel, /\boff\b/i, `${f.id} ${z.id}`);
    const {icon, name} = zoneOf(z.id);
    assert.deepEqual(z.opener, {icon, name}, `${f.id} ${z.id}: the row's glyph and name`);
  }
});

// ---- The House card --------------------------------------------------------------------
test('the House card: its title and Details, its caption, and one action per state', () => {
  const FACTS = 'Measured in the living room, 48% humidity. Outside 6.5°.';
  const SET = ['Set an override…', 'detail', 'house'];
  const expected = {
    house_running: [SET, FACTS],
    house_override: [['Cancel override', 'house-override-cancel', 'house'], FACTS],
    house_manual: [SET, FACTS],
    house_off: [SET, `${FACTS} Overrides wait until the heating is switched back on.`],
    // Towels are the rails' to say, beside their buttons.
    house_away: [['Cancel Away', 'house-away-cancel', 'house'], `${FACTS} The Airco neither heats nor cools.`],
    house_unknown: [null, `${FACTS} Maison can’t change the thermostat right now.`],
    zone_override: [SET, FACTS],
    airco_heating: [SET, FACTS],
    dry_humid: [SET, 'Measured in the living room, 60% humidity. Outside 6.5°.'],
    sensors_unavailable: [null, 'Measured in the living room. Maison can’t change the thermostat right now.'],
    contract_missing: [null, FACTS],
  };
  for (const f of CLIMATE_FIXTURES) {
    const {house} = page(f.states), {action} = house;
    assert.deepEqual([action && [action.label, ...intentOf(action)], house.note], expected[f.id], f.id);
    assert.deepEqual([house.title, house.icon], ['House heating', 'home'], f.id);
    // Quiet while nothing runs or no target shows: off, Away, unknown, not set up.
    assert.equal(house.quiet, ['house_off', 'house_away', 'house_unknown', 'sensors_unavailable', 'contract_missing'].includes(f.id), f.id);
    assert.deepEqual(house.details, {intent: {command: 'detail', entity: 'house'}, label: 'Details', ariaLabel: 'House heating details', enabled: true}, f.id);
    // A Cancel is the house control's own, press for press; "Set an override…"
    // only opens the sheet, where the override is set.
    if (action?.intent.command === 'detail') {
      assert.deepEqual(action, {intent: {command: 'detail', entity: 'house'}, label: 'Set an override…', ariaLabel: 'Set an override on the house heating', enabled: true}, f.id);
    }
    else if (action) assert.deepEqual(action, detail(f.states, 'house').body.control.cancel, f.id);
  }
  // The clock too far out: overrides can't be set yet, but the sheet says why.
  const clock = fixture('house_running'); clock[HOUSE_KEY].attributes.clock_offset_s = 900;
  assert.deepEqual(intentOf(page(clock).house.action), ['detail', 'house']);
  // An override set while the heating is off can be cancelled from the card.
  const waiting = fixture('house_off');
  Object.assign(waiting[HOUSE_KEY].attributes, {override_until: '2026-10-14T12:30:00+02:00', override_temperature: 21.5});
  const off = page(waiting).house;
  assert.deepEqual([off.reading.line, off.action.label], ['Switched off on the thermostat', 'Cancel override']);
  assert.deepEqual(off.action, detail(waiting, 'house').body.control.cancel);
});

test('the House card’s action waits with its control, and Set an override… and Details open the sheet whatever the connection', () => {
  const held = page(fixture('house_override'), {busy: new Set([HOUSE_KEY])}).house.action;
  assert.deepEqual([held.enabled, held.busy, held.busyLabel], [false, true, 'In progress']);
  for (const extra of [{online: false}, {busy: new Set([HOUSE_KEY])}]) {
    const {house, rails} = page(fixture('house_running'), extra);
    assert.deepEqual([house.action.enabled, house.details.enabled, rails.details.enabled], [true, true, true]);
  }
  assert.equal(page(fixture('house_away'), {online: false}).house.action.enabled, false, 'Cancel Away is a write');
});

test('the House card’s feedback is its control’s line, and nothing while there is none', () => {
  const line = 'House heating 21° until 22:00: waiting for the thermostat, which can take a minute or two';
  for (const f of CLIMATE_FIXTURES) {
    const feedback = new Map([[HOUSE_KEY, line]]), quiet = page(f.states), told = page(f.states, {feedback}), control = detail(f.states, 'house', {feedback}).body.control;
    assert.equal(quiet.house.feedback, '', f.id);
    // A thermostat not set up has no control to report on.
    assert.equal(told.house.feedback, control.kind === 'missing' ? '' : line, f.id);
    assert.equal(told.house.feedback, control.feedback ?? '', f.id);
  }
});

// ---- The towel rails -------------------------------------------------------------------
test('each rail reads in one line short enough for a phone’s row, its feedback in its place while there is one', () => {
  const OFF = ['Off · rail 21.4°', 'Off · rail 21.4°'];
  const expected = {house_running: OFF, house_override: ['Drying until 10:15', 'Off · rail 21.4°'], house_manual: OFF, house_off: OFF,
    // Away is said beside where Dry towels would be, at every width.
    house_away: ['Off while Away', 'Off while Away'], house_unknown: OFF, zone_override: OFF, airco_heating: OFF, dry_humid: OFF,
    sensors_unavailable: ['Unavailable', 'Unavailable'], contract_missing: ['Off · drying not set up yet', 'Off · drying not set up yet']};
  for (const f of CLIMATE_FIXTURES) {
    const {rails} = page(f.states);
    assert.deepEqual(rails.rows.map(r => r.line), expected[f.id], f.id);
    assert.deepEqual([rails.icon, ...rails.rows.map(r => r.icon)], ['bath', 'bath', 'bath'], f.id);
    assert.deepEqual(rails.details, {intent: {command: 'detail', entity: 'towel-rails'}, label: 'Details', ariaLabel: 'Towel rails details', enabled: true}, f.id);
    // The sheet's rows are the page's.
    assert.deepEqual(detail(f.states, 'towel-rails').body.rows, rails.rows, f.id);
  }
  // The other branches: a rail set by hand, a setting unknown, a probe with
  // no reading, and Drying with no end.
  const rail = (changes, i = 1) => {const states = fixture('house_running'); changes(states); return page(states).rails.rows[i].line;};
  const bathroom = TOWEL_RAILS[1];
  assert.equal(rail(s => {s[bathroom.valve].attributes.temperature = 22;}), 'Set to 22° · rail 21.4°');
  assert.equal(rail(s => {s[bathroom.valve].attributes.temperature = null;}), 'Setting unknown · rail 21.4°');
  assert.equal(rail(s => {s[bathroom.probe].state = 'unavailable';}), 'Off');
  assert.equal(rail(s => {s[bathroom.drying] = {...s[bathroom.drying], state: 'on', attributes: {until: null}};}), 'Drying');
  const told = page(fixture('house_override'), {feedback: new Map([[TOWEL_RAILS[0].drying, 'Ensuite towel rail stopped: confirmed']])}).rails.rows;
  assert.deepEqual(told.map(r => r.line), ['Ensuite towel rail stopped: confirmed', 'Off · rail 21.4°']);
});

test('a rail’s accessory is Dry towels or Stop, but none while Away or unavailable, which its line says; offline and busy keep it', () => {
  const actions = (id, extra) => page(fixture(id), extra).rails.rows.map(r => r.action === null ? null : [r.action.label, r.action.enabled]);
  assert.deepEqual(actions('house_running'), [['Dry towels', true], ['Dry towels', true]]);
  assert.deepEqual(actions('house_override'), [['Stop', true], ['Dry towels', true]]);
  assert.deepEqual(actions('house_away'), [null, null], 'Away: the line says why');
  assert.deepEqual(actions('sensors_unavailable'), [null, null], 'unavailable: the line says so');
  assert.deepEqual(actions('contract_missing'), [null, null], 'never set up: no control at all');
  assert.deepEqual(actions('house_running', {online: false}), [['Dry towels', false], ['Dry towels', false]], 'offline: disabled, in place');
  assert.deepEqual(actions('house_override', {busy: new Set([TOWEL_RAILS[0].drying])}), [['Stop', false], ['Dry towels', true]], 'busy: its own, in place');
  // Drying while Away keeps its Stop.
  const away = fixture('house_away'), ensuite = TOWEL_RAILS[0];
  away[ensuite.drying] = {...away[ensuite.drying], state: 'on', attributes: {until: '2026-10-14T10:15:00+02:00'}};
  assert.deepEqual(page(away).rails.rows.map(r => [r.line, r.action?.label ?? null]), [['Drying until 10:15', 'Stop'], ['Off while Away', null]]);
  // The sheet's rows carry the same.
  assert.deepEqual(detail(fixture('house_away'), 'towel-rails').body.rows.map(r => r.action), [null, null]);
});

test('the rails’ captions: on the page what Dry towels does or that the heating is off, but none while Away; in the sheet what sets them and what each reading is', () => {
  const SENSOR = ' There is no room sensor here: each reading is the rail’s own.', OFF = 'Heating is switched off on the thermostat, so the rails won’t warm.';
  const RUNNING = 'Dry towels opens a rail for an hour, then it goes back to frost protection; nothing else sets the rails. A rail only warms while the house heating runs.';
  const expected = {house_off: [OFF, `${OFF} Only Drying and frost protection set them.${SENSOR}`],
    house_away: [null, `The rails stay at frost protection until Away ends.${SENSOR}`],
    house_running: ['Dry towels opens a rail for an hour, then it goes back to frost protection. A rail only warms while the house heating runs.', `${RUNNING}${SENSOR}`]};
  for (const [id, [onPage, inSheet]] of Object.entries(expected)) {
    assert.deepEqual([page(fixture(id)).rails.caption, detail(fixture(id), 'towel-rails').body.caption], [onPage, inSheet], id);
  }
});

// ---- The sheets ------------------------------------------------------------------------
test('each sheet carries the page’s reading and its own headings', () => {
  for (const f of CLIMATE_FIXTURES) for (const extra of [{}, {online: false}, {busy: new Set([HOUSE_KEY])}]) {
    const value = page(f.states, extra), house = detail(f.states, 'house', extra).body;
    assert.deepEqual(house.reading, value.house.reading, f.id);
    assert.deepEqual(house.titles, {temperature: 'Temperature', ends: 'Ends', why: 'Why'}, f.id);
    for (const z of value.zones) {
      const body = detail(f.states, z.id, extra).body;
      assert.deepEqual(body.reading, z.reading, `${f.id} ${z.id}`);
      // What its three texts are about, and none of them begins with it.
      assert.deepEqual(body.titles, {target: 'Target', warm: 'Radiator heat'}, `${f.id} ${z.id}`);
      for (const text of [body.warm?.text, body.warning].filter(Boolean)) assert.ok(!text.toLowerCase().startsWith(body.titles.warm.toLowerCase()), text);
    }
    assert.equal(detail(f.states, 'towel-rails', extra).body.titles, undefined, 'the rails sheet has no headings of its own');
  }
});

test('a sheet’s summary facts have readings and names, and the House sheet says Outside once, in its own section', () => {
  const facts = (id, at) => detail(fixture(id), at).body.facts.map(f => [f.icon, f.text, f.flag, f.ariaLabel]);
  const LIVING = [null, 'Living room sensor', null, 'Measured by the living room sensor'];
  assert.deepEqual(facts('house_running', 'house'), [['droplet', '48%', null, '48% humidity'], LIVING]);
  assert.deepEqual(facts('dry_humid', 'attic'), [['droplet', '35%', 'Dry air', '35% humidity'], [null, 'Office sensor', null, 'Measured by the office sensor']]);
  assert.deepEqual(facts('sensors_unavailable', 'house'), [LIVING], 'no humidity, no “—”');
  for (const f of CLIMATE_FIXTURES) for (const d of CLIMATE_DETAILS.filter(d => d.id !== 'towel-rails')) {
    const body = detail(f.states, d.id).body;
    for (const fact of body.facts) {
      assert.doesNotMatch(fact.text, /—/, `${f.id} ${d.id}`);
      assert.ok(fact.ariaLabel.length > fact.text.length, `${f.id} ${d.id}: ${fact.ariaLabel}`);
    }
    assert.ok(!body.facts.some(fact => /Outside/.test(fact.text)), `${f.id} ${d.id}: Outside has its own section`);
  }
  assert.deepEqual(detail(fixture('house_running'), 'house').body.outdoor,
    {title: 'Outside', text: '6.5° from the boiler’s own sensor, on the north wall and always in shade.'});
  assert.equal(detail(fixture('sensors_unavailable'), 'house').body.outdoor, null, 'no section without a reading');
});

test('an Away time outside the field’s range says why Set Away waits', () => {
  const away = awayUntil => detail(fixture('house_running'), 'house', {draft: {awayUntil}}).body.control.away;
  // The field's own bounds: 90 days on is 08:30 in winter time.
  const RANGE = 'Heating can come back on from 09:35 to 12 Jan 08:30.';
  assert.deepEqual([away('').field.min, away('').field.max], ['2026-10-14T09:35', '2027-01-12T08:30']);
  for (const [value, warning, enabled] of [['', null, false], ['2026-10-18T15:00', null, true], ['2026-09-01T10:00', RANGE, false], ['2027-06-01T10:00', RANGE, false]]) {
    const a = away(value);
    assert.deepEqual([a.warning, a.set.enabled], [warning, enabled], value || 'none chosen');
  }
});

test('the House override’s footer speaks only while an override runs', () => {
  const footer = id => {const c = detail(fixture(id), 'house').body.control; return c.kind === 'override' ? c.footer : undefined;};
  assert.equal(footer('house_override'), 'Replaces the running override');
  for (const id of ['house_running', 'house_manual', 'house_off', 'zone_override']) assert.equal(footer(id), null, id);
  for (const id of ['house_away', 'house_unknown', 'contract_missing']) assert.equal(footer(id), undefined, `${id}: no override to set`);
});

test('a zone sheet says its target and its schedule once: the row says what a step does, the caption only what the line doesn’t', () => {
  const body = (id, at, changes = () => {}) => {const states = fixture(id); changes(states); return detail(states, at).body;};
  const row = b => [b.control.title, b.control.line];
  assert.deepEqual(row(body('house_running', 'attic')), ['Target now', 'Changing it overrides until 18:00']);
  assert.deepEqual(row(body('zone_override', 'attic')), ['Override', 'Ends by itself at 18:00']);
  assert.deepEqual(row(body('house_running', 'noah')), ['Fixed target', 'Stays until you change it']);
  assert.deepEqual(row(body('contract_missing', 'attic')), ['Override', 'Not set up yet']);
  const schedule = (id, at, changes) => {const sc = body(id, at, changes).schedule; return [sc.caption, sc.note, sc.comfort.line, sc.setback.line];};
  const NOTE = 'Changing comfort or setback is not an override.';
  assert.deepEqual(schedule('house_running', 'attic'), [null, NOTE, null, null], 'the line already says comfort until 18:00, then 16°');
  assert.deepEqual(schedule('zone_override', 'attic'), ['An override holds the zone until 18:00.', NOTE, null, null]);
  assert.deepEqual(schedule('zone_override', 'attic', s => {s[zoneOf('attic').target].attributes.override_until = null;}),
    ['An override holds the zone until 18:00.', NOTE, null, null], 'with no end of its own, the next change');
  assert.deepEqual(schedule('house_running', 'attic', s => {s[zoneOf('attic').schedule].state = 'unavailable';}),
    ['The schedule has no current reading.', NOTE, null, null]);
  assert.deepEqual(schedule('contract_missing', 'sam'), ['This zone’s schedule isn’t set up in Home Assistant yet.', null, 'Not set up yet', 'Not set up yet']);
  assert.deepEqual(schedule('house_running', 'sam', s => {delete s[CLIMATE_CONTRACT.samSetback];}), [null, NOTE, null, 'Not set up yet']);
});

test('an unavailable Airco switch says only that, never that it is off', () => {
  const lines = id => {const {heating, cooling} = detail(fixture(id), 'attic').body.airco; return [heating, cooling].map(s => [s.line, s.note]);};
  assert.deepEqual(lines('sensors_unavailable'), [[null, 'Unavailable'], [null, 'Unavailable']]);
  assert.deepEqual(lines('house_running'), [['The Airco heats the Attic when a kWh of heat costs less from it than from the boiler', ''],
    ['Cools to 23° when the attic passes 24° on hot days', '']]);
  assert.deepEqual(lines('house_away'), [['Paused while Away', ''], ['Paused while Away', '']]);
});

test('a radiators section is headed only over more than one row, which then name themselves', () => {
  const states = fixture('house_running'), heading = id => {const r = detail(states, id).body.radiators; return [r.heading, r.rows.map(row => row.name)];};
  assert.deepEqual(heading('house'), ['Downstairs radiators', ['Living room radiator', 'Kitchen radiator']]);
  assert.deepEqual(heading('attic'), ['Radiators', ['Office radiator', 'Playground radiator']]);
  for (const id of ['sam', 'noah', 'bedroom-suite']) {
    const [title, rows] = heading(id);
    assert.deepEqual([title, rows.length], [null, 1], id);
  }
});

test('each Full history is named after its chart, so a sheet’s are told apart; the charts say Now and what they show', () => {
  const names = {house: [['Full history: temperature', 'Temperature over the last 24 hours', ['room']], ['Full history: humidity', 'Humidity over the last 24 hours', ['humidity']]],
    attic: [['Full history: temperature and target', 'Temperature and target over the last 24 hours', ['room', 'target']], ['Full history: humidity', 'Humidity over the last 24 hours', ['humidity']]],
    'towel-rails': [['Full history: valve probes', 'Valve probes over the last 24 hours', ['probe', 'probe']]]};
  const states = fixture('house_running');
  for (const [id, want] of Object.entries(names)) {
    const charts = detail(states, id).body.charts;
    assert.deepEqual(charts.map(c => [c.full.ariaLabel, c.model.imageLabel, c.model.series.map(s => s.role)]), want, id);
    for (const c of charts) {
      assert.equal(c.model.nowLabel, 'Now');
      assert.ok(c.full.ariaLabel.startsWith(c.model.fullLabel), 'the name begins with the visible label');
      assert.deepEqual(Object.keys(c.full).sort(), ['ariaLabel', 'enabled', 'intent'], 'no visible label: the chart draws its own');
      assert.doesNotMatch(c.model.imageLabel, /arrow|key/i);
    }
  }
  for (const f of CLIMATE_FIXTURES) for (const d of CLIMATE_DETAILS) {
    const labels = detail(f.states, d.id).body.charts.map(c => c.full.ariaLabel);
    assert.equal(new Set(labels).size, labels.length, `${f.id} ${d.id}: ${labels.join(', ')}`);
  }
  // A chart whose definition says nothing of its series has no roles.
  const plain = prepareHistoryChart({definition: {key: 'k', ids: ['sensor.a'], labels: ['A'], title: 'Grid'}, now: 0});
  assert.deepEqual([plain.series[0].role, plain.nowLabel, plain.imageLabel], [null, 'Now', 'Grid over the last 24 hours']);
});

// ---- The legend and the widgets ----------------------------------------------------------
test('the scale legend reads the capsules’ room scale, and from 700px every row of widgets fills', () => {
  for (const f of CLIMATE_FIXTURES) {
    const value = page(f.states);
    assert.deepEqual(value.scale, {low: '14°', high: '26°', target: 'Target', plot: {min: 14, max: 26}}, f.id);
    assert.deepEqual(value.widgets, [{id: 'house', size: 'medium'}, ...ZONES.map(z => ({id: z.id, size: 'small'})), {id: 'rails', size: 'medium'}], f.id);
    for (const columns of Object.values(COLUMNS)) assert.deepEqual(placeWidgets(value.widgets, columns).holes, [], `${f.id} at ${columns} columns`);
  }
  // On a desktop: House, Attic, Sam’s office, then Noah’s room, Bedroom suite, the rails.
  assert.deepEqual(placeWidgets(page(fixture('house_running')).widgets, COLUMNS.desktop).placements.map(p => `${p.id} r${p.row} c${p.column}`),
    ['house r1 c1', 'attic r1 c3', 'sam r1 c4', 'noah r2 c1', 'bedroom-suite r2 c2', 'rails r2 c3']);
});

// ---- Words -------------------------------------------------------------------------------
// Every word the page draws.
const readingWords = r => [r.reading, r.line, r.flag];
const pageWords = v => [v.scale.low, v.scale.high, v.scale.target, v.house.title, v.house.details.label, ...readingWords(v.house.reading), v.house.note,
  v.house.action?.label, v.house.feedback, v.zonesTitle, ...v.zones.flatMap(z => [z.opener.name, ...readingWords(z.reading)]),
  v.railsTitle, v.rails.details.label, ...v.rails.rows.flatMap(r => [r.name, r.line, r.action?.label]), v.rails.caption];
// Every word each sheet draws, but the Airco's source line, which words()
// reads as one, and its charts', whose model is the chart's to draw.
const rows = body => body.rows.flatMap(r => [r.name, r.line, r.action?.label]);
const radiators = body => [body.radiators.heading, ...body.radiators.rows.flatMap(r => [r.name, r.line, r.probe, r.probeCaption])];
const houseControl = c => c.kind === 'override' ? [c.step.title, c.step.stepper?.output, c.footer, c.clockWarning, c.offWarning,
  c.start.label, c.cancel?.label, ...c.ends.map(e => e.label), c.away.summary, c.away.text, c.away.field.label, c.away.hint, c.away.warning, c.away.set.label]
  : c.kind === 'away' ? [c.title, c.text, c.cancel.label] : c.kind === 'unknown' ? [c.text] : [c.step.title, c.step.detail];
const airco = a => a ? [a.title, ...[a.heating, a.cooling].flatMap(s => s?.kind === 'switch' ? [s.title, s.line, s.note] : s ? [s.step.title, s.step.detail] : []), a.link.label] : [];
const schedule = sc => sc ? [sc.title, sc.today?.name, sc.today?.plan, sc.caption, sc.note, ...[sc.comfort, sc.setback].flatMap(h => [h.step.title, h.line, h.step.stepper.output]), sc.link?.label] : [];
const sheetWords = body => body.kind === 'rails' ? [...rows(body), body.caption]
  : body.kind === 'house' ? [...readingWords(body.reading), ...body.facts.flatMap(f => [f.text, f.flag]), ...houseControl(body.control), ...Object.values(body.titles),
    ...body.why, body.week.title, body.week.text, body.week.note, ...(body.week.days ?? []).flatMap(d => [d.name, d.today, d.plan]), body.outdoor?.title, body.outdoor?.text, ...radiators(body)]
  : [...readingWords(body.reading), ...body.facts.flatMap(f => [f.text, f.flag]), ...Object.values(body.titles), body.control.title, body.control.line,
    body.control.cancel?.label, body.warm?.text, body.warm?.warm?.label, body.warm?.note, body.warning, ...schedule(body.schedule), ...airco(body.airco), ...radiators(body)];
// A string under a key words() skips is a token (an id, an icon, a kind, a
// size) or the Away field's bounds, never words; a chart's whole model is
// the chart's to draw.
const TOKEN = /^(?:[a-z][a-z0-9_.-]*|\d{4}-\d\d-\d\dT\d\d:\d\d)$/;
function structural(value, found = []) {
  const skipped = new Set(['id', 'kind', 'key', 'icon', 'tone', 'width', 'min', 'max', 'plot', 'size']);
  const leaves = node => typeof node === 'string' ? [node] : node && typeof node === 'object' ? Object.values(node).flatMap(leaves) : [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'model') continue;
      if (skipped.has(key)) found.push(...leaves(child).map(text => [key, text])); else walk(child);
    }
  };
  walk(value);
  return found;
}

test('every word Maison draws is one words() reads, and nothing drawn sits under a key it skips', () => {
  for (const f of CLIMATE_FIXTURES) for (const extra of [{}, {feedback: new Map([[HOUSE_KEY, 'House heating override cancelled: confirmed by the thermostat']])}]) {
    const value = page(f.states, extra), said = words(value);
    for (const text of pageWords(value).filter(Boolean)) assert.ok(said.includes(text), `${f.id}, the page: ${text}`);
    for (const d of CLIMATE_DETAILS) {
      const drawer = detail(f.states, d.id, extra), inSheet = words(drawer);
      for (const text of sheetWords(drawer.body).filter(Boolean)) assert.ok(inSheet.includes(text), `${f.id}, ${d.id}: ${text}`);
      for (const [key, text] of structural(drawer)) assert.match(text, TOKEN, `${f.id}, ${d.id}: ${key} holds “${text}”`);
    }
    for (const [key, text] of structural(value)) assert.match(text, TOKEN, `${f.id}, the page: ${key} holds “${text}”`);
    // Every icon the page names is one Maison has.
    for (const icon of [value.house.icon, ...value.rails.rows.map(r => r.icon)]) assert.ok(iconNames.includes(icon), icon);
  }
  // The bars' plots and the legend's are numbers, never words.
  const value = page(fixture('house_running'));
  assert.deepEqual(words([value.scale.plot, value.house.reading.bar.plot, value.widgets]), []);
  assert.ok(!words(value).some(line => /^\d+(\.\d)?$/.test(line)), 'no bare number is drawn as words');
});

test('the page links to each sheet it names, and writes only through the House card’s one action and the rails', () => {
  for (const f of CLIMATE_FIXTURES) {
    const value = page(f.states);
    const shown = controls({house: {details: value.house.details, action: value.house.action}, zones: value.zones.map(z => z.link), rails: value.rails});
    const writes = shown.filter(c => !['detail', 'more', 'native-history'].includes(c.command)).map(c => c.command);
    assert.ok(writes.every(command => ['house-override-cancel', 'house-away-cancel', 'drying-start', 'drying-stop'].includes(command)), `${f.id}: ${writes.join(', ')}`);
    const opened = new Set(shown.filter(c => c.command === 'detail').map(c => c.entity));
    assert.deepEqual([...opened].sort(), ['attic', 'bedroom-suite', 'house', 'noah', 'sam', 'towel-rails'], f.id);
  }
});
