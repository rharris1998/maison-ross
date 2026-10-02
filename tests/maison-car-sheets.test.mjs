// The Car's sheets (#29 step 4, v34): the Battery and
// Charging energy bodies (drawers/car.jsx), drawn from car.js's Drawer
// values as iOS grouped sections. Node has no JSX, so esbuild bundles the
// bodies with react-dom/server into a temporary module (as
// tests/maison-energy-sheets.test.mjs does), and each test reads the
// markup every Car fixture's sheets render to (CAR_FIXTURES and
// CAR_PAGE_FIXTURES), online and offline, and a few states laid over them
// (every meter at 0, a plan whose reserve conflicts with the limit, and the
// conflict alone): every section and heading from the value, the ring from
// the value's plot beside the headline, rows that open their readings with
// their tone tiles, Why collapsed as one card of paragraphs and logs, "—"
// drawn where the value says it and no number the value doesn't carry; and
// the gallery's sheet windows draw the dashboard's. The wording is car.js's
// and may change: these tests read every string from the value. What the
// values say is maison-car*.test.mjs's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen, words} from '../config/www/maison/screen.js';
import {CAR_DETAILS} from '../config/www/maison/car.js';
import {E} from '../config/www/maison/model.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {CAR_SHEETS, carSheetSnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {carDrawerStyles} from '../frontend/maison/src/drawers/car.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {DRAWERS} from './drawers.jsx';
export {BatteryDrawer, SourcesDrawer} from './drawers/car.jsx';
export {ListRow} from './ui/list.jsx';
export {Ring} from './ui/ring.jsx';
export {SheetPlacementContext} from './ui/sheet.jsx';
export {CommandContext} from './contexts.js';
export {createElement as h, isValidElement} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The bodies, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-car-sheets-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'sheets.mjs'), bundle.outputFiles[0].text);
const {h, isValidElement, renderToStaticMarkup, CommandContext, SheetPlacementContext, DRAWERS, BatteryDrawer, SourcesDrawer,
  ListRow, Ring} = await import(pathToFileURL(join(folder, 'sheets.mjs')));
rmSync(folder, {recursive: true, force: true});

// States laid over a fixture's: an entity's state and attributes changed.
const patch = (states, changes) => Object.fromEntries(Object.entries({...states, ...changes}).map(([id, entity]) =>
  [id, changes[id] ? {...states[id], ...changes[id], attributes: {...states[id]?.attributes, ...changes[id].attributes}} : entity]));
const base = id => CAR_FIXTURES.find(f => f.id === id);
// A ready reserve over the charge limit, as the policy reports it.
const CONFLICT = {[E.carPolicy]: {attributes: {reserve_conflict: true, ready_reserve: 90}}};
// Every Car fixture (CAR_FIXTURES and the page's own edges), online and
// offline, then three states over them: every meter at 0, a plan whose
// ready reserve conflicts with the charge limit, and at the limit, with no
// plan, the conflict alone.
const FIXTURES = [
  ...[...CAR_FIXTURES, ...CAR_PAGE_FIXTURES].flatMap(f => [true, false].map(online => ({key: `${f.id}${online ? '' : ' offline'}`, states: f.states, last: f.last ?? null, online}))),
  {key: 'meters at 0', states: patch(base('solar').states, Object.fromEntries([E.carEnergyOffpeak, E.carEnergyPeak, E.carEnergySolar].map(id => [id, {state: '0'}]))), last: null, online: true},
  {key: 'reserve conflict', states: patch(base('offpeak').states, CONFLICT), last: null, online: true},
  {key: 'conflict alone', states: patch(base('complete').states, CONFLICT), last: null, online: true},
];
const fixture = key => FIXTURES.find(f => f.key === key);
const IDS = CAR_DETAILS.map(d => d.id);
const KINDS = {battery: 'battery', 'charging-energy': 'sources'};
// A sheet's body for a fixture (by key) with `detail` open, at the fixtures' time.
const bodyOf = (key, detail) => {
  const f = fixture(key);
  return screen(fixtureSnapshot({now: CAR_NOW, carLast: f.last, online: f.online, states: f.states, route: {page: 'car', detail, dialog: null}})).drawer.body;
};
// A body's markup, drawn by DRAWERS as DrawerSheet draws it, in a
// bottom sheet (or `placement`), under a command that does nothing.
const draw = (body, placement = 'bottom') => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}},
  h(SheetPlacementContext.Provider, {value: placement}, h(DRAWERS[body.kind], {body}))));
