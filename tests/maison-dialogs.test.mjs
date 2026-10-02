// Maison's dialogs and toasts (#29 step 4, v35), and its import rule. The dialog bodies (dialogs.jsx) are drawn in Maison's Sheet by
// DialogSheet from screen.js's Dialog values: the home alerts, a calendar
// event and a Home Assistant card; the toasts are Maison's own
// (ui/toast.jsx), on React Aria's queue. Node has no JSX, so esbuild bundles
// them with react-dom/server into a temporary module (as
// tests/maison-car-sheets.test.mjs does), and each test reads the
// markup a body renders to from a screen-shaped value: screen() over a home
// fixture with the route's dialog set, online and offline. Every word is the
// value's (screen.js and today.js may change it), so the tests read each
// string from the value, never an English literal. Then the import rule:
// nothing under src/ imports the renderer step 5 deleted or anything from
// outside Maison, HeroUI, Recharts and Tailwind among it, and package.json
// lists none of them (v36), and App draws with Maison's styles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build, transform} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {controls, screen, words} from '../config/www/maison/screen.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {dialogStyles} from '../frontend/maison/src/dialogs.css.js';
import {frameStyles} from '../frontend/maison/src/frame.css.js';
import {toastStyles} from '../frontend/maison/src/ui/toast.css.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {DIALOGS, AlertsDialog, EventDialog, NativeDialog} from './dialogs.jsx';
export {Toast, createToastQueue} from './ui/toast.jsx';
export {appStyles} from './app.css.js';
export {Button, IntentButton} from './ui/button.jsx';
export {ListRow} from './ui/list.jsx';
export {CommandContext} from './contexts.js';
export {UNSTABLE_ToastStateContext as ToastStateContext} from 'react-aria-components/Toast';
export {createElement as h, isValidElement} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The bodies and the toast, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-dialogs-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'dialogs.mjs'), bundle.outputFiles[0].text);
const {h, isValidElement, renderToStaticMarkup, CommandContext, ToastStateContext, DIALOGS, AlertsDialog, EventDialog, NativeDialog,
  Toast, createToastQueue, Button, IntentButton, ListRow, appStyles} = await import(pathToFileURL(join(folder, 'dialogs.mjs')));
rmSync(folder, {recursive: true, force: true});

const fixture = id => structuredClone(HOME_FIXTURES.find(f => f.id === id));
// The screen's dialog over a home fixture with `dialog` open on Today, as
// tests/maison-chrome.test.mjs builds it.
const dialogOf = (f, dialog, online = true) => screen(fixtureSnapshot({now: HOME_NOW, online, states: f.states, route: {page: 'today', detail: null, dialog},
  loaded: {agenda: f.agenda, agendaLoading: f.agendaLoading, forecasts: f.forecasts}})).dialog;
// Every home fixture, online and offline.
const CASES = HOME_FIXTURES.flatMap(f => [true, false].map(online => ({key: `${f.id}${online ? '' : ' offline'}`, f, online})));
// A body's markup, drawn by DIALOGS as DialogSheet draws it, under a command that does nothing.
const draw = value => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, h(DIALOGS[value.kind], {value})));
// The text a markup shows, node by node.
const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'"};
const texts = markup => markup.split(/<[^>]*>/).map(text => text.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, name) => ENTITIES[name]).trim()).filter(Boolean);
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (markup, pattern) => (markup.match(new RegExp(pattern, 'g')) ?? []).length;
// Every element in a component's tree, depth first, without rendering it.
const elements = node => !isValidElement(node) ? (Array.isArray(node) ? node.flatMap(elements) : [])
  : [node, ...elements(node.props.children)];

// The custom properties a rule sets, as {name: value}.
const customProperties = body => Object.fromEntries(body.split(';').filter(part => part.trim().startsWith('--'))
  .map(part => [part.slice(0, part.indexOf(':')).trim(), part.slice(part.indexOf(':') + 1).trim()]));
// A one-line rule's body, by its exact selector.
const ruleOf = (css, selector) => css.split('\n').find(line => line.startsWith(`${selector}{`))?.slice(selector.length + 1, -1);

// The body draws every word of its value but the sheet's title and eyebrow
// (the Sheet's header draws those), and no other: React writes no word.
function assertWords(value, markup, key) {
  const [title, eyebrow, ...rest] = words(value);
  assert.deepEqual([title, eyebrow], [value.title, value.eyebrow], `${key}: words() starts with the sheet's own`);
  assert.deepEqual(texts(markup), rest, `${key}: the body's words are the value's, in order`);
}

