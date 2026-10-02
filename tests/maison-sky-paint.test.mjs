// Maison's living sky (#29 step 3): how sky-model.js paints
// chrome.sky, and how sky.jsx lays the paint out. The phases and their
// boundaries; stops that ease through the elevations with no jump; the same
// paint, the same object, for the same rounded sky; the unknown sky's calm
// slate; stars only on clear or partly cloudy nights; and the sampled
// contrast rule: at every elevation from −18° to 70°, for every kind, with
// and without rain, snow, hail and a storm, at 0, 50 and 100% cover, the
// text over the sky still reads. This file composites the sky itself, from
// the paint's numbers, with its own arithmetic: the gradient under each text
// band, the sun's glow and the warm horizon where they reach it, fog's haze,
// and every cloud that covers that height, each at its row's deepest stack. Rain
// streaks and snowflakes (a pixel or two, moving) and the stars are left out.
// What sky.js reads from Home Assistant is tests/maison-sky.test.mjs's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {CLOUD_LOBES, CLOUD_PROFILE, GLOW_PROFILE, STOP_AT, TEXT_BANDS, TEXT_TOP, skyPaint} from '../frontend/maison/src/sky-model.js';
import {DARK, SHARED, SKY} from '../frontend/maison/src/ui/tokens.js';
import {skyStyles} from '../frontend/maison/src/sky.css.js';
import {SKY_FIXTURES} from '../frontend/maison/fixtures/sky-fixtures.js';
import {skyValue} from '../config/www/maison/sky.js';

const KINDS = ['clear', 'partly', 'cloudy', 'fog', 'unknown'];
const FALLS = [null, 'rain', 'snow', 'hail'];
const ELEVATIONS = Array.from({length: 89}, (_, i) => i - 18);
// chrome.sky as sky.js gives it.
const sky = (kind, elevation, {azimuth = 180, coverage = 50, fall = null, storm = false, wind = false} = {}) =>
  ({kind, plot: {elevation, azimuth, rising: null, coverage, fall, storm, wind}});

// ---- This file's own colour arithmetic ----------------------------------

