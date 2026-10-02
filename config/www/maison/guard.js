// The one place a write or draft intent is allowed or refused (#27). A control
// is enabled only when guard() returns an action for its intent, and a press
// goes through only then, so what a control shows and what it does agree.
//
// guard(intent, snapshot) → {key, call?, draft?} | null
// - intent: {command, entity?, direction?, value?}; direction is coerced with Number().
// - call: {domain, service, entity, data, options}, what service() sends.
// - draft: the house card's new draft (override stepper, end chip, Away date).
// - key: the busy lock and feedback line, as service() computes it for call.
// Online and busy belong to the action lifecycle, not here: screen.js's
// allowed() adds them. guard() never reads the element, never calls
// Date.now() (the snapshot carries `now`) and never throws: an unknown or
// navigation command, a missing entity or script, an unreadable value or a
// refused rule is null.
//
// Where a card disables a control for a reason of its own (a step at its
// limit, the thermostat's clock out, a part not set up yet), the rule here is
// that same reason, so nothing the card disables can be sent.
import {E, ZONES, TOWEL_RAILS, CLIMATE_CONTRACT, available, numeric} from './model.js?v=38';
import {CLIMATE_SCRIPTS, climateRequest, dryingReady, helperSteppable, houseDraftStep, houseEnds, houseProblem, houseStatus, zoneOverrideReady, zoneTargetStep} from './climate.js?v=38';
import {carStatus} from './car.js?v=38';

const HOUSE_KEY = CLIMATE_CONTRACT.houseHeating;
const VACUUM = ['start', 'pause', 'return_to_base'];
// Every write and draft command guard() decides. Anything else is navigation
// or unknown, and guard() returns null for it.
export const WRITE_COMMANDS = Object.freeze(new Set(['toggle', 'step', 'zone-step', 'house-step', 'house-end', 'away-until',
  'house-override', 'house-override-cancel', 'house-away', 'house-away-cancel', 'house-warm', 'zone-override', 'zone-override-cancel',
  'drying-start', 'drying-stop', 'charge-now', 'charge-automatic', 'charge-refresh', 'charge-limit', 'vacuum']));

// The only valves Maison writes: the fixed zones' (Bedroom suite, Noah's
// room). Scheduled zones, the house valves and the towel rails are read-only.
export const climateIds = new Set(ZONES.filter(z => z.kind === 'fixed').map(z => z.valves[0].id));
// The only switches Maison flips: Automatic charging on the Car tab, and Let
// the Airco heat when cheaper and Airco cooling in the Attic drawer.
export const toggleIds = new Set([E.carSmart, E.heatingAuto, CLIMATE_CONTRACT.aircoCooling]);
// `value` on a helper's grid within its min and max, or null when the helper
// is unavailable or its limits are unreadable.
export function helperTarget(state, value) {
  if (!available(state) || !Number.isFinite(value)) return null;
  const {min, max, step} = state.attributes || {};
  if ([min, max, step].some(x => numeric(x) === null) || step <= 0 || max < min) return null;
  return Number(Math.min(max, Math.max(min, Number(min) + Math.round((value - min) / step) * step)).toFixed(6));
}

// service()'s busy key for a call: options.key, else the entity, else the service.
const keyOf = call => call.options?.key || call.entity || `${call.domain}.${call.service}`;
const send = (call, draft) => ({key: keyOf(call), call, ...(draft ? {draft} : {})});
const plain = (domain, service, entity, data = {}) => ({domain, service, entity, data, options: {}});
// A Climate request is a script.turn_on of an allowlisted script, confirmed as
// the request says: the request itself is service()'s options.
const script = request => request && CLIMATE_SCRIPTS.includes(request.script)
  ? {domain: 'script', service: 'turn_on', entity: request.script, data: {variables: request.variables}, options: request} : null;
const orNull = (call, draft) => call ? send(call, draft) : null;

