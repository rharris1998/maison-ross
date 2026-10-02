// The Car tab and its Today glance (#13). Maison treats the Car as a load on
// the house: what charging is doing and why, whether the Car will be ready,
// how to charge it now and where its energy came from, as the page's cards
// and the two sheets they open (#29 step 4, v34: CAR_DETAILS,
// carDrawerValue). Terms follow CONTEXT.md.
// Every state and reason comes from sensor.tesla_charge_policy and whether the
// vehicle is the Car from sensor.verified_session; nothing here decides
// charging. Whether a command is enabled, and sent, is guard.js's decision.
import {E, numeric, available, power, pretty} from './model.js?v=38';

// The Charger drops out for a minute or two dozens of times a day. Only a
// longer silence is worth a headline; until then the last one stands.
export const CHARGER_OFFLINE_AFTER = 5 * 60000;
// The Charger reads about 5 W with nothing charging.
const DRAWING_W = 50;

const zoned = (zone, options) => new Intl.DateTimeFormat('en-GB', {hourCycle: 'h23', timeZone: zone, ...options});
const dayKey = (ms, zone) => zoned(zone, {year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms));
export function clock(ms, zone, now = Date.now()) {
  const time = zoned(zone, {hour: '2-digit', minute: '2-digit'}).format(new Date(ms));
  if (dayKey(ms, zone) === dayKey(now, zone)) return time;
  if (Math.abs(ms - now) < 6 * 86400000) return `${zoned(zone, {weekday: 'short'}).format(new Date(ms))} ${time}`;
  return zoned(zone, {day: 'numeric', month: 'short'}).format(new Date(ms));
}

// Who is at the Charger and whether the Car's readings are live. Both the UI
// and the command guards read this, so a disabled control cannot be sent.
export function carControls(states, now = Date.now()) {
  const value = id => states[id]?.state, policy = key => states[E.carPolicy]?.attributes?.[key];
  const plug = value(E.carConnected), policyState = available(states[E.carPolicy]) ? value(E.carPolicy) : null;
  const charger = plug === 'on' ? 'connected' : plug === 'off' ? 'unplugged'
    : now - (Date.parse(states[E.carConnected]?.last_changed || '') || 0) < CHARGER_OFFLINE_AFTER ? 'reconnecting' : 'offline';
  // tesla_fleet re-reports a sleeping Car's last values, so only a Car that
  // reports itself online has live readings, whatever their report time.
  const carOnline = value(E.carOnline) === 'on';
  const fresh = carOnline && policy('vehicle_data_valid') === true;
  // The module proves another vehicle only from an online Car's fresh data; a
  // sleeping Car leaves the session unverified.
  const verified = value(E.carSession) === 'verified';
  const otherVehicle = charger === 'connected' && value(E.carSession) === 'other_vehicle';
  const plugged = ['connected', 'reconnecting'].includes(charger) && !otherVehicle;
  const canCommand = charger === 'connected' && fresh && verified;
  return {policy: policyState, charger, carOnline, fresh, verified, otherVehicle, plugged, canCommand,
    override: value(E.carOverride) === 'on', automatic: value(E.carSmart) === 'on'};
}

function reading(states, liveId, lastId, fresh) {
  const live = fresh ? numeric(states[liveId]?.state) : null;
  if (live !== null) return {value: live, live: true, confirmedAt: null};
  const last = numeric(states[lastId]?.state);
  return {value: last, live: false, confirmedAt: last === null ? null : Date.parse(states[lastId]?.attributes?.confirmed_at || '') || null};
}

const SOLAR = ['surplus', 'solar_settling', 'solar_deficit_confirming', 'solar_ridethrough'];
// next_offpeak is 'Now', 'Today 22:00' or 'Tomorrow 11:00'; show '22:00' or '11:00 tomorrow'.
const offpeakTime = states => String(states[E.carPolicy]?.attributes?.next_offpeak || '')
  .replace(/^Today\s+/, '').replace(/^Tomorrow\s+(.+)$/, '$1 tomorrow');
