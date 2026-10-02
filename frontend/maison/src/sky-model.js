// What the living sky paints (#29 step 3), from chrome.sky (sky.js's Sky):
// the phase, the gradient's four stops, the sun's glow and the twilight's
// warm horizon, a fog's haze, the clouds, the stars, and rain, snow or hail.
// Pure, with no React and no DOM, so the contrast test can sample it at every
// elevation. The colours come from tokens.js's SKY; the sky follows only the
// hour and the weather, never Home Assistant's theme.
//
// Text on the sky is white (DARK's --m-label, and --m-sky-label-2 as the
// hero's --m-label-2) and must stay legible wherever it sits (TEXT_BANDS),
// so every light added over the gradient (the glow, the horizon, the haze
// and each cloud) has its alpha capped here: what text over it still reads
// at, plus a small margin, decides how bright it may be.
import {DARK, SHARED, SKY} from './ui/tokens.js';

/**
 * The bands of the hero where text sits, as fractions of its height (0 at
 * the top, 1 at the bottom), measured on every page's hero and its charts,
 * on the dashboard with its tab bar and on the gallery's specimens, at 375,
 * 900 and 1,280px, with a hundredth to spare. The desktop specimens, with
 * no pill above them, set the date highest (6%); Home status's short hero
 * (the sky and the header only) sets the title lowest. `labels` are the hero's
 * text colours there, and `min` the contrast each must reach: 4.5:1 for
 * text, 3:1 for the 34px title and the 96px temperature (and the 44px
 * price). The weather's days sit on their own scrim and are held to the sky
 * alone here. Nothing sits above the date or in the bottom var(--m-sky-fade),
 * so the glow shows there.
 * @type {readonly {id: string, from: number, to: number, labels: readonly ('label'|'label-2')[], min: number}[]}
 */
export const TEXT_BANDS = deepFreeze([
  {id: 'date', from: 0.05, to: 0.52, labels: ['label-2'], min: 4.5},
  {id: 'title', from: 0.11, to: 0.74, labels: ['label'], min: 3},
  {id: 'line', from: 0.21, to: 0.38, labels: ['label-2'], min: 4.5},
  {id: 'temperature', from: 0.24, to: 0.87, labels: ['label', 'label-2'], min: 3},
  {id: 'reading', from: 0.48, to: 0.89, labels: ['label', 'label-2'], min: 4.5},
  {id: 'chart', from: 0.32, to: 0.89, labels: ['label', 'label-2'], min: 4.5},
]);

/** Where the gradient's four stops sit, as fractions of the hero's height. */
export const STOP_AT = Object.freeze([0, 0.36, 0.72, 1]);

/**
 * A glow's alpha along its radius, as [distance from the centre (fraction
 * of the radius), share of the peak alpha]: soft, with no edge. The sun and
 * the horizon use it, drawn as radial-gradient(closest-side, …).
 */
export const GLOW_PROFILE = deepFreeze([[0, 1], [0.3, 0.62], [0.62, 0.2], [1, 0]]);

/**
 * The sun's own disc, by day: its alpha along its radius, solid to about
 * half and gone at its edge, drawn as radial-gradient(closest-side, …) over
 * the broad glow. It rides the top edge, above the text (sun.core).
 */
export const CORE_PROFILE = deepFreeze([[0, 1], [0.45, 0.92], [0.75, 0.4], [1, 0]]);

/**
 * A cloud's lobes, each [x, y, rx, ry] as percentages of the cloud's box (a
 * wide base and three puffs on it, all inside the box), and each lobe's
 * alpha along its radius (as GLOW_PROFILE). A cloud's alpha is where its
 * lobes stack deepest; each row of it is capped by the text beside it.
 */
export const CLOUD_LOBES = deepFreeze([[50, 72, 48, 26], [30, 60, 21, 32], [52, 45, 25, 42], [73, 60, 20, 30]]);
export const CLOUD_PROFILE = deepFreeze([[0, 1], [0.55, 0.8], [0.8, 0.4], [1, 0]]);

