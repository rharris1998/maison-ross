// Energy (#29 step 4, v33): what EnergyPage draws
// from the value screen() hands it for every Energy fixture (covered,
// billing, night, missing) and the home's (full, quiet, missing), online and
// offline, in each layout the frame provides (phone, wide, desktop). Node
// has no JSX, so esbuild bundles the page with react-dom/server into a
// temporary module, and each test reads the markup a real value renders to:
// the phone's order (price, billing year, the money list, the chart),
// the value's widgets from 700px with Price first at wide and every row
// full; no empty heading; today's power chart with Details (the Energy
// today sheet) as its widget's action; each linked widget one press on its own link; every word and name
// taken from the value; and each body's anatomy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen, words} from '../config/www/maison/screen.js';
import {E} from '../config/www/maison/model.js';
import {ENERGY_FIXTURES, ENERGY_NIGHT_POWER_HISTORY, ENERGY_NOW, ENERGY_POWER_HISTORY} from '../frontend/maison/fixtures/energy-fixtures.js';
import {HOME_FIXTURES, HOME_MIDNIGHT} from '../frontend/maison/fixtures/home-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {energyPageStyles} from '../frontend/maison/src/pages/energy.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {EnergyPage} from './pages/energy.jsx';
export {PAGES} from './pages.jsx';
export {DAY_PLOT} from './charts/day.jsx';
export {LayoutContext} from './ui/layout.js';
export {CommandContext} from './contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;
const BUILD = {bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', loader: {'.js': 'jsx'},
  define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent'};

// The page, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-energy-'));
const bundle = await build({...BUILD, stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'},
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'energy.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'energy.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, EnergyPage, PAGES, DAY_PLOT} = ui;

const LAYOUTS = ['phone', 'wide', 'desktop'];
// Energy's fixtures, then the home's (quiet has one register without a
// billable reading), each with today's power as the gallery loads it: to
// 21:04 for the night, nothing for a missing house.
const NO_POWER = {data: {series: {}, errors: {}}, start: HOME_MIDNIGHT, end: ENERGY_NOW};
const FIXTURES = [...ENERGY_FIXTURES.map(f => ({key: `energy ${f.id}`, states: f.states, now: f.now, power: f.id === 'night' ? ENERGY_NIGHT_POWER_HISTORY : f.id === 'missing' ? NO_POWER : ENERGY_POWER_HISTORY})),
  ...HOME_FIXTURES.map(f => ({key: `home ${f.id}`, states: f.states, now: ENERGY_NOW, power: f.id === 'missing' ? NO_POWER : ENERGY_POWER_HISTORY}))];
const VARIANTS = [['', {}], [' offline', {online: false}]];
// The Energy page's value for a fixture, as the dashboard draws it.
const valueOf = (f, extra = {}) => screen(fixtureSnapshot({...extra, states: structuredClone(f.states), now: f.now,
  route: {page: 'energy', detail: null, dialog: null}, loaded: {history: {energy: f.power}}})).page;
const fixture = key => FIXTURES.find(f => f.key === key);
// A fixture with some states' readings replaced.
const patched = (key, changes) => {
  const f = structuredClone(fixture(key));
  for (const [id, state] of Object.entries(changes)) f.states[id] = {...f.states[id], state: String(state)};
  return f;
};
// Markup for Energy in a layout.
const draw = (value, layout) => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}},
  h(LayoutContext.Provider, {value: layout}, h(EnergyPage, {value}))));
