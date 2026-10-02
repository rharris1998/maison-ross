// Home status (#29 step 4, v35): what SystemPage
// draws from the value screen() hands it for every home fixture (full,
// quiet, missing), online and offline, with the catalogue's filters at
// their defaults, at a short page (Show more), matching nothing and on one
// category, in each layout the frame provides (phone, wide, desktop). Node
// has no JSX, so esbuild bundles the page and its parts with
// react-dom/server into a temporary module, and each test reads the markup
// a real value renders to: the five sections, each once, the checks before
// All sensors in the DOM (Home Assistant moved after All sensors on a phone
// by the page's CSS, two columns from 700px); each section's rows, tones
// and footnote; the search field and the picker, which send the value's
// intents; every word the value's. Wording is the value's (system.js may
// change it): the tests read every string from the value, never an English
// literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build, transform} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen, words} from '../config/www/maison/screen.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {SHARED} from '../frontend/maison/src/ui/tokens.js';
import {systemPageStyles} from '../frontend/maison/src/pages/system.css.js';
import {searchFieldStyles} from '../frontend/maison/src/ui/search-field.css.js';
import {pickerStyles} from '../frontend/maison/src/ui/picker.css.js';
import {chipStyles} from '../frontend/maison/src/ui/chip.css.js';

const SOURCE = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {SystemPage} from './pages/system.jsx';
export {PAGES} from './pages.jsx';
export {SearchField, Picker, uiStyles} from './ui/index.js';
export {LayoutContext} from './ui/layout.js';
export {CommandContext} from './contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The page and its parts, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-system-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: SOURCE, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'system.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'system.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, SystemPage, PAGES, SearchField, Picker, uiStyles} = ui;

const LAYOUTS = ['phone', 'wide', 'desktop'];
// The catalogue's filters: the defaults, a short page (so Show more is
// drawn), a query nothing matches, and one category.
const FILTERS = [['', {}], [' short', {limit: 3}], [' unmatched', {query: 'zzzz-no-such-sensor'}], [' battery', {category: 'battery'}]];
const VARIANTS = [['', {}], [' offline', {online: false}]];
// Home status's value for a fixture, as the dashboard draws it.
const valueOf = (f, extra = {}, filters = {}) => screen(fixtureSnapshot({...extra, now: HOME_NOW, states: structuredClone(f.states),
  route: {page: 'system', detail: null, dialog: null}, sensors: {query: '', category: 'all', limit: 60, ...filters}})).page;
// Markup for Home status in a layout, with a command that records what it is sent.
const draw = (value, layout, sent = []) => renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)},
  h(LayoutContext.Provider, {value: layout}, h(SystemPage, {value}))));
