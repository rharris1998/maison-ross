// Synthetic Energy and Home status states (#27): a full house, a quiet
// one with gaps, and one where almost nothing is set up. Each fixture also
// carries what the element loads beside the states, the next seven days'
// agenda and the daily forecast, in the shape of today-fixtures.js. The Node
// tests check the three pages, the chrome and the dialogs against these. No
// real readings.
import {E, REGISTERS, COSTS, MAINTENANCE} from '../../../config/www/maison/model.js';
import {CAR_NOW} from './car-fixtures.js';

// Sunday 27 September 2026, 12:30 in Brussels, as the Car and Today fixtures.
export const HOME_NOW = CAR_NOW;
const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const iso = ms => new Date(ms).toISOString();
// A state last reported `age` ms before HOME_NOW; `age: null` has no times.
const entity = (entity_id, state, attributes = {}, age = MINUTE) => ({
  entity_id, state: String(state), attributes,
  ...(age === null ? {} : {last_changed: iso(HOME_NOW - age - 20 * MINUTE), last_updated: iso(HOME_NOW - age), last_reported: iso(HOME_NOW - age)}),
});
const kwh = (id, value, extra = {}) => entity(id, value, {unit_of_measurement: 'kWh', device_class: 'energy', ...extra});
const watts = (id, value, extra = {}) => entity(id, value, {unit_of_measurement: 'W', device_class: 'power', ...extra});
const euros = (id, value, extra = {}) => entity(id, value, {unit_of_measurement: '€', ...extra});
const states = list => Object.fromEntries(list.map(state => [state.entity_id, state]));
const [PEAK, OFF_PEAK] = REGISTERS;
// The appliances' plugs, which only the sensor list reads.
const DISHWASHER = 'sensor.dishwasher_plug_power', DRYER = 'sensor.dryer_plug_power';

const people = (alex, sam) => [
  entity('person.alex', alex, {friendly_name: 'Alex Maison'}),
  entity('person.sam', sam, {friendly_name: 'Sam Maison'}),
];
// The catalogue's odd cases: a zero reading, an unavailable one, a name that
// looks like markup, a reading with no update time, and a low battery (which
// is also a household alert).
const catalogue = () => [
  entity('sensor.living_room_temperature', 21.4, {friendly_name: 'Living room temperature', unit_of_measurement: '°C', device_class: 'temperature'}, 3 * MINUTE),
  entity('sensor.living_room_humidity', 48, {friendly_name: 'Living room humidity', unit_of_measurement: '%', device_class: 'humidity'}, 3 * HOUR),
  entity('sensor.cellar_temperature', 'unavailable', {friendly_name: 'Cellar temperature', unit_of_measurement: '°C', device_class: 'temperature'}, 2 * DAY),
  watts('sensor.garage_socket_power', 0, {friendly_name: 'Garage socket power'}, 10 * MINUTE),
  entity('sensor.office_co2', 612, {friendly_name: 'Office CO2', unit_of_measurement: 'ppm', device_class: 'carbon_dioxide'}, 30 * 1000),
  entity('sensor.garden_illuminance', 12500, {friendly_name: 'Garden light level', unit_of_measurement: 'lx', device_class: 'illuminance'}, 5 * MINUTE),
  entity('sensor.odd_name', 3, {friendly_name: '<script>alert(1)</script> sensor'}, null),
  entity('sensor.hallway_motion_battery', 12, {friendly_name: 'Hallway motion battery', unit_of_measurement: '%', device_class: 'battery'}, 6 * HOUR),
  entity('binary_sensor.hallway_motion', 'on', {friendly_name: 'Hallway motion', device_class: 'motion'}, 20 * 1000),
  entity('binary_sensor.front_door', 'off', {friendly_name: 'Front door', device_class: 'door'}, 4 * HOUR),
  entity('binary_sensor.boiler_problem', 'off', {friendly_name: 'Boiler problem', device_class: 'problem'}, DAY),
];

const nothing = {events: [], errors: {}, status: {}};
const event = (summary, start, hours, extra = {}) => ({summary, startMs: start, endMs: start + hours * HOUR, allDay: false, partial: false,
  calendarId: 'calendar.alex_personal', location: '', description: '', ...extra});
