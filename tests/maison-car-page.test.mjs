// The Car (#29 step 4, v34): what CarPage draws from
// the value screen() hands it for every Car fixture, the page's own edges
// (car-page-fixtures.js: an override while the Car sleeps or the Charger
// drops out, solar at the limit, the Car awake but stale or unverified, the
// battery unknown, a meter missing, the billing year, the period unknown)
// and the home's (full, quiet, missing), online and offline, in each
// layout the frame provides (phone, wide, desktop). Node has no JSX, so
// esbuild bundles the page with react-dom/server into a temporary module,
// and each test reads the markup a real value renders to: the value's
// widgets stacked in its order on a
// phone, and placed on the grid from 700px with every row full at 2 and 4
// columns; no empty or second heading; each linked widget one press on its
// own link; every word and name taken from the value; the battery's ring by
// size, its ticks and their legend; each charging form's controls, drawn by
// the value's kind whatever the Controls' enablement, with no Charge now or
// stepper while the Car is asleep; the feedback lines, and the detail a row
// gives up for them from 700px; the charging energy; Automatic charging's
// one row. Wording is the value's (car.js may change it): the tests read
// every string from the value, never an English literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen, words} from '../config/www/maison/screen.js';
import {E} from '../config/www/maison/model.js';
import {icon} from '../config/www/maison/icons.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {carPageStyles} from '../frontend/maison/src/pages/car.css.js';
import {ringStyles} from '../frontend/maison/src/ui/ring.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {CarPage} from './pages/car.jsx';
export {PAGES} from './pages.jsx';
export {LayoutContext} from './ui/layout.js';
export {CommandContext} from './contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;
const BUILD = {bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', loader: {'.js': 'jsx'},
  define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent'};

// The page, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-car-'));
const bundle = await build({...BUILD, stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'},
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'car.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'car.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, CarPage, PAGES} = ui;

const LAYOUTS = ['phone', 'wide', 'desktop'];
// The Car's fixtures and the page's own at their time (a dropout with the
// headline it kept), then the home's, whose missing house has no Car
// reading at all.
const FIXTURES = [...[...CAR_FIXTURES, ...CAR_PAGE_FIXTURES].map(f => ({key: `car ${f.id}`, states: f.states, now: CAR_NOW, carLast: f.last ?? null})),
  ...HOME_FIXTURES.map(f => ({key: `home ${f.id}`, states: f.states, now: HOME_NOW, carLast: null}))];
const VARIANTS = [['', {}], [' offline', {online: false}]];
const fixture = key => FIXTURES.find(f => f.key === key);
// The Car page's value for a fixture, as the dashboard draws it.
const valueOf = (f, extra = {}) => screen(fixtureSnapshot({...extra, states: structuredClone(f.states), now: f.now, carLast: f.carLast,
  route: {page: 'car', detail: null, dialog: null}})).page;
// Markup for the Car in a layout.
const draw = (value, layout) => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}},
  h(LayoutContext.Provider, {value: layout}, h(CarPage, {value}))));
const count = (html, pattern) => (html.match(pattern) || []).length;
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decode = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const encode = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

// The children of the element that opens at `from` in `html`, each whole,
// by counting tags.
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
// a phone's Automatic charging is the stack's item with no Widget round it
// ('bare').
const items = html => children(html, html.indexOf('<div class="m-widgets')).map(markup => {
  const [, size, id] = markup.match(/^<section class="m-widget m-widget--(\w+)" data-widget="([\w-]+)"/) ?? [];
  const bare = markup.match(/^<div class="m-car-page__automatic" data-widget="([\w-]+)"/)?.[1];
  return bare ? {id: bare, size: 'bare', markup} : {id, size, markup};
});
// What the automatic widget draws: the page's own field.
const automaticOf = value => value.automatic;
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
// Every fixture × variant × layout, with its value and markup.
const each = check => {
  for (const f of FIXTURES) for (const [suffix, extra] of VARIANTS) {
    const value = valueOf(f, extra);
    for (const layout of LAYOUTS) check(`${f.key}${suffix} ${layout}`, layout, value, draw(value, layout));
  }
};
// A Figure's markup, as figure.jsx draws it.
const figure = ({label, value, unit, placement = 'above'}) => `<p class="m-figure m-figure--${placement} m-figure--large">${label ? `<span class="m-figure__label">${encode(label)}</span>` : ''}`
  + `<span class="m-figure__reading"><span class="m-figure__value m-num">${encode(value)}</span>${unit ? `<span class="m-figure__unit">${encode(unit)}</span>` : ''}</span></p>`;
