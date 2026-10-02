// Maison's sheet parts (#29 step 4, v32): the target bar, the disclosure,
// the date and time field, the feedback line and the day bar, the Widget's
// title action and the ListRow's room tint and flag, as the markup they
// draw from climate.js's shapes, and the numbers their sheets promise: the
// 44px targets, what reduced motion stops, and the contrast of the target
// bar, a tinted glyph and a flag on every surface they sit on, worked out
// from tokens.js. Node has no JSX, so esbuild bundles the parts and the
// gallery's specimens with react-dom/server into a temporary module (and
// the Widget once more as development builds it, for its console error),
// and each test reads what a value renders to.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {DARK, LIGHT, SHARED, tokenStyles} from '../frontend/maison/src/ui/tokens.js';
import {tempColour} from '../frontend/maison/src/ui/temp-scale.js';
import {targetBarStyles} from '../frontend/maison/src/ui/target-bar.css.js';
import {disclosureStyles} from '../frontend/maison/src/ui/disclosure.css.js';
import {dateFieldStyles} from '../frontend/maison/src/ui/date-field.css.js';
import {feedbackStyles} from '../frontend/maison/src/ui/feedback.css.js';
import {dayBarStyles} from '../frontend/maison/src/ui/day-bar.css.js';
import {widgetStyles} from '../frontend/maison/src/ui/widget.css.js';
import {listStyles} from '../frontend/maison/src/ui/list.css.js';

const UI = fileURLToPath(new URL('../frontend/maison/src/ui/', import.meta.url));
const ENTRY = `export {TargetBar} from './target-bar.jsx';
export {Disclosure} from './disclosure.jsx';
export {DateTimeField} from './date-field.jsx';
export {Feedback} from './feedback.jsx';
export {DayBar} from './day-bar.jsx';
export {Widget} from './widget.jsx';
export {List, ListRow} from './list.jsx';
export {LayoutContext} from './layout.js';
export {DetailSpecimens} from '../gallery/detail-specimens.jsx';
export {CommandContext} from '../contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The parts, bundled for Node: once as the dashboard ships them, and the
// Widget once more as development builds it.
async function bundle(entry, name, define) {
  const folder = mkdtempSync(join(tmpdir(), `maison-parts-b-${name}-`));
  const built = await build({stdin: {contents: entry, resolveDir: UI, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
    jsx: 'automatic', loader: {'.js': 'jsx'}, define, logLevel: 'silent',
    // react-dom/server requires Node's own modules.
    banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
  writeFileSync(join(folder, `${name}.mjs`), built.outputFiles[0].text);
  try { return await import(pathToFileURL(join(folder, `${name}.mjs`))); } finally { rmSync(folder, {recursive: true, force: true}); }
}
const ui = await bundle(ENTRY, 'parts', {'process.env.NODE_ENV': '"production"'});
const dev = await bundle(`export {Widget} from './widget.jsx';
export {LayoutContext} from './layout.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`, 'dev', {'process.env.NODE_ENV': '"development"'});
const {h, renderToStaticMarkup, CommandContext, LayoutContext, TargetBar, Disclosure, DateTimeField, Feedback, DayBar, Widget, List, ListRow, DetailSpecimens} = ui;

// Markup for an element in a layout, with a command that records what it is sent.
const draw = (element, sent = [], layout = 'phone') =>
  renderToStaticMarkup(h(CommandContext.Provider, {value: intent => sent.push(intent)}, h(LayoutContext.Provider, {value: layout}, element)));
const count = (html, pattern) => (html.match(pattern) || []).length;
// An element's attributes by name, from its opening tag; every opening tag of a class.
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
const tags = (html, cls) => [...html.matchAll(new RegExp(`<\\w+\\b[^>]*class="${cls}"[^>]*>`, 'g'))].map(([tag]) => attributes(tag));
// Glyphs drawn as their name only, so markup reads short.
const bare = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '');
// A rule's declarations, from a stylesheet written one rule per line.
function rule(css, selector) {
  const line = css.split('\n').find(text => text.startsWith(`${selector}{`));
  assert.ok(line, `${selector} is a rule`);
  return Object.fromEntries(line.slice(selector.length + 1, -1).split(/;(?![^(]*\))/).map(part => [part.slice(0, part.indexOf(':')), part.slice(part.indexOf(':') + 1)]));
}
// An element returned by a component, drawn inside a render so its hooks run.
function rendered(component, props, sent = [], layout = 'phone') {
  let element;
  draw(h(() => { element = component(props); return null; }), sent, layout);
  return element;
}

// ---- Contrast, from tokens.js --------------------------------------------

