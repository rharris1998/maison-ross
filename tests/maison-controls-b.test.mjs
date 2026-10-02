// Maison's Stepper, IntentButton, List, ListRow and Card (#29): what they
// draw from the values the pages and sheets hand them. Node has no JSX, so
// esbuild bundles the controls with react-dom/server into a temporary
// module, and each test reads the markup a real value renders to: the roles,
// the accessible names and descriptions, the disabled buttons and the
// pending ones (a write in flight), the tone and weight classes, the
// unavailable row and which end a row draws. The tiles' glyph contrast is
// worked out from tokens.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {CAR_FIXTURES} from '../frontend/maison/fixtures/car-fixtures.js';
import {HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {HOME, THERMOSTAT, carSheetSnapshot, carSnapshot, climateSnapshot, pageSnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {buttonStyles} from '../frontend/maison/src/ui/button.css.js';
import {listStyles} from '../frontend/maison/src/ui/list.css.js';
import {DARK, LIGHT} from '../frontend/maison/src/ui/tokens.js';

const UI = fileURLToPath(new URL('../frontend/maison/src/ui/', import.meta.url));
const ENTRY = `export {Stepper} from './stepper.jsx';
export {IntentButton} from './button.jsx';
export {List, ListRow, TONES, TONE_ALIASES, toneOf} from './list.jsx';
export {Card, SectionTitle} from './card.jsx';
export {CommandContext} from '../contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The controls, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-controls-b-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: UI, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'controls.mjs'), bundle.outputFiles[0].text);
const ui = await import(pathToFileURL(join(folder, 'controls.mjs')));
rmSync(folder, {recursive: true, force: true});
const {h, renderToStaticMarkup, CommandContext, Stepper, IntentButton, List, ListRow, Card, SectionTitle, TONES, TONE_ALIASES, toneOf} = ui;

// Markup for an element, with a command that records what it is sent.
const draw = (element, sent = []) => renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)}, element));
const count = (html, pattern) => (html.match(pattern) || []).length;
const car = id => CAR_FIXTURES.find(fixture => fixture.id === id);
// A Climate sheet's body for a fixture, `detail` open, with the snapshot's
// other options (a write in flight).
const sheet = (fixture, detail, options = {}) => screen(climateSnapshot(fixture, {...options, detail})).drawer.body;
// A Control as screen.js's control() marks it while its key is in flight.
const inFlight = action => ({...action, enabled: false, busy: true, busyLabel: 'In progress'});
// Each <button …> opening tag in the markup.
const buttons = html => html.match(/<button[^>]*>/g) ?? [];

test('every legacy tone lands on one of six, blue is none of them, and anything else is gray', () => {
  assert.deepEqual(TONES, ['yellow', 'indigo', 'pink', 'green', 'orange', 'gray']);
  assert.deepEqual(Object.fromEntries(Object.keys(TONE_ALIASES).map(name => [name, toneOf(name)])), {amber: 'orange'});
  for (const tone of TONES) assert.equal(toneOf(tone), tone);
  for (const other of [undefined, 'blue', 'purple']) assert.equal(toneOf(other), 'gray', String(other));
  assert.match(listStyles, /\.m-row__tile\{[^}]*background:color-mix\(in srgb,var\(--m-tone\) 20%,transparent\)/, 'the tone at 20% behind the glyph');
  assert.doesNotMatch(listStyles, /m-tone-blue/);
});

// A colour from tokens.js as [r, g, b, a], a CSS colour expression from the
// list's tile rules resolved against a scheme, and WCAG contrast.
const channels = value => value.startsWith('#') ? [...[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)), 1]
  : value === 'transparent' ? [0, 0, 0, 0] : value.match(/[\d.]+/g).map(Number);
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
function colour(expression, tokens) {
  const mix = expression.match(/^color-mix\(in srgb,(.+) (\d+)%,(.+)\)$/);
  if (mix) {
    const [a, b, p] = [colour(mix[1], tokens), colour(mix[3], tokens), Number(mix[2]) / 100];
    const alpha = a[3] * p + b[3] * (1 - p);
    return [...[0, 1, 2].map(i => (a[i] * a[3] * p + b[i] * b[3] * (1 - p)) / alpha), alpha];
  }
  const name = expression.match(/^var\(--([\w-]+)\)$/)?.[1];
  return channels(name ? tokens[name] : expression);
}
const luminance = rgb => {
  const [r, g, b] = rgb.slice(0, 3).map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('each tile’s glyph stands at least 3:1 on its tint, in both schemes, on a card and in a sheet', () => {
  const tile = listStyles.match(/\.m-row__tile\{[^}]*background:([^;}]+)/)[1];
  for (const [scheme, tokens] of [['light', LIGHT], ['dark', DARK]]) {
    const page = channels(tokens['m-bg']), sheet = channels(tokens['m-sheet-fill']);
    for (const tone of TONES) {
      const rule = Object.fromEntries(listStyles.match(new RegExp(`\\.m-row__tile\\.m-tone-${tone}\\{([^}]*)\\}`))[1].split(';').map(part => [part.slice(0, part.indexOf(':')), part.slice(part.indexOf(':') + 1)]));
      assert.equal(rule['--m-tone'], `var(--m-${tone})`, tone);
      const scope = {...tokens, 'm-tone': tokens[`m-${tone}`]};
      for (const [where, ground] of [['card', page], ['sheet', sheet]]) {
        const card = over(channels(tokens['m-card-fill']), ground), behind = over(colour(tile, scope), card), glyph = over(colour(rule.color, scope), behind);
        assert.ok(contrast(glyph, behind) >= 3, `${scheme} ${tone} on a ${where}: ${contrast(glyph, behind).toFixed(2)}:1`);
      }
    }
  }
});

test('the house override stepper is a group named by its row’s title, its buttons by their Controls and its value by outputLabel', () => {
  const {control: {step}, titles} = sheet('house_running', 'house');
  const html = draw(h(Stepper, {...step.stepper, label: titles.temperature}));
  assert.match(html, /^<div class="m-stepper" aria-label="Temperature"[^>]* role="group">/);
  assert.match(html, /<button class="m-button m-button--gray m-button--regular m-button--icon-only m-focusable m-stepper__step"[^>]* aria-label="Cooler"/);
  assert.match(html, /<button class="[^"]* m-stepper__step"[^>]* aria-label="Warmer"/);
  assert.match(html, /<output class="m-stepper__value m-num" aria-label="House heating override">20°<\/output>/);
  assert.equal(count(html, /<button/g), 2);
  assert.equal(count(html, / disabled=""/g), 0);
  assert.ok(html.indexOf('Cooler') < html.indexOf('<output') && html.indexOf('<output') < html.indexOf('Warmer'), 'minus, value, plus');
});

test('the Car’s charge limit takes the same adapter: its title names the group', () => {
  const limit = screen(carSnapshot(car('solar'), 'car')).page.charge.limit;
  const html = draw(h(Stepper, {...limit.stepper, label: limit.title}));
  assert.match(html, /role="group"/);
  assert.match(html, /aria-label="Charge limit"/);
  assert.match(html, /aria-label="Lower the charge limit by 5%"/);
  assert.match(html, /aria-label="Raise the charge limit by 5%"/);
  assert.match(html, /<output[^>]*aria-label="Charge limit">80%<\/output>/);
  const offline = screen({...carSnapshot(car('solar'), 'car'), online: false}).page.charge.limit;
  assert.equal(count(draw(h(Stepper, {...offline.stepper, label: offline.title})), / disabled=""/g), 2, 'offline disables both');
});

// A pending button: aria-disabled and data-pending, never disabled, so it
// stays in the Tab order and keeps focus.
function assertPending(button, where) {
  assert.match(button, / aria-disabled="true"/, where);
  assert.match(button, / data-pending="true"/, where);
  assert.match(button, / tabindex="0"/, where);
  assert.doesNotMatch(button, / disabled=""| data-disabled=/, where);
}
// A drawn button's whole markup, from its opening tag to its </button>, by
// its index.
const buttonMarkup = (html, index = 0) => html.match(/<button[^>]*>[^]*?<\/button>/g)[index];
// The words a button's aria-labelledby reads, in order: each id's aria-label,
// or its text.
function labelledBy(markup) {
  const ids = markup.match(/^<button[^>]* aria-labelledby="([^"]+)"/)?.[1].split(' ') ?? [];
  return ids.map(id => {
    const element = markup.match(new RegExp(`<(\\w+)(?=[^>]* id="${id}")([^>]*)>([^<]*)`));
    return element && (element[2].match(/ aria-label="([^"]*)"/)?.[1] ?? element[3]);
  });
}
// The hidden, indeterminate ProgressBar a pending button reads its busyLabel
// from.
const PROGRESS = /<div id="[^"]+" class="m-button__progress" data-rac="" aria-label="In progress" aria-valuemin="0" aria-valuemax="100" role="progressbar"><\/div><\/button>$/;

test('a busy write leaves neither step pressable: in flight they stay focusable, pending; a null side draws the spacer', () => {
  const {control: {step: busy}, titles: {temperature}} = sheet('house_running', 'house', THERMOSTAT), {minus, plus} = busy.stepper;
  // As the value marks them: pending while their own key is in flight, else disabled.
  const drawn = buttons(draw(h(Stepper, {...busy.stepper, label: temperature})));
  assert.equal(drawn.length, 2);
  for (const [button, action] of [[drawn[0], minus], [drawn[1], plus]]) {
    assert.equal(action.enabled, false, action.ariaLabel);
    if (action.busy) assertPending(button, action.ariaLabel);
    else assert.match(button, / disabled=""/, action.ariaLabel);
  }
  const pending = draw(h(Stepper, {...busy.stepper, minus: inFlight(minus), plus: inFlight(plus), label: temperature}));
  assert.match(pending, /^<div class="m-stepper" aria-label="Temperature"[^>]* role="group">/);
  assert.equal(buttons(pending).length, 2);
  buttons(pending).forEach((button, i) => {
    const name = ['Cooler', 'Warmer'][i];
    assertPending(button, name);
    assert.match(button, new RegExp(` aria-label="${name}"`), name);
    assert.match(buttonMarkup(pending, i), PROGRESS, name);
    assert.deepEqual(labelledBy(buttonMarkup(pending, i)), [name, 'In progress'], `${name}, In progress`);
  });
  assert.match(pending, /<output class="m-stepper__value m-num" aria-label="House heating override">20°<\/output>/);
  const zone = sheet('house_running', 'attic').control;
  const oneSide = draw(h(Stepper, {...zone.step.stepper, plus: null, label: zone.title}));
  assert.equal(count(oneSide, /<button/g), 1);
  assert.match(oneSide, /<output[^>]*>21°<\/output><span class="m-stepper__spacer" aria-hidden="true"><\/span><\/div>$/);
  const notSetUp = sheet('contract_missing', 'sam').schedule.comfort.step;
  assert.deepEqual([notSetUp.stepper.minus, notSetUp.stepper.plus], [null, null]);
  const none = draw(h(Stepper, {...notSetUp.stepper, label: notSetUp.title}));
  assert.equal(count(none, /<button/g), 0);
  assert.equal(count(none, /m-stepper__spacer/g), 2);
});

// IntentButton's element for an action, drawn inside a render so its hook runs.
function intentElement(action) {
  let element;
  draw(h(() => { element = IntentButton({action}); return null; }));
  return element;
}

test('an IntentButton in flight is pending, not disabled: it keeps its focus and its name; any other disabled action is disabled', () => {
  const house = sheet('house_running', 'house', THERMOSTAT).control, idle = sheet('house_running', 'house').control;
  // Pending: aria-disabled and data-pending, in the Tab order, named by its
  // label then its busyLabel, which a hidden, indeterminate ProgressBar holds.
  const start = draw(h(IntentButton, {action: inFlight(house.start), variant: 'filled'}));
  assert.match(start, /^<button class="m-button m-button--filled m-button--regular m-focusable"/);
  assertPending(start, 'start');
  assert.match(start, /<span class="m-button__label" id="[^"]+">Hold 20° until 22:00<\/span><div /);
  assert.match(start, PROGRESS);
  assert.deepEqual(labelledBy(start), ['Hold 20° until 22:00', 'In progress']);
  // Named by aria-label: React Aria labels it by itself, then the bar.
  const warmer = draw(h(IntentButton, {action: inFlight(house.step.stepper.plus), variant: 'gray'})), id = warmer.match(/ id="([^"]+)"/)[1];
  assert.match(warmer, / aria-label="Warmer"/);
  assert.ok(warmer.includes(` aria-labelledby="${id} `), 'labelled by itself first');
  assert.deepEqual(labelledBy(warmer), ['Warmer', 'In progress']);
  // Busy without a busyLabel: pending, with no bar and its name as it is.
  const quiet = draw(h(IntentButton, {action: {...inFlight(house.start), busyLabel: undefined}}));
  assertPending(quiet, 'no busyLabel');
  assert.doesNotMatch(quiet, /progressbar|aria-labelledby|<span class="m-button__label" id=/);
  // Not in flight: exactly as before.
  const disabled = buttons(draw(h(IntentButton, {action: {...idle.start, enabled: false}})))[0];
  assert.match(disabled, / disabled=""/);
  assert.match(disabled, / data-disabled="true"/);
  assert.doesNotMatch(disabled, /aria-disabled|data-pending|aria-labelledby/);
  const ready = buttons(draw(h(IntentButton, {action: idle.start})))[0];
  assert.match(ready, / tabindex="0"/);
  assert.doesNotMatch(ready, /disabled|data-pending|aria-labelledby/);
  // The wiring, case by case: busy wins over enabled, and only `busy: true` is pending.
  const props = action => { const {isDisabled, isPending} = intentElement(action).props; return [isDisabled, isPending]; };
  assert.deepEqual(props(idle.start), [false, false]);
  assert.deepEqual(props({...idle.start, enabled: false}), [true, false]);
  assert.deepEqual(props(inFlight(idle.start)), [false, true]);
  assert.deepEqual(props({...idle.start, busy: true}), [false, true]);
  assert.equal(intentElement(inFlight(idle.start)).props.pendingLabel, 'In progress');
  // A press on an idle one still sends its intent.
  const sent = [];
  let element;
  draw(h(() => { element = IntentButton({action: idle.start}); return null; }), sent);
  element.props.onPress();
  assert.deepEqual(sent, [idle.start.intent]);
});