// ---- The home alerts ----------------------------------------------------

test('the alerts body lists the value’s alerts as strong orange rows that open their entities, then Home status', () => {
  let shown = 0;
  for (const {key, f, online} of CASES) {
    const value = dialogOf(f, {kind: 'alerts'}, online), markup = draw(value);
    assert.match(markup, /^<div class="m-dialog m-dialog--alerts">/, key);
    if (value.rows.length) {
      shown += 1;
      assert.match(markup, /^<div class="m-dialog m-dialog--alerts"><div class="m-list m-list--inset" role="list">/, `${key}: the rows first, on one inset card`);
      assert.equal(count(markup, 'class="m-row m-row--pressable m-focusable"'), value.rows.length, `${key}: a pressable row per alert`);
      assert.equal(count(markup, 'class="m-row__tile m-tone-orange"'), value.rows.length, `${key}: each on an orange tile (amber: it needs you)`);
      assert.equal(count(markup, 'class="m-row__title m-row__title--strong"'), value.rows.length, `${key}: a primary row's strong title`);
      for (const row of value.rows) assert.match(markup, new RegExp(`>${escape(row.title)}</span><span class="m-row__detail"[^>]*>${escape(row.detail)}<`), key);
      assert.doesNotMatch(markup, /m-dialog__empty/, key);
    } else {
      // As Home status draws an all-clear section: one static gray-check row on a card, then the rest as footnotes.
      const [first, ...rest] = value.empty;
      assert.match(markup, new RegExp(`^<div class="m-dialog m-dialog--alerts"><div class="m-dialog__empty"><div class="m-list m-list--inset" role="list"><div class="m-list__item" role="listitem">`
        + `<div class="m-row"><span class="m-row__tile m-tone-gray"><span class="m-glyph"[^>]*><svg[^>]*data-icon="[^"]*check[^"]*"[^>]*>.*?</svg></span></span>`
        + `<span class="m-row__copy"><span class="m-row__title">${escape(first)}</span></span></div></div></div>`
        + `${rest.map(line => `<p class="m-dialog__footnote">${escape(line)}</p>`).join('')}</div>`), `${key}: the all-clear row, then its footnote`);
      assert.ok(rest.length > 0, `${key}: the fixture's empty state has a footnote`);
      assert.doesNotMatch(markup, /m-row--pressable|m-tone-orange/, `${key}: nothing to press or flag but Home status`);
    }
    assert.match(markup, new RegExp(`<button [^>]*class="m-button m-button--gray m-button--large m-button--wide m-focusable"[^>]*>(?:<span class="m-glyph"[^>]*>.*?</span>)?<span class="m-button__label">${escape(value.status.label)}</span></button></div>$`),
      `${key}: Home status last, a wide gray button`);
    assertWords(value, markup, key);
  }
  assert.ok(shown > 0 && shown < CASES.length, 'the fixtures draw both: alerts and none');
});

test('the alerts body presses only the value’s links: each row’s and Home status', () => {
  for (const {key, f, online} of CASES) {
    const value = dialogOf(f, {kind: 'alerts'}, online), tree = elements(AlertsDialog({value}));
    assert.deepEqual(tree.filter(el => el.type === ListRow && el.props.link).map(el => el.props.link), value.rows.map(row => row.link), key);
    assert.equal(tree.filter(el => el.type === ListRow && !el.props.link).length, value.empty ? 1 : 0, `${key}: the all-clear row presses nothing`);
    assert.deepEqual(tree.filter(el => el.type === IntentButton).map(el => el.props.action), [value.status], key);
    // The value's links, close aside (the Sheet's), are exactly these.
    assert.deepEqual(controls({...value, close: null}).length, value.rows.length + 1, key);
  }
});

// ---- A calendar event ---------------------------------------------------