// An element a component returns, drawn inside a render so its hooks run.
function rendered(component, props, sent = [], layout = 'phone') {
  let element;
  renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)},
    h(LayoutContext.Provider, {value: layout}, h(() => { element = component(props); return null; }))));
  return element;
}
const count = (html, pattern) => (html.match(pattern) || []).length;
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decode = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const encode = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
// Glyphs drawn by their class only, so markup reads short.
const bare = html => html.replace(/<span class="(m-glyph[^"]*)" aria-hidden="true"><svg[\s\S]*?<\/svg><\/span>/g, '<glyph class="$1"/>');
// React Aria's own name for the clear button, in its own strings.
const CLEAR = 'Clear search';
// Every string anywhere in a value: an accessible name may be any of them.
const strings = (value, found = new Set()) => {
  if (typeof value === 'string') found.add(value);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) strings(item, found);
  return found;
};
// The visible text of some markup, one chunk per element, and its names.
const texts = html => decode(html.replace(/<[^>]+>/g, '\n')).split('\n').map(text => text.trim()).filter(Boolean);
const names = html => [...html.matchAll(/aria-label="([^"]*)"/g)].map(([, name]) => decode(name));
// The markup of the element that opens at `from`, whole, by counting tags.
function element(html, from) {
  const tags = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  tags.lastIndex = from;
  let depth = 0;
  for (let m; (m = tags.exec(html));) {
    const [, close, , self] = m;
    if (self || /^(?:input|br|img)$/i.test(m[2]) && !close) { if (depth === 0) return m[0]; continue; }
    depth += close ? -1 : 1;
    if (depth === 0) return html.slice(from, tags.lastIndex);
  }
  throw new Error('unclosed element');
}
// A section's markup by its id, and every section id in DOM order.
const section = (html, id) => element(html, html.indexOf(`<section class="m-system-page__section m-system-page__section--${id}">`));
const sectionIds = html => [...html.matchAll(/<section class="m-system-page__section m-system-page__section--([\w-]+)">/g)].map(([, id]) => id);
// A list's rows, each with its classes, tile tone, title, detail and value.
const rows = markup => [...bare(markup).matchAll(/<div class="m-list__item" role="listitem">([\s\S]*?)<\/(?:button|div)><\/div>/g)].map(([, row]) => ({
  pressable: row.startsWith('<button'),
  cls: row.match(/^<\w+ class="([^"]*)"/)[1],
  disabled: /^<button[^>]* disabled=""/.test(row),
  tile: row.match(/<span class="m-row__tile(?: m-tone-(\w+))?">/)?.[1] ?? (row.includes('m-row__tile') ? 'none' : null),
  title: decode(row.match(/<span class="m-row__title(?: m-row__title--strong)?">([^<]*)<\/span>/)[1]),
  strong: row.includes('m-row__title--strong'),
  detail: row.match(/<span class="m-row__detail"[^>]*>([^<]*)<\/span>/)?.[1],
  value: row.match(/<span class="m-row__value m-num"[^>]*>([^<]*)<\/span>/)?.[1],
  chevron: row.includes('m-row__chevron'),
})).map(row => ({...row, detail: row.detail && decode(row.detail), value: row.value && decode(row.value)}));
// Every fixture × variant × filter × layout, with its value and markup.
const each = check => {
  for (const f of HOME_FIXTURES) for (const [suffix, extra] of VARIANTS) for (const [filter, filters] of FILTERS) {
    const value = valueOf(f, extra, filters);
    for (const layout of LAYOUTS) check(`${f.id}${suffix}${filter} ${layout}`, layout, value, draw(value, layout));
  }
};
// A rule's declarations, from a stylesheet written one rule per line.
function rule(css, selector) {
  const line = css.split('\n').find(text => text.startsWith(`${selector}{`));
  assert.ok(line, `${selector} is a rule`);
  return Object.fromEntries(line.slice(selector.length + 1, -1).split(/;(?![^(]*\))/).map(part => [part.slice(0, part.indexOf(':')), part.slice(part.indexOf(':') + 1)]));
}

test('PAGES draws Home status with the recomposed page, and ui/index.js exports the field and the picker with their styles after the chip', () => {
  assert.equal(PAGES.system, SystemPage);
  assert.equal(typeof SearchField, 'function');
  assert.equal(typeof Picker, 'function');
  assert.ok(uiStyles.includes(chipStyles + searchFieldStyles + pickerStyles), 'appended after the chip, the toast’s after them');
});

