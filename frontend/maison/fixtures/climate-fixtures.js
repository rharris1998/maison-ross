// Synthetic Climate states (#21–#26), one per situation the page must read
// and control correctly. The gallery renders each through the production
// builders and the Node tests check each fixture's status lines and controls,
// so the two cannot drift apart. No real readings. A cold weekday morning in
// October: Wednesday 14 October 2026, 09:30.
import {E, HOUSE, ZONES, TOWEL_RAILS, CLIMATE_CONTRACT} from '../../../config/www/maison/model.js';

export const CLIMATE_NOW = Date.parse('2026-10-14T09:30:00+02:00');
const iso = minutes => new Date(CLIMATE_NOW + minutes * 60000).toISOString();
const entity = (entity_id, state, attributes = {}) => ({
  entity_id, state: String(state), attributes, last_changed: iso(-12), last_updated: iso(-12), last_reported: iso(-2),
});
const zone = id => ZONES.find(z => z.id === id);
const temperature = {unit_of_measurement: '°C', device_class: 'temperature'};
const humidity = {unit_of_measurement: '%', device_class: 'humidity'};
const valve = (id, state, target, action = 'idle') => entity(id, state, {
  friendly_name: id, hvac_modes: ['off', 'auto', 'heat'], min_temp: 4, max_temp: 35, target_temp_step: 0.5,
  temperature: target, current_temperature: 21, hvac_action: action, supported_features: 385,
});
const reading = (id, value, attributes = temperature) => entity(id, value, attributes);
const helper = (id, value, min, max) => entity(id, value, {min, max, step: 0.5, mode: 'box', unit_of_measurement: '°C'});

// The house thermostat's week, in its own clock: 20° from 06:30 to 22:00 on
// weekdays, 21° from 08:00 to 23:00 at the weekend, 18° otherwise.
const weekday = [{start: '00:00', end: '06:30', temperature: 18}, {start: '06:30', end: '22:00', temperature: 20}, {start: '22:00', end: '24:00', temperature: 18}];
const weekend = [{start: '00:00', end: '08:00', temperature: 18}, {start: '08:00', end: '23:00', temperature: 21}, {start: '23:00', end: '24:00', temperature: 18}];
export const CLIMATE_WEEK = Object.freeze({monday: weekday, tuesday: weekday, wednesday: weekday, thursday: weekday, friday: weekday, saturday: weekend, sunday: weekend});
// The thermostat's clock runs 16 s slow, so its 22:00 is 22:00:16.
const CLOCK_OFFSET_S = 16;
function houseHeating(state, attributes = {}) {
  return entity(CLIMATE_CONTRACT.houseHeating, state, {
    target: null, next_change: null, override_until: null, override_temperature: null, away_from: null, away_until: null,
    day_temperature: 21, room_temperature: 19.4, calling: true, pump: 'on', clock_offset_s: CLOCK_OFFSET_S, week: CLIMATE_WEEK,
    friendly_name: 'House heating', ...attributes,
  });
}
const scheduled = {target: 20, next_change: '2026-10-14T22:00:16+02:00'};
// A scheduled zone's target sensor as #24 publishes it.
const zoneTarget = (id, value, attributes) => entity(id, value, {...temperature, mode: 'comfort', override_until: null, next_change: '2026-10-14T18:00:00+02:00', needs_house_heat: false, ...attributes});
// A fixed zone's target sensor: its valve's own setpoint.
const fixedTarget = (id, value) => entity(id, value, {...temperature, mode: 'fixed'});
// The scheduled zones' weeks (config/packages/heating_zones.yaml), as the
// element keeps them once data.js has read schedule.get_schedule's answer:
// "08:00:00" is kept as "08:00". The Attic every day, Sam's office on
// weekdays only.
const hours = (from, to) => [{from, to}];
export const CLIMATE_SCHEDULES = Object.freeze({
  [ZONES[0].schedule]: {monday: hours('08:00', '18:00'), tuesday: hours('08:00', '18:00'), wednesday: hours('08:00', '18:00'), thursday: hours('08:00', '18:00'),
    friday: hours('08:00', '18:00'), saturday: hours('10:00', '20:00'), sunday: hours('10:00', '20:00')},
  [ZONES[1].schedule]: {monday: hours('08:00', '18:00'), tuesday: hours('08:00', '18:00'), wednesday: hours('08:00', '18:00'), thursday: hours('08:00', '18:00'),
    friday: hours('08:00', '18:00'), saturday: [], sunday: []},
});