// Each event of each fixture's agenda, and one whose description runs over
// several lines.
const EVENTS = HOME_FIXTURES.flatMap(f => (f.agenda?.events ?? []).map((event, i) => ({key: `${f.id} event ${i}`, f, event})));
test('an event body says when, where, what and which calendar, then Full calendar', () => {
  const [lunch] = fixture('full').agenda.events;
  const cases = [...EVENTS, {key: 'lines', f: fixture('full'), event: {...lunch, description: 'Bring:\n- bread\n- the <good> wine & glasses'}}];
  assert.ok(cases.some(({event}) => event.location) && cases.some(({event}) => !event.location) && cases.some(({event}) => !event.description), 'the fixtures draw each part and its absence');
  for (const {key, f, event} of cases) for (const online of [true, false]) {
    const value = dialogOf(f, {kind: 'event', event}, online), markup = draw(value);
    assert.equal(value.kind, 'event', key);
    const parts = [`<div class="m-dialog m-dialog--event"><div class="m-dialog__facts"><p class="m-dialog__date">${escape(value.date)}</p>`,
      value.location ? `<p class="m-dialog__location">${escape(value.location)}</p>` : '', '</div><div class="m-dialog__details">',
      value.description ? `<div class="m-card m-dialog__note"><p class="m-dialog__description">${escape(value.description.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'))}</p></div>` : '',
      `<p class="m-dialog__calendar">${escape(value.calendar)}</p></div><button [^>]*class="m-button m-button--gray m-button--large m-button--wide m-focusable"`];
    assert.match(markup, new RegExp(`^${parts.join('')}`), key);
    assert.match(markup, new RegExp(`<span class="m-button__label">${escape(value.full.label)}</span></button></div>$`), key);
    assert.deepEqual(elements(EventDialog({value})).filter(el => el.type === IntentButton).map(el => el.props.action), [value.full], `${key}: the value's link`);
    assertWords(value, markup, key);
  }
  // The description keeps its line breaks, which the stylesheet draws.
  const lines = draw(dialogOf(fixture('full'), {kind: 'event', event: {...lunch, description: 'One\nTwo'}}));
  assert.match(lines, /<p class="m-dialog__description">One\nTwo<\/p>/);
  assert.match(dialogStyles, /^\.m-dialog__description\{[^}]*white-space:pre-wrap[^}]*\}$/m);
  // When leads (body, primary), where follows (subhead, secondary), and the calendar is the card's footnote, 8px under it.
  assert.match(ruleOf(dialogStyles, '.m-dialog__date'), /font:var\(--m-type-body\);color:var\(--m-label\)/);
  assert.match(ruleOf(dialogStyles, '.m-dialog__location'), /font:var\(--m-type-subhead\);color:var\(--m-label-2\)/);
  assert.match(ruleOf(dialogStyles, '.m-dialog__details'), /gap:var\(--m-space-2\)/);
  assert.match(ruleOf(dialogStyles, '.m-dialog__calendar'), /padding-inline:var\(--m-space-1\);font:var\(--m-type-footnote\);color:var\(--m-label-2\)/);
});

// ---- A Home Assistant card ----------------------------------------------

test('a card body is the Native slot in Maison’s frame, and nothing else', () => {
  for (const {key, f, online} of CASES) for (const open of [{kind: 'native', native: 'calendar'}, {kind: 'native', native: 'history', chart: 'power'}]) {
    const value = dialogOf(f, open, online), markup = draw(value);
    assert.equal(markup, `<div class="m-dialog m-dialog--native"><div class="m-native"><div class="native" data-native="${value.native.key}"></div></div></div>`, `${key} ${open.native}`);
    assertWords(value, markup, `${key} ${open.native}`);
  }
});

// The Home Assistant variables styles.js set for Home Assistant's cards until
// v36 (its .native rule and the host's card variables, less Maison's own
// two), frozen when it stopped setting them.
const HA_CARD_VARIABLES = ['--primary-text-color', '--secondary-text-color', '--primary-color', '--text-primary-color', '--card-background-color',
  '--ha-card-background', '--ha-card-border-radius', '--ha-card-border-width', '--ha-card-box-shadow', '--divider-color', '--primary-background-color',
  '--secondary-background-color', '--state-icon-color', '--paper-item-icon-color', '--mdc-theme-primary', '--mdc-theme-on-primary', '--md-sys-color-primary',
  '--md-sys-color-on-primary', '--md-sys-color-surface', '--md-sys-color-on-surface', '--md-sys-color-on-surface-variant'];