// Today's lunch, tomorrow's all-day event from a partial calendar, and a
// dentist appointment later tomorrow; one calendar could not be read.
const WEEK = {
  events: [
    event('Lunch with Sam', HOME_NOW + 30 * MINUTE, 1.5, {location: 'Chez Léon', description: 'Table by the window.'}),
    event('Recycling park', HOME_NOW + 11.5 * HOUR, 24, {allDay: true, partial: true, calendarId: 'calendar.kids'}),
    event('Dentist', HOME_NOW + DAY + 2 * HOUR, 1, {calendarId: 'calendar.sam_personal', location: 'Rue de la Loi 12'}),
  ],
  errors: {'calendar.family': 'Calendar offline'},
  status: {'calendar.alex_personal': 'ok', 'calendar.kids': 'partial', 'calendar.sam_personal': 'ok', 'calendar.family': 'error'},
};

export const HOME_FIXTURES = [
  {id: 'full', title: 'Everything reporting: peak, exporting, the cap binding and two alerts',
    states: states([
      ...people('home', 'not_home'),
      entity(E.weather, 'sunny', {temperature: 19.2, humidity: 55, wind_speed: 9, wind_speed_unit: 'km/h'}),
      entity(E.priceAllIn, 0.3412, {unit_of_measurement: '€/kWh'}),
      entity(E.offPeakNow, 'off'),
      entity(PEAK.price, 0.1234, {unit_of_measurement: '€/kWh'}), entity(OFF_PEAK.price, 0.0987, {unit_of_measurement: '€/kWh'}),
      entity(E.elapsedDays, 89, {unit_of_measurement: 'd'}),
      kwh(PEAK.imported, 812.4), kwh(PEAK.exported, 1430.2), kwh(PEAK.reserve, 617.8), kwh(PEAK.billable, 0),
      kwh(OFF_PEAK.imported, 1210.6), kwh(OFF_PEAK.exported, 420.3), kwh(OFF_PEAK.reserve, 0), kwh(OFF_PEAK.billable, 790.3),
      euros(E.capCredit, 12.34, {slack_eur: 12.34, binding: 'true', cap_eur: 245.6}),
      ...COSTS.map(([, id], i) => euros(id, [310.12, 18.4, 42, 160.75, 21.3, 38.9][i])),
      kwh(E.grossImport, 2023), euros(E.bill, 612.45), entity(E.reliability, 87, {unit_of_measurement: '%'}),
      kwh(E.solarToday, 8.4), kwh(E.importToday, 2.1), kwh(E.exportToday, 5.3), kwh(E.solarTomorrow, 22.3),
      watts(E.grid, -1520), watts(E.solar, 2840), watts(E.load, 1320),
      kwh(E.selfConsumed, 3.1), kwh(E.solarRemaining, 4.2),
      entity(E.vacuum, 'docked', {friendly_name: 'Roborock S8 Pro Ultra'}),
      entity(E.vacuumBattery, 100, {unit_of_measurement: '%', device_class: 'battery'}),
      entity(E.vacuumArea, 42.5, {unit_of_measurement: 'm²'}), entity(E.vacuumProgress, 100, {unit_of_measurement: '%'}),
      entity('sensor.residual_waste', 2, {unit_of_measurement: 'days'}), entity('sensor.pmc', 3, {unit_of_measurement: 'days'}),
      entity('sensor.paper', 9, {unit_of_measurement: 'days'}),
      watts(DISHWASHER, 1450, {friendly_name: 'Dishwasher plug power'}), watts(DRYER, 3, {friendly_name: 'Dryer plug power'}),
      ...MAINTENANCE.map(([, id], i) => entity(id, [0, 12, 48.5, 'unavailable'][i], {unit_of_measurement: 'h'})),
      entity(E.airco, 'heat', {friendly_name: 'Airco', current_temperature: 20.5, temperature: 21}),
      entity(E.boilerPressure, 1.6, {unit_of_measurement: 'bar', device_class: 'pressure'}),
      entity('update.home_assistant_core_update', 'on', {friendly_name: 'Home Assistant Core update', installed_version: '2026.9.3', latest_version: '2026.10.0'}),
      ...catalogue(),
    ]),
    agenda: WEEK, agendaLoading: false, forecasts: []},
  {id: 'quiet', title: 'Gaps: off-peak and importing, solar asleep, no costs or prices, the vacuum cleaning',
    states: states([
      ...people('home', 'home'),
      entity(E.weather, 'cloudy', {temperature: 12, humidity: 80, wind_speed: 20, wind_speed_unit: 'km/h'}),
      entity(E.priceAllIn, 0.2211, {unit_of_measurement: '€/kWh'}),
      entity(E.offPeakNow, 'on'),
      kwh(OFF_PEAK.imported, 1210.6), kwh(OFF_PEAK.exported, 420.3), kwh(OFF_PEAK.billable, 'unknown'),
      euros(E.capCredit, 0, {slack_eur: -30.5, binding: false, cap_eur: 245.6}),
      kwh(E.grossImport, 2023), euros(E.bill, 'unavailable'),
      kwh(E.solarToday, 0.2), kwh(E.importToday, 6.8), kwh(E.exportToday, 0), kwh(E.solarTomorrow, 'unknown'),
      watts(E.grid, 850), watts(E.solar, 'unavailable'), watts(E.load, 850),
      entity(E.vacuum, 'cleaning', {friendly_name: 'Roborock S8 Pro Ultra'}),
      entity(E.vacuumBattery, 76, {unit_of_measurement: '%', device_class: 'battery'}),
      entity(E.vacuumArea, 18.5, {unit_of_measurement: 'm²'}), entity(E.vacuumProgress, 55, {unit_of_measurement: '%'}),
      entity('sensor.residual_waste', 4, {unit_of_measurement: 'days'}), entity('sensor.pmc', 'unknown', {unit_of_measurement: 'days'}),
      entity('sensor.paper', 6, {unit_of_measurement: 'days'}),
      watts(DISHWASHER, 'unavailable', {friendly_name: 'Dishwasher plug power'}),
      ...MAINTENANCE.map(([, id], i) => entity(id, [40, 12, 48.5, 90][i], {unit_of_measurement: 'h'})),
      entity(E.boilerPressure, 1.4, {unit_of_measurement: 'bar', device_class: 'pressure'}),
    ]),
    agenda: nothing, agendaLoading: false, forecasts: []},
  // Almost nothing is set up: no people, no readings, and the calendars
  // failing. Missing stays missing: never 0.
  {id: 'missing', title: 'Almost nothing set up, and the calendars failing',
    states: states([entity(E.vacuum, 'unavailable', {friendly_name: 'Roborock S8 Pro Ultra'})]),
    agenda: {events: [], errors: {'calendar.alex_personal': 'Calendar offline', 'calendar.kids': 'Calendar offline'},
      status: {'calendar.alex_personal': 'error', 'calendar.kids': 'error'}}, agendaLoading: false, forecasts: []},
];

