// Energy's chart (v37): today's power from midnight, drawn from the Energy
// page's `dayChart` over the Energy fixtures' day (noon exporting with the
// rest of the forecast, and 21:04 importing with solar asleep). The geometry
// (charts/day-plot.js) is pure and imported directly: the value scale, the
// monotone curves that never overshoot, the half hours' runs, the hours of
// a 24- and a 25-hour day, the clip that shows the grid's share, and the
// step under a pointer. Node has no JSX, so esbuild bundles the chart with
// react-dom/server into a temporary module (as maison-history-plot.test.mjs
// does), and each test reads the markup a real value renders to: the day's
// figures in every state, the named SVG, a scrub's half hour and its means,
// and each state's stand-in. The model's arithmetic (the half hours, the
// figures, the forecast) is in maison-energy.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {power} from '../config/www/maison/model.js';
import {dayWindow} from '../config/www/maison/history.js';
import {ENERGY_FIXTURES, ENERGY_NIGHT_NOW, ENERGY_NIGHT_POWER_HISTORY, ENERGY_NOW, ENERGY_POWER_HISTORY} from '../frontend/maison/fixtures/energy-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {EMPTY, LOADING, REJECTED} from '../frontend/maison/src/gallery-snapshots.js';
import {dayChartStyles} from '../frontend/maison/src/charts/day.css.js';
import {DAY_PLOT, DAY_WIDTH, dayLayout, dayMarks, dayScale, dayTick, dayTime, monotonePath, powerParts, stepRuns}
  from '../frontend/maison/src/charts/day-plot.js';

const CHARTS = fileURLToPath(new URL('../frontend/maison/src/charts/', import.meta.url));
const ENTRY = `export {DayChart} from './day.jsx';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The chart, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-day-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: CHARTS, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'day.mjs'), bundle.outputFiles[0].text);
const {h, renderToStaticMarkup, DayChart} = await import(pathToFileURL(join(folder, 'day.mjs')));
rmSync(folder, {recursive: true, force: true});

const MINUTE = 60000, HOUR = 60 * MINUTE;
// Energy's chart for a fixture (ENERGY_FIXTURES, by id) at its own time,
// over `history`, or with the recorder `loading`.
function dayChart(id, history, loading = false) {
  const fixture = ENERGY_FIXTURES.find(f => f.id === id);
  return screen(fixtureSnapshot({states: fixture.states, now: fixture.now, route: {page: 'energy', detail: null, dialog: null},
    loaded: {history: {energy: history}, historyLoading: new Set(loading ? ['energy'] : [])}})).page.dayChart;
}
// Noon exporting 1.52 kW with the rest of the forecast, and 21:04 importing 316 W with solar asleep.
const NOON = dayChart('covered', ENERGY_POWER_HISTORY).model, NIGHT = dayChart('night', ENERGY_NIGHT_POWER_HISTORY).model;
const NOTHING = {...ENERGY_POWER_HISTORY, data: EMPTY.history};
const STATES = {loading: dayChart('covered', NOTHING, true).model, empty: dayChart('covered', NOTHING).model,
  error: dayChart('covered', {...ENERGY_POWER_HISTORY, data: REJECTED.history}).model,
  partial: dayChart('covered', {...ENERGY_POWER_HISTORY, data: {...ENERGY_POWER_HISTORY.data, errors: REJECTED.history.errors}}).model};
const BOX = {width: DAY_WIDTH, height: DAY_PLOT.phone};
const draw = (model, props = {}) => renderToStaticMarkup(h(DayChart, {model, ...props}));
const count = (html, pattern) => (html.match(pattern) || []).length;
const figuresOf = html => [...html.matchAll(/<div class="m-power__figure m-power__figure--(\w+)"><dt>([^<]*)<\/dt><dd class="m-num">([^<]*)(?:<span class="m-power__unit"> ([^<]*)<\/span>)?<\/dd>/g)]
  .map(([, key, label, value, unit]) => [key, label, value, unit ?? '']);
const whenOf = html => html.match(/<p class="m-power__when">([^<]*)<\/p>/)[1];
const rule = selector => dayChartStyles.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`))?.[1] ?? '';
// A path's points and control points: every number pair after its commands.
const pairs = d => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);