test('the five sections, each once at every width: the checks’ box, then All sensors’, the checks in the order Needs attention, Key devices, Vacuum maintenance, Home Assistant', () => {
  each((at, layout, value, html) => {
    assert.ok(html.startsWith(`<div class="m-system-page m-system-page--${layout}"><div class="m-system-page__checks">`), at);
    const checks = element(html, html.indexOf('<div class="m-system-page__checks">'));
    assert.deepEqual(sectionIds(checks), ['needs', 'devices', 'vacuum', 'home-assistant'], `${at}: the checks`);
    assert.ok(html.endsWith(`<div class="m-system-page__sensors">${section(html, 'sensors')}</div></div>`), `${at}: All sensors' box last`);
    assert.deepEqual(sectionIds(html), ['needs', 'devices', 'vacuum', 'home-assistant', 'sensors'], `${at}: no section twice`);
    assert.equal(count(html, /<section/g), 5, at);
    const headings = [...html.matchAll(/<div class="m-system-page__head"><h2 class="m-section-title">([^<]*)<\/h2>/g)].map(([, text]) => decode(text));
    assert.deepEqual(headings, [value.needs.title, value.devices.title, value.vacuum.title, value.homeAssistant.title, value.sensors.title], `${at}: the value's titles`);
    assert.equal(count(html, /<h[1-6]\b/g), 5, `${at}: no other heading`);
    assert.doesNotMatch(html, /m-system-page__checks--tall/, `${at}: never tall before it is measured`);
  });
});

test('each section is titled as every page’s are: SectionTitle’s 22px title, 4px in, 8px over its list, with no top margin of its own', () => {
  assert.deepEqual(rule(systemPageStyles, '.m-system-page__head'), {display: 'flex', 'align-items': 'center', gap: 'var(--m-space-2)', 'min-width': '0', 'padding-inline': 'var(--m-space-1)'});
  assert.deepEqual(rule(systemPageStyles, '.m-system-page__head>.m-section-title'), {flex: '0 1 auto', margin: '0', 'min-width': '0', 'overflow-wrap': 'anywhere'});
  assert.equal(rule(systemPageStyles, '.m-system-page__section').gap, 'var(--m-space-2)');
  assert.doesNotMatch(systemPageStyles, /m-system-page__heading|--m-type-headline/, 'no headline-sized heading of its own');
});