const channels = value => value.startsWith('#') ? [...[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)), 1]
  : value === 'transparent' ? [0, 0, 0, 0] : [...value.match(/[\d.]+/g).map(Number), 1].slice(0, 4);
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
const alpha = ([r, g, b], a) => [r, g, b, a];
const luminance = rgb => {
  const [r, g, b] = rgb.slice(0, 3).map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Every surface a part sits on, per scheme: a card, an inset list or a
// widget on the page, the sheet's bare fill, and a card inside the sheet.
const SCHEMES = [['light', LIGHT], ['dark', DARK]];
const surfaces = tokens => {
  const [page, sheet, card] = ['m-bg', 'm-sheet-fill', 'm-card-fill'].map(name => channels(tokens[name]));
  return {'a card on the page': over(card, page), 'the bare sheet': sheet, 'a card in the sheet': over(card, sheet)};
};
// The room scale, every tenth of a degree from below its coldest stop to past its hottest.
const ROOMS = Array.from({length: 141}, (_, i) => Math.round((13 + i / 10) * 10) / 10);

// ---- The target bar ------------------------------------------------------

const bar = (reading, target, ariaLabel = 'A bar') => ({plot: {reading, target, min: 14, max: 26}, ariaLabel});
// The bar's parts in order, each with its inline style.
const parts = html => [...html.matchAll(/<span class="m-target-bar__(\w+)"(?: style="([^"]*)")?><\/span>/g)].map(([, part, style]) => [part, style ?? '']);

test('a target bar draws its track, the trail between reading and target, the tick, then the dot, each placed in % on the 14–26° scale', () => {
  const html = draw(h(TargetBar, {bar: bar(19.2, 21, '19.2°, target 21°')}));
  assert.match(html, /^<span class="m-target-bar m-target-bar--row" role="img" aria-label="19\.2°, target 21°">/);
  const colour = tempColour(19.2);
  assert.deepEqual(parts(html), [
    ['track', ''],
    ['span', `left:43.333%;width:15%;background:${colour}`],
    ['tick', 'left:58.333%'],
    ['dot', `left:43.333%;background:${colour}`],
  ]);
  // Above its target the trail runs back from the reading down to the target.
  assert.deepEqual(parts(draw(h(TargetBar, {bar: bar(24.2, 16)}))).map(([part, style]) => [part, style.split(';background')[0]]),
    [['track', ''], ['span', 'left:16.667%;width:68.333%'], ['tick', 'left:16.667%'], ['dot', 'left:85%']]);
  // At its target the trail is a sliver under the dot, and the tick is still drawn.
  assert.deepEqual(parts(draw(h(TargetBar, {bar: bar(20.1, 20)}))).map(([part]) => part), ['track', 'span', 'tick', 'dot']);
  assert.match(draw(h(TargetBar, {bar: bar(22, 22)})), /m-target-bar__span" style="left:66\.667%;width:0%;/);
});

test('with no target the dot stands alone; with no reading the track is dashed and the tick stays; with neither, the track alone', () => {
  const untargeted = draw(h(TargetBar, {bar: bar(23.4, null)}));
  assert.match(untargeted, /^<span class="m-target-bar m-target-bar--row m-target-bar--untargeted" role="img"/);
  assert.deepEqual(parts(untargeted).map(([part]) => part), ['track', 'dot']);
  const empty = draw(h(TargetBar, {bar: bar(null, 17), size: 'wide'}));
  assert.match(empty, /^<span class="m-target-bar m-target-bar--wide m-target-bar--empty" role="img"/);
  assert.deepEqual(parts(empty), [['track', ''], ['tick', 'left:25%']]);
  const blank = draw(h(TargetBar, {bar: bar(null, null, 'No reading')}));
  assert.match(blank, /^<span class="m-target-bar m-target-bar--row m-target-bar--empty m-target-bar--untargeted" role="img" aria-label="No reading">/);
  assert.deepEqual(parts(blank), [['track', '']]);
  // Anything that isn't a finite number is missing, never a place on the scale.
  for (const missing of [undefined, NaN, Infinity, '21']) {
    assert.deepEqual(parts(draw(h(TargetBar, {bar: bar(missing, missing)}))), [['track', '']], String(missing));
  }
  assert.doesNotMatch(draw(h(TargetBar, {bar: bar(0, null)})), /--empty/, 'a real 0° is a reading');
});

test('readings and targets past the scale are held at its ends', () => {
  assert.deepEqual(parts(draw(h(TargetBar, {bar: bar(27.6, 21)}))).map(([part, style]) => [part, style.split(';background')[0]]),
    [['track', ''], ['span', 'left:58.333%;width:41.667%'], ['tick', 'left:58.333%'], ['dot', 'left:100%']]);
  assert.deepEqual(parts(draw(h(TargetBar, {bar: bar(11, 30)}))).map(([part, style]) => [part, style.split(';background')[0]]),
    [['track', ''], ['span', 'left:0%;width:100%'], ['tick', 'left:100%'], ['dot', 'left:0%']]);
  assert.match(draw(h(TargetBar, {bar: bar(27.6, 21)})), new RegExp(`background:${tempColour(27.6).replace(/[()]/g, '\\$&')}`), 'the colour is the reading’s, clamped by the scale');
});

test('a bar inside a row that names it is hidden, with no role, so no unnamed image is left', () => {
  const html = draw(h(TargetBar, {bar: bar(24.2, 16, '24.2°, target 16°'), hidden: true}));
  assert.match(html, /^<span class="m-target-bar m-target-bar--row" aria-hidden="true">/);
  assert.doesNotMatch(html, /role=|aria-label=/);
  assert.equal(parts(html).length, 4, 'drawn in full all the same');
});

test('the bar is 78 × 12 in a row and the width of its box when wide, a 4px track, a 10px dot, a tick the box’s height, and it never widens its box', () => {
  assert.deepEqual([rule(targetBarStyles, '.m-target-bar--row').width, rule(targetBarStyles, '.m-target-bar--wide').width], ['78px', '100%']);
  const box = rule(targetBarStyles, '.m-target-bar');
  assert.deepEqual([box.height, box['min-width'], box['max-width'], box.isolation, box['pointer-events']], ['12px', '0', '100%', 'isolate', 'none']);
  const [track, dot, tick] = ['.m-target-bar__track', '.m-target-bar__dot', '.m-target-bar__tick'].map(s => rule(targetBarStyles, s));
  assert.deepEqual([track.top, track.height], ['4px', '4px'], 'the track sits in the middle of the box');
  assert.deepEqual([dot.width, dot.height, dot.top, dot['margin-left']], ['10px', '10px', '1px', '-5px'], 'the dot is centred on its place');
  assert.deepEqual([tick.width, tick.height, tick.top, tick['margin-left'], tick['z-index'], tick.background], ['2px', '12px', '0', '-1px', '1', 'var(--m-label)'], 'the tick over the dot');
  assert.equal(rule(targetBarStyles, '.m-target-bar.m-target-bar--empty .m-target-bar__track')['border-top'], '2px dashed var(--m-label-3)');
  assert.equal(rule(targetBarStyles, '.m-target-bar__span').opacity, '.45', 'the concept’s trail');
  assert.doesNotMatch(targetBarStyles, /transition|animation/, 'nothing moves, so reduced motion has nothing to stop');
});

test('the dot’s ring and the tick’s notch are the surface’s colour: the card’s fill over the page, the sheet’s fill, or both', () => {
  const surfaced = rule(targetBarStyles, '.m-card,.m-list--inset,.m-widget__body--card,.m-widget:not(.m-widget--phone)');
  assert.deepEqual(surfaced, {'--m-target-ring': 'var(--m-card-fill)'});
  assert.deepEqual(rule(targetBarStyles, '.m-sheet'), {'--m-target-ground': 'var(--m-sheet-fill)'});
  const ring = '0 0 0 2px var(--m-target-ring,transparent),0 0 0 2px var(--m-target-ground,var(--m-bg))';
  assert.ok(rule(targetBarStyles, '.m-target-bar__dot')['box-shadow'].endsWith(`,${ring}`), 'the fill over its ground, 2px');
  assert.equal(rule(targetBarStyles, '.m-target-bar__tick')['box-shadow'], ring.replaceAll('2px', '1px'));
  // The two layers make the surface in every scheme and place: the card
  // (translucent in dark) laid over the page or the sheet, or the bare sheet.
  for (const [scheme, tokens] of SCHEMES) {
    const [page, sheet, card] = ['m-bg', 'm-sheet-fill', 'm-card-fill'].map(name => channels(tokens[name]));
    const drawn = (top, ground) => over(top, ground).map(Math.round);
    assert.deepEqual(drawn(card, page), over(card, page).map(Math.round), `${scheme}: a card on the page`);
    assert.deepEqual(drawn([0, 0, 0, 0], sheet), sheet, `${scheme}: the bare sheet`);
  }
  // Without light-dark() or color-mix() the dot keeps its ring.
  assert.match(targetBarStyles, new RegExp(`@supports not \\(\\(color:light-dark\\(transparent,transparent\\)\\) and \\(color:color-mix\\(in srgb,currentColor \\d+%,transparent\\)\\)\\)\\{\\.m-target-bar__dot\\.m-target-bar__dot\\{box-shadow:${ring.replace(/[().,-]/g, '\\$&')}\\}\\}`));
});

test('the target bar reads on a card, in a widget and in a sheet: the tick and the dot at 3:1 or more, light and dark, at every room temperature', () => {
  const rim = rule(targetBarStyles, '.m-target-bar__dot')['box-shadow'].match(/^inset 0 0 0 1px light-dark\(color-mix\(in srgb,var\(--m-label\) (\d+)%,transparent\),transparent\),/);
  assert.ok(rim, 'light takes a rim of the label inside the dot’s edge; dark takes none');
  const share = Number(rim[1]) / 100, figures = [];
  for (const [scheme, tokens] of SCHEMES) {
    const label = channels(tokens['m-label']);
    for (const [where, surface] of Object.entries(surfaces(tokens))) {
      const tick = contrast(over(label, surface), surface);
      assert.ok(tick >= 3, `${scheme}, ${where}: the tick at ${tick.toFixed(2)}:1`);
      // The dot's edge against the ring round it, which is the surface.
      const dots = ROOMS.map(t => { const fill = channels(tempColour(t)), edge = scheme === 'light' ? over(alpha(label, share), fill) : fill; return [t, contrast(edge, surface)]; });
      const [coldest, worst] = dots.reduce((a, b) => b[1] < a[1] ? b : a);
      assert.ok(worst >= 3, `${scheme}, ${where}: the dot at ${worst.toFixed(2)}:1 at ${coldest}°`);
      figures.push(`${scheme}, ${where}: tick ${tick.toFixed(1)}:1, dot ${worst.toFixed(1)}:1 at worst`);
    }
  }
  assert.equal(figures.length, 6);
  // Plain, the room colours are no graphic on white: why light has the rim.
  assert.ok(contrast(channels(tempColour(21)), [255, 255, 255, 1]) < 1.5);
});

// ---- The disclosure ------------------------------------------------------

test('a disclosure is a heading whose button opens its panel: closed, the panel is hidden; open, it is a group named by the button', () => {
  const closed = bare(draw(h(Disclosure, {title: 'Why'}, h('p', null, 'The house thermostat decides.'))));
  assert.match(closed, /^<div class="m-disclosure" data-rac=""><h3 class="m-disclosure__heading"><button id="([^"]+)" class="m-disclosure__trigger m-focusable"[^>]* type="button"[^>]* aria-expanded="false" aria-controls="([^"]+)" slot="trigger"><span class="m-disclosure__title">Why<\/span><span class="m-glyph m-disclosure__chevron" aria-hidden="true"><\/span><\/button><\/h3>/);
  const [, trigger, panel] = closed.match(/<button id="([^"]+)"[^>]* aria-controls="([^"]+)"/);
  const [drawnPanel] = tags(closed, 'm-disclosure__panel');
  assert.deepEqual([drawnPanel.id, drawnPanel.role, drawnPanel['aria-labelledby'], drawnPanel.hidden], [panel, 'group', trigger, '']);
  assert.match(closed, /<p>The house thermostat decides\.<\/p><\/div><\/div>$/, 'the panel’s content is there to be found');
  const open = bare(draw(h(Disclosure, {title: 'Away until a date', level: 2, defaultExpanded: true}, h('p', null, 'x'))));
  assert.match(open, /^<div class="m-disclosure" data-rac="" data-expanded="true"><h2 class="m-disclosure__heading"><button[^>]* aria-expanded="true"/);
  assert.equal(tags(open, 'm-disclosure__panel')[0].hidden, undefined);
  assert.equal(count(open, /<button/g), 1);
});

test('the trigger is at least 44px tall, a whole line wide, and its chevron turns a quarter over a duration reduced motion zeroes', () => {
  const trigger = rule(disclosureStyles, '.m-disclosure__trigger');
  assert.deepEqual([trigger['min-height'], trigger.width, trigger.font], ['var(--m-hit)', '100%', 'var(--m-type-headline)']);
  assert.equal(SHARED['m-hit'], '44px');
  assert.equal(rule(disclosureStyles, '.m-disclosure[data-expanded] .m-disclosure__chevron').rotate, '90deg');
  assert.equal(rule(disclosureStyles, '.m-disclosure__chevron').color, 'var(--m-blue-text)', 'blue: the heading presses');
  assert.deepEqual(rule(disclosureStyles, '.m-disclosure__panel'), {'min-width': '0'}, 'closed, the panel adds nothing under the trigger');
  assert.deepEqual(rule(disclosureStyles, '.m-disclosure[data-expanded]>.m-disclosure__panel'), {'padding-top': 'var(--m-space-1)'});
  assert.doesNotMatch(disclosureStyles, /\.m-disclosure__panel\{[^}]*display/, 'the hidden attribute keeps its word');
});

test('every transition in the sheet parts, the title action and the row runs on a duration token, so reduced motion stops it', () => {
  assert.match(tokenStyles, /@media \(prefers-reduced-motion:reduce\)\{:host\{--m-dur-press:0ms;--m-dur-control:0ms;--m-dur-sheet:0ms\}\}/);
  for (const [name, css] of Object.entries({targetBarStyles, disclosureStyles, dateFieldStyles, feedbackStyles, dayBarStyles, widgetStyles, listStyles})) {
    const timings = [...css.matchAll(/(?:transition|animation)(?:-duration)?:([^;}]+)/g)].map(match => match[1]);
    for (const timing of timings) assert.match(timing, /^(?:0ms|(?:[\w-]+ var\(--m-dur-\w+\) var\(--m-ease\),?)+)$/, `${name}: ${timing}`);
  }
});

// ---- The date and time field ---------------------------------------------

const FIELD = {label: 'Heating back on', control: {intent: {command: 'away-until', value: '2026-10-18T15:00'}, enabled: true}, min: '2026-10-14T09:35', max: '2027-01-12T09:30'};

test('a date and time field is a native input labelled by its label, starting at the draft, bounded, disabled while its control is', () => {
  const html = draw(h(DateTimeField, {field: FIELD, hint: 'Set it a few hours before you’re back.'}));
  assert.match(html, /^<div class="m-date-field"><label class="m-date-field__label" for="([^"]+)">Heating back on<\/label><input class="m-date-field__input" id="\1" type="datetime-local" min="2026-10-14T09:35" max="2027-01-12T09:30" aria-describedby="([^"]+)" value="2026-10-18T15:00"\/><p class="m-date-field__hint" id="\2">Set it a few hours before you’re back\.<\/p><\/div>$/);
  const [, input, hint] = html.match(/ id="([^"]+)"[^>]* aria-describedby="([^"]+)"/);
  assert.notEqual(input, hint, 'the hint is read with the field, by an id of its own');
  assert.doesNotMatch(html, /tabindex|disabled/, 'no wrapper takes focus, so iOS’s Done hands it back to the input');
  const disabled = draw(h(DateTimeField, {field: {...FIELD, control: {...FIELD.control, enabled: false}}}));
  assert.match(disabled, /<input class="m-date-field__input"[^>]* disabled=""/);
  assert.doesNotMatch(disabled, /m-date-field__hint|aria-describedby/, 'no hint, no line and no description');
  const ids = [draw(h('div', null, h(DateTimeField, {field: FIELD}), h(DateTimeField, {field: FIELD})))].flatMap(both => [...both.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
  assert.equal(new Set(ids).size, 2, 'each field its own id');
});

test('each change sends the draft back as the control’s intent with its value, and nothing else', () => {
  const sent = [], field = rendered(DateTimeField, {field: FIELD}, sent);
  const input = field.props.children.find(child => child?.type === 'input');
  input.props.onChange({currentTarget: {value: '2026-10-20T08:00'}});
  assert.deepEqual(sent, [{command: 'away-until', value: '2026-10-20T08:00'}]);
  assert.equal(FIELD.control.intent.value, '2026-10-18T15:00', 'the value’s intent is left as it was');
});

test('the input is 44px tall in the 17px body type, so iOS doesn’t zoom, and fills its field without widening it', () => {
  const input = rule(dateFieldStyles, '.m-date-field__input');
  assert.deepEqual([input['min-height'], input.font, input.width, input['max-width'], input['min-width'], input['box-sizing']],
    ['var(--m-hit)', 'var(--m-type-body)', '100%', '100%', '0', 'border-box']);
  assert.match(SHARED['m-type-body'], / 17px\//);
  assert.equal(rule(dateFieldStyles, '.m-date-field__input:focus-visible').outline, '2px solid var(--m-focus-ring)');
  assert.equal(rule(dateFieldStyles, '.m-date-field').display, 'grid');
});

// ---- Feedback and the day bar --------------------------------------------

test('a feedback line is drawn only while there is something to say, with no live role of its own', () => {
  assert.equal(draw(h(Feedback, {text: 'House heating 22° until 22:00 · waiting for the thermostat'})),
    '<p class="m-feedback">House heating 22° until 22:00 · waiting for the thermostat</p>');
  for (const text of ['', null, undefined]) assert.equal(draw(h(Feedback, {text})), '', String(text));
  assert.deepEqual(rule(feedbackStyles, '.m-feedback'), {margin: '0', 'min-width': '0', font: 'var(--m-type-footnote)', color: 'var(--m-label-2)', 'overflow-wrap': 'anywhere'});
  // The secondary label reads at 4.5:1 on every surface a sheet has.
  for (const [scheme, tokens] of SCHEMES) {
    for (const [where, surface] of Object.entries(surfaces(tokens))) {
      const ratio = contrast(over(channels(tokens['m-label-2']), surface), surface);
      assert.ok(ratio >= 4.5, `${scheme}, ${where}: ${ratio.toFixed(2)}:1`);
    }
  }
});

const TODAY = {name: 'Wed', today: 'Today', plan: '20° 06:30–08:30 · 20° 17:00–22:00, otherwise 18°',
  bar: [{width: 27.08, warm: false}, {width: 8.33, warm: true}, {width: 35.42, warm: false}, {width: 20.83, warm: true}, {width: 8.34, warm: false}]};

test('a day is a list item drawing its name, today’s mark, its plan and a hidden bar of its periods, the warm ones marked', () => {
  const html = draw(h(DayBar, {day: TODAY}));
  assert.equal(html, '<div class="m-day" role="listitem" aria-current="date"><span class="m-day__name">Wed</span><span class="m-day__today">Today</span>'
    + '<span class="m-day__plan">20° 06:30–08:30 · 20° 17:00–22:00, otherwise 18°</span><span class="m-day__bar" aria-hidden="true">'
    + '<i class="m-day__part" style="width:27.08%"></i><i class="m-day__part m-day__part--warm" style="width:8.33%"></i><i class="m-day__part" style="width:35.42%"></i>'
    + '<i class="m-day__part m-day__part--warm" style="width:20.83%"></i><i class="m-day__part" style="width:8.34%"></i></span></div>');
  const other = draw(h(DayBar, {day: {...TODAY, name: 'Sun', today: null, plan: '18° all day', bar: [{width: 100, warm: false}]}}));
  assert.equal(other, '<div class="m-day" role="listitem"><span class="m-day__name">Sun</span><span class="m-day__plan">18° all day</span><span class="m-day__bar" aria-hidden="true"><i class="m-day__part" style="width:100%"></i></span></div>');
  // Neutral: comfort in the secondary label, setback the fill; today on the fill.
  assert.equal(rule(dayBarStyles, '.m-day__part--warm').background, 'var(--m-label-2)');
  assert.equal(rule(dayBarStyles, '.m-day__bar').background, 'var(--m-fill-gray)');
  assert.equal(rule(dayBarStyles, '.m-day[aria-current=date]::before').background, 'var(--m-fill-gray)');
  assert.equal(rule(dayBarStyles, '.m-day')['grid-template-rows'], 'auto 18px', 'every day one rhythm, today or not');
  // Its words read at 4.5:1 on every surface a sheet has: the secondary label
  // on other days, and the label on today's fill, where the secondary one
  // falls to 4.1:1 on a dark sheet's card.
  const [plan, today, marked] = ['.m-day__plan', '.m-day__today', '.m-day[aria-current=date]>:is(.m-day__today,.m-day__plan)'].map(selector => rule(dayBarStyles, selector));
  assert.deepEqual([plan.color, today.color, marked.color], ['var(--m-label-2)', 'var(--m-label-2)', 'var(--m-label)']);
  const fill = rule(dayBarStyles, '.m-day[aria-current=date]::before').background.match(/--([\w-]+)/)[1], ink = value => value.match(/--([\w-]+)/)[1];
  for (const [scheme, tokens] of SCHEMES) {
    for (const [where, surface] of Object.entries(surfaces(tokens))) {
      const other = contrast(over(channels(tokens[ink(plan.color)]), surface), surface);
      const highlight = over(channels(tokens[fill]), surface), mine = contrast(over(channels(tokens[ink(marked.color)]), highlight), highlight);
      const before = contrast(over(channels(tokens['m-label-2']), highlight), highlight);
      assert.ok(other >= 4.5 && mine >= 4.5, `${scheme}, ${where}: a day at ${other.toFixed(2)}:1, today at ${mine.toFixed(2)}:1 (the secondary label would be ${before.toFixed(2)}:1)`);
    }
  }
  assert.doesNotMatch(dayBarStyles, /--m-(?:blue|orange|green|temp|yellow|indigo|pink)/);
});

// ---- The Widget's title action -------------------------------------------

const DETAILS = {intent: {command: 'detail', entity: 'house'}, enabled: true, label: 'Details', ariaLabel: 'House heating details'};
const house = extra => h(Widget, {id: 'house', title: 'House heating', icon: 'home', ...extra}, h('p', null, '23.4°'));

// A heading's text, as assistive technology reads it from its content.
const headingText = html => html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)[1].replace(/<[^>]+>/g, '');

test('a widget’s title action is a button beside its heading, in a head row, named by its link, on a phone and in the grid alike', () => {
  for (const [layout, size, heading] of [['phone', 'phone', 'm-section-title m-widget__title'], ['wide', 'medium', 'm-widget__title'], ['desktop', 'medium', 'm-widget__title']]) {
    const html = bare(draw(house({action: DETAILS}), [], layout));
    assert.match(html, new RegExp(`^<section class="m-widget m-widget--${size}" data-widget="house"><div class="m-widget__head"><h2 class="${heading}"><span class="m-glyph m-widget__glyph" aria-hidden="true"></span><span class="m-widget__text">House heating</span></h2><button class="m-widget__action m-focusable"[^>]* type="button"[^>]* aria-label="House heating details"[^>]*><span class="m-widget__action-label">Details</span><span class="m-glyph m-widget__action-chevron" aria-hidden="true"></span></button></div><div class="m-widget__body[^"]*"><p>23\\.4°</p></div></section>$`), layout);
    assert.equal(headingText(html), 'House heating', `${layout}: the heading reads its title alone`);
    assert.doesNotMatch(html, /m-widget__press|aria-hidden="true"><p>/, `${layout}: nothing stretched over the widget, the body read`);
    // The h2 inside the head is the h2 a widget without an action draws.
    assert.equal(html.match(/<h2[\s\S]*?<\/h2>/)[0], bare(draw(house({}), [], layout)).match(/<h2[\s\S]*?<\/h2>/)[0], layout);
  }
  assert.equal(headingText(bare(draw(house({action: DETAILS, note: 'Off at the thermostat'}), [], 'wide'))), 'House heatingOff at the thermostat', 'and its note, as before');
  assert.match(draw(house({action: {...DETAILS, enabled: false}}), [], 'wide'), /<button class="m-widget__action m-focusable"[^>]* disabled=""/);
  assert.match(draw(house({action: {...DETAILS, ariaLabel: undefined}})), /<button class="m-widget__action m-focusable"(?![^>]*aria-label)[^>]*><span class="m-widget__action-label">Details/, 'named by its label without an ariaLabel');
  // A press sends the link's intent.
  const sent = [];
  let button;
  draw(h(() => {
    const section = Widget({id: 'house', title: 'House heating', action: DETAILS}), [title] = section.props.children.props.children, head = title.type(title.props);
    button = head.props.children.find(child => child?.props?.className?.startsWith('m-widget__action'));
    return null;
  }), sent, 'wide');
  button.props.onPress();
  assert.deepEqual(sent, [{command: 'detail', entity: 'house'}]);
});

test('a widget with a link draws no action, and development names the widget in a console error', () => {
  const link = {intent: {command: 'navigate', entity: 'climate'}, enabled: true, ariaLabel: 'Attic: 24.2°. Open Attic'};
  for (const layout of ['phone', 'desktop']) {
    const html = draw(house({link, action: DETAILS}), [], layout);
    assert.equal(count(html, /<button/g), 1, layout);
    assert.match(html, /class="m-widget__press m-focusable"/);
    assert.doesNotMatch(html, /m-widget__action/);
  }
  const errors = [], error = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    dev.renderToStaticMarkup(dev.h(dev.LayoutContext.Provider, {value: 'wide'}, dev.h(dev.Widget, {id: 'attic', title: 'Attic', link, action: DETAILS}, 'x')));
    dev.renderToStaticMarkup(dev.h(dev.LayoutContext.Provider, {value: 'wide'}, dev.h(dev.Widget, {id: 'house', title: 'House heating', action: DETAILS}, 'x')));
  } finally { console.error = error; }
  assert.deepEqual(errors.filter(text => text.startsWith('Maison')), ['Maison Widget attic: a widget with a link draws no action; the action is ignored.']);
});

test('without an action a widget draws as before: no head, its h2 the section’s first child', () => {
  for (const layout of ['phone', 'wide', 'desktop']) {
    const html = draw(house({}), [], layout);
    assert.equal(draw(house({action: null}), [], layout), html, layout);
    assert.match(html, /^<section class="m-widget m-widget--\w+" data-widget="house"><h2 class="[^"]*m-widget__title">/, layout);
    assert.doesNotMatch(html, /m-widget__head/, layout);
  }
});

test('the action’s hit area is 44px high, centred on the title, in the title’s own scale, and blue as what presses is', () => {
  const [grid, gridHit, phone, phoneHit] = ['.m-widget__action', '.m-widget__action::after', '.m-widget--phone .m-widget__action', '.m-widget--phone .m-widget__action::after']
    .map(selector => rule(widgetStyles, selector));
  const px = value => Number(value.match(/^(-?\d+)px/)?.[1] ?? NaN);
  const space = name => Number(SHARED[name].replace('px', ''));
  // From 700px: the 20px title row, 12px above and below; 12px down meets a first row's 44px button area (52px row, body 8px under the title).
  assert.equal(grid.height, '20px');
  assert.match(gridHit.inset, /^-12px calc\(-1 \* var\(--m-space-2\)\)$/);
  assert.equal(px(grid.height) - 2 * px(gridHit.inset), 44);
  // The head takes the title's place: 20px high from 700px, 8px over the body, the h2 as the title was; on a phone, the section title's inset.
  const [title, head, inner] = ['.m-widget:not(.m-widget--phone)>.m-widget__title', '.m-widget:not(.m-widget--phone)>.m-widget__head', '.m-widget:not(.m-widget--phone)>.m-widget__head>.m-widget__title']
    .map(selector => rule(widgetStyles, selector));
  assert.deepEqual([head.height, head.margin, head.flex], [title.height, title.margin, title.flex]);
  assert.deepEqual([inner.height, inner.font, inner.color, inner['white-space'], inner.margin], [title.height, title.font, title.color, title['white-space'], '0']);
  assert.deepEqual([rule(widgetStyles, '.m-widget--phone>.m-widget__head').margin, rule(widgetStyles, '.m-widget--phone>.m-widget__head>.m-widget__title').margin], ['0 var(--m-space-1)', '0']);
  // The head sits over the body inside the widget's own stacking context, so a positioned first row never takes the hit area's lower part.
  const lifted = rule(widgetStyles, '.m-widget__head');
  assert.deepEqual([lifted.position, lifted['z-index']], ['relative', '1']);
  assert.equal(rule(widgetStyles, '.m-widget').isolation, 'isolate');
  // Under the title: its 8px margin, then a 52px row whose 36px button reaches 4px out of itself.
  assert.match(head.margin, /^0 0 var\(--m-space-2\)$/);
  assert.equal(-px(gridHit.inset), space('m-space-2') + (52 - space('m-control')) / 2 - 4, 'it ends where the first accessory’s begins');
  // On a phone: the 28px section title line, 8px above and below.
  assert.equal(phone.height, '28px');
  assert.equal(px(phone.height) - 2 * px(phoneHit.inset), 44);
  assert.deepEqual([grid.font, phone.font, grid.color], ['var(--m-type-footnote)', 'var(--m-type-body)', 'var(--m-blue-text)']);
  assert.equal(rule(widgetStyles, '.m-widget__action[data-disabled]').color, 'var(--m-label-3)');
  assert.equal(rule(widgetStyles, '.m-widget__action[data-pressed]').opacity, '.55');
  assert.doesNotMatch(widgetStyles.split('\n').filter(line => line.includes('m-widget__action')).join('\n'), /nowrap|ellipsis|z-index/);
});

// ---- The ListRow's room tint and flag ------------------------------------

const ZONE = {link: {intent: {command: 'detail', entity: 'attic'}, enabled: true, ariaLabel: 'Attic: 24.2°, above target. Open Attic'}, icon: 'desk', title: 'Attic', detail: 'Above target · 16° until 08:00, then 21°'};

test('a tinted row’s tile is gray behind a glyph in the room’s colour; unavailable, the tint has no effect', () => {
  const colour = tempColour(24.2), html = bare(draw(h(ListRow, {...ZONE, tint: colour})));
  assert.match(html, new RegExp(`<span class="m-row__tile m-tone-gray m-row__tile--tint" style="color:${colour.replace(/[()]/g, '\\$&')}"><span class="m-glyph" aria-hidden="true"></span></span>`));
  const unavailable = bare(draw(h(ListRow, {...ZONE, tint: colour, unavailable: true})));
  assert.match(unavailable, /<span class="m-row__tile"><span class="m-glyph"/);
  assert.doesNotMatch(unavailable, /--tint|style=/);
  assert.match(bare(draw(h(ListRow, {...ZONE, tone: 'orange', tint: colour}))), /m-row__tile m-tone-gray m-row__tile--tint/, 'the tint wins over a tone');
});

test('a flag sits right after the title, and a row with neither tint nor flag draws as before', () => {
  const html = draw(h(ListRow, {...ZONE, badge: 'Humid', strong: true}));
  assert.match(html, /<span class="m-row__copy"><span class="m-row__title m-row__title--strong">Attic<\/span><span class="m-row__badge">Humid<\/span><span class="m-row__detail" id="[^"]+">Above target/);
  for (const extra of [{}, {tint: undefined, badge: null}, {tint: '', badge: ''}]) {
    assert.equal(draw(h(ListRow, {...ZONE, ...extra})), draw(h(ListRow, ZONE)), JSON.stringify(extra));
  }
  assert.equal(count(draw(h(List, null, h(ListRow, {...ZONE, key: 'a', badge: 'Dry air'}))), /m-row__badge/g), 1);
});

test('a row whose link names it is described by its detail, unless `describe` is false; without the prop it draws as before', () => {
  const described = draw(h(ListRow, {...ZONE, value: '24.2°'}));
  const [detail, value] = [...described.matchAll(/class="m-row__(?:detail|value[^"]*)" id="([^"]+)"/g)].map(match => match[1]);
  assert.match(described, new RegExp(`<button class="m-row m-row--pressable m-focusable"[^>]* aria-label="Attic: 24\\.2°, above target\\. Open Attic" aria-describedby="${detail} ${value}"`));
  assert.equal(draw(h(ListRow, {...ZONE, value: '24.2°', describe: true})), described, 'true is the default');
  const quiet = draw(h(ListRow, {...ZONE, value: '24.2°', describe: false}));
  assert.doesNotMatch(quiet, /aria-describedby/);
  assert.match(quiet, /aria-label="Attic: 24\.2°, above target\. Open Attic"/, 'the name stays');
  assert.equal(quiet.replace(/ aria-describedby="[^"]*"/, ''), quiet, 'and nothing else changes');
  assert.equal(described.replace(/ aria-describedby="[^"]*"/, ''), quiet);
  // A row named by its text has no description either way.
  const text = {...ZONE, link: {...ZONE.link, ariaLabel: undefined}};
  assert.equal(draw(h(ListRow, {...text, describe: false})), draw(h(ListRow, text)));
});

test('the flag holds on to the title’s last word and never breaks; from 700px it sits right after a clamped title in a grid of two columns', () => {
  // Nothing but the title's end margin between them: no space, so no break between the last word and the flag.
  assert.match(draw(h(ListRow, {...ZONE, badge: 'Humid'})), /Attic<\/span><span class="m-row__badge">Humid<\/span>/);
  // On a phone the copy flows as text: the title's words, then the flag, then the detail on its own line.
  assert.deepEqual(rule(listStyles, '.m-row__copy:has(>.m-row__badge)'), {display: 'block'});
  assert.deepEqual(rule(listStyles, '.m-row__copy:has(>.m-row__badge)>.m-row__detail'), {display: 'block'});
  assert.deepEqual(rule(listStyles, '.m-row__copy:has(>.m-row__badge)>.m-row__title'), {'margin-inline-end': '6px'}, 'the gap is the title’s, so a wrapped flag starts flush');
  const badge = rule(listStyles, '.m-row__badge');
  assert.deepEqual([badge.display, badge['white-space'], badge['vertical-align'], badge.font, badge.background, badge['border-radius'], badge.width],
    ['inline-block', 'nowrap', '1px', 'var(--m-type-footnote-strong)', 'var(--m-fill-gray)', 'var(--m-radius-capsule)', 'max-content']);
  // From 700px, where every line clamps to one, a grid keeps the flag beside the clamped title.
  const widget = '.m-widget:not(.m-widget--phone) .m-row__copy:has(>.m-row__badge)';
  const copy = rule(listStyles, widget);
  assert.deepEqual([copy.display, copy['grid-template-columns'], copy['align-items']], ['grid', 'minmax(0,max-content) minmax(max-content,1fr)', 'baseline']);
  assert.deepEqual(rule(listStyles, `${widget}>.m-row__detail`), {'grid-column': '1/-1', width: '0', 'min-width': '100%'});
  assert.deepEqual(rule(listStyles, `${widget}>.m-row__title`), {'min-width': '0', 'margin-inline-end': '0'}, 'the column gap instead');
  assert.equal(rule(listStyles, '.m-row__copy').display, 'flex', 'rows without a flag keep their column');
});

test('a tinted glyph reads at 3:1 on its tile and a flag at 4.5:1 on its capsule, light and dark, on a card and in a sheet, at every room temperature', () => {
  const glyph = rule(listStyles, '.m-row__tile.m-row__tile--tint>.m-glyph').color.match(/^light-dark\(color-mix\(in srgb,currentColor (\d+)%,var\(--m-label\)\),currentColor\)$/);
  assert.ok(glyph, 'shaded toward the label in light, plain in dark');
  const keep = Number(glyph[1]) / 100, tile = rule(listStyles, '.m-row__tile').background.match(/^color-mix\(in srgb,var\(--m-tone\) (\d+)%,transparent\)$/);
  const flag = rule(listStyles, '.m-row__badge');
  for (const [scheme, tokens] of SCHEMES) {
    const label = channels(tokens['m-label']), gray = alpha(channels(tokens['m-gray']), Number(tile[1]) / 100);
    for (const [where, surface] of Object.entries(surfaces(tokens))) {
      const behind = over(gray, surface);
      const [coldest, worst] = ROOMS.map(t => {
        const room = channels(tempColour(t)), drawn = scheme === 'light' ? [0, 1, 2].map(i => room[i] * keep + label[i] * (1 - keep)).concat(1) : room;
        return [t, contrast(drawn, behind)];
      }).reduce((a, b) => b[1] < a[1] ? b : a);
      assert.ok(worst >= 3, `${scheme}, ${where}: a tinted glyph at ${worst.toFixed(2)}:1 at ${coldest}°`);
      const capsule = over(channels(tokens[flag.background.match(/--([\w-]+)/)[1]]), surface);
      const text = contrast(over(channels(tokens[flag.color.match(/--([\w-]+)/)[1]]), capsule), capsule);
      assert.ok(text >= 4.5, `${scheme}, ${where}: the flag at ${text.toFixed(2)}:1`);
    }
  }
});

// ---- The gallery's specimens ---------------------------------------------

test('the gallery shows every part in every state, and names every bar or hides it', () => {
  const html = bare(draw(h(DetailSpecimens)));
  const bars = tags(html, 'm-target-bar m-target-bar--[^"]*');
  assert.ok(bars.every(tag => (tag.role === 'img' && tag['aria-label']) || (tag['aria-hidden'] === 'true' && !tag.role)), 'no unnamed image');
  for (const state of ['m-target-bar--row', 'm-target-bar--wide', 'm-target-bar--empty', 'm-target-bar--untargeted']) assert.ok(bars.some(tag => tag.class.includes(state)), state);
  assert.ok(bars.some(tag => tag['aria-hidden'] === 'true'), 'hidden inside a named row');
  assert.match(html, /class="m-sheet m-gallery-details__sheet m-gallery-details__sheet--span"[\s\S]*m-target-bar--wide/, 'on a sheet, spanning both cards above it');
  assert.equal(count(html, /aria-expanded="false"/g), 1, 'a disclosure closed');
  assert.equal(count(html, /aria-expanded="true"/g), 1, 'and one open');
  assert.equal(count(html, /<input class="m-date-field__input"/g), 2);
  assert.equal(count(html, /<input class="m-date-field__input"[^>]* disabled=""/g), 1);
  assert.equal(count(html, /<p class="m-feedback">/g), 1, 'the empty one draws nothing');
  assert.equal(count(html, /<div class="m-day" role="listitem"/g), 7);
  assert.match(html, /<div class="m-card m-gallery-details__panel" role="list"><div class="m-day" role="listitem"/, 'the week a list');
  assert.equal(count(html, /aria-current="date"/g), 1);
  assert.ok(count(html, /class="m-widget__action m-focusable"/g) >= 4, 'on a phone and in the grid');
  assert.match(html, /class="m-widget__action m-focusable"[^>]* disabled=""/);
  assert.ok(count(html, /m-row__tile--tint/g) >= 4 && count(html, /class="m-row__badge"/g) >= 3);
  assert.match(html, /m-row m-row--pressable m-row--unavailable/, 'and a zone with no reading');
  assert.doesNotMatch(html, /m-widget__press/);
  // The rails as the page draws them: strong rows, Stop gray, Dry towels tinted.
  const rails = [...html.matchAll(/<span class="m-row__title m-row__title--strong">(Ensuite|Bathroom)<\/span>[\s\S]*?<button class="m-button m-button--(\w+)[^>]*><span class="m-button__label">([^<]+)</g)].map(m => m.slice(1).join(' '));
  assert.deepEqual([...new Set(rails)], ['Ensuite gray Stop', 'Bathroom tinted Dry towels']);
});
