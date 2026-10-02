// Energy's sheets (#29 step 4, v33): the Price, Billing
// year, Bill so far and Energy today bodies (drawers/energy.jsx), drawn
// from energy.js's Drawer values as iOS grouped sections. Node has no JSX,
// so esbuild bundles the bodies with react-dom/server into a temporary
// module (as tests/maison-climate-sheets.test.mjs does), and each test
// reads the markup every Energy fixture's and HOME's quiet and missing
// houses' sheets render to: every section and heading from the value, the
// covered row only when the value has one, "—" drawn where the value says
// it and no number the value doesn't carry, the links as buttons holding
// their intents, the ledger's widths, and the rings drawn from the value's
// plot. What the values say is maison-energy.test.mjs's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen, words} from '../config/www/maison/screen.js';
import {ENERGY_DETAILS} from '../config/www/maison/energy.js';
import {ENERGY_FIXTURES, ENERGY_NOW} from '../frontend/maison/fixtures/energy-fixtures.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {ENERGY_SHEETS, energySheetSnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {energyDrawerStyles} from '../frontend/maison/src/drawers/energy.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {DRAWERS} from './drawers.jsx';
export {PriceDrawer, YearDrawer, BillDrawer, DayDrawer} from './drawers/energy.jsx';
export {IntentButton} from './ui/button.jsx';
export {ListRow} from './ui/list.jsx';
export {RingPair} from './ui/ring.jsx';
export {SheetPlacementContext} from './ui/sheet.jsx';
export {CommandContext} from './contexts.js';
export {createElement as h, isValidElement} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The bodies, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-energy-sheets-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'sheets.mjs'), bundle.outputFiles[0].text);
const {h, isValidElement, renderToStaticMarkup, CommandContext, SheetPlacementContext, DRAWERS, IntentButton, ListRow, RingPair,
  PriceDrawer, YearDrawer, BillDrawer, DayDrawer} = await import(pathToFileURL(join(folder, 'sheets.mjs')));
rmSync(folder, {recursive: true, force: true});

// Every fixture the sheets are drawn over: Energy's own at their times, then
// HOME's quiet house (a register metered but unbilled) and its missing one.
const FIXTURES = [...ENERGY_FIXTURES.map(f => ({key: `energy ${f.id}`, states: f.states, now: f.now ?? ENERGY_NOW})),
  ...['quiet', 'missing'].map(id => ({key: `home ${id}`, states: HOME_FIXTURES.find(f => f.id === id).states, now: HOME_NOW}))];
const fixture = key => FIXTURES.find(f => f.key === key);
const IDS = ENERGY_DETAILS.map(d => d.id);
const KINDS = {price: 'price', 'billing-year': 'year', bill: 'bill', 'energy-today': 'day'};
// A sheet's body for a fixture (by key) with `detail` open.
const bodyOf = (key, detail) => {
  const f = fixture(key);
  return screen(fixtureSnapshot({now: f.now, states: f.states, route: {page: 'energy', detail, dialog: null}, loaded: {}})).drawer.body;
};
// A body's markup, drawn by DRAWERS as DrawerSheet draws it, in a
// bottom sheet (or `placement`), under a command that does nothing.
const draw = (body, placement = 'bottom') => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}},
  h(SheetPlacementContext.Provider, {value: placement}, h(DRAWERS[body.kind], {body}))));
