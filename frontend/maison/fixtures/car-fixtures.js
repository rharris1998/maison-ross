// Synthetic Car and Charger states, one per Car tab headline (#13). The gallery
// renders each through the production builders and the Node tests check each
// fixture's headline, so the two cannot drift apart. No real readings.
import {E} from '../../../config/www/maison/model.js';

export const CAR_NOW = Date.parse('2026-09-27T12:30:00+02:00');
const iso = minutes => new Date(CAR_NOW + minutes * 60000).toISOString();
const entity = (entity_id, state, attributes = {}, minutesAgo = 2) => ({
  entity_id, state: String(state), attributes,
  last_changed: iso(-minutesAgo), last_updated: iso(-minutesAgo), last_reported: iso(-minutesAgo),
});

const REASONS = {
  surplus: 'Following measured surplus up to 80%; export compensation is included in the economic policy.',
  solar_ridethrough: 'Cloud ride-through at 6 A; temporary grid import allowed until 12:34.',
  ready_reserve: 'Restoring the ready reserve to 50% during off-peak.',
  charge_now: 'Charge now requested to 80%; household power limits still apply.',
  economical_grid: 'Verified annual session comparison favors peak charging now, including compensation and network costs.',
  peak_wait: 'Waiting for off-peak (22:00) or a verified economical solar opportunity.',
  solar_wait: 'Ready reserve satisfied. Waiting for economical measured solar surplus toward 80%; no completion deadline.',
  solar_cooldown: 'Solar charging paused. Restart after 12:42, with confirmed surplus.',
  load_wait: 'Other household demand leaves insufficient charging headroom.',
  complete: 'At the Tesla limit of 80%.',
  off: 'Automatic charging is off; vehicle may still be charging manually.',
  unverified: 'Tesla home connection is not verified. Refresh location and cable telemetry before automatic control.',
  other_vehicle: 'Another vehicle is at the Charger: fresh Car data shows it is not the Car.',
  vehicle_unavailable: 'Battery level or Tesla limit is unknown or older than 15 minutes. Refresh vehicle data.',
  connection_unavailable: 'Wall Connector connection telemetry is unavailable; waiting for verified connection and fresh power.',
  power_unavailable: 'Local power data is missing or stale; managed charging is paused.',
  initializing: 'Restoring charging timers before automatic control resumes.',
};

// A plugged-in, verified session with the Car online and nothing charging.
function base(policy, {battery = 63, limit = 80, kw = 0.0052, offpeak = 'Today 22:00', policyAttributes = {}} = {}) {
  return {
    [E.carConnected]: entity(E.carConnected, 'on', {device_class: 'plug'}, 95),
    [E.carOnline]: entity(E.carOnline, 'on', {device_class: 'connectivity'}),
    [E.carSession]: entity(E.carSession, 'verified', {verified_since: iso(-95)}, 95),
    [E.carBattery]: entity(E.carBattery, battery, {unit_of_measurement: '%'}),
    [E.carLimit]: entity(E.carLimit, limit, {min: 50, max: 100, step: 1, unit_of_measurement: '%'}),
    [E.carLastBattery]: entity(E.carLastBattery, battery, {unit_of_measurement: '%', confirmed_at: iso(-2)}),
    [E.carLastLimit]: entity(E.carLastLimit, limit, {unit_of_measurement: '%', confirmed_at: iso(-2)}),
    [E.carPower]: entity(E.carPower, kw, {unit_of_measurement: 'kW'}),
    [E.carFullAt]: entity(E.carFullAt, 'unavailable', {device_class: 'timestamp'}),
    [E.carSmart]: entity(E.carSmart, 'on', {}, 600),
    [E.carOverride]: entity(E.carOverride, 'off', {}, 600),
    [E.carPolicy]: entity(E.carPolicy, policy, {
      vehicle_data_valid: true, managed: true, ready_reserve: 50, reserve_conflict: false,
      next_offpeak: offpeak, solar_restart_after: null, reason: REASONS[policy] || '',
      economic_basis: 'Conservative off-peak fallback; annual forecast not verified', ...policyAttributes,
    }),
    [E.carCommand]: entity(E.carCommand, 'Refreshing vehicle data', {}, 40),
    [E.carReadiness]: entity(E.carReadiness, '27 Sep 09:28: Ready reserve satisfied (63%).', {}, 180),
    [E.carEnergyOffpeak]: entity(E.carEnergyOffpeak, '167.315', {unit_of_measurement: 'kWh', last_reset: '2026-08-29T08:39:53Z'}),
    [E.carEnergyPeak]: entity(E.carEnergyPeak, '44.917', {unit_of_measurement: 'kWh', last_reset: '2026-08-29T08:39:53Z'}),
    [E.carEnergySolar]: entity(E.carEnergySolar, '83.528', {unit_of_measurement: 'kWh', counting_since: '2026-08-29T08:39:53Z'}),
    // The charging scripts, as Home Assistant has them; a missing one is refused.
    [E.carNow]: {entity_id: E.carNow, state: 'off', attributes: {}},
    [E.carAutomatic]: {entity_id: E.carAutomatic, state: 'off', attributes: {}},
    [E.carRefresh]: {entity_id: E.carRefresh, state: 'off', attributes: {}},
  };
}
const patch = (states, changes) => {
  const next = {...states};
  for (const [id, change] of Object.entries(changes)) next[id] = {...next[id], ...change, attributes: {...next[id]?.attributes, ...change.attributes}};
  return next;
};
// The Car asleep: tesla_fleet keeps re-reporting its last values, and only the
// last confirmed sensors say when they were true.
const asleep = (states, confirmedMinutesAgo = 150) => patch(states, {
  [E.carOnline]: {state: 'off'},
  [E.carLastBattery]: {attributes: {confirmed_at: iso(-confirmedMinutesAgo)}},
  [E.carLastLimit]: {attributes: {confirmed_at: iso(-confirmedMinutesAgo)}},
});
const policy = (states, attributes) => patch(states, {[E.carPolicy]: {attributes}});
// sensor.verified_session: only a verified or reconnecting session has a start.
const session = (states, state) => patch(states, {[E.carSession]: {state, attributes: {verified_since: ['verified', 'reconnecting'].includes(state) ? iso(-95) : null}}});