test('on a phone the checks’ box gives way and Home Assistant follows All sensors; from 700px two equal columns, the checks sticky under the pill until they are too tall', () => {
  assert.deepEqual(rule(systemPageStyles, '.m-system-page'), {display: 'flex', 'flex-direction': 'column', gap: 'var(--m-space-6)', 'min-width': '0'});
  assert.deepEqual(rule(systemPageStyles, '.m-system-page--phone>.m-system-page__checks'), {display: 'contents'});
  assert.deepEqual(rule(systemPageStyles, '.m-system-page--phone .m-system-page__section--home-assistant'), {order: '1', 'overflow-anchor': 'none'},
    'the phone’s order: … All sensors, Home Assistant, which never anchors the scroll, so Show more stays where it was');
  assert.deepEqual(rule(systemPageStyles, '.m-system-page:not(.m-system-page--phone)'),
    {display: 'grid', 'grid-template-columns': 'repeat(2,minmax(0,1fr))', 'align-items': 'start', 'column-gap': 'var(--m-widget-gap)'});
  assert.deepEqual(rule(systemPageStyles, '.m-system-page:not(.m-system-page--phone)>.m-system-page__checks'),
    {position: 'sticky', top: 'calc(var(--header-height,0px) + var(--safe-area-inset-top,env(safe-area-inset-top,0px)) + var(--m-tabbar-reach) + var(--m-space-4))'});
  assert.deepEqual(rule(systemPageStyles, '.m-system-page:not(.m-system-page--phone)>.m-system-page__checks.m-system-page__checks--tall'), {position: 'static'});
  // Nothing the page writes makes a containing block for the phone's fixed tab bar.
  assert.doesNotMatch(systemPageStyles, /[{;](?:transform|filter|backdrop-filter|contain|container-type|will-change|perspective):/);
});

test('Needs attention: each alert a strong row with an orange tile that opens its entity; none, one row of the value’s words on a gray check', () => {
  let alerts = 0, none = 0;
  each((at, layout, value, html) => {
    const drawn = rows(section(html, 'needs')), {needs} = value;
    const expected = needs.rows.map(row => ({pressable: true, tile: 'orange', title: row.title, strong: true, detail: row.detail, value: undefined, chevron: true}));
    if (needs.empty) expected.push({pressable: false, tile: 'gray', title: needs.empty, strong: false, detail: undefined, value: undefined, chevron: false});
    assert.deepEqual(drawn.map(({pressable, tile, title, strong, detail, value: v, chevron}) => ({pressable, tile, title, strong, detail, value: v, chevron})), expected, at);
    assert.ok(drawn.length > 0, `${at}: never an empty list`);
    assert.doesNotMatch(section(html, 'needs'), /m-system-page__footer|m-chip/, `${at}: no footnote, no count chip`);
    if (needs.rows.length) alerts += 1; else none += 1;
  });
  assert.ok(alerts > 0 && none > 0, 'both are covered');
});

test('Key devices: each unavailable one an orange row that opens it, or the value’s line on a gray check; the note under the list', () => {
  let down = 0, all = 0;
  each((at, layout, value, html) => {
    const markup = section(html, 'devices'), drawn = rows(markup), {devices} = value;
    const expected = devices.rows.map(row => ({tile: 'orange', title: row.title, strong: true, detail: row.detail, pressable: Boolean(row.link)}));
    if (devices.line) expected.push({tile: 'gray', title: devices.line, strong: false, detail: undefined, pressable: false});
    assert.deepEqual(drawn.map(({tile, title, strong, detail, pressable}) => ({tile, title, strong, detail, pressable})), expected, at);
    assert.ok(markup.endsWith(`<p class="m-system-page__footer">${encode(devices.note)}</p></section>`), `${at}: the note`);
    if (devices.rows.length) down += 1; else all += 1;
  });
  assert.ok(down > 0 && all > 0, 'both are covered');
});

test('Vacuum maintenance: one row per consumable with its value; orange only where the value says (Due), and — never 0', () => {
  const tones = new Set();
  each((at, layout, value, html) => {
    const drawn = rows(section(html, 'vacuum'));
    assert.deepEqual(drawn.map(({tile, title, value: v, chevron}) => ({tile, title, value: v, chevron})),
      value.vacuum.rows.map(row => ({tile: row.tone ?? 'gray', title: row.title, value: row.value, chevron: true})), at);
    for (const row of value.vacuum.rows) tones.add(`${row.value === 'Due' ? 'due' : row.value === '—' ? 'missing' : 'hours'}:${row.tone ?? 'gray'}`);
  });
  assert.deepEqual([...tones].sort(), ['due:orange', 'hours:gray', 'missing:gray']);
});

test('Home Assistant: each row opens its link, with a chevron, and its value while it has one', () => {
  each((at, layout, value, html) => {
    const drawn = rows(section(html, 'home-assistant'));
    assert.deepEqual(drawn.map(({pressable, tile, title, value: v, chevron}) => ({pressable, tile, title, value: v, chevron})),
      value.homeAssistant.rows.map(row => ({pressable: true, tile: 'gray', title: row.title, value: row.value ?? undefined, chevron: true})), at);
    assert.deepEqual(value.homeAssistant.rows.map(row => row.link.intent.command), ['ha-settings', 'more'], at);
  });
});

test('All sensors: the count beside the heading, the field, the picker and the summary, the readings, the empty row, Show more last and bare, then the note', () => {
  const seen = new Set();
  each((at, layout, value, html) => {
    const {sensors} = value, markup = bare(section(html, 'sensors'));
    assert.ok(markup.startsWith(`<section class="m-system-page__section m-system-page__section--sensors"><div class="m-system-page__head"><h2 class="m-section-title">${encode(sensors.title)}</h2>`
      + `<span class="m-chip m-tone-gray"><span class="m-chip__label">${encode(sensors.count)}</span></span></div><div class="m-search-field"`), `${at}: the head, then the field`);
    assert.match(markup, new RegExp(`</div><div class="m-system-page__filter"><span class="m-picker"><span class="m-picker__label">[^<]*</span><glyph class="m-glyph m-picker__chevron"/><select class="m-picker__select"[^>]*>[\\s\\S]*?</select></span>`
      + `<p class="m-system-page__summary">${esc(encode(sensors.summary))}</p></div><div class="m-system-page__readings"><div class="m-list m-list--inset" role="list">`), `${at}: the filter line`);
    assert.ok(markup.endsWith(`</div></div><p class="m-system-page__footer">${encode(sensors.note)}</p></section>`), `${at}: the note last`);
    const drawn = rows(element(markup, markup.indexOf('<div class="m-system-page__readings">')));
    const expected = sensors.rows.map(row => ({pressable: true, cls: `m-row m-row--pressable${row.unavailable ? ' m-row--unavailable' : ''} m-focusable`,
      tile: row.unavailable ? 'none' : 'gray', title: row.title, detail: row.detail, value: row.value, chevron: true}));
    if (sensors.empty) expected.push({pressable: false, cls: 'm-row', tile: 'gray', title: sensors.empty, detail: undefined, value: undefined, chevron: false});
    if (sensors.more) expected.push({pressable: true, cls: 'm-row m-row--pressable m-row--bare m-focusable', tile: null, title: sensors.more.label, detail: undefined, value: undefined, chevron: false});
    assert.deepEqual(drawn.map(({pressable, cls, tile, title, detail, value: v, chevron}) => ({pressable, cls, tile, title, detail, value: v, chevron})), expected, at);
    if (sensors.rows.length) seen.add('rows');
    if (sensors.rows.some(row => row.unavailable)) seen.add('unavailable');
    if (sensors.empty) seen.add('empty');
    if (sensors.more) seen.add('more');
  });
  assert.deepEqual([...seen].sort(), ['empty', 'more', 'rows', 'unavailable'], 'every kind of row is covered');
});

test('a row’s value never breaks, inside a number or anywhere: one line up to 45% of the row (60% beside Home Assistant’s short titles), cut short with an ellipsis', () => {
  assert.deepEqual(rule(systemPageStyles, '.m-system-page .m-row__value'), {'max-width': '45%', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap'});
  assert.deepEqual(rule(systemPageStyles, '.m-system-page .m-system-page__section--home-assistant .m-row__value'), {'max-width': '60%'});
  assert.deepEqual(rule(systemPageStyles, '.m-system-page__section--home-assistant .m-row__copy'), {'min-width': 'min-content'}, 'Core updates keeps its words whole');
  assert.doesNotMatch(systemPageStyles, /\.m-row__value\{[^}]*overflow-wrap/, 'nothing lets it break again');
});

test('the search field draws the value’s query, placeholder and name, 44px, its clear button hidden while empty, disabled while its link is', () => {
  const value = valueOf(HOME_FIXTURES[0]), search = value.sensors.search;
  const drawn = link => bare(renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, h(SearchField, {link}))));
  const empty = drawn(search);
  assert.match(empty, /^<div class="m-search-field" data-rac="" data-empty="true"><glyph class="m-glyph m-search-field__glyph"\/><input /);
  const input = empty.match(/<input [^>]*>/)[0];
  for (const [name, text] of [['aria-label', search.ariaLabel], ['placeholder', search.placeholder], ['value', ''], ['type', 'search'], ['class', 'm-search-field__input']])
    assert.match(input, new RegExp(` ${name}="${esc(encode(text))}"`), name);
  assert.match(empty, /<button class="m-search-field__clear" data-rac="" type="button" tabindex="-1"[^>]*><glyph class="m-glyph"\/><\/button><\/div>$/, 'the clear button, out of the Tab order');
  const typed = drawn({...search, value: 'airco'});
  assert.match(typed, /^<div class="m-search-field" data-rac=""><glyph /, 'not empty');
  assert.match(typed, / value="airco"/);
  const off = drawn({...search, enabled: false});
  assert.match(off, /^<div class="m-search-field" data-rac="" data-empty="true" data-disabled="true">/);
  assert.match(off, /<input [^>]* disabled=""/);
  // The field is 44px, its text 17px (iOS doesn't zoom), the clear button a 44px square.
  assert.equal(rule(searchFieldStyles, '.m-search-field').height, 'var(--m-hit)');
  assert.equal(rule(searchFieldStyles, '.m-search-field__input').font, 'var(--m-type-body)');
  assert.deepEqual([rule(searchFieldStyles, '.m-search-field__clear').width, rule(searchFieldStyles, '.m-search-field__clear').height], ['var(--m-hit)', 'var(--m-hit)']);
  assert.equal(rule(searchFieldStyles, '.m-search-field[data-empty] .m-search-field__clear').visibility, 'hidden');
  assert.equal(SHARED['m-hit'], '44px');
  assert.match(SHARED['m-type-body'], / 17px\//);
});

test('each change of the field sends the value’s intent with the query, and the clear button empties it the same way', () => {
  const search = valueOf(HOME_FIXTURES[0]).sensors.search, sent = [];
  const field = rendered(SearchField, {link: search}, sent);
  assert.deepEqual([field.props.value, field.props.isDisabled, field.props['aria-label']], [search.value, !search.enabled, search.ariaLabel]);
  field.props.onChange('airco');
  field.props.onChange('');
  assert.deepEqual(sent, [{...search.intent, value: 'airco'}, {...search.intent, value: ''}]);
  assert.deepEqual(search.intent, {command: 'sensor-search'}, 'the value’s intent is left as it was');
  const off = rendered(SearchField, {link: {...search, enabled: false}});
  assert.equal(off.props.isDisabled, true);
});

test('the Search key (Enter) blurs the field, so the keyboard goes down over the results, and sends nothing', () => {
  const search = valueOf(HOME_FIXTURES[0]).sensors.search, sent = [];
  const field = rendered(SearchField, {link: search}, sent);
  const input = field.props.children.find(child => child?.props?.className === 'm-search-field__input');
  let blurred = 0;
  input.props.ref.current = {blur: () => { blurred += 1; }};
  field.props.onSubmit('airco');
  assert.equal(blurred, 1);
  assert.deepEqual(sent, []);
});

test('the picker shows the chosen option’s label over a native select of the value’s options, and each change sends the value’s intent with the id', () => {
  const value = valueOf(HOME_FIXTURES[0]), category = value.sensors.category;
  for (const option of category.options) {
    const link = {...category, selected: option.id};
    const html = bare(renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, h(Picker, {link}))));
    const opts = category.options.map(o => `<option value="${encode(o.id)}"${o.id === option.id ? ' selected=""' : ''}>${encode(o.label)}</option>`).join('');
    assert.equal(html, `<span class="m-picker"><span class="m-picker__label">${encode(option.label)}</span><glyph class="m-glyph m-picker__chevron"/>`
      + `<select class="m-picker__select" aria-label="${encode(category.ariaLabel)}">${opts}</select></span>`, option.id);
  }
  const off = bare(renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, h(Picker, {link: {...category, enabled: false}}))));
  assert.match(off, /^<span class="m-picker" data-disabled="true">[\s\S]*<select class="m-picker__select" aria-label="[^"]*" disabled="">/);
  const sent = [], picker = rendered(Picker, {link: category}, sent);
  const select = picker.props.children.find(child => child?.type === 'select');
  assert.equal(select.props.value, category.selected);
  select.props.onChange({currentTarget: {value: 'battery'}});
  assert.deepEqual(sent, [{...category.intent, value: 'battery'}]);
  // 44px, its text 17px (iOS doesn't zoom), the select over the whole capsule.
  assert.equal(rule(pickerStyles, '.m-picker').height, 'var(--m-hit)');
  assert.equal(rule(pickerStyles, '.m-picker').font, 'var(--m-type-body)');
  const over = rule(pickerStyles, '.m-picker__select');
  assert.deepEqual([over.position, over.inset, over.opacity, over.font], ['absolute', '0', '0', 'var(--m-type-body)']);
});