export function guard(intent, snapshot) {
  const {command, entity: e = '', value} = intent || {};
  const s = snapshot || {}, states = s.states || {}, draft = s.draft || {};
  // Every snapshot carries the time it was taken; without one nothing that
  // depends on it can be judged, and guard() never reads the clock itself.
  if (!WRITE_COMMANDS.has(command) || !Number.isFinite(s.now)) return null;
  const dir = Number(intent?.direction), o = {now: s.now, tz: s.tz};
  const climate = () => script(climateRequest(command, states, {entity: e, direction: dir}, {...o, draft}));
  // The house override and Away can be edited only while the card draws them
  // enabled: the thermostat known, its clock in time, and not Away.
  const open = () => houseProblem(states) === null && houseStatus(states, o).mode !== 'away';
  // The card draws the house controls at all only once the thermostat and its
  // scripts exist and its state is known.
  const drawn = () => !['missing', 'unknown'].includes(houseProblem(states));
  const car = () => carStatus(states, {now: s.now, zone: s.tz});
  // A charging script Home Assistant doesn't have, or can't run, is refused.
  const charging = (ok, script) => ok && available(states[script]) ? send(plain('script', 'turn_on', script)) : null;
  switch (command) {
    // One of the three allowlisted switches, while it is available: an
    // unavailable switch has no state to flip, and its card disables it.
    case 'toggle':
      return toggleIds.has(e) && available(states[e]) ? send(plain('input_boolean', states[e].state === 'on' ? 'turn_off' : 'turn_on', e)) : null;
    // A scheduled zone's comfort or setback, one helper step within its limits.
    case 'step': {
      if (!helperSteppable(states, e) || ![-1, 1].includes(dir)) return null;
      const a = states[e].attributes, current = numeric(states[e].state), [min, max, step] = [a.min, a.max, a.step].map(numeric);
      // At the helper's min or max the step would change nothing, so the card
      // disables it and it is refused.
      if (dir > 0 ? current >= max : current <= min) return null;
      return send(plain('input_number', 'set_value', e, {value: Math.min(max, Math.max(min, current + dir * step))}));
    }
    // A fixed zone's target, one valve step. Scheduled zones, the house and
    // the towel rails never pass zoneTargetStep.
    case 'zone-step': {
      const next = zoneTargetStep(e, states, dir);
      return next && climateIds.has(next.entity) ? send(plain('climate', 'set_temperature', next.entity, {temperature: next.temperature})) : null;
    }
    // The house override's draft: the stepper, the end chips and the Away date
    // change only while the card draws them enabled. Maison can't set times on
    // a thermostat whose clock is out, and draws none of them while it is
    // missing, unknown or Away.
    case 'house-step': {
      const next = open() && houseDraftStep(states, draft, dir);
      return next ? {key: HOUSE_KEY, draft: {house: next}} : null;
    }
    case 'house-end':
      return open() && houseEnds(states, o).some(end => end.id === e) ? {key: HOUSE_KEY, draft: {houseEnd: e}} : null;
    case 'away-until':
      return open() ? {key: HOUSE_KEY, draft: {awayUntil: String(value ?? '')}} : null;
    // The house override spends its draft once sent, and Away its date.
    case 'house-override': return orNull(climate(), {house: null});
    case 'house-away': return orNull(climate(), {awayUntil: ''});
    // A cancel needs no clock, but only exists while the card draws the house
    // controls: the thermostat and its scripts there and its state known.
    case 'house-override-cancel':
    case 'house-away-cancel':
      return drawn() ? orNull(climate()) : null;
    // The request is warmOffer()'s: the card offers it exactly then.
    case 'house-warm':
    case 'zone-override':
      return orNull(climate());
    // A zone's Cancel only once the zone's override is set up (its target and
    // the zone override script), as the card draws it.
    case 'zone-override-cancel':
      return zoneOverrideReady(states, ZONES.find(z => z.id === e)) ? orNull(climate()) : null;
    // Dry towels and Stop only once the rail's Drying is set up (its Drying
    // sensor and both Drying scripts), as the card draws them.
    case 'drying-start':
    case 'drying-stop':
      return dryingReady(states, TOWEL_RAILS.find(r => r.id === e)) ? orNull(climate()) : null;
    // Charging commands follow carStatus(), as the Car page does. Charge now
    // needs the Charger connected, a verified session and a Car online with
    // fresh data, and is offered only while plugged in, not overriding and
    // below the charge limit, where there is something to charge.
    case 'charge-now': {
      const c = car();
      return charging(c.plugged && !c.override && c.controls.chargeNow.enabled, E.carNow);
    }
    // Return to automatic ends an override, so only while one runs.
    case 'charge-automatic': {
      const c = car();
      return charging(c.plugged && c.override, E.carAutomatic);
    }
    // Wake & refresh only while the connected Car's data is stale or its
    // session unverified: otherwise there is nothing to refresh.
    case 'charge-refresh':
      return charging(car().controls.wake, E.carRefresh);
    // The charge limit moves 5% on the entity's grid, with fresh data. At the
    // entity's min or max the step would change nothing, so it is refused.
    case 'charge-limit': {
      if (e !== E.carLimit || ![-1, 1].includes(dir) || !car().canCommand) return null;
      const current = numeric(states[E.carLimit]?.state), target = current === null ? null : helperTarget(states[E.carLimit], current + 5 * dir);
      return target === null || target === current ? null : send(plain('number', 'set_value', E.carLimit, {value: target}));
    }
    // Three commands on the one vacuum, while it is available to take them.
    case 'vacuum':
      return VACUUM.includes(e) && available(states[E.vacuum]) ? send(plain('vacuum', e, E.vacuum)) : null;
    default: return null;
  }
}