const count = (html, pattern) => (html.match(pattern) || []).length;
const unescape = text => text.replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const textOf = html => unescape(html.replace(/<[^>]*>/g, ''));
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The sheet's section headings in order: its own h3s and its disclosures'
// titles, as a reader's heading list has them.
const headings = html => [...html.matchAll(/<h3 class="(m-energy-sheet__heading|m-disclosure__heading)"[^>]*>(.*?)<\/h3>/g)].map(([, , inner]) => textOf(inner));
// Each <button …> opening tag.
const buttons = html => html.match(/<button[^>]*>/g) ?? [];
// The elements a body's function draws itself, walked through every prop
// (children, a row's title): the bodies use no hooks, so each can be called.
function elements(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, found));
  else if (isValidElement(node)) { found.push(node); for (const value of Object.values(node.props)) elements(value, found); }
  return found;
}
// The words a body's sheet draws: all of the value's, but for the day
// breakdown's title ('Energy today'), which the sheet's own title already
// says, and its legend, whose figures the rows under the bar give.
const shownWords = body => words(body.kind === 'day' ? {...body, summary: {...body.summary, title: null, legend: []}} : body);
const BODIES = {price: PriceDrawer, year: YearDrawer, bill: BillDrawer, day: DayDrawer};
const drawn = body => elements(BODIES[body.kind]({body}));

test('DRAWERS draws each Energy sheet with its own body, and the gallery’s sheet windows draw the dashboard’s', () => {
  assert.equal(DRAWERS.price, PriceDrawer);
  assert.equal(DRAWERS.year, YearDrawer);
  assert.equal(DRAWERS.bill, BillDrawer);
  assert.equal(DRAWERS.day, DayDrawer);
  for (const id of IDS) assert.equal(bodyOf('energy billing', id).kind, KINDS[id], id);
  for (const {id, detail} of ENERGY_SHEETS) {
    const body = screen(energySheetSnapshot(id)).drawer.body;
    assert.match(draw(body), new RegExp(`^<div class="m-energy-sheet m-energy-sheet--${KINDS[detail]}">`), id);
  }
});

