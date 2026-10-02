import test from 'node:test';
import assert from 'node:assert/strict';
import {E, ZONES, TOWEL_RAILS, CLIMATE_CONTRACT} from '../config/www/maison/model.js';
import {guard, helperTarget, climateIds, toggleIds, WRITE_COMMANDS} from '../config/www/maison/guard.js';
import {expectedOutcome} from '../config/www/maison/actions.js';
import {climateRequest, warmOffer} from '../config/www/maison/climate.js';
import {carControls, carStatus} from '../config/www/maison/car.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
const registered = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {get: key => registered.get(key), define: (key, value) => registered.set(key, value)};
globalThis.window = {customCards: []};
await import('../config/www/maison/maison-dashboard.js');
const Maison = registered.get('maison-dashboard');

const S = CLIMATE_CONTRACT.scripts, HOUSE_KEY = CLIMATE_CONTRACT.houseHeating;
const state = (value, attributes = {}) => ({state: String(value), attributes});
const climateStates = id => structuredClone(CLIMATE_FIXTURES.find(f => f.id === id).states);
// Every Car fixture has the charging scripts, as Home Assistant does.
const carStates = id => structuredClone(CAR_FIXTURES.find(f => f.id === id).states);
const climate = (id, overrides = {}) => fixtureSnapshot({states: climateStates(id), ...overrides});
const car = (id, edit = () => {}) => {const states = carStates(id); edit(states); return fixtureSnapshot({states, now: CAR_NOW});};
const g = (snap, command, entity = '', extra = {}) => guard({command, entity, ...extra}, snap);
const edit = (id, fn) => {const states = climateStates(id); fn(states); return fixtureSnapshot({states});};
// A request's options minus its confirmation predicate, which is rebuilt on every call.
const plainOptions = options => ({...options, expected: typeof options.expected});
const WRITES = [...WRITE_COMMANDS];
const NAVIGATION = ['navigate', 'detail', 'more', 'alerts', 'native-calendar', 'native-history', 'agenda-event', 'ha-energy', 'ha-settings', 'close', 'sensor-more'];

// ---- Allowlists and helper targets -----------------------------------------
test('Maison writes only the fixed zones\' valves, and never a mode', () => {
  assert.deepEqual([...climateIds].sort(), ['climate.bedroom_trv', 'climate.noahs_room_trv']);
  for (const id of ['climate.office_trv', 'climate.playground_trv', 'climate.sams_office_trv', 'climate.living_room_trv', 'climate.kitchen_trv', 'climate.ensuite_trv', 'climate.bathroom_trv', 'climate.ec3a56bc6527']) assert.ok(!climateIds.has(id), id);
  assert.equal(expectedOutcome('climate', 'set_hvac_mode', {hvac_mode: 'heat'}), null);
  const expected = expectedOutcome('climate', 'set_temperature', {temperature: 17.5});
  assert.equal(expected({state: 'heat', attributes: {temperature: 17}}), false); assert.equal(expected({state: 'heat', attributes: {temperature: 17.5}}), true);
});
test('helper targets quantize to installed limits and reject unreadable controls', () => {
  const helper = {state: '21', attributes: {min: 16, max: 24, step: .5}};
  assert.equal(helperTarget(helper, 21.2), 21); assert.equal(helperTarget(helper, 30), 24);
  assert.equal(helperTarget(helper, 15), 16); assert.equal(helperTarget(helper, NaN), null);
  assert.equal(helperTarget({...helper, state: 'unavailable'}, 22), null);
  assert.equal(helperTarget({...helper, attributes: {min: 16, max: 24, step: 0}}, 22), null);
});

