// The Climate page (#21) and its controls (#22–#26): House heating, the zones
// and the Towel rails. Terms follow CONTEXT.md (Climate) and ADR 0004: the
// house thermostat leads, and every other zone is held by its valves.
// Everything here is derived from Home Assistant state and nothing here calls
// a service. Each write the page can make has one rule below that returns the
// request, or null when it must not be sent; guard.js asks it both to enable
// the control and when the control is pressed, so a disabled control can never
// be sent.
import {E, HOUSE, ZONES, TOWEL_RAILS, CLIMATE_CONTRACT, numeric, available, pretty} from './model.js?v=38';
import {historyChart} from './history.js?v=38';

// A zone within this of its target is at target. Room sensors report in 0.1°
// steps; a valve regulates on its own probe in swings of about half a degree.
export const AT_TARGET_MARGIN = 0.5;
// A towel rail at or below this is at frost protection (7 °C), not heating.
export const FROST_MAX = 7;
// Comfortable indoor humidity. Outside it the page says so, with no alert.
export const HUMIDITY_DRY = 40;
export const HUMIDITY_HUMID = 60;
// The comfort and setback helpers the drawers may step. Changing them is not
// an override.
export const STEPPABLE_HELPERS = Object.freeze([E.atticComfort, E.atticSetback, CLIMATE_CONTRACT.samComfort, CLIMATE_CONTRACT.samSetback]);
// The only scripts the Climate page calls, always through script.turn_on.
export const CLIMATE_SCRIPTS = Object.freeze(Object.values(CLIMATE_CONTRACT.scripts));
// The scripts' own limits (#23, #24, #26). Each request rule below applies
// every refusal of the script it calls, so the page never offers what that
// script would refuse, and a few are stricter than their script:
// - a house override only on the thermostat's 0.5° grid, not just in 5–30 °C;
// - no new Away while Away; an override or Away cancelled only while it runs;
// - "Warm the house too" only for a zone below its target that the house
//   heating isn't serving, while the thermostat reports it isn't calling;
// - a zone override one helper step from the zone's target, and cancelled
//   only while one runs;
// - Dry towels not while already Drying and only with the rail's valve
//   available; Stop only while Drying.
// A refusal still reads as success to a service caller, so the page also
// confirms every write by watching the state it changes.
// tests/maison-climate-constants.test.mjs checks these numbers against the
// scripts and automations they mirror.
export const HOUSE_LIMITS = Object.freeze({min: 5, max: 30, step: 0.5});
export const CLOCK_OFFSET_LIMIT_S = 600;
export const OVERRIDE_END_MIN_MS = 5 * 60000;
export const OVERRIDE_END_MAX_MS = 7 * 86400000;
export const AWAY_END_MAX_MS = 90 * 86400000;
// A zone override's temperature when its helper does not say.
export const ZONE_LIMITS = Object.freeze({min: 5, max: 30, step: 0.5});
// The Airco's cooling (automation/alexs_office/airco_auto_cool_on.yaml): to
// `target` once the attic passes `above`. The thresholds are fixed.
export const AIRCO_COOLING = Object.freeze({target: 23, above: 24});
// The thermostat reports a write on its next read-back, which can take a
// minute or two; its own watcher gives up after 2 minutes.
export const THERMOSTAT_CONFIRM_MS = 150000;
// The thermostat keeps end times to the minute on its own clock, which is
// converted both ways with the clock offset.
export const END_TOLERANCE_MS = 120000;
// The house override's end chips, in order. "Until <next change>" follows them
// and is the default whenever the schedule has a next change.
export const HOUSE_ENDS = Object.freeze([Object.freeze({id: '1h', label: '1 h', minutes: 60}), Object.freeze({id: '3h', label: '3 h', minutes: 180})]);
// Everything #climate/<id> can open, in page order.
export const CLIMATE_DETAILS = Object.freeze([
  {id: HOUSE.id, name: HOUSE.name, rooms: HOUSE.rooms, icon: 'home'},
  // A one-room zone is named after its room, so say where it is instead.
  ...ZONES.map(z => ({id: z.id, name: z.name, rooms: z.rooms === z.name ? z.floor : z.rooms, icon: z.icon})),
  {id: 'towel-rails', name: 'Towel rails', rooms: TOWEL_RAILS.map(r => r.name).join(' · '), icon: 'bath'},
].map(Object.freeze));
// The schedule helpers whose day a drawer shows: a scheduled zone's own.
export const climateSchedules = id => ZONES.filter(z => z.id === id && z.kind === 'scheduled').map(z => z.schedule);
const SCRIPTS = CLIMATE_CONTRACT.scripts;
const HOUSE_KEY = CLIMATE_CONTRACT.houseHeating;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ---- Time ----------------------------------------------------------------
const zoned = (tz, options) => new Intl.DateTimeFormat('en-GB', {hourCycle: 'h23', timeZone: tz, ...options});
const dayKey = (ms, tz) => zoned(tz, {year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms));
const moment = value => typeof value === 'number' ? value : Date.parse(value || '');
// "18:00" today, "Tue 08:00" within the week, "3 Oct 08:00" beyond.
export function when(value, tz = 'Europe/Brussels', now = Date.now()) {
  const ms = moment(value);
  if (!Number.isFinite(ms)) return null;
  const time = zoned(tz, {hour: '2-digit', minute: '2-digit'}).format(new Date(ms));
  if (dayKey(ms, tz) === dayKey(now, tz)) return time;
  const day = Math.abs(ms - now) < 6 * 86400000 ? {weekday: 'short'} : {day: 'numeric', month: 'short'};
  return `${zoned(tz, day).format(new Date(ms))} ${time}`;
}
function wallClock(ms, tz) {
  const parts = Object.fromEntries(zoned(tz, {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long'})
    .formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return {...parts, hour: parts.hour === '24' ? '00' : parts.hour};
}
// The zone's offset from UTC at `ms`, in ms.
function offsetAt(ms, tz) {
  const p = wallClock(ms, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
// A date and time input's value ("2026-10-18T15:00"), read as wall time in the
// house's time zone. null when it is not one.
export function zonedTime(local, tz = 'Europe/Brussels') {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local || ''));
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = guess - offsetAt(guess, tz);
  return guess - offsetAt(first, tz);
}
// `ms` as a date and time input's value in the house's time zone.
export function localInput(ms, tz = 'Europe/Brussels') {
  const p = wallClock(ms, tz);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// `ms` as an ISO time with the house's own offset, as the scripts are sent.
export function isoIn(ms, tz = 'Europe/Brussels') {
  const p = wallClock(ms, tz), offset = Math.round(offsetAt(ms, tz) / 60000), abs = Math.abs(offset);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
const toMinute = ms => Math.round(ms / 60000) * 60000;
// "08:30" as minutes into the day; "24:00" is 1440.
const minutes = clock => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));

// ---- Reading the house ---------------------------------------------------
// Targets read "17°" or "20.5°"; readings always carry one decimal. A missing
// value is a dash, never 0.
export const degrees = value => value === null || value === undefined ? '—' : `${new Intl.NumberFormat('en-GB', {maximumFractionDigits: 1}).format(value)}°`;
const readingText = value => value === null ? '—' : `${value.toFixed(1)}°`;
const percent = value => value === null ? '—' : `${Math.round(value)}%`;
const sensorValue = (states, id) => id && available(states[id]) ? numeric(states[id].state) : null;
const present = (states, id) => available(states[id]);

export function humidityFlag(value) {
  if (value === null || value === undefined) return null;
  return value < HUMIDITY_DRY ? 'Dry air' : value > HUMIDITY_HUMID ? 'Humid' : null;
}
function position(reading, target) {
  if (reading === null || target === null) return null;
  return reading < target - AT_TARGET_MARGIN ? 'below' : reading > target + AT_TARGET_MARGIN ? 'above' : 'at';
}

// sensor.boiler_pump_state reads off | on | overrun | hwc (checked 2026-09-28).
// Only `on` sends heat to the radiators: `hwc` heats the hot-water cylinder and
// `overrun` runs on after the burner stops.
const PUMP = {on: 'running for the radiators', off: 'off', hwc: 'heating hot water', overrun: 'running on after the burner stopped'};
const HOUSE_MODES = ['off', 'schedule', 'manual', 'override', 'away'];
// sensor.house_heating's state: one of HOUSE_MODES, 'unknown' for anything
// else, null while it doesn't exist.
const modeOf = h => !h ? null : available(h) && HOUSE_MODES.includes(String(h.state)) ? String(h.state) : 'unknown';
// The house heating runs while the pump runs for the radiators or the house
// thermostat calls for heat (#22): hot water or the pump's overrun only delay
// it. false when neither does and one of them says so; null when neither says.
export function houseRunning(states) {
  const pump = states[HOUSE.pump]?.state, calling = states[HOUSE_KEY]?.attributes?.calling;
  if (pump === 'on' || calling === true) return true;
  return Object.hasOwn(PUMP, pump || '') || calling === false ? false : null;
}
// Whether the house thermostat says it isn't calling for heat (Q25), as
// heating_zones.jinja judges it: heating switched off, Away, or `calling`
// false. An unknown thermostat is not "not calling", and the pump never
// decides it.
export function houseNotCalling(states) {
  const h = states[HOUSE_KEY], mode = modeOf(h);
  return mode === 'off' || mode === 'away' || (mode !== null && mode !== 'unknown' && h.attributes?.calling === false);
}

function valveStatus(states, v) {
  const s = states[v.id], ok = available(s), a = s?.attributes || {};
  const action = ok && a.hvac_action ? String(a.hvac_action) : null;
  const target = ok ? numeric(a.temperature) : null;
  const setting = !ok ? 'Unavailable' : s.state === 'off' ? 'Off' : target === null ? 'Setting unknown' : `Set to ${degrees(target)}`;
  return {id: v.id, name: v.name, available: ok, mode: ok ? s.state : null, target, action, heating: action === 'heating',
    line: [setting, ok ? action ? pretty(action) : 'No activity reported' : ''].filter(Boolean).join(' · '),
    probe: sensorValue(states, v.probe), probeId: v.probe};
}

const STATUS = {
  warming: {key: 'warming', label: 'Warming'},
  cooling: {key: 'cooling', label: 'Cooling'},
  at: {key: 'at_target', label: 'At target'},
  above: {key: 'above_target', label: 'Above target'},
  below: {key: 'below_target', label: 'Below target'},
  belowHouseOff: {key: 'below_house_off', label: 'Below target · house heating off'},
  noReading: {key: 'no_reading', label: 'No reading'},
  unknown: {key: 'target_unknown', label: 'Target unknown'},
};

// The thermostat's week as sensor.house_heating publishes it, or null when any
// day is missing or unreadable.
function readWeek(value) {
  let week = value;
  if (typeof week === 'string') {try {week = JSON.parse(week);} catch {return null;}}
  if (!week || typeof week !== 'object') return null;
  const out = {};
  for (const day of DAYS) {
    const periods = Array.isArray(week[day]) ? week[day].filter(p => p && /^\d\d:\d\d$/.test(p.start) && /^\d\d:\d\d$/.test(p.end) && numeric(p.temperature) !== null) : [];
    if (!periods.length) return null;
    out[day] = periods.map(p => ({start: p.start, end: p.end, temperature: Number(p.temperature)}));
  }
  return out;
}
// The thermostat's own day and HH:MM at real time `ms`: its clock runs
// `offsetS` seconds behind real time.
function thermostatClock(ms, offsetS, tz) {
  const p = wallClock(ms - (offsetS || 0) * 1000, tz);
  return {day: p.weekday.toLowerCase(), time: `${p.hour}:${p.minute}`};
}
const periodAt = (week, clock) => week?.[clock.day]?.find(p => p.start <= clock.time && clock.time < p.end) || null;

// House heating: the Open plan's control. The page shows the living-room
// sensor; the thermostat's own corrected reading, which decides whether it
// calls for heat, appears only in the "why" line.
export function houseStatus(states, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const h = states[HOUSE_KEY], a = h?.attributes || {}, mode = modeOf(h);
  const reading = sensorValue(states, HOUSE.temperature), humidity = sensorValue(states, HOUSE.humidity);
  const target = mode && mode !== 'unknown' && mode !== 'off' ? numeric(a.target) : null;
  const running = houseRunning(states), at = t => when(t, tz, now);
  const clockOffset = numeric(a.clock_offset_s), week = readWeek(a.week);
  const nextAt = moment(a.next_change), overrideUntil = moment(a.override_until), awayUntil = moment(a.away_until);
  // What the schedule changes to at its next change, from the thermostat's
  // week, looked up half a minute in so seconds of clock offset can't miss it.
  const then = Number.isFinite(nextAt) && week ? periodAt(week, thermostatClock(nextAt + 30000, clockOffset, tz))?.temperature ?? null : null;
  let targetLine = 'Target unknown';
  if (mode === 'off') targetLine = 'Heating switched off on the thermostat';
  else if (mode === 'unknown') targetLine = 'Thermostat state unknown';
  else if (mode === 'away') targetLine = at(awayUntil) ? `Away until ${at(awayUntil)}` : 'Away';
  else if (target !== null && mode === 'override') targetLine = at(overrideUntil) ? `${degrees(target)} until ${at(overrideUntil)} (override)` : `${degrees(target)} (override)`;
  else if (target !== null && mode === 'manual') targetLine = `Holds ${degrees(target)} (thermostat schedule off)`;
  else if (target !== null && mode === 'schedule') targetLine = !at(nextAt) ? degrees(target) : then !== null && then !== target ? `${degrees(target)} until ${at(nextAt)}, then ${degrees(then)}` : `${degrees(target)} until ${at(nextAt)}`;
  let status;
  if (mode === 'off') status = {key: 'off', label: 'Not heating'};
  else if (mode === 'away') status = {key: 'away', label: target === null ? 'Holding its holiday temperature' : `Holding ${degrees(target)}`};
  else if (running === true) status = STATUS.warming;
  else if (reading === null) status = STATUS.noReading;
  else if (target !== null) status = STATUS[position(reading, target)];
  else status = running === false ? {key: 'idle', label: 'Not heating now'} : {key: 'unknown', label: 'Status unknown'};
  const thermostat = numeric(a.room_temperature), pump = states[HOUSE.pump]?.state;
  const calling = typeof a.calling === 'boolean' ? a.calling : null;
  // The "why": what the thermostat reads, what it aims at and whether it calls.
  const why = [thermostat === null
    ? 'The house thermostat in the living room decides when the boiler heats, from its own reading. That reading isn’t available here yet.'
    : `The house thermostat in the living room decides when the boiler heats, from its own corrected reading: ${readingText(thermostat)}.`];
  if (mode === 'off') why.push('Heating is switched off on it, so it isn’t calling for heat.');
  else if (target !== null && calling !== null) why.push(`Its target is ${degrees(target)}, and it ${calling ? 'is' : 'isn’t'} calling for heat.`);
  else if (target !== null) why.push(`Its target is ${degrees(target)}.`);
  else if (calling !== null) why.push(calling ? 'It is calling for heat.' : 'It isn’t calling for heat.');
  why.push(Object.hasOwn(PUMP, pump || '') ? `Boiler pump: ${PUMP[pump]}.` : 'The boiler pump has no reading.');
  return {id: HOUSE.id, name: HOUSE.name, mode, reading, humidity, flag: humidityFlag(humidity), target, targetLine, status, running,
    outdoor: sensorValue(states, HOUSE.outdoor), thermostat, calling, why, valves: HOUSE.valves.map(v => valveStatus(states, v)),
    nextAt: Number.isFinite(nextAt) ? nextAt : null, then, overrideUntil: Number.isFinite(overrideUntil) ? overrideUntil : null,
    overrideTemperature: numeric(a.override_temperature), awayUntil: Number.isFinite(awayUntil) ? awayUntil : null,
    dayTemperature: numeric(a.day_temperature), clockOffset, week};
}

// A schedule's period now and its next change. A next_event already due
// counts as made, as heating_zones.jinja has it: the schedule flips on its own
// timer, a moment after other timers due at the same instant. `occupied` is
// null and `nextEvent` null while the schedule is unreadable.
function schedulePeriod(s, now) {
  if (!['on', 'off'].includes(s?.state)) return {occupied: null, nextEvent: null};
  const event = moment(s.attributes?.next_event), due = Number.isFinite(event) && event <= now;
  return {occupied: (s.state === 'on') !== due, nextEvent: Number.isFinite(event) && !due ? event : null};
}
// A scheduled zone's target comes from its target sensor; the schedule says
// when it next changes, and the other helper what it changes to.
function scheduleStatus(zone, states, {now, tz}) {
  const t = states[zone.target], s = states[zone.schedule], a = t?.attributes || {};
  const target = available(t) ? numeric(t.state) : null;
  const comfort = sensorValue(states, zone.comfort), setback = sensorValue(states, zone.setback);
  const {occupied, nextEvent} = schedulePeriod(s, now);
  const period = occupied === null ? null : occupied ? 'comfort' : 'setback';
  // The sensor's next_change (#24), or the schedule's; never one already past.
  const said = moment(a.next_change), changeMs = Number.isFinite(said) && said > now ? said : nextEvent;
  const changeAt = when(changeMs, tz, now), overrideUntil = moment(a.override_until);
  // What the zone goes to at its next change: the sensor's next_target (#24),
  // or the other helper.
  const next = numeric(a.next_target) ?? (period === 'comfort' ? setback : period === 'setback' ? comfort : null);
  const mode = a.mode ? String(a.mode) : null;
  const then = next !== null && next !== target ? `, then ${degrees(next)}` : '';
  let line;
  if (!t) line = 'Schedule not set up yet';
  else if (target === null) line = 'Target unknown';
  else if (mode === 'override') line = when(overrideUntil, tz, now) ? `${degrees(target)} until ${when(overrideUntil, tz, now)} (override)${then}` : `${degrees(target)} (override)`;
  else if (changeAt && next !== null) line = `${degrees(target)} until ${changeAt}, then ${degrees(next)}`;
  else if (changeAt) line = `${degrees(target)} until ${changeAt}`;
  else line = `${degrees(target)} now`;
  return {target, line, period, changeAt, changeMs, next, comfort, setback, mode,
    overrideUntil: Number.isFinite(overrideUntil) ? overrideUntil : null,
    // #24 says whether the house heating isn't calling for a zone on
    // radiators; null where the sensor doesn't say.
    needsHouseHeat: typeof a.needs_house_heat === 'boolean' ? a.needs_house_heat : ['true', 'false'].includes(a.needs_house_heat) ? a.needs_house_heat === 'true' : null,
    exists: Boolean(t), schedule: s ? {id: zone.schedule, editable: s.attributes?.editable === true} : null};
}

// What is heating the Attic right now: the Airco when it is in heat mode,
// otherwise the radiators. "Cheaper now" comes from sensor.attic_heating_source.
function aircoStatus(zone, states) {
  const s = states[zone.airco], mode = available(s) ? String(s.state) : null;
  const cheaper = ['solar', 'airco'].includes(states[zone.heatingSource]?.state);
  const heating = mode === 'heat', cooling = mode === 'cool';
  return {mode, heating, cooling, cheaper, allowed: states[zone.aircoHeating]?.state === 'on',
    cooling_allowed: states[CLIMATE_CONTRACT.aircoCooling]?.state === 'on',
    source: heating ? 'airco' : 'radiators',
    sourceLabel: heating ? cheaper ? 'Airco, cheaper now' : 'Airco' : cooling ? 'Radiators · the Airco is cooling' : 'Radiators',
    line: !s ? 'Not found' : mode === null ? 'Unavailable' : heating ? 'Heating' : cooling ? 'Cooling' : mode === 'off' ? 'Off' : pretty(mode)};
}

const zoneOf = zoneOrId => typeof zoneOrId === 'string' ? ZONES.find(z => z.id === zoneOrId) : zoneOrId;
// "the Attic", "the Bedroom suite", but "Sam’s office".
const theZone = zone => zone.name.includes('’s ') ? zone.name : `the ${zone.name}`;
export function zoneStatus(zoneOrId, states, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const zone = zoneOf(zoneOrId);
  if (!zone) return null;
  const reading = sensorValue(states, zone.temperature), humidity = sensorValue(states, zone.humidity);
  const valves = zone.valves.map(v => valveStatus(states, v)), running = houseRunning(states);
  const schedule = zone.kind === 'scheduled' ? scheduleStatus(zone, states, {now, tz}) : null;
  // A fixed zone's target sensor is its valve's own setpoint; until it exists
  // the valve says.
  const target = schedule ? schedule.target : sensorValue(states, zone.target) ?? valves[0].target;
  const targetLine = schedule ? schedule.line : target === null ? 'Target unknown' : `Always ${degrees(target)}`;
  const airco = zone.airco ? aircoStatus(zone, states) : null;
  const radiators = airco?.source !== 'airco', where = position(reading, target);
  let status;
  if (airco?.cooling) status = STATUS.cooling;
  // A valve that reports heating only warms while the house heating runs.
  else if (valves.some(v => v.heating) && running === true) status = STATUS.warming;
  else if (airco?.heating && where !== 'at' && where !== 'above') status = STATUS.warming;
  else if (reading === null) status = STATUS.noReading;
  // "House heating off" is the thermostat's word, never the pump's: while it
  // calls, hot water or the overrun only delay the heat.
  else if (where === 'below') status = radiators && houseNotCalling(states) ? STATUS.belowHouseOff : STATUS.below;
  else if (where) status = STATUS[where];
  else status = STATUS.unknown;
  return {id: zone.id, name: zone.name, rooms: zone.rooms, kind: zone.kind, icon: zone.icon, reading, humidity, flag: humidityFlag(humidity),
    target, targetLine, status, schedule, airco, source: radiators ? 'radiators' : 'airco', running, valves, where,
    warnHouseOff: status.key === STATUS.belowHouseOff.key};
}

// A towel rail sits at frost protection unless it is Drying (#26) or set by hand.
export function railStatus(rail, states, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const s = states[rail.valve], ok = available(s), drying = states[rail.drying];
  const target = ok ? numeric(s.attributes?.temperature) : null;
  let status;
  if (drying?.state === 'on') status = {key: 'drying', label: when(drying.attributes?.until, tz, now) ? `Drying until ${when(drying.attributes.until, tz, now)}` : 'Drying'};
  else if (!ok) status = {key: 'unavailable', label: 'Unavailable'};
  else if (s.state === 'off' || (target !== null && target <= FROST_MAX)) status = {key: 'frost', label: 'Off (frost)'};
  else if (target === null) status = {key: 'unknown', label: 'Setting unknown'};
  else status = {key: 'set', label: `Set to ${degrees(target)}`};
  return {id: rail.id, name: rail.name, status, target, probe: sensorValue(states, rail.probe)};
}

// ---- Requests ------------------------------------------------------------
// Each rule below returns the request for one write, or null when it must not
// be sent. Every request is a script.turn_on with `variables`, confirmed by
// watching one entity until `expected` holds. `key` is the busy lock and
// feedback line the request's controls share.
const houseMode = states => modeOf(states[HOUSE_KEY]);
const clockOk = states => {const offset = numeric(states[HOUSE_KEY]?.attributes?.clock_offset_s); return offset !== null && Math.abs(offset) < CLOCK_OFFSET_LIMIT_S;};
const THERMOSTAT = Object.freeze({key: HOUSE_KEY, watch: HOUSE_KEY, confirmMs: THERMOSTAT_CONFIRM_MS,
  waiting: 'waiting for the thermostat, which can take a minute or two', confirmed: 'confirmed by the thermostat',
  unconfirmed: 'not confirmed by the thermostat yet. Check the thermostat before trying again.'});
const near = (a, b, tolerance = 0.05) => numeric(a) !== null && Math.abs(Number(a) - b) < tolerance;
const endNear = (value, until) => {const ms = moment(value); return Number.isFinite(ms) && Math.abs(ms - until) <= END_TOLERANCE_MS;};

// What each write must be seen to do before the page calls it confirmed.
export const confirms = Object.freeze({
  // As the thermostat's own watcher: the temperature read back, and the end
  // within 2 minutes. While heating is switched off an override can't show,
  // so the temperature read back is proof.
  houseOverride: (temperature, until) => state => available(state) && near(state.attributes?.override_temperature, temperature)
    && (state.state === 'off' || (state.state === 'override' && endNear(state.attributes?.override_until, until))),
  houseOverrideCancel: () => state => available(state) && !['unknown', 'override'].includes(state.state) && !state.attributes?.override_until,
  houseAway: until => state => available(state) && state.state === 'away' && endNear(state.attributes?.away_until, until),
  houseAwayCancel: () => state => available(state) && !['unknown', 'away'].includes(state.state),
  zoneOverride: temperature => state => available(state) && near(state.state, temperature) && state.attributes?.mode === 'override',
  zoneOverrideCancel: () => state => available(state) && ['comfort', 'setback'].includes(state.attributes?.mode),
  drying: on => state => available(state) && state.state === (on ? 'on' : 'off'),
});

// Where the house override's stepper starts: the running override, the
// target, or the week's day temperature, on the thermostat's 0.5° grid.
const onGrid = (value, {min, max, step}) => Number(Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step)).toFixed(6));
export function houseBase(states) {
  const a = states[HOUSE_KEY]?.attributes || {}, mode = houseMode(states);
  const value = [mode === 'override' ? a.override_temperature : null, ['schedule', 'override', 'manual'].includes(mode) ? a.target : null, a.day_temperature]
    .map(numeric).find(v => v !== null) ?? 20;
  return onGrid(value, HOUSE_LIMITS);
}
// The stepper's value: the draft while it was started from the current base.
export function houseDraftTemperature(states, draft = {}) {
  const base = houseBase(states), d = draft?.house;
  return d && d.base === base && numeric(d.temperature) !== null ? d.temperature : base;
}
// The next draft one 0.5° step up or down, or null at the 5–30 bounds.
export function houseDraftStep(states, draft, direction) {
  if (![-1, 1].includes(direction)) return null;
  const base = houseBase(states), current = houseDraftTemperature(states, draft);
  const temperature = onGrid(current + direction * HOUSE_LIMITS.step, HOUSE_LIMITS);
  return temperature === current ? null : {base, temperature};
}
// The end chips on offer now: 1 h, 3 h and "Until <next change>", each only
// while it falls between 5 minutes and 7 days from now.
export function houseEnds(states, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const next = moment(states[HOUSE_KEY]?.attributes?.next_change);
  const ends = HOUSE_ENDS.map(e => ({id: e.id, label: e.label, until: toMinute(now + e.minutes * 60000)}));
  if (Number.isFinite(next)) ends.push({id: 'next', label: `Until ${when(next, tz, now)}`, until: next});
  return ends.filter(e => e.until >= now + OVERRIDE_END_MIN_MS && e.until <= now + OVERRIDE_END_MAX_MS);
}
export function houseEnd(states, draft = {}, options = {}) {
  const ends = houseEnds(states, options);
  return ends.find(e => e.id === draft?.houseEnd) || ends.find(e => e.id === 'next') || ends[0] || null;
}

// Why the house controls can't write right now, or null when they can.
export function houseProblem(states) {
  const mode = houseMode(states);
  if (mode === null || !states[SCRIPTS.houseOverrideSet] || !states[SCRIPTS.houseAwaySet]) return 'missing';
  if (!available(states[HOUSE_KEY]) || mode === 'unknown') return 'unknown';
  if (!clockOk(states)) return 'clock';
  return null;
}
const within = (ms, now, min, max) => Number.isFinite(ms) && ms >= now + min && ms <= now + max;

export function houseOverrideRequest(states, {temperature, until} = {}, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const t = numeric(temperature), end = moment(until);
  if (houseProblem(states) || houseMode(states) === 'away' || !present(states, SCRIPTS.houseOverrideSet)) return null;
  if (t === null || t < HOUSE_LIMITS.min || t > HOUSE_LIMITS.max || onGrid(t, HOUSE_LIMITS) !== t) return null;
  if (!within(end, now, OVERRIDE_END_MIN_MS, OVERRIDE_END_MAX_MS)) return null;
  return {...THERMOSTAT, script: SCRIPTS.houseOverrideSet, variables: {temperature: t, until: isoIn(end, tz)},
    label: `House heating ${degrees(t)} until ${when(end, tz, now)}`, expected: confirms.houseOverride(t, end)};
}
// Cancels need no clock: they only switch the override or Away off.
export function houseOverrideCancelRequest(states) {
  const h = states[HOUSE_KEY];
  if (!available(h) || !present(states, SCRIPTS.houseOverrideCancel) || !['override', 'off'].includes(houseMode(states)) || !h.attributes?.override_until) return null;
  return {...THERMOSTAT, script: SCRIPTS.houseOverrideCancel, variables: {}, label: 'House heating override cancelled', expected: confirms.houseOverrideCancel()};
}
export function houseAwayRequest(states, {until} = {}, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const end = moment(until);
  if (houseProblem(states) || houseMode(states) === 'away' || !present(states, SCRIPTS.houseAwaySet)) return null;
  if (!within(end, now, OVERRIDE_END_MIN_MS, AWAY_END_MAX_MS)) return null;
  return {...THERMOSTAT, script: SCRIPTS.houseAwaySet, variables: {until: isoIn(end, tz)}, label: `Away until ${when(end, tz, now)}`, expected: confirms.houseAway(end)};
}
export function houseAwayCancelRequest(states) {
  if (!available(states[HOUSE_KEY]) || houseMode(states) !== 'away' || !present(states, SCRIPTS.houseAwayCancel)) return null;
  return {...THERMOSTAT, script: SCRIPTS.houseAwayCancel, variables: {}, label: 'Away cancelled', expected: confirms.houseAwayCancel()};
}

// Whether a zone below its target needs the house heating to warm: its target
// sensor says the house isn't calling for a zone on radiators
// (needs_house_heat, #24), or, where it doesn't say, the zone is on radiators
// and the house thermostat says it isn't calling. Never while the Airco heats
// the Attic. `until` is the zone override's end, or the zone's next change.
function warmNeed(zone, states, options) {
  const s = zoneStatus(zone, states, options);
  if (!s || s.airco?.heating || s.where !== 'below') return null;
  const needs = s.schedule?.needsHouseHeat ?? (s.source === 'radiators' && houseNotCalling(states));
  if (!needs) return null;
  const until = s.schedule?.mode === 'override' && s.schedule.overrideUntil !== null ? s.schedule.overrideUntil : s.schedule?.changeMs ?? null;
  return {s, until};
}
// Whether a house override at the day temperature would make the thermostat
// call, as script.house_heating_warm_until judges it: its own reading known
// and below the day temperature. null when either is unknown.
function warmsDownstairs(states) {
  const a = states[HOUSE_KEY]?.attributes || {}, day = numeric(a.day_temperature), room = numeric(a.room_temperature);
  return day === null || room === null ? null : room < day;
}
// "Warm the house until <end> too": a house override at the week's day
// temperature, ending with the zone's override. As the script: only while the
// house heating is on its schedule, manual or an override, and its reading is
// below the day temperature; and only while it reports it isn't calling.
export function houseWarmRequest(states, zoneId, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const zone = zoneOf(zoneId), need = zone && warmNeed(zone, states, {now, tz});
  if (!need || houseProblem(states) || !['schedule', 'override', 'manual'].includes(houseMode(states)) || !present(states, SCRIPTS.houseWarmUntil)) return null;
  const a = states[HOUSE_KEY].attributes || {}, day = numeric(a.day_temperature);
  if (a.calling !== false || warmsDownstairs(states) !== true) return null;
  if (!within(need.until, now, OVERRIDE_END_MIN_MS, OVERRIDE_END_MAX_MS)) return null;
  return {...THERMOSTAT, script: SCRIPTS.houseWarmUntil, variables: {until: isoIn(need.until, tz)},
    label: `House heating ${degrees(day)} until ${when(need.until, tz, now)}`, expected: confirms.houseOverride(day, need.until)};
}
// What the page says and offers when a zone won't warm.
export function warmOffer(zoneOrId, states, options = {}) {
  const zone = zoneOf(zoneOrId), need = zone && warmNeed(zone, states, options);
  if (!need) return null;
  const house = houseStatus(states, options);
  if (house.mode === 'away' || house.mode === null) return null;
  if (house.mode === 'off') return {kind: 'off', text: `Heating is switched off on the thermostat, so radiators won’t warm ${theZone(zone)}.`};
  const request = houseWarmRequest(states, zone.id, options);
  return {kind: 'warm', request,
    text: house.target !== null ? `House heating is aiming at ${degrees(house.target)}, so ${theZone(zone)} won’t warm.` : `The house heating isn’t calling for heat, so ${theZone(zone)} won’t warm.`,
    label: request ? `Warm the house until ${when(need.until, options.tz, options.now)} too` : '',
    note: request ? `This also warms downstairs, to ${degrees(house.dayTemperature)}.`
      : warmsDownstairs(states) === false ? 'Downstairs is already at its day temperature, so warming the house won’t start the boiler.' : ''};
}

// A scheduled zone's override, one step from its current target, within its
// override helper's bounds. The script ends it at the schedule's next event,
// so it refuses while the schedule has none, or has one already due.
function zoneLimits(state) {
  const a = state?.attributes || {}, [min, max, step] = [a.min, a.max, a.step].map(numeric);
  return available(state) && min !== null && max !== null && step !== null && step > 0 && max >= min ? {min, max, step} : ZONE_LIMITS;
}
const scheduledZone = id => ZONES.find(z => z.id === id && z.kind === 'scheduled');
// Whether a scheduled zone's override is set up at all: its target sensor and
// the zone override script exist. Until then its sheet says "Not set up yet".
export function zoneOverrideReady(states, zone) {
  return Boolean(zone && states[zone.target] && states[SCRIPTS.zoneOverride]);
}
export function zoneOverrideRequest(states, zoneId, direction, {now = Date.now()} = {}) {
  const zone = scheduledZone(zoneId), t = zone && states[zone.target];
  if (!zone || ![-1, 1].includes(direction) || !available(t) || !present(states, SCRIPTS.zoneOverride)) return null;
  if (schedulePeriod(states[zone.schedule], now).nextEvent === null) return null;
  const target = numeric(t.state);
  if (target === null) return null;
  const temperature = onGrid(target + direction * zoneLimits(states[zone.override]).step, zoneLimits(states[zone.override]));
  if (temperature === target) return null;
  return {script: SCRIPTS.zoneOverride, variables: {zone: zone.script, temperature}, key: zone.target, watch: zone.target,
    label: `${zone.name} override ${degrees(temperature)}`, expected: confirms.zoneOverride(temperature)};
}
export function zoneOverrideCancelRequest(states, zoneId) {
  const zone = scheduledZone(zoneId), t = zone && states[zone.target];
  if (!zone || !available(t) || t.attributes?.mode !== 'override' || !present(states, SCRIPTS.zoneOverrideCancel)) return null;
  return {script: SCRIPTS.zoneOverrideCancel, variables: {zone: zone.script}, key: zone.target, watch: zone.target,
    label: `${zone.name} override cancelled`, expected: confirms.zoneOverrideCancel()};
}
// Whether a rail's Drying is set up at all: its Drying sensor and both Drying
// scripts exist. Until then the rail offers neither Dry towels nor Stop.
export function dryingReady(states, rail) {
  return Boolean(rail && states[rail.drying] && states[SCRIPTS.dryingStart] && states[SCRIPTS.dryingStop]);
}
// Drying: one hour at a time, never while Away.
export function dryingRequest(states, railId, start) {
  const rail = TOWEL_RAILS.find(r => r.id === railId), d = rail && states[rail.drying];
  const script = start ? SCRIPTS.dryingStart : SCRIPTS.dryingStop;
  if (!rail || !available(d) || !present(states, script)) return null;
  if (start ? d.state === 'on' || houseMode(states) === 'away' || !available(states[rail.valve]) : d.state !== 'on') return null;
  return {script, variables: {rail: rail.id}, key: rail.drying, watch: rail.drying,
    label: `${rail.name} towel rail ${start ? 'drying' : 'stopped'}`, expected: confirms.drying(start)};
}

// Every Climate request by its command name, as guard.js asks for it. `draft`
// holds the house stepper, its end chip and the Away date the viewer chose.
export function climateRequest(command, states, {entity = '', direction = 0} = {}, {now = Date.now(), tz = 'Europe/Brussels', draft = {}} = {}) {
  const o = {now, tz};
  switch (command) {
    case 'house-override': return houseOverrideRequest(states, {temperature: houseDraftTemperature(states, draft), until: houseEnd(states, draft, o)?.until}, o);
    case 'house-override-cancel': return houseOverrideCancelRequest(states);
    case 'house-away': return houseAwayRequest(states, {until: zonedTime(draft?.awayUntil, tz)}, o);
    case 'house-away-cancel': return houseAwayCancelRequest(states);
    case 'house-warm': return houseWarmRequest(states, entity, o);
    case 'zone-override': return zoneOverrideRequest(states, entity, direction, o);
    case 'zone-override-cancel': return zoneOverrideCancelRequest(states, entity);
    case 'drying-start': return dryingRequest(states, entity, true);
    case 'drying-stop': return dryingRequest(states, entity, false);
    default: return null;
  }
}

// Home Assistant's ClimateEntityFeature.TARGET_TEMPERATURE.
const TARGET_TEMPERATURE = 1;

/** Validate, clamp and quantize a climate target against entity capabilities. */
export function climateTarget(state, requested) {
  const attributes = state?.attributes || {};
  const features = Number(attributes.supported_features) || 0;
  const current = numeric(attributes.temperature);
  const minimum = numeric(attributes.min_temp);
  const maximum = numeric(attributes.max_temp);
  const step = numeric(attributes.target_temp_step);
  const wanted = numeric(requested);
  if (!available(state) || !(features & TARGET_TEMPERATURE) || current === null || minimum === null || maximum === null || wanted === null || step === null || step <= 0 || maximum < minimum) return null;
  const clamped = Math.min(maximum, Math.max(minimum, wanted));
  const quantized = minimum + Math.round((clamped - minimum) / step) * step;
  const precision = Math.min(6, Math.max(0, (String(step).split('.')[1] || '').length));
  return Number(Math.min(maximum, Math.max(minimum, quantized)).toFixed(precision));
}

// The rule for a fixed zone's target: one valve step up or down, clamped and
// quantised to the valve's own capabilities.
export function zoneTargetStep(zoneId, states, direction) {
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone || zone.kind !== 'fixed' || ![-1, 1].includes(direction)) return null;
  const entity = zone.valves[0].id, state = states[entity];
  const step = numeric(state?.attributes?.target_temp_step), target = numeric(state?.attributes?.temperature);
  if (step === null || target === null || step <= 0) return null;
  const temperature = climateTarget(state, target + direction * step);
  return temperature === null || temperature === target ? null : {entity, temperature};
}

