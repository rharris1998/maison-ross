// The temperature scale as a colour (#29 step 3): what the zone capsules
// fill with, and from step 4 the target bars, a zone's glyph and a room
// reading in the charts. Pure: it reads only tokens.js's TEMP_SCALE, the
// rooms' cold to hot stops (m-temp-1…6's colours), and writes no colour of
// its own. It lives in ui/ so Maison's parts can use it; the header charts
// import it through charts/scale.js.
import {TEMP_SCALE} from './tokens.js';

// The stops as [°C, [r, g, b]], from their hex colours.
const STOPS = TEMP_SCALE.map(([at, hex]) => [at, [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))]);

/**
 * A temperature's colour on the scale: the two stops around it mixed in
 * proportion, each channel rounded, clamped to the coldest and hottest stops
 * at the ends (±Infinity too). Anything that isn't a number gets the coldest.
 * @param {number} t °C.
 * @returns {string} 'rgb(r,g,b)'
 */
export function tempColour(t) {
  const [low, high] = [STOPS[0][0], STOPS.at(-1)[0]];
  const at = typeof t === 'number' && !Number.isNaN(t) ? Math.min(high, Math.max(low, t)) : low;
  const upper = Math.max(1, STOPS.findIndex(([stop]) => stop >= at)), [[a, from], [b, to]] = [STOPS[upper - 1], STOPS[upper]];
  const share = (at - a) / (b - a);
  return `rgb(${from.map((channel, i) => Math.round(channel + (to[i] - channel) * share)).join(',')})`;
}
