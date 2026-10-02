// Maison's parts (#29 step 4): the ring, the segmented bar and its legend,
// the glance chips, the figure and the quiet line, as the markup they draw
// from the shapes today.js hands them. Node has no JSX, so esbuild bundles
// the parts with react-dom/server into a temporary module, and each test
// reads what a value renders to: the named images, an unknown level against
// a level of 0, the legend's lines, the chips' names and the intents a
// CommandContext spy receives, and where a figure puts its label.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {SHARED, TEMP_SCALE} from '../frontend/maison/src/ui/tokens.js';
import {ringStyles} from '../frontend/maison/src/ui/ring.css.js';
import {segmentBarStyles} from '../frontend/maison/src/ui/segment-bar.css.js';
import {glanceStyles} from '../frontend/maison/src/ui/glance.css.js';

const UI = fileURLToPath(new URL('../frontend/maison/src/ui/', import.meta.url));
const ENTRY = `export {Ring} from './ring.jsx';
export {SegmentBar, Legend} from './segment-bar.jsx';
export {Figure} from './figure.jsx';
export {GlanceChips} from './glance.jsx';
export {QuietLine} from './quiet.jsx';
export {IntentButton} from './button.jsx';
export {CommandContext} from '../contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The parts, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-parts-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: UI, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'parts.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'parts.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, Ring, SegmentBar, Legend, Figure, GlanceChips, QuietLine, IntentButton} = ui;

// Markup for an element, with a command that records what it is sent.
const draw = (element, sent = []) => renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)}, element));
const count = (html, pattern) => (html.match(pattern) || []).length;
// An element's attributes by name, from its opening tag.
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
const tags = (html, name, cls) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*class="${cls}"[^>]*>`, 'g'))].map(([tag]) => attributes(tag));

const TICKS = [{at: 50, kind: 'reserve'}, {at: 80, kind: 'limit'}];
const NAME = 'Battery 62%, ready reserve 50%, charge limit 80%';

test('a ring is one image named by its ariaLabel, its box its size, its label hidden in the centre', () => {
  const html = draw(h(Ring, {value: 62, ticks: TICKS, tone: 'green', label: '62%', ariaLabel: NAME}));
  const [svg] = tags(html, 'svg', 'm-ring[^"]*');
  assert.deepEqual([svg.class, svg.role, svg['aria-label'], svg.viewBox, svg.width, svg.height], ['m-ring m-ring--regular m-tone-green', 'img', NAME, '0 0 136 136', '136', '136']);
  assert.match(html, /<text class="m-ring__label" x="68" y="68" text-anchor="middle" dominant-baseline="central" aria-hidden="true">62%<\/text>/);
  assert.equal(count(html, /<circle/g), 2, 'a track and an arc');
  assert.equal(count(html, /aria-label=/g), 1, 'nothing inside is named');

  const small = draw(h(Ring, {value: 62, ticks: TICKS, tone: 'gray', label: '62%', ariaLabel: NAME, size: 'small'}));
  assert.match(small, /^<svg class="m-ring m-ring--small m-tone-gray" role="img" aria-label="[^"]+" viewBox="0 0 80 80" width="80" height="80">/);
  assert.match(small, /<text class="m-ring__label" x="40" y="40"/);
  assert.match(draw(h(Ring, {value: 62, ariaLabel: NAME, size: 'huge'})), /class="m-ring m-ring--regular m-tone-green"[^>]*viewBox="0 0 136 136"/, 'an unknown size is regular');
  assert.doesNotMatch(draw(h(Ring, {value: 62, ariaLabel: NAME})), /<text/, 'no label, no text');
});