/** A power reading in W, whether Home Assistant reports it in W or kW; null without a number. */
export function wattsOf(state) {
  const value = numeric(state?.state);
  return value === null ? null : state?.attributes?.unit_of_measurement === 'kW' ? value * 1000 : value;
}
const chargerWatts = states => wattsOf(states[E.carPower]);
// Two phrases the Battery card tells apart (batteryLine):
// an offline Charger's detail without a time, and the plan at the limit.
const NO_RESPONSE = 'No response from the Charger', AT_LIMIT = 'At the charge limit';
function headline(states, c, limit, drawing, zone, now) {
  const attr = key => states[E.carPolicy]?.attributes?.[key];
  const offpeakAt = offpeakTime(states);
  const target = limit.value === null ? null : Math.round(limit.value);
  if (c.charger === 'offline') {
    const since = Date.parse(states[E.carConnected]?.last_changed || '');
    return {key: 'charger_offline', headline: 'Charger offline', detail: since ? `No response since ${clock(since, zone, now)}` : NO_RESPONSE};
  }
  if (c.charger === 'reconnecting') return {key: 'reconnecting', headline: 'Reconnecting to the Charger', detail: 'Its last reading was a moment ago'};
  if (c.charger === 'unplugged') return {key: 'unplugged', headline: 'Unplugged', detail: 'Not connected to the Charger'};
  if (!c.policy) return {key: 'unavailable', headline: 'Charging status unavailable', detail: 'The charging policy has no current reading'};
  if (c.policy === 'initializing') return {key: 'initializing', headline: 'Starting up', detail: 'Restoring charging timers'};
  if (c.otherVehicle) return {key: 'other_vehicle', headline: drawing ? 'Another vehicle is charging' : 'Another vehicle is plugged in', detail: 'The Car is not the vehicle at the Charger'};
  switch (c.policy) {
    // The policy can lag the Charger's own report by a render.
    case 'connection_unavailable': return {key: 'reconnecting', headline: 'Reconnecting to the Charger', detail: 'Its last reading was a moment ago'};
    case 'off': return {key: 'automatic_off', headline: 'Automatic charging off', detail: 'The Car charges as Tesla decides'};
    case 'unverified': return {key: 'not_verified', headline: 'Plugged in · not yet verified', detail: 'Wake the Car to confirm it is the vehicle at the Charger'};
    case 'vehicle_unavailable': return {key: 'stale', headline: 'Car data is stale', detail: 'Wake the Car for a fresh battery level and charge limit'};
    case 'power_unavailable': return {key: 'power_missing', headline: 'Power readings missing', detail: 'Automatic charging pauses until the meters report'};
    case 'complete': return {key: 'complete', headline: 'At charge limit', detail: target === null ? 'Charge limit reached' : `${target}% reached`};
    case 'charge_now': return {key: 'charge_now', headline: 'Charge now', detail: target === null ? 'Charging without waiting' : `Charging to ${target}% without waiting`};
    case 'ready_reserve': {
      const reserve = numeric(attr('ready_reserve'));
      const to = reserve === null ? null : target === null ? reserve : Math.min(reserve, target);
      return {key: 'offpeak', headline: 'Charging off-peak', detail: to === null ? 'Restoring the ready reserve' : `Restoring the ready reserve to ${to}%`};
    }
    case 'economical_grid': return {key: 'economical', headline: 'Charging (economical)', detail: 'Grid charging now costs less over the year'};
    case 'solar_ridethrough': return {key: 'solar_ridethrough', headline: 'Charging from solar', detail: 'Briefly from the grid while solar dips'};
    case 'load_wait': return {key: 'house_busy', headline: 'Waiting', detail: 'House is busy'};
    case 'peak_wait': return {key: 'wait_offpeak', headline: 'Waiting', detail: offpeakAt && offpeakAt !== 'Now' ? `For off-peak at ${offpeakAt}` : 'For off-peak'};
    case 'solar_wait': return {key: 'wait_sun', headline: 'Waiting', detail: 'For sun'};
    case 'solar_cooldown': {
      const restart = numeric(attr('solar_restart_after'));
      return {key: 'solar_paused', headline: 'Waiting', detail: restart ? `Solar paused until ${clock(restart * 1000, zone, now)}` : 'Solar paused for a few minutes'};
    }
  }
  if (SOLAR.includes(c.policy)) return {key: 'solar', headline: 'Charging from solar', detail: 'Following the solar surplus'};
  return {key: 'other', headline: pretty(c.policy), detail: ''};
}

// Everything the Car tab and the Today glance show. `last` is the previous
// headline, kept by the element so a Charger dropout does not flash a new one.
export function carStatus(states, {now = Date.now(), zone = 'Europe/Brussels', last = null} = {}) {
  const c = carControls(states, now), attr = key => states[E.carPolicy]?.attributes?.[key];
  const battery = reading(states, E.carBattery, E.carLastBattery, c.fresh);
  const limit = reading(states, E.carLimit, E.carLastLimit, c.fresh);
  const watts = chargerWatts(states), drawing = watts !== null && watts >= DRAWING_W;
  const reconnecting = c.charger === 'reconnecting';
  const head = reconnecting && last?.headline ? {...last} : headline(states, c, limit, drawing, zone, now);
  const reserve = numeric(attr('ready_reserve')), conflict = attr('reserve_conflict') === true;
  const reserveTarget = reserve === null ? null : conflict && limit.value !== null ? Math.min(reserve, limit.value) : reserve;
  // A plan is a promise about automatic charging, so only while the policy is
  // actually deciding for a verified session.
  const deciding = c.plugged && c.charger === 'connected' && c.verified && (c.automatic || c.override)
    && !['off', 'initializing', 'unverified', 'vehicle_unavailable', 'power_unavailable'].includes(c.policy);
  let plan = '';
  if (deciding) {
    const offpeakAt = offpeakTime(states);
    if (battery.value === null) plan = 'Battery level unknown until the Car wakes';
    else if (c.policy === 'charge_now' && limit.value !== null) plan = `Charge now: to ${Math.round(limit.value)}%, then back to automatic`;
    else if (limit.value !== null && battery.value >= limit.value) plan = AT_LIMIT;
    else if (reserveTarget !== null && battery.value < reserveTarget) {
      plan = c.policy === 'ready_reserve' ? `Below reserve: restoring to ${reserveTarget}% now`
        : !offpeakAt || offpeakAt === 'Now' ? `Below reserve: restores to ${reserveTarget}% during off-peak`
        : `Below reserve: restores to ${reserveTarget}% from ${offpeakAt}`;
    } else if (limit.value !== null) plan = `Reserve met: tops up ${c.policy === 'economical_grid' ? 'while grid charging is economical' : 'from solar'} toward ${Math.round(limit.value)}%, no deadline`;
  }
  // Tesla's own estimate, only while the Charger is actually delivering power.
  let estimate = '';
  const fullAt = Date.parse(states[E.carFullAt]?.state || '');
  if (drawing && c.plugged && c.carOnline && fullAt > now && limit.value !== null) estimate = `Tesla estimates ${Math.round(limit.value)}% at ${clock(fullAt, zone, now)}`;
  const chargeNow = {
    enabled: c.override || (c.canCommand && !(battery.live && limit.live && battery.value >= limit.value)),
    label: c.override ? 'Return to automatic' : limit.live ? `Charge now to ${Math.round(limit.value)}%` : 'Charge now',
  };
  const wake = c.plugged && c.charger === 'connected' && (!c.fresh || !c.verified);
  return {...c, ...head, reconnecting, battery, limit, reserve, reserveTarget, conflict, watts, drawing, plan, estimate,
    reason: attr('reason') || '', basis: attr('economic_basis') || '',
    controls: {chargeNow, wake}};
}

