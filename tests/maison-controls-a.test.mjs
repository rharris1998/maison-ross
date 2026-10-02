// Maison's Switch and SegmentedControl (#29): what they draw from the
// values the pages and sheets hand them, and what their adapters read from
// those values.
//
// Drawing: Node has no JSX, so esbuild bundles the controls with
// react-dom/server into a temporary module (as maison-controls-b does),
// and each test reads the markup a real value renders to: the roles, the
// accessible names, checked and disabled, and the unavailable switch drawn
// apart with no input.
//
// Reading: pinned across every fixture, online and offline. The switch is a
// toggle Control named by its ariaLabel, whose `note` alone tells an
// unavailable device (drawn apart) from one that is off or offline: the
// Car's Automatic charging and the Attic's Airco. The segmented control is
// the House sheet's override ends: exactly one selected (its thumb), and
// every one disabled offline (a disabled group).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';

const UI = fileURLToPath(new URL('../frontend/maison/src/ui/', import.meta.url));
const ENTRY = `export {Switch, UnavailableSwitch, IntentSwitch} from './switch.jsx';
export {SegmentedControl} from './segmented.jsx';
export {CommandContext} from '../contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The controls, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-controls-a-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: UI, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'controls.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'controls.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, UnavailableSwitch, IntentSwitch, SegmentedControl} = ui;

// Markup for an element, with a command that does nothing.
const draw = element => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, element));
const count = (html, pattern) => (html.match(pattern) || []).length;
// The one input a switch draws, as its attributes.
const input = html => html.match(/<input[^>]*>/g) ?? [];

const ONLINE = [true, false];
const climate = (fixture, online, detail = 'attic') => screen(fixtureSnapshot({states: fixture.states, online, route: {page: 'climate', detail}}));
const car = (fixture, online) => screen(fixtureSnapshot({states: fixture.states, online, now: CAR_NOW, carLast: fixture.last ?? null, route: {page: 'car', detail: null, dialog: null}}));

// Every switch value a page draws, as [where, control, note].
const switches = () => [
  ...CAR_FIXTURES.flatMap(f => ONLINE.map(online => {
    const s = car(f, online).page.automatic;
    return [`car ${f.id}${online ? '' : ' offline'}`, s.switch, s.note, online];
  })),
  ...CLIMATE_FIXTURES.flatMap(f => ONLINE.flatMap(online => {
    const airco = climate(f, online).drawer.body.airco;
    return [airco.heating, airco.cooling].filter(s => s.kind === 'switch')
      .map(s => [`${f.id} ${s.title}${online ? '' : ' offline'}`, s.control, s.note, online]);
  })),
];

test('a switch value is a toggle named by its ariaLabel, and its note alone says unavailable', () => {
  const all = switches();
  assert.ok(all.some(([, , note]) => note === 'Unavailable'), 'a fixture draws an unavailable switch');
  assert.ok(all.some(([, control]) => control.selected) && all.some(([, control, note]) => !control.selected && !note), 'and switches on and off');
  for (const [where, control, note, online] of all) {
    assert.equal(control.intent.command, 'toggle', where);
    assert.equal(typeof control.ariaLabel, 'string', where);
    assert.ok(control.ariaLabel.length > 0, where);
    assert.equal(typeof control.selected, 'boolean', where);
    assert.ok([null, '', 'Unavailable', 'Offline'].includes(note), `${where}: ${note}`);
    // Drawn apart, never as a switch someone could press: off and disabled.
    if (note === 'Unavailable') assert.deepEqual([control.selected, control.enabled], [false, false], where);
    // Offline keeps the last state, disabled.
    if (!online) assert.equal(control.enabled, false, where);
    if (!online && note !== 'Unavailable') assert.equal(note, 'Offline', where);
  }
});

test('the house override’s ends: named by endsLabel, exactly one selected, all disabled offline', () => {
  let drawn = 0;
  for (const fixture of CLIMATE_FIXTURES) for (const online of ONLINE) {
    const c = climate(fixture, online, 'house').drawer.body.control, where = `${fixture.id}${online ? '' : ' offline'}`;
    if (c.kind !== 'override') continue;
    drawn++;
    assert.equal(c.endsLabel, 'Override ends', where);
    assert.ok(c.ends.length >= 2, where);
    assert.equal(c.ends.filter(end => end.selected).length, 1, where);
    assert.ok(c.ends.every(end => end.intent.command === 'house-end'), where);
    if (!online) assert.ok(c.ends.every(end => !end.enabled), where);
  }
  assert.ok(drawn >= 8, 'online and offline fixtures draw the ends');
});

// ---- Drawing ----------------------------------------------------------------

const carValue = (id, online = true) => car(CAR_FIXTURES.find(f => f.id === id), online).page.automatic;
const aircoValue = (id, online = true) => climate(CLIMATE_FIXTURES.find(f => f.id === id), online).drawer.body.airco;

test('IntentSwitch draws a named role=switch, checked from selected and disabled from enabled', () => {
  const on = carValue('solar'), off = carValue('automatic_off'), offline = carValue('solar', false);
  const drawn = value => draw(h(IntentSwitch, {control: value.switch, note: value.note}));
  const [onInput] = input(drawn(on));
  assert.equal(input(drawn(on)).length, 1);
  assert.match(onInput, /role="switch"/);
  assert.match(onInput, /type="checkbox"/);
  assert.match(onInput, /aria-label="Automatic charging"/);
  assert.match(onInput, /checked=""/);
  assert.doesNotMatch(onInput, /disabled=""/);
  assert.match(drawn(on), /^<label[^>]* class="m-switch m-focusable"[^>]*data-selected="true"/);
  assert.match(drawn(on), /<span class="m-switch__track"><span class="m-switch__thumb"><\/span><\/span><\/label>$/);
  const [offInput] = input(drawn(off));
  assert.doesNotMatch(offInput, /checked=""/, 'off is not checked');
  assert.doesNotMatch(offInput, /disabled=""/);
  // Offline keeps its last state, disabled: a switch still, not unavailable.
  const [offlineInput] = input(drawn(offline));
  assert.equal(offline.note, 'Offline');
  assert.match(offlineInput, /checked=""/);
  assert.match(offlineInput, /disabled=""/);
  assert.doesNotMatch(drawn(offline), /m-switch--unavailable/);
  // The Airco's switches are named by their titles.
  const airco = aircoValue('airco_heating');
  for (const s of [airco.heating, airco.cooling]) assert.match(draw(h(IntentSwitch, {control: s.control, note: s.note})), new RegExp(`aria-label="${s.title}"`));
});

test('UnavailableSwitch is hidden from assistive technology and has no input', () => {
  const html = draw(h(UnavailableSwitch));
  assert.equal(html, '<span class="m-switch m-switch--unavailable" aria-hidden="true"><span class="m-switch__track"><span class="m-switch__thumb"></span></span></span>');
  assert.equal(input(html).length, 0);
  assert.doesNotMatch(html, /role=/);
});

test('a value whose note is Unavailable draws the unavailable switch, and `unavailable` overrides the note', () => {
  const gone = aircoValue('sensors_unavailable').heating;
  assert.equal(gone.note, 'Unavailable');
  const html = draw(h(IntentSwitch, {control: gone.control, note: gone.note}));
  assert.match(html, /^<span class="m-switch m-switch--unavailable" aria-hidden="true">/);
  assert.equal(input(html).length, 0);
  assert.equal(input(draw(h(IntentSwitch, {control: gone.control, note: gone.note, unavailable: false}))).length, 1);
  assert.match(draw(h(IntentSwitch, {control: carValue('solar').switch, unavailable: true})), /m-switch--unavailable/);
});

test('the house override’s ends draw a radiogroup named by endsLabel, one radio per end, the selected one checked', () => {
  const ends = online => climate(CLIMATE_FIXTURES.find(f => f.id === 'house_running'), online, 'house').drawer.body.control;
  const c = ends(true), html = draw(h(SegmentedControl, {ariaLabel: c.endsLabel, items: c.ends}));
  assert.match(html, /^<div class="m-segmented"[^>]*aria-label="Override ends"[^>]*role="radiogroup"/);
  assert.match(html, /^<div[^>]*aria-disabled="false"/);
  const radios = html.match(/<button[^>]*>.*?<\/button>/g);
  assert.equal(radios.length, 3);
  assert.equal(count(html, /role="radio"/g), 3);
  assert.deepEqual(radios.map(radio => radio.match(/aria-checked="(true|false)"/)[1]), ['false', 'false', 'true']);
  assert.match(radios[2], /class="m-segmented__item m-focusable"/);
  assert.match(radios[2], /<div class="m-segmented__thumb"[^>]*><\/div><span class="m-segmented__label">Until 22:00<\/span>/);
  assert.equal(count(html, /m-segmented__thumb/g), 1, 'one thumb, on the selected end');
  assert.equal(count(html, / disabled=""/g), 0);
  // Offline every end is disabled, and so is the group.
  const off = ends(false), offHtml = draw(h(SegmentedControl, {ariaLabel: off.endsLabel, items: off.ends}));
  assert.equal(count(offHtml, / disabled=""/g), 3);
  assert.match(offHtml, /^<div[^>]*aria-disabled="true"/);
  assert.match(offHtml, /^<div[^>]*data-disabled="true"/);
});

test('a disabled item is a disabled radio; the others stay pressable', () => {
  const items = ['Day', 'Week', 'Month'].map((label, index) => ({intent: {index}, label, selected: index === 0, enabled: index !== 2}));
  const html = draw(h(SegmentedControl, {ariaLabel: 'Period', items}));
  const radios = html.match(/<button[^>]*>/g);
  assert.deepEqual(radios.map(radio => / disabled=""/.test(radio)), [false, false, true]);
  assert.match(html, /^<div[^>]*aria-disabled="false"/, 'one disabled item leaves the group enabled');
  assert.match(html, /aria-label="Period"/);
});
