// Synthetic Energy states for Energy's page and sheets (#29 step 4,
// v33), built from the home fixtures' (home-fixtures.js) with a few readings
// replaced, as the gallery's Energy heroes are: export covering both
// registers at noon, HOME's full house billing off-peak, a night on
// off-peak with solar asleep, and HOME's missing house. Each carries what
// the element loads beside the states, as HOME's do. The Node tests, the
// gallery's pages view and its sheet windows check Energy against these. No
// real readings.
import {E, REGISTERS, COSTS} from '../../../config/www/maison/model.js';
import {HOME_FIXTURES, HOME_MIDNIGHT, HOME_NOW, HOME_POWER_HISTORY, recordedDay} from './home-fixtures.js';

// Sunday 27 September 2026 in Brussels: 12:30 (HOME's time) and 21:04, an
// hour into the night the sky fixtures draw.
export const ENERGY_NOW = HOME_NOW;
export const ENERGY_NIGHT_NOW = Date.parse('2026-09-27T21:04:00+02:00');
const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const iso = ms => new Date(ms).toISOString();
const [PEAK, OFF_PEAK] = REGISTERS;
const home = id => HOME_FIXTURES.find(f => f.id === id);

// A state as Home Assistant keeps it, last reported a minute before `now`.
const entity = (now, entity_id, state, attributes = {}) => ({
  entity_id, state: String(state), attributes,
  last_changed: iso(now - 20 * MINUTE), last_updated: iso(now - MINUTE), last_reported: iso(now - MINUTE),
});
// HOME's states moved to `now`, every reading as old as it was at HOME_NOW,
// with `changes` over them: [id, state, attributes] each, the attributes
// kept from HOME's where none are given.
function states(base, now, changes) {
  const shift = ms => iso(Date.parse(ms) + now - HOME_NOW);
  const moved = Object.fromEntries(Object.entries(base).map(([id, s]) => [id, s.last_changed
    ? {...s, last_changed: shift(s.last_changed), last_updated: shift(s.last_updated), last_reported: shift(s.last_reported)} : s]));
  for (const [id, state, attributes] of changes) moved[id] = entity(now, id, state, attributes ?? moved[id]?.attributes ?? {});
  return moved;
}
// sun.sun above or below the horizon, as sky-fixtures.js has it.
const sun = (elevation, azimuth, rising) => [E.sun, elevation > 0 ? 'above_horizon' : 'below_horizon', {elevation, azimuth, rising, friendly_name: 'Sun'}];
const kwh = (id, value) => [id, value, {unit_of_measurement: 'kWh', device_class: 'energy'}];
const euros = (id, value, extra = {}) => [id, value, {unit_of_measurement: '€', ...extra}];
const watts = (id, value) => [id, value, {unit_of_measurement: 'W', device_class: 'power'}];
// Helios's power forecast for the day (v37), its quarter hours from
// midnight to the next as its `forecast` attribute holds them, rising at
// 07:45 to 3.1 kW after half past one and setting at 19:30; its state the
// quarter hour's at `now`. In W.
const SUNRISE = 7.75, SUNSET = 19.5;
const forecastAt = h => h <= SUNRISE || h >= SUNSET ? 0 : Math.round(3100 * Math.sin(Math.PI * (h - SUNRISE) / (SUNSET - SUNRISE)) ** 1.3 / 10) * 10;
const curve = now => [E.solarCurve, forecastAt(Math.floor((now - HOME_MIDNIGHT) / (15 * MINUTE)) / 4),
  {unit_of_measurement: 'W', device_class: 'power', forecast: Array.from({length: 96}, (_, q) => ({datetime: iso(HOME_MIDNIGHT + q * 15 * MINUTE), watts: forecastAt(q / 4), p10: null, p90: null}))}];

const FULL = home('full');
// HOME full's binding cap, set to agree with its own rows: distribution
// 160.75 € and transport 21.30 € against a cap of 169.71 € give its 12.34 €
// over (HOME's own cap_eur, 245.60 €, would leave it under).
const BINDING_CAP = euros(E.capCredit, 12.34, {slack_eur: 12.34, binding: 'true', cap_eur: 169.71});
const nothing = {agenda: {events: [], errors: {}, status: {}}, agendaLoading: false, forecasts: []};