// Whether a comfort or setback helper can be stepped at all: one of
// STEPPABLE_HELPERS, available, with a reading and readable limits (a step
// above 0, max at least min). Until then its row says "Not set up yet"; a
// step at its min or max is refused on top of this.
export function helperSteppable(states, id) {
  const s = states[id], a = s?.attributes || {}, [min, max, step] = [a.min, a.max, a.step].map(numeric);
  return STEPPABLE_HELPERS.includes(id) && available(s) && numeric(s.state) !== null
    && min !== null && max !== null && step !== null && step > 0 && max >= min;
}

// 24-hour charts, one cache group per drawer ('climate-<id>'). Ids Home
// Assistant does not have are left out; a group with none is dropped.
export function climateHistory(states = null) {
  const has = id => id && (!states || Boolean(states[id]));
  // A target changes in steps, so its series is drawn stepped. Each series
  // says what it measures (`roles`), so the chart colours it by meaning: a
  // room reading on the room scale, a target, humidity or a valve probe,
  // which is never a room reading.
  const chart = (detail, kind, title, series) => {
    const kept = series.filter(([id]) => has(id));
    return kept.length ? {key: `climate-${detail}-${kind}`, group: `climate-${detail}`, ids: kept.map(([id]) => id), labels: kept.map(([, label]) => label),
      stepped: kept.map(([, label]) => label === 'Target'), roles: kept.map(([, , role]) => role), title} : null;
  };
  return [
    chart(HOUSE.id, 'temperature', 'Temperature · 24 hours', [[HOUSE.temperature, HOUSE.readingLabel, 'room']]),
    chart(HOUSE.id, 'humidity', 'Humidity · 24 hours', [[HOUSE.humidity, HOUSE.readingLabel, 'humidity']]),
    ...ZONES.flatMap(z => [
      chart(z.id, 'temperature', has(z.target) ? 'Temperature and target · 24 hours' : 'Temperature · 24 hours', [[z.temperature, z.readingLabel, 'room'], [z.target, 'Target', 'target']]),
      chart(z.id, 'humidity', 'Humidity · 24 hours', [[z.humidity, z.readingLabel, 'humidity']]),
    ]),
    chart('towel-rails', 'temperature', 'Valve probes · 24 hours', TOWEL_RAILS.map(r => [r.probe, `${r.name} valve probe`, 'probe'])),
  ].filter(Boolean);
}

