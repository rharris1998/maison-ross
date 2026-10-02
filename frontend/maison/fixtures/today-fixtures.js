// Synthetic Today states (#27): a quiet day, a busy one, the vacuum paused
// with the calendar still loading, everything unavailable, and (#29 step 4)
// a night with the heating off. Each fixture also carries what the element
// loads beside the states: the next seven days' agenda and the daily
// forecast. The Node tests check Today against these, and the Car glance on
// each comes from a Car fixture, its zones from a Climate fixture. No real
// readings. The grid meter, today's export and the zones are there for
// Today's hero and widgets (#29 step 4).
import {E} from '../../../config/www/maison/model.js';
import {CAR_FIXTURES, CAR_NOW} from './car-fixtures.js';
import {CLIMATE_FIXTURES} from './climate-fixtures.js';

// Sunday 27 September 2026, 12:30 in Brussels: the Car fixtures' time, so
// their glance reads as it does on the Car tab.
export const TODAY_NOW = CAR_NOW;
// The same Sunday at 21:04: the night fixture's own time (its `now`), so it
// greets the evening under its night sky.
export const TODAY_NIGHT_NOW = Date.parse('2026-09-27T21:04:00+02:00');
const HOUR = 3600000, DAY = 24 * HOUR;
const iso = ms => new Date(ms).toISOString();
// A state last changed 20 minutes before `now`.
const entity = (entity_id, state, attributes = {}, now = TODAY_NOW) => ({
  entity_id, state: String(state), attributes,
  last_changed: iso(now - 20 * 60000), last_updated: iso(now - 20 * 60000), last_reported: iso(now - 60000),
});
const car = id => CAR_FIXTURES.find(f => f.id === id).states;
const climate = id => CLIMATE_FIXTURES.find(f => f.id === id).states;

// The grid meter reads the house less solar: below zero is export.
function base({vacuum = 'docked', battery = 100, area = 42.5, progress = 0, offPeak = 'off', bins = [5, 3, 9], grid = -1606} = {}) {
  return {
    [E.load]: entity(E.load, 1234, {unit_of_measurement: 'W', device_class: 'power'}),
    [E.solar]: entity(E.solar, 2840, {unit_of_measurement: 'W', device_class: 'power'}),
    [E.grid]: entity(E.grid, grid, {unit_of_measurement: 'W', device_class: 'power'}),
    [E.weather]: entity(E.weather, 'partlycloudy', {temperature: 17.4, humidity: 62, wind_speed: 14.2, wind_speed_unit: 'km/h'}),
    [E.vacuum]: entity(E.vacuum, vacuum, {friendly_name: 'Roborock S8 Pro Ultra'}),
    [E.vacuumBattery]: entity(E.vacuumBattery, battery, {unit_of_measurement: '%', device_class: 'battery'}),
    [E.vacuumArea]: entity(E.vacuumArea, area, {unit_of_measurement: 'm²'}),
    [E.vacuumProgress]: entity(E.vacuumProgress, progress, {unit_of_measurement: '%'}),
    [E.solarToday]: entity(E.solarToday, 8.4, {unit_of_measurement: 'kWh'}),
    [E.importToday]: entity(E.importToday, 2.1, {unit_of_measurement: 'kWh'}),
    [E.exportToday]: entity(E.exportToday, 3.1, {unit_of_measurement: 'kWh'}),
    'sensor.residual_waste': entity('sensor.residual_waste', bins[0], {unit_of_measurement: 'days'}),
    'sensor.pmc': entity('sensor.pmc', bins[1], {unit_of_measurement: 'days'}),
    'sensor.paper': entity('sensor.paper', bins[2], {unit_of_measurement: 'days'}),
    [E.offPeakNow]: entity(E.offPeakNow, offPeak),
    [E.priceAllIn]: entity(E.priceAllIn, 0.341, {unit_of_measurement: '€/kWh'}),
  };
}
const nothing = {events: [], errors: {}, status: {'calendar.alex_personal': 'ok'}};
const event = (summary, start, hours, extra = {}) => ({summary, startMs: start, endMs: start + hours * HOUR, allDay: false, partial: false,
  calendarId: 'calendar.alex_personal', location: '', description: '', ...extra});
const forecast = (days, condition, temperature) => ({datetime: iso(TODAY_NOW + days * DAY), condition, temperature});
const FORECAST = [forecast(0, 'partlycloudy', 18), forecast(1, 'rainy', 14.6), forecast(2, 'sunny', 19.2), forecast(3, 'cloudy', 16), forecast(4, 'clear-night', 12)];