// The house heating runs on its schedule; the Attic and Sam's office are
// warming up; every Home Assistant part of #22–#26 is in place.
function base() {
  const attic = zone('attic'), sam = zone('sam'), noah = zone('noah'), bedroom = zone('bedroom-suite');
  const states = {
    [HOUSE.temperature]: reading(HOUSE.temperature, 19.6), [HOUSE.humidity]: reading(HOUSE.humidity, 48, humidity),
    [HOUSE.pump]: entity(HOUSE.pump, 'on', {device_class: 'enum', options: ['off', 'on', 'overrun', 'hwc']}),
    [HOUSE.outdoor]: reading(HOUSE.outdoor, 6.5),
    [HOUSE.valves[0].id]: valve(HOUSE.valves[0].id, 'heat', 35, 'heating'), [HOUSE.valves[1].id]: valve(HOUSE.valves[1].id, 'heat', 35, 'heating'),
    [attic.temperature]: reading(attic.temperature, 19.8), [attic.humidity]: reading(attic.humidity, 45, humidity),
    [attic.target]: zoneTarget(attic.target, 21, {next_target: 16}),
    [attic.schedule]: entity(attic.schedule, 'on', {editable: false, next_event: '2026-10-14T18:00:00+02:00'}),
    [attic.comfort]: helper(attic.comfort, 21, 16, 24), [attic.setback]: helper(attic.setback, 16, 12, 20), [attic.override]: helper(attic.override, 21, 5, 30),
    [attic.airco]: entity(attic.airco, 'off', {hvac_modes: ['off', 'cool', 'heat', 'fan_only', 'dry', 'auto'], temperature: 22, current_temperature: 20}),
    [attic.heatingSource]: entity(attic.heatingSource, 'gas', {gas_cost: 0.142, airco_cost: 0.19}),
    [attic.aircoHeating]: entity(attic.aircoHeating, 'on'),
    [CLIMATE_CONTRACT.aircoCooling]: entity(CLIMATE_CONTRACT.aircoCooling, 'on'),
    [sam.temperature]: reading(sam.temperature, 19.2), [sam.humidity]: reading(sam.humidity, 50, humidity),
    [sam.target]: zoneTarget(sam.target, 20, {next_target: 18}),
    [sam.schedule]: entity(sam.schedule, 'on', {editable: false, next_event: '2026-10-14T18:00:00+02:00'}),
    [sam.comfort]: helper(sam.comfort, 20, 16, 24), [sam.setback]: helper(sam.setback, 18, 12, 20), [sam.override]: helper(sam.override, 20, 5, 30),
    [noah.temperature]: reading(noah.temperature, 20.1), [noah.humidity]: reading(noah.humidity, 52, humidity), [noah.target]: fixedTarget(noah.target, 20),
    [bedroom.temperature]: reading(bedroom.temperature, 16.8), [bedroom.humidity]: reading(bedroom.humidity, 55, humidity), [bedroom.target]: fixedTarget(bedroom.target, 17),
    [CLIMATE_CONTRACT.houseHeating]: houseHeating('schedule', scheduled),
  };
  for (const v of [...attic.valves, ...sam.valves]) states[v.id] = valve(v.id, 'heat', v.id.includes('sam') ? 20 : 21, 'heating');
  states[noah.valves[0].id] = valve(noah.valves[0].id, 'heat', 20);
  states[bedroom.valves[0].id] = valve(bedroom.valves[0].id, 'heat', 17);
  for (const v of [...HOUSE.valves, ...ZONES.flatMap(z => z.valves)]) states[v.probe] = reading(v.probe, 34.5);
  for (const rail of TOWEL_RAILS) {
    states[rail.valve] = valve(rail.valve, rail.id === 'ensuite' ? 'off' : 'heat', 7);
    states[rail.probe] = reading(rail.probe, 21.4);
    states[rail.drying] = entity(rail.drying, 'off', {until: null});
  }
  for (const id of Object.values(CLIMATE_CONTRACT.scripts)) states[id] = entity(id, 'off', {mode: 'queued'});
  return states;
}
const without = (states, ids) => Object.fromEntries(Object.entries(states).filter(([id]) => !ids.includes(id)));
export const CONTRACT_IDS = Object.freeze([CLIMATE_CONTRACT.houseHeating, CLIMATE_CONTRACT.samTarget, CLIMATE_CONTRACT.samSchedule, CLIMATE_CONTRACT.samComfort,
  CLIMATE_CONTRACT.samSetback, CLIMATE_CONTRACT.atticOverride, CLIMATE_CONTRACT.samOverride, CLIMATE_CONTRACT.bedroomTarget, CLIMATE_CONTRACT.noahTarget,
  CLIMATE_CONTRACT.ensuiteDrying, CLIMATE_CONTRACT.bathroomDrying, CLIMATE_CONTRACT.aircoCooling, ...Object.values(CLIMATE_CONTRACT.scripts)]);