// ---- Today's schedule ---------------------------------------------------
// Today's comfort periods of a scheduled zone, [{from, to}] in HA's local
// time, from its schedule's week as the element loads it with the read-only
// schedule.get_schedule service (data.js, loadSchedules). null until it has
// loaded, or when it can't be read.
export function todaysPeriods(week, {now = Date.now(), tz = 'Europe/Brussels'} = {}) {
  const periods = week?.[wallClock(now, tz).weekday.toLowerCase()];
  return Array.isArray(periods) ? periods : null;
}
const conjunction = new Intl.ListFormat('en-GB', {type: 'conjunction'});
// "Comfort 08:00–18:00 · setback otherwise".
export function periodsLine(periods) {
  if (!periods.length) return 'Setback all day';
  if (periods.length === 1 && periods[0].from === '00:00' && periods[0].to === '24:00') return 'Comfort all day';
  return `Comfort ${conjunction.format(periods.map(p => `${p.from}–${p.to}`))} · setback otherwise`;
}

// ---- Values --------------------------------------------------------------
// What the Climate page and its drawers show (#27), as plain data that React
// draws: screen.js hands it over. Every visible phrase is formatted here, with
// the same status functions as above, so React composes no English. Every
// write or draft control comes from the injected kit, whose `control` asks
// guard.js whether its press would go through and whose `link` is a
// navigation, so React decides no enablement either. This file never imports
// guard.js or screen.js. Values are built in drawing order; `label` is visible
// text and any key ending in Label is an accessible name only. The section
// reads only the snapshot (states, now, tz, draft, feedback, loaded), and its
// "Not set up yet" decisions use the same predicates guard.js does
// (zoneOverrideReady, dryingReady, helperSteppable).
//
// These typedefs are what the React components and the tests read:
// - A valve row's visible "Valve probe" is `probeCaption`.
// - A Control or Link may carry `icon`, drawn before its label or, for an
//   icon-only stepper button, instead of it (the button's name is ariaLabel).
// - Optional parts are null when absent: Week.text or Week.note,
//   WarmOffer.note, and a Helper's feedback while it can't be stepped.