export const CAR_FIXTURES = [
  {id: 'solar', title: 'Charging from solar', states: patch(base('surplus', {kw: 3.8}), {[E.carFullAt]: {state: iso(130)}}), expect: 'solar'},
  {id: 'solar_ridethrough', title: 'Solar ride-through', states: base('solar_ridethrough', {kw: 1.4}), expect: 'solar_ridethrough'},
  {id: 'offpeak', title: 'Charging off-peak', states: base('ready_reserve', {battery: 38, kw: 7.2, offpeak: 'Now'}), expect: 'offpeak'},
  {id: 'charge_now', title: 'Charge now', states: patch(base('charge_now', {kw: 7.2}), {[E.carOverride]: {state: 'on'}}), expect: 'charge_now'},
  {id: 'economical', title: 'Charging (economical)', states: base('economical_grid', {kw: 7.2}), expect: 'economical'},
  {id: 'wait_offpeak', title: 'Waiting for off-peak', states: base('peak_wait', {battery: 42}), expect: 'wait_offpeak'},
  {id: 'wait_offpeak_asleep', title: 'Waiting, Car asleep', states: asleep(base('peak_wait', {battery: 42})), expect: 'wait_offpeak'},
  {id: 'wait_sun', title: 'Waiting for sun', states: base('solar_wait', {offpeak: 'Now'}), expect: 'wait_sun'},
  {id: 'solar_paused', title: 'Solar paused', states: policy(base('solar_cooldown'), {solar_restart_after: (CAR_NOW + 12 * 60000) / 1000}), expect: 'solar_paused'},
  {id: 'house_busy', title: 'House is busy', states: base('load_wait'), expect: 'house_busy'},
  {id: 'complete', title: 'At charge limit', states: base('complete', {battery: 80}), expect: 'complete'},
  {id: 'unplugged', title: 'Unplugged', states: asleep(session(patch(base('off'), {[E.carConnected]: {state: 'off'}}), 'unplugged')), expect: 'unplugged'},
  {id: 'never_confirmed', title: 'Unplugged, nothing confirmed yet', states: patch(asleep(session(patch(base('off'), {[E.carConnected]: {state: 'off'}}), 'unplugged')), {
    [E.carLastBattery]: {state: 'unknown', attributes: {confirmed_at: null}}, [E.carLastLimit]: {state: 'unknown', attributes: {confirmed_at: null}}}), expect: 'unplugged'},
  {id: 'automatic_off', title: 'Automatic charging off', states: patch(base('off'), {[E.carSmart]: {state: 'off'}}), expect: 'automatic_off'},
  {id: 'other_vehicle', title: 'Another vehicle is charging', states: session(policy(base('unverified', {kw: 7.2}), {managed: false, reason: REASONS.other_vehicle}), 'other_vehicle'), expect: 'other_vehicle'},
  {id: 'not_verified', title: 'Plugged in, not yet verified', states: asleep(session(policy(base('unverified'), {managed: false}), 'unverified')), expect: 'not_verified'},
  {id: 'stale', title: 'Car data is stale', states: asleep(policy(base('vehicle_unavailable'), {vehicle_data_valid: false})), expect: 'stale'},
  // Two minutes into a dropout, the previous headline stays with a hint.
  {id: 'dropout', title: 'Charger dropout, within 5 minutes', states: session(patch(base('connection_unavailable'), {[E.carConnected]: {state: 'unavailable', last_changed: iso(-2)}}), 'reconnecting'),
    last: {key: 'wait_offpeak', headline: 'Waiting', detail: 'For off-peak at 22:00', tone: 'default', icon: 'clock'}, expect: 'wait_offpeak'},
  {id: 'charger_offline', title: 'Charger offline', states: session(patch(base('connection_unavailable'), {[E.carConnected]: {state: 'unavailable', last_changed: iso(-7)}}), 'reconnecting'), expect: 'charger_offline'},
  {id: 'power_missing', title: 'Power readings missing', states: base('power_unavailable'), expect: 'power_missing'},
  {id: 'initializing', title: 'Starting up', states: base('initializing'), expect: 'initializing'},
];