const count = (html, pattern) => (html.match(pattern) || []).length;
const unescape = text => text.replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const textOf = html => unescape(html.replace(/<[^>]*>/g, ''));
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The sheet's section headings in order: its own h3s and its disclosures'
// titles, as a reader's heading list has them.
const headings = html => [...html.matchAll(/<h3 class="(m-car-sheet__heading|m-disclosure__heading)"[^>]*>(.*?)<\/h3>/g)].map(([, , inner]) => textOf(inner));
// Each <button …> opening tag.
const buttons = html => html.match(/<button[^>]*>/g) ?? [];
// The elements a body's function draws itself, walked through every prop
// (children, a row's title), and through car.jsx's own local parts
// (Section, Why, Rows; esbuild may number their names), which use no hooks,
// so each can be called; Maison's parts (Ring, ListRow…) are left as drawn.
const LOCAL = /^(Section|Why|Rows)\d*$/;
function elements(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, found));
  else if (isValidElement(node)) {
    found.push(node);
    if (typeof node.type === 'function' && LOCAL.test(node.type.name)) elements(node.type(node.props), found);
    else for (const value of Object.values(node.props)) elements(value, found);
  }
  return found;
}
const BODIES = {battery: BatteryDrawer, sources: SourcesDrawer};
const drawn = body => elements(BODIES[body.kind]({body}));
// A row's markup, from its value: its tile (in its tone, or ListRow's
// dashed one while the value flags it `unavailable`), its title, its detail
// and its value while set, then the chevron of a row that opens it, or the
// end of a plain row without a link.
const rowPattern = row => {
  const tile = row.unavailable === true ? '<span class="m-row__tile">' : `<span class="m-row__tile m-tone-${row.tone}">`;
  const detail = row.detail ? `<span class="m-row__detail" id="[^"]*">${escape(escapeHtml(row.detail))}</span>` : '';
  const value = row.value ? `<span class="m-row__value m-num" id="[^"]*">${escape(escapeHtml(row.value))}</span>` : '';
  return new RegExp(`${escape(tile)}<span class="m-glyph" aria-hidden="true">.*?</span></span><span class="m-row__copy"><span class="m-row__title">${escape(escapeHtml(row.title))}</span>${detail}</span>${value}`
    + (row.link ? '<span class="m-glyph m-row__chevron"' : '</div>'));
};
// Each row's opening tag, a button or a div, in order.
const rowTags = html => html.match(/<(?:button|div) class="m-row[ "][^>]*>/g) ?? [];
// The words a body's sheet draws: all of the value's, but for the
// breakdown's title ('Charging energy'), which the sheet's own title
// already says, and its legend, whose figures the rows under the bar give.
const shownWords = body => words(body.kind === 'sources' ? {...body, summary: {...body.summary, title: null, legend: []}} : body);

test('DRAWERS draws each Car sheet with its own body, and the gallery’s sheet windows draw the dashboard’s', () => {
  assert.equal(DRAWERS.battery, BatteryDrawer);
  assert.equal(DRAWERS.sources, SourcesDrawer);
  for (const id of IDS) assert.equal(bodyOf('solar', id).kind, KINDS[id], id);
  for (const id of IDS) assert.match(draw(bodyOf('solar', id)), new RegExp(`^<div class="m-car-sheet m-car-sheet--${KINDS[id]}">`), id);
  // Each CAR_SHEETS window's drawer draws through DRAWERS, as the dashboard's does.
  assert.ok(CAR_SHEETS.length > 0);
  for (const {id, detail} of CAR_SHEETS) {
    const body = screen(carSheetSnapshot(id)).drawer.body;
    assert.equal(body.kind, KINDS[detail], id);
    assert.match(draw(body), new RegExp(`^<div class="m-car-sheet m-car-sheet--${KINDS[detail]}">`), id);
    assert.match(draw(body, 'center'), new RegExp(`^<div class="m-car-sheet m-car-sheet--${KINDS[detail]}">`), id);
  }
  // The missing window's sheet has a meter without a reading: the value's dash, the bar dashed.
  const missing = screen(carSheetSnapshot('car-charging-energy-missing')).drawer.body;
  assert.equal(missing.summary.bar.kind, 'missing');
  assert.match(draw(missing), /<div class="m-segment-bar m-segment-bar--empty"/);
});

