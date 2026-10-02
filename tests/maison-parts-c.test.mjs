// Maison's Energy parts (#29 step 4, v33): the pair of register rings and
// the chip, as the markup they draw from energy.js's shapes (a RingPlot
// pair, a RegisterChip or a StateChip), the geometry the rings promise at
// each size, the styles that colour them, and the gallery's specimens of
// both in every state. Node has no JSX, so esbuild bundles the parts and
// the gallery's specimens with react-dom/server into a temporary module,
// and each test reads what a value renders to.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {ringStyles} from '../frontend/maison/src/ui/ring.css.js';
import {chipStyles} from '../frontend/maison/src/ui/chip.css.js';

const UI = fileURLToPath(new URL('../frontend/maison/src/ui/', import.meta.url));
const ENTRY = `export {Ring, RingPair} from './ring.jsx';
export {Chip} from './chip.jsx';
export {DetailSpecimens} from '../gallery/detail-specimens.jsx';
export {CommandContext} from '../contexts.js';
export {LayoutContext} from './layout.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The parts, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-parts-c-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: UI, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'parts.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'parts.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, Ring, RingPair, Chip, DetailSpecimens} = ui;

// Markup for an element, on a phone, with a command that goes nowhere.
const draw = element => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, h(LayoutContext.Provider, {value: 'phone'}, element)));
const count = (html, pattern) => (html.match(pattern) || []).length;
// An element's attributes by name, from its opening tag; every opening tag of a class.
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
const tags = (html, name, cls) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*class="${cls}"[^>]*>`, 'g'))].map(([tag]) => attributes(tag));
// Glyphs drawn as nothing, so markup reads short.
const bare = html => html.replace(/<svg class="icon[\s\S]*?<\/svg>/g, '');
// A rule's declarations, from a stylesheet written one rule per line.
function rule(css, selector) {
  const line = css.split('\n').find(text => text.startsWith(`${selector}{`));
  assert.ok(line, `${selector} is a rule`);
  return Object.fromEntries(line.slice(selector.length + 1, -1).split(/;(?![^(]*\))/).map(part => [part.slice(0, part.indexOf(':')), part.slice(part.indexOf(':') + 1)]));
}

// ---- The pair of rings ---------------------------------------------------

// A RingPlot as energy.js's year.rings has them, and a pair, peak outside.
const plot = (tone, share, state = share === null ? 'missing' : 'credit') => ({tone, share, state});
const pair = (peak, offPeak) => [plot('pink', ...peak), plot('indigo', ...offPeak)];
// Each ring's group, its circles' attributes, from a pair's markup.
const rings = html => [...html.matchAll(/<g class="([^"]*)">([\s\S]*?)<\/g>/g)].map(([, cls, inside]) => ({
  cls, track: tags(inside, 'circle', 'm-rings__track')[0], fill: tags(inside, 'circle', 'm-rings__fill')[0]}));
const SIZES = {small: {box: 80, stroke: 10, radii: [34, 21]}, medium: {box: 96, stroke: 12, radii: [41, 25]}, regular: {box: 136, stroke: 16, radii: [59, 38]}};
const arcOf = fill => Number(fill['stroke-dasharray'].split(' ')[0]);

test('a pair is one hidden picture with no role, its box its size, the peak ring outside and off-peak inside', () => {
  for (const [size, {box, stroke, radii}] of Object.entries(SIZES)) {
    const html = draw(h(RingPair, {plot: pair([0.358], [0.862]), size}));
    const [svg] = tags(html, 'svg', 'm-rings[^"]*');
    assert.deepEqual(svg, {class: `m-rings m-rings--${size}`, 'aria-hidden': 'true', viewBox: `0 0 ${box} ${box}`, width: String(box), height: String(box)}, size);
    assert.doesNotMatch(html, /role=|aria-label=|<text/, 'no role, no name, no centre label: the lines beside it say every figure');
    const [outer, inner] = rings(html);
    assert.deepEqual([outer.cls, inner.cls], ['m-rings__ring m-tone-pink', 'm-rings__ring m-tone-indigo']);
    for (const [ring, radius] of [[outer, radii[0]], [inner, radii[1]]]) {
      for (const circle of [ring.track, ring.fill]) assert.deepEqual([circle.cx, circle.cy, circle.r, circle['stroke-width']].map(Number), [box / 2, box / 2, radius, stroke]);
    }
  }
  assert.match(draw(h(RingPair, {plot: pair([0.5], [0.5]), size: 'huge'})), /^<svg class="m-rings m-rings--regular" aria-hidden="true" viewBox="0 0 136 136"/, 'an unknown size is regular');
  assert.match(draw(h(RingPair, {plot: pair([0.5], [0.5])})), /class="m-rings m-rings--regular"/, 'regular by default');
  assert.equal(rings(draw(h(RingPair, {plot: [...pair([0.5], [0.5]), plot('pink', 0.2)], size: 'small'}))).length, 2, 'two rings, whatever the plot holds');
});

