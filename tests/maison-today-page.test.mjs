// Today (#29 step 4): what TodayPage draws from the
// value screen() hands it for each of the pages view's fixtures (quiet, busy,
// paused, unavailable, night), in each layout the frame provides (phone,
// wide, desktop). Node has no JSX, so esbuild bundles the page with
// react-dom/server into a temporary module, and each test reads the markup a
// real value renders to: the widgets each layout draws and where, every word
// and name taken from the value, the glyphs, the one press a linked widget
// holds, the calendar's placeholder and note, "—" drawn apart from zero, and
// the quiet line's buttons. The Climate widget's capsule boxes are pinned
// with their text inside them, and the hero's beside them; the chips' bleed
// is read from the page's styles. A last test reads the page sources
// themselves: they write no English.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build, transform} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {TODAY_PAGES, todaySnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {todayPageStyles} from '../frontend/maison/src/pages/today.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const PAGES = join(SRC, 'pages');
const ENTRY = `export {TodayPage} from './pages/today.jsx';
export {ZonesChart} from './charts/zones.jsx';
export {Glyph} from './ui/glyph.jsx';
export {LayoutContext} from './ui/layout.js';
export {CommandContext} from './contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;
const BUILD = {bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', loader: {'.js': 'jsx'},
  define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent'};

// The page, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-today-'));
const bundle = await build({...BUILD, stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'},
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'today.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'today.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, TodayPage, ZonesChart, Glyph} = ui;

const LAYOUTS = ['phone', 'wide', 'desktop'];
const FIXTURES = TODAY_PAGES.map(({id}) => id);
// Today's value for a pages-view fixture, as the dashboard draws it.
const valueOf = id => screen(todaySnapshot(id)).page;
// Markup for Today in a layout, with a command that records what it is sent.
const draw = (value, layout, sent = []) => renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)},
  h(LayoutContext.Provider, {value: layout}, h(TodayPage, {value}))));
const count = (html, pattern) => (html.match(pattern) || []).length;
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decode = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// Each widget's markup, in order (widgets never nest), with its id and size.
const widgets = html => [...html.matchAll(/<section class="m-widget m-widget--(\w+)" data-widget="(\w+)"[^>]*>[\s\S]*?<\/section>/g)]
  .map(([markup, size, id]) => ({id, size, markup}));
// Every string anywhere in a value, which is every word the page may draw.
const strings = (value, found = new Set()) => {
  if (typeof value === 'string') found.add(value);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) strings(item, found);
  return found;
};
// The visible text of some markup, one chunk per element, and its names.
const texts = html => decode(html.replace(/<[^>]+>/g, '\n')).split('\n').map(text => text.trim()).filter(Boolean);
const names = html => [...html.matchAll(/aria-label="([^"]*)"/g)].map(([, name]) => decode(name));
const each = check => { for (const id of FIXTURES) for (const layout of LAYOUTS) check(id, layout, valueOf(id), draw(valueOf(id), layout)); };
// The widgets that open a page, by id: each is its link's one press.
const LINKS = {car: value => value.car.link, live: value => value.live.link, climate: value => value.climate.link, energyToday: value => value.energyToday.link};
// The glyph each widget's title carries, from the value.
const GLYPHS = {needs: v => v.needs.icon, upcoming: v => v.upcoming.icon, car: v => v.carRing.icon, live: v => v.live.icon, climate: v => v.climate.icon, energyToday: v => v.energyToday.icon};

test('on a phone: the glance chips, then Needs you, Coming up and Energy today stacked, those the value has, and nothing else', () => {
  for (const id of FIXTURES) {
    const value = valueOf(id), html = draw(value, 'phone');
    assert.match(html, /^<div class="m-today"><div class="m-glance" role="list" aria-label="At a glance">/, id);
    assert.deepEqual([...html.matchAll(/class="m-glance__chip[^"]*"[^>]*aria-label="([^"]*)"/g)].map(([, name]) => decode(name)),
      value.glance.items.map(item => item.link.ariaLabel), id);
    assert.match(html, /<div class="m-widgets m-widgets--stack">/, id);
    assert.doesNotMatch(html, /m-widgets--grid|style="grid-/, id);
    assert.deepEqual(widgets(html).map(w => [w.id, w.size]), ['needs', 'upcoming', 'energyToday'].filter(key => value[key]).map(key => [key, 'phone']), id);
  }
  assert.deepEqual(widgets(draw(valueOf('busy'), 'phone')).map(w => w.id), ['needs', 'upcoming', 'energyToday'], 'busy needs you');
  assert.deepEqual(widgets(draw(valueOf('quiet'), 'phone')).map(w => w.id), ['upcoming', 'energyToday'], 'nothing needs you');
});

test('from 700px: the value’s widgets in order, at their sizes, placed as placeWidgets() places them, every row full; no chips', () => {
  each((id, layout, value, html) => {
    if (layout === 'phone') return;
    const columns = COLUMNS[layout], at = `${id} ${layout}`, {placements, holes} = placeWidgets(value.widgets, columns);
    assert.doesNotMatch(html, /m-glance/, at);
    assert.match(html, new RegExp(`^<div class="m-today"><div class="m-widgets m-widgets--grid" data-columns="${columns}">`), at);
    const drawn = [...html.matchAll(/<section class="m-widget m-widget--(\w+)" data-widget="(\w+)" style="grid-column:([^;]+);grid-row:([^"]+)">/g)]
      .map(([, size, key, column, row]) => [key, size, column, row]);
    assert.deepEqual(drawn, placements.map(({id: key, column, row, columnSpan, rowSpan}) =>
      [key, value.widgets.find(w => w.id === key).size, `${column} / span ${columnSpan}`, `${row} / span ${rowSpan}`]), at);
    assert.deepEqual(holes, [], at);
  });
  assert.deepEqual(widgets(draw(valueOf('busy'), 'desktop')).map(w => `${w.id}:${w.size}`),
    ['needs:medium', 'car:small', 'live:small', 'climate:medium', 'upcoming:large', 'energyToday:medium']);
  assert.deepEqual(widgets(draw(valueOf('night'), 'desktop')).map(w => `${w.id}:${w.size}`),
    ['car:small', 'live:small', 'climate:large', 'upcoming:large', 'energyToday:medium']);
});

test('every word and every accessible name on the page is the value’s', () => {
  each((id, layout, value, html) => {
    const words = strings(value), at = `${id} ${layout}`;
    assert.deepEqual(texts(html).filter(text => !words.has(text)), [], `${at}: drawn text`);
    assert.deepEqual(names(html).filter(name => !words.has(name)), [], `${at}: names`);
  });
});

test('each widget draws its value: the titles, rows, figures, ring, capsules, split and the quiet line', () => {
  each((id, layout, value, html) => {
    const at = `${id} ${layout}`, drawn = Object.fromEntries(widgets(html).map(w => [w.id, w.markup])), grid = layout !== 'phone';
    for (const [key, markup] of Object.entries(drawn)) assert.equal(count(markup, /<h2 /g), 1, `${at} ${key}: one h2`);
    if (drawn.needs) {
      assert.equal(count(drawn.needs, /m-row__title m-row__title--strong/g), value.needs.rows.length, `${at}: strong rows`);
      assert.equal(count(drawn.needs, /m-row__tile m-tone-orange/g), value.needs.rows.length, `${at}: orange tiles`);
      assert.equal(drawn.needs.includes(`>${value.needs.more?.label}<`), Boolean(value.needs.more), `${at}: more`);
    }
    if (drawn.upcoming) {
      const {rows, note, more} = value.upcoming;
      assert.equal(count(drawn.upcoming, /class="m-row m-row--pressable/g), rows.length + (note ? 1 : 0), `${at}: a pressable row each, the note too`);
      for (const row of rows.filter(r => r.value)) assert.match(drawn.upcoming, new RegExp(`<span class="m-row__value m-num"[^>]*>${esc(row.value)}</span>`), at);
      assert.equal(drawn.upcoming.includes(`>${more?.label}<`), Boolean(more), `${at}: more`);
      if (rows.length || note) assert.match(drawn.upcoming, grid ? /m-list--plain/ : /m-list--inset/, at);
    }
    if (drawn.car) {
      const {car, carRing} = value;
      assert.match(drawn.car, new RegExp(`<svg class="m-ring m-ring--small m-tone-${carRing.tone}[^"]*" role="img" aria-label="${esc(car.bar.ariaLabel)}"`), at);
      assert.match(drawn.car, new RegExp(`<text class="m-ring__label"[^>]*>${esc(carRing.label)}</text>`), at);
      assert.equal(count(drawn.car, /<line class="m-ring__tick m-ring__tick--(?:reserve|limit)"/g), 2, `${at}: reserve and limit`);
      assert.equal(drawn.car.includes('m-ring--stale'), car.bar.stale, `${at}: stale`);
      assert.match(drawn.car, new RegExp(`<p class="m-today__headline">${esc(car.headline)}</p>`), at);
      assert.equal(drawn.car.includes(`<p class="m-today__line">${car.lastConfirmed}</p>`), Boolean(car.lastConfirmed), at);
    }
    if (drawn.live) {
      const {live} = value;
      assert.match(drawn.live, new RegExp(`<span class="m-glyph m-widget__glyph m-tone-${live.tone}"`), `${at}: the source in its tone`);
      assert.match(drawn.live, new RegExp(`<span class="m-figure__value m-num">${esc(live.figure.value)}</span>`), at);
      assert.match(drawn.live, new RegExp(`<p class="m-today__line">${esc(live.line)}</p>`), at);
    }
    if (drawn.climate) {
      const box = value.widgets.find(w => w.id === 'climate').size === 'large' ? '0 0 520 280' : '0 0 520 106';
      assert.match(drawn.climate, new RegExp(`<svg class="m-zones m-zones--widget" viewBox="${box}" role="img" aria-label="${esc(value.climate.chart.ariaLabel)}"`), at);
      assert.equal(new RegExp(`<span class="m-widget__note"[^>]*>${esc(value.climate.note ?? '')}</span>`).test(drawn.climate), Boolean(value.climate.note), at);
    }
    if (drawn.energyToday) {
      const {figure, bar, legend} = value.energyToday;
      assert.match(drawn.energyToday, new RegExp(`<p class="m-figure m-figure--${grid ? 'beside' : 'above'} m-figure--large"><span class="m-figure__label">${figure.label}</span>`), at);
      assert.equal(count(drawn.energyToday, /m-segment-bar__segment/g), bar.segments.length, at);
      assert.match(drawn.energyToday, {split: /<div class="m-segment-bar" role="img"/, missing: /<div class="m-segment-bar m-segment-bar--empty" role="img"/,
        zero: /<div class="m-segment-bar m-segment-bar--zero" role="img"/}[bar.kind], `${at}: a ${bar.kind} bar`);
      assert.deepEqual([...drawn.energyToday.matchAll(/<li class="m-legend__item">.*?<\/span>([^<]*)<\/li>/g)].map(([, text]) => text), legend.map(l => l.text), at);
    }
    const quiet = html.match(/<p class="m-quiet">[\s\S]*<\/p><\/div>$/)?.[0] ?? '';
    assert.equal(Boolean(quiet), Boolean(value.vacuumLine), `${at}: the quiet line`);
    if (value.vacuumLine) {
      assert.match(quiet, new RegExp(`<span class="m-quiet__text">${esc(value.vacuumLine.text)}</span>`), at);
      const buttons = [...quiet.matchAll(/<button class="m-button m-button--(\w+)[^"]*"[^>]*>[\s\S]*?<span class="m-button__label">([^<]*)<\/span><\/button>/g)].map(([, variant, label]) => [variant, label]);
      assert.deepEqual(buttons, value.vacuumLine.active ? [['tinted', value.vacuum.run.label], ['gray', value.vacuum.dock.label]] : [], `${at}: run and dock while active`);
    }
  });
});