// A day's record from its midnight to `until`, as the element keeps
// Energy's chart's cache group (v37): a sample every five minutes, each
// series eased between its hourly values (`load` and `solar`, by the hour
// of the day, each holding at its hour), the house's with a little ripple,
// so the chart's half hours aren't a staircase, and the last sample at `until`
// the live readings (`live`, {load, solar}). Solar is null (the inverter
// asleep) wherever an hour either side of it is. The grid is the house less
// solar, below zero while it exports. In W.
export function recordedDay(midnight, until, {load, solar}, live) {
  const eased = (profile, t) => {
    const h = (t - midnight) / HOUR, i = Math.floor(h), [a, b] = [profile[i], profile[Math.min(i + 1, 23)]];
    return a === null || b === null ? null : Math.round(a + (b - a) * (1 - Math.cos(Math.PI * (h - i))) / 2);
  };
  const times = Array.from({length: Math.ceil((until - midnight) / (5 * MINUTE))}, (_, i) => midnight + i * 5 * MINUTE);
  const house = t => eased(load, t) + Math.round(30 * Math.sin(t / (7 * MINUTE)) + 20 * Math.sin(t / (3 * MINUTE)));
  const series = (value, last) => [...times.map(t => ({timestamp: iso(t), value: value(t)})), {timestamp: iso(until), value: last}];
  return {
    data: {series: {[E.load]: series(house, live.load), [E.solar]: series(t => eased(solar, t), live.solar),
      [E.grid]: series(t => house(t) - (eased(solar, t) ?? 0), live.load - (live.solar ?? 0))}, errors: {}},
    start: midnight, end: until,
  };
}

// Today's power from midnight to HOME_NOW (12:30): the house's load, solar
// through the morning, and the grid going negative while solar exports,
// ending on the full fixture's live readings (house 1.32 kW, solar 2.84 kW,
// exporting 1.52 kW). Each by the hour of the day, in W.
export const HOME_MIDNIGHT = HOME_NOW - 12.5 * HOUR;
const LOAD = [480, 420, 380, 350, 340, 360, 410, 650, 980, 720, 540, 610, 1320, 1600, 900, 700, 650, 820, 1450, 1900, 1650, 1200, 900, 600];
const SOLAR = [null, null, null, null, null, null, null, 0, 80, 450, 1100, 1800, 2840, 2700, 2600, 2100, 1400, 700, 150, 0, null, null, null, null];
export const HOME_POWER_HISTORY = recordedDay(HOME_MIDNIGHT, HOME_NOW, {load: LOAD, solar: SOLAR}, {load: 1320, solar: 2840});