test('every fixture’s every sheet draws as grouped sections, each word from the value, no number it doesn’t carry, in both placements', () => {
  for (const {key} of FIXTURES) for (const id of IDS) {
    const body = bodyOf(key, id), where = `${key} ${id}`;
    for (const placement of ['bottom', 'center']) {
      const html = draw(body, placement), text = textOf(html);
      assert.match(html, new RegExp(`^<div class="m-car-sheet m-car-sheet--${body.kind}">`), where);
      assert.doesNotMatch(text, /undefined|null|NaN|\[object/, where);
      assert.equal(count(html, /<section class="m-car-sheet__summary[^"]*"/g), 1, `${where}: one summary`);
      assert.match(html, /^<div class="m-car-sheet m-car-sheet--\w+"><section class="m-car-sheet__summary/, `${where}: the summary leads`);
      assert.ok(count(html, /<section class="m-car-sheet__section"/g) >= 1, `${where}: grouped sections`);
      assert.equal(count(html, /m-button--filled/g), 0, `${where}: the Car's sheets only read and open`);
      assert.doesNotMatch(html, /m-tone-orange|m-tone-blue/, `${where}: nothing here needs Alex, and blue only presses`);
      // Every word the value carries is drawn, and every number drawn is the value's.
      for (const line of shownWords(body)) assert.ok(text.includes(line), `${where}: ${line}`);
      const said = words(body).join('\n');
      // Each element's text apart, so two neighbours' figures never run together.
      for (const [number] of unescape(html.replace(/<[^>]*>/g, '\n')).matchAll(/\d+(?:[.,:]\d+)*/g)) assert.ok(said.includes(number), `${where}: ${number} isn't the value's`);
    }
  }
});

test('each sheet’s sections come in the contract’s order, each headed by its value’s words, Why last and collapsed', () => {
  for (const {key} of FIXTURES) {
    const battery = bodyOf(key, 'battery'), sources = bodyOf(key, 'charging-energy');
    assert.deepEqual(headings(draw(battery)), [battery.readings.heading, battery.plan?.heading, battery.why?.title].filter(Boolean), key);
    // Charging energy's rows need no heading: the sheet's title names them.
    assert.deepEqual(headings(draw(sources)), [sources.why.title], key);
    for (const body of [battery, sources]) if (body.why) {
      const html = draw(body);
      assert.equal(count(html, /<div class="m-disclosure"/g), 1, `${key} ${body.kind}: Why starts collapsed`);
      assert.doesNotMatch(html, /data-expanded/, `${key} ${body.kind}`);
      assert.ok(html.endsWith('</div></div></div></div>'), `${key} ${body.kind}: Why ends the sheet`);
      assert.ok(html.lastIndexOf('<div class="m-disclosure"') > html.lastIndexOf('</section>'), `${key} ${body.kind}: Why comes after every section`);
    }
  }
  // The ids route to the sheets the contract names.
  assert.deepEqual(CAR_DETAILS.map(d => d.id), ['battery', 'charging-energy']);
});

test('Battery: the regular ring from the value’s plot beside the headline, the detail and the hint, each while the value has it', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'battery'), html = draw(body), {summary} = body, {plot} = summary.ring;
    // The ring is handed the value's plot, label and name, at the regular size.
    const rings = drawn(body).filter(el => el.type === Ring);
    assert.equal(rings.length, 1, key);
    const {props} = rings[0];
    assert.equal(props.value, plot.fill, key);
    assert.equal(props.tone, plot.tone, key);
    assert.equal(props.stale, plot.stale, key);
    assert.equal(props.label, summary.label, key);
    assert.equal(props.ariaLabel, summary.ring.ariaLabel, key);
    assert.ok(props.size === undefined || props.size === 'regular', `${key}: the regular ring`);
    assert.deepEqual(props.ticks, [{at: plot.reserve, kind: 'reserve'}, {at: plot.limit, kind: 'limit'}].filter(t => typeof t.at === 'number'), key);
    // In the markup: the ring first in the summary, its tone, empty and stale as the plot says, the label in its centre.
    const classes = ['m-ring', 'm-ring--regular', `m-tone-${plot.tone}`, plot.fill === null && 'm-ring--empty', plot.stale && 'm-ring--stale'].filter(Boolean).join(' ');
    assert.ok(html.startsWith(`<div class="m-car-sheet m-car-sheet--battery"><section class="m-car-sheet__summary"><svg class="${classes}" role="img" aria-label="${escapeHtml(summary.ring.ariaLabel)}"`), key);
    assert.ok(html.includes(`aria-hidden="true">${summary.label}</text></svg><div class="m-car-sheet__status">`), key);
    assert.equal(count(html, /<line class="m-ring__tick m-ring__tick--reserve"/g), typeof plot.reserve === 'number' ? 1 : 0, key);
    assert.equal(count(html, /<line class="m-ring__tick m-ring__tick--limit"/g), typeof plot.limit === 'number' ? 1 : 0, key);
    // Beside it: the headline, the detail while not empty, the hint while set; nothing else.
    const status = html.match(/<div class="m-car-sheet__status">(.*?)<\/div><\/section>/)?.[1];
    assert.equal(status, `<p class="m-car-sheet__headline">${escapeHtml(summary.headline)}</p>`
      + (summary.detail ? `<p class="m-car-sheet__detail">${escapeHtml(summary.detail)}</p>` : '')
      + (summary.hint ? `<p class="m-car-sheet__hint">${escapeHtml(summary.hint)}</p>` : ''), key);
  }
  // The dropout keeps its headline with the hint; the solar Car charges, so its ring is green.
  assert.ok(bodyOf('dropout', 'battery').summary.hint);
  assert.match(draw(bodyOf('dropout', 'battery')), /<p class="m-car-sheet__hint">/);
  assert.doesNotMatch(draw(bodyOf('solar', 'battery')), /m-car-sheet__hint/);
  assert.match(draw(bodyOf('solar', 'battery')), /<svg class="m-ring m-ring--regular m-tone-green"/);
  // Nothing confirmed yet: a dashed empty ring with the value's dash, never 0%.
  const never = bodyOf('never_confirmed', 'battery');
  assert.equal(never.summary.ring.plot.fill, null);
  assert.match(draw(never), new RegExp(`<svg class="m-ring m-ring--regular m-tone-gray m-ring--empty[^"]*"[^>]*>.*?aria-hidden="true">${escape(never.summary.label)}</text>`));
  assert.doesNotMatch(draw(never), /m-ring__fill/);
});