test('a widget that opens a page is that one press, named by its link; the rest hold only their rows and "more"', () => {
  each((id, layout, value, html) => {
    for (const {id: key, markup} of widgets(html)) {
      const link = LINKS[key]?.(value), at = `${id} ${layout} ${key}`;
      const presses = markup.match(/<(?:button|a)\b[^>]*>/g) ?? [];
      if (link) {
        assert.equal(presses.length, 1, `${at}: one press`);
        assert.match(presses[0], /class="m-widget__press m-focusable"/, at);
        assert.equal(decode(presses[0].match(/aria-label="([^"]*)"/)[1]), link.ariaLabel, at);
        assert.doesNotMatch(markup.replace(presses[0], ''), /role="(?:button|link|switch|checkbox|radio|slider)"|tabindex=/, `${at}: nothing else focusable`);
        assert.match(markup, /<div class="m-widget__body[^"]*" aria-hidden="true">/, `${at}: read as its press alone`);
      } else {
        const rows = value[key].rows.length, more = value[key].more ? 1 : 0, note = value[key].note ? 1 : 0;
        assert.equal(presses.length, rows + more + note, `${at}: its rows, its note and more`);
        assert.doesNotMatch(markup, /m-widget__press/, at);
      }
    }
  });
});

test('every press on the page is one of the value’s Links or Controls: the chips, the widget links, the rows, "more" and the vacuum’s', () => {
  each((id, layout, value, html) => {
    const drawn = widgets(html).map(w => w.id), phone = layout === 'phone';
    const links = drawn.filter(key => ['car', 'live', 'climate', 'energyToday'].includes(key)).map(key => (key === 'car' ? value.car : value[key]).link);
    const listed = drawn.filter(key => key === 'needs' || key === 'upcoming')
      .flatMap(key => [...value[key].rows.map(row => row.link), ...(value[key].note ? [value[key].note.link] : []), ...(value[key].more ? [value[key].more] : [])]);
    const expected = [...(phone ? value.glance.items.map(item => item.link) : []), ...links, ...listed, ...(value.vacuumLine?.active ? [value.vacuum.run, value.vacuum.dock] : [])];
    assert.equal(count(html, /<button\b/g), expected.length, `${id} ${layout}`);
    assert.equal(count(html, /<a\b/g), 0, `${id} ${layout}: no anchors`);
    for (const action of expected.filter(a => a.ariaLabel)) assert.ok(names(html).includes(action.ariaLabel), `${id} ${layout}: ${action.ariaLabel}`);
  });
});

test('an unavailable reading is drawn as "—", apart from zero: a dashed ring, an empty bar, dashed capsules', () => {
  const value = valueOf('unavailable');
  for (const layout of LAYOUTS) {
    const html = draw(value, layout), at = layout;
    assert.doesNotMatch(texts(html).join('\n'), /^0(?:\.0)?(?: \w+)?$/m, `${at}: no reading drawn as 0`);
    assert.match(html, /<div class="m-segment-bar m-segment-bar--empty" role="img"/, at);
    assert.match(html, /<span class="m-figure__value m-num">—<\/span>/, at);
    if (layout === 'phone') continue;
    assert.equal(count(html, /m-zones__capsule m-zones__capsule--unavailable/g), value.climate.chart.zones.length, at);
    assert.equal(count(html, /class="m-zones__fill"/g), 0, at);
  }
  // A Car without a battery reading: an empty, dashed ring labelled '—', never an arc at 0.
  const busy = valueOf('busy'), unknown = {...busy, car: {...busy.car, bar: {...busy.car.bar, fill: null}}, carRing: {...busy.carRing, label: '—'}};
  const car = widgets(draw(unknown, 'desktop')).find(w => w.id === 'car').markup;
  assert.match(car, new RegExp(`<svg class="m-ring m-ring--small m-tone-${busy.carRing.tone} m-ring--empty"`), 'the charging tone kept, the level unknown');
  assert.doesNotMatch(car, /m-ring__fill/);
  assert.match(car, /<text class="m-ring__label"[^>]*>—<\/text>/);
  // Nothing generated or used yet is a real zero: a solid empty bar, never the dashed missing one.
  const zero = {...busy, energyToday: {...busy.energyToday, bar: {...busy.energyToday.bar, kind: 'zero', segments: []}}};
  for (const layout of LAYOUTS) {
    const bar = widgets(draw(zero, layout)).find(w => w.id === 'energyToday').markup;
    assert.match(bar, /<div class="m-segment-bar m-segment-bar--zero" role="img"/, layout);
    assert.doesNotMatch(bar, /m-segment-bar--empty/, layout);
  }
});

test('each widget’s title carries the value’s glyph, in a tone only for power now', () => {
  each((id, layout, value, html) => {
    for (const {id: key, markup} of widgets(html)) {
      const tone = key === 'live' ? ` m-tone-${value.live.tone}` : '', glyph = renderToStaticMarkup(h(Glyph, {name: GLYPHS[key](value), className: `m-widget__glyph${tone}`}));
      assert.ok(GLYPHS[key](value), `${id} ${layout} ${key}: a glyph`);
      assert.ok(markup.includes(`<h2 class="${layout === 'phone' ? 'm-section-title m-widget__title' : 'm-widget__title'}">${glyph}`), `${id} ${layout} ${key}: its glyph first in the title`);
      if (!tone) assert.doesNotMatch(markup, /m-widget__glyph m-tone-/, `${id} ${layout} ${key}: untoned`);
    }
  });
});

test('Coming up: while loading, a placeholder above the list in the events’ place, named for assistive technology, the agenda busy; the calendar’s error a muted row that opens the Full calendar', () => {
  each((id, layout, value, html) => {
    const agenda = widgets(html).find(w => w.id === 'upcoming')?.markup, at = `${id} ${layout}`;
    if (!agenda) return;
    const {loading, loadingLabel, rows, note} = value.upcoming;
    assert.match(agenda, loading ? /<div class="m-today__agenda" aria-busy="true"><div class="m-row m-today__placeholder">/ : /<div class="m-today__agenda">(?!<div class="m-row m-today__placeholder")/, at);
    assert.equal(count(agenda, /m-today__placeholder"/g), loading ? 1 : 0, at);
    if (loading) {
      assert.match(agenda, new RegExp(`<div class="m-row m-today__placeholder"><span class="m-today__placeholder-tile" aria-hidden="true"></span><span class="m-today__placeholder-copy" aria-hidden="true">.*?</span><span class="m-today__hidden">${esc(loadingLabel)}</span></div>`), `${at}: its shapes hidden, its name read`);
      assert.ok(agenda.indexOf('m-today__placeholder') < agenda.indexOf('role="list"'), `${at}: outside the list, before it`);
    }
    if (note) {
      const last = agenda.match(/<div class="m-list__item" role="listitem">((?:(?!m-list__item).)*)<\/div><\/div><\/div>/)?.[1] ?? '';
      assert.match(last, new RegExp(`^<button class="m-row m-row--pressable m-row--bare m-focusable"[^>]*aria-label="${esc(note.link.ariaLabel)}"`), `${at}: the note, last, pressable, without a tile`);
      assert.match(last, new RegExp(`<span class="m-row__title">${esc(note.text)}</span>`), at);
    }
    assert.equal(count(agenda, /role="list"/g), rows.length || note ? 1 : 0, `${at}: a list only with something in it`);
  });
  assert.ok(valueOf('paused').upcoming.loading && valueOf('unavailable').upcoming.note, 'the fixtures load and fail');
  // Loading with nothing else yet: the placeholder alone, and no empty list.
  const paused = valueOf('paused'), bare = {...paused, upcoming: {...paused.upcoming, rows: []}};
  for (const layout of LAYOUTS) {
    const agenda = widgets(draw(bare, layout)).find(w => w.id === 'upcoming').markup;
    assert.match(agenda, /<div class="m-today__agenda" aria-busy="true"><div class="m-row m-today__placeholder">.*?<\/div><\/div><\/div>/, layout);
    assert.doesNotMatch(agenda, /role="list"/, layout);
  }
});

// A zones chart's drawing: its box, each capsule's track, the target ticks'
// ends, and each reading's and name's baseline.
function drawing(props) {
  const svg = renderToStaticMarkup(h(ZonesChart, props)), number = (tag, name) => Number(tag.match(new RegExp(` ${name}="([\\d.-]+)"`))[1]);
  const [, , width, height] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  return {svg, width, height,
    tracks: [...svg.matchAll(/<rect class="m-zones__track"[^>]*>/g)].map(([tag]) => ({x: number(tag, 'x'), y: number(tag, 'y'), width: number(tag, 'width'), height: number(tag, 'height')})),
    ticks: [...svg.matchAll(/<path class="m-zones__tick" d="M([\d.-]+) ([\d.-]+)H([\d.-]+)"/g)].map(([, x1, y, x2]) => ({x1: Number(x1), y: Number(y), x2: Number(x2)})),
    readings: [...svg.matchAll(/<text class="m-zones__reading" x="([\d.]+)" y="([\d.-]+)"/g)].map(([, x, y]) => ({x: Number(x), y: Number(y)})),
    names: [...svg.matchAll(/<text class="m-zones__name" x="([\d.]+)" y="([\d.-]+)"/g)].map(([, x, y]) => ({x: Number(x), y: Number(y)}))};
}
// Each box, pinned: its size, a capsule's top, height and width, and the
// baselines of the readings above and the names below. The hero's are as
// step 3 drew them.
const BOXES = [
  ['hero, phone', {layout: 'phone'}, {width: 328, height: 190, top: 34, capsule: 126, across: 40, reading: 22, name: 182}],
  ['hero, wide', {layout: 'wide'}, {width: 470, height: 226, top: 34, capsule: 162, across: 44, reading: 22, name: 218}],
  ['hero, desktop', {layout: 'desktop'}, {width: 470, height: 226, top: 34, capsule: 162, across: 44, reading: 22, name: 218}],
  ['medium widget', {variant: 'widget', layout: 'desktop'}, {width: 520, height: 106, top: 22, capsule: 60, across: 30, reading: 14, name: 100}],
  ['large widget', {variant: 'widget', size: 'large', layout: 'desktop'}, {width: 520, height: 280, top: 34, capsule: 212, across: 40, reading: 22, name: 268}],
];
// How far text reaches from its baseline: a reading's figures (15px) about
// 11px up, a name's descenders (13px) about 4px down and its capitals 10px up.
const [FIGURE_UP, NAME_DOWN, NAME_UP] = [12, 4, 10];

test('each zones box is pinned, the hero’s as before, and every capsule, tick, reading and name sits inside it, the text clear of the capsules', () => {
  for (const id of FIXTURES) for (const [label, props, pin] of BOXES) {
    const at = `${id} ${label}`, {svg, width, height, tracks, ticks, readings, names} = drawing({value: valueOf(id).climate.chart, ...props});
    assert.match(svg, props.variant ? /^<svg class="m-zones m-zones--widget"/ : /^<svg class="m-zones" /, at);
    assert.deepEqual([width, height], [pin.width, pin.height], `${at}: box`);
    assert.equal(tracks.length, valueOf(id).climate.chart.zones.length, at);
    for (const t of tracks) {
      assert.deepEqual([t.y, t.height, t.width], [pin.top, pin.capsule, pin.across], `${at}: capsule`);
      assert.ok(t.x >= 0 && t.x + t.width <= width && t.y >= 0 && t.y + t.height <= height, `${at}: capsule inside`);
    }
    for (const k of ticks) assert.ok(k.x1 >= 0 && k.x2 <= width && k.y >= pin.top && k.y <= pin.top + pin.capsule, `${at}: tick inside`);
    for (const r of readings) {
      assert.equal(r.y, pin.reading, `${at}: reading baseline`);
      assert.ok(r.y - FIGURE_UP >= 0 && r.y <= pin.top - 4, `${at}: reading inside, over the capsule`);
    }
    for (const n of names) {
      assert.equal(n.y, pin.name, `${at}: name baseline`);
      assert.ok(n.y + NAME_DOWN <= height && n.y - NAME_UP >= pin.top + pin.capsule + 2, `${at}: name inside, under the capsule`);
    }
    for (const {x} of [...readings, ...names]) assert.ok(x >= 30 && x <= width - 30, `${at}: centred room for the text`);
  }
});

// The page's rules, one per line, as {selector, declarations}.
const RULES = todayPageStyles.trim().split('\n').map(line => line.match(/^([^{]+)\{(.*)\}$/)).filter(Boolean)
  .map(([, selector, body]) => ({selector, declarations: Object.fromEntries(body.split(';').filter(Boolean).map(d => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]))}));

test('the chips bleed to the page’s edges with margin-inline, padding-inline and scroll-padding-inline, never the margin shorthand', () => {
  const glance = RULES.filter(rule => rule.selector.includes('.m-glance'));
  assert.deepEqual(glance.map(rule => rule.selector), ['.m-today .m-glance']);
  const [{declarations}] = glance;
  assert.equal(declarations['margin-inline'], 'calc(-1 * var(--m-page-inset))');
  assert.equal(declarations['padding-inline'], 'var(--m-page-inset)');
  assert.equal(declarations['scroll-padding-inline'], 'var(--m-page-inset)');
  assert.equal(declarations['max-width'], 'calc(100% + 2 * var(--m-page-inset))', 'as wide as the bleed, no wider');
  for (const property of ['margin', 'margin-block', 'margin-top', 'margin-bottom', 'padding', 'padding-block', 'padding-top', 'padding-bottom']) {
    assert.equal(declarations[property], undefined, `${property}: the chips keep their own block margin for the focus ring`);
  }
  assert.match(draw(valueOf('busy'), 'phone'), /^<div class="m-today"><div class="m-glance"/, 'the chips sit in the page, where the rule finds them');
});

// The strings a page source writes, read from esbuild's output (which turns
// JSX text and attribute values into string literals), leaving out imports:
// each must be a class list, a lowercase token (a variant, a key, an id) or
// hold no letters; and no text prop or child may be a literal at all.
const TEXT_PROPS = /\b(?:title|label|ariaLabel|"aria-label"|text|note|line|detail|headline|value|unit|children):\s*(["`])/;
async function english(source) {
  const {code} = await transform(source, {loader: 'jsx', jsx: 'automatic'});
  const body = code.split('\n').filter(line => !/^\s*import\b/.test(line)).join('\n');
  const literals = [...body.matchAll(/"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g)].flatMap(([, quoted, template]) =>
    quoted !== undefined ? [quoted] : template.split(/\$\{[^}]*\}/));
  const token = text => !/[A-Za-z]/.test(text) || /^[a-z][A-Za-z0-9]*(?:-[a-z0-9]+)*$/.test(text) || /^m-[\w-]+(?: m-[\w-]+)*$/.test(text.trim());
  return [...literals.filter(text => !token(text)), ...body.split('\n').filter(line => TEXT_PROPS.test(line)).map(line => line.trim())];
}

test('the reader of page sources finds English in JSX text, text props and strings, and passes classes and tokens', async () => {
  assert.deepEqual(await english('export const A = () => <p className="m-a m-b">{x}</p>;'), []);
  assert.deepEqual(await english('export const A = () => <B variant="tinted" size="small" key="loading" aria-hidden="true"/>;'), []);
  assert.equal((await english('export const A = () => <p>Needs you</p>;')).length > 0, true, 'JSX text');
  assert.equal((await english('export const A = () => <W title="Car"/>;')).length > 0, true, 'a text prop');
  assert.equal((await english('export const A = () => <W ariaLabel={`Open ${x}`}/>;')).length > 0, true, 'a template');
  assert.equal((await english('export const A = () => <p>{"charging"}</p>;')).length > 0, true, 'a literal child');
});

// From v32 the scan also reads Climate's sheets, the 24-hour chart and the
// parts they are drawn with, which draw only their values' words too; from
// v33 Energy's page and sheets (by the folders) and the chip.
const UI = fileURLToPath(new URL('../frontend/maison/src/ui/', import.meta.url));
const SHEET_PARTS = ['target-bar.jsx', 'disclosure.jsx', 'date-field.jsx', 'feedback.jsx', 'day-bar.jsx', 'chip.jsx'];
test('the pages, the sheets, the chart and the sheet parts write no English: every word comes from the value', async () => {
  const pages = readdirSync(PAGES).filter(file => file.endsWith('.jsx')).map(file => join(PAGES, file));
  const drawers = readdirSync(join(SRC, 'drawers')).filter(file => file.endsWith('.jsx')).map(file => join(SRC, 'drawers', file));
  assert.ok(pages.some(file => file.endsWith('today.jsx')) && pages.some(file => file.endsWith('climate.jsx')) && drawers.some(file => file.endsWith('climate.jsx')));
  const sources = [...pages, ...drawers, join(SRC, 'charts', 'history.jsx'), ...SHEET_PARTS.map(file => join(UI, file))];
  for (const file of sources) assert.deepEqual(await english(readFileSync(file, 'utf8')), [], file);
});