/**
 * @typedef {{phase: 'night'|'twilight'|'day'|'unknown', stops: string[],
 *   sun: {x: number, y: number, r: number, warmth: number, alpha: number, color: string, fills: string[]}|null,
 *   horizon: {x: number, y: number, rx: number, ry: number, alpha: number, color: string, fills: string[]}|null,
 *   haze: {color: string, stops: {at: number, alpha: number, fill: string}[]}|null,
 *   clouds: {key: string, x: number, y: number, w: number, h: number, alpha: number, duration: number, delay: number,
 *     color: string, fills: string[]}[],
 *   stars: {x: number, y: number, r: number, fill: string}[], starAlpha: number,
 *   fall: 'rain'|'snow'|'hail'|null, fallInk: string|null, storm: boolean}} SkyPaint
 *   phase: night below −6°, twilight from −6° to 6°, day above 6°, unknown while the elevation is null.
 *   stops: four hex colours, top to bottom at STOP_AT, interpolated between SKY's keyframes by elevation and
 *   blended toward the overcast (by day or by night) for cloud, fog and fall, and toward SKY.storm in a storm.
 *   sun: null at night and when unknown. x from the azimuth (east on the left), y from the elevation (the
 *   higher, the nearer the top, above the text), both fractions of the hero box; r its radius as a fraction
 *   of the hero's height; warmth 1 at the horizon to 0 from 25°; alpha its peak; fills its colour at each
 *   GLOW_PROFILE stop. horizon: the warm wash on the sun's side while it is near the horizon (x, y and rx
 *   fractions of the box, ry of its height), or null. haze: fog's low haze, alpha by height. clouds:
 *   deterministic, their count from kind and coverage; x and y the centre (fractions of the box), h the
 *   height and w the width, both as fractions of the hero's height so a cloud keeps its shape at any width;
 *   alpha where its lobes stack deepest; fills a lobe's colour at each CLOUD_PROFILE stop; key keeps a
 *   cloud's drift across updates, duration and delay are its drift in seconds. stars: deterministic, on clear
 *   or partly nights only (x and y fractions, r in px), shown at starAlpha. fallInk: rain's, snow's or
 *   hail's colour.
 */

// ---- Colour arithmetic ---------------------------------------------------

