// Climate (#29 step 4, v32): what ClimatePage draws
// from the value screen() hands it for every Climate fixture, online,
// offline and busy, in each layout the frame provides (phone, wide,
// desktop). Node has no JSX, so esbuild bundles the page with
// react-dom/server into a temporary module, and each test reads the markup a
// real value renders to: the legend, then the widgets each layout draws and
// where; every word and name taken from the value; no stepper, segmented
// control or switch on the page, since every control lives in a sheet; the
// House widget's Details and one action, never a link; each zone as one
// press, a row on a phone and a linked widget from 700px; the rails' Dry
// towels and Stop; the readings against their targets, "—" drawn apart from
// zero; and the legend's strip painted stop for stop on the value's scale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen, words} from '../config/www/maison/screen.js';
import {CLIMATE_CONTRACT, TOWEL_RAILS} from '../config/www/maison/model.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {TEMP_SCALE} from '../frontend/maison/src/ui/tokens.js';
import {tempColour} from '../frontend/maison/src/ui/temp-scale.js';
import {climatePageStyles} from '../frontend/maison/src/pages/climate.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {ClimatePage} from './pages/climate.jsx';
export {PAGES} from './pages.jsx';
export {LayoutContext} from './ui/layout.js';
export {CommandContext} from './contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;
const BUILD = {bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', loader: {'.js': 'jsx'},
  define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent'};

// The page, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-climate-'));
const bundle = await build({...BUILD, stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'},
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'climate.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'climate.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, ClimatePage, PAGES} = ui;

const LAYOUTS = ['phone', 'wide', 'desktop'];
const HOUSE_KEY = CLIMATE_CONTRACT.houseHeating;
// Each fixture as it is, offline, and with the house's write in flight.
const VARIANTS = [['', {}], [' offline', {online: false}], [' busy', {busy: new Set([HOUSE_KEY])}]];
// The Climate page's value for a fixture's states, as the dashboard draws it.
const valueOf = (states, extra = {}) => screen(fixtureSnapshot({...extra, states: structuredClone(states), route: {page: 'climate', detail: null}})).page;
const fixture = id => CLIMATE_FIXTURES.find(f => f.id === id).states;
// Markup for Climate in a layout, with a command that records what it is sent.
const draw = (value, layout, sent = []) => renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)},
  h(LayoutContext.Provider, {value: layout}, h(ClimatePage, {value}))));
const count = (html, pattern) => (html.match(pattern) || []).length;
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decode = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// Each widget's markup, in order (widgets never nest), with its id and size.
const widgets = html => [...html.matchAll(/<section class="m-widget m-widget--(\w+)" data-widget="([\w-]+)"[^>]*>[\s\S]*?<\/section>/g)]
  .map(([markup, size, id]) => ({id, size, markup}));
const widget = (html, id) => widgets(html).find(w => w.id === id)?.markup;
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
// A reading's figure row: secondary without a reading.
const figureClass = reading => typeof reading.bar.plot.reading === 'number' ? 'm-climate__figure' : 'm-climate__figure m-climate__figure--empty';
const nameOf = tag => decode(tag.match(/aria-label="([^"]*)"/)?.[1] ?? '');
// Every fixture × variant × layout, with its value and markup.
const each = check => {
  for (const f of CLIMATE_FIXTURES) for (const [suffix, extra] of VARIANTS) {
    const value = valueOf(f.states, extra);
    for (const layout of LAYOUTS) check(`${f.id}${suffix} ${layout}`, layout, value, draw(value, layout));
  }
};

test('PAGES draws Climate with the recomposed page', () => {
  assert.equal(PAGES.climate, ClimatePage);
});