test('the page hands the field and the picker the value’s own links, and every name on the page is the value’s (or React Aria’s clear button’s)', () => {
  for (const f of HOME_FIXTURES) {
    const value = valueOf(f, {}, {limit: 3}), page = rendered(SystemPage, {value});
    const sensorsBox = page.props.children[1], sensors = sensorsBox.props.children;
    const tree = rendered(sensors.type, sensors.props);
    const flat = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flat) : [node, ...flat(node.props?.children)];
    const parts = flat(tree.props.children);
    assert.equal(parts.find(node => node.type === SearchField).props.link, value.sensors.search, f.id);
    assert.equal(parts.find(node => node.type === Picker).props.link, value.sensors.category, f.id);
  }
  // Every name in the markup is one the value gives, but React Aria's own for the clear button.
  each((at, layout, value, html) => {
    const named = strings(value);
    for (const name of names(html)) assert.ok(named.has(name) || name === CLEAR, `${at}: ${name}`);
  });
});

// words() reads a Link by its label only, so the category's options (the
// select's own words, the picker's label one of them) are added from it.
test('every word on the page is the value’s', () => {
  each((at, layout, value, html) => {
    const drawn = new Set([...words(value), ...value.sensors.category.options.map(option => option.label)]);
    assert.deepEqual(texts(html).filter(text => !drawn.has(text)), [], at);
  });
});