test('Battery: Readings is an inset list of rows that open their reading (a plain row without a link), with tone tiles, the value and the detail; "—" where the value says it', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'battery'), html = draw(body), {rows} = body.readings;
    const section = html.match(new RegExp(`<section class="m-car-sheet__section"><h3 class="m-car-sheet__heading">${escape(body.readings.heading)}</h3>(.*?)</section>`))?.[1];
    assert.ok(section?.startsWith('<div class="m-list m-list--inset" role="list">'), key);
    // A pressable row per reading with a link, disabled only with it; a plain row without one.
    const tags = rowTags(section);
    assert.equal(tags.length, rows.length, key);
    assert.equal(count(section, /<div class="m-list__item" role="listitem">/g), rows.length, key);
    rows.forEach((row, i) => {
      const where = `${key} ${row.title}`;
      assert.equal(tags[i].startsWith('<button class="m-row m-row--pressable'), Boolean(row.link), where);
      if (row.link) assert.equal(/\bdisabled=""/.test(tags[i]), !row.link.enabled, where);
      // The tile in the row's tone (dashed while unavailable), then the title, the detail while set, the value while set, the chevron.
      assert.match(section, rowPattern(row), where);
      assert.equal(/ m-row--unavailable[ "]/.test(tags[i]), row.unavailable === true, where);
    });
    // Each row is handed its link itself, and opens the reading in Home Assistant.
    const sent = drawn(body).filter(el => el.type === ListRow).map(el => el.props.link);
    assert.deepEqual(sent, rows.map(row => row.link), key);
    assert.ok(sent.filter(Boolean).every(link => link.intent.command === 'more'), key);
    // Only green and gray tiles: the Car charges, or it is a plain reading.
    assert.ok(rows.every(row => ['green', 'gray'].includes(row.tone)), key);
  }
  // Nothing confirmed yet: the battery and limit read the value's '—', drawn as it is, never 0.
  const never = bodyOf('never_confirmed', 'battery'), html = draw(never);
  const dashes = never.readings.rows.filter(row => row.value === '—');
  assert.ok(dashes.length >= 2);
  assert.equal(count(html, /<span class="m-row__value m-num"[^>]*>—<\/span>/g), dashes.length);
  assert.doesNotMatch(textOf(html), /(?<![\d.])0(?:\.0+)?\s?(?:kW|%)(?!\w)/);
});