test('the rings read as two: the outer one inside its box, a clear gap between them, and a hole in the middle', () => {
  for (const [size, {box, stroke, radii: [outer, inner]}] of Object.entries(SIZES)) {
    const margin = box / 2 - (outer + stroke / 2), gap = (outer - stroke / 2) - (inner + stroke / 2), hole = inner - stroke / 2;
    assert.ok(margin >= 1, `${size}: the outer edge ${margin}px inside the box`);
    assert.ok(gap >= 3 && gap <= stroke / 2, `${size}: a ${gap}px gap, clear but less than half a stroke`);
    assert.ok(hole >= stroke, `${size}: a hole ${hole * 2}px across, so the pair is rings, not a disc`);
  }
});

test('each ring fills to its share from twelve o’clock, clamped; billing is the whole ring whatever its share', () => {
  for (const [size, {radii}] of Object.entries(SIZES)) {
    const [outerLength, innerLength] = radii.map(r => 2 * Math.PI * r);
    const [outer, inner] = rings(draw(h(RingPair, {plot: pair([0.358], [0.862]), size})));
    for (const [ring, length, share] of [[outer, outerLength, 0.358], [inner, innerLength, 0.862]]) {
      const [arc, rest] = ring.fill['stroke-dasharray'].split(' ').map(Number);
      assert.ok(Math.abs(arc - length * share) < 1e-2, `${size}: ${share} of the circle`);
      assert.ok(Math.abs(arc + rest - length) < 1e-2, 'the pattern is the circle');
      // A circle's outline starts at three o'clock: offset a quarter round, the arc starts at twelve, with no rotation.
      assert.ok(Math.abs(Number(ring.fill['stroke-dashoffset']) - length / 4) < 1e-2, 'from twelve o’clock');
      assert.equal(ring.fill.transform, undefined);
      assert.equal(ring.track['stroke-dasharray'], undefined, 'the tone’s full track, solid');
    }
    const [billing, full] = rings(draw(h(RingPair, {plot: [plot('pink', 0.4, 'billing'), plot('indigo', 1, 'billing')], size})));
    assert.ok(Math.abs(arcOf(billing.fill) - outerLength) < 1e-2, `${size}: billing fills the ring, whatever its share says`);
    assert.ok(Math.abs(arcOf(full.fill) - innerLength) < 1e-2);
    assert.doesNotMatch(billing.cls, /--empty/);
    const [over, under] = rings(draw(h(RingPair, {plot: pair([1.3], [-0.2]), size})));
    assert.ok(Math.abs(arcOf(over.fill) - outerLength) < 1e-2, 'clamped at the whole ring');
    assert.equal(arcOf(under.fill), 0, 'and at its start cap');
    const [zero] = rings(draw(h(RingPair, {plot: pair([0], [0.5]), size})));
    assert.equal(arcOf(zero.fill), 0, 'a share of 0 is the start cap alone, never the dashed track');
    assert.doesNotMatch(zero.cls, /--empty/);
  }
});