test('a pending button dims without moving, and never fades whole where color-mix() works, so its focus ring stays; its bar is only read', () => {
  const pending = buttonStyles.split('\n').filter(line => line.includes('data-pending'));
  assert.deepEqual(pending, [
    '.m-button[data-pending]{cursor:default}',
    '.m-button[data-pending]:not(.m-button--filled)>*{opacity:.7}',
    '.m-button--filled[data-pending]{background:color-mix(in srgb,var(--m-blue) 85%,transparent)}',
    '@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-button--filled[data-pending]{opacity:.85}}',
  ]);
  assert.doesNotMatch(pending.join('\n'), /animation|transform|translate|scale|progress|wait/);
  assert.match(buttonStyles, /^\.m-button>\*\{transition:opacity var\(--m-dur-press\) var\(--m-ease\)\}$/m);
  assert.match(buttonStyles, /^\.m-button__progress\{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset\(50%\);white-space:nowrap\}$/m);
  // The white label on a light card's filled blue at 85%: 3:1 at least.
  const blue = channels(LIGHT['m-blue']), card = channels(LIGHT['m-card-fill']), faded = over([...blue.slice(0, 3), 0.85], card);
  assert.ok(contrast(channels(LIGHT['m-on-color']), faded) >= 3, contrast(channels(LIGHT['m-on-color']), faded).toFixed(2));
});