test('the card’s frame maps every Home Assistant card variable onto Maison’s tokens, in both themes', () => {
  const ported = HA_CARD_VARIABLES;
  const light = customProperties(ruleOf(dialogStyles, '.m-native>.native')), dark = customProperties(ruleOf(dialogStyles, ':host([dark]) .m-native>.native'));
  assert.deepEqual(ported.filter(name => !(name in light)), [], 'every one is set inside the frame');
  // To a token, or to nothing: the frame is the card's surface.
  for (const [name, value] of Object.entries(light))
    assert.ok(/^var\(--m-[a-z0-9-]+\)$/.test(value) || (['--ha-card-background', '--ha-card-border-width', '--ha-card-box-shadow'].includes(name) && ['transparent', '0', 'none'].includes(value)), `${name}: ${value}`);
  assert.deepEqual([light['--ha-card-background'], light['--ha-card-border-width'], light['--ha-card-box-shadow']], ['transparent', '0', 'none']);
  // What a card draws on stays opaque: the card's white in light, the sheet's fill in dark, where the card is translucent.
  assert.deepEqual(dark, {'--card-background-color': 'var(--m-sheet-fill)', '--md-sys-color-surface': 'var(--m-sheet-fill)'});
  assert.deepEqual([light['--card-background-color'], light['--md-sys-color-surface']], ['var(--m-card-fill)', 'var(--m-card-fill)']);
  // The frame is a card, and a card that can't load says so as a footnote on it.
  assert.match(ruleOf(dialogStyles, '.m-native'), /background:var\(--m-card-fill\);border:\.5px solid var\(--m-card-border\);border-radius:var\(--m-radius-card\)/);
  assert.match(ruleOf(dialogStyles, '.m-native .note'), /font:var\(--m-type-footnote\);color:var\(--m-label-2\)/);
  assert.equal(ruleOf(dialogStyles, '.m-native>.native>*'), 'display:block');
});

// Since v36 the host maps no Home Assistant variable, so a card drawn
// outside Maison's card frame would be unthemed. Every use of Native under
// src/ (read from esbuild's output, which drops comments) is its import or
// a <Native/> that is the only child of a div.m-native; native.jsx itself
// defines it.
async function nativeUses(path) {
  const {code} = await transform(readFileSync(path, 'utf8'), {loader: 'jsx', jsx: 'preserve'});
  return [...code.matchAll(/(?<![\w$])Native(?![\w$])/g)].map(({index}) => {
    const line = code.slice(code.lastIndexOf('\n', index) + 1, code.indexOf('\n', index));
    if (/^import \{ Native \} from "[./]*native\.jsx";$/.test(line)) return null;
    const framed = /<div className="m-native">\s*$/.test(code.slice(0, index - 1)) && code[index - 1] === '<' && /^Native\b[^<>]*\/>\s*<\/div>/.test(code.slice(index));
    return framed ? null : `${repoPath(path)}: ${line.trim()}`;
  }).filter(Boolean);
}
test('every Home Assistant card under src/ is the only child of Maison’s card frame, div.m-native', async () => {
  const files = sources(SRC).filter(path => path !== join(SRC, 'native.jsx'));
  assert.ok(files.includes(join(SRC, 'dialogs.jsx')), 'the reader finds the dialog that draws one');
  assert.deepEqual((await Promise.all(files.map(nativeUses))).flat(), []);
  // The reader catches a card outside the frame, a second child and another name.
  const samples = mkdtempSync(join(tmpdir(), 'maison-native-'));
  const write = (name, text) => { const path = join(samples, name); writeFileSync(path, text); return path; };
  try {
    assert.deepEqual(await nativeUses(write('a.jsx', `import {Native} from '../native.jsx';\nexport const A = ({v}) => <div className="m-native"><Native value={v}/></div>;`)), []);
    assert.equal((await nativeUses(write('b.jsx', `import {Native} from '../native.jsx';\nexport const B = ({v}) => <div className="m-card"><Native value={v}/></div>;`))).length, 1);
    assert.equal((await nativeUses(write('c.jsx', `import {Native} from '../native.jsx';\nexport const C = ({v}) => <div className="m-native"><Native value={v}/><p/></div>;`))).length, 1);
    assert.equal((await nativeUses(write('d.jsx', `import {Native as Card} from '../native.jsx';\nexport const D = ({v}) => <div className="m-native"><Card value={v}/></div>;`))).length, 1);
  } finally { rmSync(samples, {recursive: true, force: true}); }
});

// ---- DialogSheet ----------------------------------------------------------