// ---- What guard refuses outright -------------------------------------------
test('guard decides the 20 write and draft commands and nothing else', () => {
  assert.equal(WRITE_COMMANDS.size, 20);
  assert.ok(Object.isFrozen(WRITE_COMMANDS));
  for (const command of NAVIGATION) assert.ok(!WRITE_COMMANDS.has(command), command);
});
test('unknown and navigation commands are null: only writes and drafts reach guard', () => {
  const snap = climate('house_running');
  // The shopping list and the players left with Life (v35).
  for (const command of [...NAVIGATION, 'brightness', 'scene', 'lights-off', 'climate-step', 'room', 'floor', 'house-reboot', 'vehicle',
    'shopping', 'media-toggle', 'media-volume', '', undefined]) {
    assert.equal(g(snap, command, 'attic', {direction: 1}), null, String(command));
  }
});
test('guard never throws and never reads the clock, whatever the snapshot or intent', () => {
  const realNow = Date.now;
  Date.now = () => {throw new Error('guard read the clock');};
  try {
    const snaps = [fixtureSnapshot(), fixtureSnapshot({states: {[HOUSE_KEY]: {state: 'schedule'}, [E.carLimit]: {state: '80'}, [E.carConnected]: {state: 'on'}}}), {}, {states: null}, null, undefined,
      ...CLIMATE_FIXTURES.map(f => climate(f.id)), ...CAR_FIXTURES.map(f => car(f.id))];
    const intents = command => [{command}, {command, entity: null, direction: 'x', value: {}}, {command, entity: 'attic', direction: 1, value: '50'}, {command, entity: E.carLimit, direction: -1},
      {command, entity: 'house', direction: '1'}, {command, entity: '1h'}, {command, entity: 'bathroom'}, {command, entity: 'start'}];
    for (const snap of snaps) for (const command of WRITES) for (const intent of intents(command)) {
      let result;
      assert.doesNotThrow(() => {result = guard(intent, snap);}, `${command} ${JSON.stringify(intent)}`);
      assert.ok(result === null || typeof result.key === 'string', command);
    }
    assert.equal(guard(null, null), null);
    assert.equal(guard(undefined, climate('house_running')), null);
  } finally {Date.now = realNow;}
  // A missing entity is null, never an action on nothing.
  for (const command of WRITES) for (const entity of ['', 'attic', 'house', E.carLimit, E.heatingAuto, 'start'])
    assert.equal(g(fixtureSnapshot(), command, entity, {direction: 1, value: 50}), null, `${command} ${entity}`);
});