// The body of a widget's markup, after its title.
const bodyOf = markup => markup.slice(markup.indexOf('<div class="m-widget__body'));
// A button's classes for an IntentButton of `variant`, by layout: large and
// the card's width on a phone, regular at its own width from 700px.
const buttonClass = (variant, layout) => layout === 'phone' ? `m-button m-button--${variant} m-button--large m-button--wide m-focusable` : `m-button m-button--${variant} m-button--regular m-focusable`;
// The buttons of some markup, each with its class and its visible label.
const buttons = html => [...html.matchAll(/<button class="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].map(([tag, cls, inner]) => ({tag, cls, label: texts(inner).join('')}));

test('PAGES draws the Car with the recomposed page', () => {
  assert.equal(PAGES.car, CarPage);
});

test('on a phone: the value’s widgets stacked in its order, charging only while the value has it', () => {
  each((at, layout, value, html) => {
    if (layout !== 'phone') return;
    assert.match(html, /^<div class="m-car-page"><div class="m-widgets m-widgets--stack">/, at);
    assert.doesNotMatch(html, /m-widgets--grid|style="grid-/, at);
    assert.deepEqual(items(html).map(w => [w.id, w.size]), value.widgets.map(({id}) => [id, id === 'automatic' ? 'bare' : 'phone']), at);
    assert.equal(count(html, /data-widget="charge"/g), value.charge ? 1 : 0, `${at}: charging while plugged in`);
    assert.deepEqual(value.widgets.map(w => w.id).filter(id => id !== 'charge'), ['battery', 'energy', 'automatic'], at);
  });
});

// The widgets a layout draws: the value's, a large one drawn medium at
// wide, where a medium fills its row alone.
const slotsOf = (value, layout) => layout === 'wide' ? value.widgets.map(slot => slot.size === 'large' ? {...slot, size: 'medium'} : slot) : value.widgets;
test('from 700px: the value’s widgets in order at their sizes (a large one medium at wide), placed as placeWidgets() places them, every row full at 2 and 4 columns', () => {
  const seen = new Set();
  each((at, layout, value, html) => {
    if (layout === 'phone') return;
    const columns = COLUMNS[layout], slots = slotsOf(value, layout), {placements, holes, rows} = placeWidgets(slots, columns);
    assert.match(html, new RegExp(`^<div class="m-car-page"><div class="m-widgets m-widgets--grid" data-columns="${columns}">`), at);
    const drawn = [...html.matchAll(/<section class="m-widget m-widget--(\w+)" data-widget="([\w-]+)" style="grid-column:([^;]+);grid-row:([^"]+)">/g)]
      .map(([, size, id, column, row]) => [id, size, column, row]);
    assert.deepEqual(drawn, placements.map(({id, column, row, columnSpan, rowSpan}, i) => [id, slots[i].size, `${column} / span ${columnSpan}`, `${row} / span ${rowSpan}`]), at);
    assert.deepEqual(holes, [], `${at}: no holes`);
    assert.equal(rows, columns === 2 ? slots.length : 2, at);
    assert.equal(count(html, /m-widget--large/g), layout === 'desktop' && value.widgets.some(slot => slot.size === 'large') ? 1 : 0, `${at}: large only on a desktop`);
    for (const cols of [2, 4]) assert.deepEqual(placeWidgets(value.widgets, cols).holes, [], `${at}: no holes at ${cols} columns`);
    seen.add(value.widgets.map(w => `${w.id}:${w.size}`).join(' '));
  });
  // Both of the value's arrangements are drawn: four mediums while plugged
  // in, the battery large beside two mediums otherwise.
  assert.deepEqual([...seen].sort(), ['battery:large energy:medium automatic:medium', 'battery:medium charge:medium energy:medium automatic:medium']);
});

test('no empty heading and no second one: every h2 is a widget’s title in the value’s words; Automatic charging says its title once, with its glyph from 700px', () => {
  each((at, layout, value, html) => {
    const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, inner]) => texts(inner).join(''));
    const automatic = automaticOf(value);
    const titles = {battery: value.battery.title, charge: value.charge?.title, energy: value.chargingEnergy.title, automatic: automatic.title};
    assert.deepEqual(headings, items(html).filter(w => w.size !== 'bare').map(w => titles[w.id]), at);
    assert.deepEqual(headings.filter(text => !text), [], `${at}: none empty`);
    assert.doesNotMatch(html, /<h3/, `${at}: no heading inside a widget`);
    const markup = widget(html, 'automatic');
    assert.equal(count(markup, /m-widget__glyph/g), layout !== 'phone' && automatic.icon ? 1 : 0, `${at}: Automatic charging's glyph from 700px`);
    assert.equal(count(markup, new RegExp(`>${esc(encode(automatic.title))}<`, 'g')), 1, `${at}: its title once`);
  });
});

