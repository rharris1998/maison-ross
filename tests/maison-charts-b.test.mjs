// Maison's Climate and Energy header charts (#29 step 3): the zone
// capsules and the flows, from the values the dashboard draws for the hero
// variants. Node has no JSX, so esbuild bundles the charts with
// react-dom/server into a temporary module (as
// tests/maison-controls-b.test.mjs does), and each test reads the
// markup a real value renders to: the role and accessible name, a capsule per
// zone, a tick only where there is a target, an unavailable zone drawn apart
// from a cold one, each link by its source, solar asleep apart from
// unavailable, and ids that two charts never share. scale.js is pure and
// imported directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {heroSnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {TEMP_SCALE} from '../frontend/maison/src/ui/tokens.js';
import {tempColour} from '../frontend/maison/src/charts/scale.js';
import {zonesChartStyles} from '../frontend/maison/src/charts/zones.css.js';
import {flowsChartStyles} from '../frontend/maison/src/charts/flows.css.js';

const CHARTS = fileURLToPath(new URL('../frontend/maison/src/charts/', import.meta.url));
const ENTRY = `export {ZonesChart} from './zones.jsx';
export {FlowsChart, FlowsReading} from './flows.jsx';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The charts, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-charts-b-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: CHARTS, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'charts.mjs'), bundle.outputFiles[0].text);
const {h, renderToStaticMarkup, ZonesChart, FlowsChart, FlowsReading} = await import(pathToFileURL(join(folder, 'charts.mjs')));
rmSync(folder, {recursive: true, force: true});

// A hero variant's value (chrome.hero), its chart's markup, and helpers to
// read it: counts, one element's attributes, the text of every element of a
// class, and each capsule's or node's own markup.
const hero = (page, variant) => screen(heroSnapshot(page, variant)).chrome.hero;
const draw = (Chart, value, layout = 'phone', phase = 'night') => renderToStaticMarkup(h(Chart, {value, phase, layout}));
const count = (html, pattern) => (html.match(pattern) || []).length;
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const texts = (html, cls) => [...html.matchAll(new RegExp(`<text class="${cls}"[^>]*>([^<]*)</text>`, 'g'))].map(m => m[1]);
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const groups = (html, cls) => html.split(new RegExp(`(?=<g class="${cls}[ "])`)).slice(1);
const hex = value => `rgb(${[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)).join(',')})`;
// A stylesheet's rule for exactly `selector`, as its declarations.
const rule = (css, selector) => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`))?.[1] ?? '';

test('tempColour lands on each TEMP_SCALE stop, mixes between them and clamps at the ends', () => {
  for (const [at, colour] of TEMP_SCALE) assert.equal(tempColour(at), hex(colour), `${at}°`);
  assert.equal(tempColour(20), 'rgb(190,215,105)', 'halfway from 19° to 21°');
  assert.equal(tempColour(17), 'rgb(102,205,233)', 'a third of the way from 16° to 19°');
  const [cold, hot] = [hex(TEMP_SCALE[0][1]), hex(TEMP_SCALE.at(-1)[1])];
  for (const t of [15.9, 0, -20, -Infinity]) assert.equal(tempColour(t), cold, String(t));
  for (const t of [26.6, 40, Infinity]) assert.equal(tempColour(t), hot, String(t));
  for (const t of [null, undefined, NaN, '20']) assert.equal(tempColour(t), cold, `${t} is not a reading`);
  for (let t = 14; t <= 28; t += .1) assert.match(tempColour(t), /^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/);
});

