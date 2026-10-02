// Climate's sheets (#29 step 4, v32): the House, a zone's
// and the towel rails' bodies (drawers/climate.jsx), drawn from
// climate.js's Drawer values as iOS grouped sections. Node has no JSX, so
// esbuild bundles the bodies with react-dom/server into a temporary module
// (as tests/maison-controls-b.test.mjs does), and each test reads the
// markup every fixture's sheets render to: the sections and their headings
// in order, the house control's four forms, no disclosure in a zone sheet,
// "Raise comfort" in reach, a name of its own for every focusable control
// in a zone sheet, one filled button per sheet at most, needs-you warnings
// with their orange glyph, and every press the value carries drawn once.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {CLIMATE_CONTRACT} from '../config/www/maison/model.js';
import {CLIMATE_FIXTURES, CLIMATE_NOW} from '../frontend/maison/fixtures/climate-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {CLIMATE_SHEETS, THERMOSTAT, climateSheetSnapshot, climateSnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {climateDrawerStyles} from '../frontend/maison/src/drawers/climate.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {DRAWERS} from './drawers.jsx';
export {HouseDrawer, ZoneDrawer, RailsDrawer} from './drawers/climate.jsx';
export {PriceDrawer, YearDrawer, BillDrawer, DayDrawer} from './drawers/energy.jsx';
export {BatteryDrawer, SourcesDrawer} from './drawers/car.jsx';
export {SheetPlacementContext} from './ui/sheet.jsx';
export {CommandContext} from './contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The bodies, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-climate-sheets-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'sheets.mjs'), bundle.outputFiles[0].text);
const {h, renderToStaticMarkup, CommandContext, SheetPlacementContext, DRAWERS, HouseDrawer, ZoneDrawer, RailsDrawer,
  PriceDrawer, YearDrawer, BillDrawer, DayDrawer, BatteryDrawer, SourcesDrawer} = await import(pathToFileURL(join(folder, 'sheets.mjs')));
rmSync(folder, {recursive: true, force: true});

const IDS = ['house', 'attic', 'sam', 'noah', 'bedroom-suite', 'towel-rails'];
const ZONE_IDS = ['attic', 'sam', 'noah', 'bedroom-suite'];
// A drawer's body for a fixture (by id) with `detail` open, or for a snapshot.
const bodyOf = (fixture, detail, options = {}) => screen(climateSnapshot(fixture, {detail, ...options})).drawer.body;
const bodyAt = snapshot => screen(snapshot).drawer.body;
// A body's markup, drawn by DRAWERS as DrawerSheet draws it, in a
// bottom sheet, under a command that does nothing.
const draw = (body, placement = 'bottom') => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}},
  h(SheetPlacementContext.Provider, {value: placement}, h(DRAWERS[body.kind], {body}))));
const count = (html, pattern) => (html.match(pattern) || []).length;
const unescape = text => text.replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const textOf = html => unescape(html.replace(/<[^>]*>/g, ''));
// The sheet's section headings in order: its own h3s and its disclosures'
// titles, with the charts' titles, as a reader's heading list has them.
const headings = html => [...html.matchAll(/<h3 class="(m-climate-sheet__heading|m-disclosure__heading|m-history__title)"[^>]*>(.*?)<\/h3>/g)]
  .map(([, , inner]) => textOf(inner));