test('on a phone: the legend, then House heating, the zones and the towel rails stacked', () => {
  each((at, layout, value, html) => {
    if (layout !== 'phone') return;
    assert.match(html, /^<div class="m-climate"><div class="m-climate__scale" aria-hidden="true">[\s\S]*?<\/div><div class="m-widgets m-widgets--stack">/, at);
    assert.doesNotMatch(html, /m-widgets--grid|style="grid-/, at);
    assert.deepEqual(widgets(html).map(w => [w.id, w.size]), [['house', 'phone'], ['zones', 'phone'], ['rails', 'phone']], at);
  });
});

test('from 700px: the legend, then the value’s widgets in order, at their sizes, placed as placeWidgets() places them, every row full', () => {
  each((at, layout, value, html) => {
    if (layout === 'phone') return;
    const columns = COLUMNS[layout], {placements, holes} = placeWidgets(value.widgets, columns);
    assert.match(html, new RegExp(`^<div class="m-climate"><div class="m-climate__scale" aria-hidden="true">[\\s\\S]*?</div><div class="m-widgets m-widgets--grid" data-columns="${columns}">`), at);
    const drawn = [...html.matchAll(/<section class="m-widget m-widget--(\w+)" data-widget="([\w-]+)" style="grid-column:([^;]+);grid-row:([^"]+)">/g)]
      .map(([, size, key, column, row]) => [key, size, column, row]);
    assert.deepEqual(drawn, placements.map(({id, column, row, columnSpan, rowSpan}) =>
      [id, value.widgets.find(w => w.id === id).size, `${column} / span ${columnSpan}`, `${row} / span ${rowSpan}`]), at);
    assert.deepEqual(holes, [], at);
  });
  const html = draw(valueOf(fixture('house_running')), 'desktop');
  assert.deepEqual(widgets(html).map(w => `${w.id}:${w.size}`), ['house:medium', 'attic:small', 'sam:small', 'noah:small', 'bedroom-suite:small', 'rails:medium']);
});

test('every word and every accessible name on the page is the value’s', () => {
  each((at, layout, value, html) => {
    const drawn = new Set(words(value)), named = strings(value);
    assert.deepEqual(texts(html).filter(text => !drawn.has(text)), [], `${at}: drawn text`);
    assert.deepEqual(names(html).filter(name => !named.has(name)), [], `${at}: names`);
  });
});

test('no stepper, segmented control, switch or field on the page: every control is in a sheet', () => {
  each((at, layout, value, html) => {
    assert.doesNotMatch(html, /m-stepper|m-segmented|m-switch|m-date-field|m-disclosure/, at);
    assert.doesNotMatch(html, /role="(?:switch|radiogroup|radio|slider|spinbutton|group)"|<input\b|<select\b|<textarea\b|<a\b/, at);
  });
});

test('every press is one of the value’s: House heating’s Details and one action, each zone’s link, the rails’ Details and each rail’s action', () => {
  each((at, layout, value, html) => {
    const {house, zones, rails} = value;
    const expected = [house.details, house.action, ...zones.map(z => z.link), rails.details, ...rails.rows.map(r => r.action)].filter(Boolean);
    const found = presses(html);
    assert.equal(found.length, expected.length, `${at}: ${found.length} presses`);
    // Every press is named, by its label or its ariaLabel, and each name is unique.
    const named = found.map(tag => nameOf(tag) || texts(html.slice(html.indexOf(tag)).split('</button>')[0]).join(''));
    assert.equal(new Set(named).size, named.length, `${at}: unique names: ${named.join(' | ')}`);
    for (const action of expected) assert.ok(named.includes(action.ariaLabel ?? action.label), `${at}: ${action.ariaLabel ?? action.label}`);
  });
});

test('House heating: a Details action and its one action, never a link; its reading, bar and line, compact while quiet on a phone, and the caption on a phone', () => {
  each((at, layout, value, html) => {
    const {house} = value, markup = widget(html, 'house'), phone = layout === 'phone', {reading, quiet} = house, figure = figureClass(reading);
    const known = typeof reading.bar.plot.reading === 'number';
    assert.doesNotMatch(markup, /m-widget__press|aria-hidden="true"><div class="m-climate/, `${at}: never a link`);
    assert.match(markup, new RegExp(`<button class="m-widget__action m-focusable"[^>]*aria-label="${esc(house.details.ariaLabel)}"[^>]*><span class="m-widget__action-label">${esc(house.details.label)}</span>`), at);
    assert.equal(markup.includes(`<span class="m-climate__flag">${reading.flag}</span>`), Boolean(reading.flag && known), at);
    const action = house.action ? [...markup.matchAll(/<button class="m-button m-button--(\w+) m-button--regular[^"]*"[^>]*>[\s\S]*?<span class="m-button__label"[^>]*>([^<]*)<\/span>/g)].map(([, variant, label]) => [variant, decode(label)]) : [];
    assert.deepEqual(action, house.action ? [['gray', house.action.label]] : [], `${at}: the one action, gray`);
    const bar = new RegExp(`<span class="m-target-bar m-target-bar--wide[^"]*" role="img" aria-label="${esc(reading.bar.ariaLabel)}">`);
    // The large figure is hidden wherever it is drawn: the named bar after it starts with the reading.
    const hidden = `<div class="${figure}"><div class="m-climate__figure-value" aria-hidden="true"><p class="m-figure m-figure--above m-figure--large"><span class="m-figure__reading"><span class="m-figure__value m-num">${reading.reading}</span>`;
    if (phone && quiet) {
      // Compact: the line with the reading at its end, read, and no bar; with no reading, the line alone.
      const reads = known ? `<span class="m-climate__quiet-reading">${reading.flag ? `<span class="m-climate__flag">${reading.flag}</span>` : ''}<span class="m-climate__value m-num">${reading.reading}</span></span>` : '';
      assert.ok(markup.includes(`<div class="m-climate__house m-climate__house--quiet"><div class="m-climate__quiet"><p class="m-climate__line">${reading.line}</p>${reads}</div><p class="m-climate__caption">${house.note}</p>`), `${at}: compact`);
      assert.doesNotMatch(markup, /m-target-bar|m-figure|aria-hidden="true"><p/, `${at}: no bar, no large figure`);
    } else if (phone) {
      assert.ok(markup.includes(`<div class="m-widget__body m-widget__body--card"><div class="m-climate__house">${hidden}`), `${at}: the figure first, hidden`);
      assert.match(markup, bar, `${at}: the bar named`);
      assert.ok(markup.includes(`<p class="m-climate__line">${reading.line}</p><p class="m-climate__caption">${house.note}</p>`), `${at}: the line, then the caption`);
    } else {
      assert.match(markup, bar, `${at}: the bar named`);
      assert.ok(!markup.includes(house.note), `${at}: the caption is the sheet’s`);
      // Read in order: the reading (or the line in its place), the bar, the line or the feedback, then the action it acts on.
      const lead = known ? `<div class="m-climate__reading-block">${hidden}` : `<div class="m-climate__reading-block"><p class="m-climate__line m-climate__lead">${reading.line}</p><span class="m-target-bar`;
      assert.ok(markup.includes(lead), `${at}: ${known ? 'the figure' : 'the line'} first`);
      const order = [known ? 'm-climate__figure' : 'm-climate__lead', 'm-target-bar', ...(known || house.feedback ? [house.feedback ? 'm-feedback' : '<p class="m-climate__line">'] : []), ...(house.action ? ['m-button m-button--gray'] : [])].map(key => markup.indexOf(key));
      assert.ok(!order.includes(-1), `${at}: ${order}`);
      assert.deepEqual(order, [...order].sort((a, b) => a - b), `${at}: DOM order`);
      if (house.action) assert.match(markup, /<\/button><\/div><\/div><\/section>$/, `${at}: the action last`);
      assert.equal(count(markup, new RegExp(esc(`>${reading.line}</p>`), 'g')), house.feedback && known ? 0 : 1, `${at}: the line once, unless feedback takes its place`);
    }
    assert.equal(count(markup, /m-feedback/g), house.feedback ? 1 : 0, at);
  });
  // The fixtures cover each form: running, quiet with a reading, quiet without one.
  assert.deepEqual(['house_running', 'house_off', 'house_away', 'house_unknown', 'contract_missing', 'sensors_unavailable'].map(id => valueOf(fixture(id)).house.quiet), [false, true, true, true, true, true]);
});

test('the House card’s feedback: under the action on a phone, in the line’s place from 700px', () => {
  const said = 'House heating override cancelled: confirmed by the thermostat';
  const value = valueOf(fixture('house_override'), {feedback: new Map([[HOUSE_KEY, said]])});
  assert.equal(value.house.feedback, said);
  assert.ok(widget(draw(value, 'phone'), 'house').includes(`<span class="m-button__label">${value.house.action.label}</span></button><p class="m-feedback">${said}</p>`));
  for (const layout of ['wide', 'desktop']) {
    const markup = widget(draw(value, layout), 'house');
    assert.match(markup, new RegExp(`</span><p class="m-feedback">${esc(said)}</p><button class="m-button m-button--gray[^"]*"[^>]*>[\\s\\S]*?</button></div></div></section>$`), layout);
    assert.ok(!markup.includes(value.house.reading.line), layout);
  }
  // Busy, the action is pending: focusable, aria-disabled; offline, it is disabled.
  const busy = widget(draw(valueOf(fixture('house_override'), {busy: new Set([HOUSE_KEY])}), 'phone'), 'house');
  assert.match(busy, /<button class="m-button m-button--gray[^"]*"[^>]*aria-disabled="true"[^>]*data-pending="true"/);
  const offline = widget(draw(valueOf(fixture('house_away'), {online: false}), 'desktop'), 'house');
  assert.match(offline, /<button class="m-button m-button--gray[^"]*"[^>]*disabled=""/);
});

test('on a phone each zone is a row that opens its sheet with its link: a tinted glyph, its name in headline with its flag, its line, and the reading over its hidden bar', () => {
  for (const f of CLIMATE_FIXTURES) {
    const value = valueOf(f.states), markup = widget(draw(value, 'phone'), 'zones'), at = f.id;
    assert.match(markup, /<div class="m-widget__body"><div class="m-list m-list--inset" role="list">/, `${at}: an inset list, no card`);
    const rows = [...markup.matchAll(/<button class="m-row m-row--pressable([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)];
    assert.equal(rows.length, value.zones.length, at);
    value.zones.forEach(({opener, reading, link}, i) => {
      const [tag, modifiers, row] = [rows[i][0], rows[i][1], rows[i][2]], known = typeof reading.bar.plot.reading === 'number', where = `${at} ${opener.name}`;
      assert.equal(nameOf(tag), link.ariaLabel, `${where}: pressed and named by the zone’s link`);
      assert.doesNotMatch(tag, /aria-describedby/, `${where}: its name says the line; not described again`);
      assert.match(nameOf(tag), new RegExp(`^${esc(opener.name)}: .*Open ${esc(opener.name)}$`), `${where}: the name sheet.touch.spec finds`);
      assert.equal(modifiers.includes('m-row--unavailable'), !known, where);
      if (known) assert.ok(row.includes(`<span class="m-row__tile m-tone-gray m-row__tile--tint" style="color:${tempColour(reading.bar.plot.reading)}">`), `${where}: tinted by its reading`);
      else assert.match(row, /^<span class="m-row__tile">/, `${where}: a dashed tile`);
      assert.ok(row.includes(`<span class="m-row__title m-row__title--strong">${opener.name}</span>`), where);
      assert.equal(row.includes(`<span class="m-row__badge">${reading.flag}</span>`), Boolean(reading.flag), `${where}: the flag`);
      assert.match(row, new RegExp(`<span class="m-row__detail" id="[^"]+">${esc(reading.line)}</span>`), where);
      assert.match(row, new RegExp(`<span class="m-row__trailing"><span class="m-climate__trailing"><span class="m-climate__value m-num">${esc(reading.reading)}</span><span class="m-target-bar m-target-bar--row[^"]*" aria-hidden="true">`), `${where}: the reading over its bar`);
    });
    assert.doesNotMatch(markup, /role="img"/, `${at}: the rows name their bars`);
    assert.doesNotMatch(markup, /m-row__chevron|m-row__accessory/, at);
  }
  const humid = widget(draw(valueOf(fixture('dry_humid')), 'phone'), 'zones');
  assert.deepEqual([...humid.matchAll(/<span class="m-row__badge">([^<]*)<\/span>/g)].map(([, flag]) => flag), ['Dry air', 'Humid']);
});

test('from 700px each zone is a small widget that is one press, its link, its body the reading with its flag, the bar and the line', () => {
  each((at, layout, value, html) => {
    if (layout === 'phone') return;
    for (const {id, opener, reading, link} of value.zones) {
      const markup = widget(html, id), where = `${at} ${id}`, found = presses(markup);
      assert.match(markup, /^<section class="m-widget m-widget--small"/, where);
      assert.equal(found.length, 1, `${where}: one press`);
      assert.match(found[0], /class="m-widget__press m-focusable"/, where);
      assert.equal(nameOf(found[0]), link.ariaLabel, where);
      assert.ok(markup.includes(`>${opener.name}</button>`), `${where}: titled by the zone`);
      assert.ok(markup.includes(`<div class="m-widget__body" aria-hidden="true"><div class="m-climate__reading-block"><div class="${figureClass(reading)}"><p class="m-figure`), `${where}: read as its press alone`);
      assert.ok(markup.includes(`<span class="m-figure__value m-num">${reading.reading}</span></span></p>${reading.flag ? `<span class="m-climate__flag">${reading.flag}</span>` : ''}</div>`), `${where}: the reading, its flag beside it`);
      assert.match(markup, /<span class="m-target-bar m-target-bar--wide[^"]*" aria-hidden="true">/, where);
      assert.doesNotMatch(markup.replace(found[0], ''), /role="img"|tabindex=/, `${where}: nothing else to focus or name`);
      assert.ok(markup.includes(`<p class="m-climate__line">${reading.line}</p></div></div></section>`), `${where}: the line last`);
    }
  });
});

test('the towel rails: their glyph, Details, and a primary row per rail with its line and its action, Dry towels (tinted) or Stop (gray); the caption on a phone only', () => {
  const override = valueOf(fixture('house_override'));
  assert.deepEqual(override.rails.rows.map(r => r.action?.label), ['Stop', 'Dry towels'], 'the fixture has both');
  for (const layout of LAYOUTS) assert.deepEqual([...widget(draw(override, layout), 'rails').matchAll(/<button class="m-button m-button--(\w+)[^>]*>[\s\S]*?<span class="m-button__label"[^>]*>([^<]*)</g)].map(([, variant, label]) => `${label}:${variant}`),
    ['Stop:gray', 'Dry towels:tinted'], `${layout}: Stop gray, as every cancel; Dry towels tinted`);
  const busy = valueOf(fixture('house_override'), {busy: new Set([TOWEL_RAILS[0].drying])});
  assert.equal(busy.rails.rows[0].action.busy, true, 'a rail’s own write in flight');
  const cases = [...CLIMATE_FIXTURES.map(f => [f.id, valueOf(f.states)]), ['house_override offline', valueOf(fixture('house_override'), {online: false})], ['house_override busy', busy]];
  // Away and an unavailable rail have no action: the line says why. Offline keeps it, disabled.
  for (const id of ['house_away', 'sensors_unavailable']) assert.deepEqual(valueOf(fixture(id)).rails.rows.map(r => r.action), [null, null], id);
  assert.ok(cases.some(([, v]) => v.rails.rows.some(r => r.action && !r.action.enabled && !r.action.busy)), 'a disabled action is covered');
  for (const [at, value] of cases) for (const layout of LAYOUTS) {
    const {rails} = value, markup = widget(draw(value, layout), 'rails'), where = `${at} ${layout}`, phone = layout === 'phone';
    assert.match(markup, new RegExp(`<button class="m-widget__action m-focusable"[^>]*aria-label="${esc(rails.details.ariaLabel)}"`), where);
    assert.equal(rails.icon, 'bath', where);
    assert.match(markup, /<h2 class="(?:m-section-title )?m-widget__title"><span class="m-glyph m-widget__glyph" aria-hidden="true"><svg[^>]*data-icon="[^"]*bath/, `${where}: the rails’ glyph`);
    assert.match(markup, phone ? /<div class="m-widget__body"><div class="m-list m-list--inset" role="list">/ : /<div class="m-widget__body"><div class="m-list m-list--plain" role="list">/, where);
    const rows = [...markup.matchAll(/<div class="m-list__item" role="listitem"><div class="m-row">([\s\S]*?)<\/div><\/div>/g)].map(([, row]) => row);
    assert.equal(rows.length, rails.rows.length, where);
    rails.rows.forEach((rail, i) => {
      assert.ok(rows[i].includes(`<span class="m-row__title m-row__title--strong">${rail.name}</span>`), `${where}: strong, as a zone`);
      assert.match(rows[i], new RegExp(`<span class="m-row__detail" id="[^"]+">${esc(rail.line)}</span>`), where);
      const button = rows[i].match(/<span class="m-row__accessory"><button class="m-button m-button--(\w+) m-button--regular[^"]*"([^>]*)>[\s\S]*?<span class="m-button__label"[^>]*>([^<]*)<\/span>/);
      if (!rail.action) return assert.equal(button, null, `${where}: no accessory without an action`);
      assert.deepEqual([button[1], decode(button[3])], [rail.action.intent.command === 'drying-stop' ? 'gray' : 'tinted', rail.action.label], where);
      assert.equal(nameOf(`<b ${button[2]}>`), rail.action.ariaLabel ?? '', where);
      if (rail.action.busy) assert.match(button[2], /aria-disabled="true"/, `${where}: pending`);
      else if (!rail.action.enabled) assert.match(button[2], /disabled=""/, `${where}: disabled`);
    });
    assert.equal(count(markup, /m-climate__footer/g), phone && rails.caption ? 1 : 0, `${where}: the caption is the list’s footer on a phone, while there is one`);
    if (phone && rails.caption) assert.ok(markup.includes(`<p class="m-climate__caption m-climate__footer">${rails.caption}</p>`), where);
  }
});

test('a missing reading is drawn as "—" over a dashed bar, never as a zero', () => {
  const value = valueOf(fixture('sensors_unavailable'));
  for (const layout of LAYOUTS) {
    const html = draw(value, layout);
    assert.doesNotMatch(texts(html).join('\n'), /(?<![\d.])0(?:\.0)?°/, `${layout}: no reading drawn as 0°`);
    // The House leads with its line (quiet on a phone: no bar; from 700px the line in the reading's row); every zone draws '—' over a dashed bar.
    const house = layout === 'phone' ? 0 : 1;
    assert.equal(count(html, /m-target-bar--empty/g), house + value.zones.length, `${layout}: every bar dashed`);
    assert.doesNotMatch(html, /m-target-bar__dot|m-target-bar__span/, layout);
    assert.equal(count(html, /<span class="m-figure__value m-num">—<\/span>|<span class="m-climate__value m-num">—<\/span>/g), value.zones.length, layout);
    assert.equal(count(html, /m-climate__figure--empty/g), layout === 'phone' ? 0 : value.zones.length, `${layout}: every figure's dash secondary`);
    assert.ok(widget(html, 'house').includes(layout === 'phone' ? `<div class="m-climate__quiet"><p class="m-climate__line">${value.house.reading.line}</p></div>` : `<p class="m-climate__line m-climate__lead">${value.house.reading.line}</p>`), `${layout}: the House leads with its line`);
  }
  // Away's holiday target sits below the scale: its tick at the start, never off it.
  const away = widget(draw(valueOf(fixture('house_away')), 'desktop'), 'house');
  assert.match(away, /<span class="m-target-bar__tick" style="left:0%"><\/span>/);
});

// The legend's strip, from the page's styles: each stop's token and place.
const STRIP = climatePageStyles.match(/^\.m-climate__scale-strip\{.*background:linear-gradient\(90deg,(.*)\)\}$/m)[1];
test('the legend names the scale’s ends and the target in the value’s words, and its strip is the room scale stop for stop over the value’s range', () => {
  const {scale} = valueOf(fixture('house_running')), {min, max} = scale.plot;
  const legend = draw(valueOf(fixture('house_running')), 'phone').match(/<div class="m-climate__scale" aria-hidden="true">([\s\S]*?)<\/div>/)[1];
  assert.deepEqual(texts(legend), [scale.low, scale.high, scale.target]);
  assert.match(legend, /<span class="m-climate__scale-key"><span class="m-climate__scale-tick"><\/span>/);
  const stops = [...STRIP.matchAll(/var\(--m-temp-(\d)\) ([\d.]+)%/g)].map(([, index, at]) => [Number(index), Number(at)]);
  assert.deepEqual(stops, TEMP_SCALE.map(([at], i) => [i + 1, Number(((at - min) / (max - min) * 100).toFixed(3))]));
  // The hottest stop lies past the end, so the strip ends on the end's own colour.
  assert.ok(TEMP_SCALE.at(-1)[0] > max && TEMP_SCALE[0][0] > min);
});
