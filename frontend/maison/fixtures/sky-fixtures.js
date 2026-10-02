// Synthetic skies for Maison's hero (#29 step 3): sun.sun and
// weather.forecast_home through a Monday in Brussels, from a clear night to
// a storm, and one with neither. Each fixture's `now` is an hour that fits its
// sky. The gallery draws each as a strip, the heroes lay one over a page
// fixture (gallery-snapshots.js heroSnapshot), and the Node tests check the
// sky and the headers against them. SKY_FORECAST is the daily forecast the
// weather heroes read. No real readings.
import {E} from '../../../config/www/maison/model.js';

// Monday 28 September 2026 in Brussels (summer time, UTC+2), at `time`.
const at = time => Date.parse(`2026-09-28T${time}:00+02:00`);
const DAY = 24 * 3600000;
const iso = ms => new Date(ms).toISOString();
// A state reported a minute before `now`, as Home Assistant keeps it.
const entity = (now, entity_id, state, attributes = {}) => ({
  entity_id, state: String(state), attributes,
  last_changed: iso(now - 20 * 60000), last_updated: iso(now - 60000), last_reported: iso(now - 60000),
});
// sun.sun as Home Assistant reports it: above or below the horizon, with its
// elevation and azimuth in degrees and whether it is rising.
const sun = (now, elevation, azimuth, rising) => entity(now, E.sun, elevation > 0 ? 'above_horizon' : 'below_horizon',
  {elevation, azimuth, rising, friendly_name: 'Sun'});
const weather = (now, condition, temperature, cloud_coverage) => entity(now, E.weather, condition, {temperature, cloud_coverage});
// One sky at `time`: the sun, then the weather.
function sky(id, title, time, [elevation, azimuth, rising], [condition, temperature, coverage]) {
  const now = at(time);
  return {id, title, now, states: {[E.sun]: sun(now, elevation, azimuth, rising), [E.weather]: weather(now, condition, temperature, coverage)}};
}

export const SKY_FIXTURES = [
  sky('night', 'A clear night, stars out', '21:04', [-30, 297, false], ['clear-night', 12, 5]),
  sky('night-cloudy', 'A cloudy night', '21:04', [-30, 297, false], ['cloudy', 18, 90]),
  sky('dawn', 'Dawn, before sunrise, partly cloudy', '07:10', [-3, 88, true], ['partlycloudy', 9, 45]),
  sky('noon', 'Midday sun', '13:10', [38, 172, true], ['sunny', 24, 5]),
  sky('afternoon-cloudy', 'A cloudy afternoon', '15:30', [25, 219, false], ['cloudy', 17, 85]),
  sky('rain', 'Rain in the late morning', '11:00', [20, 138, true], ['rainy', 13, 100]),
  sky('storm', 'A thunderstorm with rain', '17:00', [12, 244, false], ['lightning-rainy', 19, 100]),
  sky('snow', 'Snow in the morning', '10:00', [10, 120, true], ['snowy', 0, 100]),
  sky('fog', 'Morning fog', '08:30', [4, 103, true], ['fog', 8, 100]),
  sky('dusk', 'Dusk, after sunset, partly cloudy', '19:40', [-2, 270, false], ['partlycloudy', 14, 40]),
  // Neither the sun nor the weather: no sun.sun at all, and the weather unavailable.
  {id: 'unknown', title: 'No sun and the weather unavailable', now: at('12:00'),
    states: {[E.weather]: entity(at('12:00'), E.weather, 'unavailable')}},
];

// Four days of daily forecast from Monday 28 September, each at local noon,
// in the shape the element loads (today-fixtures.js): today, then three.
const noon = at('12:00');
const day = (days, condition, temperature) => ({datetime: iso(noon + days * DAY), condition, temperature});
export const SKY_FORECAST = [day(0, 'sunny', 24), day(1, 'rainy', 17), day(2, 'partlycloudy', 20), day(3, 'cloudy', 18)];