// Charging energy by source over the counting period (#12). The period starts
// on 29 Aug 2026 and becomes the billing year once the meters reset on 1 July.
export function chargingEnergy(states, zone = 'Europe/Brussels') {
  const since = Date.parse(states[E.carEnergySolar]?.attributes?.counting_since || states[E.carEnergyPeak]?.attributes?.last_reset || '');
  const day = since ? zoned(zone, {day: 'numeric', month: 'numeric'}).formatToParts(new Date(since)) : null;
  const part = type => Number(day?.find(p => p.type === type)?.value);
  const period = !since ? null : part('day') === 1 && part('month') === 7 ? 'This billing year'
    : `Since ${zoned(zone, {day: 'numeric', month: 'short'}).format(new Date(since))}`;
  return {period, rows: [
    ['Grid off-peak', numeric(states[E.carEnergyOffpeak]?.state), 'moon'],
    ['Grid peak', numeric(states[E.carEnergyPeak]?.state), 'grid'],
    ['Solar', numeric(states[E.carEnergySolar]?.state), 'sun'],
  ]};
}

const percent = value => value === null ? '—' : `${Math.round(value)}%`;
// When a battery level that isn't live was last true.
function confirmation(s, zone, now = Date.now()) {
  return s.battery.confirmedAt ? `Last confirmed ${clock(s.battery.confirmedAt, zone, now)}` : 'Not confirmed yet';
}

// ---- Values --------------------------------------------------------------
// What the Car page and the Today glance show (#27), as plain data that React
// draws: screen.js hands the page over, and today.js the glance. Every visible
// phrase is formatted here from carStatus(), so React composes no English.
// Every write control comes from the injected kit, whose `control` asks
// guard.js whether its press would go through and whose `link` is a
// navigation, so React decides no enablement either. The section reads only
// the snapshot (states, now, tz, online, feedback, carLast), never the clock:
// the headline kept through a Charger dropout is snapshot.carLast, which the
// element keeps with rememberedHeadline() as each state update arrives.
// `label` is visible text; any key ending in Label is an accessible name only.
// Control, Link and Kit are the typedefs in climate.js's value section.

/**
 * @typedef {{ariaLabel: string, stale: boolean, fill: number|null, reserve: number|null, limit: number|null}} ChargeBar
 *   fill/reserve/limit: 0–100 clamped (not rounded), null when unknown. ariaLabel ends ', last confirmed' while a
 *   known battery level isn't live.
 * @typedef {{link: Link, title: 'Car', headline: string, bar: ChargeBar, lastConfirmed: string|null}} CarGlance
 *   The whole glance is its link, named by link.ariaLabel. lastConfirmed while a known battery level isn't live,
 *   else null.
 * @typedef {{id: 'car', battery: CarBattery, charge: CarCharge|null, chargingEnergy: ChargingBreakdown, widgets: CarWidgetSlot[],
 *   automatic: CarAutomatic}} CarPage
 *   In drawing order, typed with the page's section below.
 * @typedef {{title: 'Automatic charging', detail: string, switch: Control, note: 'Unavailable'|'Offline'|null, feedback: string}} Settings
 *   Automatic charging's switch and words (settingsValue), which CarAutomatic draws: detail says off whenever the
 *   switch isn't on. switch.selected is whether Automatic charging is on. note is drawn beside the switch.
 */

const feedbackFor = (snap, key) => snap.feedback?.get(key) ?? '';
// Every value derives the same status: the snapshot's time and the headline
// the element kept through a dropout.
const statusOf = snap => carStatus(snap.states, {now: snap.now, zone: snap.tz, last: snap.carLast});
const clamped = value => value === null ? null : Math.min(100, Math.max(0, value));

// The battery bar: the level, the ready reserve and the charge limit, the
// same on the glance and the Battery card's ring.
function chargeBarValue(s) {
  const b = s.battery.value, limit = s.limit.value, reserve = s.reserveTarget;
  const text = [b === null ? 'Battery unknown' : `Battery ${percent(b)}`, reserve === null ? '' : `ready reserve ${percent(reserve)}`, limit === null ? '' : `charge limit ${percent(limit)}`].filter(Boolean).join(', ');
  return {ariaLabel: text + (s.battery.live || b === null ? '' : ', last confirmed'), stale: !s.battery.live,
    fill: clamped(b), reserve: clamped(reserve), limit: clamped(limit)};
}
// During a Charger dropout the kept headline says it is reconnecting.
const keptThroughDropout = s => s.reconnecting && s.key !== 'reconnecting';

/**
 * The Car on Today: its headline and battery, pressed to open the Car tab.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @returns {CarGlance}
 */
export function carGlanceValue(snap, kit) {
  const s = statusOf(snap), {now, tz} = snap;
  const lastConfirmed = s.battery.value !== null && !s.battery.live ? confirmation(s, tz, now) : null;
  // Sentences, so the detail keeps its own capitals ("the Charger").
  const ariaLabel = `Car: ${s.headline}.${s.detail ? ' ' + s.detail + '.' : ''} Battery ${percent(s.battery.value)}${lastConfirmed ? ` · ${lastConfirmed.toLowerCase()}` : ''}. Open the Car tab`;
  return {link: kit.link({command: 'navigate', entity: 'car'}, {ariaLabel}), title: 'Car', headline: s.headline, bar: chargeBarValue(s), lastConfirmed};
}

// The last command and the last readiness check, each while it has a
// value, labelled with when it changed: the Battery sheet's Why.
function logsOf({states, now, tz}) {
  const since = id => {const t = Date.parse(states[id]?.last_changed || ''); return t ? clock(t, tz, now) : '';};
  const log = (label, id) => available(states[id]) && states[id].state ? [{label: `${label}${since(id) ? ' · ' + since(id) : ''}`, text: states[id].state}] : [];
  return [...log('Last command', E.carCommand), ...log('Readiness check', E.carReadiness)];
}
// The ready reserve stops at a lower charge limit: the Battery sheet's plan says so.
const CONFLICT = 'The charge limit is below the ready reserve, so the reserve stops at the limit.';

/**
 * The headline to keep after a state update: the new one outside a Charger
 * dropout, else `last`. The element calls this in `set hass`, so what a
 * render shows never changes what the next one keeps.
 * @returns {{key: string, headline: string, detail: string}|null} or `last` as given
 */