test('an alert row is a button named by its text, tinted orange, with a chevron, and a press sends its intent', () => {
  const [row] = screen(pageSnapshot(HOME, 'system', HOME_NOW, undefined, {kind: 'alerts'})).dialog.rows;
  assert.equal(row.tone, 'amber');
  assert.equal(row.link.ariaLabel, undefined);
  const html = draw(h(ListRow, row));
  assert.match(html, /^<button[^>]*class="m-row m-row--pressable m-focusable"/);
  assert.doesNotMatch(html, /^<button[^>]*aria-(?:label|describedby)/, 'no aria-label: the visible title and detail name it');
  assert.match(html, /<span class="m-row__tile m-tone-orange"><span class="m-glyph" aria-hidden="true">/);
  assert.match(html, /<span class="m-row__title">Vacuum filter needs cleaning<\/span><span class="m-row__detail" id="[^"]+">Maintenance interval reached<\/span>/);
  assert.match(html, /<span class="m-glyph m-row__chevron" aria-hidden="true">/);
  // ListRow's element, drawn inside a render so its hook runs: pressing it sends the link's intent.
  const sent = [];
  let element;
  draw(h(() => { element = ListRow(row); return null; }), sent);
  element.props.onPress();
  assert.deepEqual(sent, [row.link.intent]);
});