test('the value axis runs from zero in two or three round steps to the lowest top over every value, with room to spare', () => {
  const tops = [[3400, 4000, [0, 2000, 4000]], [4300, 5000, [0, 2500, 5000]], [2100, 3000, [0, 1000, 2000, 3000]], [900, 1000, [0, 500, 1000]],
    [150, 200, [0, 100, 200]], [50, 200, [0, 100, 200]], [9000, 10000, [0, 5000, 10000]]];
  for (const [max, top, ticks] of tops) assert.deepEqual([dayScale([0, max, null]).top, dayScale([max]).ticks], [top, ticks], String(max));
  for (let max = 40; max < 12000; max += 37) {
    const {top, step, ticks} = dayScale([max]);
    assert.ok(top >= max * 1.04 - 1e-6 && ticks.length >= 3 && ticks.length <= 4 && ticks.at(-1) === top && step >= 100, `${max}: ${ticks}`);
  }
  for (const nothing of [[], [null, NaN], [0], [-200]]) assert.deepEqual(dayScale(nothing), {top: 0, step: 0, ticks: [0]});
  assert.deepEqual([0, 2000, 2500, 500, 10000].map(w => dayTick(w, true)), ['0', '2 kW', '2.5 kW', '0.5 kW', '10 kW']);
  assert.deepEqual([0, 500, 100].map(w => dayTick(w, false)), ['0', '500 W', '100 W']);
});

test('a scrubbed figure writes power as model.js’s power() does, over many values', () => {
  for (let w = 0; w < 12000; w += 7.3) assert.equal(powerParts(w).join(' '), power(w), String(w));
  assert.deepEqual([powerParts(1520), powerParts(850), powerParts(999.6), powerParts(null)], [['1.52', 'kW'], ['850', 'W'], ['1000', 'W'], ['—', '']]);
});

test('a curve passes through every point and never overshoots: each segment’s control points lie between its ends', () => {
  const points = [[0, 100], [10, 40], [20, 40], [30, 90], [35, 10], [50, 60], [52, 61]];
  const d = monotonePath(points);
  assert.ok(d.startsWith('M0,100C'));
  const segments = d.slice(1).split('C').slice(1).map(pairs);
  assert.equal(segments.length, points.length - 1);
  segments.forEach(([c1, c2, end], i) => {
    const [[, y1], [x2, y2]] = [points[i], points[i + 1]];
    assert.deepEqual(end, [x2, y2], `segment ${i} ends on its point`);
    for (const [, y] of [c1, c2]) assert.ok(y >= Math.min(y1, y2) - 0.1 && y <= Math.max(y1, y2) + 0.1, `segment ${i}: ${y} within ${y1}…${y2}`);
  });
  assert.ok(segments[1].every(([, y]) => y === 40), 'a flat stays flat');
  assert.equal(monotonePath([[0, 1], [5, 2]], 'L'), 'L0,1C1.7,1.3 3.3,1.7 5,2');
  assert.equal(monotonePath([[3, 4]]), 'M3,4');
  assert.equal(monotonePath([]), '');
});

test('a key’s runs break where it has no value, each mean at its step’s middle, the run reaching its first start and its last end', () => {
  const steps = [{start: 0, end: 10, v: 1}, {start: 10, end: 20, v: null}, {start: 20, end: 30, v: 3}, {start: 30, end: 35, v: 4}];
  assert.deepEqual(stepRuns(steps, 'v'), [[[0, 1], [5, 1], [10, 1]], [[20, 3], [25, 3], [32.5, 4], [35, 4]]]);
  assert.deepEqual(stepRuns([], 'v'), []);
});

test('the plot spans midnight to midnight: the hours of the wall clock under it, values at the right, the record to its end', () => {
  const layout = dayLayout(NOON, BOX), {area} = layout;
  assert.deepEqual([NOON.start, NOON.end], [dayWindow(ENERGY_NOW, 'Europe/Brussels').start, dayWindow(ENERGY_NOW, 'Europe/Brussels').end]);
  assert.deepEqual(layout.hours.map(hour => hour.label), ['00', '06', '12', '18']);
  assert.deepEqual(layout.hours.map(hour => hour.x), [0, 1, 2, 3].map(q => Math.round(area.right * q / 4 * 10) / 10), 'a quarter of the day apart');
  assert.deepEqual(layout.grid.map(line => line.label), ['0', '2 kW', '4 kW']);
  assert.equal(area.right, BOX.width - 4 * 7 - 6, 'the widest label, "4 kW", and its gap');
  assert.deepEqual([area.left, area.top, area.bottom, layout.labelX], [0, 8, BOX.height - 22, area.right + 6]);
  assert.deepEqual(layout.now, {x: Math.round(layout.xOf(ENERGY_NOW) * 10) / 10, y: Math.round(layout.yOf(NOON.rows.at(-1).house) * 10) / 10}, 'the dot where the record ends');
  assert.deepEqual([layout.solar.lines.length, layout.house.lines.length, layout.house.areas.length], [1, 1, 1]);
  assert.ok(layout.forecast.startsWith(`M${Math.round(layout.xOf(ENERGY_NOW) * 10) / 10},`), 'the forecast from the record’s end');
  assert.ok(layout.above.endsWith('Z') && layout.above.includes(`,${area.top}L`), 'the clip reaches the plot’s top');
  // The step under a pointer: the first at the left edge, each step's own, and the last past the record.
  assert.deepEqual([layout.stepAt(0), layout.stepAt(layout.xOf(NOON.rows[7].start + 1)), layout.stepAt(area.right)], [0, 7, NOON.rows.length - 1]);
  // The night: solar gapped where the inverter slept, no forecast, the dot at 21:04.
  const night = dayLayout(NIGHT, BOX);
  assert.deepEqual([night.solar.lines.length, night.forecast, night.now.x], [1, '', Math.round(night.xOf(ENERGY_NIGHT_NOW) * 10) / 10]);
});