test('every fixture’s every sheet draws as grouped sections, each word from the value, no number it doesn’t carry, in both placements', () => {
  for (const {key} of FIXTURES) for (const id of IDS) {
    const body = bodyOf(key, id), where = `${key} ${id}`;
    for (const placement of ['bottom', 'center']) {
      const html = draw(body, placement), text = textOf(html);
      assert.match(html, new RegExp(`^<div class="m-energy-sheet m-energy-sheet--${body.kind}">`), where);
      assert.doesNotMatch(text, /undefined|null|NaN|\[object/, where);
      assert.equal(count(html, /<section class="m-energy-sheet__summary[^"]*"/g), 1, `${where}: one summary`);
      assert.ok(count(html, /<section class="m-energy-sheet__section"/g) >= 1, `${where}: grouped sections`);
      assert.equal(count(html, /m-button--filled/g), 0, `${where}: Energy's sheets only read and open`);
      assert.doesNotMatch(html, /m-tone-orange|m-tone-blue/, `${where}: nothing here needs Alex, and blue only presses`);
      // Every word the value carries is drawn, and every number drawn is the value's.
      for (const line of shownWords(body)) assert.ok(text.includes(line), `${where}: ${line}`);
      const said = words(body).join('\n');
      for (const [number] of text.matchAll(/\d+(?:[.,]\d+)*/g)) assert.ok(said.includes(number), `${where}: ${number} isn't the value's`);
    }
    // Why, last but for the Bill's links, collapsed.
    const html = draw(body);
    assert.equal(headings(html).at(-1), body.why.title, where);
    assert.equal(count(html, /<div class="m-disclosure"/g), 1, `${where}: Why starts collapsed`);
    for (const paragraph of body.why.paragraphs) assert.ok(html.includes(`<p class="m-energy-sheet__text">${paragraph}</p>`) || textOf(html).includes(paragraph), where);
  }
});

test('each sheet’s sections come in the contract’s order, each headed by its value’s words', () => {
  for (const {key} of FIXTURES) {
    const price = bodyOf(key, 'price'), year = bodyOf(key, 'billing-year'), bill = bodyOf(key, 'bill'), day = bodyOf(key, 'energy-today');
    assert.deepEqual(headings(draw(price)), [price.rates.heading, price.why.title], key);
    assert.deepEqual(headings(draw(year)), [...year.registers.map(r => r.heading), year.why.title], key);
    assert.deepEqual(headings(draw(bill)), [bill.lines.heading, bill.cap.heading, bill.why.title], key);
    // Energy today's rows need no heading: the sheet's title names them.
    assert.deepEqual(headings(draw(day)), [day.why.title], key);
  }
  assert.deepEqual(headings(draw(bodyOf('energy billing', 'billing-year'))), ['Peak hours', 'Off-peak hours', 'Why']);
  assert.deepEqual(headings(draw(bodyOf('energy billing', 'bill'))), ['Before VAT', 'Network cost cap', 'Why']);
});

test('Price: the figure large with its unit, the register’s chip while it is known, the line, then the rates with their dots, Now as a chip in the live register’s tone, and the footer', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'price'), html = draw(body), {summary, rates} = body;
    // The figure large, its unit beside it while it has one (none with no reading).
    const unit = summary.unit ? `<span class="m-figure__unit">${escape(summary.unit)}</span>` : '';
    assert.match(html, new RegExp(`<div class="m-energy-sheet__price"><p class="m-figure m-figure--above m-figure--large"><span class="m-figure__reading"><span class="m-figure__value m-num">${escape(summary.figure)}</span>${unit}</span></p>`), key);
    if (summary.register) assert.match(html, new RegExp(`<span class="m-chip m-tone-${summary.register.tone}">.*?<span class="m-chip__label">${summary.register.label}</span></span></div>`), key);
    else assert.doesNotMatch(html, /m-chip/, `${key}: no chip while the register is unknown`);
    assert.ok(html.includes(`<p class="m-energy-sheet__line">${summary.line}</p>`), key);
    // The rates: an inset list, each row its tone's dot and its name, 'Now' as a chip in its tone on the live one only, its value.
    const list = html.match(/<div class="m-list m-list--inset" role="list">(.*?)<\/div><p class="m-energy-sheet__footer">/)?.[1];
    assert.ok(list, key);
    rates.rows.forEach(row => {
      const now = row.badge ? `<span class="m-chip m-tone-${row.tone}"><span class="m-chip__label">${row.badge}</span></span>` : '';
      assert.match(list, new RegExp(`<span class="m-row__title"><span class="m-energy-sheet__dot m-tone-${row.tone}"></span>${row.name}${now}</span></span><span class="m-row__value m-num"[^>]*>${escape(row.value)}</span>`), `${key} ${row.name}`);
    });
    assert.equal(count(list, /class="m-chip /g), rates.rows.filter(row => row.live).length, key);
    assert.doesNotMatch(list, /m-row__badge/, `${key}: no gray badge`);
    assert.ok(html.includes(`<p class="m-energy-sheet__footer">${rates.footer}</p>`), key);
  }
  // Peak live at noon, off-peak at night.
  assert.deepEqual(bodyOf('energy billing', 'price').rates.rows.map(r => r.badge), ['Now', null]);
  assert.deepEqual(bodyOf('energy night', 'price').rates.rows.map(r => r.badge), [null, 'Now']);
});

test('Billing year: the rings from the value’s plot beside the register lines, then each register’s chip, ledger and note', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'billing-year'), html = draw(body), {summary} = body;
    // RingPair gets the value's plot, at the regular size, beside the lines.
    const rings = renderToStaticMarkup(h(RingPair, {plot: summary.rings.plot, size: 'regular'}));
    assert.ok(html.startsWith(`<div class="m-energy-sheet m-energy-sheet--year"><section class="m-energy-sheet__summary m-energy-sheet__rings">${rings}<div class="m-energy-sheet__registers">`), key);
    assert.equal(count(rings, /m-rings__ring--empty/g), summary.rings.plot.filter(p => p.state === 'missing').length, key);
    for (const line of summary.registers) assert.ok(html.includes(`<p class="m-energy-sheet__register m-tone-${line.tone}"><span class="m-energy-sheet__register-name">${line.name}</span>`
      + `<span class="m-energy-sheet__register-figure m-num">${line.figure}</span><span class="m-energy-sheet__register-line">${line.line}</span></p>`), `${key} ${line.name}`);
    // Each register's section: its dot and heading, its chip at the heading's end, then a card.
    const sections = [...html.matchAll(/<section class="m-energy-sheet__section">(.*?)<\/section>/g)].map(m => m[1]);
    assert.equal(sections.length, body.registers.length, key);
    body.registers.forEach((register, i) => {
      const section = sections[i], where = `${key} ${register.heading}`;
      assert.ok(section.startsWith(`<div class="m-energy-sheet__head"><h3 class="m-energy-sheet__heading"><span class="m-energy-sheet__dot m-tone-${register.tone}"></span>${register.heading}</h3>`
        + `<span class="m-chip m-tone-${register.chip.tone}"><span class="m-chip__label">${register.chip.label}</span></span></div><div class="m-card m-energy-sheet__card">`), where);
      if (register.bars) {
        assert.equal(count(section, /<div class="m-energy-ledger__row">/g), register.bars.length, where);
        for (const bar of register.bars) assert.ok(section.includes(`<div class="m-energy-ledger__row"><span class="m-energy-ledger__label">${bar.label}</span>`
          + `<span class="m-energy-ledger__bar"><i class="m-energy-ledger__fill m-tone-${bar.tone}" style="width:${bar.width}%"></i></span>`
          + `<span class="m-energy-ledger__value m-num">${bar.value}</span></div>`), `${where} ${bar.label}`);
      } else assert.doesNotMatch(section, /m-energy-ledger/, `${where}: no bars, only its chip and note`);
      // The note, its strong parts bold.
      const note = register.note.map(part => typeof part === 'string' ? unescape(part) : `<strong>${part.strong}</strong>`).join('');
      assert.ok(unescape(section).includes(`<p class="m-energy-sheet__note">${note}</p></div>`), where);
    });
  }
  // The billing house: 57% of peak's credit used, off-peak billing; the ledger's widths are the value's.
  const billing = draw(bodyOf('energy billing', 'billing-year'));
  assert.match(billing, /m-energy-ledger__fill m-tone-indigo" style="width:57%"/);
  assert.match(billing, /m-energy-ledger__fill m-tone-green" style="width:100%"/);
  assert.match(billing, /m-energy-ledger__fill m-tone-green" style="width:35%"/);
  // Peak is covered: its note says what that means, in the sheet's own words.
  assert.match(billing, /<h3 class="m-energy-sheet__heading"><span class="m-energy-sheet__dot m-tone-pink"><\/span>Peak hours<\/h3>.*?<p class="m-energy-sheet__note">Export has covered every kWh this register drew\.<\/p>/);
  // HOME quiet: peak has no bars (its chip and note alone), off-peak's ring is dashed.
  const quiet = bodyOf('home quiet', 'billing-year');
  assert.equal(quiet.registers[0].bars, null);
  assert.equal(count(draw(quiet), /<div class="m-energy-ledger">/g), quiet.registers.filter(r => r.bars).length);
  assert.equal(count(draw(quiet), /m-rings__ring--empty/g), 2);
});

test('Bill: the estimate large, its lines before VAT with the covered row only while export covers some, the cap (its rows while it has any), then the links as plain buttons', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'bill'), html = draw(body), {summary, lines, cap, links} = body;
    assert.ok(html.includes(`<p class="m-figure m-figure--above m-figure--large"><span class="m-figure__reading"><span class="m-figure__value m-num">${summary.figure}</span></span></p>`
      + `<p class="m-energy-sheet__line">${summary.line}</p>`), key);
    assert.equal(html.includes('m-energy-sheet__detail'), summary.detail !== null, key);
    if (summary.detail) assert.ok(html.includes(`<p class="m-energy-sheet__detail">${summary.detail}</p>`), key);
    // Before VAT: a row per line, then the covered row, green, only when there is one.
    const before = html.match(/<section class="m-energy-sheet__section"><h3 class="m-energy-sheet__heading">Before VAT<\/h3>(.*?)<\/section>/)?.[1];
    assert.ok(before !== undefined, key);
    assert.equal(count(before, /class="m-row m-row--bare"/g), lines.rows.length + (lines.covered ? 1 : 0), key);
    for (const row of lines.rows) assert.ok(unescape(before).includes(`<span class="m-row__title">${row.label}</span></span><span class="m-row__value m-num"`), `${key} ${row.label}`);
    assert.equal(before.includes('m-energy-sheet__covered'), lines.covered !== null, `${key}: the covered row only when present`);
    if (lines.covered) assert.ok(unescape(before).includes(`<span class="m-row__title"><span class="m-energy-sheet__covered">${lines.covered.label}</span></span>`
      + `<span class="m-row__detail" id="`), key);
    if (lines.covered) assert.ok(unescape(before).includes(`>${lines.covered.detail}</span>`), key);
    assert.equal(before.includes('m-list'), lines.rows.length > 0 || lines.covered !== null, `${key}: no empty list`);
    assert.equal(before.includes(`<p class="m-energy-sheet__footer">${lines.empty}</p>`), lines.empty !== null, key);
    // The cap: its chip at its heading's end, its rows, its line.
    assert.ok(html.includes(`<div class="m-energy-sheet__head"><h3 class="m-energy-sheet__heading">${cap.heading}</h3><span class="m-chip m-tone-${cap.chip.tone}"><span class="m-chip__label">${cap.chip.label}</span></span></div>`), key);
    for (const row of cap.rows) assert.match(html, new RegExp(`<span class="m-row__title">${row.label}</span></span><span class="m-row__value m-num"[^>]*>${escape(row.value)}</span>`), `${key} ${row.label}`);
    // The links: a plain button each, labelled by the value, disabled with it, after Why.
    const tail = html.slice(html.lastIndexOf('<div class="m-energy-sheet__links">'));
    const drawnLinks = buttons(tail);
    assert.equal(drawnLinks.length, links.length, key);
    links.forEach((link, i) => {
      assert.match(drawnLinks[i], /class="m-button m-button--plain m-button--regular m-focusable"/, `${key} ${link.label}`);
      assert.equal(/\bdisabled=""/.test(drawnLinks[i]), !link.enabled, `${key} ${link.label}`);
      assert.ok(tail.includes(`<span class="m-button__label">${link.label}</span>`), `${key} ${link.label}`);
    });
    // Each button is handed its link itself, so it sends the link's intent.
    const sent = drawn(body).filter(el => el.type === IntentButton).map(el => el.props.action);
    assert.deepEqual(sent, links, key);
    assert.deepEqual(sent.map(link => link.intent.command), ['more', 'ha-energy'], key);
  }
  // A cap without rows (no reading) is its chip and its line alone: no empty list.
  const unread = bodyOf('energy missing', 'bill'), bare = {...unread, cap: {...unread.cap, rows: []}};
  const capSection = html => html.match(/<section class="m-energy-sheet__section"><div class="m-energy-sheet__head"><h3 class="m-energy-sheet__heading">Network cost cap<\/h3>(.*?)<\/section>/)[1];
  assert.equal(capSection(draw(bare)), `<span class="m-chip m-tone-gray"><span class="m-chip__label">${bare.cap.chip.label}</span></span></div><p class="m-energy-sheet__note">${bare.cap.line.join('')}</p>`);
  assert.match(capSection(draw(bodyOf('energy billing', 'bill'))), /<div class="m-list m-list--inset" role="list">/);
  // Export covers the three billable lines in the covered house, none in the billing one.
  assert.equal(bodyOf('energy covered', 'bill').lines.covered.label, 'Covered by your export');
  assert.match(draw(bodyOf('energy covered', 'bill')), /Supplier energy · Green energy · Levies &amp; taxes/);
  assert.doesNotMatch(draw(bodyOf('energy billing', 'bill')), /m-energy-sheet__covered/);
});