test('colours: orange only on what needs Alex, blue only on Show more, which presses; the page writes no other tone', () => {
  assert.deepEqual([...systemPageStyles.matchAll(/var\(--m-(orange|blue|green|yellow|indigo|pink)[\w-]*\)/g)].map(([token]) => token), ['var(--m-blue-text)']);
  assert.equal(rule(systemPageStyles, '.m-system-page__readings .m-row--bare.m-row--pressable .m-row__title').color, 'var(--m-blue-text)');
  each((at, layout, value, html) => {
    const orange = count(html, /m-tone-orange/g);
    const expected = value.needs.rows.length + value.devices.rows.length + value.vacuum.rows.filter(row => row.tone === 'orange').length;
    assert.equal(orange, expected, `${at}: orange tiles`);
    assert.doesNotMatch(html, /m-tone-(?:blue|green|yellow|indigo|pink)/, at);
  });
});

// The strings a source writes, read from esbuild's output (which turns JSX
// text and attribute values into string literals), leaving out imports:
// each must be a class list, a lowercase token (a variant, a key, an id) or
// hold no letters; and no text prop or child may be a literal at all.
const TEXT_PROPS = /\b(?:title|label|ariaLabel|"aria-label"|placeholder|text|note|line|detail|headline|value|unit|children):\s*(["`])/;
async function english(source) {
  const {code} = await transform(source, {loader: 'jsx', jsx: 'automatic'});
  const body = code.split('\n').filter(line => !/^\s*import\b/.test(line)).join('\n');
  const literals = [...body.matchAll(/"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g)].flatMap(([, quoted, template]) =>
    quoted !== undefined ? [quoted] : template.split(/\$\{[^}]*\}/));
  const token = text => !/[A-Za-z]/.test(text) || /^[a-z][A-Za-z0-9]*(?:-[a-z0-9]+)*$/.test(text) || /^m-[\w-]+(?: m-[\w-]+)*$/.test(text.trim());
  return [...literals.filter(text => !token(text)), ...body.split('\n').filter(line => TEXT_PROPS.test(line)).map(line => line.trim())];
}

test('the page, the field and the picker write no English: every word comes from the value', async () => {
  assert.ok((await english('export const A = () => <p>Needs you</p>;')).length > 0, 'the reader finds JSX text');
  assert.ok((await english('export const A = () => <input placeholder="Search"/>;')).length > 0, 'and a placeholder');
  for (const file of ['pages/system.jsx', 'ui/search-field.jsx', 'ui/picker.jsx'])
    assert.deepEqual(await english(readFileSync(join(SOURCE, file), 'utf8')), [], file);
});