export const ENERGY_FIXTURES = [
  // Day 92, peak, exporting 1.52 kW at noon: export still covers both
  // registers (off-peak 86% used, 45.8 kWh left), so supplier energy, green
  // energy and levies & taxes read 0.00 €, and the cap isn't binding:
  // distribution 64.12 € and transport 8.40 € sit 22.68 € under its 95.20 €.
  {id: 'covered', title: 'Export covering both registers at noon: the billable lines at 0.00 €, the cap not binding', now: ENERGY_NOW,
    states: states(FULL.states, ENERGY_NOW, [
      sun(36, 168, true),
      [E.priceAllIn, 0.369, {unit_of_measurement: '€/kWh'}],
      [PEAK.price, 0.19, {unit_of_measurement: '€/kWh'}], [OFF_PEAK.price, 0.1539, {unit_of_measurement: '€/kWh'}],
      [E.elapsedDays, 92, {unit_of_measurement: 'd'}],
      kwh(PEAK.imported, 512.1), kwh(PEAK.exported, 1430.2), kwh(PEAK.reserve, 918.1), kwh(PEAK.billable, 0),
      kwh(OFF_PEAK.imported, 285.9), kwh(OFF_PEAK.exported, 331.7), kwh(OFF_PEAK.reserve, 45.8), kwh(OFF_PEAK.billable, 0),
      euros(E.capCredit, 0, {slack_eur: -22.68, binding: false, cap_eur: 95.2}),
      // COSTS' order: supplier energy, green energy, the standing charge, distribution, transport, levies & taxes.
      ...COSTS.map(([, id], i) => euros(id, [0, 0, 10.59, 64.12, 8.4, 0][i])),
      kwh(E.grossImport, 798), euros(E.bill, 101.99), [E.reliability, 91, {unit_of_measurement: '%'}],
      kwh(E.solarToday, 6.8), kwh(E.importToday, 0.9), kwh(E.exportToday, 4.1), kwh(E.solarTomorrow, 18.4),
      kwh(E.selfConsumed, 2.7), kwh(E.solarRemaining, 9.6), curve(ENERGY_NOW),
    ]),
    agenda: FULL.agenda, agendaLoading: FULL.agendaLoading, forecasts: FULL.forecasts},
  // HOME's full house, its cap agreeing with its rows: peak covered,
  // off-peak billing, the cap binding.
  {...FULL, id: 'billing', title: 'Peak covered and off-peak billing, exporting at noon, the cap binding', now: ENERGY_NOW,
    states: states(FULL.states, ENERGY_NOW, [BINDING_CAP, curve(ENERGY_NOW)])},
  // 21:04 on off-peak: the house draws 316 W from the grid, the inverter is
  // asleep under a set sun, and the day's totals are in. The registers are
  // HOME full's, and the binding cap is billing's.
  {id: 'night', title: 'Off-peak at night: importing 316 W, solar asleep, the cap binding', now: ENERGY_NIGHT_NOW,
    states: states(FULL.states, ENERGY_NIGHT_NOW, [
      sun(-30, 297, false), BINDING_CAP,
      [E.offPeakNow, 'on'], [E.priceAllIn, 0.2211, {unit_of_measurement: '€/kWh'}],
      watts(E.grid, 316), watts(E.solar, 'unavailable'), watts(E.load, 316),
      kwh(E.solarToday, 9.1), kwh(E.importToday, 3.9), kwh(E.exportToday, 5.6), kwh(E.selfConsumed, 3.5), kwh(E.solarRemaining, 0),
      curve(ENERGY_NIGHT_NOW),
    ]),
    ...nothing},
  // HOME's missing house as it is: no readings at all.
  {...home('missing'), title: 'Almost nothing set up: every figure missing', now: ENERGY_NOW},
];

// Today's power from midnight to ENERGY_NOW: HOME's, which ends on the noon
// fixtures' live readings (house 1.32 kW, solar 2.84 kW, exporting 1.52 kW).
export const ENERGY_POWER_HISTORY = HOME_POWER_HISTORY;
// The same day from midnight to ENERGY_NIGHT_NOW, by the hour of the day,
// ending on the night fixture's 316 W. The inverter reports nothing while it
// sleeps (null), so its series is gapped at both ends. In W.
const LOAD = [420, 380, 350, 330, 320, 340, 400, 640, 900, 700, 560, 620, 980, 1100, 850, 700, 680, 900, 1500, 1350, 820, 316, 450, 420];
const SOLAR = [null, null, null, null, null, null, null, 20, 180, 620, 1300, 2100, 2700, 2900, 2600, 2000, 1300, 600, 150, 10, null, null, null, null];
export const ENERGY_NIGHT_POWER_HISTORY = recordedDay(HOME_MIDNIGHT, ENERGY_NIGHT_NOW, {load: LOAD, solar: SOLAR}, {load: 316, solar: null});