test('Energy today: the breakdown without its link or legend, then a row per reading that opens it, "—" without one, then Full history', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'energy-today'), html = draw(body), {summary, rows} = body;
    assert.equal(summary.link, null, key);
    const {label, value, unit} = summary.figure;
    assert.ok(html.includes(`<section class="m-energy-sheet__summary"><p class="m-figure m-figure--above m-figure--large"><span class="m-figure__label">${label}</span>`
      + `<span class="m-figure__reading"><span class="m-figure__value m-num">${value}</span>${unit ? `<span class="m-figure__unit">${unit}</span>` : ''}</span></p>`), key);
    const bar = {split: 'm-segment-bar"', zero: 'm-segment-bar m-segment-bar--zero"', missing: 'm-segment-bar m-segment-bar--empty"'}[summary.bar.kind];
    assert.ok(html.includes(`<div class="${bar}`), `${key}: ${summary.bar.kind}`);
    assert.equal(count(html, /m-segment-bar__segment/g), summary.bar.segments.length, key);
    // No legend: the rows say each part's figure, so the sheet says each once.
    assert.doesNotMatch(html, /m-legend/, key);
    assert.match(html, /<\/div><\/section><section class="m-energy-sheet__section">/, `${key}: the bar ends the summary`);
    // The rows: pressable, each its tile, title and value, disabled with its link.
    const rowButtons = buttons(html).filter(tag => /m-row--pressable/.test(tag));
    assert.equal(rowButtons.length, rows.length, key);
    rows.forEach((row, i) => {
      assert.equal(/\bdisabled=""/.test(rowButtons[i]), !row.link.enabled, `${key} ${row.title}`);
      assert.match(html, new RegExp(`<span class="m-row__title">${row.title}</span></span><span class="m-row__value m-num"[^>]*>${escape(row.value)}</span>`), `${key} ${row.title}`);
    });
    // Each row's tile takes its tone: the bar's three parts in the bar's tones, so the rows are its key.
    rows.forEach(row => assert.match(html, new RegExp(`<span class="m-row__tile m-tone-${row.tone}"><span class="m-glyph" aria-hidden="true">.*?</span></span><span class="m-row__copy"><span class="m-row__title">${row.title}</span>`), `${key} ${row.title}`));
    const parts = Object.fromEntries(summary.bar.segments.map(segment => [segment.key, segment.tone]));
    for (const [title, part] of [['Used at home', 'home'], ['Exported', 'export'], ['From the grid', 'import']]) {
      if (parts[part]) assert.equal(rows.find(row => row.title === title).tone, parts[part], `${key} ${title}`);
    }
    // Each row is handed its link itself, and opens the reading in Home Assistant.
    const sent = drawn(body).filter(el => el.type === ListRow).map(el => el.props.link);
    assert.deepEqual(sent, rows.map(row => row.link), key);
    assert.ok(sent.every(link => link.intent.command === 'more'), key);
    // v37: then Full history, a plain button after Why, as the Bill's links,
    // since the chart's own action opens this sheet now.
    const tail = html.slice(html.lastIndexOf('<div class="m-energy-sheet__links">'));
    assert.ok(html.lastIndexOf('m-disclosure') < html.lastIndexOf('<div class="m-energy-sheet__links">'), `${key}: after Why`);
    assert.equal(buttons(tail).length, 1, key);
    assert.match(buttons(tail)[0], /class="m-button m-button--plain m-button--regular m-focusable"/, key);
    assert.ok(tail.includes('<span class="m-button__label">Full history</span>'), key);
    assert.deepEqual(drawn(body).filter(el => el.type === IntentButton).map(el => el.props.action), body.links, key);
    assert.deepEqual(body.links.map(link => link.intent), [{command: 'native-history', entity: 'power'}], key);
  }
  // The missing house: every reading '—', never 0.
  const missing = bodyOf('energy missing', 'energy-today'), html = draw(missing);
  assert.ok(missing.rows.every(row => row.value === '—'));
  assert.equal(count(html, /<span class="m-row__value m-num"[^>]*>—<\/span>/g), missing.rows.length);
  assert.match(html, /<span class="m-figure__value m-num">—<\/span><\/span><\/p>/);
  assert.doesNotMatch(textOf(html), /(?<![\d.])0(?:\.0+)?\s?(?:kWh|%)/);
});