const count = (html, pattern) => (html.match(pattern) || []).length;
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decode = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// The children of the element that opens at `from` in `html`, each whole,
// by counting tags (widgets hold the chart's own section, so a lazy match
// to </section> won't do).
function children(html, from) {
  const found = [], tags = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  tags.lastIndex = html.indexOf('>', from) + 1;
  let depth = 0, start = 0;
  for (let m; (m = tags.exec(html));) {
    const [, close, , self] = m;
    if (self) { if (depth === 0) found.push(m[0]); continue; }
    if (close) { if (depth === 0) break; depth -= 1; if (depth === 0) found.push(html.slice(start, tags.lastIndex)); }
    else { if (depth === 0) start = m.index; depth += 1; }
  }
  return found;
}
// The grid's (or the stack's) children, each with its widget id and size;
// the money list has neither.
const items = html => children(html, html.indexOf('<div class="m-widgets')).map(markup => {
  const [, size, id] = markup.match(/^<section class="m-widget m-widget--(\w+)" data-widget="([\w-]+)"/) ?? [];
  return {id: id ?? (markup.startsWith('<div class="m-list m-list--inset"') ? 'money-list' : markup.slice(0, 40)), size, markup};
});
const widget = (html, id) => items(html).find(w => w.id === id)?.markup;
// Every string anywhere in a value: an accessible name may be any of them.
const strings = (value, found = new Set()) => {
  if (typeof value === 'string') found.add(value);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) strings(item, found);
  return found;
};
// The visible text of some markup, one chunk per element, and its names.
const texts = html => decode(html.replace(/<[^>]+>/g, '\n')).split('\n').map(text => text.trim()).filter(Boolean);
const names = html => [...html.matchAll(/aria-label="([^"]*)"/g)].map(([, name]) => decode(name));
const presses = html => html.match(/<button\b[^>]*>/g) ?? [];
const nameOf = tag => decode(tag.match(/aria-label="([^"]*)"/)?.[1] ?? '');
// The chart's own markup (its figures and axes are energy.js's and
// day-plot.js's, which maison-day-chart.test.mjs reads).
const withoutChart = html => html.replace(/<section class="m-power[^"]*">[\s\S]*?<\/section>/g, '');
// Every fixture × variant × layout, with its value and markup.
const each = check => {
  for (const f of FIXTURES) for (const [suffix, extra] of VARIANTS) {
    const value = valueOf(f, extra);
    for (const layout of LAYOUTS) check(`${f.key}${suffix} ${layout}`, layout, value, draw(value, layout));
  }
};
// A Figure's markup, as figure.jsx draws it.
const figure = ({label, value, unit, placement = 'above', size = 'large'}) => `<p class="m-figure m-figure--${placement} m-figure--${size}">${label ? `<span class="m-figure__label">${label}</span>` : ''}`
  + `<span class="m-figure__reading"><span class="m-figure__value m-num">${value}</span>${unit ? `<span class="m-figure__unit">${unit}</span>` : ''}</span></p>`;

test('PAGES draws Energy with the recomposed page', () => {
  assert.equal(PAGES.energy, EnergyPage);
});

test('on a phone: the price, the billing year, the money list and the chart stacked, and no rates', () => {
  each((at, layout, value, html) => {
    if (layout !== 'phone') return;
    assert.match(html, /^<div class="m-energy"><div class="m-widgets m-widgets--stack">/, at);
    assert.doesNotMatch(html, /m-widgets--grid|style="grid-/, at);
    assert.deepEqual(items(html).map(w => [w.id, w.size]), [['price', 'phone'], ['year', 'phone'], ['money-list', undefined], ['chart', 'phone']], at);
    assert.ok(!html.includes(value.rates.title) && !html.includes('m-energy__dot'), `${at}: no rates`);
    assert.doesNotMatch(html, /data-widget="(?:bill|cap|rates|money)"/, `${at}: the bill and the cap are the list’s rows`);
  });
});

test('from 700px: the value’s widgets in order at their sizes, Price first at wide only, placed as placeWidgets() places them, every row full', () => {
  each((at, layout, value, html) => {
    if (layout === 'phone') return;
    const columns = COLUMNS[layout], slots = layout === 'wide' ? [{id: 'price', size: 'medium'}, ...value.widgets] : value.widgets;
    const {placements, holes, rows} = placeWidgets(slots, columns);
    assert.match(html, new RegExp(`^<div class="m-energy"><div class="m-widgets m-widgets--grid" data-columns="${columns}">`), at);
    const drawn = [...html.matchAll(/<section class="m-widget m-widget--(\w+)" data-widget="([\w-]+)" style="grid-column:([^;]+);grid-row:([^"]+)">/g)]
      .map(([, size, id, column, row]) => [id, size, column, row]);
    assert.deepEqual(drawn, placements.map(({id, column, row, columnSpan, rowSpan}, i) => [id, slots[i].size, `${column} / span ${columnSpan}`, `${row} / span ${rowSpan}`]), at);
    assert.deepEqual(holes, [], `${at}: no holes`);
    assert.equal(rows, layout === 'wide' ? 7 : 4, at);
    assert.equal(count(html, /data-widget="price"/g), layout === 'wide' ? 1 : 0, `${at}: the price only where the hero doesn't draw it`);
    assert.doesNotMatch(html, /m-list--inset/, `${at}: no money list`);
  });
  const value = valueOf(fixture('energy billing'));
  assert.deepEqual(items(draw(value, 'wide')).map(w => `${w.id}:${w.size}`), ['price:medium', 'chart:xl', 'year:medium', 'rates:medium', 'bill:medium', 'cap:medium']);
  assert.deepEqual(items(draw(value, 'desktop')).map(w => `${w.id}:${w.size}`), ['chart:xl', 'year:medium', 'rates:medium', 'bill:medium', 'cap:medium']);
  // Every row fills: the value's widgets at 2 and 4 columns, and Price
  // leading them at 2, where the wide grid draws it.
  for (const [slots, columns] of [[value.widgets, 2], [value.widgets, 4], [[{id: 'price', size: 'medium'}, ...value.widgets], 2]])
    assert.deepEqual(placeWidgets(slots, columns).holes, [], `${slots.length} widgets in ${columns}`);
});

test('no empty heading: every h2 is a widget’s title, in the value’s words', () => {
  each((at, layout, value, html) => {
    const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, inner]) => texts(inner).join(''));
    assert.equal(headings.length, items(html).filter(w => w.size).length, `${at}: one per widget`);
    assert.deepEqual(headings.filter(text => !text), [], `${at}: none empty`);
    const titles = {price: value.priceCard.title, year: value.year.title, bill: value.billCard.title, cap: value.capCard.title, chart: value.dayChart.title, rates: value.rates.title};
    assert.deepEqual(headings, items(html).filter(w => w.size).map(w => titles[w.id]), at);
  });
});