// ---- Switches, helpers and valves ----------------------------------------
test('toggle: only the three allowlisted switches, and only while available', () => {
  const states = climateStates('house_running');
  states[E.carSmart] = state('off');
  for (const id of [E.carOverride, 'input_boolean.guest_mode', 'switch.airco', 'light.office']) states[id] = state('off');
  const snap = fixtureSnapshot({states});
  assert.deepEqual(g(snap, 'toggle', CLIMATE_CONTRACT.aircoCooling), {key: CLIMATE_CONTRACT.aircoCooling,
    call: {domain: 'input_boolean', service: 'turn_off', entity: CLIMATE_CONTRACT.aircoCooling, data: {}, options: {}}});
  assert.equal(g(snap, 'toggle', E.carSmart).call.service, 'turn_on');
  for (const id of [E.carOverride, 'input_boolean.guest_mode', 'switch.airco', 'light.office', 'climate.office_trv']) assert.equal(g(snap, 'toggle', id), null, id);
  // An unavailable switch has no state to flip: its card disables it, and the press is refused.
  states[E.heatingAuto] = state('unavailable');
  assert.equal(g(fixtureSnapshot({states}), 'toggle', E.heatingAuto), null);
  assert.equal(g(fixtureSnapshot({states}), 'toggle', CLIMATE_CONTRACT.samComfort), null);
});
test('step: the Attic’s and Sam’s comfort and setback, one helper step, refused at min and max', () => {
  const snap = climate('house_running');
  assert.deepEqual(g(snap, 'step', E.atticComfort, {direction: 1}), {key: E.atticComfort,
    call: {domain: 'input_number', service: 'set_value', entity: E.atticComfort, data: {value: 21.5}, options: {}}});
  assert.equal(g(snap, 'step', CLIMATE_CONTRACT.samSetback, {direction: '-1'}).call.data.value, 17.5, 'a dataset string is coerced');
  for (const id of [CLIMATE_CONTRACT.atticOverride, 'input_number.guest_temperature']) assert.equal(g(snap, 'step', id, {direction: 1}), null, id);
  for (const direction of [0, 2, undefined, 'up']) assert.equal(g(snap, 'step', E.atticComfort, {direction}), null, String(direction));
  // At the helper's min or max a step would change nothing: the card disables it, and the press is refused.
  const top = edit('house_running', s => {s[E.atticComfort].state = '24';});
  assert.equal(g(top, 'step', E.atticComfort, {direction: 1}), null, 'at the maximum');
  assert.equal(g(top, 'step', E.atticComfort, {direction: -1}).call.data.value, 23.5);
  const bottom = edit('house_running', s => {s[E.atticSetback].state = '12';});
  assert.equal(g(bottom, 'step', E.atticSetback, {direction: -1}), null, 'at the minimum');
  // Above the grid's last step, a step still clamps to the maximum.
  assert.equal(g(edit('house_running', s => {s[E.atticComfort].state = '23.8';}), 'step', E.atticComfort, {direction: 1}).call.data.value, 24);
  for (const broken of [s => {s[E.atticComfort].state = 'unavailable';}, s => {s[E.atticComfort].attributes.step = 0;}, s => {s[E.atticComfort].attributes.max = 10;}, s => {delete s[E.atticComfort].attributes.min;}])
    assert.equal(g(edit('house_running', broken), 'step', E.atticComfort, {direction: 1}), null);
});
test('zone-step: one valve step on the fixed zones only', () => {
  const snap = climate('house_running');
  assert.deepEqual(g(snap, 'zone-step', 'noah', {direction: 1}), {key: 'climate.noahs_room_trv',
    call: {domain: 'climate', service: 'set_temperature', entity: 'climate.noahs_room_trv', data: {temperature: 20.5}, options: {}}});
  assert.equal(g(snap, 'zone-step', 'bedroom-suite', {direction: '-1'}).call.data.temperature, 16.5);
  for (const id of ['attic', 'sam', 'house', 'towel-rails', 'hallway', 'climate.bedroom_trv', '']) assert.equal(g(snap, 'zone-step', id, {direction: 1}), null, id);
  assert.equal(g(snap, 'zone-step', 'noah', {direction: 2}), null);
  assert.equal(g(climate('sensors_unavailable'), 'zone-step', 'noah', {direction: 1}), null);
});