test('a missing house draws the value’s dashes, never a 0', () => {
  for (const key of ['energy missing', 'home missing']) for (const id of IDS) {
    const body = bodyOf(key, id), html = draw(body), text = textOf(html);
    // Every '—' the value carries is drawn, and no reading is drawn as zero.
    const dashes = shownWords(body).filter(line => line === '—' || line.startsWith('— ')).length;
    assert.ok(count(text, /—/g) >= dashes, `${key} ${id}`);
    assert.doesNotMatch(text, /(?<![\d.,])0(?:[.,]0+)?\s?(?:€|kWh|%)(?!\w)/, `${key} ${id}`);
  }
  const bill = draw(bodyOf('energy missing', 'bill'));
  assert.match(bill, /<span class="m-figure__value m-num">—<\/span>/);
  // The cap with no reading: its chip and its line, and no rows of '—' under them.
  const cap = bill.match(/<h3 class="m-energy-sheet__heading">Network cost cap<\/h3>(.*?)<\/section>/)[1];
  assert.equal(cap, '<span class="m-chip m-tone-gray"><span class="m-chip__label">No reading</span></span></div><p class="m-energy-sheet__note">The cap has no reading.</p>');
  assert.match(draw(bodyOf('energy missing', 'price')), /<span class="m-figure__value m-num">—<\/span>/);
});