/**
 * @typedef {{command: string, entity?: string, direction?: number, value?: string}} Intent
 * @typedef {{intent: Intent, label?: string, ariaLabel?: string, icon?: string, enabled: boolean, selected?: boolean, feedback: string}} Control
 *   From kit.control. `feedback` is the line for the control's own key.
 * @typedef {{intent: Intent, label?: string, ariaLabel?: string, icon?: string, enabled: boolean}} Link
 *   From kit.link: a navigation (detail, more, native-history).
 * @typedef {{control: (intent: Intent, extra?: object) => Control, link: (intent: Intent, extra?: object) => Link}} Kit
 * @typedef {{output: string, outputLabel: string, minus: Control|null, plus: Control|null}} Stepper
 * @typedef {{title: string, stepper: Stepper|null} | {title: string, detail: 'Not set up yet', stepper: null}} Step
 *   A setting's title and stepper. Only a `missing` kind's, which can't be stepped until its helper or script
 *   exists, carries a `detail`, drawn under the title.
 *
 * @typedef {{plot: {reading: number|null, target: number|null, min: 14, max: 26}, ariaLabel: string}} TargetBar
 *   A reading against its target on the room scale the zone capsules share (climateHeader's min and max). plot.target
 *   is null while the house heating is off or the target is unknown; while Away it is the holiday temperature, which
 *   is below the scale and drawn at its low end. plot.reading is null with no reading. ariaLabel reads it: '24.2°,
 *   target 16°', '23.4°, no target while the heating is off', '24.2°, target unknown', 'No reading, target 17°', 'No reading'.
 * @typedef {{reading: string, line: string, flag: string|null, bar: TargetBar}} ZoneReading
 *   A zone's or the house's reading against its target (#29 step 4). `reading` is '24.2°' or '—'. A zone's `line` is its
 *   status, ' · ', then what it aims at, short enough for a small widget's two lines ('Above target · 16° until
 *   08:00, then 21°', 'At target · always 20°', 'Warming · override 22° until 18:00'); a zone the house heating won't
 *   warm has 'Won’t warm' as its status; with no target, 'Target unknown' or 'No reading or target'. The
 *   house's is the same while it runs its schedule, is held ('Warming · holds 20°, schedule off') or overridden,
 *   and else one phrase ('Switched off on the thermostat', 'Away until Sun 17:00', 'Thermostat state unknown'),
 *   or its status and 'thermostat not set up yet' ('Warming · thermostat not set up yet'). `flag` is 'Humid',
 *   'Dry air' or null.
 * @typedef {{id: string, size: 'small'|'medium'}} WidgetSlot
 *   From 700px, the page's widgets in drawing order: the house (medium), each zone (small), the rails (medium).
 *
 * @typedef {{id: 'climate', house: HouseCard, zonesTitle: string, zones: ZoneCard[], railsTitle: string, rails: RailsCard,
 *   scale: {low: string, high: string, target: string, plot: {min: number, max: number}}, widgets: WidgetSlot[]}} ClimatePage
 *   `scale` is the legend over the zones, the room scale from `low` to `high` and the target tick's word.
 * @typedef {{title: 'House heating', icon: 'home', reading: ZoneReading, note: string, details: Link,
 *   action: Control|Link|null, feedback: string, quiet: boolean}} HouseCard
 *   The card draws `title` over the reading, its `note` as a caption, `details` (opening the House sheet) in the title
 *   row and its one `action`: "Set an override…" (a link to the sheet, named 'Set an override on the house heating')
 *   while one can be set, the House sheet's Cancel (its HouseControl's `cancel`, the very Control) while an override
 *   or Away runs, none while the thermostat is unknown or missing. `feedback` is the house control's line, '' when
 *   none. `quiet` is true while the heating is switched off, Away, unknown or not set up: nothing runs or no target
 *   shows, so the card can be compact.
 * @typedef {{kind: 'missing', step: Step}
 *   | {kind: 'unknown', text: string, feedback: string}
 *   | {kind: 'away', title: string, text: string, cancel: Control, feedback: string}
 *   | {kind: 'override', step: Step, endsLabel: string, ends: Control[], start: Control, cancel: Control|null,
 *      clockWarning: string|null, offWarning: string|null, feedback: string, away: Away, footer: string|null}} HouseControl
 *   `ends` are toggle buttons (one `selected`), grouped under endsLabel; none draws no group. `footer` is the caption
 *   under the override: 'Replaces the running override' while one runs, else null (the Ends row says when a new one
 *   ends).
 * @typedef {{summary: string, text: string, field: {label: string, control: Control, min: string, max: string}, hint: string, set: Control,
 *   warning: string|null}} Away
 *   A disclosure. field.control is the uncontrolled date and time input: its intent is
 *   {command: 'away-until', entity: 'house', value: draft}, its value the input's initial
 *   value; a change sends {...intent, value}. min and max are datetime-local values. `warning` is the needs-you line
 *   while the chosen time is outside them ('Heating can come back on from 09:35 to 12 Jan 08:30.'), which iOS's date
 *   wheel doesn't enforce; null otherwise.
 * @typedef {{icon: string, name: string}} Opener
 *   A zone's glyph and name.
 * @typedef {{id: string, opener: Opener, reading: ZoneReading, link: Link}} ZoneCard
 *   A zone's row, or from 700px its small widget: the opener's name and glyph over `reading`, pressed with `link`,
 *   which opens the zone's sheet and is named with what the row shows ('Attic: 19.8°, won’t warm, 21° until 18:00,
 *   then 16°, Dry air. Open Attic').
 * @typedef {{kind: 'fixed', step: Step, feedback: string, title: string, line: string}
 *   | {kind: 'override', step: Step, cancel: Control|null, feedback: string, title: string, line: string}
 *   | {kind: 'missing', step: Step, title: string, line: string}} ZoneControl
 *   The zone sheet's Target row draws `title` over `line`, with the Step's stepper: 'Target now' and 'Changing it
 *   overrides until 18:00' while no override runs, 'Override' and 'Ends by itself at 18:00' while one does, 'Fixed
 *   target' and 'Stays until you change it' for a fixed zone, and 'Override' and 'Not set up yet' until it is set up.
 * @typedef {{kind: 'off', text: string}
 *   | {kind: 'warm', text: string, warm: Control|null, note: string|null, feedback: string|null}} WarmOffer
 *   Both are warnings; feedback is null (no line at all) while nothing is offered.
 * @typedef {{rows: RailRow[], details: Link, icon: 'bath', caption: string|null}} RailsCard
 *   `details` opens the rails' sheet from the title row, and `icon` is the widget's glyph. `caption` is the line under
 *   the rows on a phone: what Dry towels does, or that the heating is off; null while Away, which each rail's line says.
 * @typedef {{name: string, icon: 'bath', line: string, action: Control|null}} RailRow
 *   A rail's row, on the page and in its sheet. `line` is its one line: the rail's setting and its own reading ('Off ·
 *   rail 21.4°', 'Set to 22° · rail 21.4°'), 'Drying until 10:15', 'Unavailable', 'Off while Away', 'Off · drying not
 *   set up yet' while it can't dry, or its write's feedback while there is one. `action` is its accessory, Dry towels
 *   or Stop: null while Away (Stop stays while Drying), while the rail is unavailable, which the line says, or while
 *   Drying isn't set up; offline or busy keep it, disabled.
 *
 * @typedef {{id: string, title: string, eyebrow: string, body: HouseDrawer|ZoneDrawer|RailsDrawer}} Drawer
 * @typedef {{kind: 'house', why: string[], week: Week, charts: Chart[], radiators: Valves, control: HouseControl,
 *   reading: ZoneReading, titles: {temperature: 'Temperature', ends: 'Ends', why: 'Why'}, facts: SummaryFact[],
 *   outdoor: {title: 'Outside', text: string}|null}} HouseDrawer
 *   `control` is the house control, whose Cancel is also the House card's action. `titles` are the sheet's own
 *   headings. The summary draws `facts` (no Outside: `outdoor` says it), and the Outside section is `outdoor`, null
 *   while the boiler's sensor has no reading.
 * @typedef {{icon: string|null, text: string, flag: string|null, ariaLabel: string}} SummaryFact
 *   A sheet summary's fact: only with a reading ('48%', then 'Living room sensor'), named in words ('48% humidity',
 *   'Measured by the living room sensor'); `flag` ('Dry air', 'Humid') stays its own words.
 * @typedef {{kind: 'zone', warm: WarmOffer|null, warning: string|null, control: ZoneControl,
 *   schedule: Schedule|null, airco: Airco|null, charts: Chart[], radiators: Valves,
 *   reading: ZoneReading, titles: {target: 'Target', warm: 'Radiator heat'}, facts: SummaryFact[]}} ZoneDrawer
 * @typedef {{kind: 'rails', rows: RailRow[], caption: string, charts: Chart[]}} RailsDrawer
 *   `caption` is the footer under the rows: what sets the rails and what each reading is. The sheet draws no
 *   Radiators section: each rail's line gives its setting and its reading.
 * @typedef {{title: string, days: Day[]|null, text: string|null, note: string|null}} Week
 *   The thermostat's week: seven days, or `text` when it has none.
 * @typedef {{name: string, today: 'Today'|null, plan: string, bar: {width: number, warm: boolean}[]}} Day
 *   `width` is a share of the day in percent, to two decimals: draw it as `${width}%`.
 * @typedef {{title: string, today: Day|null, comfort: Helper, setback: Helper, link: Link|null, caption: string|null, note: string|null}} Schedule
 *   `caption` says only what the zone's line doesn't ('An override holds the zone until 18:00.', or why the
 *   schedule has no reading or isn't set up), null otherwise; `note` is the section's footer, 'Changing comfort or
 *   setback is not an override.', null while neither can be stepped.
 * @typedef {{step: Step, feedback: string|null, line: string|null}} Helper
 *   `line` is the row's detail: null, as the schedule's note says it for both, or 'Not set up yet'.
 * @typedef {{title: string, source: (string|{strong: string})[], heating: AircoSwitch, cooling: AircoSwitch, link: Link}} Airco
 *   `source` is one line with its first part strong; link.enabled says the Airco exists.
 * @typedef {{kind: 'missing', step: Step}
 *   | {kind: 'switch', title: string, control: Control, note: ''|'Unavailable'|'Offline', feedback: string, line: string|null}} AircoSwitch
 *   control.selected is whether the switch is on; its ariaLabel is the title. `line` is the row's detail, what the
 *   switch does ('Paused while Away' while Away), but null while the switch is unavailable, which `note` says, so it
 *   never reads as off.
 * @typedef {{rows: {name: string, line: string, probe: string, probeCaption: string}[], note: string, heading: string|null}} Valves
 *   `heading` is the section's heading, null over a single row, which names itself.
 * @typedef {{model: object, full: Link}} Chart
 *   model is history.js's historyChart(snapshot, definition), wording included; full is the intent
 *   that opens Home Assistant's history, with no label or icon, named after its chart so a sheet's
 *   are told apart ('Full history: temperature and target'). Each of the model's series carries its
 *   definition's `role` ('room', 'target', 'humidity' or 'probe', from climateHistory).
 */