test('the day the clocks go back is 25 hours, and its hours are still the wall clock’s', () => {
  const {start, end} = dayWindow(Date.parse('2026-10-25T12:00:00+01:00'), 'Europe/Brussels');
  const layout = dayLayout({rows: [], forecast: [], start, end, timeZone: 'Europe/Brussels'}, BOX);
  assert.deepEqual(layout.hours.map(hour => hour.label), ['00', '06', '12', '18']);
  // 06:00 comes 7 hours after midnight that day.
  assert.equal(layout.hours[1].x, Math.round(layout.area.right * 7 / 25 * 10) / 10);
  assert.deepEqual([layout.grid.map(line => line.label), layout.now, layout.above, layout.stepAt(10)], [['0'], null, '', -1], 'empty: zero alone');
});

test('a scrub marks its half hour’s middle with the house’s point and solar’s, solar only above zero', () => {
  const layout = dayLayout(NOON, BOX), index = NOON.rows.findIndex(row => row.start === ENERGY_NOW - HOUR), row = NOON.rows[index];
  const marks = dayMarks(NOON, layout, index);
  assert.equal(marks.x, Math.round(layout.xOf(row.start + 15 * MINUTE) * 10) / 10);
  assert.deepEqual(marks.points.map(point => point.key), ['solar', 'house']);
  assert.deepEqual(dayMarks(NIGHT, dayLayout(NIGHT, BOX), 0).points.map(point => point.key), ['house'], 'solar asleep at midnight');
  assert.equal(dayTime(NOON, index), '11:30–12:00');
  assert.equal(dayTime(NOON, NOON.rows.length - 1), 'Now');
});

test('the chart is headed by the day and its three figures, Solar, Grid and Consumed, in every state', () => {
  const html = draw(NOON);
  assert.equal(whenOf(html), 'Today');
  assert.deepEqual(figuresOf(html), [['solar', 'Solar', '6.8', 'kWh'], ['grid', 'Grid', '0.9', 'kWh'], ['house', 'Consumed', '3.6', 'kWh']]);
  for (const [status, model] of Object.entries(STATES)) assert.deepEqual(figuresOf(draw(model)).map(([, label, value]) => `${label} ${value}`), ['Solar 6.8', 'Grid 0.9', 'Consumed 3.6'], status);
  const missing = dayChart('missing', NOTHING).model;
  assert.deepEqual(figuresOf(draw(missing)), [['solar', 'Solar', '—', ''], ['grid', 'Grid', '—', ''], ['house', 'Consumed', '—', '']], 'no unit with no number');
});

test('the plot is one named SVG: the fades, the clip, solar’s fill and curve, the grid’s fill clipped above solar, the forecast, the house and the dot', () => {
  const html = draw(NOON), svg = html.match(/<svg[^>]*>/)[0];
  assert.match(svg, /class="m-power__svg" role="img" aria-label="Solar, grid and consumption today" viewBox="0 0 311 164"/);
  const id = html.match(/<linearGradient id="([^"]+)-solar"/)[1];
  assert.ok(html.includes(`<linearGradient id="${id}-grid"`) && html.includes(`<clipPath id="${id}-above">`));
  assert.equal(count(html, new RegExp(`<path class="m-power__fill"[^>]*fill="url\\(#${id}-solar\\)"`, 'g')), 1);
  assert.match(html, new RegExp(`<g clip-path="url\\(#${id}-above\\)"><path class="m-power__fill"[^>]*fill="url\\(#${id}-grid\\)"`));
  assert.deepEqual([count(html, /m-power__line--solar/g), count(html, /m-power__line--forecast/g), count(html, /m-power__line--house/g), count(html, /<circle class="m-power__now"/g)], [1, 1, 1, 1]);
  assert.deepEqual([count(html, /<line class="m-power__value(?: m-power__value--zero)?"/g), count(html, /m-power__value--zero/g), count(html, /<line class="m-power__hour"/g)], [3, 1, 3],
    'three value lines, zero marked; an hour line after midnight, at 06, 12 and 18');
  assert.deepEqual([...html.matchAll(/<text class="m-power__axis"[^>]*>([^<]*)<\/text>/g)].map(m => m[1]), ['0', '2 kW', '4 kW', '00', '06', '12', '18']);
  // Drawn in order: fills, then the curves, then the dot.
  const order = ['m-power__fill', 'm-power__line--solar', 'm-power__line--forecast', 'm-power__line--house', 'm-power__now'].map(cls => html.indexOf(cls));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(count(draw(NIGHT), /m-power__line--forecast/g), 0, 'no forecast at night');
  assert.doesNotMatch(html, /m-power__rule|m-power__point/, 'nothing scrubbed');
});