test('Battery: Plan is a card of the value’s line with its note as a caption, only while there is a plan', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'battery'), html = draw(body), {plan} = body;
    if (!plan) {
      assert.equal(count(html, /<section class="m-car-sheet__section">/g), 1, `${key}: Readings alone`);
      assert.doesNotMatch(html, /m-car-sheet__card"><p class="m-car-sheet__text">[^<]*<\/p><\/div><(?:\/section|p class="m-car-sheet__footer")/, key);
      continue;
    }
    const section = html.match(new RegExp(`<section class="m-car-sheet__section"><h3 class="m-car-sheet__heading">${escape(plan.heading)}</h3>(.*?)</section>`))?.[1];
    assert.equal(section, `<div class="m-card m-car-sheet__card"><p class="m-car-sheet__text">${escapeHtml(plan.line)}</p></div>`
      + (plan.note ? `<p class="m-car-sheet__footer">${escapeHtml(plan.note)}</p>` : ''), key);
  }
  // The reserve over the limit: the plan's note is its caption.
  const conflict = bodyOf('reserve conflict', 'battery');
  assert.ok(conflict.plan?.note, 'the conflict fixture has a note');
  assert.ok(draw(conflict).includes(`<p class="m-car-sheet__footer">${escapeHtml(conflict.plan.note)}</p></section>`));
  // With no plan, the conflict alone is the plan: its line on the card, no caption.
  const alone = bodyOf('conflict alone', 'battery');
  assert.ok(alone.plan?.line && alone.plan.note === null, 'the conflict alone is a plan with no note');
  assert.ok(draw(alone).includes(`<h3 class="m-car-sheet__heading">${escapeHtml(alone.plan.heading)}</h3><div class="m-card m-car-sheet__card"><p class="m-car-sheet__text">${escapeHtml(alone.plan.line)}</p></div></section>`));
  assert.ok(bodyOf('solar', 'battery').plan);
  assert.equal(bodyOf('unplugged', 'battery').plan, null);
});