const feedbackFor = (snap, key) => snap.feedback?.get(key) ?? '';
const optionsOf = snap => ({now: snap.now, tz: snap.tz});
const detailFor = id => CLIMATE_DETAILS.find(d => d.id === id);
const humidityValue = s => ({icon: 'droplet', text: percent(s.humidity), flag: s.flag});
// A sheet summary's facts: the humidity only with a reading, then the sensor
// the reading comes from, each named in words for a screen reader ('48%
// humidity'), since the droplet is only a picture. A flag stays its own
// words.
const summaryFacts = (s, sensor) => [...s.humidity === null ? [] : [{...humidityValue(s), ariaLabel: `${percent(s.humidity)} humidity`}],
  {icon: null, text: sensor, flag: null, ariaLabel: `Measured by the ${lowered(sensor)}`}];
// A setting that can't be stepped until its helper or script exists: its
// row says so under its title.
const notSetUpStep = title => ({title, detail: 'Not set up yet', stepper: null});
const stepIcon = direction => direction > 0 ? 'plus' : 'minus';
// A bar segment's share of the day, in percent.
const share = mins => Number((mins / 14.4).toFixed(2));
// The room scale, in °C: the zone capsules' (climateHeader) and the target
// bars' (#29 step 4).
const SCALE = Object.freeze({min: 14, max: 26});
const lowered = text => text.charAt(0).toLowerCase() + text.slice(1);

