// Maison's frame (#29): what it draws from screen.js's chrome value.
// Node has no JSX, so esbuild bundles the frame with react-dom/server into a
// temporary module (as tests/maison-controls-b.test.mjs does), and each
// test reads the markup a real chrome value renders to: the named navigation
// with one tab per page and only the current one marked, the hero right after
// it (the sky, the header and its tools, the line only when there is one, and
// the page's reading and chart slots as HERO_PARTS allows them per layout),
// the banner only while offline, the status region always there, and the
// page in the content column. The header charts are stood in for by marked
// stubs: their own markup is the chart tests' (maison-charts-*), and this
// file checks only which slot draws what, with which props.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {HOME, PENDING, climateSnapshot, pageSnapshot} from '../frontend/maison/src/gallery-snapshots.js';

const SRC = fileURLToPath(new URL('../frontend/maison/src/', import.meta.url));
const ENTRY = `export {Frame} from './frame.jsx';
export {Hero, HERO_PARTS} from './hero.jsx';
export {CommandContext} from './contexts.js';
export {createElement as h} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The components hero.jsx takes from each chart module. Each is stood in for
// by an <i> that names itself and echoes the props it was given.
const CHARTS = {weather: ['WeatherReading', 'WeatherChart'], zones: ['ZonesChart'], flows: ['FlowsReading', 'FlowsChart'], car: ['CarChart']};
const stubCharts = {name: 'stub-charts', setup(builder) {
  builder.onResolve({filter: /^\.\/charts\/(?:weather|zones|flows|car)\.jsx$/}, args => ({path: args.path.match(/(\w+)\.jsx$/)[1], namespace: 'chart-stub'}));
  builder.onLoad({filter: /.*/, namespace: 'chart-stub'}, args => ({resolveDir: SRC, loader: 'jsx', contents: CHARTS[args.path]
    .map(name => `export const ${name} = ({value, phase, layout}) => <i data-part="${name}" data-phase={phase} data-layout={layout} data-value={value.ariaLabel}/>;`).join('\n')}));
}};

// The frame, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-frame-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: SRC, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent', plugins: [stubCharts],
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'frame.mjs'), bundle.outputFiles[0].text);
const {h, renderToStaticMarkup, CommandContext, Frame, Hero, HERO_PARTS} = await import(pathToFileURL(join(folder, 'frame.mjs')));
rmSync(folder, {recursive: true, force: true});

// The frame's markup around a stand-in page, for a chrome value, and the
// hero's alone in a layout (the frame's first render is always the phone's).
const inContext = element => renderToStaticMarkup(h(CommandContext.Provider, {value: () => {}}, element));
const draw = chrome => inContext(h(Frame, {chrome}, h('main', {className: 'probe'}, 'Page')));
const drawHero = (chrome, layout) => inContext(h(Hero, {chrome, layout}));
const count = (html, pattern) => (html.match(pattern) || []).length;
const energy = () => screen(pageSnapshot(HOME, 'energy', HOME_NOW)).chrome;
const LAYOUTS = ['phone', 'wide', 'desktop'];
// A hero of `kind` as the stubs need it: its kind and its accessible name.
const heroOf = kind => ({kind, ariaLabel: `The ${kind} reading`});

test('the navigation is named by navLabel, with one tab per page and only the current one marked', () => {
  const chrome = energy(), html = draw(chrome);
  assert.match(html, /^<div class="m-app" data-layout="phone"><nav class="m-tabbar" aria-label="Dashboard">/, 'the tab bar comes first');
  const tabs = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  assert.equal(count(tabs, /<button[^>]*class="m-tab m-focusable"/g), chrome.nav.length);
  assert.deepEqual([...tabs.matchAll(/<span class="m-tab__label">([^<]*)<\/span>/g)].map(m => m[1]), chrome.nav.map(item => item.label));
  assert.equal(count(tabs, /aria-current="page"/g), 1);
  assert.match(tabs, /aria-current="page"[^>]*>(?:(?!<\/button>).)*Energy<\/span><\/button>/);
  // Home status is opened from the tools, so no tab is current there.
  assert.equal(count(draw(screen(pageSnapshot(HOME, 'system', HOME_NOW)).chrome), /aria-current=/g), 0);
});

test('a disabled link disables its tab', () => {
  const chrome = energy(), [first, ...rest] = chrome.nav;
  const html = draw({...chrome, nav: [{...first, link: {...first.link, enabled: false}}, ...rest]});
  assert.equal(count(html.slice(0, html.indexOf('</nav>')), / disabled=""/g), 1);
});

test('the hero follows the tab bar as its sibling, holding the sky, then the header and the page’s slots', () => {
  const html = draw({...energy(), hero: heroOf('flows')});
  const hero = html.match(/^<div class="m-app" data-layout="phone"><nav class="m-tabbar"[^>]*>(?:(?!<\/nav>).)*<\/nav><div class="m-hero" data-sky="(night|twilight|day|unknown)">/);
  assert.ok(hero, 'the hero opens right after the tab bar closes');
  const inside = html.slice(html.indexOf('<div class="m-hero"'), html.indexOf('<div class="m-status-region"'));
  assert.doesNotMatch(inside, /m-tabbar|m-tab /, 'the tab bar is not inside the hero');
  const at = name => inside.indexOf(name);
  assert.ok(at('<div class="m-sky"') > 0 && at('<div class="m-sky"') < at('<div class="m-hero__inner"><div class="m-header">'), 'the sky, then the header in the inner column');
  assert.ok(at('class="m-header__tools"') < at('<div class="m-hero__chart">'), 'the chart after the header');
  assert.match(inside, new RegExp(`<i data-part="FlowsChart" data-phase="${hero[1]}" data-layout="phone" data-value="The flows reading"></i>`), 'the chart gets the value, the sky’s phase and the layout');
});

test('each kind’s parts are the contract’s: a reading always, on desktop only, or none', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(HERO_PARTS).map(([kind, {Reading, Chart, readingOn}]) => [kind, [Boolean(Reading), Boolean(Chart), readingOn]])),
    {weather: [true, true, 'always'], zones: [false, true, 'always'], flows: [true, true, 'desktop'], car: [false, true, 'always']});
});

test('the reading slot is drawn only where its kind’s readingOn allows it for the layout, and the chart slot always', () => {
  for (const [kind, {Reading, readingOn}] of Object.entries(HERO_PARTS)) for (const layout of LAYOUTS) {
    const html = drawHero({...energy(), hero: heroOf(kind)}, layout), name = `${kind} on ${layout}`;
    const shown = Boolean(Reading) && (readingOn === 'always' || layout === 'desktop');
    assert.equal(count(html, /<div class="m-hero__reading">/g), shown ? 1 : 0, name);
    if (shown) assert.match(html, new RegExp(`<div class="m-hero__reading"><i data-part="${CHARTS[kind][0]}" data-phase="[a-z]+" data-layout="${layout}" data-value="The ${kind} reading"></i></div>`), name);
    assert.match(html, new RegExp(`<div class="m-hero__chart"><i data-part="${CHARTS[kind].at(-1)}" data-phase="[a-z]+" data-layout="${layout}"[^>]*></i></div></div></div>$`), name);
  }
  // Energy's price shows beside its chart on desktop only.
  assert.deepEqual(LAYOUTS.map(layout => drawHero({...energy(), hero: heroOf('flows')}, layout).includes('FlowsReading')), [false, false, true]);
});

test('Home status draws the sky and the header only: no reading and no chart', () => {
  for (const page of ['system']) {
    const chrome = screen(pageSnapshot(HOME, page, HOME_NOW, {query: '', category: 'all', limit: 8})).chrome;
    assert.equal(chrome.hero, null, page);
    for (const html of [draw(chrome), ...LAYOUTS.map(layout => drawHero(chrome, layout))]) {
      const hero = html.slice(html.indexOf('<div class="m-hero"'));
      assert.match(hero, /^<div class="m-hero" data-sky="[a-z]+"><div class="m-sky"/, page);
      assert.match(hero, /<div class="m-hero__inner"><div class="m-header">(?:(?!<\/div><\/div><\/div>).)*<div class="m-header__tools">/, page);
      assert.doesNotMatch(hero, /m-hero__reading|m-hero__chart|data-part=/, page);
    }
  }
});

test('the header is not a landmark: the date, the large title and two 44px glass tools named by the value', () => {
  const chrome = {...energy(), line: null}, html = draw(chrome);
  assert.doesNotMatch(html, /<header/);
  assert.match(html, /<div class="m-header"><div class="m-header__text"><p class="m-header__date">Sunday 27 September<\/p><h1 class="m-header__title">Energy<\/h1><\/div>/);
  const tools = html.slice(html.indexOf('m-header__tools'));
  for (const name of ['Home alerts', 'Home status'])
    assert.match(tools, new RegExp(`<button class="m-button m-button--glass m-button--large m-button--icon-only m-focusable"[^>]*aria-label="${name}"`), name);
});

test('the header line is drawn only while chrome.line is a non-empty string', () => {
  const chrome = energy();
  for (const line of ['', null, undefined, 42, ['Exporting']]) assert.doesNotMatch(draw({...chrome, line}), /m-header__line/, String(line));
  for (const layout of LAYOUTS) assert.match(drawHero({...chrome, line: 'Exporting 300 W'}, layout),
    /<h1 class="m-header__title">Energy<\/h1><p class="m-header__line">Exporting 300 W<\/p><\/div>/, layout);
});

test('the status region is always there, and its box only while there is a line', () => {
  const quiet = draw(energy());
  assert.match(quiet, /<div class="m-status-region" role="status" aria-live="polite"><\/div>/);
  const status = PENDING.feedback[0][1];
  const busy = draw(screen({...climateSnapshot(), status}).chrome);
  assert.match(busy, new RegExp(`<div class="m-status-region" role="status" aria-live="polite"><p class="m-status">${status}</p></div>`));
});

test('the banner is an alert drawn only while Home Assistant is unreachable', () => {
  assert.doesNotMatch(draw(energy()), /m-banner|role="alert"/);
  const chrome = screen({...climateSnapshot(), online: false}).chrome, html = draw(chrome);
  assert.equal(count(html, /role="alert"/g), 1);
  assert.match(html, new RegExp(`<div class="m-banner" role="alert"><span class="m-glyph m-banner__glyph" aria-hidden="true">.*<p class="m-banner__title">${chrome.offline.title}</p><p class="m-banner__text">${chrome.offline.description}</p>`));
});

test('the page sits in the content column, last in the frame', () => {
  assert.match(draw(energy()), /<div class="m-content"><main class="probe">Page<\/main><\/div><\/div>$/);
});