test('scrubbed, the line says the half hour and the figures its means; the last step is Now', () => {
  const html = draw(NOON, {scrubAt: ENERGY_NOW - HOUR}), row = NOON.rows.find(r => r.start === ENERGY_NOW - HOUR);
  assert.equal(whenOf(html), '11:30–12:00');
  assert.deepEqual(figuresOf(html), [['solar', 'Solar', ...powerParts(row.solar)], ['grid', 'Grid', ...powerParts(row.grid)], ['house', 'Consumed', ...powerParts(row.house)]]);
  assert.deepEqual([count(html, /<line class="m-power__rule"/g), count(html, /<circle class="m-power__point m-power__point--(?:solar|house)"/g)], [1, 2]);
  assert.equal(whenOf(draw(NOON, {scrubAt: ENERGY_NOW - 1})), 'Now');
  assert.equal(whenOf(draw(NOON, {scrubAt: ENERGY_NOW + HOUR})), 'Today', 'past the record: nothing to scrub');
});

test('each state stands in for the plot: the still placeholder, one footnote line, and filling, the day’s empty axes', () => {
  assert.match(draw(STATES.loading), /<div class="m-power__placeholder" role="status" aria-label="Loading recorded values" style="height:164px"><\/div>/);
  assert.match(draw(STATES.empty), /<p class="m-power__state m-power__state--line">Nothing recorded yet today.<\/p>/);
  assert.match(draw(STATES.error), /<p class="m-power__state m-power__state--line" role="alert">Recorded values are unavailable right now.<\/p>/);
  const blank = draw(STATES.empty, {fill: true, height: DAY_PLOT.grid});
  assert.match(blank, /<section class="m-power m-power--fill">/);
  assert.match(blank, /<div class="m-power__blank" style="min-height:180px"><svg class="m-power__svg"[\s\S]*<\/svg><p class="m-power__state">Nothing recorded yet today.<\/p><\/div>/);
  // Still the rest of the forecast, from now: what the day has to come.
  assert.deepEqual([...blank.matchAll(/<text class="m-power__axis"[^>]*>([^<]*)<\/text>/g)].map(m => m[1]), ['0', '2 kW', '4 kW', '00', '06', '12', '18']);
  assert.deepEqual([count(blank, /m-power__line--forecast/g), STATES.empty.forecast[0].start], [1, ENERGY_NOW]);
  assert.match(draw(STATES.partial), /<p class="m-power__note">Some recorded values could not be loaded.<\/p><\/section>$/);
  assert.match(draw(NOON, {fill: true, height: DAY_PLOT.grid}), /<div class="m-power__plot" style="min-height:180px">/);
  assert.match(draw(NOON), /<div class="m-power__plot"><svg/, 'on a phone, the plot’s own height');
});

test('the colours are the tokens’: solar yellow, the grid indigo fading less, the house the label colour, a point ringed in the card’s fill', () => {
  assert.match(rule('.m-power__figure--solar dt'), /color:var\(--m-yellow-text\)/);
  assert.match(rule('.m-power__figure--grid dt'), /color:var\(--m-indigo-text\)/);
  assert.match(rule('.m-power__figure--house dt'), /color:var\(--m-label\)/);
  assert.match(rule('.m-power__line--solar'), /stroke:var\(--m-yellow\)/);
  assert.match(rule('.m-power__line--house'), /stroke:var\(--m-label\);stroke-width:2/);
  assert.match(rule('.m-power__line--forecast'), /stroke-dasharray:0 5/);
  const fade = name => Number(rule(`.m-power__stop--${name}`).match(/stop-opacity:([\d.]+)/)[1]);
  assert.ok(fade('grid-foot') > fade('solar-foot') && fade('grid') === fade('solar'), 'the grid still reads at the foot through the night');
  assert.match(rule('.m-power'), /--m-power-surface:var\(--m-card-fill\)/);
  assert.match(rule(':host([dark]) .m-power'), /--m-power-surface:var\(--m-bg\)/);
  assert.match(rule('.m-power__now,.m-power__point'), /stroke:var\(--m-power-surface\)/);
  assert.match(rule('.m-power__plot'), /touch-action:pan-y/);
});