test('an unknown level is a dashed track with nothing filled; a level of 0 is the arc’s start cap, never the same', () => {
  const length = 2 * Math.PI * 52;
  const unknown = draw(h(Ring, {value: null, ticks: TICKS, tone: 'gray', label: '—', ariaLabel: 'Battery unknown'}));
  assert.match(unknown, /class="m-ring m-ring--regular m-tone-gray m-ring--empty"/);
  assert.equal(count(unknown, /m-ring__fill/g), 0, 'nothing filled');
  const [track] = tags(unknown, 'circle', 'm-ring__track');
  assert.equal(track['stroke-width'], undefined, 'the stylesheet draws it thin');
  const [dash, gap] = track['stroke-dasharray'].split(' ').map(Number);
  assert.equal(dash, gap);
  assert.ok(Math.abs(length / (2 * dash) - Math.round(length / (2 * dash))) < 0.01, 'the dashes divide the circle evenly');
  assert.equal(count(unknown, /m-ring__tick--/g), 2, 'the reserve and the limit are known without a level');
  assert.match(unknown, />—<\/text>/);
  for (const value of [undefined, Number.NaN, Infinity, '62']) assert.match(draw(h(Ring, {value, ariaLabel: 'x'})), /m-ring--empty/, String(value));

  const zero = draw(h(Ring, {value: 0, ticks: TICKS, tone: 'gray', label: '0%', ariaLabel: 'Battery 0%'}));
  assert.doesNotMatch(zero, /m-ring--empty/);
  const [zeroTrack] = tags(zero, 'circle', 'm-ring__track'), [arc] = tags(zero, 'circle', 'm-ring__fill');
  assert.deepEqual([zeroTrack['stroke-width'], zeroTrack['stroke-dasharray']], ['12', undefined], 'the tone’s full track, solid');
  // One dash in a pattern as long as the circle, which starts at three
  // o'clock: offset a quarter round, it starts at twelve, with no rotation.
  assert.equal(arc.transform, undefined);
  assert.equal(Number(arc['stroke-width']), 12);
  assert.ok(Math.abs(Number(arc['stroke-dashoffset']) - length / 4) < 1e-2, 'from twelve o’clock');
  const [cap, rest] = arc['stroke-dasharray'].split(' ').map(Number);
  assert.equal(cap, 0, 'a round cap and no length');
  assert.ok(Math.abs(rest - length) < 1e-2);

  const arcOf = value => Number(tags(draw(h(Ring, {value, ariaLabel: 'x'})), 'circle', 'm-ring__fill')[0]['stroke-dasharray'].split(' ')[0]);
  assert.ok(Math.abs(arcOf(62) - length * 0.62) < 1e-2);
  const [part, gapAfter] = tags(draw(h(Ring, {value: 62, ariaLabel: 'x'})), 'circle', 'm-ring__fill')[0]['stroke-dasharray'].split(' ').map(Number);
  assert.ok(Math.abs(part + gapAfter - length) < 1e-2, 'the pattern is the circle');
  assert.ok(Math.abs(arcOf(100) - length) < 1e-2, 'the whole ring');
  assert.equal(arcOf(130), arcOf(100), 'clamped at 100');
  assert.equal(arcOf(-5), 0, 'and at 0');
  assert.match(ringStyles, /\.m-ring\.m-ring--empty \.m-ring__track\{stroke:var\(--m-label-3\);stroke-width:2px/, 'dashed in --m-label-3');
  assert.match(ringStyles, /\.m-ring__track\{fill:none;stroke:color-mix\(in srgb,var\(--m-tone\) 20%,transparent\)\}/, 'the tone at 20%');
  assert.match(ringStyles, /\.m-ring--stale \.m-ring__fill\{opacity:\.6\}/, 'a stale arc at 60%');
});

test('the ring’s ticks cross the track where they fall, reserve and limit by class, and a stale level dims', () => {
  const html = draw(h(Ring, {value: 62, ticks: [...TICKS, {at: 25, kind: 'limit'}, {at: null, kind: 'reserve'}], stale: true, ariaLabel: NAME}));
  assert.match(html, /class="m-ring m-ring--regular m-tone-green m-ring--stale"/);
  const [reserve] = tags(html, 'line', 'm-ring__tick m-ring__tick--reserve'), limits = tags(html, 'line', 'm-ring__tick m-ring__tick--limit');
  assert.equal(limits.length, 2, 'an unknown tick is left out');
  // Half-way round is straight down, across the 12px track 52px out, 3px past each side.
  assert.deepEqual([reserve.x1, reserve.y1, reserve.x2, reserve.y2, reserve['stroke-width']].map(Number), [68, 111, 68, 129, 3]);
  // A quarter is three o'clock.
  const quarter = limits.find(tick => tick.y1 === '68');
  assert.deepEqual([quarter.x1, quarter.x2].map(Number), [111, 129]);
  const small = tags(draw(h(Ring, {value: 62, ticks: TICKS, ariaLabel: NAME, size: 'small'})), 'line', 'm-ring__tick m-ring__tick--reserve')[0];
  assert.deepEqual([small.x1, small.y1, small.x2, small.y2, small['stroke-width']].map(Number), [40, 65, 40, 77, 2], 'and inside the 80px box');
});

test('each tick sits in a notch the track and the arc leave for it, a mask of its own ring’s', () => {
  const [one, two] = draw(h('div', null, h(Ring, {value: 62, ticks: TICKS, ariaLabel: NAME}), h(Ring, {value: 30, ticks: TICKS, ariaLabel: NAME})))
    .split('</svg>').slice(0, 2);
  const [mask] = tags(one, 'mask', 'm-ring__mask'), [other] = tags(two, 'mask', 'm-ring__mask');
  assert.ok(mask.id && other.id && mask.id !== other.id, 'each ring its own mask');
  assert.deepEqual([mask.maskUnits, mask.x, mask.y, mask.width, mask.height], ['userSpaceOnUse', '0', '0', '136', '136']);
  for (const circle of ['m-ring__track', 'm-ring__fill']) assert.equal(tags(one, 'circle', circle)[0].mask, `url(#${mask.id})`, circle);
  assert.equal(count(one, /<line[^>]* mask=/g), 0, 'the ticks themselves are not masked');
  // The box, then a band per tick across the ring, 1.5 + 2px either side of it, from 1px inside the track to 1px outside.
  const [notches] = tags(one, 'path', 'm-ring__notches');
  assert.equal(notches['fill-rule'], 'evenodd');
  const [box, reserve, limit] = notches.d.split('M').filter(Boolean);
  assert.equal(box, '0 0H136V136H0Z');
  assert.deepEqual(reserve.replace('Z', '').split('L').map(point => point.split(' ').map(Number)), [[71.5, 113], [71.5, 127], [64.5, 127], [64.5, 113]]);
  assert.ok(limit.endsWith('Z'));
  assert.match(ringStyles, /\.m-ring__mask\{mask-type:alpha\}/);
  assert.match(ringStyles, /\.m-ring__notches\{fill:var\(--m-on-color\)\}/, 'white in both schemes, so it shows the ring as an alpha or a luminance mask');
  const bare = draw(h(Ring, {value: 62, ariaLabel: NAME}));
  assert.doesNotMatch(bare, /<defs|mask=/, 'no ticks, no mask');
});

const FULL = [{key: 'home', tone: 'yellow', share: 0.418}, {key: 'export', tone: 'green', share: 0.31}, {key: 'import', tone: 'indigo', share: 0.272}];
const ENERGY = 'Energy today, in kWh: 6.6 used at home, 4.9 exported, 4.6 from the grid';

test('the segmented bar is one named image, a segment per share in order grown by it; with none it is the dashed track', () => {
  const html = draw(h(SegmentBar, {segments: FULL, ariaLabel: ENERGY}));
  assert.match(html, new RegExp(`^<div class="m-segment-bar" role="img" aria-label="${ENERGY}">`));
  assert.deepEqual(tags(html, 'span', 'm-segment-bar__segment[^"]*').map(span => [span.class, span.style]), [
    ['m-segment-bar__segment m-tone-yellow', 'flex-grow:0.418'], ['m-segment-bar__segment m-tone-green', 'flex-grow:0.31'], ['m-segment-bar__segment m-tone-indigo', 'flex-grow:0.272']]);
  const missing = '<div class="m-segment-bar m-segment-bar--empty" role="img" aria-label="Energy today: some readings are missing"></div>';
  assert.equal(draw(h(SegmentBar, {segments: [], ariaLabel: 'Energy today: some readings are missing'})), missing, 'missing by default');
  assert.equal(draw(h(SegmentBar, {segments: [], ariaLabel: 'Energy today: some readings are missing', empty: 'missing'})), missing);
  assert.equal(draw(h(SegmentBar, {segments: [], ariaLabel: 'Energy today: nothing generated or used yet', empty: 'zero'})),
    '<div class="m-segment-bar m-segment-bar--zero" role="img" aria-label="Energy today: nothing generated or used yet"></div>');
  assert.match(draw(h(SegmentBar, {segments: FULL, ariaLabel: ENERGY, empty: 'zero'})), /^<div class="m-segment-bar" role="img"/, 'segments are never empty');
});

test('a real zero is a solid track and a missing reading a dashed one, never alike', () => {
  const rule = selector => segmentBarStyles.match(new RegExp(`^${selector.replace(/[.-]/g, '\\$&')}\\{([^}]*)\\}$`, 'm'))?.[1];
  assert.equal(rule('.m-segment-bar--empty'), 'border:1px dashed var(--m-label-3)');
  assert.equal(rule('.m-segment-bar--zero'), 'background:var(--m-fill-pressed)');
});

test('a legend has a line per item, each with its dot in its tone and hidden', () => {
  const items = [{tone: 'yellow', text: '6.6 used at home'}, {tone: 'green', text: '4.9 exported'}, {tone: 'indigo', text: '— from the grid'}];
  const html = draw(h(Legend, {items}));
  assert.match(html, /^<ul class="m-legend">/);
  assert.deepEqual([...html.matchAll(/<li class="m-legend__item"><span class="m-legend__dot m-tone-(\w+)" aria-hidden="true"><\/span>([^<]*)<\/li>/g)].map(([, tone, text]) => ({tone, text})), items);
  assert.equal(draw(h(Legend, {items: []})), '<ul class="m-legend"></ul>');
});

const GLANCE = [
  {id: 'climate', icon: 'climate', tone: 'temperature', title: 'Climate', line: '22.7–24.2° inside', ariaLabel: 'Climate: 22.7–24.2° inside. Open Climate'},
  {id: 'energy', icon: 'sun', tone: 'yellow', title: 'Energy', line: '2.84 kW solar', ariaLabel: 'Energy: 2.84 kW solar. Open Energy'},
  {id: 'car', icon: 'car', tone: 'gray', title: 'Car', line: '62% · waiting', ariaLabel: 'Car: 62% · waiting. Open Car'},
].map(({ariaLabel, ...item}) => ({...item, link: {intent: {command: 'navigate', entity: item.id}, enabled: true, ariaLabel}}));

test('the glance chips are a named list of buttons, each named by its link, in its tone, and none blue', () => {
  const html = draw(h(GlanceChips, {label: 'At a glance', items: GLANCE}));
  assert.match(html, /^<div class="m-glance" role="list" aria-label="At a glance">/);
  assert.equal(count(html, /<div class="m-glance__item" role="listitem"><button /g), 3, 'each item holds its button');
  assert.deepEqual(tags(html, 'button', 'm-glance__chip m-focusable').map(button => button['aria-label']), GLANCE.map(item => item.link.ariaLabel));
  assert.equal(count(html, / disabled=""/g), 0);
  assert.deepEqual([...html.matchAll(/<span class="m-glance__title">([^<]*)<\/span><span class="m-glance__line">([^<]*)<\/span>/g)].map(([, title, line]) => [title, line]),
    GLANCE.map(({title, line}) => [title, line]));
  assert.deepEqual([...html.matchAll(/class="m-glance__dot m-tone-(\w+)"/g)].map(([, tone]) => tone), ['temperature', 'yellow', 'gray']);
  assert.equal(count(html, /class="m-glyph"/g), 3, 'a glyph in each dot');
  assert.doesNotMatch(html, /blue/);

  // The room scale is TEMP_SCALE's stops, at the share of the scale each stands at.
  const [dot] = tags(html, 'span', 'm-glance__dot m-tone-temperature');
  const [low, high] = [TEMP_SCALE[0][0], TEMP_SCALE.at(-1)[0]];
  assert.equal(dot.style, `background:linear-gradient(135deg,${TEMP_SCALE.map(([at, colour]) => `${colour} ${Math.round((at - low) / (high - low) * 1000) / 10}%`).join(',')})`);
  assert.match(dot.style, /^background:linear-gradient\(135deg,#5AC8FA 0%,.*,#FF453A 100%\)$/);
  assert.equal(tags(html, 'span', 'm-glance__dot m-tone-yellow')[0].style, undefined, 'a tone is the stylesheet’s');

  const off = draw(h(GlanceChips, {label: 'At a glance', items: [{...GLANCE[2], link: {...GLANCE[2].link, enabled: false}}]}));
  assert.equal(count(off, / disabled=""/g), 1, 'a disabled link disables its chip');
});

test('pressing a chip sends its link’s intent, and only that', () => {
  const sent = [];
  let list;
  draw(h(() => { list = GlanceChips({label: 'At a glance', items: GLANCE}); return null; }), sent);
  const buttons = list.props.children.map(item => item.props.children);
  assert.deepEqual(buttons.map(button => button.props['aria-label']), GLANCE.map(item => item.link.ariaLabel));
  for (const button of [...buttons].reverse()) button.props.onPress();
  assert.deepEqual(sent, GLANCE.map(item => item.link.intent).reverse());
});

// A rule's declarations in a stylesheet, by its exact selector.
const declarations = (css, selector) => Object.fromEntries(css.match(new RegExp(`^${selector.replace(/[.-]/g, '\\$&')}\\{([^}]*)\\}$`, 'm'))[1]
  .split(';').map(part => [part.slice(0, part.indexOf(':')), part.slice(part.indexOf(':') + 1)]));
const px = value => Number(value.replace(/var\(--([\w-]+)\)/, (_, name) => SHARED[name]).replace('px', ''));

test('the chips scroll on their own: never wider than their container, and their overscroll kept', () => {
  const row = declarations(glanceStyles, '.m-glance');
  assert.deepEqual([row['min-width'], row['max-width'], row['overflow-x'], row['overscroll-behavior-x']], ['0', '100%', 'auto', 'contain']);
  assert.deepEqual([row['scroll-snap-type'], row['scrollbar-width']], ['x mandatory', 'none']);
  assert.deepEqual([row['margin-block'], row['padding-block']], ['-4px', '4px'], 'room for the focus ring, taken back');
  assert.equal(declarations(glanceStyles, '.m-glance__item')['scroll-snap-align'], 'start');
});

test('a chip is at least 44px tall, its dot concentric, and two of the busiest leave 32px of a third in view on a 375px phone', () => {
  const chip = declarations(glanceStyles, '.m-glance__chip'), dot = declarations(glanceStyles, '.m-glance__dot'), row = declarations(glanceStyles, '.m-glance');
  const [top, right, bottom, left] = chip.padding.split(' ').map(px), border = 2 * px(chip.border.split(' ')[0]), size = px(dot.width);
  assert.equal(chip['min-height'], 'var(--m-hit)');
  assert.equal(px(chip['min-height']), 44);
  // Subhead-strong over footnote: 20 + 18px of text.
  const height = 20 + 18 + top + bottom + border;
  assert.ok(height >= 44, `${height}px`);
  assert.equal(left, (height - border - size) / 2, 'the dot inset as far from the start as from the top');
  // The busy fixture's lines, '16.8–20.1° inside' and '2.84 kW solar', measure 104 and 84px in SF at 13px (Chromium, macOS).
  const chrome = border + left + size + px(chip.gap) + right, third = 375 - 16 - (2 * chrome + 104 + 84 + 2 * px(row.gap));
  assert.ok(third >= 32, `${third}px of the third chip`);
});

test('a figure puts its label above or beside its reading, sets the reading in rounded digits, and leaves out what it lacks', () => {
  const above = draw(h(Figure, {label: 'Solar generated', value: '11.5', unit: 'kWh'}));
  assert.equal(above, '<p class="m-figure m-figure--above m-figure--large"><span class="m-figure__label">Solar generated</span>'
    + '<span class="m-figure__reading"><span class="m-figure__value m-num">11.5</span><span class="m-figure__unit">kWh</span></span></p>');
  assert.match(draw(h(Figure, {label: 'Solar generated', value: '11.5', unit: 'kWh', labelPlacement: 'beside'})), /^<p class="m-figure m-figure--beside m-figure--large"><span class="m-figure__label">/);
  assert.match(draw(h(Figure, {label: 'Exported', value: '4.9', unit: 'kWh', size: 'regular'})), /^<p class="m-figure m-figure--above m-figure--regular">/);
  assert.equal(draw(h(Figure, {value: '—', unit: ''})), '<p class="m-figure m-figure--above m-figure--large"><span class="m-figure__reading"><span class="m-figure__value m-num">—</span></span></p>',
    'no label and no unit: the dash alone');
});

test('a quiet line holds its glyph and its text, and its actions only when it has buttons', () => {
  const docked = draw(h(QuietLine, {icon: 'vacuum', text: 'Roborock is docked, battery 100%'}));
  assert.match(docked, /^<p class="m-quiet"><span class="m-glyph m-quiet__glyph" aria-hidden="true">.*<\/span><span class="m-quiet__text">Roborock is docked, battery 100%<\/span><\/p>$/);
  // A page's `{active && buttons}` while inactive, and nothing at all.
  for (const children of [false, null, undefined, [false, null]]) {
    assert.doesNotMatch(draw(h(QuietLine, {icon: 'vacuum', text: 'Roborock is docked'}, children)), /m-quiet__actions/, String(children));
  }
  const control = (label, icon) => ({intent: {command: 'vacuum', entity: label}, enabled: true, label, icon});
  const sent = [], cleaning = draw(h(QuietLine, {icon: 'vacuum', text: 'Roborock is cleaning · 40%'},
    h(IntentButton, {action: control('Pause', 'pause'), variant: 'gray'}), h(IntentButton, {action: control('Dock', 'dock'), variant: 'gray'})), sent);
  assert.match(cleaning, /<span class="m-quiet__text">Roborock is cleaning · 40%<\/span><span class="m-quiet__actions"><button [^>]*>.*Pause.*<\/button><button [^>]*>.*Dock.*<\/button><\/span><\/p>$/);
  assert.equal(count(cleaning, /<button/g), 2);
});