test('a missing register is a thin dashed track with nothing filled, the other ring drawn as it is', () => {
  for (const [size, {radii}] of Object.entries(SIZES)) {
    const [outer, inner] = rings(draw(h(RingPair, {plot: pair([null], [0.6]), size})));
    assert.equal(outer.cls, 'm-rings__ring m-tone-pink m-rings__ring--empty');
    assert.equal(outer.fill, undefined, 'nothing filled');
    assert.equal(outer.track['stroke-width'], undefined, 'the stylesheet draws it thin');
    const [dash, gap] = outer.track['stroke-dasharray'].split(' ').map(Number), length = 2 * Math.PI * radii[0];
    assert.equal(dash, gap);
    assert.ok(Math.abs(length / (2 * dash) - Math.round(length / (2 * dash))) < 0.01, `${size}: the dashes divide the circle evenly`);
    assert.equal(inner.cls, 'm-rings__ring m-tone-indigo');
    assert.ok(Math.abs(arcOf(inner.fill) - 2 * Math.PI * radii[1] * 0.6) < 1e-2);
    const none = draw(h(RingPair, {plot: pair([null], [null]), size}));
    assert.equal(count(none, /m-rings__ring--empty/g), 2);
    assert.equal(count(none, /m-rings__fill/g), 0);
  }
  // Missing wins over a share, and a share that isn't a number is missing.
  for (const odd of [plot('pink', 0.5, 'missing'), plot('pink', undefined, 'credit'), plot('pink', Number.NaN, 'credit'), plot('pink', '0.5', 'credit')]) {
    assert.match(rings(draw(h(RingPair, {plot: [odd, plot('indigo', 0.5)]})))[0].cls, /m-rings__ring--empty/, JSON.stringify(odd));
  }
});

test('the pair is coloured ring by ring: pink and indigo from their tokens, tracks at 22% (indigo’s 35% in dark), a missing track dashed in --m-label-3', () => {
  assert.deepEqual(rule(ringStyles, '.m-rings'), {display: 'block', flex: 'none', overflow: 'visible'});
  assert.deepEqual(rule(ringStyles, '.m-rings__ring.m-tone-pink'), {'--m-tone': 'var(--m-pink)'});
  assert.deepEqual(rule(ringStyles, '.m-rings__ring.m-tone-indigo'), {'--m-tone': 'var(--m-indigo)'});
  assert.deepEqual(ringStyles.split('\n').filter(line => line.startsWith('.m-rings__ring.m-tone-')).map(line => line.match(/m-tone-(\w+)/)[1]), ['pink', 'indigo'],
    'the registers’ two tones only');
  assert.deepEqual(rule(ringStyles, '.m-rings__track'), {fill: 'none', stroke: 'color-mix(in srgb,var(--m-tone) var(--m-rings-track,22%),transparent)'}, 'as the concept’s rings, .22');
  // In dark, indigo at 22% sinks into the card: its track alone is raised, only while the host is dark.
  assert.deepEqual(rule(ringStyles, ':host([dark]) .m-rings__ring.m-tone-indigo'), {'--m-rings-track': '35%'});
  assert.equal(ringStyles.split('\n').filter(line => line.includes('--m-rings-track:')).length, 1, 'pink and light keep 22%');
  assert.deepEqual(rule(ringStyles, '.m-rings__fill'), {fill: 'none', stroke: 'var(--m-tone)', 'stroke-linecap': 'round'});
  assert.deepEqual(rule(ringStyles, '.m-rings__ring--empty .m-rings__track'), {stroke: 'var(--m-label-3)', 'stroke-width': '2px', 'stroke-linecap': 'butt'});
  assert.match(ringStyles, /@supports not \(color:color-mix\(in srgb,currentColor 20%,transparent\)\)\{\.m-rings__track\.m-rings__track\{stroke:var\(--m-fill-gray\)\}\}/);
  // The empty track follows the fallback, so it stays dashed without color-mix().
  assert.ok(ringStyles.indexOf('.m-rings__ring--empty .m-rings__track{') > ringStyles.indexOf('.m-rings__track.m-rings__track{'));
});