test('the zones are one img named by the value, a capsule per zone in order, with the value’s words only, aria-hidden', () => {
  const value = hero('climate', 'running'), html = draw(ZonesChart, value);
  assert.match(html, new RegExp(`^<svg class="m-zones" viewBox="0 0 328 190" role="img" aria-label="${escape(value.ariaLabel)}" style="max-width:328px">`));
  assert.equal(count(html, /<g class="m-zones__capsule[ "]/g), value.zones.length);
  assert.deepEqual(texts(html, 'm-zones__reading'), value.zones.map(zone => zone.reading));
  assert.deepEqual(texts(html, 'm-zones__name'), value.zones.map(zone => zone.name));
  assert.equal(count(html, /<text /g), count(html, /<text [^>]*aria-hidden="true"/g), 'every visible word is hidden from the img');
  // Five fit a 360px phone at 1:1: the names' centres at least 60 units apart and 30 in from the ends.
  const xs = [...html.matchAll(/<text class="m-zones__name" x="([\d.]+)"/g)].map(m => Number(m[1]));
  xs.slice(1).forEach((x, i) => assert.ok(x - xs[i] >= 60, `${x} after ${xs[i]}`));
  assert.ok(xs[0] >= 30 && xs.at(-1) <= 328 - 30, xs.join());
  // Never drawn wider than its box, so a unit is a pixel on every phone; wider
  // layouts widen the box (the chart's 470px) rather than scale the text up.
  for (const layout of ['wide', 'desktop']) assert.match(draw(ZonesChart, value, layout), /^<svg class="m-zones" viewBox="0 0 470 226" role="img" aria-label="[^"]*" style="max-width:470px">/);
  assert.equal(rule(zonesChartStyles, '.m-zones'), 'display:block;width:100%;height:auto;margin-inline:auto;overflow:visible');
  // 15 semibold figures over 13 names in the secondary label.
  assert.equal(rule(zonesChartStyles, '.m-zones__reading'), 'font:var(--m-type-subhead-strong);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;fill:var(--m-label)');
  assert.equal(rule(zonesChartStyles, '.m-zones__name'), 'font:var(--m-type-footnote);fill:var(--m-label-2)');
});