test('every word and every accessible name on the page is the value’s', () => {
  each((at, layout, value, html) => {
    const drawn = new Set(words(value)), named = strings(value);
    assert.deepEqual(texts(html).filter(text => !drawn.has(text)), [], `${at}: drawn text`);
    assert.deepEqual(names(html).filter(name => !named.has(name)), [], `${at}: names`);
  });
});

// Each link the page draws, by the widget that draws it.
const LINKS = {battery: v => v.battery.link, energy: v => v.chargingEnergy.link};
test('the battery and the charging energy are each one press on their own link; charging and Automatic charging aren’t linked', () => {
  for (const f of FIXTURES) {
    const value = valueOf(f);
    assert.deepEqual([LINKS.battery(value).intent.command, LINKS.battery(value).intent.entity], ['detail', 'battery'], f.key);
    assert.deepEqual([LINKS.energy(value).intent.command, LINKS.energy(value).intent.entity], ['detail', 'charging-energy'], f.key);
    // Name every link after where it comes from, so each press shows which one it draws.
    const marked = structuredClone(value);
    for (const [id, link] of Object.entries(LINKS)) link(marked).ariaLabel = `link:${id}`;
    for (const layout of LAYOUTS) {
      const html = draw(marked, layout), at = `${f.key} ${layout}`;
      for (const {id, markup} of items(html)) {
        const found = presses(markup);
        if (!LINKS[id]) { assert.doesNotMatch(markup, /m-widget__press|m-widget__chevron|aria-hidden="true"><div class="m-car-page/, `${at} ${id}: not linked`); continue; }
        assert.deepEqual(found.map(nameOf), [`link:${id}`], `${at} ${id}: one press, its own link`);
        assert.match(found[0], /class="m-widget__press m-focusable"/, `${at} ${id}`);
        assert.doesNotMatch(markup.replace(found[0], ''), /<button|tabindex=|<input|<a\b|role="(?:switch|slider|radio)/, `${at} ${id}: nothing else to press`);
        assert.match(markup, /<div class="m-widget__body(?: m-widget__body--card)?" aria-hidden="true">/, `${at} ${id}: read as its press alone`);
      }
    }
  }
});

test('the battery: the ring (regular on a phone and in the large widget, small in a medium one) from the value, beside the line, the tick legend and the freshness', () => {
  const tones = new Set();
  each((at, layout, value, html) => {
    const {battery} = value, {plot} = battery.ring, markup = bodyOf(widget(html, 'battery'));
    const size = layout === 'phone' || slotsOf(value, layout)[0].size === 'large' ? 'regular' : 'small', box = size === 'regular' ? 136 : 80;
    const classes = ['m-ring', `m-ring--${size}`, `m-tone-${plot.tone}`, typeof plot.fill === 'number' ? '' : 'm-ring--empty', plot.stale ? 'm-ring--stale' : ''].filter(Boolean).join(' ');
    assert.ok(markup.includes(`<div class="m-car-page__battery"><svg class="${classes}" role="img" aria-label="${encode(battery.ring.ariaLabel)}" viewBox="0 0 ${box} ${box}" width="${box}" height="${box}">`), `${at}: the ${size} ring`);
    assert.ok(markup.includes(`<text class="m-ring__label" x="${box / 2}" y="${box / 2}" text-anchor="middle" dominant-baseline="central" aria-hidden="true">${encode(battery.label)}</text>`), `${at}: its label`);
    const ticks = [...markup.matchAll(/<line class="m-ring__tick m-ring__tick--(\w+)"/g)].map(([, kind]) => kind);
    assert.deepEqual(ticks, [['reserve', plot.reserve], ['limit', plot.limit]].filter(([, at]) => typeof at === 'number').map(([kind]) => kind), `${at}: the ticks`);
    const legend = battery.legend.length ? `<p class="m-car-page__legend">${battery.legend.map(item => `<span class="m-car-page__legend-item"><span class="m-car-page__tick m-car-page__tick--${item.kind}"></span>${encode(item.text)}</span>`).join('')}</p>` : '';
    assert.ok(markup.includes(`</svg><div class="m-car-page__copy">${battery.line ? `<p class="m-car-page__line">${encode(battery.line)}</p>` : ''}${legend}<p class="m-car-page__freshness">${encode(battery.freshness)}</p></div></div></div></section>`), `${at}: the copy`);
    tones.add(plot.tone);
  });
  // Green only while the Car charges; both are covered.
  assert.deepEqual([...tones].sort(), ['gray', 'green']);
});

// Values beside the fixtures' own, for the forms and states no fixture
// reaches: an override kept while the Car sleeps or the Charger reconnects
// (the value's Return to automatic over Wake or the quiet line), each
// control's feedback, and a Control in flight.
const withCharge = (key, change, extra = {}) => { const value = valueOf(fixture(key), extra); value.charge = {...value.charge, ...change(value.charge)}; return value; };
const RETURN = valueOf(fixture('car charge_now')).charge.action;
const feedbackOf = charge => Object.fromEntries(Object.keys(charge.feedback).map(key => [key, `feedback:${key}`]));
const EXTRA = [
  ['asleep, override on', withCharge('car not_verified', () => ({action: RETURN}))],
  ['reconnecting, override on', withCharge('car dropout', () => ({action: RETURN}))],
  ['ready, feedback', withCharge('car solar', charge => ({feedback: feedbackOf(charge)}))],
  ['ready at the limit, feedback', withCharge('car complete', charge => ({feedback: feedbackOf(charge)}))],
  ['override, feedback', withCharge('car charge_now', charge => ({feedback: feedbackOf(charge)}))],
  ['asleep, feedback', withCharge('car not_verified', charge => ({feedback: feedbackOf(charge)}))],
  ['asleep, override on, feedback', withCharge('car not_verified', charge => ({action: RETURN, feedback: feedbackOf(charge)}))],
  ['reconnecting, override on, feedback', withCharge('car dropout', charge => ({action: RETURN, feedback: feedbackOf(charge)}))],
  ['ready, busy', valueOf(fixture('car solar'), {busy: new Set([E.carNow, E.carLimit])})],
  ['ready, one feedback', valueOf(fixture('car solar'), {feedback: new Map([[E.carLimit, 'feedback:limit']])})],
];
const everyCharge = check => {
  each((at, layout, value, html) => value.charge && check(at, layout, value, html));
  for (const [key, value] of EXTRA) for (const layout of LAYOUTS) check(`${key} ${layout}`, layout, value, draw(value, layout));
};

test('charging, by the value’s kind: the button filled while ready and gray otherwise, the limit’s row with its stepper, Wake’s row, the quiet line, in that order', () => {
  const kinds = new Set(), icons = new Set();
  everyCharge((at, layout, value, html) => {
    const {kind, action, limit, wake, line} = value.charge, markup = bodyOf(widget(html, 'charge'));
    const single = !action && !Object.values(value.charge.feedback).some(Boolean);
    assert.match(markup, new RegExp(`^<div class="m-widget__body(?: m-widget__body--card)?"><div class="m-car-page__charge m-car-page__charge--${kind}${single ? ' m-car-page__charge--single' : ''}">`), `${at}: single ${single}`);
    const drawn = buttons(markup);
    // The value's controls, in the order the form draws them.
    const expected = [action && {cls: buttonClass(kind === 'ready' ? 'filled' : 'gray', layout), label: action.label},
      ...(limit ? [limit.stepper.minus, limit.stepper.plus].filter(Boolean).map(() => ({cls: 'm-button m-button--gray m-button--regular m-button--icon-only m-focusable m-stepper__step', label: ''})) : []),
      wake && {cls: 'm-button m-button--tinted m-button--regular m-focusable', label: wake.control.label}].filter(Boolean);
    assert.deepEqual(drawn.map(({cls, label}) => ({cls, label})), expected, `${at}: the buttons`);
    assert.equal(count(markup, /class="m-stepper"/g), limit ? 1 : 0, `${at}: the stepper while the value has a limit`);
    if (limit) assert.match(markup, new RegExp(`<div class="m-list m-list--plain" role="list"><div class="m-list__item" role="listitem"><div class="m-row m-row--bare"><span class="m-row__copy"><span class="m-row__title m-row__title--strong">${esc(encode(limit.title))}</span>`
      + `(?:<span class="m-row__detail" id="[^"]+">${esc(encode(limit.detail))}</span>)?</span><span class="m-row__accessory"><div class="m-stepper" aria-label="${esc(encode(limit.title))}"[^>]*role="group">`), `${at}: the limit's row, its stepper named by its title`);
    if (limit) assert.ok(markup.includes(`<output class="m-stepper__value m-num" aria-label="${encode(limit.stepper.outputLabel)}">${encode(limit.stepper.output)}</output>`), `${at}: the limit`);
    if (wake) assert.ok(markup.includes(`<div class="m-row"><span class="m-row__tile m-tone-gray"><span class="m-glyph" aria-hidden="true">${icon(wake.icon)}</span></span>`), `${at}: Wake's tile is its icon, ${wake.icon}`);
    if (wake) assert.match(markup, new RegExp(`<div class="m-row"><span class="m-row__tile m-tone-gray"><span class="m-glyph"[^>]*>[\\s\\S]*?</span></span><span class="m-row__copy"><span class="m-row__title m-row__title--strong">${esc(encode(wake.title))}</span>`
      + `(?:<span class="m-row__detail" id="[^"]+">${esc(encode(wake.detail))}</span>)?</span><span class="m-row__accessory"><button class="m-button m-button--tinted`), `${at}: Wake's row, a gray tile, the button tinted`);
    assert.equal(count(markup, /class="m-quiet"/g), line ? 1 : 0, at);
    if (line) assert.match(markup, new RegExp(`<p class="m-quiet"><span class="m-glyph m-quiet__glyph"[^>]*><svg[^>]*data-icon="[^"]+"[\\s\\S]*?</span><span class="m-quiet__text">${esc(encode(line))}</span></p>`), `${at}: the quiet line, with a glyph`);
    // The form's parts in order: the button first, then the limit, Wake, the line, the feedback.
    assert.equal(/m-car-page__charge--\w+"><button class="m-button/.test(markup), !!action, `${at}: the button first`);
    const order = ['class="m-stepper"', 'm-row__tile m-tone-gray', 'class="m-quiet"', 'm-car-page__feedback'].map(part => markup.indexOf(part)).filter(i => i >= 0);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${at}: in order`);
    kinds.add(`${kind}${action ? ` ${action.intent.command}` : ''}`);
    if (wake) icons.add(wake.icon);
  });
  // Wake's tile is a moon while the Car sleeps, and another glyph while it is awake.
  assert.ok(icons.has('moon') && icons.size > 1, `both of Wake's glyphs are covered: ${[...icons]}`);
  // Every form is covered, with and without its button.
  assert.deepEqual([...kinds].sort(), ['asleep', 'asleep charge-automatic', 'override charge-automatic', 'ready', 'ready charge-now', 'reconnecting', 'reconnecting charge-automatic']);
});

test('while the Car is asleep there is no Charge now and no stepper, disabled or not; Wake is there', () => {
  let asleep = 0;
  everyCharge((at, layout, value, html) => {
    if (value.charge.kind !== 'asleep') return;
    const markup = widget(html, 'charge');
    assert.doesNotMatch(markup, /m-stepper/, `${at}: no stepper`);
    assert.ok(!value.charge.action || value.charge.action.intent.command !== 'charge-now', `${at}: the value has no Charge now`);
    assert.deepEqual(buttons(markup).filter(b => /m-button--filled/.test(b.cls)), [], `${at}: nothing filled`);
    assert.equal(buttons(markup).filter(b => b.label === value.charge.wake.control.label).length, 1, `${at}: Wake`);
    asleep += 1;
  });
  assert.ok(asleep > 0, 'the asleep form is covered');
});

test('a busy or offline control stays drawn in its place, pending or disabled; the value’s kind decides the form', () => {
  const busy = EXTRA.find(([key]) => key === 'ready, busy')[1];
  assert.equal(busy.charge.kind, 'ready');
  for (const layout of LAYOUTS) {
    const markup = widget(draw(busy, layout), 'charge'), found = buttons(markup);
    assert.equal(found.length, 3, `${layout}: Charge now and the stepper's two sides`);
    for (const {tag} of found) assert.match(tag, /aria-disabled="true"/, `${layout}: in flight`);
    assert.doesNotMatch(markup, /<button[^>]* disabled=""/, `${layout}: pending, not disabled`);
  }
  for (const f of FIXTURES) {
    const online = valueOf(f), offline = valueOf(f, {online: false});
    assert.equal(offline.charge?.kind, online.charge?.kind, `${f.key}: offline keeps the form`);
    if (!offline.charge) continue;
    for (const layout of LAYOUTS) assert.equal(buttons(widget(draw(offline, layout), 'charge')).length, buttons(widget(draw(online, layout), 'charge')).length, `${f.key} ${layout}: every control drawn offline`);
  }
});

test('feedback: each line that says something, in the value’s order, in one group after the controls; from 700px a row under a button gives up its detail for it', () => {
  let tight = 0;
  everyCharge((at, layout, value, html) => {
    const {action, limit, wake, feedback} = value.charge, markup = widget(html, 'charge');
    const lines = Object.values(feedback).filter(Boolean);
    const group = lines.length ? `<div class="m-car-page__feedback">${lines.map(text => `<p class="m-feedback">${encode(text)}</p>`).join('')}</div>` : '';
    assert.ok(markup.endsWith(`${group}</div></div></section>`), `${at}: the feedback last`);
    assert.equal(count(markup, /m-car-page__feedback/g), lines.length ? 1 : 0, `${at}: no empty group`);
    const drops = layout !== 'phone' && !!action && lines.length > 0;
    for (const row of [limit, wake].filter(Boolean)) assert.equal(markup.includes(`<span class="m-row__detail" id="`) && markup.includes(`>${encode(row.detail)}</span>`), !drops, `${at}: ${row.title}'s detail`);
    if (drops) tight += 1;
  });
  assert.ok(tight > 0, 'a row gives up its detail somewhere');
});

test('the charging energy: the figure (its label above on a phone, beside from 700px), then the bar and its legend', () => {
  const kinds = new Set();
  each((at, layout, value, html) => {
    const {figure: f, bar, legend} = value.chargingEnergy, markup = widget(html, 'energy');
    const empty = bar.segments.length ? '' : bar.kind === 'zero' ? ' m-segment-bar--zero' : ' m-segment-bar--empty';
    assert.ok(markup.includes(`<div class="m-car-page__energy">${figure({...f, placement: layout === 'phone' ? 'above' : 'beside'})}<div class="m-car-page__split"><div class="m-segment-bar${empty}" role="img" aria-label="${encode(bar.ariaLabel)}">`), at);
    assert.deepEqual([...markup.matchAll(/<span class="m-segment-bar__segment m-tone-(\w+)"/g)].map(([, tone]) => tone), bar.segments.map(s => s.tone), `${at}: the split`);
    assert.deepEqual([...markup.matchAll(/<li class="m-legend__item"><span class="m-legend__dot m-tone-(\w+)" aria-hidden="true"><\/span>([^<]*)<\/li>/g)].map(([, tone, text]) => ({tone, text: decode(text)})), legend, at);
    kinds.add(bar.kind);
  });
  assert.ok(kinds.has('split') && kinds.has('missing'), `a split and a missing reading are covered: ${[...kinds]}`);
});

test('Automatic charging: on a phone one inset strong row with no widget round it, its title over what it does; from 700px the widget, its row (what it does) centred; the note before the switch, then the feedback', () => {
  const notes = new Set();
  const check = (at, layout, value, html) => {
    const automatic = automaticOf(value), phone = layout === 'phone', markup = widget(html, 'automatic');
    const note = automatic.note && automatic.note !== (phone ? automatic.title : automatic.detail ?? automatic.note) ? `<span class="m-row__value m-num" id="[^"]+">${esc(encode(automatic.note))}</span>` : '';
    const control = automatic.note === 'Unavailable' ? esc('<span class="m-switch m-switch--unavailable" aria-hidden="true">') : '<label [^>]*class="m-switch m-focusable"';
    // The grid's row is titled by what it does, or by the note while that isn't known, never untitled.
    const title = phone ? automatic.title : automatic.detail ?? automatic.note ?? automatic.title;
    assert.ok(title, `${at}: a title`);
    if (!phone) assert.notEqual(title, automatic.title, `${at}: not the widget's title again`);
    const copy = phone ? `<span class="m-row__title m-row__title--strong">${esc(encode(title))}</span>${automatic.detail ? `<span class="m-row__detail" id="[^"]+">${esc(encode(automatic.detail))}</span>` : ''}`
      : `<span class="m-row__title">${esc(encode(title))}</span>`;
    const open = phone ? '<div class="m-car-page__automatic" data-widget="automatic"><div class="m-list m-list--inset" role="list">'
      : '<div class="m-widget__body"><div class="m-car-page__automatic"><div class="m-list m-list--plain" role="list">';
    assert.match(phone ? markup : bodyOf(markup), new RegExp(`^${esc(open)}<div class="m-list__item" role="listitem"><div class="m-row m-row--bare">`
      + `<span class="m-row__copy">${copy}</span>${note}<span class="m-row__accessory">${control}`), at);
    assert.ok(markup.endsWith(`</div></div>${automatic.feedback ? `<p class="m-feedback">${encode(automatic.feedback)}</p>` : ''}</div>${phone ? '' : '</div></section>'}`), `${at}: the feedback`);
    assert.equal(count(markup, /<h2/g), phone ? 0 : 1, `${at}: a heading from 700px only`);
    notes.add(automatic.note);
  };
  each(check);
  const unavailable = valueOf(fixture('car automatic_unavailable'));
  assert.deepEqual([unavailable.automatic.detail, unavailable.automatic.note], [null, 'Unavailable'], 'the unavailable switch has no detail');
  const busy = valueOf(fixture('car solar'), {feedback: new Map([[E.carSmart, 'feedback:automatic']])});
  for (const layout of LAYOUTS) { check(`unavailable ${layout}`, layout, unavailable, draw(unavailable, layout)); check(`feedback ${layout}`, layout, busy, draw(busy, layout)); }
  assert.deepEqual([...notes].sort(), ['Offline', 'Unavailable', null].sort(), 'every note is covered');
  // The note is one word ('Unavailable') and never breaks: it takes its own width, past the list's third of the row.
  assert.ok(carPageStyles.includes('\n.m-car-page__automatic .m-row__value{flex:none;max-width:none;white-space:nowrap}\n'));
  // From 700px the row sits centred in the body.
  assert.ok(carPageStyles.includes('\n.m-widget:not(.m-widget--phone) .m-car-page__automatic{flex:1;justify-content:center;gap:var(--m-space-1);min-height:0}\n'));
});

test('the Car’s colours: the tick swatches are the Ring’s tick colours, nothing orange and no blue of its own', () => {
  for (const kind of ['reserve', 'limit']) {
    const ring = ringStyles.match(new RegExp(`\\.m-ring__tick--${kind}\\{stroke:(var\\(--m-[\\w-]+\\))\\}`))[1];
    assert.ok(carPageStyles.includes(`\n.m-car-page__tick--${kind}{background:${ring}}\n`), `${kind}: ${ring}`);
  }
  assert.doesNotMatch(carPageStyles, /--m-(?:orange|blue|green|yellow|indigo|pink)/, 'the parts bring the tones');
  each((at, layout, value, html) => assert.doesNotMatch(html, /m-tone-(?:orange|blue)\b/, at));
  // The page's block is m-car-page, never the hero chart's m-car.
  assert.match(carPageStyles, /^\.m-car-page\{display:flex;flex-direction:column;gap:var\(--m-space-6\);min-width:0\}$/m);
  assert.deepEqual([...carPageStyles.matchAll(/\.m-car(?![\w-])/g)], [], 'no m-car selector');
  each((at, layout, value, html) => assert.doesNotMatch(html, /class="m-car(?:\s|")|class="m-car__/, at));
});

test('on a narrow phone the limit’s stepper and Wake’s button wrap under their row’s words, at its end, rather than squeeze them', () => {
  for (const [control, basis] of [['m-stepper', 112], ['m-button', 144]]) {
    const row = `.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.${control})`;
    for (const rule of [`${row}{flex-wrap:wrap;row-gap:var(--m-space-2)}`, `${row}>.m-row__copy{flex:1 1 ${basis}px;min-width:min-content}`,
      `${row} :is(.m-row__title,.m-row__detail){overflow-wrap:break-word}`, `${row}>.m-row__accessory{margin-inline-start:auto}`])
      assert.ok(carPageStyles.includes(`\n${rule}\n`), rule);
  }
});

test('on a narrow phone the battery’s copy drops under the ring, which stands centred over it', () => {
  assert.ok(carPageStyles.includes('\n.m-widget--phone .m-car-page__battery{flex-wrap:wrap;justify-content:center;row-gap:var(--m-space-3)}\n'));
  assert.ok(carPageStyles.includes('\n.m-car-page__copy{flex:1 1 128px;display:flex;flex-direction:column;gap:var(--m-space-1);min-width:0}\n'));
});

test('the charging rows’ titles wrap without leaving a word alone', () => {
  assert.ok(carPageStyles.includes('\n.m-car-page__charge .m-row__title{text-wrap:pretty}\n'));
});

test('the large Battery (a desktop’s) raises its copy: the line in headline, the legend and the freshness in subhead', () => {
  for (const rule of ['.m-widget--large .m-car-page__line{font:var(--m-type-headline)}',
    '.m-widget--large :is(.m-car-page__legend,.m-car-page__freshness){font:var(--m-type-subhead)}'])
    assert.ok(carPageStyles.includes(`\n${rule}\n`), rule);
});

test('from 700px a charging body holding one row or line is centred, as Battery’s ring is; the quiet line’s glyph sits at the card’s edge', () => {
  assert.ok(carPageStyles.includes('\n.m-widget:not(.m-widget--phone) .m-car-page__charge--single{justify-content:center}\n'));
  assert.ok(carPageStyles.includes('\n.m-car-page__charge>.m-quiet{flex-wrap:nowrap;padding-inline:calc(17px + var(--m-space-2)) 0}\n'));
  // Every single form is covered: at the limit, asleep and reconnecting.
  const singles = new Set();
  each((at, layout, value, html) => { if (layout === 'phone' && /m-car-page__charge--single/.test(html)) singles.add(value.charge.kind); });
  assert.deepEqual([...singles].sort(), ['asleep', 'ready', 'reconnecting']);
});

test('from 700px every charging control keeps its 44px: the button its own width, 8px over rows at least 40px high', () => {
  for (const rule of ['.m-widget:not(.m-widget--phone) .m-car-page__charge{gap:var(--m-space-2)}',
    '.m-widget:not(.m-widget--phone) .m-car-page__charge>.m-button{flex:none;align-self:flex-start;max-width:100%}',
    '.m-widget:not(.m-widget--phone) .m-car-page__charge .m-row{min-height:40px;padding-block:2px}'])
    assert.ok(carPageStyles.includes(`\n${rule}\n`), rule);
});