test('the single ring draws as it did on main, its track and arc from the geometry the pair shares', () => {
  const html = draw(h(Ring, {value: 62, tone: 'green', label: '62%', ariaLabel: 'Battery 62%'}));
  assert.equal(html, '<svg class="m-ring m-ring--regular m-tone-green" role="img" aria-label="Battery 62%" viewBox="0 0 136 136" width="136" height="136">'
    + '<circle class="m-ring__track" cx="68" cy="68" r="52" stroke-width="12"></circle>'
    + '<circle class="m-ring__fill" cx="68" cy="68" r="52" stroke-width="12" stroke-dasharray="202.57 124.156" stroke-dashoffset="81.681"></circle>'
    + '<text class="m-ring__label" x="68" y="68" text-anchor="middle" dominant-baseline="central" aria-hidden="true">62%</text></svg>');
  assert.equal(draw(h(Ring, {value: null, ariaLabel: 'Battery unknown', size: 'small'})),
    '<svg class="m-ring m-ring--small m-tone-green m-ring--empty" role="img" aria-label="Battery unknown" viewBox="0 0 80 80" width="80" height="80">'
    + '<circle class="m-ring__track" cx="40" cy="40" r="31" stroke-dasharray="4.058 4.058"></circle></svg>');
});

// ---- The chip ------------------------------------------------------------

test('a chip is a span of its tone holding its glyph, when it has one, then its label; nothing presses it or names it', () => {
  const html = draw(h(Chip, {chip: {label: 'Peak register', tone: 'pink', icon: 'sun'}}));
  assert.match(html, /^<span class="m-chip m-tone-pink"><span class="m-glyph m-chip__glyph" aria-hidden="true"><svg class="icon [^"]*" data-icon="[^"]+"/);
  assert.equal(bare(html), '<span class="m-chip m-tone-pink"><span class="m-glyph m-chip__glyph" aria-hidden="true"></span><span class="m-chip__label">Peak register</span></span>');
  assert.match(draw(h(Chip, {chip: {label: 'Off-peak register', tone: 'indigo', icon: 'moon'}})), /^<span class="m-chip m-tone-indigo"><span class="m-glyph m-chip__glyph" aria-hidden="true"><svg /);
  for (const icon of [undefined, null, '']) {
    assert.equal(draw(h(Chip, {chip: {label: 'Fully covered', tone: 'green', icon}})), '<span class="m-chip m-tone-green"><span class="m-chip__label">Fully covered</span></span>', `icon ${icon}: no glyph`);
  }
  assert.equal(draw(h(Chip, {chip: {label: 'Billing', tone: 'gray'}})), '<span class="m-chip m-tone-gray"><span class="m-chip__label">Billing</span></span>');
  assert.doesNotMatch(html, /role=|aria-label=|<button/);
  // A legacy name maps as a list tile's does; blue, which presses, is gray.
  assert.match(draw(h(Chip, {chip: {label: 'x', tone: 'amber'}})), /class="m-chip m-tone-orange"/);
  assert.match(draw(h(Chip, {chip: {label: 'x', tone: 'blue'}})), /class="m-chip m-tone-gray"/);
});

test('a chip is a capsule 24px high in footnote-strong, the tone at 16% behind words in its text colour, never wrapping', () => {
  assert.deepEqual(rule(chipStyles, '.m-chip'), {display: 'inline-flex', 'align-items': 'center', gap: '4px', 'box-sizing': 'border-box', flex: 'none', 'max-width': '100%',
    height: '24px', padding: '0 10px', 'border-radius': 'var(--m-radius-capsule)', background: 'color-mix(in srgb,var(--m-tone) 16%,transparent)',
    color: 'var(--m-tone)', font: 'var(--m-type-footnote-strong)', 'white-space': 'nowrap'});
  assert.deepEqual(rule(chipStyles, '.m-chip:has(>.m-chip__glyph)'), {'padding-inline-start': '8px'}, 'a glyph sits a little nearer the end');
  // Pink has no text token: tinted toward the label, as a list tile's glyph is.
  const colours = {pink: 'color-mix(in srgb,var(--m-pink) 80%,var(--m-label))', indigo: 'var(--m-indigo-text)', green: 'var(--m-green-text)', gray: 'var(--m-label-2)'};
  for (const [tone, color] of Object.entries(colours)) {
    assert.deepEqual(rule(chipStyles, `.m-chip.m-tone-${tone}`), {'--m-tone': `var(--m-${tone})`, color}, tone);
  }
  assert.deepEqual(rule(chipStyles, '.m-chip__glyph'), {flex: 'none', width: '14px', height: '14px'});
  assert.deepEqual(rule(chipStyles, '.m-chip__label'), {'min-width': '0', overflow: 'hidden', 'text-overflow': 'ellipsis'}, 'a long label is cut short');
  assert.match(chipStyles, /@supports not \(color:color-mix\(in srgb,currentColor 20%,transparent\)\)\{\.m-chip\.m-chip\{background:var\(--m-fill-gray\)\}\.m-chip\.m-tone-pink\.m-tone-pink\{color:var\(--m-pink\)\}\}/);
});