test('DialogSheet draws Maison’s body for every kind screen() opens, and no old body', () => {
  assert.deepEqual(Object.keys(DIALOGS), ['alerts', 'event', 'native']);
  assert.deepEqual(Object.values(DIALOGS), [AlertsDialog, EventDialog, NativeDialog]);
  const [lunch] = fixture('full').agenda.events;
  const kinds = [{kind: 'alerts'}, {kind: 'event', event: lunch}, {kind: 'native', native: 'calendar'}, {kind: 'native', native: 'history', chart: 'power'}];
  for (const open of kinds) assert.ok(Object.hasOwn(DIALOGS, dialogOf(fixture('full'), open).kind), open.kind);
  const sheets = readFileSync(join(SRC, 'sheets.jsx'), 'utf8');
  assert.match(sheets, /Body = shown && DIALOGS\[shown\.kind\]/);
  assert.doesNotMatch(sheets, /BODIES/, 'no table of the old bodies');
  assert.equal(existsSync(join(SRC, 'sheets.css.js')), false, 'the old bodies’ patches are gone, and their file with them');
});

// ---- Toasts --------------------------------------------------------------

test('Maison’s queue shows two toasts at most, the newest first', () => {
  const queue = createToastQueue();
  for (const title of ['one', 'two', 'three']) queue.add({title}, {timeout: 5500});
  assert.deepEqual(queue.visibleToasts.map(toast => toast.content.title), ['three', 'two']);
  queue.clear();
  assert.deepEqual(queue.visibleToasts, []);
});

test('a toast is its title and a gray close button, on the glass, and React writes none of its words', () => {
  const queue = createToastQueue(), message = 'Request sent. Check the device state for the result.';
  queue.add({title: message}, {timeout: 5500});
  const [toast] = queue.visibleToasts, state = {visibleToasts: [toast], add() {}, close() {}, pauseAll() {}, resumeAll() {}};
  const markup = renderToStaticMarkup(h(ToastStateContext.Provider, {value: state}, h(Toast, {toast})));
  assert.match(markup, /^<div [^>]*class="m-toast"[^>]*><div [^>]*class="m-toast__content"[^>]*><span [^>]*class="m-toast__title"[^>]*>Request sent\. Check the device state for the result\.<\/span><\/div>/);
  assert.match(markup, /<button [^>]*class="m-button m-button--gray m-button--regular m-button--icon-only m-focusable m-toast__close"[^>]*aria-label="Close"/);
  assert.deepEqual(texts(markup), [message], 'the message, and no other word');
  assert.match(renderToStaticMarkup(h(ToastStateContext.Provider, {value: state}, h(Toast, {toast, closeLabel: 'Dismiss'}))), /aria-label="Dismiss"/);
  // Its close button takes no focus, so focus never enters the region and pauses the other toasts' timers.
  assert.deepEqual(elements(Toast({toast})).filter(el => el.type === Button).map(el => [el.props.slot, el.props.preventFocusOnPress]), [['close', true]]);
  // A toast a sheet has made inert is hidden, not drawn over the sheet with taps going through it.
  assert.equal(ruleOf(toastStyles, '.m-toast-region[inert]'), 'visibility:hidden');
  // Glass, fixed at the bottom centre, above the sheets; the frame lifts it above the phone tab bar.
  assert.match(ruleOf(toastStyles, '.m-toast-region'), /^position:fixed;left:50%;bottom:var\(--m-space-4\);z-index:var\(--m-z-toast\);.*translate:-50% 0;.*pointer-events:none$/);
  assert.match(ruleOf(toastStyles, '.m-toast'), /background:linear-gradient\(180deg,var\(--m-glass-top\),var\(--m-glass-bottom\)\);.*backdrop-filter:var\(--m-glass-blur\);.*pointer-events:auto/);
  assert.match(ruleOf(toastStyles, '.m-toast__title'), /font:var\(--m-type-subhead\);color:var\(--m-label\)/);
  assert.match(frameStyles, /\.m-app\[data-layout=phone\]\)~\.maison-overlays \.m-toasts\{bottom:calc\([^}]*var\(--m-tabbar-height\) \+ var\(--m-space-3\)\)\}/);
});