// ---- House heating ---------------------------------------------------------
test('the house draft changes only while the card draws it enabled', () => {
  const snap = climate('house_running');
  assert.deepEqual(g(snap, 'house-step', 'house', {direction: 1}), {key: HOUSE_KEY, draft: {house: {base: 20, temperature: 20.5}}});
  assert.deepEqual(g(climate('house_running', {draft: {house: {base: 20, temperature: 20.5}}}), 'house-step', 'house', {direction: '1'}).draft, {house: {base: 20, temperature: 21}});
  assert.equal(g(snap, 'house-step', 'house', {direction: 0}), null);
  assert.deepEqual(g(snap, 'house-end', '3h'), {key: HOUSE_KEY, draft: {houseEnd: '3h'}});
  assert.equal(g(snap, 'house-end', 'next').draft.houseEnd, 'next');
  assert.equal(g(snap, 'house-end', 'forever'), null, 'an unknown chip');
  assert.deepEqual(g(snap, 'away-until', 'house', {value: '2026-10-18T15:00'}), {key: HOUSE_KEY, draft: {awayUntil: '2026-10-18T15:00'}});
  assert.deepEqual(g(snap, 'away-until', 'house', {}).draft, {awayUntil: ''}, 'a cleared field clears the draft');
  // Maison can't set times on a thermostat whose clock is out, and the card draws none of these while the thermostat is Away,
  // unknown or missing: the draft doesn't change then.
  const closed = [edit('house_running', s => {s[HOUSE_KEY].attributes.clock_offset_s = 600;}), edit('house_running', s => {s[HOUSE_KEY].attributes.clock_offset_s = null;}),
    climate('house_away'), climate('house_unknown'), climate('contract_missing')];
  for (const c of closed) {
    assert.equal(g(c, 'house-step', 'house', {direction: 1}), null);
    assert.equal(g(c, 'house-end', '3h'), null);
    assert.equal(g(c, 'away-until', 'house', {value: '2026-10-18T15:00'}), null);
  }
});
test('house override and Away send their request as options and spend their draft', () => {
  const snap = climate('house_running', {draft: {house: {base: 20, temperature: 20.5}, houseEnd: '1h', awayUntil: '2026-10-18T15:00'}}), o = {now: snap.now, tz: snap.tz};
  const override = g(snap, 'house-override', 'house');
  const request = climateRequest('house-override', snap.states, {entity: 'house'}, {...o, draft: snap.draft});
  assert.deepEqual({...override, call: {...override.call, options: plainOptions(override.call.options)}},
    {key: HOUSE_KEY, call: {domain: 'script', service: 'turn_on', entity: S.houseOverrideSet, data: {variables: {temperature: 20.5, until: '2026-10-14T10:30:00+02:00'}}, options: plainOptions(request)}, draft: {house: null}});
  const away = g(snap, 'house-away', 'house');
  assert.deepEqual([away.key, away.call.entity, away.call.data, away.draft], [HOUSE_KEY, S.houseAwaySet, {variables: {until: '2026-10-18T15:00:00+02:00'}}, {awayUntil: ''}]);
  assert.equal(g(climate('house_running'), 'house-away', 'house'), null, 'no date, no Away');
  assert.equal(g(climate('house_away'), 'house-override', 'house'), null, 'no override while Away');
  assert.equal(g(climate('house_running'), 'house-override', 'house', {}).call.data.variables.until, '2026-10-14T22:00:16+02:00', 'the next change by default');
  const script = edit('house_running', s => {s[S.houseOverrideSet].state = 'unavailable';});
  assert.equal(g(script, 'house-override', 'house'), null, 'script unavailable');
});
test('house cancels only while the card draws the house controls', () => {
  assert.equal(g(climate('house_override'), 'house-override-cancel', 'house').call.entity, S.houseOverrideCancel);
  assert.equal(g(climate('house_away'), 'house-away-cancel', 'house').call.entity, S.houseAwayCancel);
  assert.equal(g(climate('house_running'), 'house-override-cancel', 'house'), null, 'nothing to cancel');
  assert.equal(g(climate('house_running'), 'house-away-cancel', 'house'), null);
  // Cancels need no clock: the card still draws them while the clock is out.
  assert.ok(g(edit('house_override', s => {s[HOUSE_KEY].attributes.clock_offset_s = null;}), 'house-override-cancel', 'house'));
  // With the other house script missing the card draws "Not set up yet" and no Cancel, so a cancel the request alone allows is refused.
  const override = edit('house_override', s => {delete s[S.houseAwaySet];}), away = edit('house_away', s => {delete s[S.houseOverrideSet];});
  assert.ok(climateRequest('house-override-cancel', override.states, {}, {}), 'the request alone allows it');
  assert.equal(g(override, 'house-override-cancel', 'house'), null);
  assert.ok(climateRequest('house-away-cancel', away.states, {}, {}));
  assert.equal(g(away, 'house-away-cancel', 'house'), null);
});
test('house-warm sends exactly the request the warm offer shows', () => {
  const snap = climate('zone_override'), o = {now: snap.now, tz: snap.tz};
  const a = g(snap, 'house-warm', 'attic'), offer = warmOffer('attic', snap.states, o);
  assert.equal(a.key, HOUSE_KEY);
  assert.deepEqual([a.call.entity, a.call.data, plainOptions(a.call.options)], [S.houseWarmUntil, {variables: {until: '2026-10-14T18:00:00+02:00'}}, plainOptions(offer.request)]);
  for (const id of ['house_running', 'house_away', 'house_off']) assert.equal(g(climate(id), 'house-warm', 'attic'), null, id);
});