// A reading against its target on the room scale, named in words. A
// switched-off house has no target to aim at, which the name says. Away's
// holiday temperature is a target like any other: below the scale, its tick
// sits at the low end, as the house's capsule has it.
function targetBarValue(reading, target, off = false) {
  const aim = target !== null ? `target ${degrees(target)}` : off ? 'no target while the heating is off' : 'target unknown';
  return {plot: {reading, target, min: SCALE.min, max: SCALE.max},
    ariaLabel: reading === null ? target === null ? 'No reading' : `No reading, ${aim}` : `${readingText(reading)}, ${aim}`};
}
// What a zone or the house aims at, after its status in its line: its
// target line lowered ('21° until 18:00, then 16°', 'always 17°'), but an
// override says so first and leaves what follows it to the sheet ('override
// 22° until 18:00'), and a thermostat holding its own setpoint says its
// schedule is off ('holds 20°, schedule off'). A schedule not set up yet
// says that; otherwise null while the target is unknown.
function aimText(s, {now, tz}) {
  if (s.target === null) return s.schedule && !s.schedule.exists ? lowered(s.schedule.line) : null;
  const house = s.id === HOUSE.id, override = house ? s.mode === 'override' : s.schedule?.mode === 'override';
  if (override) {
    const end = when(house ? s.overrideUntil : s.schedule.overrideUntil, tz, now);
    return `override ${degrees(s.target)}${end ? ` until ${end}` : ''}`;
  }
  return s.mode === 'manual' ? `holds ${degrees(s.target)}, schedule off` : lowered(s.targetLine);
}
// A zone's line, short enough for a small widget's two lines: its status,
// ' · ', then what it aims at. A radiator zone below its target while the
// house thermostat isn't calling says 'Won’t warm': true while the heating
// is off, Away or simply satisfied downstairs, so it never contradicts the
// House card, and its sheet says why. With no target, the natural form:
// 'Target unknown', 'No reading or target', 'Warming · target unknown'.
function zoneLine(s, o) {
  const status = s.status.key === STATUS.belowHouseOff.key ? 'Won’t warm' : s.status.label, aim = aimText(s, o);
  if (s.status.key === STATUS.unknown.key) return aim ? `${aim.charAt(0).toUpperCase()}${aim.slice(1)}` : s.status.label;
  if (aim) return `${status} · ${aim}`;
  return s.status.key === STATUS.noReading.key ? 'No reading or target' : `${status} · target unknown`;
}
// The house's line: as a zone's while it runs its schedule, is held or
// overridden, whether or not Maison can change it; else the one phrase its
// mode says, "on the thermostat" as everywhere else. Without its sensor,
// what the house is doing still leads, as the hero says it.
function houseLine(h, o) {
  if (h.mode === null) return `${h.status.label} · thermostat not set up yet`;
  if (h.mode === 'off') return 'Switched off on the thermostat';
  return ['away', 'unknown'].includes(h.mode) ? h.targetLine : zoneLine(h, o);
}
// A zone's or the house's reading: the figure, its line, its humidity flag
// and its target bar.
const readingValue = (s, line, off = false) => ({reading: readingText(s.reading), line, flag: s.flag, bar: targetBarValue(s.reading, s.target, off)});

// The house override: a stepper, the end chips and one button that sends
// them, plus Cancel while one runs. Then Away, behind a disclosure.
function houseControlValue(snap, kit, h) {
  const {states, draft} = snap, o = optionsOf(snap), problem = houseProblem(states);
  if (problem === 'missing') return {kind: 'missing', step: notSetUpStep('Override and Away')};
  if (problem === 'unknown') return {kind: 'unknown', text: 'The thermostat’s state is unknown, so Maison can’t change it right now.', feedback: feedbackFor(snap, HOUSE_KEY)};
  if (h.mode === 'away') {
    const back = when(h.awayUntil, o.tz, o.now);
    return {kind: 'away', title: 'Away',
      text: `The thermostat holds ${h.target === null ? 'its holiday temperature' : degrees(h.target)} until ${back ? `heating comes back on at ${back}` : 'heating comes back on'}. The Airco neither heats nor cools, and towels don’t dry.`,
      cancel: kit.control({command: 'house-away-cancel', entity: HOUSE.id}, {label: 'Cancel Away'}), feedback: feedbackFor(snap, HOUSE_KEY)};
  }
  const temperature = houseDraftTemperature(states, draft), end = houseEnd(states, draft, o);
  const request = end && houseOverrideRequest(states, {temperature, until: end.until}, o);
  const step = direction => kit.control({command: 'house-step', entity: HOUSE.id, direction}, {ariaLabel: direction > 0 ? 'Warmer' : 'Cooler', icon: stepIcon(direction)});
  return {kind: 'override',
    step: {title: 'Override', stepper: {output: degrees(temperature), outputLabel: 'House heating override', minus: step(-1), plus: step(1)}},
    endsLabel: 'Override ends',
    ends: houseEnds(states, o).map(e => kit.control({command: 'house-end', entity: e.id}, {label: e.label, selected: e.id === end?.id})),
    start: kit.control({command: 'house-override', entity: HOUSE.id}, {label: request ? `Hold ${degrees(temperature)} until ${when(end.until, o.tz, o.now)}` : `Hold ${degrees(temperature)}`}),
    cancel: h.overrideUntil !== null ? kit.control({command: 'house-override-cancel', entity: HOUSE.id}, {label: 'Cancel override'}) : null,
    clockWarning: problem === 'clock' ? 'Maison can’t set times on the thermostat: its clock is unknown or more than 10 minutes out. Set its clock on the wall.' : null,
    offWarning: h.mode === 'off' ? 'Heating is switched off on the thermostat, so an override won’t warm the house until it is switched back on.' : null,
    feedback: feedbackFor(snap, HOUSE_KEY),
    away: awayValue(snap, kit),
    // The caption under the override: only while one runs, since the Ends
    // row already says when a new one ends.
    footer: h.mode === 'override' ? 'Replaces the running override' : null};
}
function awayValue(snap, kit) {
  const {now, tz} = snap, value = snap.draft?.awayUntil ?? '', until = zonedTime(value, tz);
  const request = houseAwayRequest(snap.states, {until}, {now, tz});
  return {summary: 'Away',
    text: 'The thermostat holds its holiday temperature until heating comes back on, and the Airco neither heats nor cools.',
    field: {label: 'Heating back on', control: kit.control({command: 'away-until', entity: HOUSE.id, value}),
      min: localInput(now + OVERRIDE_END_MIN_MS, tz), max: localInput(now + AWAY_END_MAX_MS, tz)},
    hint: 'Set it a few hours before you’re back, so the house is warm when you arrive.',
    set: kit.control({command: 'house-away', entity: HOUSE.id}, {label: request ? `Away until ${when(until, tz, now)}` : 'Set Away'}),
    // Why Set Away stays disabled for a time outside the field's range,
    // which iOS's date wheel doesn't enforce.
    warning: until !== null && !within(until, now, OVERRIDE_END_MIN_MS, AWAY_END_MAX_MS)
      ? `Heating can come back on from ${when(now + OVERRIDE_END_MIN_MS, tz, now)} to ${when(now + AWAY_END_MAX_MS, tz, now)}.` : null};
}
// The House card's caption: where it is measured, its humidity and the
// outside, each only with a reading, then one sentence while the heating is
// off, Away or unknown.
function houseNote(h) {
  const facts = `Measured in the living room${h.humidity === null ? '' : `, ${percent(h.humidity)} humidity`}.${h.outdoor === null ? '' : ` Outside ${readingText(h.outdoor)}.`}`;
  const more = {off: 'Overrides wait until the heating is switched back on.', away: 'The Airco neither heats nor cools.',
    unknown: 'Maison can’t change the thermostat right now.'}[h.mode];
  return more ? `${facts} ${more}` : facts;
}
// The House card's one action: Cancel while an override or Away runs (the
// control's own Cancel), "Set an override…" opening the sheet while one can
// be set, and none while the thermostat is unknown or missing.
function houseActionValue(kit, control) {
  if (control.kind === 'away') return control.cancel;
  if (control.kind !== 'override') return null;
  return control.cancel ?? kit.link({command: 'detail', entity: HOUSE.id}, {label: 'Set an override…', ariaLabel: 'Set an override on the house heating'});
}
// The House card: the reading against its target, its caption, Details and
// one action. The control itself is the House sheet's to draw.
function houseCardValue(snap, kit, h) {
  const control = houseControlValue(snap, kit, h), o = optionsOf(snap);
  return {
    title: 'House heating', icon: 'home', reading: readingValue(h, houseLine(h, o), h.mode === 'off'), note: houseNote(h),
    details: kit.link({command: 'detail', entity: HOUSE.id}, {label: 'Details', ariaLabel: 'House heating details'}),
    action: houseActionValue(kit, control), feedback: control.feedback ?? '',
    // Nothing to aim at or nothing running: the card can be compact.
    quiet: [null, 'off', 'away', 'unknown'].includes(h.mode)};
}