test('the sheet styles: grouped sections, the tones’ own colours, an 8px ledger, and nothing that widens or steals the scroll', () => {
  assert.match(energyDrawerStyles, /\.m-energy-sheet\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:var\(--m-space-6\);min-width:0\}/);
  for (const cls of ['section', 'summary', 'card', 'panel']) assert.match(energyDrawerStyles, new RegExp(`\\.m-energy-sheet__${cls}\\{[^}]*grid-template-columns:minmax\\(0,1fr\\)`), cls);
  assert.match(energyDrawerStyles, /\.m-energy-ledger\{display:grid;grid-template-columns:auto minmax\(0,1fr\) auto;/);
  assert.match(energyDrawerStyles, /\.m-energy-ledger__bar\{[^}]*height:8px;[^}]*border-radius:var\(--m-radius-capsule\)/);
  assert.match(energyDrawerStyles, /\.m-energy-ledger__fill\.m-tone-indigo\{background:var\(--m-indigo\)\}/);
  assert.match(energyDrawerStyles, /\.m-energy-ledger__fill\.m-tone-green\{background:var\(--m-green\)\}/);
  // Pink text is tinted toward the label, as a list tile's glyph; export's covered row is green text.
  assert.match(energyDrawerStyles, /\.m-energy-sheet__register\.m-tone-pink \.m-energy-sheet__register-name\{color:color-mix\(in srgb,var\(--m-pink\) 80%,var\(--m-label\)\)\}/);
  assert.match(energyDrawerStyles, /\.m-energy-sheet__covered\{color:var\(--m-green-text\)\}/);
  // No orange (nothing needs Alex), no blue (nothing here presses but the parts' own), no colour literal.
  assert.doesNotMatch(energyDrawerStyles, /--m-orange|--m-blue|#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  // The body keeps the sheet's pan-y, and nothing moves.
  assert.doesNotMatch(energyDrawerStyles, /touch-action|overflow-x|animation|transition|transform/);
  // A row's value keeps one line ('1234.56 €' at 320px), its title wrapping instead.
  assert.ok(energyDrawerStyles.includes('.m-energy-sheet .m-row__value{flex-shrink:0;max-width:none;white-space:nowrap}'));
  // Every flex or grid item that could widen a 327px sheet can shrink.
  for (const cls of ['m-energy-sheet__head', 'm-energy-sheet__price', 'm-energy-sheet__registers', 'm-energy-ledger', 'm-energy-sheet__links']) {
    assert.match(energyDrawerStyles, new RegExp(`\\.${cls}\\{[^}]*min-width:0`), cls);
  }
});
