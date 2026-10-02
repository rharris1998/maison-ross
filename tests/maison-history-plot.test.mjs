// Maison's 24-hour chart (#29 step 4, v32): history.js's model drawn as
// Maison's own SVG. The geometry (charts/history-plot.js) is pure and
// imported directly: the value scale, the round hours in the model's time
// zone, the runs and their gaps, the stepped target, the room scale's
// gradient and the scrub's nearest row. Node has no JSX, so esbuild bundles
// the chart with react-dom/server into a temporary module (as
// tests/maison-charts-b.test.mjs does), and each test reads the markup
// the Attic sheet's recorded day renders to: the named SVG, the Now edge,
// the target stepped under the reading, the gaps and the isolated sample,
// colours by what each series measures (never blue), every state, a scrub,
// and the Full history button's name.
//
// Energy's power chart was this chart from v33 to v36; from v37 it is its
// own (maison-day-chart.test.mjs), and Climate's charts still draw exactly
// as in v32.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {CLIMATE_NOW} from '../frontend/maison/fixtures/climate-fixtures.js';
import {EMPTY, LOADING, REJECTED, climateSheetSnapshot, climateSnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {tempColour} from '../frontend/maison/src/ui/temp-scale.js';
import {DARK, LIGHT, TEMP_SCALE} from '../frontend/maison/src/ui/tokens.js';
import {historyChartStyles} from '../frontend/maison/src/charts/history.css.js';
import {BOXES, SCRUB_SLOP, formatReading, hourTicks, latestValues, legendAt, nearestRow, niceStep, plotLayout, pointList, roomStops, seriesPaints, seriesRuns, startsScrub, steppedPoints, valueScale}
  from '../frontend/maison/src/charts/history-plot.js';

const CHARTS = fileURLToPath(new URL('../frontend/maison/src/charts/', import.meta.url));
const ENTRY = `export {HistoryChart} from './history.jsx';
export {SheetPlacementContext, useSheetPlacement} from '../ui/sheet.jsx';
export {CommandContext} from '../contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The chart, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-history-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: CHARTS, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'history.mjs'), bundle.outputFiles[0].text);
const {h, renderToStaticMarkup, CommandContext, HistoryChart, SheetPlacementContext, useSheetPlacement} = await import(pathToFileURL(join(folder, 'history.mjs')));
rmSync(folder, {recursive: true, force: true});

const HOUR = 3600000, DAY_START = CLIMATE_NOW - 24 * HOUR;
// The Attic sheet's charts (temperature and target, then humidity) for a
// gallery preset, its recorded day by default.
const attic = (options = {}) => screen(climateSnapshot('house_running', {detail: 'attic', ...options})).drawer.body.charts;
const [TEMPERATURE, HUMIDITY] = attic();
// The chart's markup for a value, under a command that does nothing.
const draw = (value, props = {}) => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, h(HistoryChart, {value, ...props})));
const count = (html, pattern) => (html.match(pattern) || []).length;
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const tags = (html, name, cls) => [...html.matchAll(new RegExp(`<${name} class="${cls}"[^>]*>`, 'g'))].map(m => attrs(m[0]));
const texts = (html, cls) => [...html.matchAll(new RegExp(`<text class="${cls}"[^>]*>([^<]*)</text>`, 'g'))].map(m => m[1]);
const points = list => list.split(' ').map(pair => pair.split(',').map(Number));
// One series' group in the markup, by its paint.
const series = (html, paint) => html.match(new RegExp(`<g class="m-history__series m-history__series--${paint}">(.*?)</g>`))?.[1] ?? '';
// A stylesheet's rule for exactly `selector`, as its declarations.
const rule = selector => historyChartStyles.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`))?.[1] ?? '';
// The wall clock in a zone.
const clock = (t, timeZone) => new Intl.DateTimeFormat('en-GB', {timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(t);

test('the value scale lands on round steps, covers every value, keeps zero on a gridline and centres a flat series', () => {
  assert.deepEqual([0.7, 1.5, 3, 4.2, 7, 23, 2333].map(niceStep), [1, 2, 5, 5, 10, 50, 5000]);
  assert.deepEqual(valueScale([16.4, 21, 16, 19.8], {minStep: 1}), {low: 16, high: 22, step: 2, ticks: [16, 18, 20, 22]});
  assert.deepEqual(valueScale([45, 48], {minStep: 1}).ticks, [45, 46, 47, 48]);
  // A flat target: one step either side of it.
  assert.deepEqual(valueScale([21, 21], {minStep: 1}).ticks, [20, 21, 22]);
  // A reading that barely moves keeps whole degrees and at least three gridlines.
  assert.deepEqual(valueScale([19.6, 19.8], {minStep: 1}).ticks, [19, 20, 21]);
  // A series either side of zero: zero is a gridline.
  const signed = valueScale([-3000, 1200, 4000]);
  assert.ok(signed.ticks.includes(0) && signed.low <= -3000 && signed.high >= 4000, signed.ticks.join(' '));
  assert.deepEqual(valueScale([0.12, 0.37]).ticks, [0.1, 0.2, 0.3, 0.4], 'no float dust');
  assert.equal(valueScale([null, NaN, undefined]), null);
  for (const values of [[16.4, 21], [19.5, 42.6], [-3000, 4000], [0.12, 0.37], [45, 45.2]]) {
    const {low, high, ticks} = valueScale(values, {minStep: values[0] > 1 ? 1 : 0});
    assert.ok(low <= Math.min(...values) && high >= Math.max(...values) && ticks.length >= 3, values.join('…'));
  }
});

test('the time ticks are the round hours every 6 h in the model’s time zone, a clock change and a half-hour zone included', () => {
  const ticks = hourTicks(DAY_START, CLIMATE_NOW, 'Europe/Brussels');
  assert.deepEqual(ticks.map(t => t.label), ['12:00', '18:00', '00:00', '06:00']);
  for (const {timestamp, label} of ticks) assert.equal(clock(timestamp, 'Europe/Brussels'), label);
  // The night the clocks go back: 25 hours, and still 00:00 then 06:00.
  const autumn = hourTicks(Date.parse('2026-10-24T12:00:00Z'), Date.parse('2026-10-25T12:00:00Z'), 'Europe/Brussels');
  assert.deepEqual(autumn.map(t => t.label), ['18:00', '00:00', '06:00', '12:00']);
  assert.equal(autumn[2].timestamp - autumn[1].timestamp, 7 * HOUR);
  // India is 5:30 off UTC: its round hours fall on UTC’s half hours.
  const kolkata = hourTicks(DAY_START, CLIMATE_NOW, 'Asia/Kolkata');
  assert.equal(kolkata.length, 4);
  for (const {timestamp, label} of kolkata) {
    assert.equal(new Date(timestamp).getUTCMinutes(), 30);
    assert.equal(clock(timestamp, 'Asia/Kolkata'), label);
  }
  // A zone Intl doesn't know falls back to UTC.
  assert.deepEqual(hourTicks(DAY_START, CLIMATE_NOW, 'Nowhere/Else').map(t => t.label), ['12:00', '18:00', '00:00', '06:00']);
  assert.equal(TEMPERATURE.model.timeZone, 'Europe/Brussels');
});

test('runs break where a series has no value, and a stepped series holds each value', () => {
  const rows = [5, null, 6, 7, null, null, 8].map((v, i) => ({timestamp: i, s: v}));
  assert.deepEqual(seriesRuns(rows, 's').map(run => run.map(p => p.value)), [[5], [6, 7], [8]]);
  assert.deepEqual(steppedPoints([[0, 10], [5, 10], [8, 4], [9, 4], [12, 7]]), [[0, 10], [8, 10], [8, 4], [12, 4], [12, 7]]);
  assert.deepEqual(steppedPoints([[0, 10], [5, 10], [9, 10]]), [[0, 10], [9, 10]], 'a flat target ends at its last point');
  assert.equal(pointList([[1.04, 2], [1.01, 2], [3, 4.56]]), '1,2 3,4.6', 'tenths, repeats dropped');
});

test('the plot sits inside its box: values on the left, the hours under it, and the Now edge at its right', () => {
  const {model} = TEMPERATURE;
  for (const box of Object.values(BOXES)) {
    const layout = plotLayout(model, box), {area} = layout;
    assert.ok(area.left > 0 && area.right < box.width && area.top > 0 && area.bottom < box.height, JSON.stringify(area));
    assert.deepEqual(layout.grid.map(line => line.label), ['16', '18', '20', '22']);
    assert.deepEqual([layout.grid[0].y, layout.grid.at(-1).y], [area.bottom, area.top], 'the lowest gridline at the foot, the highest at the top');
    // 06:00 is 3½ hours before Now: too near its label in the bottom sheet's box.
    assert.deepEqual(layout.hours.map(hour => hour.label), box === BOXES.bottom ? ['12:00', '18:00', '00:00', ''] : ['12:00', '18:00', '00:00', '06:00']);
    assert.deepEqual(layout.now, {x: area.right, label: model.nowLabel});
    for (const {x} of layout.hours) assert.ok(x > area.left && x < area.right);
    for (const line of layout.series.flatMap(s => s.lines)) {
      for (const [x, y] of points(line)) assert.ok(x >= area.left && x <= area.right && y >= area.top && y <= area.bottom, `${x},${y}`);
    }
  }
  // Laid out at the width it is drawn, from a 320px phone's bottom sheet to
  // the form sheet: the plot inside, each hour label inside the box.
  for (const width of [264, 319, 361, 584]) {
    const layout = plotLayout(model, {width, height: 164}), {area} = layout;
    assert.ok(area.left > 0 && area.right === width - 7, `${width}: ${JSON.stringify(area)}`);
    for (const {x, label} of layout.hours.filter(hour => hour.label)) assert.ok(x - label.length * 3.5 >= 0 && x + label.length * 3.5 <= layout.now.x, `${width}: ${label}`);
  }
  // An hour label keeps 16 units from Now's, or is left out; its line stays.
  for (const width of [264, 319, 343, 584]) for (const end of [0, 0.5, 1, 1.5, 2, 2.5, 3, 4].map(h => CLIMATE_NOW - h * HOUR)) {
    const layout = plotLayout({...model, end, start: end - 24 * HOUR}, {width, height: 164}), nowStart = layout.now.x - 3 * 7;
    for (const {x, label} of layout.hours.filter(hour => hour.label)) assert.ok(x + label.length * 7 / 2 <= nowStart - 16, `${width}, ${label} at ${x}`);
  }
  // An hour label that would run into Now is left out; its line stays.
  const late = plotLayout({...model, end: DAY_START + 20.8 * HOUR}, BOXES.bottom);
  assert.equal(late.hours.at(-1).label, '', 'the 06:00 label beside Now');
  assert.equal(late.hours.length, 4);
});

test('the SVG is named by the model and described by it, with the round hours and Now under the plot', () => {
  const html = draw(TEMPERATURE), [svg] = tags(html, 'svg', 'm-history__svg');
  assert.equal(svg.role, 'img');
  assert.equal(svg['aria-label'], TEMPERATURE.model.imageLabel ?? TEMPERATURE.model.plotLabel);
  assert.equal(svg.viewBox, '0 0 343 164');
  const described = html.match(new RegExp(`<p class="m-visually-hidden" id="${svg['aria-describedby'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">([^<]*)</p>`));
  assert.equal(described?.[1], TEMPERATURE.model.description.replace(/'/g, '&#x27;'));
  // A model with an image label is named by it; without, by its plot label.
  const {imageLabel, ...bare} = TEMPERATURE.model;
  assert.equal(tags(draw({...TEMPERATURE, model: {...bare, imageLabel: 'Temperature and target over the last 24 hours'}}), 'svg', 'm-history__svg')[0]['aria-label'], 'Temperature and target over the last 24 hours');
  assert.equal(tags(draw({...TEMPERATURE, model: bare}), 'svg', 'm-history__svg')[0]['aria-label'], bare.plotLabel);
  // The axes: values, then the round hours, then Now at the right edge.
  assert.deepEqual(texts(html, 'm-history__axis'), ['16', '18', '20', '22', '12:00', '18:00', '00:00', 'Now']);
  const now = html.match(/<text class="m-history__axis" x="([\d.]+)" y="[\d.]+" text-anchor="end">Now<\/text>/);
  assert.equal(Number(now[1]), Number(tags(html, 'line', 'm-history__now')[0].x1));
  assert.equal(count(html, /class="m-history__hour"/g), 4);
  assert.equal(count(html, /class="m-history__grid"/g), 4);
  // Nothing moves and nothing takes focus: the plot is read, not tabbed to.
  assert.doesNotMatch(html.match(/<div class="m-history__plot".*?<\/div>/)[0], /tabindex|<button/);
  assert.equal(draw(TEMPERATURE), html, 'the same markup every time');
});

test('the target is stepped under the reading, and the reading has its gaps and its isolated sample', () => {
  const html = draw(TEMPERATURE);
  // The target first, so the reading is drawn over it.
  assert.ok(html.indexOf('m-history__series--target') < html.indexOf('m-history__series--room'));
  const [target] = tags(series(html, 'target'), 'polyline', 'm-history__line').map(line => points(line.points));
  for (let i = 1; i < target.length; i += 1) {
    assert.ok(target[i][0] === target[i - 1][0] || target[i][1] === target[i - 1][1], `segment ${i} is level or upright`);
  }
  assert.equal(target.filter((p, i) => i && p[0] === target[i - 1][0]).length, 2, 'down to setback at 18:00, up to comfort at 08:00');
  // The Attic's reading: recorded until 13:30, once at 21:30 and from 05:30.
  const room = series(html, 'room'), lines = tags(room, 'polyline', 'm-history__line'), layout = plotLayout(TEMPERATURE.model, BOXES.bottom);
  assert.equal(lines.length, 2, 'two runs, a gap between them');
  assert.deepEqual(lines.map(line => points(line.points)[0][0]), [layout.area.left, Math.round(layout.xOf(DAY_START + 20 * HOUR) * 10) / 10]);
  const dots = tags(room, 'circle', 'm-history__dot');
  assert.equal(dots.length, 1);
  assert.equal(Number(dots[0].cx), Math.round(layout.xOf(DAY_START + 12 * HOUR) * 10) / 10, 'the lone sample at 21:30');
  assert.equal(dots[0].style, `--m-history-room:${tempColour(16.4)}`);
  // Humidity, recorded throughout: one run and no dot.
  const humid = series(draw(HUMIDITY), 'humidity');
  assert.equal(count(humid, /m-history__line/g), 1);
  assert.equal(count(humid, /m-history__dot/g), 0);
});

test('a sensor that blips unavailable gets a dot per sample, each keyed by its row, even where two round to one x', () => {
  // A reading that alternates with unavailable every 10 s for two minutes, an hour before Now.
  const from = CLIMATE_NOW - HOUR, rows = Array.from({length: 13}, (_, i) => ({timestamp: from + i * 10000, series0: i % 2 ? null : 19 + i / 100, series0Exact: i % 2 === 0}));
  const model = {...TEMPERATURE.model, series: [TEMPERATURE.model.series[0]], rows: [{timestamp: DAY_START, series0: 18}, {timestamp: DAY_START + 60000, series0: null}, ...rows, {timestamp: CLIMATE_NOW, series0: null}]};
  const [room] = plotLayout(model, BOXES.bottom).series, blips = room.dots.slice(1), xs = blips.map(dot => dot.x);
  assert.equal(room.dots.length, 8, 'the day’s first sample, then each blip’s');
  assert.ok(new Set(xs).size < xs.length, `two dots share a rounded x: ${xs.join(' ')}`);
  assert.equal(new Set(room.dots.map(dot => dot.index)).size, 8, 'and each has its own row');
  assert.deepEqual(blips.map(dot => model.rows[dot.index].timestamp), rows.filter((_, i) => i % 2 === 0).map(row => row.timestamp));
  assert.equal(count(draw({...TEMPERATURE, model}), /class="m-history__dot"/g), 8);
});

test('each series is coloured by what it measures: the room scale for a room, the labels otherwise, never blue', () => {
  const html = draw(TEMPERATURE), layout = plotLayout(TEMPERATURE.model, BOXES.bottom);
  // The room reading: a gradient up the plot, the room scale from its foot to its top.
  const gradient = html.match(/<linearGradient id="([^"]+)" gradientUnits="userSpaceOnUse" x1="0" y1="([\d.]+)" x2="0" y2="([\d.]+)">(.*?)<\/linearGradient>/);
  assert.ok(gradient);
  assert.deepEqual([Number(gradient[2]), Number(gradient[3])], [layout.area.bottom, layout.area.top]);
  assert.deepEqual([...gradient[4].matchAll(/<stop class="m-history__stop" offset="([\d.]+)" style="--m-history-room:([^"]+)"/g)].map(m => [Number(m[1]), m[2]]),
    roomStops(16, 22).map(stop => [stop.offset, stop.colour]));
  assert.deepEqual(roomStops(16, 22).map(stop => stop.colour), [16, 19, 21, 22].map(tempColour));
  for (const line of tags(series(html, 'room'), 'polyline', 'm-history__line')) assert.equal(line.style, `stroke:url(#${gradient[1]})`);
  // The legend's swatch: the room's in its reading's colour, the target's plain.
  assert.match(html, new RegExp(`<span class="m-history__swatch m-history__swatch--room" style="--m-history-room:${tempColour(19.8).replace(/[()]/g, '\\$&')}"></span>`));
  assert.match(html, /<span class="m-history__swatch m-history__swatch--target"><\/span>/);
  // By role in the stylesheet: a target and a probe in the label, humidity in the secondary label.
  assert.equal(rule('.m-history__series--target,.m-history__series--probe,.m-history__series--neutral-0'), 'color:var(--m-label)');
  assert.equal(rule('.m-history__series--humidity,.m-history__series--neutral-1'), 'color:var(--m-label-2)');
  assert.match(rule('.m-history__series--target .m-history__line'), /stroke-width:1\.5/);
  assert.match(series(draw(HUMIDITY), 'humidity'), /m-history__line/);
  // The second valve probe is dashed, so two in one colour stay apart.
  const probes = {series: [{role: 'probe'}, {role: 'probe'}, {role: 'room'}, {role: null, colorIndex: 1}]};
  assert.deepEqual(seriesPaints(probes), [{paint: 'probe', dashed: false}, {paint: 'probe', dashed: true}, {paint: 'room', dashed: false}, {paint: 'neutral-1', dashed: false}]);
  assert.match(rule('.m-history__line--dashed'), /stroke-dasharray:/);
  // No blue anywhere: not in the rules, not in the markup.
  for (const text of [historyChartStyles, html, draw(HUMIDITY)]) assert.doesNotMatch(text, /blue|--m-accent/i);
});

// A colour as [r, g, b] from a token or tempColour, the light scheme's
// shading of a room colour (55% of it, 45% --m-label), and WCAG contrast.
const rgb = value => value.startsWith('#') ? [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) : value.match(/[\d.]+/g).slice(0, 3).map(Number);
const mix = (a, b, share) => a.map((channel, i) => channel * share + b[i] * (1 - share));
const luminance = colour => {
  const [r, g, b] = colour.map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('in light every room colour the chart draws is shaded to read on the sheet; dark keeps it as it is; without light-dark() the line takes a halo', () => {
  const SHADE = 'light-dark(color-mix(in srgb,var(--m-history-room) 55%,var(--m-label)),var(--m-history-room))';
  const supported = historyChartStyles.match(/\n@supports \(color:light-dark[^{]*\{(.*)\}\n/)[1];
  for (const [selector, property] of [['.m-history__stop', 'stop-color'], ['.m-history__series--room .m-history__dot,.m-history__series--room .m-history__point', 'fill']]) {
    assert.ok(supported.includes(`${selector}{${property}:${SHADE}}`), selector);
    assert.ok(rule(selector).includes(`${property}:var(--m-history-room)`), `${selector}: plain without light-dark()`);
  }
  assert.match(supported, /\.m-history__swatch--room\{background:light-dark\(color-mix\(in srgb,var\(--m-history-room,var\(--m-label-3\)\) 55%,var\(--m-label\)\),/);
  // The halo: hidden, and drawn only where light-dark() or color-mix() is missing.
  assert.equal(rule('.m-history__halo'), 'display:none');
  assert.match(historyChartStyles, /\n@supports not \(\(color:light-dark\(transparent,transparent\)\) and \(color:color-mix[^{]*\{\.m-history__halo\{display:inline;fill:none;stroke:var\(--m-label\);stroke-opacity:\.4;stroke-width:4\.5;/);
  const html = draw(TEMPERATURE);
  assert.deepEqual(tags(series(html, 'room'), 'polyline', 'm-history__halo').map(line => line.points), tags(series(html, 'room'), 'polyline', 'm-history__line').map(line => line.points), 'a halo under each run');
  assert.equal(count(series(html, 'target'), /m-history__halo/g), 0, 'only a room reading has one');
  // Every stop of the room scale: 3:1 and up against the light sheet and a
  // light card once shaded, and as it is against the dark sheet and card.
  const [label, sheet, card] = ['m-label', 'm-sheet-fill', 'm-card-fill'].map(key => rgb(LIGHT[key]));
  for (const [t, hex] of TEMP_SCALE) {
    const shaded = mix(rgb(hex), label, 0.55);
    assert.ok(contrast(shaded, sheet) >= 3.9 && contrast(shaded, card) >= 4, `${t}° in light: ${contrast(shaded, sheet).toFixed(2)}:1`);
    assert.ok(contrast(rgb(hex), rgb(DARK['m-sheet-fill'])) >= 4.5, `${t}° in dark`);
  }
});

test('every state keeps the title and Full history: loading is still, an error is an alert, empty says so, partial adds its note', () => {
  const states = {loading: attic(LOADING)[0], error: attic({history: REJECTED.history})[0], empty: attic(EMPTY)[0]};
  assert.deepEqual(Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.model.status])), {loading: 'loading', error: 'error', empty: 'empty'});
  for (const [key, value] of Object.entries(states)) {
    const html = draw(value);
    assert.match(html, new RegExp(`<h3 class="m-history__title">${value.model.title}</h3>`), key);
    assert.match(html, /class="m-button m-button--plain[^"]*m-history__full"/, key);
    assert.equal(count(html, /<svg|<dl/g), 0, `${key}: no plot and no legend`);
  }
  const loading = draw(states.loading);
  assert.match(loading, new RegExp(`<div class="m-history__placeholder" role="status" aria-label="${states.loading.model.loadingLabel}" style="height:164px"></div>`));
  assert.equal(rule('.m-history__placeholder').includes('animation'), false, 'still');
  assert.match(draw(states.error), new RegExp(`<p class="m-history__state" role="alert" style="height:164px">${states.error.model.stateText}</p>`));
  assert.match(draw(states.empty), new RegExp(`<p class="m-history__state" style="height:164px">${states.empty.model.stateText}</p>`));
  // Partial: the plot and its note.
  const recorded = climateSnapshot().loaded.history['climate-attic'].data;
  const partial = attic({history: {...recorded, errors: REJECTED.history.errors}})[0];
  assert.equal(partial.model.status, 'ready');
  const html = draw(partial);
  assert.match(html, /<svg class="m-history__svg"/);
  assert.match(html, new RegExp(`<p class="m-history__note">${partial.model.partialText}</p>`));
  assert.doesNotMatch(draw(TEMPERATURE), /m-history__note/);
});

test('Full history is a plain button labelled by the model and named by its link', () => {
  const html = draw(TEMPERATURE), [button] = tags(html, 'button', '[^"]*m-history__full');
  assert.match(html, new RegExp(`<span class="m-button__label">${TEMPERATURE.model.fullLabel}</span>`));
  const named = {...TEMPERATURE, full: {...TEMPERATURE.full, ariaLabel: 'Full history: temperature and target'}};
  assert.equal(tags(draw(named), 'button', '[^"]*m-history__full')[0]['aria-label'], 'Full history: temperature and target');
  assert.equal(button.disabled, undefined);
  assert.equal(tags(draw({...TEMPERATURE, full: {...TEMPERATURE.full, enabled: false}}), 'button', '[^"]*m-history__full')[0].disabled, '');
});

test('a scrub finds the nearest recorded time, marks what lies between samples, and shows that time in the header', () => {
  const rows = [0, 10, 20, 40].map(timestamp => ({timestamp}));
  assert.deepEqual([-5, 0, 4, 5, 6, 29, 30, 31, 99].map(t => nearestRow(rows, t)), [0, 0, 0, 0, 1, 2, 2, 3, 3], 'the earlier on a tie');
  assert.equal(nearestRow([], 5), -1);
  const {model} = TEMPERATURE, layout = plotLayout(model, BOXES.bottom);
  assert.equal(layout.timeAt(layout.area.left - 30), model.start, 'clamped at the start');
  assert.equal(layout.timeAt(layout.area.right + 30), model.end, 'and at Now');
  assert.equal(layout.timeAt(layout.xOf(DAY_START + 6 * HOUR)), DAY_START + 6 * HOUR);
  // 08:00: the target has just stepped up; the reading lies between two samples.
  const at = DAY_START + 22.5 * HOUR, row = model.rows[nearestRow(model.rows, at + 4 * 60000)];
  assert.equal(row.timestamp, at);
  assert.deepEqual(legendAt(model, row), [`${model.interpolatedMark}19.7°`, '21°']);
  const html = draw(TEMPERATURE, {scrubAt: at});
  assert.match(html, /<p class="m-history__subtitle">Wed 14 Oct, 08:00<\/p>/);
  assert.deepEqual([...html.matchAll(/<dd class="m-num">([^<]*)<\/dd>/g)].map(m => m[1]), ['~19.7°', '21°']);
  const [rule] = tags(html, 'line', 'm-history__rule'), x = Math.round(layout.xOf(at) * 10) / 10;
  assert.equal(Number(rule.x1), x);
  const marks = tags(html, 'circle', 'm-history__point');
  assert.equal(marks.length, 2, 'a point on each series');
  for (const mark of marks) assert.equal(Number(mark.cx), x);
  // Unscrubbed: the latest values, the subtitle, and no rule.
  const still = draw(TEMPERATURE);
  assert.match(still, new RegExp(`<p class="m-history__subtitle">${model.subtitle}</p>`));
  assert.deepEqual([...still.matchAll(/<dd class="m-num">([^<]*)<\/dd>/g)].map(m => m[1]), ['19.8°', '21°']);
  assert.equal(count(still, /m-history__rule|m-history__point/g), 0);
});

// Markup drawn as if the viewport were at least 700px wide.
function wideViewport(render) {
  const media = globalThis.matchMedia;
  globalThis.matchMedia = () => ({matches: true});
  try { return render(); } finally { globalThis.matchMedia = media; }
}

test('the chart takes its sheet’s box: the bottom sheet’s or the centred form sheet’s, and outside a sheet the viewport’s', () => {
  const placed = placement => h(SheetPlacementContext.Provider, {value: placement}, h(HistoryChart, {value: TEMPERATURE}));
  const box = html => [html.match(/<section class="m-history" data-box="(\w+)">/)[1], tags(html, 'svg', 'm-history__svg')[0].viewBox];
  assert.deepEqual(box(renderToStaticMarkup(placed('center'))), ['center', '0 0 592 216']);
  // A bottom sheet on a wide screen (the gallery's pages view) keeps the phone's box.
  assert.deepEqual(wideViewport(() => box(renderToStaticMarkup(placed('bottom')))), ['bottom', '0 0 343 164']);
  assert.deepEqual(box(draw(TEMPERATURE)), ['bottom', '0 0 343 164']);
  assert.deepEqual(wideViewport(() => box(draw(TEMPERATURE))), ['center', '0 0 592 216']);
  // The hook itself.
  const Probe = () => h('i', null, useSheetPlacement());
  assert.equal(renderToStaticMarkup(h(Probe)), '<i>bottom</i>');
  assert.equal(wideViewport(() => renderToStaticMarkup(h(Probe))), '<i>center</i>');
  assert.equal(wideViewport(() => renderToStaticMarkup(h(SheetPlacementContext.Provider, {value: 'bottom'}, h(Probe)))), '<i>bottom</i>');
  assert.deepEqual(Object.fromEntries(Object.entries(BOXES).map(([key, {width, height}]) => [key, [width, height]])), {bottom: [343, 164], center: [592, 216]});
});

test('a finger scrubs only from its first mostly sideways move of 6 px, so a tap or a scroll never does', () => {
  assert.equal(SCRUB_SLOP, 6);
  // [dx, dy] since the finger came down.
  const moves = [[0, 0], [5, 0], [-5.9, 1], [6, 0], [-6, 2], [12, 11.9], [8, 8], [3, 20], [0, -40], [-30, 29]];
  assert.deepEqual(moves.map(([dx, dy]) => startsScrub(dx, dy)), [false, false, false, true, true, true, false, false, false, true]);
});

test('the legend writes a reading as the page does: 19.8° and 45%, a target 21°, other units as before', () => {
  const page = screen(climateSnapshot('house_running', {detail: 'attic'})), attic = page.page.zones.find(zone => zone.id === 'attic');
  const legend = value => [...draw(value).matchAll(/<dd class="m-num">([^<]*)<\/dd>/g)].map(m => m[1]);
  assert.equal(attic.reading.reading, '19.8°');
  assert.deepEqual(legend(TEMPERATURE), [attic.reading.reading, '21°'], 'the page’s reading, and the target as the page writes one');
  assert.equal(page.drawer.body.facts[0].text, '45%');
  assert.deepEqual(legend(HUMIDITY), [page.drawer.body.facts[0].text]);
  assert.deepEqual(latestValues(TEMPERATURE.model), ['19.8°', '21°']);
  // Each unit: a reading to a tenth, a target to a tenth at most, a
  // percentage whole; anything else, and no value, as history.js writes it.
  assert.deepEqual([[20, '°C'], [19.649, '°C'], [-3.46, '°C'], [48.4, '%'], [47.5, '%'], [1234.5, 'W'], [0.37, '']].map(([value, unit]) => formatReading(value, unit)),
    ['20.0°', '19.6°', '-3.5°', '48%', '48%', '1,234.5 W', '0.37']);
  assert.deepEqual([21, 21.5, 20.25].map(value => formatReading(value, '°C', 'target')), ['21°', '21.5°', '20.3°']);
  assert.deepEqual([null, NaN].map(value => formatReading(value, '°C')), ['Unavailable', 'Unavailable']);
});

test('the plot never widens its container, and a vertical swipe on it is the sheet’s', () => {
  assert.match(rule('.m-history'), /min-width:0;max-width:100%/);
  assert.equal(rule('.m-history__svg'), 'display:block;width:100%;height:auto;max-width:100%');
  const plot = rule('.m-history__plot');
  for (const part of ['min-width:0', 'max-width:100%', 'touch-action:pan-y', 'user-select:none', '-webkit-touch-callout:none']) assert.ok(plot.includes(part), part);
  // Scaled uniformly: no preserveAspectRatio, and the box as the viewBox.
  assert.doesNotMatch(draw(TEMPERATURE), /preserveAspectRatio/);
});

// Climate's charts as v32 drew them, before v33 touched the chart: the
// Attic's temperature SVG as it was, and a digest of each chart's whole
// markup (the Attic's two charts, the towel rails', scrubbed, partial,
// loading, error, empty, and the form sheet's). A change here is a change to
// Climate's sheets and their images.
const V32_TEMPERATURE_SVG = [
  '<svg class="m-history__svg" role="img" aria-label="Temperature and target over the last 24 hours" aria-describedby="_R_0H1_" viewBox="0 0 343 164">',
  '<defs><linearGradient id="_R_0_" gradientUnits="userSpaceOnUse" x1="0" y1="142" x2="0" y2="8">',
  '<stop class="m-history__stop" offset="0" style="--m-history-room:rgb(90,200,250)"></stop><stop class="m-history__stop" offset="0.5" style="--m-history-room:rgb(125,216,200)"></stop>',
  '<stop class="m-history__stop" offset="0.8333" style="--m-history-room:rgb(255,214,10)"></stop><stop class="m-history__stop" offset="1" style="--m-history-room:rgb(255,187,10)"></stop></linearGradient></defs>',
  '<g><line class="m-history__grid" x1="20" x2="336" y1="142" y2="142"></line><text class="m-history__axis" x="14" y="146" text-anchor="end">16</text></g>',
  '<g><line class="m-history__grid" x1="20" x2="336" y1="97.3" y2="97.3"></line><text class="m-history__axis" x="14" y="101.3" text-anchor="end">18</text></g>',
  '<g><line class="m-history__grid" x1="20" x2="336" y1="52.7" y2="52.7"></line><text class="m-history__axis" x="14" y="56.7" text-anchor="end">20</text></g>',
  '<g><line class="m-history__grid" x1="20" x2="336" y1="8" y2="8"></line><text class="m-history__axis" x="14" y="12" text-anchor="end">22</text></g>',
  '<g><line class="m-history__hour" x1="52.9" x2="52.9" y1="8" y2="142"></line><text class="m-history__axis" x="52.9" y="158" text-anchor="middle">12:00</text></g>',
  '<g><line class="m-history__hour" x1="131.9" x2="131.9" y1="8" y2="142"></line><text class="m-history__axis" x="131.9" y="158" text-anchor="middle">18:00</text></g>',
  '<g><line class="m-history__hour" x1="210.9" x2="210.9" y1="8" y2="142"></line><text class="m-history__axis" x="210.9" y="158" text-anchor="middle">00:00</text></g>',
  '<g><line class="m-history__hour" x1="289.9" x2="289.9" y1="8" y2="142"></line></g>',
  '<line class="m-history__now" x1="336" x2="336" y1="8" y2="142"></line><text class="m-history__axis" x="336" y="158" text-anchor="end">Now</text>',
  '<g class="m-history__series m-history__series--target"><polyline class="m-history__line" points="20,30.3 131.9,30.3 131.9,142 316.3,142 316.3,30.3 336,30.3"></polyline></g>',
  '<g class="m-history__series m-history__series--room"><polyline class="m-history__halo" points="20,115.2 72.7,128.6"></polyline>',
  '<polyline class="m-history__halo" points="283.3,72.8 309.7,61.6 316.3,60.5 336,57.1"></polyline>',
  '<polyline class="m-history__line" points="20,115.2 72.7,128.6" style="stroke:url(#_R_0_)"></polyline>',
  '<polyline class="m-history__line" points="283.3,72.8 309.7,61.6 316.3,60.5 336,57.1" style="stroke:url(#_R_0_)"></polyline>',
  '<circle class="m-history__dot" cx="178" cy="133.1" r="3" style="--m-history-room:rgb(95,202,243)"></circle></g></svg>',
].join('');
const V32_DIGESTS = {temperature: '06faba98d4685d54', humidity: '92576bcd682ab19a', rails: 'e80e0c6c3e4c1770', scrubbed: '1dd0a22fb31e5bb5', partial: '313c433841ff67bb',
  loading: 'fa81fe523779e160', error: '497d9f1d72620504', empty: '9537144495a42e5a', center: '5ada0fa1ecccd71f'};

test('Climate’s charts draw exactly as in v32', () => {
  const inSheet = (value, props = {}, placement = 'bottom') => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}},
    h(SheetPlacementContext.Provider, {value: placement}, h(HistoryChart, {value, ...props}))));
  const recorded = climateSnapshot().loaded.history['climate-attic'].data, rails = screen(climateSheetSnapshot('sheet-rails')).drawer.body.charts[0];
  const markup = {
    temperature: inSheet(TEMPERATURE), humidity: inSheet(HUMIDITY), rails: inSheet(rails), scrubbed: inSheet(TEMPERATURE, {scrubAt: CLIMATE_NOW - 1.5 * HOUR}),
    partial: inSheet(attic({history: {...recorded, errors: REJECTED.history.errors}})[0]), loading: inSheet(attic(LOADING)[0]),
    error: inSheet(attic({history: REJECTED.history})[0]), empty: inSheet(attic(EMPTY)[0]), center: inSheet(TEMPERATURE, {}, 'center'),
  };
  assert.equal(markup.temperature.match(/<svg[\s\S]*<\/svg>/)[0], V32_TEMPERATURE_SVG);
  assert.deepEqual(Object.fromEntries(Object.entries(markup).map(([key, html]) => [key, createHash('sha256').update(html).digest('hex').slice(0, 16)])), V32_DIGESTS);
  assert.equal(draw(TEMPERATURE), markup.temperature, 'outside a sheet on a phone, the bottom sheet’s');
});