// A fixed zone's "+"/"−" moves its valve's target; a scheduled zone's sets an
// override until the next period starts.
function zoneControlValue(snap, kit, zone, s) {
  const {states} = snap, o = optionsOf(snap), output = degrees(s.target), outputLabel = `${zone.name} target`;
  if (zone.kind === 'fixed') {
    const step = direction => kit.control({command: 'zone-step', entity: zone.id, direction},
      {ariaLabel: `${direction > 0 ? 'Raise' : 'Lower'} the target for ${zone.name}`, icon: stepIcon(direction)});
    return {kind: 'fixed', step: {title: 'Fixed target', stepper: {output, outputLabel, minus: step(-1), plus: step(1)}},
      feedback: feedbackFor(snap, zone.valves[0].id), title: 'Fixed target', line: 'Stays until you change it'};
  }
  if (!zoneOverrideReady(states, zone)) return {kind: 'missing', step: notSetUpStep('Override'), title: 'Override', line: 'Not set up yet'};
  const sch = s.schedule, running = sch.mode === 'override';
  const step = direction => kit.control({command: 'zone-override', entity: zone.id, direction},
    {ariaLabel: `Override ${zone.name} ${direction > 0 ? 'warmer' : 'cooler'}`, icon: stepIcon(direction)});
  return {kind: 'override',
    step: {title: 'Override', stepper: {output, outputLabel, minus: step(-1), plus: step(1)}},
    cancel: running ? kit.control({command: 'zone-override-cancel', entity: zone.id}, {label: 'Cancel override'}) : null,
    feedback: feedbackFor(snap, zone.target),
    // The Target row: the scheduled target while no override runs, and what
    // a step would do to it; the override and its end while one does.
    title: running ? 'Override' : 'Target now',
    line: !running ? `Changing it overrides until ${sch.changeAt ?? 'the next period starts'}`
      : sch.overrideUntil !== null ? `Ends by itself at ${when(sch.overrideUntil, o.tz, o.now)}` : 'Until the next period starts'};
}
// What a zone that won't warm says, and "Warm the house … too" when it can.
function warmValue(snap, kit, zone) {
  const offer = warmOffer(zone, snap.states, optionsOf(snap));
  if (!offer) return null;
  if (offer.kind === 'off') return {kind: 'off', text: offer.text};
  return {kind: 'warm', text: offer.text,
    warm: offer.request ? kit.control({command: 'house-warm', entity: zone.id}, {label: offer.label, icon: 'home'}) : null,
    note: offer.note || null, feedback: offer.request ? feedbackFor(snap, HOUSE_KEY) : null};
}
// A zone's row and widget: its name and glyph over its reading, pressed
// with `link`, which is named with what they show: the reading, the line in
// the page's words and the flag, so the name never says what the line
// doesn't.
function zoneCardValue(snap, kit, zone, s) {
  const reading = readingValue(s, zoneLine(s, optionsOf(snap)));
  const shown = [s.reading === null ? null : reading.reading, lowered(reading.line).replace(' · ', ', '), reading.flag].filter(Boolean).join(', ');
  return {id: zone.id, opener: {icon: zone.icon, name: zone.name}, reading,
    link: kit.link({command: 'detail', entity: zone.id}, {ariaLabel: `${zone.name}: ${shown}. Open ${zone.name}`})};
}

// One rail's row, on the page and in its sheet: its one line, and Dry towels
// or Stop as its accessory.
function railRowValue(snap, kit, rail, r) {
  const {states} = snap, away = houseMode(states) === 'away', drying = r.status.key === 'drying';
  const ready = dryingReady(states, rail);
  const control = !ready ? null : drying
    ? kit.control({command: 'drying-stop', entity: rail.id}, {label: 'Stop', ariaLabel: `Stop drying on the ${rail.name} towel rail`})
    : kit.control({command: 'drying-start', entity: rail.id}, {label: 'Dry towels', ariaLabel: `Dry towels on the ${rail.name} towel rail for an hour`, icon: 'droplet'});
  const feedback = feedbackFor(snap, rail.drying);
  // The line, short enough for a phone's row: its write's feedback while
  // there is one; Drying and Unavailable say it all; while Away, the setting
  // and why there is no Dry towels, beside where it would be; otherwise the
  // setting, then the rail's own reading (its valve's probe, never a room's),
  // or why there is never a Dry towels to press.
  const setting = r.status.key === 'frost' ? 'Off' : r.status.label, unavailable = r.status.key === 'unavailable';
  const line = feedback || (drying || unavailable ? r.status.label : away ? `${setting} while Away`
    : [setting, !ready ? 'drying not set up yet' : r.probe === null ? '' : `rail ${readingText(r.probe)}`].filter(Boolean).join(' · '));
  // The accessory: the control, but none while Away or while the rail is
  // unavailable, lasting reasons the line gives. Offline or busy keep it,
  // disabled, so the row doesn't jump.
  const action = (away && !drying) || unavailable ? null : control;
  return {name: r.name, icon: 'bath', line, action};
}
// The rails' caption under the rows on a phone: what Dry towels does, or
// that the heating is off; none while Away, which each rail's line says
// beside its missing button.
function railsCardCaption(states) {
  const mode = houseMode(states);
  return mode === 'away' ? null : mode === 'off' ? 'Heating is switched off on the thermostat, so the rails won’t warm.'
    : 'Dry towels opens a rail for an hour, then it goes back to frost protection. A rail only warms while the house heating runs.';
}
// The rails' caption in their sheet: what sets them, now, and what each
// reading is, in place of a Radiators section.
function railsCaption(states) {
  const mode = houseMode(states);
  const now = mode === 'off' ? 'Heating is switched off on the thermostat, so the rails won’t warm. Only Drying and frost protection set them.'
    : mode === 'away' ? 'The rails stay at frost protection until Away ends.'
    : 'Dry towels opens a rail for an hour, then it goes back to frost protection; nothing else sets the rails. A rail only warms while the house heating runs.';
  return `${now} There is no room sensor here: each reading is the rail’s own.`;
}
// The towel rails' widget: their rows, Details and their caption.
function railsCardValue(snap, kit, rails) {
  return {
    rows: TOWEL_RAILS.map((rail, i) => railRowValue(snap, kit, rail, rails[i])),
    details: kit.link({command: 'detail', entity: 'towel-rails'}, {label: 'Details', ariaLabel: 'Towel rails details'}),
    icon: 'bath', caption: railsCardCaption(snap.states)};
}

/**
 * The Climate page: House heating, the zones, then the Towel rails.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @returns {ClimatePage}
 */
export function climatePageValue(snap, kit) {
  const {states} = snap, o = optionsOf(snap);
  return {id: 'climate',
    house: houseCardValue(snap, kit, houseStatus(states, o)),
    zonesTitle: 'Zones', zones: ZONES.map(z => zoneCardValue(snap, kit, z, zoneStatus(z, states, o))),
    railsTitle: 'Towel rails', rails: railsCardValue(snap, kit, TOWEL_RAILS.map(r => railStatus(r, states, o))),
    scale: {low: degrees(SCALE.min), high: degrees(SCALE.max), target: 'Target', plot: {min: SCALE.min, max: SCALE.max}},
    widgets: [{id: HOUSE.id, size: 'medium'}, ...ZONES.map(z => ({id: z.id, size: 'small'})), {id: 'rails', size: 'medium'}]};
}

// ---- Drawer values -------------------------------------------------------
// A sheet's radiators, read-only: each valve's setting and its probe. The
// section has no heading over a single row, which names itself ('Radiator'
// over 'Radiator' stuttered), as an iOS group can be headerless.
const valvesValue = (title, valves, note) => ({rows: valves.map(v => ({name: v.name, line: v.line, probe: readingText(v.probe), probeCaption: 'Valve probe'})), note,
  heading: valves.length === 1 ? null : title});
// The drawer's 24-hour charts, one per definition in its cache group.
// Each Full history is named by its chart, so a sheet's are told apart.
const chartsValue = (snap, kit, id) => climateHistory(snap.states).filter(h => h.group === `climate-${id}`).map(h => {
  const model = historyChart(snap, h);
  return {model, full: kit.link({command: 'native-history', entity: h.key}, {ariaLabel: `${model.fullLabel}: ${lowered(model.title)}`})};
});

// The thermostat's week, read-only, in its own clock, with its today marked.
function weekValue(h, {now, tz}) {
  const title = 'Weekly schedule';
  if (!h.week) return {title, days: null, text: `${h.mode === null ? 'The thermostat’s weekly schedule isn’t readable here yet.' : 'The thermostat’s weekly schedule has no reading.'} Change it on the thermostat.`, note: null};
  const today = thermostatClock(now, h.clockOffset, tz).day;
  const days = DAYS.map(day => {
    const periods = h.week[day], base = Math.min(...periods.map(p => p.temperature)), warm = periods.filter(p => p.temperature !== base);
    return {name: day[0].toUpperCase() + day.slice(1, 3), today: day === today ? 'Today' : null,
      plan: warm.length ? `${warm.map(p => `${degrees(p.temperature)} ${p.start}–${p.end}`).join(' · ')}, otherwise ${degrees(base)}` : `${degrees(base)} all day`,
      bar: periods.map(p => ({width: share(minutes(p.end) - minutes(p.start)), warm: p.temperature > base}))};
  });
  const offset = h.clockOffset, late = offset !== null && Math.abs(offset) >= 60 ? Math.round(Math.abs(offset) / 60) : 0;
  const drift = late ? ` Its clock is ${late} min ${offset > 0 ? 'slow' : 'fast'}, so these run ${late} min ${offset > 0 ? 'late' : 'early'}.` : '';
  return {title, days, text: null, note: `Read-only: times as set on the thermostat. Change them there.${drift}`};
}
// The House sheet: the reading, the house control, why, the week, the
// charts, Outside and the radiators.
function houseDrawerValue(snap, kit) {
  const o = optionsOf(snap), h = houseStatus(snap.states, o);
  return {kind: 'house', why: h.why, week: weekValue(h, o),
    charts: chartsValue(snap, kit, HOUSE.id),
    radiators: valvesValue('Downstairs radiators', h.valves, 'Not controls: the house thermostat decides when the Open plan warms. Valve probes measure the radiator, not the room.'),
    control: houseControlValue(snap, kit, h), reading: readingValue(h, houseLine(h, o), h.mode === 'off'),
    titles: {temperature: 'Temperature', ends: 'Ends', why: 'Why'},
    // The summary leaves Outside to its own section, which is none without
    // a reading.
    facts: summaryFacts(h, HOUSE.readingLabel),
    outdoor: h.outdoor === null ? null : {title: 'Outside', text: `${readingText(h.outdoor)} from the boiler’s own sensor, on the north wall and always in shade.`}};
}