// ---- Zones and towel rails ---------------------------------------------------
test('zone overrides are keyed by the zone’s target; Cancel only once the zone’s target and override script exist', () => {
  const up = g(climate('house_running'), 'zone-override', 'attic', {direction: 1});
  assert.deepEqual([up.key, up.call.entity, up.call.data], [ZONES[0].target, S.zoneOverride, {variables: {zone: 'attic', temperature: 21.5}}]);
  assert.equal(g(climate('house_running'), 'zone-override', 'sam', {direction: '-1'}).call.data.variables.temperature, 19.5);
  for (const id of ['noah', 'bedroom-suite', 'house', 'towel-rails', '']) assert.equal(g(climate('house_running'), 'zone-override', id, {direction: 1}), null, id);
  assert.equal(g(edit('house_running', s => {s[ZONES[0].target].state = '30';}), 'zone-override', 'attic', {direction: 1}), null, 'at the helper’s maximum');
  const cancel = g(climate('zone_override'), 'zone-override-cancel', 'attic');
  assert.deepEqual([cancel.key, cancel.call.entity, cancel.call.data], [ZONES[0].target, S.zoneOverrideCancel, {variables: {zone: 'attic'}}]);
  assert.equal(g(climate('house_running'), 'zone-override-cancel', 'attic'), null, 'no override to cancel');
  // Without the zone override script the card draws "Not set up yet" and no Cancel, so the cancel is refused.
  const noScript = edit('zone_override', s => {delete s[S.zoneOverride];});
  assert.ok(climateRequest('zone-override-cancel', noScript.states, {entity: 'attic'}, {}));
  assert.equal(g(noScript, 'zone-override-cancel', 'attic'), null);
});
test('Drying is keyed by the rail’s Drying sensor; offered only once both Drying scripts exist', () => {
  const bathroom = TOWEL_RAILS.find(r => r.id === 'bathroom'), ensuite = TOWEL_RAILS.find(r => r.id === 'ensuite');
  const start = g(climate('house_running'), 'drying-start', 'bathroom');
  assert.deepEqual([start.key, start.call.entity, start.call.data], [bathroom.drying, S.dryingStart, {variables: {rail: 'bathroom'}}]);
  const stop = g(climate('house_override'), 'drying-stop', 'ensuite');
  assert.deepEqual([stop.key, stop.call.entity], [ensuite.drying, S.dryingStop]);
  assert.equal(g(climate('house_away'), 'drying-start', 'bathroom'), null, 'never while Away');
  assert.equal(g(climate('house_running'), 'drying-stop', 'bathroom'), null, 'not drying');
  assert.equal(g(climate('house_running'), 'drying-start', 'hallway'), null);
  // With either Drying script missing the card says "Drying not set up yet" and offers neither, so both are refused.
  for (const [missing, command, fixture, rail] of [[S.dryingStop, 'drying-start', 'house_running', 'bathroom'], [S.dryingStart, 'drying-stop', 'house_override', 'ensuite']]) {
    const snap = edit(fixture, s => {delete s[missing];});
    assert.ok(climateRequest(command, snap.states, {entity: rail}, {}), command);
    assert.equal(g(snap, command, rail), null, command);
  }
});