export function rememberedHeadline(states, {now, zone, last}) {
  const s = carStatus(states, {now, zone, last});
  return s.reconnecting ? last : {key: s.key, headline: s.headline, detail: s.detail};
}

// ---- Header values (#29 step 3) --------------------------------------------
// Solar counts as producing from 10 W, as on Energy's header chart.
export const SOLAR_ACTIVE_W = 10;
// Where the Charger's power comes from, by headline key: solar, the grid, or
// null where the headline doesn't say. Every key headline() can give is here.
export const CHARGE_SOURCE = Object.freeze({
  solar: 'solar', solar_ridethrough: 'solar',
  offpeak: 'grid', economical: 'grid', charge_now: 'grid',
  charger_offline: null, reconnecting: null, unplugged: null, unavailable: null, initializing: null, other_vehicle: null,
  automatic_off: null, not_verified: null, stale: null, power_missing: null, complete: null,
  house_busy: null, wait_offpeak: null, wait_sun: null, solar_paused: null, other: null,
});

/**
 * Where the Charger's power comes from while it draws: its headline's
 * source, or, where the headline doesn't say, solar while solar produces and
 * the grid otherwise. null while it draws nothing.
 * @param {{drawing: boolean, key: string}} s carStatus()
 * @param {object} states
 * @returns {'solar'|'grid'|null}
 */
export function chargeSource(s, states) {
  if (!s.drawing) return null;
  const said = Object.hasOwn(CHARGE_SOURCE, s.key) ? CHARGE_SOURCE[s.key] : null, solar = wattsOf(states[E.solar]);
  return said ?? (solar !== null && solar >= SOLAR_ACTIVE_W ? 'solar' : 'grid');
}

// The headline as one line: a bare 'Waiting' takes its detail ('Waiting for
// sun', 'Waiting · House is busy').
const headlineLine = s => s.headline !== 'Waiting' || !s.detail ? s.headline
  : /^For /.test(s.detail) ? `Waiting ${s.detail.replace(/^For/, 'for')}` : `Waiting · ${s.detail}`;

/**
 * @typedef {{kind: 'car', plot: {plugged: boolean, charging: boolean, source: 'solar'|'grid'|null, available: boolean}, ariaLabel: string}} CarHero
 *   The Car tab's header chart (#29 step 3): the Car at the Charger. plugged is the Car, never another vehicle,
 *   at the Charger (reconnecting included); charging while it is and the Charger draws;
 *   source is chargeSource()'s while charging, else null. available is false while the Charger is offline
 *   or unknown. ariaLabel is the whole reading in one sentence ('The Car, plugged in, charging from solar').
 */

/**
 * The Car tab's header: the line under the title (carStatus's headline, a
 * bare 'Waiting' completed by its detail) and the Car hero, from the
 * snapshot only. Both keep the headline the Car page
 * keeps through a Charger dropout.
 * @param {object} snap the element's snapshot
 * @returns {{line: string, hero: CarHero}}
 */
export function carHeader(snap) {
  // Another vehicle at the Charger, even while its headline is kept through a dropout: never the Car.
  const s = statusOf(snap), other = s.otherVehicle || s.key === 'other_vehicle';
  const available = s.charger !== 'offline', plugged = s.plugged && !other, charging = plugged && s.drawing;
  const source = charging ? chargeSource(s, snap.states) : null;
  const where = !available ? 'Charger offline' : other ? 'not the vehicle plugged in at the Charger' : !plugged ? 'unplugged'
    : charging ? `plugged in, charging from ${source === 'solar' ? 'solar' : 'the grid'}` : 'plugged in';
  return {line: headlineLine(s), hero: {kind: 'car', plot: {plugged, charging, source, available}, ariaLabel: `The Car, ${where}`}};
}