// A colour as [r, g, b, a]: #RRGGBB or rgba(r,g,b,a).
const rgba = colour => colour.startsWith('#') ? [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16)).concat(1) : colour.match(/[\d.]+/g).map(Number);
const blend = (under, [r, g, b], alpha) => under.map((c, i) => c + ([r, g, b][i] - c) * alpha);
// WCAG's relative luminance, each channel rounded to a byte as the browser paints it.
const LINEAR = Array.from({length: 256}, (_, c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * LINEAR[Math.round(r)] + 0.7152 * LINEAR[Math.round(g)] + 0.0722 * LINEAR[Math.round(b)];
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
// Along [at, value] points, linear between them and held beyond the ends.
const along = (points, v) => {
  if (v <= points[0][0]) return points[0][1];
  for (let k = 1; k < points.length; k++) if (v <= points[k][0]) return points[k - 1][1] + (points[k][1] - points[k - 1][1]) * (v - points[k - 1][0]) / (points[k][0] - points[k - 1][0]);
  return points.at(-1)[1];
};
const glowAt = (profile, d) => d >= 1 ? 0 : along(profile, d);

// The sky as text at height y sees it, where every layer lines up above it.
function composite(paint, y) {
  const stops = paint.stops.map(rgba);
  let colour = [0, 1, 2].map(c => along(STOP_AT.map((at, i) => [at, stops[i][c]]), y));
  if (paint.sun) colour = blend(colour, rgba(paint.sun.color), paint.sun.alpha * glowAt(GLOW_PROFILE, Math.abs(y - paint.sun.y) / paint.sun.r));
  if (paint.horizon) colour = blend(colour, rgba(paint.horizon.color), paint.horizon.alpha * glowAt(GLOW_PROFILE, Math.abs(y - paint.horizon.y) / paint.horizon.ry));
  if (paint.haze) colour = blend(colour, rgba(paint.haze.color), along(paint.haze.stops.map(({at, alpha}) => [at, alpha]), y));
  for (const cloud of paint.clouds) colour = blend(colour, rgba(cloud.color), cloudAt(cloud, y));
  return colour;
}
// A cloud's alpha where its row at height y is deepest, from its lobes as
// the renderer draws them (a lobe's first fill is its peak), stacked across
// the row every half percent of the cloud's width.
const ROWS = new Map();
function cloudAt(cloud, y) {
  const top = cloud.y - cloud.h / 2;
  if (y < top || y > top + cloud.h) return 0;
  const lobe = rgba(cloud.fills[0])[3], row = +((y - top) / cloud.h * 100).toFixed(2), key = `${lobe}|${row}`;
  if (!ROWS.has(key)) {
    let deepest = 0;
    for (let px = 0; px <= 100; px += 0.5) {
      const clear = CLOUD_LOBES.reduce((left, [cx, cy, rx, ry]) => left * (1 - lobe * glowAt(CLOUD_PROFILE, Math.hypot((px - cx) / rx, (row - cy) / ry))), 1);
      deepest = Math.max(deepest, 1 - clear);
    }
    ROWS.set(key, deepest);
  }
  return ROWS.get(key);
}
// Each text colour, as the hero sets it: white, and the sky's own secondary
// text (white at .85) as its --m-label-2.
const LABEL = {label: rgba(DARK['m-label']), 'label-2': rgba(SHARED['m-sky-label-2'])};
const reading = (label, ground) => contrast(blend(ground, LABEL[label], LABEL[label][3]), ground);

// ---- Phases ---------------------------------------------------------------

test('the phase follows the elevation alone: night below −6°, twilight from −6° to 6°, day above, unknown without a sun', () => {
  const phase = (e, kind = 'clear') => skyPaint(sky(kind, e)).phase;
  assert.deepEqual([-90, -30, -7, -6, -2, 0, 5, 6, 7, 38, 90].map(e => phase(e)),
    ['night', 'night', 'night', 'twilight', 'twilight', 'twilight', 'twilight', 'twilight', 'day', 'day', 'day']);
  for (const kind of KINDS) assert.equal(phase(null, kind), 'unknown', kind);
  assert.equal(skyPaint(undefined).phase, 'unknown', 'no sky at all');
  const fixtures = Object.fromEntries(SKY_FIXTURES.map(({id, states}) => [id, skyPaint(skyValue(states)).phase]));
  assert.deepEqual(fixtures, {night: 'night', 'night-cloudy': 'night', dawn: 'twilight', noon: 'day', 'afternoon-cloudy': 'day', rain: 'day',
    storm: 'day', snow: 'day', fog: 'twilight', dusk: 'twilight', unknown: 'unknown'});
});

test('the stops ease through every elevation, with no jump at a phase boundary', () => {
  let worst = {step: 0};
  for (const kind of KINDS) for (const fall of FALLS) for (const storm of [false, true]) for (const coverage of [0, 50, 100]) {
    for (const e of ELEVATIONS.slice(1)) {
      const [before, after] = [e - 1, e].map(el => skyPaint(sky(kind, el, {coverage, fall, storm})).stops.map(rgba));
      const step = Math.max(...before.flatMap((stop, i) => stop.slice(0, 3).map((c, k) => Math.abs(c - after[i][k]))));
      if (step > worst.step) worst = {step, kind, fall, storm, coverage, e};
    }
  }
  // A degree of the sun is four or five minutes around sunset: a channel may
  // move 16 of 255 in it, no more.
  assert.ok(worst.step <= 16, `no channel moves more than 16 in a degree: ${JSON.stringify(worst)}`);
  for (const paint of ELEVATIONS.map(e => skyPaint(sky('clear', e)))) {
    assert.equal(paint.stops.length, 4);
    for (const stop of paint.stops) assert.match(stop, /^#[0-9A-F]{6}$/);
  }
  // Full night, twilight's own colour and full day are SKY's keyframes.
  assert.deepEqual(skyPaint(sky('clear', -18)).stops, [...SKY.night]);
  assert.deepEqual(skyPaint(sky('clear', -2)).stops, [...SKY.twilight]);
  assert.deepEqual(skyPaint(sky('clear', 40)).stops, [...SKY.day]);
  // Cloud greys the sky, and a storm darkens it further.
  const mean = paint => paint.stops.map(rgba).reduce((sum, stop) => sum + lum(stop), 0);
  const noon = options => mean(skyPaint(sky('cloudy', 38, options)));
  assert.ok(noon({storm: true, fall: 'rain'}) < noon({fall: 'rain'}), 'a storm is darker than rain');
});

// ---- Determinism ------------------------------------------------------------

test('the same rounded sky is the same frozen paint, and a cloud keeps its key and place as the sun moves and the cover grows', () => {
  const a = skyPaint(sky('partly', 20.2, {azimuth: 181, coverage: 44}));
  assert.equal(skyPaint(sky('partly', 20.2, {azimuth: 181, coverage: 44})), a, 'the same object for the same sky');
  assert.equal(skyPaint(structuredClone(sky('partly', 19.8, {azimuth: 179, coverage: 38}))), a, 'and for one that rounds to it');
  assert.notEqual(skyPaint(sky('partly', 21, {azimuth: 181, coverage: 44})), a, 'a degree is a new paint');
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.clouds) && Object.isFrozen(a.clouds[0]) && Object.isFrozen(a.stops));
  // Wherever a key appears (night or day, any cover, any weather), its cloud is in the same place and drifts the same way.
  const place = ({x, y, w, h, duration, delay}) => ({x, y, w, h, duration, delay}), places = new Map();
  for (const kind of KINDS) for (const e of [-30, -8, -3, 0, 3, 8, 20, 60]) for (const coverage of [0, 50, 100]) for (const fall of [null, 'rain']) {
    const clouds = skyPaint(sky(kind, e, {coverage, fall})).clouds;
    assert.equal(new Set(clouds.map(c => c.key)).size, clouds.length, `${kind} ${e}°: unique keys`);
    assert.ok(clouds.length <= 6, `${kind} ${e}°: ${clouds.length} clouds drift at once`);
    for (const cloud of clouds) {
      const id = `${kind} ${cloud.key}`;
      if (!places.has(id)) places.set(id, place(cloud));
      assert.deepEqual(place(cloud), places.get(id), `${cloud.key} for ${kind} at ${e}°, ${coverage}%`);
    }
  }
  assert.ok(new Set([...places.keys()].map(id => id.split(' ')[1])).size >= 9, [...places.keys()].join(' '));
  // No cloud drifts under the pill (the top centre) or the glass tools (the top right): in the top 22%, only at the left.
  for (const [id, {x, y, h}] of places) assert.ok(y - h / 2 >= 0.22 || x <= 0.25, `${id} at ${x}, ${y}`);
  for (const wind of [false, true]) {
    const durations = ['partly', 'cloudy', 'fog'].flatMap(kind => skyPaint(sky(kind, -30, {coverage: 100, wind})).clouds.map(cloud => cloud.duration));
    assert.ok(durations.every(d => d >= 40 && d <= 60) && new Set(durations).size > 3, `drifts of 40–60s, not in step: ${durations}`);
  }
});

test('by day the weather’s gradient carries the cloud: at most two, on the top edge above the text, and white enough to read', () => {
  for (const [kind, fall, storm] of [['cloudy'], ['cloudy', 'rain'], ['cloudy', 'snow'], ['cloudy', 'rain', true], ['partly']]) {
    for (const e of [12, 20, 38, 60]) for (const coverage of [0, 50, 100]) {
      const {clouds} = skyPaint(sky(kind, e, {coverage, fall, storm}));
      assert.ok(clouds.length >= 1 && clouds.length <= 2, `${kind} ${fall} at ${e}°, ${coverage}%: ${clouds.length}`);
      for (const cloud of clouds) {
        assert.match(cloud.key, /^cloud-top-/);
        assert.ok(cloud.y + cloud.h / 2 <= TEXT_TOP + 0.01, `${cloud.key} stays above the text`);
        assert.ok(cloud.alpha >= 0.3, `${kind} ${fall} at ${e}°: ${cloud.key} at ${cloud.alpha}`);
      }
    }
  }
  // Night keeps its clouds through the sky; no cloud anywhere is drawn as a smudge.
  assert.ok(skyPaint(sky('cloudy', -30, {coverage: 100})).clouds.length === 6);
  for (const kind of KINDS) for (const e of ELEVATIONS.filter(e => e % 3 === 0)) for (const fall of FALLS) for (const coverage of [0, 50, 100]) {
    for (const cloud of skyPaint(sky(kind, e, {coverage, fall})).clouds) assert.ok(cloud.alpha >= 0.05, `${kind} ${e}° ${fall}: ${cloud.key} at ${cloud.alpha}`);
  }
});

// A second instance of the model (a query loads the module anew) paints
// every sky exactly as the first: nothing hangs on what was painted before.
test('the model paints the same sky the same way when loaded afresh', async () => {
  const again = await import(`../frontend/maison/src/sky-model.js?again=${Date.now()}`);
  for (const [kind, e, options] of [['clear', -30], ['partly', -3, {azimuth: 88}], ['cloudy', 20, {fall: 'rain'}], ['fog', 4, {coverage: 100}]]) {
    assert.deepEqual(again.skyPaint(sky(kind, e, options)), skyPaint(sky(kind, e, options)), `${kind} ${e}`);
  }
});

// ---- The unknown sky, the stars, the sun ------------------------------------

test('an unknown sun is a calm neutral slate, with no sun, horizon or stars; an unknown weather draws no clouds', () => {
  for (const kind of KINDS) for (const fall of FALLS) for (const storm of [false, true]) {
    const paint = skyPaint(sky(kind, null, {azimuth: null, fall, storm, coverage: 100}));
    assert.deepEqual(paint.stops, [...SKY.unknown], `${kind} ${fall} ${storm}`);
    assert.deepEqual([paint.sun, paint.horizon, paint.haze, paint.stars, paint.starAlpha], [null, null, null, [], 0]);
  }
  const grey = paint => Math.max(...paint.stops.map(rgba).map(([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b)));
  assert.ok(grey(skyPaint(sky('unknown', null))) <= 32, 'a slate, barely tinted');
  for (const e of [null, -30, 0, 38]) assert.deepEqual(skyPaint(sky('unknown', e, {coverage: 100})).clouds, [], `no clouds for an unknown weather at ${e}°`);
});

test('stars shine only on clear or partly cloudy nights, coming out as the sun sinks below −6°', () => {
  for (const kind of KINDS) for (const e of ELEVATIONS) for (const fall of [null, 'rain']) {
    const paint = skyPaint(sky(kind, e, {fall, coverage: 50}));
    const starry = paint.phase === 'night' && (kind === 'clear' || kind === 'partly');
    assert.equal(paint.stars.length > 0, starry, `${kind} at ${e}°, ${fall}`);
    if (!starry) assert.equal(paint.starAlpha, 0);
  }
  const alpha = e => skyPaint(sky('clear', e)).starAlpha;
  assert.ok(alpha(-7) > 0 && alpha(-7) < 0.1, 'faint just after −6°');
  assert.ok(alpha(-9) < alpha(-11) && alpha(-12) === 1 && alpha(-30) === 1, 'then all out');
  assert.deepEqual(skyPaint(sky('clear', -30)).stars, skyPaint(sky('clear', -25)).stars, 'the same stars every night');
  // Where text sits, a star is never brighter than .3, so none reads as punctuation; above it, some are bright.
  const stars = skyPaint(sky('clear', -30)).stars;
  assert.ok(stars.filter(star => star.y >= TEXT_TOP).every(star => rgba(star.fill)[3] <= 0.3));
  assert.ok(stars.filter(star => star.y < TEXT_TOP).some(star => rgba(star.fill)[3] >= 0.8));
  assert.ok(skyPaint(sky('partly', -30)).stars.length < skyPaint(sky('clear', -30)).stars.length, 'fewer between clouds');
});

test('the sun is placed by azimuth, east on the left, and rises toward the top; it is warm near the horizon and gone at night', () => {
  const sun = (e, azimuth) => skyPaint(sky('clear', e, {azimuth})).sun;
  assert.ok(sun(20, 100).x < sun(20, 180).x && sun(20, 180).x < sun(20, 260).x, 'east to west, left to right');
  assert.ok(sun(50, 180).y < sun(20, 180).y && sun(20, 180).y < sun(8, 180).y, 'higher, nearer the top');
  assert.ok(sun(8, 180).warmth > sun(20, 180).warmth && sun(40, 180).warmth === 0);
  assert.equal(sun(-7, 180), null);
  assert.equal(sun(null, 180), null);
  assert.ok(sun(38, 180).alpha > 0.1, 'a clear noon glows');
  assert.ok(skyPaint(sky('cloudy', 38, {coverage: 100})).sun.alpha < sun(38, 180).alpha / 3, 'cloud dims it');
  // The warm horizon lies on the sun's side around sunset, and not at noon.
  const dusk = skyPaint(sky('clear', -2, {azimuth: 270})).horizon;
  assert.ok(dusk.alpha > 0.05 && dusk.x > 0.9 && dusk.y >= 1, JSON.stringify(dusk));
  assert.equal(skyPaint(sky('clear', 38)).horizon, null);
  assert.equal(skyPaint(sky('clear', -18)).horizon, null);
  // The sun's disc: on a clear day only, about a tenth of the hero high, its edge where the text begins, left of the tools.
  const noon = sun(38, 180).core;
  assert.ok(noon && Math.abs(noon.alpha - 0.6) < 0.01 && 2 * noon.r >= 0.08 && 2 * noon.r <= 0.12, JSON.stringify(noon));
  assert.ok(noon.y + noon.r <= TEXT_TOP + 1e-9, 'confined above the text');
  assert.ok(sun(20, 270).core.x <= 0.66 && sun(20, 90).core.x >= 0.06);
  assert.equal(sun(2, 180).core, null, 'not while the sun is on the horizon');
  assert.equal(skyPaint(sky('cloudy', 38, {coverage: 100})).sun.core, null, 'hidden by cloud');
  // What the renderer paints is what was checked: a glow's fills follow its profile from its peak.
  for (const glow of [sun(38, 180), dusk]) {
    glow.fills.forEach((fill, i) => assert.ok(Math.abs(rgba(fill)[3] - glow.alpha * GLOW_PROFILE[i][1]) <= 0.001, fill));
  }
});

test('the fall and the storm pass through, and fog lies low', () => {
  for (const fall of FALLS) {
    const paint = skyPaint(sky('cloudy', 20, {fall}));
    assert.equal(paint.fall, fall);
    assert.equal(paint.fallInk === null, fall === null);
  }
  assert.equal(skyPaint(sky('cloudy', 20, {storm: true})).storm, true);
  assert.equal(skyPaint(sky('cloudy', 20)).storm, false);
  const {haze, clouds} = skyPaint(sky('fog', 14, {coverage: 100}));
  assert.ok(haze.stops[0].alpha === 0 && haze.stops.at(-1).alpha > 0, 'thickening toward the ground');
  assert.ok(clouds.every(cloud => cloud.y >= 0.5), 'its clouds lie low');
  assert.equal(skyPaint(sky('cloudy', 8)).haze, null);
});

// ---- The contrast rule ------------------------------------------------------

test('the text bands cover the hero from the date to the fade, and each says what it holds', () => {
  assert.ok(TEXT_BANDS.length >= 3);
  for (const band of TEXT_BANDS) {
    assert.ok(band.from >= 0 && band.from < band.to && band.to < 1, band.id);
    assert.ok(band.labels.every(label => label in LABEL) && [3, 4.5].includes(band.min), band.id);
  }
  const large = TEXT_BANDS.filter(band => band.min === 3).map(band => band.id);
  assert.deepEqual(large, ['title', 'temperature'], 'only the 34px title and the 96px temperature are large text');
});

// Every 1% of the hero's height that some band covers, with what text there needs.
const HEIGHTS = [];
for (let i = 0; i <= 100; i++) {
  const needs = TEXT_BANDS.filter(band => i / 100 >= band.from - 1e-9 && i / 100 <= band.to + 1e-9)
    .flatMap(band => band.labels.map(label => ({label, min: band.min, band: band.id})));
  if (needs.length) HEIGHTS.push({y: i / 100, needs});
}

test('white and secondary text read at 4.5:1 (the title and temperature at 3:1) over every sky, at every elevation', t => {
  let worst = {margin: Infinity}, checked = 0;
  // The glow is checked where it lines up with the text, whatever the
  // azimuth, so one azimuth covers them all.
  for (const kind of KINDS) for (const fall of FALLS) for (const storm of [false, true]) for (const coverage of [0, 50, 100]) {
    for (const e of [...ELEVATIONS, null]) {
      const paint = skyPaint(sky(kind, e, {coverage, fall, storm}));
      for (const {y, needs} of HEIGHTS) {
        const ground = composite(paint, y);
        for (const {label, min, band} of needs) {
          const ratio = reading(label, ground);
          checked++;
          if (ratio / min < worst.margin) worst = {margin: ratio / min, ratio, min, label, band, y, kind, e, fall, storm, coverage};
          if (ratio < min) assert.fail(`${label} in the ${band} band at ${Math.round(y * 100)}% reads ${ratio.toFixed(2)}:1 < ${min}:1: ${JSON.stringify({kind, e, fall, storm, coverage})}`);
        }
      }
    }
  }
  assert.ok(checked > 1e6, `sampled ${checked}`);
  t.diagnostic(`worst ${worst.ratio.toFixed(2)}:1 (needs ${worst.min}:1): ${worst.label} in the ${worst.band} band at ${Math.round(worst.y * 100)}%, ${worst.kind}, ${worst.e}°, fall ${worst.fall}, storm ${worst.storm}, cover ${worst.coverage}%`);
});

test('a cloud never paints deeper than the alpha checked: its lobes stack at most to it', () => {
  for (const kind of ['partly', 'cloudy', 'fog']) for (const e of [-30, -3, 12, 38]) {
    for (const cloud of skyPaint(sky(kind, e, {coverage: 100, fall: kind === 'cloudy' ? 'rain' : null})).clouds) {
      const lobe = rgba(cloud.fills[0])[3];
      cloud.fills.forEach((fill, i) => assert.ok(Math.abs(rgba(fill)[3] - lobe * CLOUD_PROFILE[i][1]) <= 0.001, 'fills follow the profile'));
      let deepest = 0;
      for (let px = 0; px <= 100; px += 0.5) for (let py = 0; py <= 100; py += 0.5) {
        const clear = CLOUD_LOBES.reduce((left, [cx, cy, rx, ry]) => left * (1 - lobe * glowAt(CLOUD_PROFILE, Math.hypot((px - cx) / rx, (py - cy) / ry))), 1);
        deepest = Math.max(deepest, 1 - clear);
      }
      assert.ok(deepest <= cloud.alpha + 0.003, `${kind} ${e}° ${cloud.key}: ${deepest.toFixed(4)} > ${cloud.alpha}`);
      // Every lobe stays inside the box the check covers.
      for (const [, cy, , ry] of CLOUD_LOBES) assert.ok(cy - ry >= 0 && cy + ry <= 100);
    }
  }
});

// ---- The renderer -----------------------------------------------------------

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const folder = mkdtempSync(join(tmpdir(), 'maison-sky-'));
const bundle = await build({stdin: {contents: `export {Sky} from './sky.jsx';\nexport {createElement as h} from 'react';\nexport {renderToStaticMarkup} from 'react-dom/server';`,
  resolveDir: SRC, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', loader: {'.js': 'jsx'},
  define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'sky.mjs'), bundle.outputFiles[0].text);
const {Sky, h, renderToStaticMarkup} = await import(pathToFileURL(join(folder, 'sky.mjs')));
rmSync(folder, {recursive: true, force: true});
const draw = paint => renderToStaticMarkup(h(Sky, {paint}));
const layers = html => [...html.matchAll(/<div class="(m-sky__[a-z]+)"/g)].map(m => m[1]);

test('Sky lays the paint out as hidden decoration, layer by layer, ending in the fade', () => {
  const night = draw(skyPaint(sky('partly', -30, {coverage: 100})));
  assert.match(night, /^<div class="m-sky" aria-hidden="true" style="background-image:linear-gradient\(180deg,#[0-9A-F]{6} 0%,#[0-9A-F]{6} 36%,#[0-9A-F]{6} 72%,#[0-9A-F]{6} 100%\)">/);
  assert.deepEqual(layers(night), ['m-sky__stars', 'm-sky__cloud', 'm-sky__cloud', 'm-sky__cloud', 'm-sky__fade']);
  const dusk = layers(draw(skyPaint(sky('partly', 2, {azimuth: 270, coverage: 0}))));
  assert.deepEqual(dusk, ['m-sky__horizon', 'm-sky__cloud', 'm-sky__fade']);
  assert.deepEqual(layers(draw(skyPaint(sky('clear', 38, {coverage: 0})))), ['m-sky__sun', 'm-sky__core', 'm-sky__fade']);
  const rain = draw(skyPaint(sky('cloudy', 20, {fall: 'rain', coverage: 100})));
  assert.deepEqual(layers(rain).filter(layer => layer !== 'm-sky__cloud'), ['m-sky__sun', 'm-sky__band', 'm-sky__fall', 'm-sky__fade']);
  // What falls sits in a still band that shows it whole above the text and at .4 where text sits.
  const top = +(TEXT_TOP * 100).toFixed(2);
  assert.match(rain, new RegExp(`<div class="m-sky__band" style="-webkit-mask-image:linear-gradient\\(180deg,currentColor ${top}%,color-mix\\(in srgb,currentColor 40%,transparent\\) [\\d.]+%\\);mask-image:[^"]+"><div class="m-sky__fall" data-fall="rain"`));
  assert.deepEqual(layers(draw(skyPaint(sky('fog', 14, {coverage: 0})))).filter(layer => layer !== 'm-sky__cloud'), ['m-sky__sun', 'm-sky__haze', 'm-sky__fade']);
  assert.deepEqual(layers(draw(skyPaint(sky('unknown', null)))), ['m-sky__fade'], 'the unknown sky is the slate alone');
  // Clouds are radial gradients drifting on the paint's timing; nothing is blurred or filtered.
  const cloud = skyPaint(sky('cloudy', 20, {fall: 'rain', coverage: 100})).clouds[0];
  assert.match(rain, new RegExp(`animation-duration:${cloud.duration}s;animation-delay:${cloud.delay}s`));
  assert.doesNotMatch(rain + night, /filter|blur/);
});

test('Sky is memoised, and a cloud’s key comes from the paint alone, so an equal sky draws the same clouds', () => {
  assert.equal(Sky.$$typeof, Symbol.for('react.memo'), 'memo(Sky)');
  const source = readFileSync(new URL('../frontend/maison/src/sky.jsx', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/\bkey=\{([^}]+)\}/g)].map(match => match[1]), ['cloud.key']);
  assert.doesNotMatch(source, /Math\.random|useId|Date\.now|crypto/);
  // Two equal skies, one of them rebuilt from scratch: the same paint, the same markup.
  const [a, b] = [sky('cloudy', -30, {coverage: 100}), structuredClone(sky('cloudy', -30, {coverage: 100}))];
  assert.equal(skyPaint(a), skyPaint(b));
  assert.equal(draw(skyPaint(a)), draw(skyPaint(b)));
  assert.deepEqual(skyPaint(a).clouds.map(cloud => cloud.key), ['cloud-top-0', 'cloud-mid-1', 'cloud-mid-2', 'cloud-mid-3', 'cloud-mid-4', 'cloud-mid-5']);
});

// A selector's specificity as [ids, classes, types], for the plain
// compound selectors a sky rule writes.
const specificity = selector => [(selector.match(/#[\w-]+/g) ?? []).length,
  (selector.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length, (selector.match(/(?:^|[\s>+~])[a-z][\w-]*/g) ?? []).length];
const beats = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2];
// skyStyles' top-level rules, and those inside @media and @supports blocks, as {at, selector, body}.
function sheetRules(css) {
  const rules = [];
  for (const [, at, inner] of css.matchAll(/(@(?:media|supports)[^{]*)\{((?:[^{}]*\{[^}]*\})*)\}/g)) {
    for (const [, selector, body] of inner.matchAll(/([^{}]+)\{([^}]*)\}/g)) rules.push({at: at.trim(), selector: selector.trim(), body});
  }
  const top = css.replace(/@(?:media|supports|keyframes)[^{]*\{(?:[^{}]*\{[^}]*\})*\}/g, '');
  for (const [, selector, body] of top.matchAll(/([^{}]+)\{([^}]*)\}/g)) rules.push({at: null, selector: selector.trim(), body});
  return rules;
}

test('the sky’s styles fill the hero and move only by transform', () => {
  assert.match(skyStyles, /\.m-sky\{position:absolute;inset:0;overflow:hidden;pointer-events:none\}/);
  assert.doesNotMatch(skyStyles, /--m-bg\b/, 'never the hero’s own (dark) background');
  assert.doesNotMatch(skyStyles, /filter|will-change/);
  for (const [, frames] of skyStyles.matchAll(/@keyframes [\w-]+\{(.*?\})\}/g)) assert.doesNotMatch(frames.replace(/transform:[^;}]*/g, ''), /:/, 'keyframes move by transform alone');
  assert.match(skyStyles, /\.m-sky__cloud\{[^}]*animation:m-sky-drift [\d.]+s ease-in-out infinite alternate/, 'the clouds drift back and forth');
});