test('each capsule fills from 17° to its reading’s colour, up to the reading on the clamped scale', () => {
  const value = hero('climate', 'running'), html = draw(ZonesChart, value), capsules = groups(html, 'm-zones__capsule');
  value.zones.forEach((zone, i) => {
    assert.deepEqual([...capsules[i].matchAll(/<stop offset="[01]" style="stop-color:([^"]+)"/g)].map(m => m[1]), [tempColour(17), tempColour(zone.plot.reading)], zone.name);
    const fill = attrs(capsules[i].match(/<rect class="m-zones__fill"[^>]*>/)[0]);
    assert.equal(Number(fill.y), Math.round((160 - (zone.plot.reading - value.min) / (value.max - value.min) * 126) * 10) / 10, zone.name);
    assert.match(fill['clip-path'], /^url\(#.+-clip\)$/);
    assert.match(fill.fill, /^url\(#.+-fill\)$/);
  });
  // Out of the scale: the top at the capsule's top, and a sliver at its foot.
  const edges = draw(ZonesChart, {...value, zones: [{...value.zones[0], plot: {reading: 31, target: 35}}, {...value.zones[1], plot: {reading: 9, target: 5}}]});
  assert.deepEqual([...edges.matchAll(/<rect class="m-zones__fill" x="[\d.]+" y="([\d.]+)"/g)].map(m => Number(m[1])), [34, 154]);
  assert.deepEqual([...edges.matchAll(/<path class="m-zones__tick" d="M[\d.]+ ([\d.]+)H/g)].map(m => Number(m[1])), [34, 160]);
});

test('a tick marks each target, and none where the target is null: the house alone while its heating is off', () => {
  const running = draw(ZonesChart, hero('climate', 'running'));
  assert.equal(count(running, /class="m-zones__tick"/g), 5);
  const off = hero('climate', 'heating-off'), html = draw(ZonesChart, off), capsules = groups(html, 'm-zones__capsule');
  assert.equal(off.zones[0].id, 'house');
  assert.equal(off.zones[0].plot.target, null);
  assert.deepEqual(capsules.map(capsule => count(capsule, /class="m-zones__tick"/g)), off.zones.map(zone => zone.plot.target === null ? 0 : 1));
  assert.deepEqual(capsules.map(capsule => count(capsule, /class="m-zones__tick"/g)), [0, 1, 1, 1, 1]);
  const tick = rule(zonesChartStyles, '.m-zones__tick');
  for (const part of ['stroke:var(--m-target-tick)', 'stroke-width:2.5', 'stroke-linecap:round']) assert.ok(tick.includes(part), part);
  // It crosses the capsule, a little wider than it.
  const [x1, x2] = capsules[1].match(/class="m-zones__tick" d="M([\d.]+) [\d.]+H([\d.]+)"/).slice(1).map(Number);
  const track = attrs(capsules[1].match(/<rect class="m-zones__track"[^>]*>/)[0]);
  assert.deepEqual([x1, x2], [Number(track.x) - 4, Number(track.x) + Number(track.width) + 4]);
});

test('an unavailable zone is a dashed empty outline under “—”, never a cold room', () => {
  const value = hero('climate', 'unavailable'), html = draw(ZonesChart, value);
  assert.equal(count(html, /<g class="m-zones__capsule m-zones__capsule--unavailable">/g), value.zones.length);
  assert.deepEqual(texts(html, 'm-zones__reading'), value.zones.map(() => '—'));
  assert.equal(count(html, /m-zones__fill|<linearGradient|<clipPath|m-zones__tick/g), 0, 'no fill, gradient or tick');
  const dashed = rule(zonesChartStyles, '.m-zones__capsule--unavailable .m-zones__track');
  for (const part of ['fill:none', 'stroke:var(--m-node-ring-idle)', 'stroke-dasharray:']) assert.ok(dashed.includes(part), part);
  // A room colder than the scale still has its track and a fill, and no dashes.
  const cold = draw(ZonesChart, {...value, zones: [{id: 'attic', name: 'Attic', reading: '9.0°', plot: {reading: 9, target: null}, ariaLabel: 'Attic: 9.0°'}]});
  assert.match(cold, /<g class="m-zones__capsule">/);
  assert.equal(count(cold, /class="m-zones__fill"/g), 1);
  assert.deepEqual(texts(cold, 'm-zones__reading'), ['9.0°']);
});

test('two charts on a page never share a gradient or clip id, and every reference resolves', () => {
  const value = hero('climate', 'running');
  const html = renderToStaticMarkup(h('div', null, h(ZonesChart, {value, phase: 'day', layout: 'phone'}), h(ZonesChart, {value, phase: 'day', layout: 'desktop'})));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, 2 * 2 * value.zones.length, 'a clip and a gradient per capsule');
  assert.equal(new Set(ids).size, ids.length, ids.join(' '));
  for (const [, ref] of html.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), ref);
});

// Each link's class, in the value's order, and each node's state and tone.
const linkClasses = html => [...html.matchAll(/<g class="m-flows__link m-flows__link--(\w+)">/g)].map(m => m[1]);
const nodeClasses = html => Object.fromEntries([...html.matchAll(/<g class="m-flows__node m-flows__node--(\w+) m-flows__node--(\w+)">/g)]
  .map((m, i) => [['solar', 'grid', 'house', 'car'][i], `${m[1]} ${m[2]}`]));

test('the flows are one img named by the value, four nodes with the value’s words, aria-hidden', () => {
  const value = hero('energy', 'solar-charging'), html = draw(FlowsChart, value);
  assert.match(html, new RegExp(`^<svg class="m-flows" viewBox="0 0 320 196" role="img" aria-label="${escape(value.ariaLabel)}" style="max-width:320px">`));
  assert.equal(count(html, /<g class="m-flows__node /g), 4);
  assert.equal(count(html, /<circle class="m-flows__ring" [^>]*r="26"/g), 4);
  const order = ['solar', 'grid', 'house', 'car'];
  assert.deepEqual(texts(html, 'm-flows__value'), order.map(kind => value.nodes[kind].value));
  assert.deepEqual(texts(html, 'm-flows__name'), order.map(kind => value.nodes[kind].name));
  assert.deepEqual(texts(html, 'm-flows__name'), ['Solar', 'Export', 'House', 'Car']);
  assert.equal(count(html, /<text /g), count(html, /<text [^>]*aria-hidden="true"/g));
  // Icons are icons.js's paths inside the chart, in currentColor, not nested <svg>s.
  assert.equal(count(html, /<g class="m-flows__icon" transform="translate\([\d.]+ [\d.]+\) scale\([\d.]+\)">/g), 4);
  assert.equal(count(html, /<svg/g), 1);
  // The Car's node is named as the value names it: 'Charger' for another vehicle.
  const charger = {...value, nodes: {...value.nodes, car: {...value.nodes.car, name: 'Charger'}}};
  assert.deepEqual(texts(draw(FlowsChart, charger), 'm-flows__name'), ['Solar', 'Export', 'House', 'Charger']);
});

test('from 700px the flows draw larger nodes 150 apart at 1:1, centred on wide and at the column’s end on desktop, never scaled up', () => {
  const value = hero('energy', 'solar-charging');
  assert.match(draw(FlowsChart, value, 'phone'), /^<svg class="m-flows" viewBox="0 0 320 196" role="img" aria-label="[^"]*" style="max-width:320px">/, 'the phone keeps the concept’s box, at most 1:1');
  for (const [layout, classes] of [['wide', 'm-flows m-flows--large'], ['desktop', 'm-flows m-flows--large m-flows--end']]) {
    const html = draw(FlowsChart, value, layout), phone = draw(FlowsChart, value, 'phone');
    assert.match(html, new RegExp(`^<svg class="${classes}" viewBox="0 0 360 224" role="img" aria-label="${escape(value.ariaLabel)}" style="max-width:360px">`), layout);
    const rings = Object.fromEntries([...html.matchAll(/<g class="m-flows__node m-flows__node--\w+ m-flows__node--\w+"><circle class="m-flows__ring" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
      .map((m, i) => [['solar', 'grid', 'house', 'car'][i], m.slice(1).map(Number)]));
    const [[sx, sy], [gx, gy, r], [hx, hy], [cx, cy]] = [rings.solar, rings.grid, rings.house, rings.car];
    assert.ok(r >= 28 && r <= 30, `radius ${r}`);
    // The rings' outer edges (a 1.5 stroke) within a unit of the box's ends.
    assert.ok(gx - r - .75 >= 0 && gx - r - .75 < 1, `grid's edge at ${gx - r}`);
    assert.ok(cx + r + .75 <= 360 && cx + r + .75 > 359, `the Car's edge at ${cx + r}`);
    assert.deepEqual([hx - gx, cx - hx], [150, 150], 'the nodes 150 apart');
    assert.deepEqual([gy, cy, sx], [hy, hy, hx], 'grid, house and Car on one row, solar above the house');
    assert.ok(sy < hy);
    // The same words and link classes as the phone's.
    for (const cls of ['m-flows__value', 'm-flows__name']) assert.deepEqual(texts(html, cls), texts(phone, cls));
    assert.deepEqual(linkClasses(html), linkClasses(phone));
  }
  // Centred, or at the column's end (under the tools' edge) on desktop.
  assert.equal(rule(flowsChartStyles, '.m-flows'), 'display:block;width:100%;height:auto;margin-inline:auto;overflow:visible');
  assert.equal(rule(flowsChartStyles, '.m-flows--end'), 'margin-inline:auto 0');
  // 15 semibold figures over 13 names in the secondary label, at every layout.
  assert.equal(rule(flowsChartStyles, '.m-flows__value'), 'font:var(--m-type-subhead-strong);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;fill:var(--m-label)');
  assert.equal(rule(flowsChartStyles, '.m-flows__name'), 'font:var(--m-type-footnote);fill:var(--m-label-2)');
  assert.doesNotMatch(flowsChartStyles, /m-flows--large[^{]*\{/, 'no size of their own');
});

test('each link is classed by its source, or idle, and only active ones move, in the direction of flow', () => {
  const cases = {'night-grid': ['idle', 'grid', 'grid'], 'solar-charging': ['solar', 'export', 'solar'], unavailable: ['idle', 'idle', 'idle']};
  for (const [variant, expected] of Object.entries(cases)) {
    const value = hero('energy', variant), html = draw(FlowsChart, value);
    assert.deepEqual(value.plot.links.map(link => link.source ?? 'idle'), expected, `${variant}: the value`);
    assert.deepEqual(linkClasses(html), expected, variant);
    const active = expected.filter(source => source !== 'idle').length;
    assert.equal(count(html, /class="m-flows__dash"/g), active, `${variant}: dashes`);
    assert.equal(count(html, /class="m-flows__under"/g), active, `${variant}: underlays`);
    assert.ok(active <= 3);
  }
  // Import runs grid → house; export house → grid, so its dashes head for the grid.
  const d = variant => draw(FlowsChart, hero('energy', variant)).match(/<g class="m-flows__link m-flows__link--(?:grid|export)"><path class="m-flows__under" d="([^"]+)"/)[1];
  assert.equal(d('night-grid'), 'M85 118L129 118');
  assert.equal(d('solar-charging'), 'M129 118L85 118');
  // The colours are the tokens', by source. Still, an active link is its tone's
  // dashes on a neutral track, never a translucent tone; an idle one faint dots.
  for (const [selector, token] of [['.m-flows__link--solar,.m-flows__node--solar', 'm-yellow'], ['.m-flows__link--grid,.m-flows__node--grid', 'm-indigo-text'],
    ['.m-flows__link--export,.m-flows__node--export', 'm-green'], ['.m-flows__node--house', 'm-label']]) assert.equal(rule(flowsChartStyles, selector), `--m-flows-tone:var(--${token})`);
  assert.equal(rule(flowsChartStyles, '.m-flows__link--idle'), 'stroke:var(--m-link-idle);stroke-width:2;stroke-dasharray:0 5');
  assert.equal(rule(flowsChartStyles, '.m-flows__under'), 'stroke:var(--m-capsule-track)');
  assert.equal(rule(flowsChartStyles, '.m-flows__dash'), 'stroke-dasharray:3 7;animation:m-flows-dash 1.1s linear infinite');
  assert.doesNotMatch(flowsChartStyles, /stroke-opacity/);
  assert.match(flowsChartStyles, /@keyframes m-flows-dash\{to\{stroke-dashoffset:-10\}\}/);
  assert.match(flowsChartStyles, /@media \(prefers-reduced-motion:reduce\)\{\.m-flows__dash\{animation:none\}\}/);
});

test('each node is ringed in its source’s colour while active; the Car takes where its charge comes from', () => {
  assert.deepEqual(nodeClasses(draw(FlowsChart, hero('energy', 'night-grid'))), {solar: 'asleep solar', grid: 'active grid', house: 'active house', car: 'active grid'});
  assert.deepEqual(nodeClasses(draw(FlowsChart, hero('energy', 'solar-charging'))), {solar: 'active solar', grid: 'active export', house: 'active house', car: 'active solar'});
  const idle = hero('energy', 'solar-charging');
  const car = {...idle.nodes.car, value: '0 W', plot: {watts: 0, active: false, available: true, asleep: false}};
  const html = draw(FlowsChart, {...idle, nodes: {...idle.nodes, car}, plot: {links: idle.plot.links.map(link => link.to === 'car' ? {...link, source: null} : link)}});
  assert.equal(nodeClasses(html).car, 'idle grid');
  assert.deepEqual(texts(html, 'm-flows__value').at(-1), '0 W');
  // Only a real export draws the grid green: an idle meter a few watts below
  // zero, with no export link, is an idle grid, whatever the value names it.
  const quiet = {...idle.nodes.grid, name: 'Export', value: '−5 W', plot: {watts: -5, active: false, available: true, asleep: false}};
  const settled = draw(FlowsChart, {...idle, nodes: {...idle.nodes, grid: quiet}, plot: {links: idle.plot.links.map(link => link.from === 'grid' ? {...link, source: null} : link)}});
  assert.equal(nodeClasses(settled).grid, 'idle grid');
  assert.equal(linkClasses(settled)[1], 'idle');
  assert.equal(rule(flowsChartStyles, '.m-flows__ring'), 'fill:var(--m-node-fill-idle);stroke:var(--m-node-ring-idle);stroke-width:1.5');
  assert.equal(rule(flowsChartStyles, '.m-flows__node--active .m-flows__ring'), 'fill:var(--m-node-fill);stroke:var(--m-flows-tone)');
});

test('solar asleep at night dims its solid ring and icon, never its words; an unavailable node has a dashed ring; both read “—”', () => {
  const night = draw(FlowsChart, hero('energy', 'night-grid')), missing = draw(FlowsChart, hero('energy', 'unavailable'));
  assert.equal(nodeClasses(night).solar, 'asleep solar');
  assert.deepEqual(Object.values(nodeClasses(missing)).map(classes => classes.split(' ')[0]), ['unavailable', 'unavailable', 'unavailable', 'unavailable']);
  assert.equal(texts(night, 'm-flows__value')[0], '—');
  assert.deepEqual(texts(missing, 'm-flows__value'), ['—', '—', '—', '—']);
  assert.equal(count(missing, /\b0 W\b/g), 0, 'unavailable is never 0');
  // Dashed only when unavailable. Asleep dims its ring (solid) and icon only:
  // its value and name keep --m-label and --m-label-2, so they keep 4.5:1.
  assert.match(rule(flowsChartStyles, '.m-flows__node--unavailable .m-flows__ring'), /^stroke-dasharray:/);
  assert.equal(rule(flowsChartStyles, '.m-flows__node--asleep :is(.m-flows__ring,.m-flows__icon)'), 'opacity:.6');
  assert.doesNotMatch(flowsChartStyles, /m-flows__node--asleep[^{]*\{[^}]*dasharray/);
  const asleep = [...flowsChartStyles.matchAll(/(?:^|\n)([^{\n]*m-flows__node--asleep[^{]*)\{([^}]*)\}/g)];
  assert.ok(asleep.length >= 1);
  for (const [, selector, body] of asleep) {
    assert.doesNotMatch(selector, /m-flows__(?:value|name)/, selector);
    if (/opacity/.test(body)) assert.match(selector, /:is\(\.m-flows__ring,\.m-flows__icon\)$/, `${selector} dims only the ring and icon`);
  }
  assert.equal(rule(flowsChartStyles, '.m-flows__value').match(/fill:([^;]+)/)[1], 'var(--m-label)');
  assert.equal(rule(flowsChartStyles, '.m-flows__name').match(/fill:([^;]+)/)[1], 'var(--m-label-2)');
});

test('the price reads its figure large, then its unit and its line, all from the value', () => {
  const value = hero('energy', 'night-grid'), html = renderToStaticMarkup(h(FlowsReading, {value, phase: 'night', layout: 'desktop'}));
  assert.equal(html, `<div class="m-flows-reading"><p class="m-flows-reading__price"><span class="m-flows-reading__figure">${value.reading.figure}</span> `
    + `<span class="m-flows-reading__unit">${escape(value.reading.unit)}</span></p><p class="m-flows-reading__line">${escape(value.reading.line)}</p></div>`);
  assert.equal(rule(flowsChartStyles, '.m-flows-reading__figure'), 'font:var(--m-type-figure-large);font-variant-numeric:tabular-nums;color:var(--m-label)');
  assert.match(renderToStaticMarkup(h(FlowsReading, {value: hero('energy', 'unavailable'), phase: 'unknown', layout: 'desktop'})), /__figure">—<\/span>/);
});