test('Why: one card of the value’s paragraphs, then, in the same card, each log as a caption label over its text', () => {
  const panelOf = html => html.match(/<div class="m-car-sheet__panel">(.*)<\/div><\/div><\/div><\/div>$/)?.[1];
  const expected = why => `<div class="m-card m-car-sheet__card">${why.paragraphs.map(p => `<p class="m-car-sheet__text">${escapeHtml(p)}</p>`).join('')}`
    + `${why.logs.map(log => `<div class="m-car-sheet__log"><p class="m-car-sheet__log-label">${escapeHtml(log.label)}</p><p class="m-car-sheet__text">${escapeHtml(log.text)}</p></div>`).join('')}</div>`;
  for (const {key} of FIXTURES) for (const id of IDS) {
    const body = bodyOf(key, id), where = `${key} ${id}`;
    if (!body.why) { assert.doesNotMatch(draw(body), /m-disclosure/, where); continue; }
    const html = draw(body);
    assert.match(html, new RegExp(`<h3 class="m-disclosure__heading"[^>]*><button[^>]*><span class="m-disclosure__title">${escape(body.why.title)}</span>`), where);
    assert.equal(panelOf(html), expected(body.why), where);
    // Why reads as one group: one card, nothing bare on the sheet beside it.
    assert.equal(count(panelOf(html), /class="m-card /g), 1, where);
  }
  // Not verified: the policy's reason and basis, then the logs, all on the one card.
  const asleep = bodyOf('not_verified', 'battery');
  assert.ok(asleep.why.paragraphs.length > 0 && asleep.why.logs.length > 0);
  assert.equal(count(draw(asleep), /<div class="m-car-sheet__log">/g), asleep.why.logs.length);
  assert.match(draw(asleep), /<\/p><div class="m-car-sheet__log">/);
  // Charging energy's Why has no logs.
  assert.deepEqual(bodyOf('solar', 'charging-energy').why.logs, []);
  assert.doesNotMatch(draw(bodyOf('solar', 'charging-energy')), /m-car-sheet__log/);
  // Logs without paragraphs: the card holds the logs alone; neither: no Why at all.
  const solar = bodyOf('solar', 'battery');
  const logsOnly = {...solar, why: {...solar.why, paragraphs: []}};
  assert.equal(panelOf(draw(logsOnly)), expected(logsOnly.why));
  assert.match(draw(logsOnly), /<div class="m-card m-car-sheet__card"><div class="m-car-sheet__log">/);
  assert.doesNotMatch(draw({...solar, why: null}), /m-disclosure|m-car-sheet__panel/);
});

test('Charging energy: the breakdown without its link or legend, then a row per meter that opens it, then the footer, "—" without a reading', () => {
  for (const {key} of FIXTURES) {
    const body = bodyOf(key, 'charging-energy'), html = draw(body), {summary, rows, footer} = body;
    assert.equal(summary.link, null, key);
    // The figure large, its label above it, its unit beside it while it has one.
    const {label, value, unit} = summary.figure;
    assert.ok(html.startsWith(`<div class="m-car-sheet m-car-sheet--sources"><section class="m-car-sheet__summary m-car-sheet__summary--energy"><p class="m-figure m-figure--above m-figure--large">`
      + `<span class="m-figure__label">${escapeHtml(label)}</span><span class="m-figure__reading"><span class="m-figure__value m-num">${escapeHtml(value)}</span>`
      + `${unit ? `<span class="m-figure__unit">${unit}</span>` : ''}</span></p>`), key);
    // The bar across the summary: split into the value's segments, or empty as zero or missing.
    const bar = {split: 'm-segment-bar"', zero: 'm-segment-bar m-segment-bar--zero"', missing: 'm-segment-bar m-segment-bar--empty"'}[summary.bar.kind];
    assert.ok(html.includes(`<div class="${bar} role="img" aria-label="${escapeHtml(summary.bar.ariaLabel)}"`), `${key}: ${summary.bar.kind}`);
    assert.equal(count(html, /m-segment-bar__segment/g), summary.bar.segments.length, key);
    summary.bar.segments.forEach(segment => assert.match(html, new RegExp(`m-segment-bar__segment m-tone-${segment.tone}`), `${key} ${segment.key}`));
    // No legend: the rows say each source's figure, so the sheet says each once.
    assert.doesNotMatch(html, /m-legend/, key);
    assert.match(html, /<\/div><\/section><section class="m-car-sheet__section"><div class="m-list m-list--inset" role="list">/, `${key}: the bar ends the summary, the rows follow it`);
    // The rows: pressable, each its tone tile, title and value, disabled with its link.
    const section = html.match(/<section class="m-car-sheet__section">(.*?)<\/section>/)[1];
    const tags = rowTags(section);
    assert.equal(tags.length, rows.length, key);
    rows.forEach((row, i) => {
      assert.ok(tags[i].startsWith('<button class="m-row m-row--pressable'), `${key} ${row.title}: each meter opens`);
      assert.equal(/\bdisabled=""/.test(tags[i]), !row.link.enabled, `${key} ${row.title}`);
      assert.match(section, rowPattern(row), `${key} ${row.title}`);
      assert.equal(/ m-row--unavailable[ "]/.test(tags[i]), row.unavailable === true, `${key} ${row.title}`);
    });
    // The rows are the bar's key: each source's tile is its segment's tone.
    assert.deepEqual(rows.map(row => row.tone).sort(), ['indigo', 'pink', 'yellow'], key);
    // Each row is handed its link itself, and opens its meter in Home Assistant.
    const sent = drawn(body).filter(el => el.type === ListRow).map(el => el.props.link);
    assert.deepEqual(sent, rows.map(row => row.link), key);
    assert.ok(sent.every(link => link.intent.command === 'more'), key);
    // The footer as the list's caption, while the value has one.
    assert.equal(section.endsWith(`</div><p class="m-car-sheet__footer">${footer ? escapeHtml(footer) : ''}</p>`), Boolean(footer), key);
    if (!footer) assert.doesNotMatch(section, /m-car-sheet__footer/, key);
  }
  // A meter missing: the figure and its row read the value's '—', the bar is dashed, never a 0.
  const missing = bodyOf('meter_missing', 'charging-energy'), html = draw(missing);
  assert.equal(missing.summary.bar.kind, 'missing');
  assert.equal(missing.summary.figure.value, '—');
  assert.match(html, /<span class="m-figure__value m-num">—<\/span><\/span><\/p>/);
  assert.match(html, /<div class="m-segment-bar m-segment-bar--empty"/);
  assert.equal(count(html, /<span class="m-row__value m-num"[^>]*>—<\/span>/g), missing.rows.filter(row => row.value === '—').length);
  assert.ok(missing.rows.some(row => row.value === '—'));
  // Every meter at 0: a solid gray empty bar, the value's zeros, never a dash.
  const zero = bodyOf('meters at 0', 'charging-energy');
  assert.equal(zero.summary.bar.kind, 'zero');
  assert.match(draw(zero), /<div class="m-segment-bar m-segment-bar--zero"/);
});

test('a reading without a link is a plain row, with no chevron and no press', () => {
  // The Ready reserve's reading (the policy's): car.js gives it no link, since its dialog would show the policy's state.
  const body = bodyOf('solar', 'battery'), {rows} = body.readings, html = draw(body), tags = rowTags(html);
  const plain = rows.map((row, i) => [row, i]).filter(([row]) => !row.link);
  assert.ok(plain.length > 0, 'the value has a reading without a link');
  assert.equal(tags.filter(tag => tag.startsWith('<button')).length, rows.length - plain.length);
  for (const [row, i] of plain) {
    assert.ok(tags[i].startsWith('<div class="m-row"'), `${row.title}: ${tags[i]}`);
    assert.match(html, rowPattern(row), row.title);
  }
  assert.equal(count(html, /m-row__chevron/g), rows.length - plain.length);
});

test('a row the value flags unavailable draws ListRow’s dashed tile, never its tone, and its dash', () => {
  // Nothing confirmed yet (the battery and limit) and a meter missing: car.js flags each row without a reading.
  for (const body of [bodyOf('never_confirmed', 'battery'), bodyOf('meter_missing', 'charging-energy')]) {
    const rows = body.kind === 'battery' ? body.readings.rows : body.rows, html = draw(body), flagged = rows.filter(row => row.unavailable);
    assert.ok(flagged.length > 0, body.kind);
    assert.ok(flagged.every(row => row.value === '—'), `${body.kind}: a flagged row reads the value's dash`);
    assert.equal(count(html, /class="m-row m-row--pressable m-row--unavailable m-focusable"/g), flagged.filter(row => row.link).length, body.kind);
    assert.equal(count(html, /class="m-row[^"]*m-row--unavailable/g), flagged.length, body.kind);
    assert.equal(count(html, /<span class="m-row__tile">/g), flagged.length, `${body.kind}: no tone on a tile without a reading`);
    for (const row of rows) assert.match(html, rowPattern(row), `${body.kind} ${row.title}`);
    // Each flagged row is handed the flag; the others draw as before.
    const drawnRows = drawn(body).filter(el => el.type === ListRow);
    assert.deepEqual(drawnRows.map(el => el.props.unavailable), rows.map(row => row.unavailable === true), body.kind);
  }
});

test('the sheet styles: grouped sections, a ring that sits beside its words, rows that never break a word, and nothing that widens or steals the scroll', () => {
  assert.match(carDrawerStyles, /\.m-car-sheet\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:var\(--m-space-6\);min-width:0\}/);
  for (const cls of ['section', 'summary--energy', 'card', 'panel', 'log']) assert.match(carDrawerStyles, new RegExp(`\\.m-car-sheet__${cls}\\{[^}]*grid-template-columns:minmax\\(0,1fr\\)`), cls);
  // Section headings in headline, captions in footnote secondary, the log's label a caption.
  assert.match(carDrawerStyles, /\.m-car-sheet__heading\{[^}]*font:var\(--m-type-headline\);color:var\(--m-label\)/);
  assert.match(carDrawerStyles, /\.m-car-sheet__footer\{[^}]*font:var\(--m-type-footnote\);color:var\(--m-label-2\)/);
  assert.match(carDrawerStyles, /\.m-car-sheet__log-label\{[^}]*font:var\(--m-type-footnote\);color:var\(--m-label-2\)/);
  // The summary: the ring beside its words, which wrap under it when the sheet is too narrow; the headline in headline.
  assert.match(carDrawerStyles, /\.m-car-sheet__summary\{display:flex;flex-wrap:wrap;align-items:center;[^}]*min-width:0/);
  // Once the words wrap under the ring (320px), the ring is centred on its line.
  assert.match(carDrawerStyles, /\.m-car-sheet__summary\{[^}]*justify-content:center/);
  assert.match(carDrawerStyles, /\.m-car-sheet__summary>\.m-ring\{flex:none;max-width:100%/);
  assert.match(carDrawerStyles, /\.m-car-sheet__status\{flex:1 1 \d+px;[^}]*min-width:0/);
  assert.match(carDrawerStyles, /\.m-car-sheet__headline\{[^}]*font:var\(--m-type-headline\)/);
  // A wrapped headline is balanced, and a wrapped row title or detail leaves no word alone on its last line.
  assert.match(carDrawerStyles, /\.m-car-sheet__headline\{[^}]*text-wrap:balance/);
  // In a row, neither the title nor the value breaks inside a word: the title never narrows past its
  // longest word, and the value takes the rest, wrapping only between its words ('80% at / 14:40' at
  // 320px beside 'Tesla’s estimate', where a value held to one line left the title a few letters a line).
  assert.ok(carDrawerStyles.includes('.m-car-sheet .m-row__copy{min-width:min-content}'));
  assert.ok(carDrawerStyles.includes('.m-car-sheet :is(.m-row__title,.m-row__detail){overflow-wrap:break-word;text-wrap:pretty}'));
  assert.ok(carDrawerStyles.includes('.m-car-sheet .m-row__value{flex:0 1 auto;min-width:min-content;max-width:none;overflow-wrap:normal}'));
  // Why is a heading like the others, its 44px trigger reaching into the gap around it.
  assert.match(carDrawerStyles, /\.m-car-sheet>\.m-disclosure\{margin-block:calc\(\(22px - var\(--m-hit\)\) \/ 2\)\}/);
  // No orange (nothing needs Alex), no blue (nothing here presses but the parts' own), no colour literal.
  assert.doesNotMatch(carDrawerStyles, /--m-orange|--m-blue|#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  // The body keeps the sheet's pan-y, and nothing moves or makes a containing block.
  assert.doesNotMatch(carDrawerStyles, /touch-action|overflow-x|animation|transition|transform|filter|contain|will-change|perspective/);
  // Every flex or grid item that could widen a 327px sheet can shrink.
  for (const cls of ['m-car-sheet', 'm-car-sheet__section', 'm-car-sheet__summary', 'm-car-sheet__status', 'm-car-sheet__panel', 'm-car-sheet__log']) {
    assert.match(carDrawerStyles, new RegExp(`\\.${cls}\\{[^}]*min-width:0`), cls);
  }
});