// The ids an element's aria-describedby names, and the text of each.
const described = html => html.match(/^<button[^>]* aria-describedby="([^"]+)"/)?.[1].split(' ')
  .map(id => html.match(new RegExp(`<span class="[^"]*" id="${id}">([^<]*)</span>`))?.[1]);

test('a link’s ariaLabel names the row and its detail and value describe it, unless the label says them; a disabled link disables it', () => {
  const [filter] = screen(pageSnapshot(HOME, 'system', HOME_NOW)).page.vacuum.rows;
  const html = draw(h(ListRow, filter));
  assert.match(html, /^<button[^>]*aria-label="Vacuum filter details"/);
  assert.deepEqual(described(html), ['Due'], 'the label would hide the value');
  assert.match(html, /<span class="m-row__value m-num" id="[^"]+">Due<\/span><span class="m-glyph m-row__chevron"/);
  assert.match(draw(h(ListRow, {...filter, link: {...filter.link, enabled: false}})), /^<button[^>]* disabled=""/);
  // A zone as the Climate page lists it: its link's ariaLabel already says
  // the reading and the line, so they don't describe it again.
  const {link, opener, reading} = screen(climateSnapshot()).page.zones[0];
  const row = {link, icon: opener.icon, title: opener.name, detail: reading.line, value: reading.reading, strong: true, figure: true};
  const zone = draw(h(ListRow, {...row, describe: false}));
  assert.match(zone, /^<button[^>]*aria-label="Attic: 19\.8°, warming/);
  assert.equal(described(zone), undefined);
  assert.deepEqual(described(draw(h(ListRow, row))), ['Warming · 21° until 18:00, then 16°', '19.8°']);
});

test('strong sets a primary row’s title in headline, and figure its value as a reading', () => {
  const {opener, reading} = screen(climateSnapshot()).page.zones[0];
  const html = draw(h(ListRow, {icon: opener.icon, title: opener.name, value: reading.reading, strong: true, figure: true}));
  assert.match(html, /<span class="m-row__tile m-tone-gray">/, 'gray without a tone');
  assert.match(html, /<span class="m-row__title m-row__title--strong">Attic<\/span>/);
  assert.match(html, /<span class="m-row__value m-row__value--figure m-num" id="[^"]+">19\.8°<\/span>/);
  assert.match(draw(h(ListRow, {title: 'Attic', value: '19.8°'})), /<span class="m-row__title">Attic<\/span><\/span><span class="m-row__value m-num"/, 'plain by default');
  assert.match(listStyles, /\.m-row__title\.m-row__title--strong\{font:var\(--m-type-headline\)\}/);
  assert.match(listStyles, /\.m-row__value\.m-row__value--figure\{font:var\(--m-type-figure\);font-variant-numeric:tabular-nums;color:var\(--m-label\)\}/);
});

test('trailing null drops the chevron, a static row has none, and an accessory keeps the row a div', () => {
  const sensors = screen(pageSnapshot(HOME, 'system', HOME_NOW, {query: '', category: 'all', limit: 200})).page.sensors.rows;
  const reading = sensors.find(row => row.title === 'Dishwasher plug power');
  const noChevron = draw(h(ListRow, {...reading, trailing: null}));
  assert.match(noChevron, /^<button/);
  assert.match(noChevron, /<span class="m-row__value m-num" id="[^"]+">1,450\u00a0W<\/span><\/button>$/);
  // The Battery sheet's Ready reserve, a reading with no link.
  const reserve = screen(carSheetSnapshot('car-battery')).drawer.body.readings.rows.find(row => !row.link);
  const still = draw(h(ListRow, {link: reserve.link, icon: reserve.icon, tone: reserve.tone, title: reserve.title, value: reserve.value}));
  assert.match(still, /^<div class="m-row"><span class="m-row__tile m-tone-gray">/);
  assert.doesNotMatch(still, /chevron|<button/);
  const accessory = draw(h(ListRow, {link: reading.link, title: 'Automatic charging', accessory: h('i', {className: 'probe'})}));
  assert.match(accessory, /^<div class="m-row m-row--bare"><span class="m-row__copy">/);
  assert.match(accessory, /<span class="m-row__accessory"><i class="probe"><\/i><\/span><\/div>$/);
  assert.match(draw(h(ListRow, {title: 'Anything', trailing: 'Wed'})), /<span class="m-row__trailing">Wed<\/span>/);
});

test('an unavailable row, pressable or static, draws its tile apart with no tone, its value secondary, and keeps its title, name and press', () => {
  const sensors = screen(pageSnapshot(HOME, 'system', HOME_NOW, {query: '', category: 'all', limit: 200})).page.sensors.rows;
  const cellar = sensors.find(row => row.title === 'Cellar temperature');
  assert.deepEqual([cellar.unavailable, cellar.value], [true, 'Unavailable'], 'Home status marks it itself');
  const pressable = draw(h(ListRow, cellar));
  assert.match(pressable, /^<button class="m-row m-row--pressable m-row--unavailable m-focusable"/);
  assert.doesNotMatch(buttons(pressable)[0], /disabled|aria-label=/, 'still pressable, named by its text');
  assert.match(pressable, /<span class="m-row__tile"><span class="m-glyph" aria-hidden="true">/);
  assert.doesNotMatch(pressable, /m-tone-/);
  assert.match(pressable, /<span class="m-row__title">Cellar temperature<\/span>/);
  assert.match(pressable, /<span class="m-row__value m-num" id="[^"]+">Unavailable<\/span><span class="m-glyph m-row__chevron"/);
  const sent = [];
  let element;
  draw(h(() => { element = ListRow(cellar); return null; }), sent);
  element.props.onPress();
  assert.deepEqual(sent, [cellar.link.intent]);
  // A charging energy meter with no reading, as its sheet lists it: its
  // tone gives way to the dashed tile.
  const meter = screen(carSheetSnapshot('car-charging-energy-missing')).drawer.body.rows.find(row => row.unavailable);
  assert.deepEqual([meter.tone, meter.value], ['pink', '—']);
  assert.match(draw(h(ListRow, {...meter, unavailable: false})), /<span class="m-row__tile m-tone-pink">/);
  assert.match(draw(h(ListRow, meter)), /^<button class="m-row m-row--pressable m-row--unavailable m-focusable"[^>]*><span class="m-row__tile"><span class="m-glyph"/);
  // A zone with no reading, static: no tone, a dashed tile, its figure '—'.
  const {opener, reading} = screen(climateSnapshot('sensors_unavailable')).page.zones[0];
  const zone = {icon: opener.icon, strong: true, title: opener.name, value: reading.reading, figure: true};
  const still = draw(h(ListRow, {...zone, unavailable: true}));
  assert.match(still, /^<div class="m-row m-row--unavailable"><span class="m-row__tile"><span class="m-glyph"/);
  assert.match(still, /<span class="m-row__title m-row__title--strong">Attic<\/span>/);
  assert.match(still, /<span class="m-row__value m-row__value--figure m-num" id="[^"]+">—<\/span><\/div>$/);
  assert.match(draw(h(ListRow, {title: 'Cellar', value: '—', unavailable: true})), /^<div class="m-row m-row--bare m-row--unavailable"><span class="m-row__copy">/);
  assert.match(draw(h(ListRow, {...cellar, unavailable: false})), /^<button class="m-row m-row--pressable m-focusable"[^]*<span class="m-row__tile m-tone-gray">/);
  // The look: a dashed tertiary outline and glyph with no fill, a secondary value, the title untouched;
  // each rule outranks the tone, figure and fallback rules by specificity.
  const rule = selector => listStyles.split('\n').find(line => line.startsWith(`${selector}{`))?.slice(selector.length + 1, -1);
  assert.equal(rule('.m-row.m-row--unavailable .m-row__tile'), 'box-sizing:border-box;background:transparent;border:1.5px dashed var(--m-label-3);color:var(--m-label-3)');
  assert.equal(rule('.m-row.m-row--unavailable .m-row__value'), 'color:var(--m-label-2)', 'secondary, a figure too: tertiary is under 3:1');
  for (const [scheme, tokens] of [['light', LIGHT], ['dark', DARK]]) for (const ground of ['m-bg', 'm-sheet-fill']) {
    const card = over(channels(tokens['m-card-fill']), channels(tokens[ground])), value = over(channels(tokens['m-label-2']), card);
    assert.ok(contrast(value, card) >= 4.5, `${scheme} on ${ground}: ${contrast(value, card).toFixed(2)}:1`);
  }
  assert.doesNotMatch(listStyles, /m-row--unavailable[^{]*\.m-row__(?:title|detail)/);
});

test('a list is always a list of items, named when it has an ariaLabel; a card draws its title, a section its header', () => {
  const {rows} = screen(pageSnapshot(HOME, 'system', HOME_NOW)).page.vacuum;
  const named = draw(h(List, {variant: 'plain', ariaLabel: 'Filters & brushes'}, rows.map(row => h(ListRow, {key: row.title, ...row}))));
  assert.match(named, /^<div class="m-list m-list--plain" role="list" aria-label="Filters &amp; brushes">/);
  assert.equal(count(named, /<div class="m-list__item" role="listitem">/g), rows.length);
  const bare = draw(h(List, null, rows.map(row => h(ListRow, {key: row.title, ...row}))));
  assert.match(bare, /^<div class="m-list m-list--inset" role="list"><div class="m-list__item" role="listitem"><button/);
  assert.equal(count(bare, /role="listitem"/g), rows.length);
  assert.equal(draw(h(Card, {title: 'Appliances'}, h('p', null, 'x'))), '<section class="m-card"><h3 class="m-card__title">Appliances</h3><p>x</p></section>');
  assert.equal(draw(h(Card, {title: 'Appliances', level: 2, as: 'div'}, 'x')), '<div class="m-card"><h2 class="m-card__title">Appliances</h2>x</div>');
  assert.equal(draw(h(Card, {as: 'div', className: 'extra'}, 'y')), '<div class="m-card extra">y</div>');
  assert.equal(draw(h(SectionTitle, null, 'Housekeeping')), '<h2 class="m-section-title">Housekeeping</h2>');
  assert.equal(draw(h(SectionTitle, {level: 3}, 'Zones')), '<h3 class="m-section-title">Zones</h3>');
});

test('the separator’s insets rank by specificity, so source order can’t move them', () => {
  const lefts = [...listStyles.matchAll(/^([^{\n]*::after)\{[^}]*?left:([^;}]+)/gm)].map(([, selector, left]) => [selector, left]);
  const weight = selector => (selector.match(/\.[\w-]+|:(?!:)[\w-]+|\[[^\]]+\]/g) || []).length;
  assert.deepEqual(lefts.map(([, left]) => left), ['calc(var(--m-space-4) + var(--m-tile) + var(--m-space-3))', 'var(--m-space-4)', 'calc(var(--m-tile) + var(--m-space-3))', '0']);
  const weights = lefts.map(([selector]) => weight(selector));
  assert.deepEqual(weights, [...weights].sort((a, b) => a - b));
  assert.equal(new Set(weights).size, weights.length, `each case outranks the one before: ${weights}`);
});
