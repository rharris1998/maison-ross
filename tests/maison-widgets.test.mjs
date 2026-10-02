// Maison's widgets (#29 step 4): what WidgetGrid and Widget draw in each
// layout, and the metrics that let a page's value know how many rows a
// widget holds. On a phone the widgets stack as section titles over their
// bodies; from 700px they sit in a grid, each placed by grid.js's
// placeWidgets() as inline grid lines, each its own surface with an h2 title.
// A widget that opens a page is one press, its title's button stretched over
// it, and holds no other: the gallery's specimens are held to that here and
// Today's in maison-today-page.test.mjs. Node has no JSX, so esbuild bundles
// the widgets and the gallery's specimens with react-dom/server into a
// temporary module, and each test reads the markup they render to.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {WIDGET_ROWS} from '../config/www/maison/today.js';
import {placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {DARK, LIGHT, SHARED} from '../frontend/maison/src/ui/tokens.js';
import {baseStyles} from '../frontend/maison/src/ui/base.css.js';
import {buttonStyles} from '../frontend/maison/src/ui/button.css.js';
import {listStyles} from '../frontend/maison/src/ui/list.css.js';
import {widgetStyles} from '../frontend/maison/src/ui/widget.css.js';

const UI = fileURLToPath(new URL('../frontend/maison/src/ui/', import.meta.url));
const ENTRY = `export {Widget, WidgetGrid, useWidgetSurface} from './widget.jsx';
export {LayoutContext} from './layout.js';
export {List, ListRow} from './list.jsx';
export {WidgetSpecimens} from '../gallery/widget-specimens.jsx';
export {CommandContext} from '../contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The widgets, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-widgets-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: UI, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'widgets.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'widgets.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, Widget, WidgetGrid, useWidgetSurface, List, ListRow, WidgetSpecimens} = ui;

// Markup for an element in a layout, with a command that records what it is sent.
const draw = (element, layout = 'phone', sent = []) =>
  renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)}, h(LayoutContext.Provider, {value: layout}, element)));
const count = (html, pattern) => (html.match(pattern) || []).length;
// Each widget's markup, in order: widgets never nest, and their bodies hold no section.
const widgets = html => [...html.matchAll(/<section class="m-widget[\s\S]*?<\/section>/g)].map(match => match[0]);

const link = (ariaLabel, enabled = true) => ({intent: {command: 'navigate', entity: 'energy'}, enabled, ariaLabel});
const more = {intent: {command: 'alerts'}, enabled: true, label: '2 more'};
// Today's six widgets at the sizes a busy afternoon gives them (contract §3.9).
const TODAY = [['needs', 'medium'], ['car', 'small'], ['live', 'small'], ['climate', 'medium'], ['upcoming', 'large'], ['energyToday', 'medium']];
const grid = (layout, items = TODAY) => draw(h(WidgetGrid, null, items.map(([id, size]) => h(Widget, {key: id, id, size, title: id}, h('p', null, id)))), layout);

test('on a phone the widgets stack in order, as section titles over their bodies, with no placement and no size', () => {
  const html = grid('phone');
  assert.match(html, /^<div class="m-widgets m-widgets--stack">/);
  assert.doesNotMatch(html, /data-columns|style=|m-widget--(?:small|medium|large|xl)/);
  const drawn = widgets(html);
  assert.deepEqual(drawn.map(w => w.match(/data-widget="(\w+)"/)[1]), TODAY.map(([id]) => id));
  for (const w of drawn) {
    assert.match(w, /^<section class="m-widget m-widget--phone" data-widget="\w+"><h2 class="m-section-title m-widget__title"><span class="m-widget__text">\w+<\/span><\/h2><div class="m-widget__body m-widget__body--card">/);
  }
});

test('from 700px the grid has two columns, and four on a desktop, each widget placed as placeWidgets() places it', () => {
  for (const [layout, columns] of [['wide', 2], ['desktop', 4]]) {
    const html = grid(layout), {placements} = placeWidgets(TODAY.map(([id, size]) => ({id, size})), columns);
    assert.match(html, new RegExp(`^<div class="m-widgets m-widgets--grid" data-columns="${columns}">`), layout);
    const drawn = widgets(html).map(w => w.match(/^<section class="m-widget m-widget--(\w+)" data-widget="(\w+)" style="grid-column:([^;]+);grid-row:([^"]+)">/).slice(1));
    assert.deepEqual(drawn, placements.map(({id, column, row, columnSpan, rowSpan}) =>
      [TODAY.find(([name]) => name === id)[1], id, `${column} / span ${columnSpan}`, `${row} / span ${rowSpan}`]), layout);
  }
  // The four-column Today above: needs and the two smalls fill row 1, climate and upcoming rows 2 and 3, energyToday beside upcoming.
  assert.deepEqual(placeWidgets(TODAY.map(([id, size]) => ({id, size})), 4).holes, []);
});

test('a wrapper with id and size props is placed like a Widget, and a named grid is a group', () => {
  const Wrapper = ({id, size}) => h(Widget, {id, size, title: 'Car', link: link('Car: 62%. Open Car')}, h('p', null, '62%'));
  const html = draw(h(WidgetGrid, {ariaLabel: 'Today'}, h(Wrapper, {key: 'a', id: 'needs', size: 'medium'}), h(Wrapper, {key: 'b', id: 'car', size: 'small'})), 'desktop');
  assert.match(html, /^<div class="m-widgets m-widgets--grid" data-columns="4" role="group" aria-label="Today">/);
  assert.match(html, /data-widget="car" style="grid-column:3 \/ span 1;grid-row:1 \/ span 1"/);
  assert.match(grid('phone').split('>')[0], /^<div class="m-widgets m-widgets--stack"$/, 'no role without a name');
});

test('every widget title is an h2 under the page’s h1, and no widget is a landmark', () => {
  for (const layout of ['phone', 'wide', 'desktop']) {
    const drawn = widgets(grid(layout));
    assert.equal(drawn.length, TODAY.length);
    for (const w of drawn) {
      assert.equal(count(w, /<h\d/g), 1, layout);
      assert.match(w, /<h2 class="[^"]*m-widget__title"/, layout);
      assert.doesNotMatch(w, /aria-label(?:ledby)?=|role=/, `${layout}: a section with no name is no region`);
    }
  }
  assert.match(widgets(grid('wide'))[0], /<h2 class="m-widget__title">/, 'from 700px the title is the widget’s own');
});

// The Title's button element, drawn inside a render so its hook runs.
function titleButton(props, layout, sent) {
  let button;
  draw(h(() => {
    const section = Widget(props), [title] = section.props.children.props.children, heading = title.type(title.props);
    button = heading.props.children.find(child => child?.props?.onPress);
    return null;
  }), layout, sent);
  return button;
}

test('a linked widget is one press, read as one element: its title’s button, named by the link, then a chevron; its note and body hidden', () => {
  const energy = {id: 'live', size: 'small', title: 'Energy', icon: 'sun', tone: 'yellow', note: 'Solar', link: link('Energy: 2.84 kW solar. Open Energy'), more};
  for (const layout of ['phone', 'desktop']) {
    const html = draw(h(Widget, energy, h('p', null, '2.84 kW')), layout);
    assert.equal(count(html, /<button/g), 1, `${layout}: no "more" beside the link`);
    assert.match(html, /<span class="m-glyph m-widget__glyph m-tone-yellow" aria-hidden="true">.*<\/span><button[^>]* class="m-widget__press m-focusable"[^>]*>Energy<\/button><span class="m-widget__note" aria-hidden="true">Solar<\/span><span class="m-glyph m-widget__chevron" aria-hidden="true">/);
    assert.match(html, /<\/h2><div class="m-widget__body[^"]*" aria-hidden="true"><p>2\.84 kW<\/p><\/div><\/section>$/, `${layout}: the link’s name says what the body shows`);
    assert.match(html, /<button[^>]* aria-label="Energy: 2\.84 kW solar\. Open Energy"/);
    assert.doesNotMatch(html, /m-widget__more/);
  }
  const named = draw(h(Widget, {id: 'car', title: 'Car', link: {intent: {command: 'navigate', entity: 'car'}, enabled: true}}, 'x'), 'wide');
  assert.match(named, /<button[^>]* aria-label="Car"/, 'named by the title without an ariaLabel');
  assert.match(draw(h(Widget, {id: 'car', title: 'Car', link: link('Car', false)}, 'x'), 'wide'), /<button class="m-widget__press m-focusable"[^>]* disabled=""/);
  const sent = [];
  titleButton({id: 'live', title: 'Energy', link: link('Open Energy')}, 'desktop', sent).props.onPress();
  assert.deepEqual(sent, [{command: 'navigate', entity: 'energy'}], 'a press sends the link’s intent');
});

test('an unlinked widget draws its title as text, and "more" as a plain button at the body’s foot', () => {
  const rows = [{link: link('Office switch'), icon: 'battery', tone: 'orange', title: 'Office switch', detail: 'Battery at 16%'}];
  const Body = () => h(List, {variant: useWidgetSurface() ? 'plain' : 'inset'}, rows.map(row => h(ListRow, {key: row.title, ...row, strong: true})));
  const needs = {id: 'needs', title: 'Needs you', icon: 'alert', tone: 'amber', more, surface: 'none'};
  const phone = draw(h(Widget, needs, h(Body)), 'phone'), wide = draw(h(Widget, needs, h(Body)), 'wide');
  assert.match(phone, /<span class="m-glyph m-widget__glyph m-tone-orange"[^>]*>.*<\/span><span class="m-widget__text">Needs you<\/span><\/h2><div class="m-widget__body"><div class="m-list m-list--inset"/, 'bare on a phone, the list inset');
  assert.match(wide, /<\/h2><div class="m-widget__body"><div class="m-list m-list--plain"/, 'plain on the widget’s own surface');
  for (const html of [phone, wide]) {
    assert.match(html, /<\/div><button[^>]* class="m-button m-button--plain m-button--regular m-focusable m-widget__more"[^>]*><span class="m-button__label">2 more<\/span><\/button><\/div><\/section>$/);
    assert.doesNotMatch(html, /m-widget__chevron|m-widget__press/);
  }
  assert.match(draw(h(Widget, {id: 'x', title: 'X', icon: 'sun'}, 'x')), /<span class="m-glyph m-widget__glyph" aria-hidden="true">/, 'no tone, no tone class');
  assert.match(draw(h(Widget, {id: 'x', title: 'X', note: 'Heating is off'}, 'x'), 'wide'), /<span class="m-widget__note">Heating is off<\/span><\/h2><div class="m-widget__body">x<\/div>/, 'without a link the note and body are read');
});

test('useWidgetSurface is true only inside a widget from 700px', () => {
  const Probe = () => h('i', null, String(useWidgetSurface()));
  const seen = layout => draw(h(Widget, {id: 'x', title: 'X'}, h(Probe)), layout).match(/<i>(\w+)<\/i>/)[1];
  assert.deepEqual(['phone', 'wide', 'desktop'].map(seen), ['false', 'true', 'true']);
  assert.equal(draw(h(Probe), 'desktop'), '<i>false</i>', 'outside any widget');
});

test('the gallery’s specimens: every size, both grids and the stack, and each linked widget holds exactly one pressable', () => {
  const html = draw(h(WidgetSpecimens));
  assert.match(html, /m-widgets m-widgets--stack/);
  assert.match(html, /m-widgets m-widgets--grid" data-columns="2"/);
  assert.match(html, /m-widgets m-widgets--grid" data-columns="4"/);
  for (const size of ['small', 'medium', 'large', 'xl']) assert.match(html, new RegExp(`class="m-widget m-widget--${size}"`), size);
  const drawn = widgets(html), linked = drawn.filter(w => w.includes('m-widget__press'));
  assert.ok(linked.length >= 4, 'linked widgets in the stack and the grid');
  for (const w of linked) {
    const id = w.match(/data-widget="([\w-]+)"/)[1];
    assert.equal(count(w, /<button/g), 1, id);
    assert.match(w, /<div class="m-widget__body[^"]*" aria-hidden="true">/, `${id}: its body is hidden`);
    assert.doesNotMatch(w, /<span class="m-widget__note">/, `${id}: and its note`);
  }
  assert.ok(drawn.some(w => w.includes('m-widget__note')) && drawn.some(w => w.includes('m-widget__more')), 'a note and a "more"');
});

// The metrics (widget.css.js) that today.js's WIDGET_ROWS follows: how many
// 52px list rows a widget's body holds, and how many with "N more" (a 36px
// button) at its foot, from the row, the gap, the border, the padding and the
// title. A change to any of them that WIDGET_ROWS doesn't follow fails here.
test('WIDGET_ROWS is what the widget metrics leave room for', () => {
  const px = value => Number(value.match(/^([\d.]+)px$/)[1]);
  const rule = selector => widgetStyles.match(new RegExp(`(?:^|\\n)${selector.replace(/[.()>:-]/g, '\\$&')}\\{([^}]*)\\}`))?.[1];
  const title = rule('.m-widget:not(.m-widget--phone)>.m-widget__title'), row = rule('.m-widget:not(.m-widget--phone) .m-row');
  assert.match(title, /height:20px;margin:0 0 var\(--m-space-2\)/);
  assert.match(row, /^min-height:52px;padding-block:5px$/);
  assert.match(rule('.m-widget:not(.m-widget--phone)'), /padding:var\(--m-card-padding\);[^;]*;border:\.5px solid/);
  const line = token => px(SHARED[token].match(/\/(\d+px)/)[1]);
  assert.equal(line('m-type-body') + line('m-type-subhead') + 2 * 5, 52, 'a title line and a detail line fill the row');
  // The 0.5px border as drawn, and as Chromium draws it: a whole pixel.
  const body = (rows, border) => rows * px(SHARED['m-widget-row']) + (rows - 1) * px(SHARED['m-widget-gap'])
    - (2 * border + 2 * px(SHARED['m-card-padding']) + 20 + px(SHARED['m-space-2']));
  const holds = (height, n, withMore = false) => (withMore ? (n - 1) * 52 + px(SHARED['m-control']) : n * 52) <= height;
  for (const border of [0.5, 1]) for (const [size, rows] of [['medium', 1], ['large', 2]]) {
    const n = WIDGET_ROWS[size], height = body(rows, border);
    assert.ok(holds(height, n) && !holds(height, n + 1), `${size}: ${n} rows in ${height}px, and not ${n + 1}`);
    assert.ok(holds(height, n, true), `${size}: ${n - 1} rows and "more" in ${height}px`);
  }
  assert.deepEqual([body(1, 0.5), body(2, 0.5), body(1, 1), body(2, 1)], [107, 291, 106, 290]);
});

// The body clips what overflows, so it reaches past its text far enough for
// what is drawn out of the text's box: "N more" pulls out to line its text up
// with the rows, and its focus ring and hit area go out from there; a
// pressed row's fill and its ring. Its negative margin gives its padding
// back, so the room above is unchanged.
test('the body reaches far enough that "N more" and a pressed row are never clipped, and keeps its room', () => {
  const px = value => Number(value.match(/^(-?[\d.]+)px$/)?.[1] ?? SHARED[value.match(/^calc\(-1 \* var\(--([\w-]+)\)\)$/)[1]].replace('px', '') * -1);
  const declarations = (css, selector) => Object.fromEntries(css.match(new RegExp(`(?:^|\\n|\\})${selector.replace(/[.()>:*[\]-]/g, '\\$&')}\\{([^}]*)\\}`))[1].split(';').map(part => [part.slice(0, part.indexOf(':')), part.slice(part.indexOf(':') + 1)]));
  const body = declarations(widgetStyles, '.m-widget:not(.m-widget--phone)>.m-widget__body');
  const [marginBlock, marginInline] = body.margin.split(' ').map(px), [padBlock, padInline] = body.padding.split(' ').map(px);
  assert.deepEqual([marginBlock, marginInline], [-padBlock, -padInline], 'the margin gives the padding back');
  const ring = declarations(baseStyles, '.m-focusable[data-focus-visible]'), reach = px(ring.outline.split(' ')[0]) + px(ring['outline-offset']);
  const hit = -px(declarations(buttonStyles, '.m-button--regular::after').inset);
  const pull = -px(declarations(widgetStyles, '.m-button.m-widget__more')['margin-inline-start']);
  assert.deepEqual([reach, hit, pull], [4, 4, 8]);
  assert.ok(pull + Math.max(reach, hit) <= padInline, `"N more" reaches ${pull + Math.max(reach, hit)}px to the side of ${padInline}px`);
  assert.ok(Math.max(reach, hit) <= padBlock, `and ${Math.max(reach, hit)}px below of ${padBlock}px`);
  const fill = declarations(listStyles, '.m-list--plain .m-row--pressable::before');
  assert.ok(-px(fill.inset.slice(fill.inset.indexOf(' ') + 1)) + 2 <= padInline && 2 <= padBlock, 'a pressed row’s fill and its 2px ring');
});

// A row's pressed fill reaches 8px out from the text, so its radius is the
// widget's, less the 8px between them: concentric.
test('a pressed or focused row inside a widget takes a concentric 16px radius', () => {
  assert.match(widgetStyles, /\n\.m-widget \.m-list--plain \.m-row--pressable::before\{border-radius:calc\(var\(--m-radius-card\) - var\(--m-card-padding\) \+ var\(--m-space-2\)\)\}/);
  assert.match(listStyles, /\.m-list--plain \.m-row--pressable::before\{[^}]*inset:0 calc\(-1 \* var\(--m-space-2\)\)/, 'the fill 8px out');
  const n = token => Number(SHARED[token].replace('px', ''));
  assert.equal(n('m-radius-card') - (n('m-card-padding') - n('m-space-2')), 16);
});

// The zone capsules inside a widget sit on the card, not on the sky: their
// track reads at 1.5:1 or better on the card in both schemes.
const channels = value => value.startsWith('#') ? [...[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)), 1]
  : value === 'transparent' ? [0, 0, 0, 0] : value.match(/[\d.]+/g).map(Number);
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
const luminance = rgb => {
  const [r, g, b] = rgb.slice(0, 3).map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test('inside a widget the capsule track reads on the card, light and dark, and the target tick is the label', () => {
  const widget = widgetStyles.match(/\n\.m-widget\{([^}]*)\}/)[1];
  const track = widget.match(/--m-capsule-track:var\(--([\w-]+)\)/)[1];
  assert.match(widget, /--m-target-tick:var\(--m-label\)/);
  for (const [scheme, tokens] of [['light', LIGHT], ['dark', DARK]]) {
    const card = over(channels(tokens['m-card-fill']), channels(tokens['m-bg'])), ratio = contrast(over(channels(tokens[track]), card), card);
    assert.ok(ratio >= 1.5, `${scheme}: --${track} at ${ratio.toFixed(2)}:1 on the card`);
  }
});

test('from 700px rows clamp to one line and the stretched press rings the widget; on a phone nothing clamps', () => {
  assert.match(widgetStyles, /\.m-widget:not\(\.m-widget--phone\) :is\(\.m-row__title,\.m-row__detail,\.m-row__value\)\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  const clamping = widgetStyles.split('\n').filter(line => /nowrap|ellipsis/.test(line));
  assert.ok(clamping.length >= 3 && clamping.every(line => line.startsWith('.m-widget:not(.m-widget--phone)')), 'every clamp is from 700px only');
  assert.match(widgetStyles, /\.m-widget__press::after\{content:"";position:absolute;inset:0;z-index:1\}/);
  assert.match(widgetStyles, /\.m-widget\{position:relative;isolation:isolate;/);
  // The ring goes round the whole widget: on a phone the title and the body together, 4px out.
  assert.match(widgetStyles, /@supports selector\(:has\(\*\)\)\{\.m-widget:has\(\.m-widget__press\[data-focus-visible\]\)\{outline:2px solid var\(--m-focus-ring\);outline-offset:2px\}\.m-widget\.m-widget--phone:has\(\.m-widget__press\[data-focus-visible\]\)\{outline-offset:4px\}\}/);
  assert.match(widgetStyles, /\n\.m-widget--phone\{gap:var\(--m-space-2\);border-radius:var\(--m-radius-row\) var\(--m-radius-row\) var\(--m-radius-card\) var\(--m-radius-card\)\}/);
  assert.match(widgetStyles, /\.m-widget:not\(\.m-widget--phone\)>\.m-widget__body\{flex:1;min-height:0;[^}]*overflow:hidden\}/);
  assert.match(widgetStyles, /\.m-widgets--grid\{display:grid;grid-auto-rows:minmax\(var\(--m-widget-row\),auto\);gap:var\(--m-widget-gap\)\}/);
  assert.match(widgetStyles, /\.m-widgets--stack\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:var\(--m-space-6\)\}/);
});