// ---- Charging ------------------------------------------------------------------
test('Charge now: plugged in, not overriding, and refused at the charge limit', () => {
  assert.deepEqual(g(car('wait_offpeak'), 'charge-now', E.carNow), {key: E.carNow, call: {domain: 'script', service: 'turn_on', entity: E.carNow, data: {}, options: {}}});
  // At its charge limit there is nothing to charge, though the session allows commands.
  assert.equal(carControls(carStates('complete'), CAR_NOW).canCommand, true);
  assert.equal(g(car('complete'), 'charge-now', E.carNow), null);
  for (const id of ['charge_now', 'wait_offpeak_asleep', 'not_verified', 'stale', 'unplugged', 'other_vehicle', 'dropout', 'charger_offline']) assert.equal(g(car(id), 'charge-now', E.carNow), null, id);
});
test('a charging script Home Assistant doesn’t have, or can’t run, refuses its command', () => {
  for (const [command, script, fixture] of [['charge-now', E.carNow, 'wait_offpeak'], ['charge-automatic', E.carAutomatic, 'charge_now'], ['charge-refresh', E.carRefresh, 'stale']]) {
    assert.ok(g(car(fixture), command), command);
    assert.equal(g(car(fixture, s => {delete s[script];}), command), null, `${command} without ${script}`);
    assert.equal(g(car(fixture, s => {s[script].state = 'unavailable';}), command), null, `${command} with ${script} unavailable`);
    for (const other of [E.carNow, E.carAutomatic, E.carRefresh].filter(id => id !== script)) assert.ok(g(car(fixture, s => {delete s[other];}), command), `${command} needs only its own script`);
  }
});
test('Return to automatic only while plugged in and overriding', () => {
  assert.deepEqual(g(car('charge_now'), 'charge-automatic', E.carAutomatic).call, {domain: 'script', service: 'turn_on', entity: E.carAutomatic, data: {}, options: {}});
  assert.ok(g(car('charge_now', s => {s[E.carOnline].state = 'off';}), 'charge-automatic'), 'cancelling never waits for fresh data');
  // Return to automatic ends an override, so there is nothing to return from without one.
  for (const id of ['wait_offpeak', 'unplugged', 'other_vehicle']) assert.equal(g(car(id), 'charge-automatic', E.carAutomatic), null, id);
});
test('Wake or Refresh only while the connected Car is stale or unverified', () => {
  for (const id of ['wait_offpeak_asleep', 'not_verified', 'stale']) assert.equal(g(car(id), 'charge-refresh', E.carRefresh).key, E.carRefresh, id);
  // A connected Car with fresh data and a verified session has nothing to refresh.
  assert.equal(carStates('wait_offpeak')[E.carConnected].state, 'on');
  for (const id of ['wait_offpeak', 'unplugged', 'other_vehicle', 'dropout']) assert.equal(g(car(id), 'charge-refresh', E.carRefresh), null, id);
});
test('the charge limit moves 5% on its grid, and a step that changes nothing is refused', () => {
  const at = limit => car('wait_offpeak', s => {s[E.carLimit].state = String(limit);});
  assert.deepEqual(g(at(80), 'charge-limit', E.carLimit, {direction: 1}), {key: E.carLimit,
    call: {domain: 'number', service: 'set_value', entity: E.carLimit, data: {value: 85}, options: {}}});
  assert.equal(g(at(98), 'charge-limit', E.carLimit, {direction: '1'}).call.data.value, 100, 'clamped to the entity maximum');
  assert.equal(g(at(52), 'charge-limit', E.carLimit, {direction: -1}).call.data.value, 50);
  // At the entity's max or min the step would change nothing.
  assert.equal(g(at(100), 'charge-limit', E.carLimit, {direction: 1}), null);
  assert.equal(g(at(50), 'charge-limit', E.carLimit, {direction: -1}), null);
  assert.equal(g(at(100), 'charge-limit', E.carLimit, {direction: -1}).call.data.value, 95);
  assert.equal(g(at(80), 'charge-limit', E.carLimit, {direction: 2}), null);
  assert.equal(g(at(80), 'charge-limit', 'number.other_limit', {direction: 1}), null);
  assert.equal(g(at('unknown'), 'charge-limit', E.carLimit, {direction: 1}), null);
  for (const id of ['wait_offpeak_asleep', 'not_verified', 'stale', 'unplugged', 'other_vehicle', 'dropout']) assert.equal(g(car(id), 'charge-limit', E.carLimit, {direction: 1}), null, id);
});
test('every Car fixture: a charging command is allowed exactly when the Car page offers it', () => {
  for (const f of CAR_FIXTURES) {
    const snap = car(f.id), s = carStatus(snap.states, {now: CAR_NOW});
    assert.equal(g(snap, 'charge-now') !== null, s.plugged && !s.override && s.controls.chargeNow.enabled, f.id);
    assert.equal(g(snap, 'charge-automatic') !== null, s.plugged && s.override, f.id);
    assert.equal(g(snap, 'charge-refresh') !== null, s.controls.wake, f.id);
  }
});