// ---- The page and its sheets (#29 step 4, v34) -----------------------------
/**
 * The Car page: the battery, then, while the Car is plugged in, charging,
 * then the charging energy and Automatic charging. The Battery card opens
 * Battery and Charging energy opens Charging energy, both sheets at
 * #car/<id> (CAR_DETAILS); Charge now, the limit stepper, Wake and
 * Automatic charging stay on the page.
 * Every heading, caption and Why is a value's words, each said once on a
 * screen; a reading without a number is '—', never 0. Colours have one
 * meaning each: green is charging (the ring while the Car charges), yellow
 * solar, indigo the grid's off-peak register, pink its peak register, gray
 * anything else. No value carries an ariaLabel but the Ring's and the
 * SegmentBar's (their parts are role=img), and the limit stepper's buttons',
 * icon-only, which the Stepper part is named by.
 *
 * @typedef {{plot: {fill: number|null, reserve: number|null, limit: number|null, tone: 'green'|'gray', stale: boolean}, ariaLabel: string}} BatteryRing
 *   ui/ring.jsx's Ring: fill, reserve and limit are chargeBarValue's (0–100 clamped, not rounded, null when unknown), the
 *   reserve and the limit its ticks. tone is green while the Car charges (plugged in, not another vehicle, the Charger
 *   drawing: Today's rule), gray otherwise; stale while the battery level isn't live. ariaLabel is chargeBarValue's.
 * @typedef {{title: 'Battery', icon: 'battery', ring: BatteryRing, label: string, line: string|null,
 *   legend: {kind: 'reserve'|'limit', text: string}[], freshness: string, link: Link}} CarBattery
 *   label is the ring's centre figure ('71%', or '—'). line is what happens next, one short line (at most 50 characters)
 *   that nothing else on the page says (batteryLine): the plan, shortened ('Reserve met: tops up from solar toward 80%',
 *   'To 80%, then back to automatic', 'Below reserve: restores to 50% off-peak' under 'Waiting for off-peak at 22:00';
 *   the Battery sheet keeps it whole), or without one the status detail; null with
 *   neither, and while the plan waits for an unknown level, says the headline again or the policy has no reading. legend is the ring's ticks in
 *   words, 'Reserve 50%' then 'Limit 80%', each only while known. freshness is 'Live', 'Last confirmed 14:47' or 'Not
 *   confirmed yet', and while the Charger delivers power to the Car, ' · Charger 7.20 kW' after it. While Home Assistant
 *   is offline nothing says Live: a live level reads 'Last received 12:28' (its state's last report), without the
 *   Charger's power. link opens Battery.
 * @typedef {{title: 'Charging', icon: 'plug', kind: 'ready'|'override'|'asleep'|'reconnecting', action: Control|null,
 *   limit: {title: 'Charge limit', detail: string, stepper: {minus: Control, output: string, outputLabel: string, plus: Control}}|null,
 *   wake: {icon: 'moon'|'refresh', title: string, detail: string, control: Control}|null, line: string|null,
 *   feedback: {action: string, limit: string, wake: string}}} CarCharge
 *   The page's charging controls, under the Charger's plug (the bolt is Charge now's and Charging energy's), while the
 *   Car is at the Charger: plugged in, and not another vehicle whose headline is kept through a Charger dropout unless
 *   an override is on (null otherwise). kind is the form (a variant, so words() skips it), from carStatus, never from a
 *   Control's enabled (a busy or offline Control is disabled but drawn). So every charging command guard() allows is
 *   drawn, and every control drawn is one it allows, but for two refusals that neither waking the Car nor the Charger
 *   reconnecting would lift, each drawn disabled: the stepper's step past the entity's min or max, and a charging
 *   script Home Assistant doesn't have or can't run (guard.js's `charging`).
 *   - reconnecting: the Charger isn't connected; line 'Controls return when the Charger reconnects.'; action Return to
 *     automatic while an override is on, else null; no limit, no wake.
 *   - asleep: fresh data or the session's verification is missing (carStatus's controls.wake); wake is set; action Return
 *     to automatic while an override is on, else null; no limit.
 *   - override: an override is on and nothing needs waking; action Return to automatic; limit set.
 *   - ready: otherwise; action Charge now ('Charge now to 80%', its icon 'energy'), except at the charge limit (the
 *     battery and the limit both live and the battery at or past it), where it is null; limit set.
 *   Return to automatic is charge-automatic and Charge now charge-now; the renderer draws Charge now filled and Return to
 *   automatic gray. limit: detail 'Shared with automatic charging'; the stepper is charge-limit ±1, its icon-only
 *   buttons named by ariaLabel ('Lower the charge limit by 5%'), its output '80%' while the limit is live, else '—',
 *   and its outputLabel 'Charge limit'. wake: while the Car is offline, icon 'moon' (the row's tile), title 'The Car
 *   is asleep', detail 'Wake it to charge now or change the limit.' and the control Wake; while it is online, icon 'refresh', title 'The Car hasn’t sent fresh data' (never
 *   the header's 'Car data is stale' again), 'Fresh data isn’t confirmed yet' while the policy, which says whether it is
 *   fresh, has no reading, or, with fresh data and only the session's verification missing, 'Not yet confirmed as the
 *   Car', detail 'Refresh to charge now or change the limit.' and the control Refresh. The detail
 *   leaves out 'charge now or ' where waking won't bring Charge now back: while an override is on, or while the battery
 *   is at or past the limit as last known. Either control is charge-refresh, with no glyph. feedback: each drawn control's line, '' while it is quiet or not drawn: action
 *   Return to automatic's or Charge now's, whichever is drawn; the limit's; Wake's.
 * @typedef {{title: 'Charging energy', icon: 'energy', figure: {label: string, value: string, unit: 'kWh'|''},
 *   bar: {kind: 'split'|'zero'|'missing', segments: {key: 'offpeak'|'solar'|'peak', tone: 'indigo'|'yellow'|'pink', share: number}[], ariaLabel: string},
 *   legend: {tone: 'indigo'|'yellow'|'pink', text: string}[], link: Link|null}} ChargingBreakdown
 *   energy.js's EnergyBreakdown shape, for the Car's charging energy by source, each in whole kWh as the legend prints it:
 *   off-peak, solar, then peak. figure.label is the counting period ('Since 29 Aug', 'This billing year'), or 'Total'
 *   while it is unknown (the widget's title already says Charging energy); figure.value their sum ('296'), so it agrees
 *   with the legend, '—' with unit '' while any is missing. kind is 'split' with segments (each share a fraction of the
 *   sum; a part at 0 has no segment), 'zero' while all three are 0 and 'missing' while one is, both with no segments.
 *   legend 'Off-peak 167', 'Solar 84', 'Peak 45' ('—' without a reading), under a figure that gives the unit.
 *   The page's opens Charging energy; the sheet's summary has none (null).
 * @typedef {{id: 'battery'|'charge'|'energy'|'automatic', size: 'medium'|'large'}} CarWidgetSlot
 *   The page's widgets in drawing order, on the phone stacked and from 700px on the grid: while `charge` is set, four
 *   mediums (battery, charge, energy, automatic); otherwise battery large (2×2) beside energy and automatic, medium.
 *   energy draws `chargingEnergy`, automatic `automatic`.
 * @typedef {{title: 'Automatic charging', icon: 'power', detail: string|null, switch: Control, note: 'Unavailable'|'Offline'|null,
 *   feedback: string}} CarAutomatic
 *   Automatic charging: Settings, but with a detail that says a state only while the switch has one ('Charges when
 *   it costs least over the year', 'Off: the Car charges as Tesla decides'), null while it has no reading, so
 *   'Unavailable' is the one state shown. switch, note and feedback are Settings' own (the switch named by ariaLabel,
 *   as the Switch part needs).
 *
 * @typedef {{id: 'battery'|'charging-energy', title: string, eyebrow: 'Car', body: BatterySheet|SourcesSheet}} CarDrawer
 *   title is the detail's name (CAR_DETAILS); screen.js adds `close`.
 * @typedef {{title: 'Why', paragraphs: string[], logs: {label: string, text: string}[]}} CarWhy
 *   A sheet's last section, collapsed. logs: the last command and readiness check ('Last command · 14:02'), each while it
 *   has a value; [] when none.
 * @typedef {{icon: string, tone: 'green'|'gray', title: string, value: string, detail: string|null, unavailable: boolean, link: Link|null}} ReadingRow
 *   unavailable while the reading has none (its value '—'), for ListRow's dashed tile. link null for a reading no dialog
 *   in Home Assistant shows as the row does.
 * @typedef {{kind: 'battery', summary: {ring: BatteryRing, label: string, headline: string, detail: string, hint: string|null},
 *   readings: {heading: 'Readings', rows: ReadingRow[]}, plan: {heading: 'Plan', line: string, note: string|null}|null,
 *   why: CarWhy|null}} BatterySheet
 *   summary: the page's ring and label beside carStatus's headline and detail (detail may be ''); hint 'Reconnecting to
 *   the Charger…' while the headline is kept through a dropout. readings, each opening its own reading (more) where a
 *   dialog shows it, always a read-only sensor, never an entity whose dialog in Home Assistant could write it:
 *   - Battery (battery): '71%', detail 'Live' ('Last received 12:28' while Home Assistant is offline), 'Last confirmed
 *     14:47' or 'Not confirmed yet'; the live sensor while live, else the last confirmed one's; green while the Car
 *     charges;
 *   - Charge limit (settings, a target that is set): the same, but always opening the last confirmed limit's sensor,
 *     never the limit's number, whose dialog would set it around the guard;
 *   - Ready reserve (moon, as it is restored off-peak): the reserve the ring marks; no detail, and no link: it is an
 *     attribute of the policy, whose dialog heads with the policy's state, never the 50%;
 *   - Charger (plug), only while it is connected to the Car: the measured power, '7.20 kW' with detail 'Delivering
 *     power' (green while the Car charges) or '5 W' with 'Not delivering power', or '—' with 'No power reading'; the
 *     Charger's power;
 *   - Tesla’s estimate (clock), only while Tesla estimates: '80% at 16:40'; the time to full charge.
 *   A reading without a number reads '—'. plan: the whole plan (the page's line is its short form), null without one,
 *   while the policy has no reading, or while it only says the headline again (at the charge limit); note the reserve's conflict with the limit, or null.
 *   While the reserve conflicts with the limit and there is no plan, the conflict is the plan's line. why: the policy's
 *   reason and basis, as it words them, then the logs; null with neither.
 * @typedef {{kind: 'sources', summary: ChargingBreakdown,
 *   rows: {icon: 'moon'|'grid'|'sun', tone: 'indigo'|'pink'|'yellow', title: string, value: string, unavailable: boolean, link: Link}[],
 *   footer: string, why: CarWhy}} SourcesSheet
 *   summary is the page's chargingEnergy with link null. rows, in the bar's order, each opening its meter (more): Grid
 *   off‑peak (a non-breaking hyphen, U+2011, so it never breaks at it), Solar and Grid peak, '167 kWh' or '—' (then unavailable), the whole kWh the legend prints. footer: when the count starts
 *   again, since the summary already says since when ('The count starts again with the billing year on 1 July.', or
 *   within the billing year 'The billing year runs from 1 July to 30 June.'). why: where peak and off-peak come from
 *   and how solar is counted, and why it reads high (the grid count misses the Charger's dropouts, which its own
 *   counter doesn't: car_display.yaml); no logs.
 */