// A scheduled zone's day as one row like the thermostat's week, comfort
// marked on the bar.
function todayValue(periods, {now, tz}) {
  const bar = [];
  let cursor = 0;
  for (const p of [...periods].sort((a, b) => minutes(a.from) - minutes(b.from))) {
    if (minutes(p.from) > cursor) bar.push([minutes(p.from) - cursor, false]);
    bar.push([minutes(p.to) - Math.max(cursor, minutes(p.from)), true]);
    cursor = Math.max(cursor, minutes(p.to));
  }
  if (cursor < 1440) bar.push([1440 - cursor, false]);
  return {name: zoned(tz, {weekday: 'short'}).format(new Date(now)), today: 'Today', plan: periodsLine(periods),
    bar: bar.filter(([width]) => width > 0).map(([width, warm]) => ({width: share(width), warm}))};
}
// A comfort or setback helper: stepping it is not an override.
function helperValue(snap, kit, id, label, value) {
  const steppable = helperSteppable(snap.states, id);
  const button = direction => kit.control({command: 'step', entity: id, direction}, {ariaLabel: `${direction > 0 ? 'Raise' : 'Lower'} ${label.toLowerCase()}`, icon: stepIcon(direction)});
  return {step: {title: label, stepper: {output: degrees(value), outputLabel: label, minus: steppable ? button(-1) : null, plus: steppable ? button(1) : null}},
    feedback: steppable ? feedbackFor(snap, id) : null,
    // The row's detail: none, as the schedule's note says it once for both,
    // unless it can't be stepped.
    line: steppable ? null : 'Not set up yet'};
}
function scheduleValue(snap, kit, zone, s) {
  const o = optionsOf(snap), sch = s.schedule;
  // Until the day's periods load, or when they can't, the current period and
  // next change stand alone.
  const periods = sch.schedule ? todaysPeriods(snap.loaded?.schedules?.[sch.schedule.id], o) : null;
  const comfort = helperValue(snap, kit, zone.comfort, 'Comfort', sch.comfort), setback = helperValue(snap, kit, zone.setback, 'Setback', sch.setback);
  // The caption says only what the zone's line doesn't: an override's hold,
  // or why the schedule can't say where it is.
  const until = when(sch.overrideUntil, o.tz, o.now) ?? sch.changeAt;
  const caption = !sch.exists && !sch.schedule ? 'This zone’s schedule isn’t set up in Home Assistant yet.'
    : sch.period === null ? 'The schedule has no current reading.'
    : sch.mode === 'override' ? `An override holds the zone until ${until ?? 'the next period starts'}.` : null;
  return {title: 'Today', today: periods ? todayValue(periods, o) : null, comfort, setback,
    caption, note: comfort.line && setback.line ? null : 'Changing comfort or setback is not an override.',
    link: sch.schedule ? kit.link({command: 'more', entity: sch.schedule.id},
      {label: sch.schedule.editable ? 'Edit schedule in Home Assistant' : 'Open the schedule in Home Assistant', icon: 'clock'}) : null};
}
// An Airco switch, or "Not set up yet" while its helper is missing. While
// Away both are paused: the setting stays, the automations wait.
function aircoSwitchValue(snap, kit, id, title, does, away) {
  const s = snap.states[id];
  if (!s) return {kind: 'missing', step: notSetUpStep(title)};
  const on = s.state === 'on';
  return {kind: 'switch', title,
    control: kit.control({command: 'toggle', entity: id}, {ariaLabel: title, selected: on}),
    note: !available(s) ? 'Unavailable' : !snap.online ? 'Offline' : '', feedback: feedbackFor(snap, id),
    // The row's detail: what the switch does, but none while it is
    // unavailable, which its note says, so it never reads as off.
    line: !available(s) ? null : away ? 'Paused while Away' : does(on)};
}
function aircoValue(snap, kit, zone, s) {
  const away = houseMode(snap.states) === 'away';
  return {title: 'Heat source and cooling', source: [{strong: s.airco.sourceLabel}, ` · Airco ${s.airco.line.toLowerCase()}`],
    heating: aircoSwitchValue(snap, kit, zone.aircoHeating, 'Let the Airco heat when cheaper',
      on => on ? 'The Airco heats the Attic when a kWh of heat costs less from it than from the boiler' : 'Off: only the radiators heat the Attic', away),
    cooling: aircoSwitchValue(snap, kit, CLIMATE_CONTRACT.aircoCooling, 'Airco cooling',
      () => `Cools to ${degrees(AIRCO_COOLING.target)} when the attic passes ${degrees(AIRCO_COOLING.above)} on hot days`, away),
    link: kit.link({command: 'more', entity: zone.airco}, {label: 'Airco controls', icon: 'climate'})};
}
// A zone's sheet: the reading, why it won't warm, its target, its schedule
// and Airco where it has them, the charts and the radiators.
function zoneDrawerValue(snap, kit, zone) {
  const s = zoneStatus(zone, snap.states, optionsOf(snap)), warm = warmValue(snap, kit, zone);
  return {kind: 'zone', warm, warning: !warm && s.warnHouseOff ? 'Radiators only give heat while the house heating calls for it, and it isn’t calling now.' : null,
    control: zoneControlValue(snap, kit, zone, s),
    schedule: zone.kind === 'scheduled' ? scheduleValue(snap, kit, zone, s) : null,
    airco: s.airco ? aircoValue(snap, kit, zone, s) : null,
    charts: chartsValue(snap, kit, zone.id),
    radiators: valvesValue(zone.valves.length > 1 ? 'Radiators' : 'Radiator', s.valves, 'Read-only here. Valve probes measure the radiator, not the room.'),
    reading: readingValue(s, zoneLine(s, optionsOf(snap))), titles: {target: 'Target', warm: 'Radiator heat'}, facts: summaryFacts(s, zone.readingLabel)};
}
// The towel rails' sheet: the page's rows, what sets them, and their charts.
function railsDrawerValue(snap, kit) {
  const rails = TOWEL_RAILS.map(r => railStatus(r, snap.states, optionsOf(snap)));
  return {kind: 'rails', rows: TOWEL_RAILS.map((rail, i) => railRowValue(snap, kit, rail, rails[i])), caption: railsCaption(snap.states),
    charts: chartsValue(snap, kit, 'towel-rails')};
}

/**
 * A Climate drawer: 'house', a zone id or 'towel-rails'; null for any other id.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @param {string} id
 * @returns {Drawer|null}
 */
export function climateDrawerValue(snap, kit, id) {
  const d = detailFor(id);
  if (!d) return null;
  const zone = ZONES.find(z => z.id === id);
  const body = id === HOUSE.id ? houseDrawerValue(snap, kit) : id === 'towel-rails' ? railsDrawerValue(snap, kit) : zoneDrawerValue(snap, kit, zone);
  return {id, title: d.name, eyebrow: d.rooms, body};
}

// ---- Header value (#29 step 3) ---------------------------------------------
/**
 * @typedef {{kind: 'zones', min: number, max: number, zones: ZoneCapsule[], ariaLabel: string}} ZonesHero
 *   Climate's header chart: the house first (named 'Living', from houseStatus), then ZONES (from zoneStatus,
 *   named by their `short`); the towel rails are left out. min and max are the capsules' scale in °C. ariaLabel
 *   is the whole reading in one sentence ('Zone temperatures: Living 23.4°, heating switched off; Attic 24.2°,
 *   target 16°; …').
 * @typedef {{id: string, name: string, reading: string, plot: {reading: number|null, target: number|null}, ariaLabel: string}} ZoneCapsule
 *   id is 'house' or the zone's id; reading '23.4°' or '—'. plot.target is null while the house heating is
 *   off (the house's capsule) or the target is unknown. ariaLabel reads the capsule ('Living: 23.4°, heating
 *   switched off', 'Attic: no reading, target 16°').
 */

// The capsules in order, each as [id, name, reading, target, what it aims
// at]: the house, then the zones. Only room sensors are read, never a
// valve's probe, and the towel rails are left out.
function capsuleParts(h, states, o) {
  const aim = target => target === null ? 'target unknown' : `target ${degrees(target)}`;
  return [[HOUSE.id, 'Living', h.reading, h.target, h.mode === 'off' ? 'heating switched off' : aim(h.target)],
    ...ZONES.map(zone => {const s = zoneStatus(zone, states, o); return [zone.id, zone.short, s.reading, s.target, aim(s.target)];})];
}
// A capsule in words: '23.4°, target 16°', or 'no reading, target 16°'.
const capsuleWords = (reading, aim) => `${reading === null ? 'no reading' : readingText(reading)}, ${aim}`;

/**
 * Climate's header: the line under the title (the house's targetLine while
 * its mode is off, away or unknown, else its status label) and the zone
 * capsules, from the snapshot only. The house's capsule has no target while
 * its heating is switched off; the zones keep theirs.
 * @param {object} snap the element's snapshot
 * @returns {{line: string, hero: ZonesHero}}
 */
export function climateHeader(snap) {
  const o = optionsOf(snap), h = houseStatus(snap.states, o), parts = capsuleParts(h, snap.states, o);
  return {line: ['off', 'away', 'unknown'].includes(h.mode) ? h.targetLine : h.status.label,
    hero: {kind: 'zones', min: SCALE.min, max: SCALE.max,
      zones: parts.map(([id, name, reading, target, aim]) => ({id, name, reading: readingText(reading), plot: {reading, target}, ariaLabel: `${name}: ${capsuleWords(reading, aim)}`})),
      ariaLabel: `Zone temperatures: ${parts.map(([, name, reading, , aim]) => `${name} ${capsuleWords(reading, aim)}`).join('; ')}.`}};
}