// The house thermostat satisfied: the zones' radiators can't warm.
function notCalling(states) {
  states[HOUSE.pump] = entity(HOUSE.pump, 'off');
  for (const z of [zone('attic'), zone('sam')]) states[z.target].attributes = {...states[z.target].attributes, needs_house_heat: true};
  return states;
}

function houseOff() {
  const states = notCalling(base());
  states[CLIMATE_CONTRACT.houseHeating] = houseHeating('off', {calling: false, pump: 'off', next_change: scheduled.next_change});
  return states;
}
function aircoHeating() {
  const states = notCalling(base()), attic = zone('attic');
  states[CLIMATE_CONTRACT.houseHeating] = houseHeating('schedule', {...scheduled, room_temperature: 20.2, calling: false, pump: 'off'});
  states[attic.temperature] = reading(attic.temperature, 20.2);
  states[attic.airco] = {...states[attic.airco], state: 'heat'};
  states[attic.heatingSource] = entity(attic.heatingSource, 'airco', {gas_cost: 0.142, airco_cost: 0.078, cop: 4.7});
  states[attic.target].attributes = {...states[attic.target].attributes, needs_house_heat: false};
  for (const v of attic.valves) states[v.id] = valve(v.id, 'heat', 21, 'idle');
  return states;
}
function dryHumid() {
  const states = base();
  states[zone('attic').humidity] = reading(zone('attic').humidity, 35, humidity);
  states[zone('bedroom-suite').humidity] = reading(zone('bedroom-suite').humidity, 66, humidity);
  states[HOUSE.humidity] = reading(HOUSE.humidity, 60, humidity);
  return states;
}
function unavailable() {
  const states = base();
  const ids = [HOUSE.temperature, HOUSE.humidity, HOUSE.pump, HOUSE.outdoor, ...ZONES.flatMap(z => [z.temperature, z.humidity, z.target, ...z.valves.flatMap(v => [v.id, v.probe])]),
    ...TOWEL_RAILS.flatMap(r => [r.valve, r.probe, r.drying]), E.airco, CLIMATE_CONTRACT.aircoCooling, E.heatingAuto];
  for (const id of ids) if (states[id]) states[id] = {...states[id], state: 'unavailable'};
  states[CLIMATE_CONTRACT.houseHeating] = {...states[CLIMATE_CONTRACT.houseHeating], state: 'unknown', attributes: {}};
  return states;
}
// Before #22–#26: none of their ids, and the Attic's target without the
// override attributes.
function contractMissing() {
  const states = without(base(), CONTRACT_IDS), attic = zone('attic');
  states[attic.target] = reading(attic.target, 21);
  return states;
}
// The house on an override and the Ensuite rail Drying.
function houseOverride() {
  const states = base(), ensuite = TOWEL_RAILS.find(r => r.id === 'ensuite');
  states[CLIMATE_CONTRACT.houseHeating] = houseHeating('override', {
    ...scheduled, target: 21.5, override_until: '2026-10-14T12:30:00+02:00', override_temperature: 21.5,
  });
  states[ensuite.drying] = entity(ensuite.drying, 'on', {until: '2026-10-14T10:15:00+02:00'});
  states[ensuite.valve] = valve(ensuite.valve, 'heat', 35, 'heating');
  return states;
}
// The thermostat's schedule switched off: it holds its manual setpoint.
function houseManual() {
  const states = base();
  states[CLIMATE_CONTRACT.houseHeating] = houseHeating('manual', {target: 20});
  return states;
}
// Away until Sunday afternoon: the thermostat at its holiday 10°.
function houseAway() {
  const states = notCalling(base());
  states[CLIMATE_CONTRACT.houseHeating] = houseHeating('away', {
    target: 10, away_from: '2026-10-12T08:00:00+02:00', away_until: '2026-10-18T17:00:00+02:00', calling: false, pump: 'off', room_temperature: 18.1,
  });
  return states;
}
function houseUnknown() {
  const states = base();
  states[CLIMATE_CONTRACT.houseHeating] = entity(CLIMATE_CONTRACT.houseHeating, 'unknown', {calling: null, pump: 'on', week: null, clock_offset_s: null});
  return states;
}
// An Attic override the house heating can't serve: the living room is warm
// enough, so the thermostat isn't calling.
function zoneOverride() {
  const states = notCalling(base()), attic = zone('attic');
  states[CLIMATE_CONTRACT.houseHeating] = houseHeating('schedule', {...scheduled, room_temperature: 20.3, calling: false, pump: 'off'});
  states[HOUSE.temperature] = reading(HOUSE.temperature, 20.4);
  states[attic.target] = zoneTarget(attic.target, 22, {mode: 'override', override_until: '2026-10-14T18:00:00+02:00', next_target: 16, needs_house_heat: true});
  states[attic.override] = helper(attic.override, 22, 5, 30);
  for (const v of attic.valves) states[v.id] = valve(v.id, 'heat', 22, 'heating');
  return states;
}

export const CLIMATE_FIXTURES = [
  {id: 'house_running', title: 'House heating on its schedule, the Attic and Sam’s office warming', states: base()},
  {id: 'house_override', title: 'A house override until 12:30, the Ensuite rail Drying', states: houseOverride()},
  {id: 'house_manual', title: 'The thermostat’s schedule switched off', states: houseManual()},
  {id: 'house_off', title: 'Heating switched off on the thermostat', states: houseOff()},
  {id: 'house_away', title: 'Away until Sunday afternoon', states: houseAway()},
  {id: 'house_unknown', title: 'The thermostat’s state unknown', states: houseUnknown()},
  {id: 'zone_override', title: 'An Attic override the house heating can’t serve', states: zoneOverride()},
  {id: 'airco_heating', title: 'The Airco heating the Attic, cheaper than gas', states: aircoHeating()},
  {id: 'dry_humid', title: 'Dry air in the Attic, humid in the Bedroom suite', states: dryHumid()},
  {id: 'sensors_unavailable', title: 'Every sensor and valve unavailable', states: unavailable()},
  {id: 'contract_missing', title: 'Before the new Home Assistant parts: contract ids missing', states: contractMissing()},
];