// A CSS colour (#RRGGBB or rgba(r,g,b,a)) as [r, g, b, a], channels 0–255.
function parse(colour) {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const [r, g, b, a = 1] = colour.match(/[\d.]+/g).map(Number);
  return [r, g, b, a];
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (lo, hi, v) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};
// Two colours mixed, channel by channel, as a CSS gradient mixes them.
const mix = (a, b, t) => [0, 1, 2].map(i => lerp(a[i], b[i], t));
const hexOf = rgb => `#${rgb.map(c => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const cssOf = (rgb, alpha) => `rgba(${rgb.slice(0, 3).map(c => Math.round(clamp(c, 0, 255))).join(',')},${+alpha.toFixed(3)})`;
// `top` at `alpha` over the opaque `under`.
const over = (under, top, alpha) => mix(under, top, alpha);

// WCAG's relative luminance and contrast ratio.
const LINEAR = Array.from({length: 256}, (_, c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = rgb => 0.2126 * LINEAR[Math.round(rgb[0])] + 0.7152 * LINEAR[Math.round(rgb[1])] + 0.0722 * LINEAR[Math.round(rgb[2])];
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---- Where text sits ------------------------------------------------------

// The text colours, as the hero sets them: the dark set in both schemes,
// with the sky's own secondary text.
const LABELS = {label: parse(DARK['m-label']), 'label-2': parse(SHARED['m-sky-label-2'])};
// A little more than the rule asks, so the browser's rounding (hex stops,
// each pixel to a byte) never tips it.
const MARGIN = 0.15;
/** Where the first text sits: above it, only the sun, stars and clouds may shine. */
export const TEXT_TOP = Math.min(...TEXT_BANDS.map(b => b.from));
// The most a star may shine where text sits.
const STAR_IN_TEXT = 0.3;
// The heights sampled, every 1% across the bands, and what text at each needs.
const SAMPLES = (() => {
  const lo = Math.min(...TEXT_BANDS.map(b => b.from)), hi = Math.max(...TEXT_BANDS.map(b => b.to)), ys = [];
  for (let i = Math.round(lo * 100); i <= Math.round(hi * 100); i++) ys.push(i / 100);
  return ys;
})();
const NEEDS = SAMPLES.map(y => {
  const need = new Map();
  for (const band of TEXT_BANDS.filter(b => y >= b.from && y <= b.to)) {
    for (const label of band.labels) need.set(label, Math.max(need.get(label) ?? 0, band.min));
  }
  return [...need].map(([label, min]) => [LABELS[label], min + MARGIN]);
});
// Whether every text that sits at sample i reads on `ground`.
const legible = (ground, i) => NEEDS[i].every(([[r, g, b, a], min]) => ratio(over(ground, [r, g, b], a), ground) >= min);

// The highest peak (up to `most`) a layer of `rgb` may have over `grounds`
// (one per sample), when at height y it shows at alphaAt(peak, y), keeping
// every text legible. The peak is a glow's alpha, or a cloud's lobe alpha.
function capped(grounds, rgb, alphaAt, most) {
  const fits = peak => SAMPLES.every((y, i) => {
    const alpha = alphaAt(peak, y);
    return alpha <= 0 || legible(over(grounds[i], rgb, alpha), i);
  });
  if (most <= 0 || fits(most)) return Math.max(0, most);
  let lo = 0, hi = most;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return fits(lo) ? lo : 0;
}
// `grounds` with the layer laid over them at its peak.
const laid = (grounds, rgb, alphaAt, peak) => grounds.map((ground, i) => over(ground, rgb, alphaAt(peak, SAMPLES[i])));
// A glow's alpha at height y: its peak times its shape there.
const scaled = shape => (peak, y) => peak * shape(y);
// The value at `v` along [at, value] points, linear between them and held
// beyond the ends.
function along(points, v) {
  const k = points.findIndex(([at]) => at >= v);
  if (k === 0) return points[0][1];
  if (k < 0) return points[points.length - 1][1];
  const [a0, s0] = points[k - 1], [a1, s1] = points[k];
  return lerp(s0, s1, (v - a0) / (a1 - a0));
}
// A glow's share of its peak at `d`, a fraction of its radius.
const share = (profile, d) => d >= 1 ? 0 : along(profile, d);

// ---- The gradient ---------------------------------------------------------

// Each keyframe at the elevation it belongs to: full night from −14°, the
// twilight's colour at −2°, full day from 10°. Between two, the stops ease
// from one to the next, so no phase boundary is a jump.
const ANCHORS = [[-14, 'night'], [-2, 'twilight'], [10, 'day']];
const KEYS = Object.fromEntries(['night', 'twilight', 'day', 'overcast', 'overcastNight', 'mist', 'snowfall', 'storm', 'unknown'].map(key => [key, SKY[key].map(stop => parse(stop).slice(0, 3))]));
// How much of the day there is at elevation e: 0 at night, 1 by day.
const dayness = e => smooth(-12, 10, e);

// The keyframe stops at elevation e.
function clearStops(e) {
  if (e <= ANCHORS[0][0]) return KEYS.night;
  const k = ANCHORS.findIndex(([at]) => at >= e);
  if (k < 0) return KEYS.day;
  const [[e0, a], [e1, b]] = [ANCHORS[k - 1], ANCHORS[k]];
  const t = smooth(e0, e1, e);
  return KEYS[a].map((stop, i) => mix(stop, KEYS[b][i], t));
}
// How far the weather greys the sky: not at all when clear, a little when
// partly cloudy, most of the way when cloudy, all of it in fog or rain.
function greying(kind, cover, fall) {
  const share = {clear: 0, partly: 0.12 + 0.18 * cover, cloudy: 0.6 + 0.3 * cover, fog: 0.95}[kind] ?? 0;
  return fall ? Math.max(share, 0.9) : share;
}
// The weather's own sky by day: fog's pale mist, snow's cool light, rain's
// slate a shade toward the storm's, and the overcast.
function greyFor(kind, fall) {
  if (kind === 'fog') return KEYS.mist;
  if (fall === 'snow') return KEYS.snowfall;
  if (fall) return KEYS.overcast.map((stop, i) => mix(stop, KEYS.storm[i], 0.3));
  return KEYS.overcast;
}
// The four stops for elevation e and the weather: the clear sky greyed
// toward the weather's own (by night, the night's overcast), and a storm's
// darker still.
function stopsFor(e, kind, cover, fall, storm) {
  const light = dayness(e), grey = greying(kind, cover, fall), day = greyFor(kind, fall);
  return clearStops(e).map((stop, i) => {
    const greyed = mix(stop, mix(KEYS.overcastNight[i], day[i], light), grey);
    return storm ? mix(greyed, mix(KEYS.overcastNight[i], KEYS.storm[i], light), 0.75) : greyed;
  });
}
// The gradient's colour at height y.
function colourAt(stops, y) {
  const k = clamp(STOP_AT.findIndex(at => at >= y), 1, STOP_AT.length - 1);
  return mix(stops[k - 1], stops[k], clamp((y - STOP_AT[k - 1]) / (STOP_AT[k] - STOP_AT[k - 1]), 0, 1));
}

// ---- What lies on it ------------------------------------------------------

// The places a cloud may take, each {id, x, y, h, aspect} (x and y its
// centre, fractions of the box; h a fraction of the hero's height; aspect
// its width over its height). Two ride the top edge at the left, above the
// text, where a cloud may be white: by day only they are drawn, and the
// weather's gradient carries the rest. By night the others fill in order:
// the first two read alone, and six make an overcast. None drifts under the
// pill (the top centre from 700px) or the glass tools (the top right), whose
// blur would have to follow it. Fog lies low and long.
const TOP = [{id: 'top-0', x: 0.13, y: -0.035, h: 0.17, aspect: 3.2}, {id: 'top-1', x: 0.02, y: -0.04, h: 0.15, aspect: 2.6}];
const SLOTS = [
  TOP[0], {id: 'mid-1', x: 0.22, y: 0.36, h: 0.15, aspect: 3}, {id: 'mid-2', x: 0.66, y: 0.58, h: 0.13, aspect: 2.7},
  {id: 'mid-3', x: 0.06, y: 0.2, h: 0.12, aspect: 2.6}, {id: 'mid-4', x: 0.95, y: 0.44, h: 0.14, aspect: 2.9}, {id: 'mid-5', x: 0.1, y: 0.74, h: 0.13, aspect: 3.1},
];
// The most clouds that drift at once.
const MOST_CLOUDS = 6;
const FOG_SLOTS = [{id: 'fog-0', x: 0.3, y: 0.66, h: 0.2, aspect: 5.5}, {id: 'fog-1', x: 0.82, y: 0.78, h: 0.18, aspect: 5}, {id: 'fog-2', x: 0.6, y: 0.52, h: 0.14, aspect: 5}];
// Fog's haze: its share of the peak by height, from none at 30% down, faint
// where text sits and thick below it, at the ground.
const HAZE = [[0.3, 0], [0.62, 0.2], [0.88, 0.35], [1, 1]];
// How many clouds a kind draws by night, and on the top edge by day, from
// none to its most as the cover grows.
const COUNT = {clear: [0, 1], partly: [2, 3], cloudy: [4, 6], fog: [2, 3]};
const DAY_COUNT = {clear: [0, 1], partly: [1, 2], cloudy: [2, 2], fog: [0, 0]};
// A cloud capped below .12 would be a smudge: it is not drawn, and one
// capped between .12 and .18 fades in, so none pops as the sun moves.
const FAINT = [0.12, 0.18];
// A cloud's share of its colour's alpha, by kind, before the cap.
const OPACITY = {clear: 0.7, partly: 0.9, cloudy: 1, fog: 0.9};

// The clouds' colour, alpha included: white by day, dim blue-grey by night,
// warmed by a low sun; storm clouds are dark. While the hour is unknown
// they are night's.
function cloudInk(e, storm) {
  if (storm) return parse(SKY.cloudStorm);
  const day = parse(SKY.cloudDay), night = parse(SKY.cloudNight);
  if (e === null) return night;
  const t = dayness(e), warm = smooth(-6, -1, e) * (1 - smooth(4, 14, e)) * 0.3;
  return [...mix(mix(night, day, t), parse(SKY.horizonWarm), warm), lerp(night[3], day[3], t)];
}

// How deep a cloud's lobes stack on each row of its box (0 at its top, 100
// at its bottom) at a lobe alpha l: the most alpha anywhere along the row,
// tabled for l from 0 to 1 the first time a cloud is painted. A cloud is
// capped row by row against the text beside each row, so its soft top and
// bottom never hold its middle back.
let stacks = null;
function stackAt(lobe, row) {
  if (!stacks) {
    const rows = Array.from({length: 101}, (_, py) => Array.from({length: 101}, (_, px) =>
      CLOUD_LOBES.map(([cx, cy, rx, ry]) => share(CLOUD_PROFILE, Math.hypot((px - cx) / rx, (py - cy) / ry)))));
    stacks = Array.from({length: 51}, (_, k) => rows.map(cells => cells.reduce((most, cell) =>
      Math.max(most, 1 - cell.reduce((clear, s) => clear * (1 - (k / 50) * s), 1)), 0)));
  }
  const k = Math.min(49, Math.floor(lobe * 50)), r = clamp(row, 0, 100), r0 = Math.min(99, Math.floor(r));
  const at = level => lerp(stacks[level][r0], stacks[level][r0 + 1], r - r0);
  return lerp(at(k), at(k + 1), lobe * 50 - k);
}
// Where a cloud's lobes stack deepest, at lobe alpha l.
const deepest = lobe => Math.max(...Array.from({length: 101}, (_, row) => stackAt(lobe, row)));
// The lobe alpha whose deepest stack is `alpha`.
function lobeAlpha(alpha) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2;
    if (deepest(mid) <= alpha) lo = mid; else hi = mid;
  }
  return lo;
}

// A deterministic run of numbers in [0, 1), the same on every render.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// The night's stars, placed once: a dozen bright above the text, and
// thirty where text sits, never brighter than .3 there so none reads as
// punctuation, dimmer toward the horizon.
const STARS = (() => {
  const next = random(29), star = (y0, y1, bright) => {
    const x = 0.02 + next() * 0.96, y = y0 + next() * (y1 - y0), r = 0.7 + next() * 0.7, a = 0.45 + next() * 0.5;
    return {x: +x.toFixed(3), y: +y.toFixed(3), r: +r.toFixed(2), a: bright ? a : Math.min(STAR_IN_TEXT, a * (1 - 0.6 * y) * 0.5)};
  };
  return [...Array.from({length: 12}, () => star(0.008, TEXT_TOP - 0.008, true)), ...Array.from({length: 30}, () => star(TEXT_TOP, 0.62, false))];
})();

// ---- The paint ------------------------------------------------------------

// The sun's disc: its radius (a fraction of the hero's height) and its most alpha.
const CORE_R = 0.045, SKY_CORE = 0.6;

// The paint for rounded inputs (see skyPaint).
function paint({kind, elevation: e, azimuth, coverage, fall, storm, wind}) {
  const known = e !== null, cover = coverage === null ? 0.5 : coverage / 100;
  const phase = !known ? 'unknown' : e < -6 ? 'night' : e <= 6 ? 'twilight' : 'day';
  const stops = (known ? stopsFor(e, kind, cover, fall, storm) : KEYS.unknown).map(stop => stop.map(Math.round));
  let grounds = SAMPLES.map(y => colourAt(stops, y));
  const clouds0 = kind in COUNT ? Math.round(lerp(...COUNT[kind], cover)) : 0;
  const hazy = known && kind === 'fog';
  // The glows take only part of the room text leaves them when clouds or
  // haze are still to come, so those show too.
  const room = clouds0 > 0 || hazy ? 0.5 : 1;
  const x = azimuth === null ? 0.5 : clamp((azimuth - 90) / 180, -0.08, 1.08);
  // How clear the sky is where the sun is: cloud, fog and rain dim its light
  // and spread it.
  const grey = greying(kind, cover, fall), clearness = (1 - grey) ** 1.6 * (storm ? 0.5 : 1);

  // The sun's glow, at the top by day, higher as the sun climbs and warmer as
  // it sinks.
  let sun = null;
  if (phase === 'day' || phase === 'twilight') {
    const warmth = 1 - smooth(0, 25, e), glow = parse(SKY.sunGlow), rgb = mix(glow, parse(SKY.horizonWarm), warmth * 0.8);
    const y = lerp(0.03, -0.12, smooth(6, 50, e)), r = lerp(0.42, 0.5, smooth(6, 50, e)) * (1 + grey);
    const shape = scaled(at => share(GLOW_PROFILE, Math.abs(at - y) / r));
    const alpha = capped(grounds, rgb, shape, glow[3] * smooth(2, 12, e) * clearness) * room;
    grounds = laid(grounds, rgb, shape, alpha);
    // The disc: .09 of the hero's height, its lower edge where the text
    // begins, and kept left of the tools on the right. Cloud and haze hide it.
    const disc = mix(glow, parse(SKY.horizonWarm), warmth * 0.5), coreAlpha = SKY_CORE * smooth(4, 14, e) * clearness;
    const core = coreAlpha > 0.05 ? {x: clamp(x, 0.06, 0.66), y: TEXT_TOP - CORE_R, r: CORE_R, alpha: +coreAlpha.toFixed(4), color: hexOf(disc),
      fills: CORE_PROFILE.map(([, s]) => cssOf(disc, coreAlpha * s))} : null;
    sun = {x, y, r, warmth: +warmth.toFixed(3), alpha: +alpha.toFixed(4), color: hexOf(rgb),
      fills: GLOW_PROFILE.map(([, s]) => cssOf(rgb, alpha * s)), core};
  }
  // The warm horizon on the sun's side, from dusk's first colour to the low sun.
  let horizon = null;
  const glowing = known ? smooth(-8, -3, e) * (1 - smooth(2, 12, e)) : 0;
  if (glowing > 0) {
    const [r, g, b, most] = parse(SKY.horizonWarm), rgb = [r, g, b], y = 1.02, ry = 0.62;
    const shape = scaled(at => share(GLOW_PROFILE, Math.abs(at - y) / ry));
    const alpha = capped(grounds, rgb, shape, most * glowing * clearness) * room;
    grounds = laid(grounds, rgb, shape, alpha);
    horizon = {x, y, rx: 0.75, ry, alpha: +alpha.toFixed(4), color: hexOf(rgb), fills: GLOW_PROFILE.map(([, s]) => cssOf(rgb, alpha * s))};
  }
  // Fog: a haze that thickens toward the ground.
  let haze = null;
  if (hazy) {
    const [r, g, b, most] = parse(SKY.fog), rgb = [r, g, b];
    const shape = scaled(at => along(HAZE, at));
    const alpha = capped(grounds, rgb, shape, most) * (clouds0 > 0 ? 0.7 : 1);
    grounds = laid(grounds, rgb, shape, alpha);
    haze = {color: hexOf(rgb), stops: HAZE.map(([at, s]) => ({at, alpha: +(alpha * s).toFixed(4), fill: cssOf(rgb, alpha * s)}))};
  }
  // The clouds, each capped row by row over the sky and the clouds before
  // it: by night every slot the cover fills, by day only the top edge's,
  // cross-fading through dawn and dusk. One too faint to read is not drawn.
  const night = known ? 1 - smooth(-5, 1, e) : 1, cloud = cloudInk(known ? e : null, storm), cloudRgb = cloud.slice(0, 3);
  const [n, top] = kind in COUNT ? [COUNT[kind], DAY_COUNT[kind]].map(range => Math.round(lerp(...range, cover))) : [0, 0];
  const slots = kind === 'fog' ? FOG_SLOTS : [...SLOTS, TOP[1]];
  const clouds = slots.flatMap((slot, i) => {
    const byNight = slot !== TOP[1] && i < n ? night : 0, byDay = TOP.indexOf(slot) >= 0 && TOP.indexOf(slot) < top ? 1 - night : 0;
    const weight = Math.max(byNight, byDay);
    if (weight <= 0) return [];
    const h = slot.h * (kind === 'cloudy' && slot.y > TEXT_TOP ? 1.45 : 1), start = slot.y - h / 2;
    const stack = (lobe, at) => at < start || at > start + h ? 0 : stackAt(lobe, (at - start) / h * 100);
    const reach = deepest(capped(grounds, cloudRgb, stack, lobeAlpha(cloud[3] * OPACITY[kind] * weight)));
    const alpha = reach * smooth(...FAINT, reach);
    if (alpha < 0.05) return [];
    const lobe = lobeAlpha(alpha);
    grounds = laid(grounds, cloudRgb, stack, lobe);
    const duration = wind ? 40 + ((i * 3) % 7) : 46 + ((i * 7) % 15);
    return [{key: `cloud-${slot.id}`, x: slot.x, y: slot.y, w: +(h * slot.aspect).toFixed(4), h: +h.toFixed(4), alpha: +alpha.toFixed(4),
      duration, delay: -((i * 13) % duration), color: hexOf(cloudRgb), fills: CLOUD_PROFILE.map(([, s]) => cssOf(cloudRgb, lobe * s))}];
  }).slice(0, MOST_CLOUDS);
  // The stars, on clear or partly cloudy nights, coming out below −6°.
  const starry = phase === 'night' && (kind === 'clear' || kind === 'partly');
  const star = parse(SKY.star);
  const stars = starry ? STARS.filter((_, i) => kind === 'clear' || i % 2 === 0).map(({x: sx, y, r, a}) => ({x: sx, y, r, fill: cssOf(star, a)})) : [];
  const starAlpha = starry ? +(smooth(-6, -12, e) * (kind === 'partly' ? 0.8 : 1)).toFixed(3) : 0;
  const ink = fall ? parse(SKY[fall]) : null, fallInk = ink && cssOf(ink.slice(0, 3), ink[3]);
  return {phase, stops: stops.map(hexOf), sun, horizon, haze, clouds, stars, starAlpha, fall: fall ?? null, fallInk, storm: !!storm};
}

// The last paints, by their rounded inputs.
const MEMO = new Map();
const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const round = (v, step) => v === null ? null : Math.round(v / step) * step;

/**
 * The sky's paint for chrome.sky, memoised on rounded inputs (the elevation
 * to 1°, the azimuth to 5°, the cover to 10%) so a Home Assistant update
 * neither re-keys the clouds nor restarts their drift: the same rounded sky
 * returns the same frozen object.
 * @param {{kind: string, plot: object}} sky sky.js's Sky.
 * @returns {SkyPaint}
 */
export function skyPaint(sky) {
  const plot = sky?.plot ?? {}, kind = ['clear', 'partly', 'cloudy', 'fog'].includes(sky?.kind) ? sky.kind : 'unknown';
  const coverage = number(plot.coverage);
  const inputs = {kind, elevation: round(number(plot.elevation), 1), azimuth: round(number(plot.azimuth), 5),
    coverage: coverage === null ? null : round(clamp(coverage, 0, 100), 10),
    fall: ['rain', 'snow', 'hail'].includes(plot.fall) ? plot.fall : null, storm: plot.storm === true, wind: plot.wind === true};
  const key = JSON.stringify(inputs);
  if (!MEMO.has(key)) {
    if (MEMO.size >= 64) MEMO.delete(MEMO.keys().next().value);
    MEMO.set(key, deepFreeze(paint(inputs)));
  }
  return MEMO.get(key);
}

// `value`, frozen all the way down.
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