test('every word and every accessible name on the page is the value’s', () => {
  each((at, layout, value, html) => {
    const drawn = new Set(words(value)), named = strings(value);
    assert.deepEqual(texts(withoutChart(html)).filter(text => !drawn.has(text)), [], `${at}: drawn text`);
    assert.deepEqual(names(html).filter(name => !named.has(name)), [], `${at}: names`);
  });
});

// The chart's plot, or what takes its place, as it reads for each status:
// on a phone's card DAY_PLOT.phone high, or one footnote line with nothing
// to draw; in the grid filling the widget, DAY_PLOT.grid at least, the
// day's empty axes standing in with nothing to draw.
const plotOf = (status, phone) => ({
  ready: phone ? `<div class="m-power__plot"><svg class="m-power__svg"[^>]* viewBox="0 0 \\d+ ${DAY_PLOT.phone}"`
    : `<div class="m-power__plot" style="min-height:${DAY_PLOT.grid}px"><svg class="m-power__svg"[^>]* viewBox="0 0 \\d+ ${DAY_PLOT.grid}"`,
  loading: `<div class="m-power__placeholder" role="status"[^>]* style="${phone ? `height:${DAY_PLOT.phone}px` : `min-height:${DAY_PLOT.grid}px`}">`,
  empty: phone ? '<p class="m-power__state m-power__state--line">' : `<div class="m-power__blank" style="min-height:${DAY_PLOT.grid}px"><svg class="m-power__svg"`,
  error: phone ? '<p class="m-power__state m-power__state--line" role="alert">' : `<div class="m-power__blank" style="min-height:${DAY_PLOT.grid}px"><svg class="m-power__svg"`,
}[status]);
// The billing fixture with today's power loading, partly recorded,
// or unavailable, beside the fixtures' own (recorded, or nothing recorded).
const REJECTED = {history: 'Recorder unavailable'};
const CHARTS = [['loading', {history: {}, historyLoading: new Set(['energy'])}],
  ['partial', {history: {energy: {...ENERGY_POWER_HISTORY, data: {...ENERGY_POWER_HISTORY.data, errors: REJECTED}}}}],
  ['error', {history: {energy: {...ENERGY_POWER_HISTORY, data: {series: {}, errors: REJECTED}}}}]]
  .map(([key, loaded]) => [key, screen(fixtureSnapshot({states: structuredClone(fixture('energy billing').states), now: ENERGY_NOW,
    route: {page: 'energy', detail: null, dialog: null}, loaded})).page]);