// Everything #car/<id> can open, in page order.
export const CAR_DETAILS = Object.freeze([{id: 'battery', name: 'Battery'}, {id: 'charging-energy', name: 'Charging energy'}].map(Object.freeze));

const detailOf = (kit, id) => kit.link({command: 'detail', entity: id});
const moreOf = (kit, entity) => kit.link({command: 'more', entity});
// The Car charges while it, not another vehicle, is at the Charger and the
// Charger draws: Today's rule (today.js's carCharging), restated here.
const charging = s => s.plugged && s.key !== 'other_vehicle' && s.drawing;
// Whether a reading is live, and if not, when it was last true. While Home
// Assistant is offline nothing is live: a live reading is the last received
// (`id` its entity), as the frame's banner says.
function confirmed({states, online, tz, now}, r, id) {
  if (!r.live) return r.confirmedAt ? `Last confirmed ${clock(r.confirmedAt, tz, now)}` : 'Not confirmed yet';
  const at = Date.parse(states[id]?.last_reported || states[id]?.last_updated || '');
  return online ? 'Live' : at ? `Last received ${clock(at, tz, now)}` : 'Last received';
}

// Headline details the page already says elsewhere: the header's line
// (unplugged, another vehicle, no reading), Charging's Wake row (stale, not
// verified) or its reconnect line, Automatic charging's row (off), and the
// ring with its legend (at the limit).
const SAID_ELSEWHERE = new Set(['reconnecting', 'unplugged', 'unavailable', 'other_vehicle', 'automatic_off', 'not_verified', 'stale', 'complete']);
// The plan in one short line: the header already says Charge now, and when
// off-peak starts while it waits for it; the deadline there isn't and what
// makes grid charging economical are the Battery sheet's to say.
function briefPlan(s) {
  const line = s.plan.replace(/^Charge now: to /, 'To ').replace(/, no deadline$/, '').replace('while grid charging is economical', 'from the grid');
  return s.key === 'wait_offpeak' ? line.replace(/^(Below reserve: restores to \d+%) from .+$/, '$1 off-peak') : line;
}
// A plan is the policy's promise, so none while the policy has no reading;
// and it says only the headline again while the Car is at the limit and the
// headline says so.
const planSaid = s => s.plan && s.policy && !(s.plan === AT_LIMIT && s.key === 'complete') ? s.plan : '';
// What the Battery card says next, said once on the page: the plan, short
// (while the level is unknown the ring's '—', the freshness and the Wake
// row already say what the plan waits for), or else the status detail
// where it adds to the header's line (a bare 'Waiting' already carries its
// detail there, and an offline Charger's detail adds only its time), and
// nothing else on the page says it.
function batteryLine(s) {
  if (s.plan) return planSaid(s) && s.battery.value !== null ? briefPlan(s) : null;
  return !s.detail || SAID_ELSEWHERE.has(s.key) || headlineLine(s) !== s.headline || s.detail === NO_RESPONSE ? null : s.detail;
}
// The battery: its ring (the level, the reserve and the limit marked on
// it), what happens next, its ticks in words, and whether the level is
// live. Opens Battery.
function batteryValue(snap, kit, s) {
  const bar = chargeBarValue(s), delivering = s.plugged && s.charger === 'connected' && s.drawing;
  return {title: 'Battery', icon: 'battery',
    ring: {plot: {fill: bar.fill, reserve: bar.reserve, limit: bar.limit, tone: charging(s) ? 'green' : 'gray', stale: bar.stale}, ariaLabel: bar.ariaLabel},
    label: percent(s.battery.value), line: batteryLine(s),
    legend: [['reserve', 'Reserve', s.reserveTarget], ['limit', 'Limit', s.limit.value]].filter(([, , value]) => value !== null).map(([kind, name, value]) => ({kind, text: `${name} ${percent(value)}`})),
    freshness: `${confirmed(snap, s.battery, E.carBattery)}${delivering && snap.online ? ` · Charger ${power(s.watts)}` : ''}`, link: detailOf(kit, 'battery')};
}
// Why the Car's data needs waking or refreshing, and the button that does
// it: Wake, under the moon, while the Car sleeps; Refresh while it is
// awake, its data not fresh or its plug-in not yet confirmed as the Car.
// Both send charge-refresh. The button has no glyph; the row's tile has.
// Charge now comes back only where waking brings it: not while an override
// is on, nor at the charge limit as last confirmed.
function wakeValue(kit, s) {
  const asleep = !s.carOnline, full = s.battery.value !== null && s.limit.value !== null && s.battery.value >= s.limit.value;
  // Without the policy, whose reading says whether the data is fresh, the Car isn't to blame.
  return {icon: asleep ? 'moon' : 'refresh', title: asleep ? 'The Car is asleep' : !s.policy ? 'Fresh data isn’t confirmed yet'
    : !s.fresh ? 'The Car hasn’t sent fresh data' : 'Not yet confirmed as the Car',
    detail: `${asleep ? 'Wake it' : 'Refresh'} to ${s.override || full ? '' : 'charge now or '}change the limit.`,
    control: kit.control({command: 'charge-refresh', entity: E.carRefresh}, {label: asleep ? 'Wake' : 'Refresh'})};
}
// Charging, while the Car is at the Charger: Charge now or Return to
// automatic, the charge limit, or Wake, by the form carStatus gives
// (CarCharge). Another vehicle's headline kept through a Charger dropout
// isn't the Car's either, but an override's Return to automatic stays.
function chargeValue(snap, kit, s) {
  if (!s.plugged || (s.key === 'other_vehicle' && !s.override)) return null;
  const kind = s.charger !== 'connected' ? 'reconnecting' : s.controls.wake ? 'asleep' : s.override ? 'override' : 'ready';
  const atLimit = s.battery.live && s.limit.live && s.battery.value >= s.limit.value;
  const now = kind === 'ready' && !atLimit, limit = kind === 'ready' || kind === 'override', wake = kind === 'asleep';
  const step = direction => kit.control({command: 'charge-limit', entity: E.carLimit, direction},
    {ariaLabel: `${direction > 0 ? 'Raise' : 'Lower'} the charge limit by 5%`, icon: direction > 0 ? 'plus' : 'minus'});
  return {title: 'Charging', icon: 'plug', kind,
    action: s.override ? kit.control({command: 'charge-automatic', entity: E.carAutomatic}, {label: 'Return to automatic'})
      : now ? kit.control({command: 'charge-now', entity: E.carNow}, {label: s.controls.chargeNow.label, icon: 'energy'}) : null,
    limit: limit ? {title: 'Charge limit', detail: 'Shared with automatic charging',
      stepper: {minus: step(-1), output: s.limit.live ? percent(s.limit.value) : '—', outputLabel: 'Charge limit', plus: step(1)}} : null,
    wake: wake ? wakeValue(kit, s) : null,
    line: kind === 'reconnecting' ? 'Controls return when the Charger reconnects.' : null,
    // Each line belongs to its control: while the control isn't drawn, the
    // header's status line still reports it.
    feedback: {action: s.override ? feedbackFor(snap, E.carAutomatic) : now ? feedbackFor(snap, E.carNow) : '',
      limit: limit ? feedbackFor(snap, E.carLimit) : '', wake: wake ? feedbackFor(snap, E.carRefresh) : ''}};
}
// The charging energy by source in whole kWh, as the legend prints them,
// and their sum, so the figure agrees with the legend: off-peak, solar,
// then peak (ChargingBreakdown).
function chargingBreakdown(snap, link) {
  const {period, rows} = chargingEnergy(snap.states, snap.tz);
  const [offpeak, peak, solar] = rows.map(([, value]) => value === null ? null : Math.round(value));
  const parts = [['offpeak', 'indigo', offpeak, 'Off-peak'], ['solar', 'yellow', solar, 'Solar'], ['peak', 'pink', peak, 'Peak']];
  const missing = parts.some(([, , value]) => value === null), sum = missing ? null : offpeak + solar + peak;
  const kind = missing ? 'missing' : sum > 0 ? 'split' : 'zero', kwh = value => value === null ? '—' : String(value);
  return {title: 'Charging energy', icon: 'energy', figure: {label: period ?? 'Total', value: kwh(sum), unit: sum === null ? '' : 'kWh'},
    bar: {kind, segments: kind === 'split' ? parts.filter(([, , value]) => value > 0).map(([key, tone, value]) => ({key, tone, share: value / sum})) : [],
      ariaLabel: {split: `Charging energy, in kWh: ${parts.map(([, , value, name]) => `${name.toLowerCase()} ${value}`).join(', ')}`,
        zero: 'Charging energy: nothing charged yet', missing: 'Charging energy: some readings are missing'}[kind]},
    legend: parts.map(([, tone, value, name]) => ({tone, text: `${name} ${kwh(value)}`})), link};
}