// Each <button …> and <input …> opening tag, and the buttons by class.
const buttons = html => html.match(/<button[^>]*>/g) ?? [];
const withClass = (html, cls) => buttons(html).filter(tag => new RegExp(`class="[^"]*\\b${cls}\\b`).test(tag));
// Every Control and Link in a value: an object with an intent.
function presses(value, found = []) {
  if (Array.isArray(value)) value.forEach(item => presses(item, found));
  else if (value && typeof value === 'object') {
    if (value.intent && typeof value.enabled === 'boolean' && !found.includes(value)) found.push(value);
    for (const [key, item] of Object.entries(value)) if (key !== 'intent' && key !== 'model') presses(item, found);
  }
  return found;
}
// The focusable controls in a body's markup that a Tab would reach (neither
// disabled nor taken out of the order, nor in a closed panel), each by its
// accessible name: its aria-label, else its text.
function focusables(html) {
  const found = [], pattern = /<button\b([^>]*)>([\s\S]*?)<\/button>|<input\b([^>]*)>/g;
  for (const [, button, inner = '', input] of html.matchAll(pattern)) {
    const attrs = button ?? input;
    if (/\bdisabled=""/.test(attrs) || /tabindex="-1"/.test(attrs)) continue;
    found.push(unescape(attrs.match(/aria-label="([^"]*)"/)?.[1] ?? textOf(inner).trim()) || (button ? '<button>' : '<input>'));
  }
  return found;
}

test('DRAWERS draws every Drawer kind with its own body, and DrawerSheet no longer falls back to the old one', () => {
  // Climate's three (v32), then Energy's four (v33; maison-energy-sheets.test.mjs draws them),
  // then the Car's two (v34; maison-car-sheets.test.mjs draws them).
  assert.deepEqual(DRAWERS, {house: HouseDrawer, zone: ZoneDrawer, rails: RailsDrawer,
    price: PriceDrawer, year: YearDrawer, bill: BillDrawer, day: DayDrawer,
    battery: BatteryDrawer, sources: SourcesDrawer});
  const sheets = readFileSync(join(SRC, 'sheets.jsx'), 'utf8');
  assert.match(sheets, /Body = shown && DRAWERS\[shown\.body\.kind\];/);
  assert.doesNotMatch(sheets, /ClimateDrawer|climate\/drawers\.jsx/);
  for (const id of IDS) assert.ok(DRAWERS[bodyOf('house_running', id).kind], id);
});

test('every fixture’s every sheet draws as grouped sections, its words from the value, "—" never 0, in both placements', () => {
  for (const fixture of CLIMATE_FIXTURES) for (const id of IDS) {
    const body = bodyOf(fixture.id, id), where = `${fixture.id} ${id}`;
    for (const placement of ['bottom', 'center']) {
      const html = draw(body, placement);
      assert.match(html, new RegExp(`^<div class="m-climate-sheet m-climate-sheet--${body.kind}">`), where);
      assert.doesNotMatch(textOf(html), /undefined|null|NaN|\[object/, where);
      assert.ok(count(html, /<section class="m-climate-sheet__section[^"]*"/g) >= 2, `${where}: grouped sections`);
      assert.ok(count(html, /m-button--filled/g) <= 1, `${where}: one filled button at most`);
      assert.match(html, new RegExp(`data-box="${placement}"`), `${where}: the charts take the sheet's box`);
    }
    const html = draw(body);
    // A reading the value says is missing is drawn as the value's dash.
    if (body.reading) {
      assert.match(html, new RegExp(`<span class="m-figure__value m-num">${body.reading.reading}</span>`), where);
      if (body.reading.reading === '—') assert.match(html, /m-target-bar--empty/, where);
    }
    assert.doesNotMatch(html, /<span class="m-figure__value m-num">0(?:\.0)?°?<\/span>/, where);
  }
});

test('each sheet’s sections come in the contract’s order, each headed by its value’s words, never one twice in a row', () => {
  const titles = (body, extra) => [...extra, ...body.charts.map(chart => chart.model.title)];
  const house = bodyOf('house_running', 'house');
  assert.deepEqual(headings(draw(house)), [house.control.step.title, house.control.away.summary, house.titles.why, house.week.title,
    ...titles(house, []), house.outdoor.title, house.radiators.heading]);
  assert.deepEqual(headings(draw(house)).slice(0, 3), ['Override', 'Away', 'Why']);
  const attic = bodyAt(climateSheetSnapshot('sheet-attic'));
  assert.deepEqual(headings(draw(attic)), ['Radiator heat', 'Target', attic.schedule.title, attic.airco.title, ...titles(attic, []), attic.radiators.heading]);
  // A single radiator names itself: no heading over it.
  const noah = bodyOf('house_running', 'noah');
  assert.equal(noah.radiators.heading, null);
  assert.deepEqual(headings(draw(noah)), [noah.titles.target, ...titles(noah, [])]);
  // The rails: no heading the sheet's title already gives, and no Radiators section.
  const rails = bodyOf('house_override', 'towel-rails');
  assert.deepEqual(headings(draw(rails)), titles(rails, []));
  // Outside only with the boiler's reading.
  const unread = bodyOf('sensors_unavailable', 'house');
  assert.equal(unread.outdoor, null);
  assert.ok(!headings(draw(unread)).includes('Outside'));
  for (const fixture of CLIMATE_FIXTURES) for (const id of IDS) {
    const list = headings(draw(bodyOf(fixture.id, id)));
    list.forEach((title, i) => assert.notEqual(title, list[i - 1], `${fixture.id} ${id}: ${title} twice`));
  }
});

test('the summary: the figure, a named wide bar, the line, then the facts with the flag as a badge', () => {
  const body = bodyOf('dry_humid', 'attic'), html = draw(body);
  const summary = html.match(/<section class="m-climate-sheet__summary">(.*?)<\/section>/)[1];
  // The figure is hidden: the bar's name, next, starts with the reading.
  assert.match(summary, new RegExp(`^<div class="m-climate-sheet__figure" aria-hidden="true"><p class="m-figure m-figure--above m-figure--large">.*${body.reading.reading}.*</p></div><span class="m-target-bar m-target-bar--wide" role="img" aria-label="${body.reading.bar.ariaLabel}">`));
  assert.ok(body.reading.bar.ariaLabel.startsWith(body.reading.reading));
  assert.match(summary, new RegExp(`<p class="m-climate-sheet__line">${body.reading.line}</p>`));
  // Each fact: its glyph and short words hidden, its name read, the flag read as it is.
  const facts = summary.match(/<p class="m-climate-sheet__facts">(.*)<\/p>/)[1];
  assert.equal(count(facts, /class="m-climate-sheet__fact"/g), body.facts.length);
  for (const fact of body.facts) assert.match(facts, new RegExp(`<span class="m-climate-sheet__fact"><span class="m-climate-sheet__fact-text" aria-hidden="true">(<span class="m-glyph"[^>]*>.*?</span>)?${fact.text}</span><span class="m-visually-hidden">${fact.ariaLabel}</span>${fact.flag ? `<span class="m-climate-sheet__flag">${fact.flag}</span>` : ''}</span>`), fact.ariaLabel);
  assert.ok(body.facts.some(fact => fact.flag), 'the fixture has a flag');
  // The House sheet's facts leave Outside to its own section; no reading, no fact.
  const house = draw(bodyOf('house_running', 'house')).match(/<p class="m-climate-sheet__facts">(.*?)<\/p>/)[1];
  assert.doesNotMatch(house, /Outside/);
  assert.doesNotMatch(draw(bodyOf('sensors_unavailable', 'attic')), /m-visually-hidden">[^<]*—|humidity<\/span>/);
  assert.doesNotMatch(draw(bodyOf('house_running', 'towel-rails')), /m-climate-sheet__summary/, 'the rails have no reading to sum up');
  // No reading: the dash is secondary, as on the page, and the bar says so.
  const none = bodyOf('sensors_unavailable', 'attic');
  assert.match(draw(none), /^<div class="m-climate-sheet m-climate-sheet--zone"><section class="m-climate-sheet__summary"><div class="m-climate-sheet__figure m-climate-sheet__figure--empty" aria-hidden="true"><p class="m-figure[^"]*"><span class="m-figure__reading"><span class="m-figure__value m-num">—<\/span>/);
  assert.match(draw(none), /role="img" aria-label="No reading/);
  assert.match(climateDrawerStyles, /\.m-climate-sheet__figure--empty \.m-figure__value\{color:var\(--m-label-2\)\}/);
});

test('the House sheet’s override: its steppers and ends in one group, the detail as the caption, Hold as the one filled button, Away behind a disclosure', () => {
  const body = bodyOf('house_running', 'house'), c = body.control, html = draw(body);
  assert.equal(c.kind, 'override');
  const section = html.match(/<section class="m-climate-sheet__section" data-focus-section="control"><h3 class="m-climate-sheet__heading">Override<\/h3>(.*?)<\/section>/)[1];
  assert.match(section, new RegExp(`<span class="m-row__title">${body.titles.temperature}</span></span><span class="m-row__accessory"><div class="m-stepper" aria-label="${body.titles.temperature}"`));
  assert.match(section, /aria-label="Cooler"[\s\S]*<output class="m-stepper__value m-num" aria-label="House heating override">20°<\/output>[\s\S]*aria-label="Warmer"/);
  assert.match(section, new RegExp(`<div class="m-row m-row--bare m-climate-sheet__stacked"><span class="m-row__title">${body.titles.ends}</span><div class="m-segmented m-climate-sheet__ends"[^>]*aria-label="${c.endsLabel}" role="radiogroup"`));
  assert.equal(count(section, /role="radio"/g), c.ends.length);
  // No caption while no override runs: the Ends row says when a new one ends.
  assert.equal(c.footer, null);
  assert.doesNotMatch(section, /m-climate-sheet__footer|m-row__detail/);
  const running = bodyOf('house_override', 'house');
  assert.match(draw(running), new RegExp(`</div><p class="m-climate-sheet__footer">${running.control.footer}</p>`), 'the running override’s caption under the group');
  const filled = withClass(html, 'm-button--filled');
  assert.equal(filled.length, 1);
  assert.match(section, new RegExp(`m-button--filled m-button--regular m-button--wide[^>]*><span class="m-button__label">${c.start.label}</span>`));
  assert.equal(c.cancel, null);
  assert.doesNotMatch(section, /Cancel override/);
  // Away: a disclosure after the override, closed, holding the text, the date field and Set Away.
  const away = html.match(/<div class="m-disclosure"[^>]*><h3 class="m-disclosure__heading"><button[^>]*aria-expanded="false"[^>]*><span class="m-disclosure__title">Away<\/span>[\s\S]*?<\/button><\/div><\/div><\/div>/)?.[0];
  assert.ok(away, 'Away is a closed disclosure');
  assert.match(away, new RegExp(`<div class="m-card m-climate-sheet__card"><p class="m-climate-sheet__text">${c.away.text}</p><div class="m-date-field"><label class="m-date-field__label" for="[^"]+">${c.away.field.label}</label><input class="m-date-field__input"[^>]*type="datetime-local"[^>]*min="${c.away.field.min}" max="${c.away.field.max}"`));
  assert.match(away, /<\/div><div class="m-climate-sheet__actions"><button class="m-button m-button--tinted m-button--regular m-button--wide[^>]*><span class="m-button__label">Set Away<\/span><\/button><\/div><\/div>/, 'Set Away on the card, where tinted reads 4.6:1');
  assert.ok(html.indexOf('>Away</span>') > html.indexOf('Hold 20°') && html.indexOf('>Why</span>') > html.indexOf('>Away</span>'));
  // A time outside the field's range: the needs-you line between the field and Set Away, on the card.
  assert.equal(c.away.warning, null);
  assert.doesNotMatch(away, /m-climate-sheet__warning/);
  const late = bodyAt(fixtureSnapshot({states: CLIMATE_FIXTURES.find(f => f.id === 'house_running').states, now: CLIMATE_NOW,
    route: {page: 'climate', detail: 'house'}, draft: {awayUntil: '2030-01-01T10:00'}}));
  assert.ok(late.control.away.warning);
  assert.match(draw(late), new RegExp(`<p class="m-date-field__hint"[^>]*>${late.control.away.hint}</p></div><p class="m-climate-sheet__warning">.*?<span class="m-climate-sheet__warning-text">${late.control.away.warning}</span></p><div class="m-climate-sheet__actions">`));
});

test('a running override adds Cancel in gray, the heating-off and clock warnings are needs-you lines, and the write’s feedback follows', () => {
  const running = bodyOf('house_override', 'house'), html = draw(running);
  assert.match(html, /m-button--filled[\s\S]*m-button--gray m-button--regular m-button--wide[^>]*><span class="m-button__label">Cancel override<\/span>/);
  const off = bodyOf('house_off', 'house'), offHtml = draw(off);
  assert.ok(off.control.offWarning);
  assert.match(offHtml, new RegExp(`<p class="m-climate-sheet__warning"><span class="m-glyph m-climate-sheet__warning-glyph" aria-hidden="true">.*?</span><span class="m-climate-sheet__warning-text">${off.control.offWarning}</span></p>`));
  assert.ok(offHtml.indexOf(off.control.offWarning) < offHtml.indexOf(off.control.start.label), 'read before Hold');
  // The thermostat's clock more than ten minutes out.
  const states = structuredClone(CLIMATE_FIXTURES.find(f => f.id === 'house_running').states), key = CLIMATE_CONTRACT.houseHeating;
  states[key].attributes.clock_offset_s = 3600;
  const clock = bodyAt(fixtureSnapshot({states, now: CLIMATE_NOW, route: {page: 'climate', detail: 'house'}}));
  assert.ok(clock.control.clockWarning);
  assert.match(draw(clock), new RegExp(`<span class="m-climate-sheet__warning-text">${clock.control.clockWarning}</span>`));
  // A write in flight: Hold pending, its feedback under the buttons.
  const busy = bodyOf('house_running', 'house', THERMOSTAT), busyHtml = draw(busy);
  assert.ok(busy.control.feedback);
  assert.match(busyHtml, new RegExp(`</div><p class="m-feedback">${busy.control.feedback}</p></section>`));
  assert.equal(count(draw(bodyOf('house_running', 'house')), /class="m-feedback"/g), 0, 'no feedback, no line');
  // Orange is the glyph's alone.
  assert.match(climateDrawerStyles, /\.m-climate-sheet__warning-glyph\{[^}]*color:var\(--m-orange-text\)/);
  assert.match(climateDrawerStyles, /\.m-climate-sheet__warning\{[^}]*color:var\(--m-label-2\)/);
  assert.equal(count(climateDrawerStyles, /orange/g), 1);
});

test('while the heating is off, Hold is tinted and the sheet has no filled button: an override can’t warm the house', () => {
  const off = bodyOf('house_off', 'house'), html = draw(off);
  assert.ok(off.control.offWarning);
  assert.equal(count(html, /m-button--filled/g), 0);
  assert.match(html, new RegExp(`<div class="m-card m-climate-sheet__card"><p class="m-climate-sheet__warning">.*?${off.control.offWarning}</span></p><div class="m-climate-sheet__actions"><button class="m-button m-button--tinted m-button--regular m-button--wide[^>]*><span class="m-button__label">${off.control.start.label}</span>`), 'the warning and its Hold on one card');
  for (const fixture of CLIMATE_FIXTURES) {
    const body = bodyOf(fixture.id, 'house'), filled = count(draw(body), /m-button--filled/g);
    assert.equal(filled, body.control.kind === 'override' && !body.control.offWarning ? 1 : 0, fixture.id);
  }
});

test('a section’s buttons fill a bottom sheet and keep their own width in a form sheet', () => {
  for (const [fixture, id] of [['house_override', 'house'], ['house_away', 'house'], ['zone_override', 'attic'], ['house_running', 'house']]) {
    const body = bodyOf(fixture, id), actions = placement => [...draw(body, placement).matchAll(/<div class="m-climate-sheet__actions">(.*?)<\/div>/g)].flatMap(m => buttons(m[1]));
    assert.ok(actions('bottom').length > 0, `${fixture} ${id}`);
    assert.ok(actions('bottom').every(tag => tag.includes('m-button--regular m-button--wide')), `${fixture} ${id}: wide in a bottom sheet`);
    assert.ok(actions('center').every(tag => tag.includes('m-button--regular') && !tag.includes('m-button--wide')), `${fixture} ${id}: their own width in a form sheet`);
  }
  assert.match(climateDrawerStyles, /\.m-climate-sheet__actions\{display:flex;flex-wrap:wrap;/);
  assert.match(climateDrawerStyles, /\.m-climate-sheet__actions>\.m-button\{max-width:100%\}/);
});

test('a stepper’s group is named by its row, unless its value already has that name', () => {
  const attic = draw(bodyOf('house_running', 'attic'));
  // Comfort and setback: the output says 'Comfort', so the group is left unnamed.
  assert.match(attic, /<span class="m-row__title">Comfort<\/span>[\s\S]*?<div class="m-stepper" data-rac="" role="group">[\s\S]*?<output class="m-stepper__value m-num" aria-label="Comfort">/);
  assert.match(attic, /<span class="m-row__title">Setback<\/span>[\s\S]*?<div class="m-stepper" data-rac="" role="group">[\s\S]*?<output class="m-stepper__value m-num" aria-label="Setback">/);
  // The target and the house temperature keep a name of their own.
  const target = bodyOf('house_running', 'attic').control.title, fixed = bodyOf('house_running', 'noah').control.title;
  assert.match(attic, new RegExp(`<div class="m-stepper" aria-label="${target}"[^>]*role="group">[\\s\\S]*?aria-label="Attic target"`));
  assert.match(draw(bodyOf('house_running', 'noah')), new RegExp(`<div class="m-stepper" aria-label="${fixed}"`));
  assert.match(draw(bodyOf('house_running', 'house')), /<div class="m-stepper" aria-label="Temperature"/);
});

test('the sections whose controls come and go carry the key a lost focus returns to, and their headings take the ring only by keyboard', () => {
  const keys = html => [...html.matchAll(/data-focus-section="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(keys(draw(bodyOf('house_override', 'house'))), ['control']);
  assert.deepEqual(keys(draw(bodyOf('house_away', 'house'))), ['control']);
  assert.deepEqual(keys(draw(bodyAt(climateSheetSnapshot('sheet-attic')))), ['warm', 'target', 'schedule', 'airco']);
  assert.deepEqual(keys(draw(bodyOf('house_override', 'towel-rails'))), ['rails']);
  assert.doesNotMatch(draw(bodyOf('house_override', 'house')), /<h3[^>]*tabindex/, 'no heading is focusable until focus is handed to it');
  assert.match(climateDrawerStyles, /\.m-climate-sheet__heading:focus\{outline:none\}\n\.m-climate-sheet__heading:focus-visible\{outline:2px solid var\(--m-focus-ring\);outline-offset:2px\}/);
});

test('the House sheet while Away, unknown and not set up: its one section, then Why; no override, no Away disclosure, nothing filled', () => {
  const away = bodyOf('house_away', 'house'), awayHtml = draw(away);
  assert.equal(away.control.kind, 'away');
  assert.match(awayHtml, new RegExp(`<h3 class="m-climate-sheet__heading">${away.control.title}</h3><div class="m-card m-climate-sheet__card"><p class="m-climate-sheet__text">${away.control.text}</p></div><div class="m-climate-sheet__actions"><button class="m-button m-button--gray m-button--regular m-button--wide`));
  assert.match(awayHtml, /<span class="m-button__label">Cancel Away<\/span>/);
  const unknown = bodyOf('house_unknown', 'house'), unknownHtml = draw(unknown);
  assert.equal(unknown.control.kind, 'unknown');
  assert.match(unknownHtml, new RegExp(`</section><section class="m-climate-sheet__section" data-focus-section="control"><div class="m-card m-climate-sheet__card"><p class="m-climate-sheet__text">${unknown.control.text}</p></div></section>`));
  const missing = bodyOf('contract_missing', 'house'), missingHtml = draw(missing);
  assert.equal(missing.control.kind, 'missing');
  assert.match(missingHtml, new RegExp(`<div class="m-row m-row--bare"><span class="m-row__copy"><span class="m-row__title">${missing.control.step.title}</span><span class="m-row__detail"[^>]*>${missing.control.step.detail}</span></span></div>`));
  for (const [html, fixture] of [[awayHtml, 'house_away'], [unknownHtml, 'house_unknown'], [missingHtml, 'contract_missing']]) {
    assert.doesNotMatch(html, /m-stepper|m-segmented|m-date-field|m-button--filled/, fixture);
    assert.deepEqual([...html.matchAll(/<span class="m-disclosure__title">([^<]*)<\/span>/g)].map(m => m[1]), ['Why'], fixture);
  }
});

test('Why and the week: the why lines on a card behind the disclosure, the days on a card with their note, or the week’s sentence', () => {
  const body = bodyOf('house_running', 'house'), html = draw(body);
  const why = html.match(/<span class="m-disclosure__title">Why<\/span>[\s\S]*?<div class="m-card m-climate-sheet__card">(.*?)<\/div>/)[1];
  assert.deepEqual([...why.matchAll(/<p class="m-climate-sheet__text">([^<]*)<\/p>/g)].map(m => unescape(m[1])), body.why);
  assert.equal(count(html, /<div class="m-day" role="listitem"/g), 7);
  assert.match(html, /<div class="m-card m-climate-sheet__card"><div class="m-climate-sheet__days" role="list"><div class="m-day" role="listitem"/, 'VoiceOver steps day by day');
  assert.equal(count(html, /aria-current="date"/g), 1, 'today marked');
  assert.match(html, new RegExp(`<p class="m-climate-sheet__footer">${body.week.note}</p>`));
  const unread = bodyOf('house_unknown', 'house');
  assert.equal(unread.week.days, null);
  assert.match(draw(unread), new RegExp(`<h3 class="m-climate-sheet__heading">${unread.week.title}</h3><div class="m-card m-climate-sheet__card"><p class="m-climate-sheet__text">${unread.week.text}</p>`));
});

test('the radiators are read-only rows, each probe a neutral figure over its caption, headed unless there is one; the rails sheet has none', () => {
  for (const [fixture, id] of [['house_running', 'house'], ['house_running', 'attic'], ['sensors_unavailable', 'noah'], ['house_running', 'bedroom-suite']]) {
    const body = bodyOf(fixture, id), html = draw(body), {heading, rows, note} = body.radiators;
    const list = html.slice(html.lastIndexOf('<section class="m-climate-sheet__section">'));
    assert.ok(list.startsWith(heading ? `<section class="m-climate-sheet__section"><h3 class="m-climate-sheet__heading">${heading}</h3><div class="m-list` : '<section class="m-climate-sheet__section"><div class="m-list'), `${fixture} ${id}`);
    assert.equal(heading === null, rows.length === 1, `${fixture} ${id}: a single row names itself`);
    for (const row of rows) assert.match(list, new RegExp(`<span class="m-row__title">${row.name}</span><span class="m-row__detail"[^>]*>${row.line}</span></span><span class="m-row__trailing"><span class="m-climate-sheet__probe"><span class="m-climate-sheet__probe-value m-num">${row.probe}</span><span class="m-climate-sheet__probe-caption">${row.probeCaption}</span></span></span></div>`), `${fixture} ${id}`);
    assert.doesNotMatch(list, /<button|style=/, `${fixture} ${id}: nothing to press, nothing tinted`);
    assert.match(list, new RegExp(`<p class="m-climate-sheet__footer">${note}</p></section></div>$`));
  }
  for (const fixture of CLIMATE_FIXTURES) assert.doesNotMatch(draw(bodyOf(fixture.id, 'towel-rails')), /m-climate-sheet__probe/, `${fixture.id}: no Radiators on the rails sheet`);
});

test('a zone sheet has no disclosure, keeps "Raise comfort" in reach, and names every focusable control once', () => {
  for (const fixture of CLIMATE_FIXTURES) for (const id of ZONE_IDS) {
    const html = draw(bodyOf(fixture.id, id)), where = `${fixture.id} ${id}`;
    assert.doesNotMatch(html, /m-disclosure|hidden=""/, where);
    const names = focusables(html);
    assert.equal(new Set(names).size, names.length, `${where}: ${names.join(' | ')}`);
    assert.ok(!names.includes('<button>') && !names.includes('<input>'), `${where}: each has a name`);
  }
  const attic = draw(bodyOf('house_running', 'attic'));
  assert.ok(focusables(attic).includes('Raise comfort'));
  assert.match(attic, /<div class="m-row m-row--bare"><span class="m-row__copy"><span class="m-row__title">Comfort<\/span>[\s\S]*?aria-label="Raise comfort"/);
  // The Attic sheet the touch spec opens: every control, one name each.
  assert.deepEqual(focusables(draw(bodyAt(climateSheetSnapshot('sheet-attic')))), ['Warm the house until 18:00 too', 'Override Attic cooler', 'Override Attic warmer',
    'Cancel override', 'Lower comfort', 'Raise comfort', 'Lower setback', 'Raise setback', 'Open the schedule in Home Assistant',
    'Let the Airco heat when cheaper', 'Airco cooling', 'Airco controls', 'Full history: temperature and target', 'Full history: humidity']);
});

test('a zone sheet: Radiator heat’s warning and offer on one card, the Target row, today in a list without a second "Today", and the Airco’s switches', () => {
  const attic = bodyAt(climateSheetSnapshot('sheet-attic')), html = draw(attic);
  assert.equal(attic.titles.warm, 'Radiator heat');
  assert.match(html, new RegExp(`<h3 class="m-climate-sheet__heading">${attic.titles.warm}</h3><div class="m-card m-climate-sheet__card"><p class="m-climate-sheet__warning">.*?<span class="m-climate-sheet__warning-text">${attic.warm.text}</span></p><div class="m-climate-sheet__actions"><button class="m-button m-button--tinted m-button--regular m-button--wide[^>]*><span class="m-glyph"[^>]*>.*?</span><span class="m-button__label">${attic.warm.warm.label}</span></button></div></div><p class="m-climate-sheet__footer">${attic.warm.note}</p>`), 'the offer on its card, then its note');
  // The Target row: the control's own title and line, the Step's stepper.
  assert.match(html, new RegExp(`<h3 class="m-climate-sheet__heading">${attic.titles.target}</h3><div class="m-list m-list--inset" role="list"><div class="m-list__item" role="listitem"><div class="m-row m-row--bare"><span class="m-row__copy"><span class="m-row__title">${attic.control.title}</span><span class="m-row__detail"[^>]*>${attic.control.line}</span>`));
  const idle = bodyOf('house_running', 'attic');
  assert.match(draw(idle), new RegExp(`<span class="m-row__title">${idle.control.title}</span><span class="m-row__detail"[^>]*>${idle.control.line}</span>`));
  assert.notEqual(idle.control.title, idle.control.step.title, 'no override running: the control’s own words, not the Step’s');
  assert.match(html, /m-button--gray m-button--regular m-button--wide[^>]*><span class="m-button__label">Cancel override<\/span>/);
  // Today: the bar in a list of one, no second "Today", the caption under it, the note as the footer.
  assert.equal(attic.schedule.title, attic.schedule.today.today);
  assert.match(html, new RegExp(`<div class="m-row m-row--bare m-climate-sheet__stacked"><div class="m-climate-sheet__days" role="list"><div class="m-day" role="listitem"><span class="m-day__name">${attic.schedule.today.name}</span><span class="m-day__plan">.*?</div></div><span class="m-row__detail">${attic.schedule.caption}</span></div>`));
  assert.equal(count(html, /m-day__today/g), 0);
  assert.equal(count(textOf(html), /Today/g), 1);
  assert.match(html, new RegExp(`</div><p class="m-climate-sheet__footer">${attic.schedule.note}</p>`));
  for (const helper of [attic.schedule.comfort, attic.schedule.setback]) {
    assert.equal(helper.line, null);
    assert.match(html, new RegExp(`<span class="m-row__copy"><span class="m-row__title">${helper.step.title}</span></span><span class="m-row__accessory">`), `${helper.step.title}: no detail, the note says it`);
  }
  assert.equal(count(textOf(html), new RegExp(attic.schedule.caption, 'g')), 1, 'the caption is the schedule’s one sentence');
  const quiet = bodyOf('house_running', 'attic');
  assert.equal(quiet.schedule.caption, null);
  assert.match(draw(quiet), /<div class="m-row m-row--bare m-climate-sheet__stacked"><div class="m-climate-sheet__days" role="list"><div class="m-day"[^>]*>.*?<\/div><\/div><\/div>/, 'the bar alone without a caption');
  assert.match(html, /<button class="m-button m-button--plain m-button--regular m-focusable m-climate-sheet__link"[^>]*><span class="m-glyph"[^>]*>.*?<\/span><span class="m-button__label">Open the schedule in Home Assistant<\/span>/);
  // The source line, strong first, then a switch per row over its line.
  assert.match(html, /<span class="m-row__title"><strong class="m-climate-sheet__strong">Radiators<\/strong> · Airco off<\/span>/);
  for (const s of [attic.airco.heating, attic.airco.cooling]) assert.match(html, new RegExp(`<span class="m-row__title">${s.title}</span><span class="m-row__detail"[^>]*>${s.line}</span></span><span class="m-row__accessory"><label[^>]*class="m-switch m-focusable"[^>]*><span[^>]*><input aria-label="${s.control.ariaLabel}"`));
  // Unavailable: its word before an unavailable switch, no line that reads as off.
  const gone = bodyOf('sensors_unavailable', 'attic'), goneHtml = draw(gone);
  assert.equal(gone.airco.heating.note, 'Unavailable');
  assert.equal(gone.airco.heating.line, null);
  assert.match(goneHtml, new RegExp(`<span class="m-row__title">${gone.airco.heating.title}</span></span><span class="m-row__value m-num"[^>]*>Unavailable</span><span class="m-row__accessory"><span class="m-switch m-switch--unavailable" aria-hidden="true">`));
  // A zone the house heating isn't warming, with nothing to offer: the warning alone on the card.
  const warned = CLIMATE_FIXTURES.flatMap(f => ZONE_IDS.map(id => bodyOf(f.id, id))).find(b => b.warning);
  assert.ok(warned, 'Away leaves a zone warned');
  assert.match(draw(warned), new RegExp(`<h3 class="m-climate-sheet__heading">${warned.titles.warm}</h3><div class="m-card m-climate-sheet__card"><p class="m-climate-sheet__warning">.*?${warned.warning}</span></p></div></section>`));
  // A fixed zone has no schedule, no Airco and no Radiator heat while the house heats.
  assert.doesNotMatch(draw(bodyOf('house_running', 'noah')), /m-climate-sheet__warning|m-switch|m-day"|m-climate-sheet__link/);
});

test('the rails sheet: the rows as on the page with their action, Dry towels tinted and Stop gray, the caption as the footer', () => {
  const body = bodyOf('house_override', 'towel-rails'), html = draw(body);
  const rows = html.match(/^<div class="m-climate-sheet m-climate-sheet--rails"><section class="m-climate-sheet__section" data-focus-section="rails">(<div class="m-list m-list--inset".*?)<p class="m-climate-sheet__footer">([^<]*)<\/p><\/section>/);
  assert.ok(rows, 'the rows lead, under no heading');
  assert.equal(unescape(rows[2]), body.caption);
  for (const row of body.rows) {
    assert.match(rows[1], new RegExp(`<span class="m-row__tile m-tone-gray"[^>]*><span class="m-glyph"[^>]*>.*?</span></span><span class="m-row__copy"><span class="m-row__title">${row.name}</span><span class="m-row__detail"[^>]*>${row.line}</span>`));
    assert.match(rows[1], new RegExp(`m-button--${row.action.label === 'Stop' ? 'gray' : 'tinted'} [^>]*aria-label="${row.action.ariaLabel}"`));
  }
  assert.deepEqual(body.rows.map(row => row.action?.label ?? null), ['Stop', 'Dry towels']);
  // Away: no Dry towels to press, the line says why.
  const away = bodyOf('house_away', 'towel-rails');
  assert.deepEqual(away.rows.map(row => row.action), [null, null]);
  assert.doesNotMatch(draw(away).match(/data-focus-section="rails">(.*?)<\/section>/)[1], /<button/);
});

// An unavailable Airco switch draws no input: its word says why (switch.jsx).
const unavailable = body => [body.airco?.heating, body.airco?.cooling].filter(s => s?.note === 'Unavailable').map(s => s.control);
test('every press a sheet’s value carries is drawn, once per place, and nothing else presses', () => {
  for (const fixture of CLIMATE_FIXTURES) for (const id of IDS) {
    const body = bodyOf(fixture.id, id), html = draw(body), where = `${fixture.id} ${id}`;
    // A rail's control with no action (Away, unavailable) isn't drawn: its line says why.
    const idle = body.kind === 'rails' ? body.rows.filter(row => !row.action).map(row => row.control) : [];
    const gone = [...unavailable(body), ...idle], values = presses(body).filter(press => !gone.includes(press));
    for (const press of values) {
      if (press.intent.command === 'away-until') { assert.match(html, /type="datetime-local"/, where); continue; }
      const name = press.ariaLabel ?? press.label;
      assert.ok(name, `${where}: ${JSON.stringify(press.intent)} has a name`);
      assert.ok(html.includes(`aria-label="${name}"`) || html.includes(`<span class="m-button__label">${name}</span>`) || html.includes(`<span class="m-segmented__label">${name}</span>`),
        `${where}: ${name}`);
    }
    // Each press is a button or an input, and none is drawn that the value doesn't carry.
    const drawn = count(html, /<button\b/g) + count(html, /<input\b/g) - count(html, /m-disclosure__trigger/g);
    assert.equal(drawn, values.length, `${where}: ${drawn} presses drawn`);
  }
});

test('the gallery’s sheets are the dashboard’s: each CLIMATE_SHEETS window draws its drawer through DRAWERS', () => {
  for (const {id, detail} of CLIMATE_SHEETS) {
    const body = bodyAt(climateSheetSnapshot(id));
    assert.match(draw(body), new RegExp(`^<div class="m-climate-sheet m-climate-sheet--${detail === 'house' ? 'house' : detail === 'towel-rails' ? 'rails' : 'zone'}">`), id);
  }
});

test('the sheet styles: grouped sections 24px apart, stacked rows in the list’s own padding, and nothing that widens a phone', () => {
  assert.match(climateDrawerStyles, /\.m-climate-sheet\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:var\(--m-space-6\);min-width:0\}/);
  assert.match(climateDrawerStyles, /\.m-row\.m-climate-sheet__stacked\{flex-direction:column;align-items:stretch;/);
  for (const cls of ['section', 'summary', 'card', 'panel']) assert.match(climateDrawerStyles, new RegExp(`\\.m-climate-sheet__${cls}\\{[^}]*grid-template-columns:minmax\\(0,1fr\\)`), cls);
  assert.doesNotMatch(climateDrawerStyles, /animation|transition|transform/, 'nothing moves');
  // A 327px sheet: the ends reach into the row's inset, and a stepper wraps under a title that won't fit beside it.
  assert.match(climateDrawerStyles, /\.m-segmented\.m-climate-sheet__ends\{margin-inline:calc\(-1 \* var\(--m-space-2\)\)\}/);
  const stepped = '.m-climate-sheet .m-row:has(>.m-row__accessory>.m-stepper)';
  for (const rule of [`${stepped}{flex-wrap:wrap;`, `${stepped}>.m-row__copy{min-width:min-content}`,
    `${stepped} :is(.m-row__title,.m-row__detail){overflow-wrap:break-word}`, `${stepped}>.m-row__accessory{margin-inline-start:auto}`]) assert.ok(climateDrawerStyles.includes(rule), rule);
});