test('under reduced motion nothing in the sky moves: the rule outranks every cloud’s and every fall’s animation', () => {
  const rules = sheetRules(skyStyles), still = rules.filter(rule => rule.at === '@media (prefers-reduced-motion:reduce)');
  assert.ok(still.length === 1 && /animation:none/.test(still[0].body), 'one rule stops the animations');
  const stoppers = still[0].selector.split(',').map(s => s.trim());
  const animated = rules.filter(rule => rule.at === null && /(?:^|;)animation(?:-name)?:/.test(rule.body)).flatMap(rule => rule.selector.split(',').map(s => s.trim()));
  assert.deepEqual(animated.sort(), ['.m-sky__cloud', '.m-sky__fall', '.m-sky__fall[data-fall=hail]', '.m-sky__fall[data-fall=snow]']);
  for (const selector of animated) {
    const subject = selector.match(/\.m-sky__\w+/)[0];
    const stopper = stoppers.find(s => s.split(/\s+/).at(-1).startsWith(subject) && beats(specificity(s), specificity(selector)));
    assert.ok(stopper, `nothing outranks ${selector} (${specificity(selector)})`);
  }
  assert.ok(skyStyles.lastIndexOf('prefers-reduced-motion') > skyStyles.lastIndexOf('animation:m-sky'), 'and it comes last');
  // The checker itself: a bare class loses to an attribute on the same class; two classes win.
  assert.equal(beats(specificity('.m-sky__fall'), specificity('.m-sky__fall[data-fall=snow]')), false);
  assert.equal(beats(specificity('.m-sky .m-sky__fall[data-fall]'), specificity('.m-sky__fall[data-fall=snow]')), true);
});