test('the chart is today’s power in its widget, not linked, with the value’s Details (Energy today) as the widget’s action; DAY_PLOT.phone high on a phone, filling the xl widget from 700px', () => {
  assert.deepEqual(DAY_PLOT, {phone: 164, grid: 180});
  const check = (at, layout, value, html) => {
    const markup = widget(html, 'chart'), {dayChart} = value, phone = layout === 'phone', {status} = dayChart.model;
    assert.doesNotMatch(markup, /m-widget__press/, `${at}: not linked`);
    assert.deepEqual([dayChart.action.label, dayChart.action.intent], ['Details', {command: 'detail', entity: 'energy-today'}]);
    assert.match(markup, new RegExp(`<div class="m-widget__head"><h2[^>]*>[\\s\\S]*?${esc(dayChart.title)}</span></h2><button class="m-widget__action m-focusable"[^>]*><span class="m-widget__action-label">${esc(dayChart.action.label)}</span>`), at);
    assert.equal(presses(markup).length, 1, `${at}: the action is its one press`);
    assert.ok(markup.includes(`<div class="m-widget__body${phone ? ' m-widget__body--card' : ''}"><section class="m-power${phone ? '' : ' m-power--fill'}">`), `${at}: on the card, or filling the widget`);
    assert.doesNotMatch(markup, /<h3|<button(?![^>]*m-widget__action)/, `${at}: no title and no press of its own`);
    // The day's three figures, in every state: they are the meters'.
    assert.deepEqual([...markup.matchAll(/<div class="m-power__figure m-power__figure--(\w+)"><dt>([^<]*)<\/dt>/g)].map(([, key, label]) => `${key} ${label}`),
      ['solar Solar', 'grid Grid', 'house Consumed'], at);
    assert.match(markup, new RegExp(plotOf(status, phone)), `${at}: ${status}`);
    assert.doesNotMatch(markup, phone ? /min-height/ : /style="height:/, `${at}: a fixed height on a phone, a least one in the grid`);
    assert.equal(count(markup, /m-power__note/g), dayChart.model.partial ? 1 : 0, `${at}: the note while partly recorded`);
  };
  each(check);
  for (const [key, value] of CHARTS) for (const layout of LAYOUTS) check(`billing ${key} ${layout}`, layout, value, draw(value, layout));
  assert.deepEqual([valueOf(fixture('energy billing')), valueOf(fixture('energy missing')), ...CHARTS.map(([, value]) => value)].map(v => `${v.dayChart.model.status}${v.dayChart.model.partial ? ' partial' : ''}`),
    ['ready', 'empty', 'loading', 'ready partial', 'error'], 'every state is covered');
});

// Each link the page draws, by the widget or row that draws it.
const LINKS = {price: v => v.priceCard.link, year: v => v.year.link, bill: v => v.billCard.link, cap: v => v.capCard.link, rates: v => v.rates.link};
const INTENTS = {price: ['detail', 'price'], year: ['detail', 'billing-year'], bill: ['detail', 'bill'], cap: ['detail', 'bill'], rates: ['detail', 'price']};
test('each linked widget is one press on its own link, holding nothing else to press; the money rows open Bill', () => {
  for (const f of FIXTURES) {
    const value = valueOf(f);
    assert.deepEqual(Object.fromEntries(Object.entries(LINKS).map(([id, link]) => [id, [link(value).intent.command, link(value).intent.entity]])), INTENTS, f.key);
    // Name every link after where it comes from, so each press shows which one it draws.
    const marked = structuredClone(value);
    for (const [id, link] of Object.entries(LINKS)) link(marked).ariaLabel = `link:${id}`;
    marked.dayChart.action.ariaLabel = 'action:chart';
    for (const layout of LAYOUTS) {
      const html = draw(marked, layout), at = `${f.key} ${layout}`;
      for (const {id, size, markup} of items(html)) {
        if (id === 'chart') continue;
        const found = presses(markup);
        if (id === 'money-list') {
          assert.deepEqual(found.map(nameOf), ['link:bill', 'link:cap'], `${at}: the rows open Bill`);
          assert.equal(count(markup, /<button class="m-row m-row--pressable m-row--bare m-focusable"/g), 2, `${at}: two rows without tiles`);
          continue;
        }
        assert.deepEqual(found.map(nameOf), [`link:${id}`], `${at} ${id}:${size}: one press, its own link`);
        assert.match(found[0], /class="m-widget__press m-focusable"/, `${at} ${id}`);
        assert.doesNotMatch(markup.replace(found[0], ''), /<button|tabindex=|<input|<a\b|role="(?:switch|slider|radio)/, `${at} ${id}: nothing else to press`);
        assert.match(markup, /<div class="m-widget__body(?: m-widget__body--card)?" aria-hidden="true">/, `${at} ${id}: read as its press alone`);
      }
      const all = presses(html).map(nameOf);
      assert.deepEqual(all, {phone: ['link:price', 'link:year', 'link:bill', 'link:cap', 'action:chart'],
        wide: ['link:price', 'action:chart', 'link:year', 'link:rates', 'link:bill', 'link:cap'],
        desktop: ['action:chart', 'link:year', 'link:rates', 'link:bill', 'link:cap']}[layout], `${at}: every press`);
    }
  }
});

test('the price: the large figure with its unit, the register’s chip beside it while known, then the line', () => {
  each((at, layout, value, html) => {
    if (layout === 'desktop') return;
    const {priceCard: card} = value, chip = card.register;
    const chipMarkup = chip ? `<span class="m-chip m-tone-${chip.tone}"><span class="m-glyph m-chip__glyph"` : '';
    const markup = widget(html, 'price');
    assert.ok(markup.includes(`<div class="m-energy__price">${figure({value: card.figure, unit: card.unit})}${chipMarkup}`), at);
    if (chip) assert.ok(markup.includes(`<span class="m-chip__label">${chip.label}</span></span></div><p class="m-energy__line">${card.line}</p></div></section>`), `${at}: the chip, then the line`);
    else assert.ok(markup.includes(`</p></div><p class="m-energy__line">${card.line}</p></div></section>`), `${at}: no chip while the register is unknown`);
  });
  assert.equal(valueOf(fixture('energy missing')).priceCard.register, null, 'an unknown register is covered');
});

test('the billing year: the medium rings, peak outside, beside the two register lines, each its name in its tone, its figure and its line', () => {
  each((at, layout, value, html) => {
    const {year} = value, markup = widget(html, 'year');
    const rings = year.rings.plot.map(ring => `<g class="m-rings__ring m-tone-${ring.tone}${ring.state === 'missing' ? ' m-rings__ring--empty' : ''}">`);
    assert.ok(markup.includes('<div class="m-energy__year"><svg class="m-rings m-rings--medium" aria-hidden="true" viewBox="0 0 96 96" width="96" height="96">'), at);
    assert.deepEqual([...markup.matchAll(/<g class="m-rings__ring[^"]*">/g)].map(([tag]) => tag), rings, `${at}: peak outside, off-peak inside`);
    assert.ok(markup.includes(`<div class="m-energy__registers">${year.registers.map(r => `<div class="m-energy__register m-tone-${r.tone}"><span class="m-energy__register-name">${r.name}</span>`
      + `<span class="m-energy__register-figure m-num">${r.figure}</span><span class="m-energy__register-line">${r.line}</span></div>`).join('')}</div></div></div></section>`), at);
  });
  // The dashed ring of a register without a reading is covered.
  assert.ok(valueOf(fixture('home quiet')).year.rings.plot.some(ring => ring.state === 'missing'));
  // On a phone a line that doesn't fit beside its figure drops under it
  // whole, never wrapping word by word in the room the figure leaves.
  for (const rule of ['.m-widget--phone .m-energy__register{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:var(--m-space-2)}',
    '.m-widget--phone .m-energy__register-name{flex-basis:100%}', '.m-widget--phone .m-energy__register-line{flex:1 0 auto;max-width:100%}'])
    assert.ok(energyPageStyles.includes(`\n${rule}\n`), rule);
});

test('the bill and the cap credit: an inset list of two rows with their figures on a phone; from 700px each a medium widget, its large figure over its line', () => {
  each((at, layout, value, html) => {
    const {billCard, capCard} = value;
    if (layout === 'phone') {
      const list = widget(html, 'money-list');
      const rows = [...list.matchAll(/<button class="m-row m-row--pressable m-row--bare m-focusable"[^>]*>([\s\S]*?)<\/button>/g)].map(([, row]) => row);
      [billCard, capCard].forEach((card, i) => assert.match(rows[i], new RegExp(`^<span class="m-row__copy"><span class="m-row__title">${esc(card.title)}</span><span class="m-row__detail" id="[^"]+">${esc(card.line)}</span></span>`
        + `<span class="m-row__value m-row__value--figure m-num" id="[^"]+">${esc(card.figure)}</span><span class="m-glyph m-row__chevron"`), `${at}: ${card.title}, its figure a reading`));
      return;
    }
    for (const [id, card] of [['bill', billCard], ['cap', capCard]]) assert.ok(widget(html, id).includes(`<div class="m-energy__money">${figure({value: card.figure})}</div><p class="m-energy__line">${card.line}</p></div></section>`), `${at}: ${id}`);
  });
});

// v37: the bill and the cap are medium widgets, wide enough for any
// figure at the large size, so neither steps down any more.
test('a long bill keeps the large figure from 700px, in a medium widget', () => {
  const big = valueOf(patched('energy billing', {[E.bill]: 1234.56}));
  assert.deepEqual([big.billCard.figure, big.capCard.figure], ['1234.56 €', '12.34 €']);
  for (const layout of ['wide', 'desktop']) {
    const html = draw(big, layout);
    for (const id of ['bill', 'cap']) assert.ok(widget(html, id).includes('<div class="m-energy__money"><p class="m-figure m-figure--above m-figure--large">'), `${layout} ${id}`);
  }
  assert.doesNotMatch(energyPageStyles, /m-energy__money--step|m-energy__today|m-energy__split/, 'the step and the card’s rules left with them');
});

test('from 700px the rates: two plain rows, each a dot in its register’s tone, its name, Now as a chip in that tone on the live one and the rate as a figure, then the line', () => {
  each((at, layout, value, html) => {
    if (layout === 'phone') return;
    const {rates} = value, markup = widget(html, 'rates');
    assert.ok(markup.includes('<div class="m-widget__body" aria-hidden="true"><div class="m-energy__rates"><div class="m-list m-list--plain" role="list">'), at);
    const rows = [...markup.matchAll(/<div class="m-list__item" role="listitem"><div class="m-row m-row--bare">([\s\S]*?)<\/div><\/div>/g)].map(([, row]) => row);
    assert.equal(rows.length, 2, at);
    rates.rows.forEach((row, i) => assert.match(rows[i], new RegExp(`^<span class="m-row__copy"><span class="m-row__title"><span class="m-energy__rate"><span class="m-energy__dot m-tone-${row.tone}"></span>${esc(row.name)}`
      + `${row.badge ? `<span class="m-chip m-tone-${row.tone}"><span class="m-chip__label">${row.badge}</span></span>` : ''}</span></span></span><span class="m-row__value m-row__value--figure m-num" id="[^"]+">${esc(row.value)}</span>$`), `${at}: ${row.name}`));
    assert.doesNotMatch(markup, /m-row__badge/, `${at}: no gray capsule`);
    assert.ok(markup.endsWith(`</div></div><p class="m-energy__line">${rates.line}</p></div></section>`), `${at}: the line at the foot`);
  });
  assert.deepEqual(valueOf(fixture('energy night')).rates.rows.map(r => r.badge), [null, 'Now'], 'Now moves with the register');
  // Two 36px rows: the widget is the press, so its rows needn't be 52px.
  assert.match(energyPageStyles, /^\.m-widget:not\(\.m-widget--phone\) \.m-energy__rates \.m-row\{min-height:36px;padding-block:var\(--m-space-1\)\}$/m);
});

test('on a narrow phone a row’s value keeps its ‘€’ and the chart’s title wraps only by line, its action taking the next', () => {
  // The rows' values never break ('10234.56 €'), past the list's third of the row: the copy wraps instead.
  assert.ok(energyPageStyles.includes('\n.m-energy .m-row__value{flex:none;max-width:none;white-space:nowrap}\n'));
  // The phone's title row wraps between the title and its action, never inside the title.
  assert.ok(energyPageStyles.includes('\n.m-energy .m-widget--phone>.m-widget__head{flex-wrap:wrap}\n'));
  const markup = widget(draw(valueOf(fixture('energy billing')), 'phone'), 'chart');
  assert.match(markup, /^<section class="m-widget m-widget--phone" data-widget="chart"><div class="m-widget__head"><h2 class="m-section-title m-widget__title">/);
});

test('Energy’s colours are its tones: pink and indigo registers, no orange and no blue of its own', () => {
  assert.doesNotMatch(energyPageStyles, /--m-(?:orange|blue)/);
  assert.match(energyPageStyles, /\.m-energy__register\.m-tone-pink \.m-energy__register-name\{color:color-mix\(in srgb,var\(--m-pink\) 80%,var\(--m-label\)\)\}/);
  assert.match(energyPageStyles, /\.m-energy__register\.m-tone-indigo \.m-energy__register-name\{color:var\(--m-indigo-text\)\}/);
  // Nothing on the page is orange, and blue is left to what presses.
  each((at, layout, value, html) => assert.doesNotMatch(html, /m-tone-(?:orange|blue)\b/, at));
});