export const TODAY_FIXTURES = [
  {id: 'quiet', title: 'A quiet Sunday: nothing needs attention',
    states: {...climate('airco_heating'), ...base(), ...car('wait_offpeak')}, agenda: nothing, agendaLoading: false, forecasts: FORECAST},
  {id: 'busy', title: 'Alerts, an event on now, a bin tomorrow and the vacuum cleaning off-peak',
    // The Car charging draws the house's solar, so a little comes from the grid.
    states: {...climate('house_running'), ...base({vacuum: 'cleaning', battery: 76, area: 18.5, progress: 40, offPeak: 'on', bins: [5, 1, 9], grid: 120}), ...car('solar'),
      'binary_sensor.roborock_s8_pro_ultra_water_shortage': entity('binary_sensor.roborock_s8_pro_ultra_water_shortage', 'on'),
      'binary_sensor.rate_card_ends_within_30_days': entity('binary_sensor.rate_card_ends_within_30_days', 'on')},
    agenda: {events: [event('Coffee', TODAY_NOW - 3 * HOUR, 1), event('School fair', TODAY_NOW - 30 * 60000, 2),
      event('Recycling park', TODAY_NOW + DAY - 12.5 * HOUR, 24, {allDay: true, partial: true, calendarId: 'calendar.kids'})],
    errors: {}, status: {'calendar.alex_personal': 'ok', 'calendar.kids': 'partial'}}, agendaLoading: false, forecasts: FORECAST},
  {id: 'paused', title: 'The vacuum paused while the calendar loads',
    states: {...climate('house_running'), ...base({vacuum: 'paused', battery: 54, area: 9, progress: 20}), ...car('wait_offpeak_asleep')},
    agenda: nothing, agendaLoading: true, forecasts: []},
  // Missing readings stay missing: never 0. The first collection, the Paper
  // collection and the price have no sensor at all.
  {id: 'unavailable', title: 'Readings unavailable, the calendar failing, no forecast',
    states: {...climate('sensors_unavailable'), ...Object.fromEntries(Object.entries(base()).filter(([id]) => ![E.solar, E.importToday, E.priceAllIn, 'sensor.residual_waste', 'sensor.paper'].includes(id))
      .map(([id, state]) => [id, {...state, state: id === 'sensor.pmc' ? 'unknown' : 'unavailable'}])),
      [E.weather]: entity(E.weather, 'unavailable'), ...car('unplugged')},
    agenda: {events: [], errors: {'calendar.alex_personal': 'Calendar offline'}, status: {'calendar.alex_personal': 'error'}}, agendaLoading: false, forecasts: []},
  // Sunday at 21:04 (its own `now`): the sun below the horizon and the
  // panels asleep (no reading), 316 W from the grid off-peak, the day's
  // energy in, the heating switched off on the thermostat, two events
  // tomorrow morning, the vacuum docked and the Car at its limit.
  {id: 'night', title: 'A night off-peak: solar asleep, the heating off, events tomorrow morning', now: TODAY_NIGHT_NOW,
    states: {...climate('house_off'), ...base({offPeak: 'on'}), ...car('complete'),
      [E.sun]: entity(E.sun, 'below_horizon', {elevation: -30, azimuth: 297, rising: false, friendly_name: 'Sun'}, TODAY_NIGHT_NOW),
      [E.solar]: entity(E.solar, 'unavailable', {unit_of_measurement: 'W', device_class: 'power'}, TODAY_NIGHT_NOW),
      [E.grid]: entity(E.grid, 316, {unit_of_measurement: 'W', device_class: 'power'}, TODAY_NIGHT_NOW),
      [E.load]: entity(E.load, 316, {unit_of_measurement: 'W', device_class: 'power'}, TODAY_NIGHT_NOW),
      [E.solarToday]: entity(E.solarToday, 11.5, {unit_of_measurement: 'kWh'}, TODAY_NIGHT_NOW),
      [E.exportToday]: entity(E.exportToday, 4.9, {unit_of_measurement: 'kWh'}, TODAY_NIGHT_NOW),
      [E.importToday]: entity(E.importToday, 4.6, {unit_of_measurement: 'kWh'}, TODAY_NIGHT_NOW)},
    agenda: {events: [event('Swimming lesson', Date.parse('2026-09-28T07:00:00+02:00'), 1), event('Dentist', Date.parse('2026-09-28T09:30:00+02:00'), 1)],
      errors: {}, status: {'calendar.alex_personal': 'ok'}}, agendaLoading: false, forecasts: FORECAST},
];

// A full week (#29, v35): seven events in the next three days and Residual
// waste on Friday, so Coming up says "N more" and still shows the
// collection, which no calendar lists. It stands apart from TODAY_FIXTURES,
// which the suites pin one by one.
const MONDAY = Date.parse('2026-09-28T09:00:00+02:00');
export const TODAY_WEEK = {id: 'week', title: 'A full week: seven events in three days, and a collection on Friday',
  states: {...climate('airco_heating'), ...base({bins: [5, 'unknown', 9]}), ...car('wait_offpeak')},
  agenda: {events: [event('Swimming lesson', MONDAY, 1), event('Dentist', MONDAY + 4 * HOUR, 1), event('Choir', MONDAY + 10 * HOUR, 1.5),
    event('Market', MONDAY + DAY, 2), event('Parents’ evening', MONDAY + DAY + 9 * HOUR, 2), event('Swimming lesson', MONDAY + 2 * DAY, 1),
    event('Book club', MONDAY + 2 * DAY + 10 * HOUR, 2)], errors: {}, status: {'calendar.alex_personal': 'ok'}},
  agendaLoading: false, forecasts: FORECAST};