test('Maison draws its toasts from its own queue, which the dashboard clears as it unmounts', () => {
  const app = readFileSync(join(SRC, 'app.jsx'), 'utf8');
  assert.match(app, /<ToastRegion queue=\{queue\} className="m-toasts"\/>/);
  assert.match(app, /const queue = createToastQueue\(\)/);
  assert.match(app, /toast\(message\) \{ queue\.add\(\{title: message\}, \{timeout: 5500\}\); \}/, 'toast(message) is unchanged');
  assert.match(app, /unmount\(\) \{ mounted = false; root\.unmount\(\); queue\.clear\(\); portal\.remove\(\); \}/);
  assert.doesNotMatch(app, /Toast\.Provider|Toast\.Queue|@heroui/);
});

// ---- No English in the bodies -------------------------------------------

// The strings a source writes, read from esbuild's output (which turns JSX
// text and attribute values into string literals), leaving out imports:
// each must be a class list, a lowercase token (a variant, a key, an id) or
// hold no letters; and no text prop or child may be a literal at all (as
// tests/maison-today-page.test.mjs reads the pages).
const TEXT_PROPS = /\b(?:title|label|ariaLabel|"aria-label"|text|note|line|detail|headline|value|unit|children):\s*(["`])/;
async function english(source) {
  const {code} = await transform(source, {loader: 'jsx', jsx: 'automatic'});
  const body = code.split('\n').filter(line => !/^\s*import\b/.test(line)).join('\n');
  const literals = [...body.matchAll(/"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g)].flatMap(([, quoted, template]) =>
    quoted !== undefined ? [quoted] : template.split(/\$\{[^}]*\}/));
  const token = text => !/[A-Za-z]/.test(text) || /^[a-z][A-Za-z0-9]*(?:-[a-z0-9]+)*$/.test(text) || /^m-[\w-]+(?: m-[\w-]+)*$/.test(text.trim());
  return [...literals.filter(text => !token(text)), ...body.split('\n').filter(line => TEXT_PROPS.test(line)).map(line => line.trim())];
}

test('the dialog bodies and the sheets write no English: every word comes from the value', async () => {
  assert.ok((await english('export const A = () => <p>Home status</p>;')).length > 0, 'the reader finds JSX text');
  for (const file of ['dialogs.jsx', 'sheets.jsx']) assert.deepEqual(await english(readFileSync(join(SRC, file), 'utf8')), [], file);
});

// ---- The import rule ----------------------------------------------------

// Every module a source imports or re-exports, read from esbuild's output,
// which drops comments and writes each import on a line of its own, so
// prose such as "from 'x' and 'y'" in a comment or a string is never read
// as one (a scan of the raw text would).
async function imports(source) {
  const {code} = await transform(source, {loader: 'jsx', jsx: 'automatic'});
  return [...code.matchAll(/^(?:import|export)\b[^;]*?\bfrom\s*"([^"]+)"|^import\s*"([^"]+)"|\bimport\("([^"]+)"\)/gm)].map(m => m[1] ?? m[2] ?? m[3]);
}
const REPO = fileURLToPath(new URL('../', import.meta.url));
const repoPath = path => relative(REPO, path).split('\\').join('/');
const sources = folder => readdirSync(folder, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? sources(join(folder, entry.name))
  : /\.jsx?$/.test(entry.name) ? [join(folder, entry.name)] : []);
// The renderer step 5 deleted: its parts, its drawer, its metric card and
// chart, its pages' folders and its styles. Its dialogs.jsx and pages.jsx
// are names of Maison's own files since the rename.
const OLD = /^frontend\/maison\/src\/(?:(?:parts|components|drawer|metric-card|history-chart)\.jsx|shell-styles\.js|hero-ui\.css|(?:today|climate|energy|car|system|life)\/)/;
// What a file under src/ may import: React, React Aria, Maison's own files
// and the icons. The gallery's files (gallery.jsx, gallery/ and the
// snapshots) alone read the snapshots, the fixtures and the specimens; the
// two entries alone load the shadow-DOM adapter, which alone reads React
// Stately's flag.
const ALLOWED = [/^react(?:-dom)?(?:\/[\w-]+)?$/, /^react-aria(?:-components)?\/[\w/-]+$/,
  /^frontend\/maison\/src\/(?!gallery\/|gallery-snapshots\.js$|shadow-dom\.js$)/, /^config\/www\/maison\/icons\.js$/];
const GALLERY = [/^frontend\/maison\/src\/(?:gallery\/|gallery-snapshots\.js$)/, /^frontend\/maison\/fixtures\//];
const isGallery = file => /^frontend\/maison\/src\/(?:gallery(?:\.jsx$|\/)|gallery-snapshots\.js$)/.test(file);
const isEntry = file => /^frontend\/maison\/src\/(?:app|gallery)\.jsx$/.test(file);
// Whether `file` (under src/) may import `spec`, as it writes it.
function allowed(file, spec) {
  const path = join(SRC, file), target = spec.startsWith('.') ? repoPath(resolve(dirname(path), spec)) : spec, from = repoPath(path);
  return !OLD.test(target) && !/^@heroui\//.test(target)
    && (ALLOWED.some(rule => rule.test(target)) || (isGallery(from) && GALLERY.some(rule => rule.test(target)))
      || (isEntry(from) && target === 'frontend/maison/src/shadow-dom.js')
      || (from === 'frontend/maison/src/shadow-dom.js' && target === 'react-stately/private/flags/flags'));
}
// Each import under src/ that breaks the rule, as 'file imports module'.
async function strays() {
  const found = await Promise.all(sources(SRC).map(async path => {
    const file = relative(SRC, path).split('\\').join('/');
    return (await imports(readFileSync(path, 'utf8'))).filter(spec => !allowed(file, spec)).map(spec => `${file} imports ${spec}`);
  }));
  return found.flat();
}

test('the import rule reads every file under src/ and tells the old renderer from Maison’s own', async () => {
  const files = sources(SRC).map(path => relative(SRC, path).split('\\').join('/'));
  for (const file of ['app.jsx', 'dialogs.jsx', 'pages/today.jsx', 'drawers/car.jsx', 'charts/flows.jsx', 'charts/history-plot.js', 'gallery.jsx', 'gallery/sheets.jsx',
    'gallery-snapshots.js', 'shadow-dom.js', 'ui/sheet.jsx'])
    assert.ok(files.includes(file), file);
  // Statements, multi-line ones and re-exports, never prose.
  assert.deepEqual(await imports(`import './a.js';\nimport {b,\n  c} from '../b.jsx';\nexport * from "./c.js";\nexport {d} from './d.js';\n// Read from 'x' and 'y'.\nconst e = "from 'z'", f = () => import('./f.js');`),
    ['./a.js', '../b.jsx', './c.js', './d.js', './f.js']);
  assert.deepEqual(['@heroui/react', '@heroui/styles', './parts.jsx', './components.jsx', './drawer.jsx', './metric-card.jsx', './history-chart.jsx',
    './shell-styles.js', './today/page.jsx', './climate/drawers.jsx', './energy/page.jsx', './car/page.jsx', './system/page.jsx', './life/page.jsx',
    '../../../config/www/maison/styles.js', '../../../config/www/maison/vendor/hero-ui.js', './gallery-snapshots.js', './gallery/sheets.jsx', 'recharts']
    .map(spec => allowed('app.jsx', spec)), Array(19).fill(false));
  assert.deepEqual(['react', 'react-dom/server', 'react-aria/PortalProvider', 'react-aria-components/Toast', './pages.jsx', './pages/today.jsx', './dialogs.jsx',
    './contexts.js', './native.jsx', './ui/index.js', './ui/toast.jsx', './shadow-dom.js'].map(spec => allowed('app.jsx', spec)), Array(12).fill(true));
  assert.deepEqual(['../../../../config/www/maison/icons.js', '../history-format.js', '../ui/list.jsx', '../ui/../parts.jsx', '../car/page.jsx']
    .map(spec => allowed('charts/flows.jsx', spec)), [true, true, true, false, false]);
  // Only the gallery reads the snapshots and the fixtures, only the entries load the adapter, and the gallery injects no served sheet and draws no old component either.
  assert.deepEqual(['./shadow-dom.js', './gallery-snapshots.js', '../fixtures/home-fixtures.js', '../../../config/www/maison/vendor/hero-ui.js', '../../../config/www/maison/styles.js']
    .map(spec => allowed('gallery.jsx', spec)), [true, true, true, false, false]);
  assert.deepEqual(['../shadow-dom.js', '../gallery-snapshots.js', '../../fixtures/home-fixtures.js'].map(spec => allowed('pages/today.jsx', spec)), [false, false, false]);
  assert.deepEqual(['../parts.jsx', '../today/page.jsx', '@heroui/react'].map(spec => allowed('gallery/sheets.jsx', spec)), [false, false, false]);
});

test('nothing under src/ imports HeroUI, the old renderer or anything outside Maison', async () => {
  assert.deepEqual(await strays(), []);
});

// HeroUI, Recharts and Tailwind left with step 5 (v36): no file under src/
// imports them, and neither the package nor its lockfile holds them, or
// React Is, which only Recharts needed.
const GONE = /@heroui\b|\brecharts\b|tailwind/i;
test('nothing under src/ imports HeroUI, Recharts or Tailwind, and package.json lists none of them', async () => {
  const files = sources(SRC);
  for (const file of ['app.jsx', 'gallery.jsx', 'contexts.js', 'native.jsx', 'ui/sheet.jsx', 'dialogs.jsx']) assert.ok(files.includes(join(SRC, file)), file);
  assert.deepEqual(['@heroui/react', '@heroui/react/button', '@heroui/styles', 'recharts', 'tailwindcss', '@tailwindcss/cli', 'tailwind-merge', 'react-aria/PortalProvider'].map(spec => GONE.test(spec)),
    [true, true, true, true, true, true, true, false]);
  const found = await Promise.all(files.map(async path => (await imports(readFileSync(path, 'utf8'))).filter(spec => GONE.test(spec)).map(spec => `${repoPath(path)} imports ${spec}`)));
  assert.deepEqual(found.flat(), []);
  const pkg = JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8')), lock = JSON.parse(readFileSync(join(SRC, '../package-lock.json'), 'utf8'));
  const named = names => names.filter(name => GONE.test(name) || name === 'react-is');
  assert.deepEqual(named(Object.keys({...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies})), []);
  assert.deepEqual(named(Object.keys(lock.packages).map(path => path.replace(/^.*node_modules\//, ''))), [], 'nor does the lockfile');
  assert.equal(pkg.name, 'maison');
  assert.deepEqual(Object.keys(pkg.scripts).filter(name => /styles/.test(name)), [], 'no styles build');
});

// Every selector a stylesheet's rules use, split at top-level commas (so
// `:is(.a,.b)` stays whole), leaving out at-rules' preludes and keyframes'
// steps.
function selectorsOf(css) {
  const found = [], stack = [];
  let text = '';
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      const prelude = text.trim(), frames = prelude.startsWith('@keyframes') || stack.includes('keyframes');
      if (!prelude.startsWith('@') && !frames) {
        let depth = 0, part = '';
        for (const c of prelude) {
          if (c === ',' && !depth) { found.push(part.trim()); part = ''; continue; }
          depth += c === '(' ? 1 : c === ')' ? -1 : 0; part += c;
        }
        found.push(part.trim());
      }
      stack.push(frames ? 'keyframes' : prelude.startsWith('@') ? 'at' : 'rule');
      text = '';
    } else if (char === '}') { stack.pop(); text = ''; } else if (char === ';' && stack.at(-1) === 'rule') text = '';
    else text += char;
  }
  return found;
}

test('App draws with Maison’s styles only: every selector is Maison’s, and the page keeps its minimum height', () => {
  assert.deepEqual(selectorsOf('@media (x){.m-a,:is(.m-b,.c){d:e}}@keyframes k{from{f:0}}:host .m-g{h:i}'), ['.m-a', ':is(.m-b,.c)', ':host .m-g']);
  const selectors = selectorsOf(appStyles);
  assert.ok(selectors.length > 500 && selectors.includes('.m-native>.native') && selectors.includes('.m-toast'), 'the reader reads them');
  assert.deepEqual(selectors.filter(selector => !selector.startsWith('.m-') && !/^:host\b/.test(selector)), []);
  // The old shell, drawer, metric, chart and component styles are gone, the
  // page's 240px with them into the frame.
  for (const old of ['maison-page', 'react-detail-drawer', 'maison-metric-grid', 'react-history-chart', 'maison-react-icon', 'app-toasts'])
    assert.doesNotMatch(appStyles, new RegExp(`(?:^|\\})\\.${old}\\{`, 'm'), `the old .${old} rule`);
  assert.match(frameStyles, /^\.m-page\{min-height:240px\}$/m);
  assert.match(readFileSync(join(SRC, 'app.jsx'), 'utf8'), /<main className="m-page" key=\{page\.id\}>/, 'the frame’s rule finds the page, by Maison’s class alone');
});