// Automatic charging's switch and what it does (Settings).
function settingsValue(snap, kit, s) {
  const on = s.automatic, state = snap.states[E.carSmart];
  return {title: 'Automatic charging', detail: on ? 'Charges when it costs least over the year' : 'Off: the Car charges as Tesla decides',
    switch: kit.control({command: 'toggle', entity: E.carSmart}, {ariaLabel: 'Automatic charging', selected: on}),
    note: !available(state) ? 'Unavailable' : !snap.online ? 'Offline' : null, feedback: feedbackFor(snap, E.carSmart)};
}
// Automatic charging: its switch, and what it does only while the switch
// has a reading, so an unknown switch never reads as off.
function automaticValue(snap, kit, s) {
  const {detail, switch: control, note, feedback} = settingsValue(snap, kit, s);
  return {title: 'Automatic charging', icon: 'power', detail: available(snap.states[E.carSmart]) ? detail : null, switch: control, note, feedback};
}

/**
 * The Car tab, in drawing order: the battery, charging while the Car is at
 * the Charger, the charging energy, the widgets they fill, then Automatic
 * charging.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @returns {CarPage}
 */
export function carPageValue(snap, kit) {
  const s = statusOf(snap), charge = chargeValue(snap, kit, s);
  return {id: 'car', battery: batteryValue(snap, kit, s), charge, chargingEnergy: chargingBreakdown(snap, detailOf(kit, 'charging-energy')),
    widgets: charge ? [{id: 'battery', size: 'medium'}, {id: 'charge', size: 'medium'}, {id: 'energy', size: 'medium'}, {id: 'automatic', size: 'medium'}]
      : [{id: 'battery', size: 'large'}, {id: 'energy', size: 'medium'}, {id: 'automatic', size: 'medium'}],
    automatic: automaticValue(snap, kit, s)};
}