test('the fade eases into the page’s own background with no edge, in oklab where the browser can, and in a line without color-mix()', () => {
  const rules = sheetRules(skyStyles);
  const plain = rules.find(rule => rule.at === null && rule.selector === '.m-sky__fade');
  const oklab = rules.find(rule => rule.at === '@supports (background:linear-gradient(in oklab,transparent,transparent)) and (color:color-mix(in oklab,currentColor 50%,transparent))' && rule.selector === '.m-sky__fade');
  const line = rules.find(rule => rule.at === '@supports not (color:color-mix(in srgb,currentColor 50%,transparent))' && rule.selector === '.m-sky__fade');
  assert.ok(plain && oklab && line, 'the fade, its oklab form, and its fallback');
  assert.match(plain.body, /height:var\(--m-sky-fade\)/);
  // var() in the value would make an unsupported color-mix() fail only once computed, leaving no fade: the fallback is its own rule.
  assert.equal(line.body, 'background:linear-gradient(180deg,transparent,var(--m-page-bg))');
  assert.ok(skyStyles.indexOf('@supports not (color:color-mix') > skyStyles.indexOf('.m-sky__fade{'), 'after the eased fade');
  for (const [space, body] of [['srgb', plain.body], ['oklab', oklab.body]]) {
    const eased = body.slice(body.lastIndexOf('background:'));
    assert.match(eased, space === 'oklab' ? /^background:linear-gradient\(180deg in oklab,transparent,/ : /^background:linear-gradient\(180deg,transparent,/);
    assert.match(eased, /,var\(--m-page-bg\)\)$/);
    const stops = [[0, 0], ...[...eased.matchAll(new RegExp(`color-mix\\(in ${space},var\\(--m-page-bg\\) ([\\d.]+)%,transparent\\) ([\\d.]+)%`, 'g'))]
      .map(([, amount, at]) => [+at / 100, +amount / 100]), [1, 1]];
    assert.ok(stops.length >= 6, `${space}: ${stops.length} stops`);
    const smoothstep = t => t * t * (3 - 2 * t);
    for (const [at, amount] of stops) assert.ok(Math.abs(amount - smoothstep(at)) <= 0.03, `${space}: ${amount} at ${at}`);
    // No edge: the first and last steps are gentle, as the curve's ends are flat.
    assert.ok(stops[1][1] / stops[1][0] <= 0.35 && (1 - stops.at(-2)[1]) / (1 - stops.at(-2)[0]) <= 0.35, `${space}: flat ends`);
  }
});
