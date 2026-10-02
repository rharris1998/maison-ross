// The sky over every page (#29 step 3): what the living sky draws, read
// from sun.sun and weather.forecast_home. It follows only the
// hour and the weather, never Home Assistant's theme. It is plain data that
// React draws (src/sky-model.js turns it into a gradient, clouds and stars):
// screen.js hands it over as chrome.sky on every page. It reads only the
// states, never the clock, and a missing sun or weather reads as unknown,
// never as a made-up sky. Nothing in it is drawn text: the kind and the plot
// are structural.
import {E, numeric, available} from './model.js?v=38';

/**
 * @typedef {{kind: 'clear'|'partly'|'cloudy'|'fog'|'unknown', plot: SkyPlot}} Sky
 * @typedef {{elevation: number|null, azimuth: number|null, rising: boolean|null, coverage: number|null,
 *   fall: 'rain'|'snow'|'hail'|null, storm: boolean, wind: boolean}} SkyPlot
 *   elevation, azimuth and rising are sun.sun's attributes, null while the sun is missing or unavailable.
 *   coverage is the weather's cloud_coverage (0–100), null when it isn't reported, so the renderer
 *   can size the clouds. fall, storm and wind come from the weather's condition (the table in the
 *   step 3 contract, section 3.1); kind is 'unknown' while the weather is missing or unavailable.
 */

/** The sky while nothing is known about it. */
const UNKNOWN_SKY = Object.freeze({kind: 'unknown', plot: Object.freeze({elevation: null, azimuth: null, rising: null, coverage: null, fall: null, storm: false, wind: false})});

// Each of Home Assistant's 15 weather conditions as [kind, fall, storm, wind].
// Anything else (unavailable, unknown, a condition Home Assistant adds later)
// is the unknown sky's.
const CONDITIONS = Object.freeze({
  'clear-night': ['clear', null, false, false], sunny: ['clear', null, false, false],
  partlycloudy: ['partly', null, false, false], cloudy: ['cloudy', null, false, false], exceptional: ['cloudy', null, false, false],
  fog: ['fog', null, false, false], rainy: ['cloudy', 'rain', false, false], pouring: ['cloudy', 'rain', false, false],
  lightning: ['cloudy', null, true, false], 'lightning-rainy': ['cloudy', 'rain', true, false],
  snowy: ['cloudy', 'snow', false, false], 'snowy-rainy': ['cloudy', 'snow', false, false], hail: ['cloudy', 'hail', false, false],
  windy: ['partly', null, false, true], 'windy-variant': ['cloudy', null, false, true],
});
const UNKNOWN_CONDITION = Object.freeze([UNKNOWN_SKY.kind, UNKNOWN_SKY.plot.fall, UNKNOWN_SKY.plot.storm, UNKNOWN_SKY.plot.wind]);

// sun.sun's elevation, azimuth and rising, each null unless the sun is
// available and the attribute is a number (a boolean for rising).
function sunPlot(sun) {
  const a = available(sun) ? sun.attributes ?? {} : {};
  return {elevation: numeric(a.elevation), azimuth: numeric(a.azimuth), rising: typeof a.rising === 'boolean' ? a.rising : null};
}

// The weather's cloud_coverage clamped to 0–100, or null while the weather
// is unavailable or doesn't report it.
function coverage(weather) {
  const n = available(weather) ? numeric(weather.attributes?.cloud_coverage) : null;
  return n === null ? null : Math.min(100, Math.max(0, n));
}

/**
 * The sky from sun.sun (E.sun) and weather.forecast_home (E.weather). The sun
 * is read whatever the weather says, and the weather whatever the sun says.
 * @param {object} states Home Assistant's states by entity id.
 * @returns {Sky}
 */
export function skyValue(states) {
  const weather = states?.[E.weather];
  const [kind, fall, storm, wind] = available(weather) && Object.hasOwn(CONDITIONS, weather.state) ? CONDITIONS[weather.state] : UNKNOWN_CONDITION;
  return {kind, plot: {...sunPlot(states?.[E.sun]), coverage: coverage(weather), fall, storm, wind}};
}