// ---- Scoping -------------------------------------------------------------

test('the pair’s and the chip’s styles keep Maison’s rules: scoped selectors, type and colour from tokens only', () => {
  for (const [name, css] of [['ring.css.js', ringStyles], ['chip.css.js', chipStyles]]) {
    const lines = css.split('\n').filter(Boolean);
    for (const line of lines) {
      // Every selector, inside an @supports block too, is one of Maison's classes or its host.
      const blocks = line.startsWith('@supports') ? [...line.matchAll(/\{([^{}]+)\{[^{}]*\}/g)].map(([, selector]) => selector) : [line.slice(0, line.indexOf('{'))];
      for (const selector of blocks.flatMap(block => block.split(','))) assert.match(selector, /^(?:\.m-|:host\b)/, `${name}: ${selector}`);
    }
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${name}: no colour literal`);
    assert.doesNotMatch(css, /font-size|font-weight|line-height/, `${name}: type is set by a token`);
    for (const [, value] of css.matchAll(/[{;]font:([^;}]+)/g)) assert.match(value, /^var\(--m-type-[\w-]+\)$/, `${name}: ${value}`);
    assert.doesNotMatch(css, /--m-type-(caption|display)/, `${name}: caption and display are the charts’`);
    assert.doesNotMatch(css, /transform|filter|contain|container-type|will-change|perspective/, `${name}: nothing gives the tab bar a containing block`);
  }
});

// ---- The gallery's specimens ---------------------------------------------

test('the gallery shows the pair in every state at every size, and the chip in the four tones with a glyph and without', () => {
  const html = draw(h(DetailSpecimens));
  for (const size of ['small', 'medium', 'regular']) {
    const svgs = [...html.matchAll(new RegExp(`<svg class="m-rings m-rings--${size}"[\\s\\S]*?</svg>`, 'g'))].map(([svg]) => rings(svg));
    assert.equal(svgs.length, 5, `${size}: credit/credit, credit/billing, billing/billing, missing/credit and all missing`);
    const states = svgs.map(pairOf => pairOf.map(({fill}) => !fill ? 'missing' : Math.abs(Number(fill['stroke-dasharray'].split(' ')[1])) < 1e-2 ? 'full' : 'part'));
    assert.deepEqual(states, [['part', 'part'], ['part', 'full'], ['full', 'full'], ['missing', 'part'], ['missing', 'missing']], size);
  }
  assert.doesNotMatch(html.match(/<svg class="m-rings[\s\S]*?<\/svg>/g).join(''), /role=/, 'no ring is an image');
  for (const size of ['medium', 'small']) assert.match(html, new RegExp(`<div class="m-card m-gallery-details__panel"><div class="m-gallery-details__pairs m-gallery-details__pairs--${size}">`), `${size} on a card`);
  assert.match(html, /<div class="m-sheet m-gallery-details__sheet"><div class="m-gallery-details__pairs m-gallery-details__pairs--regular">/, 'regular on a sheet');
  const chips = [...bare(html).matchAll(/<span class="m-chip m-tone-(\w+)">(<span class="m-glyph m-chip__glyph")?/g)].map(([, tone, glyph]) => `${tone}${glyph ? '+glyph' : ''}`);
  const set = ['pink+glyph', 'indigo+glyph', 'green+glyph', 'gray+glyph', 'pink', 'indigo', 'green', 'gray'];
  assert.deepEqual(chips, [...set, ...set], 'on a card, then on a sheet');
});