// ---- Vacuum --------------------------------------------------------------------
test('vacuum: three commands on the one vacuum, only while it is available', () => {
  const snap = fixtureSnapshot({states: {[E.vacuum]: state('docked')}});
  for (const command of ['start', 'pause', 'return_to_base'])
    assert.deepEqual(g(snap, 'vacuum', command), {key: E.vacuum, call: {domain: 'vacuum', service: command, entity: E.vacuum, data: {}, options: {}}});
  for (const command of ['delete', 'set_fan_speed', 'send_command', '']) assert.equal(g(snap, 'vacuum', command), null, command);
  // An unavailable vacuum takes no command.
  assert.equal(g(fixtureSnapshot({states: {[E.vacuum]: state('unavailable')}}), 'vacuum', 'start'), null);
});
test('Maison controls no player: the Television and the HT-A9 left with Life (v35)', () => {
  for (const tv of ['media_player.tv_tv', 'media_player.ht_a9']) {
    const snap = fixtureSnapshot({states: {[tv]: state('playing', {supported_features: 16389, volume_level: .3})}});
    for (const command of ['media-toggle', 'media-volume']) assert.equal(g(snap, command, tv, {value: 40}), null, `${tv} ${command}`);
  }
});

// ---- The seam with service() ---------------------------------------------------
test('every action’s key is the busy key service() computes for its call', () => {
  const actions = [];
  const collect = (snap, intents) => {for (const intent of intents) {const a = guard(intent, snap); if (a?.call) actions.push([snap, a, intent]);}};
  const everything = [...WRITES.flatMap(command => [-1, 1].flatMap(direction => ['house', 'attic', 'sam', 'noah', 'bedroom-suite', 'bathroom', 'ensuite', E.carLimit, E.heatingAuto,
    CLIMATE_CONTRACT.aircoCooling, E.carSmart, E.atticComfort, CLIMATE_CONTRACT.samSetback, 'start'].map(entity => ({command, entity, direction}))))];
  for (const f of CLIMATE_FIXTURES) {
    collect(climate(f.id, {draft: {awayUntil: '2026-10-18T15:00'}}), everything);
    collect(climate(f.id), everything);
  }
  for (const f of CAR_FIXTURES) collect(car(f.id), everything);
  collect(fixtureSnapshot({states: {[E.vacuum]: state('docked')}}), [{command: 'vacuum', entity: 'start'}]);
  const commands = new Set(actions.map(([, , intent]) => intent.command));
  for (const command of WRITES.filter(c => !['house-step', 'house-end', 'away-until'].includes(c))) assert.ok(commands.has(command), `no ${command} action was collected`);
  for (const [snap, a, intent] of actions) {
    const card = Object.create(Maison.prototype);
    card._hass = {states: snap.states, connected: true, callService: () => new Promise(() => {})};
    card._busy = new Set(); card.render = () => {}; card.toast = () => {};
    card.service(a.call.domain, a.call.service, a.call.entity, a.call.data, a.call.options);
    assert.deepEqual([...card._busy], [a.key], `${intent.command} ${intent.entity}`);
  }
});