// ---- The sheets ----
// The plan in full, unless it only says the headline again; while the
// reserve conflicts with the limit, the conflict as its note, or as its
// line when there is no plan.
function planOf(s) {
  const line = planSaid(s), conflict = s.conflict ? CONFLICT : null;
  return line ? {heading: 'Plan', line, note: conflict} : conflict ? {heading: 'Plan', line: conflict, note: null} : null;
}
// The battery: the page's ring beside the headline, each reading opening
// its own, the plan, and why.
function batterySheet(snap, kit, s) {
  const {ring, label} = batteryValue(snap, kit, s), connected = s.plugged && s.charger === 'connected', why = [s.reason, s.basis].filter(Boolean), logs = logsOf(snap);
  const row = (icon, title, value, detail, entity, tone = 'gray') => ({icon, tone, title, value, detail, unavailable: value === '—', link: entity ? moreOf(kit, entity) : null});
  return {kind: 'battery',
    summary: {ring, label, headline: s.headline, detail: s.detail, hint: keptThroughDropout(s) ? 'Reconnecting to the Charger…' : null},
    readings: {heading: 'Readings', rows: [
      row('battery', 'Battery', percent(s.battery.value), confirmed(snap, s.battery, E.carBattery), s.battery.live ? E.carBattery : E.carLastBattery, charging(s) ? 'green' : 'gray'),
      // The last confirmed limit, even while live: the limit's own entity is a number, whose
      // dialog in Home Assistant would set it around the guard.
      row('settings', 'Charge limit', percent(s.limit.value), confirmed(snap, s.limit, E.carLimit), E.carLastLimit),
      row('moon', 'Ready reserve', percent(s.reserveTarget), null, null),
      ...connected ? [row('plug', 'Charger', s.watts === null ? '—' : power(s.watts), s.watts === null ? 'No power reading' : s.drawing ? 'Delivering power' : 'Not delivering power',
        E.carPower, charging(s) ? 'green' : 'gray')] : [],
      ...s.estimate ? [row('clock', 'Tesla’s estimate', s.estimate.replace(/^Tesla estimates /, ''), null, E.carFullAt)] : []]},
    plan: planOf(s),
    why: why.length || logs.length ? {title: 'Why', paragraphs: why, logs} : null};
}
// Where the charging energy came from: the page's breakdown, each meter
// opening its own in the bar's order, when the count starts again, and why.
const METERS = [[E.carEnergyOffpeak, 'indigo'], [E.carEnergySolar, 'yellow'], [E.carEnergyPeak, 'pink']];
function sourcesSheet(snap, kit) {
  const {period, rows} = chargingEnergy(snap.states, snap.tz), [offpeak, peak, solar] = rows;
  return {kind: 'sources', summary: chargingBreakdown(snap, null),
    // A non-breaking hyphen keeps 'off‑peak' whole when a narrow row wraps its title.
    rows: [offpeak, solar, peak].map(([title, value, icon], i) => ({icon, tone: METERS[i][1], title: title.replace('-', '\u2011'), value: value === null ? '—' : `${Math.round(value)} kWh`,
      unavailable: value === null, link: moreOf(kit, METERS[i][0])})),
    footer: period === 'This billing year' ? 'The billing year runs from 1 July to 30 June.' : 'The count starts again with the billing year on 1 July.',
    why: {title: 'Why', paragraphs: ['Grid off-peak and grid peak are what charging added to the house’s grid import, counted in the meter’s register at the time.',
      'Solar is the Charger’s own reading minus what came from the grid. The grid count misses the Charger’s dropouts, so solar can read a few percent high.'], logs: []}};
}
const SHEETS = Object.freeze({battery: batterySheet, 'charging-energy': sourcesSheet});

/**
 * A Car sheet (#29 step 4, v34) by its id, or null for an id CAR_DETAILS
 * doesn't have. screen.js adds its `close`.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @param {string} id
 * @returns {CarDrawer|null}
 */
export function carDrawerValue(snap, kit, id) {
  const d = CAR_DETAILS.find(x => x.id === id);
  return d ? {id, title: d.name, eyebrow: 'Car', body: SHEETS[id](snap, kit, statusOf(snap))} : null;
}
