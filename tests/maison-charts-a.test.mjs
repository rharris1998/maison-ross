// Maison's weather and Car header charts (#29 step 3): what they draw
// from the heroes screen.js builds for the gallery's variants. Node has no
// JSX, so esbuild bundles the charts with react-dom/server into a temporary
// module (as tests/maison-controls-b.test.mjs does), and each test reads
// the markup a real hero renders to: the weather as real text, its days a
// named list and nothing without them, '—' drawn as missing rather than as a
// reading; the Car an image named by its value, its tyres in their wells, the
// cable only while plugged in (from off the edge on a phone, along the ground
// from the shadow's end wider), its glow only while charging and in its
// source's class, the LED lit only then, an offline Charger's Car dimmed
// without cable or LED, and every gradient id its own when two Cars share a
// document. Their stylesheets are read as strings for what markup can't show.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {screen} from '../config/www/maison/screen.js';
import {HERO_VARIANTS, heroSnapshot} from '../frontend/maison/src/gallery-snapshots.js';
import {weatherChartStyles} from '../frontend/maison/src/charts/weather.css.js';
import {carChartStyles} from '../frontend/maison/src/charts/car.css.js';

const CHARTS = fileURLToPath(new URL('../frontend/maison/src/charts/', import.meta.url));
const ENTRY = `export {WeatherReading, WeatherChart} from './weather.jsx';
export {CarChart} from './car.jsx';
export {createElement as h, Fragment} from 'react';
export {renderToStaticMarkup} from 'react-dom/server';`;

// The charts, bundled once for Node.
const folder = mkdtempSync(join(tmpdir(), 'maison-charts-a-'));
const bundle = await build({stdin: {contents: ENTRY, resolveDir: CHARTS, loader: 'js'}, bundle: true, write: false, format: 'esm', platform: 'node',
  jsx: 'automatic', loader: {'.js': 'jsx'}, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  // react-dom/server requires Node's own modules.
  banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}});
writeFileSync(join(folder, 'charts.mjs'), bundle.outputFiles[0].text);
const {h, Fragment, renderToStaticMarkup, WeatherReading, WeatherChart, CarChart} = await import(pathToFileURL(join(folder, 'charts.mjs')));
rmSync(folder, {recursive: true, force: true});

const hero = (page, variant) => screen(heroSnapshot(page, variant)).chrome.hero;
const draw = (Chart, value, phase = 'day', layout = 'phone') => renderToStaticMarkup(h(Chart, {value, phase, layout}));
const count = (html, pattern) => (html.match(pattern) || []).length;
// Text as React escapes it in markup.
const escaped = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const PHASES = ['night', 'twilight', 'day', 'unknown'];

test('the gallery’s variants are the contract’s, so every one below is drawn', () => {
  assert.deepEqual(HERO_VARIANTS.today, ['day', 'night', 'unavailable']);
  assert.deepEqual(HERO_VARIANTS.car, ['unplugged', 'waiting', 'solar', 'offpeak', 'unavailable']);
});

test('the reading is real text: its sentence for a screen reader, and the temperature, condition, icon and line drawn for the eye', () => {
  const value = hero('today', 'day'), html = draw(WeatherReading, value);
  assert.equal(value.temperature, '24°');
  assert.match(html, /^<div class="m-weather" data-layout="phone">/);
  assert.match(html, new RegExp(`<span class="m-weather__label">${escaped(value.ariaLabel)}</span>`), 'the whole reading, once, for a screen reader');
  assert.match(html, /<span class="m-weather__temp" aria-hidden="true">24<span class="m-weather__degree">°<\/span><\/span>/, 'the degree hangs past the digits');
  assert.match(html, /<div class="m-weather__text" aria-hidden="true"><p class="m-weather__condition"><span class="m-glyph m-weather__icon m-weather__icon--wx-sun" aria-hidden="true"><svg[^>]*data-icon="lucide:sun"/);
  assert.match(html, />Sunny<\/p><p class="m-weather__line">Tomorrow 17°<\/p><\/div><\/div>$/);
  assert.doesNotMatch(html, /<svg[^>]*role=/, 'no chart image: the weather is text');
  // The layout is the root's, for the stylesheet: beside each other on desktop.
  assert.match(draw(WeatherReading, value, 'day', 'desktop'), /^<div class="m-weather" data-layout="desktop">/);
  // No icon for a condition Home Assistant doesn't list, and no line without tomorrow.
  const bare = draw(WeatherReading, {...value, icon: null, line: null});
  assert.equal(count(bare, /m-glyph/g), 0);
  assert.equal(count(bare, /m-weather__line/g), 0);
});

test('the days are a list of up to four, each item holding its sentence as hidden text, with its name, icon and value hidden', () => {
  const value = hero('today', 'night'), html = draw(WeatherChart, value, 'night');
  assert.equal(value.days.length, 4);
  assert.match(html, /^<ul class="m-weather-days" role="list">(?:<li [^>]*>.*?<\/li>){4}<\/ul>$/);
  // No aria-label over hidden children, which some readers read as empty: the sentence is the item's own text.
  assert.doesNotMatch(html, /aria-label/);
  const items = [...html.matchAll(/<li class="m-weather-days__day"><span class="m-weather-days__label">([^<]*)<\/span>(.*?)<\/li>/g)];
  assert.deepEqual(items.map(item => item[1]), value.days.map(day => escaped(day.ariaLabel)));
  items.forEach(([, , inner], i) => {
    const day = value.days[i], [digits] = day.value.split('°');
    assert.match(inner, new RegExp(`^<span class="m-weather-days__name" aria-hidden="true">${day.name}</span>`));
    assert.match(inner, new RegExp(`<span class="m-glyph m-weather-days__icon m-weather-days__icon--${day.icon}" aria-hidden="true">`));
    assert.match(inner, new RegExp(`<span class="m-weather-days__value" aria-hidden="true">${digits}<span class="m-weather__degree">°</span></span>$`));
  });
  // Never more than four, and a day without an icon or value keeps its column, drawn as missing.
  const many = draw(WeatherChart, {...value, days: [...value.days, {...value.days[0], name: 'Fri'}, {name: 'Sat', icon: null, value: '—', ariaLabel: 'Saturday'}]});
  assert.equal(count(many, /<li /g), 4);
  const gap = draw(WeatherChart, {...value, days: [{name: 'Sat', icon: null, value: '—', ariaLabel: 'Saturday'}]});
  assert.match(gap, /<span class="m-weather-days__icon" aria-hidden="true"><\/span><span class="m-weather-days__value m-weather-days__value--missing" aria-hidden="true">—<\/span>/);
});

test('without a forecast there is no days list at all', () => {
  for (const days of [[], undefined]) assert.equal(draw(WeatherChart, {...hero('today', 'day'), days}), '');
});

test('unavailable weather draws "—" and its condition as missing, with no icon, no line and no days', () => {
  const value = hero('today', 'unavailable'), html = draw(WeatherReading, value, 'unknown');
  assert.equal(value.temperature, '—');
  assert.match(html, /^<div class="m-weather m-weather--missing" data-layout="phone">/);
  assert.match(html, /<span class="m-weather__temp m-weather__temp--missing" aria-hidden="true">—<\/span>/, 'no hanging degree on a dash');
  assert.match(html, /<p class="m-weather__condition">Weather unavailable<\/p><\/div>/);
  assert.equal(count(html, /m-glyph|m-weather__line|°/g), 0);
  assert.equal(draw(WeatherChart, value, 'unknown'), '');
  // The stylesheet dims both, so neither reads as a reading.
  assert.match(weatherChartStyles, /\.m-weather--missing \.m-weather__temp,\.m-weather--missing \.m-weather__condition\{color:var\(--m-label-2\)\}/);
});

test('the weather’s stylesheet: the display figure tabular, the days on the scrim at radius 22 with no blur', () => {
  assert.match(weatherChartStyles, /\.m-weather__temp\{[^}]*font:var\(--m-type-display\);font-variant-numeric:tabular-nums/);
  assert.match(weatherChartStyles, /\.m-weather-days\{[^}]*border-radius:22px;background:var\(--m-sky-scrim\)/);
  assert.doesNotMatch(weatherChartStyles, /backdrop-filter|filter:/);
  assert.match(weatherChartStyles, /\.m-weather-days__icon\{width:24px;height:24px\}/);
  // The sentences are visually hidden, each inside its own positioned box.
  assert.match(weatherChartStyles, /\.m-weather__label,\.m-weather-days__label\{position:absolute;width:1px;height:1px;[^}]*clip-path:inset\(50%\)/);
  assert.match(weatherChartStyles, /\.m-weather-days__day\{position:relative;/);
});

// Each Car variant's markup, as the hero draws it over its sky.
const car = (variant, phase = 'day', layout = 'phone') => draw(CarChart, hero('car', variant), phase, layout);

test('the Car is an image named by its value, in a 340×160 viewBox, its body by day or night', () => {
  for (const variant of HERO_VARIANTS.car) {
    const value = hero('car', variant), html = draw(CarChart, value);
    assert.match(html, new RegExp(`^<svg class="m-car[^"]*" viewBox="0 0 340 160" role="img" aria-label="${escaped(value.ariaLabel)}">`), variant);
    assert.equal(count(html, /<text/g), 0, 'no text in the image');
    assert.match(html, /<g transform="translate\(46 44\) scale\(3\.5\)"><path class="m-car__body"[^>]*><\/path><path class="m-car__window"/);
    assert.equal(count(html, /class="m-car__tyre"/g), 2);
    // Each tyre sits in a well filling its arch's upper half (r 6), so no ring of sky shows around it.
    assert.deepEqual([...html.matchAll(/<path class="m-car__well" d="([^"]+)"><\/path><circle class="m-car__tyre" cx="(\d+)"/g)].map(m => [m[1], m[2]]),
      [['M10 22A6 6 0 0 1 22 22Z', '16'], ['M49 22A6 6 0 0 1 61 22Z', '55']]);
    assert.equal(count(html, /<ellipse cx="170" cy="139" rx="140" ry="12" fill="url\(#[^)]+\)"><\/ellipse>/g), 1, 'the shadow');
    assert.doesNotMatch(html, /(?:fill|stroke|stop-color)="(?!url\()/, 'colours come from tokens, never attributes');
  }
  assert.deepEqual(PHASES.map(phase => car('solar', phase).match(/^<svg class="m-car m-car--(day|night)/)[1]), ['night', 'night', 'day', 'night'],
    'day is day; twilight and unknown are night');
});

test('the cable is drawn only while plugged in, and its glow only while charging, in its source’s class', () => {
  const cable = /<path class="m-car__cable" d="M-120 132H-4C32 132 54 116 67 90" stroke="url\(#[^)]+\)"><\/path>/;
  const unplugged = car('unplugged'), waiting = car('waiting'), solar = car('solar'), offpeak = car('offpeak', 'night');
  assert.doesNotMatch(unplugged, /m-car__cable|m-car__glow|m-car__flow|<mask/);
  assert.match(waiting, cable);
  assert.doesNotMatch(waiting, /m-car__glow|m-car__flow|m-car__halo/, 'plugged in but waiting: no glow');
  assert.match(solar, /<g class="m-car__glow m-car__glow--solar"><path class="m-car__halo" d="[^"]+"><\/path><path class="m-car__cable"[^>]*><\/path><path class="m-car__flow" d="[^"]+"><\/path><\/g>/);
  assert.match(solar, /<linearGradient id="[^"]+" class="m-car__glow m-car__glow--solar"/, 'the gradient’s stops take the tint too');
  assert.doesNotMatch(waiting, /<linearGradient id="[^"]+" class=/);
  assert.match(offpeak, /class="m-car__glow m-car__glow--grid"/);
  assert.doesNotMatch(offpeak, /m-car__glow--solar/);
  // A source only for a Car plugged in and charging.
  assert.doesNotMatch(draw(CarChart, {...hero('car', 'waiting'), plot: {plugged: true, charging: false, source: 'solar', available: true}}), /m-car__glow/);
  assert.match(carChartStyles, /\.m-car__glow--solar\{color:var\(--m-yellow\)\}/);
  assert.match(carChartStyles, /\.m-car__glow--grid\{color:var\(--m-indigo-text\)\}/);
  assert.match(carChartStyles, /\.m-car__stop\{stop-color:var\(--m-car-cable\)\}/);
  assert.match(carChartStyles, /\.m-car__glow \.m-car__stop\{stop-color:color-mix\(in srgb,currentColor 45%,var\(--m-car-cable\)\)\}/);
  // Without color-mix() the var() inside it is invalid at computed-value time, and the stops would turn black.
  assert.match(carChartStyles, /@supports not \(color:color-mix\([^)]*\)\)\{\.m-car__glow \.m-car__stop\{stop-color:var\(--m-car-cable\)\}\}/);
});

test('nothing animated is masked: the cable fades by its gradient stroke, and the halo and dashes start where it is opaque', () => {
  for (const layout of ['phone', 'wide', 'desktop']) for (const variant of HERO_VARIANTS.car) {
    const html = car(variant, 'day', layout);
    assert.doesNotMatch(html, /<mask|mask=/, `${variant} ${layout}`);
    assert.doesNotMatch(html, /<g[^>]*(?:mask|filter|clip-path)=[^>]*>(?:(?!<\/g>).)*m-car__flow/, 'no masked, filtered or clipped group around the dashes');
  }
});

// The cable's path, the glow's (the dashes'), the x range its gradient fades over, and the shadow's left end, in a Car's markup.
const lay = html => ({d: html.match(/<path class="m-car__cable" d="([^"]+)"/)?.[1] ?? null, glow: html.match(/<path class="m-car__flow" d="([^"]+)"/)?.[1] ?? null,
  fade: html.match(/<linearGradient id="[^"]+"[^>]* gradientUnits="userSpaceOnUse" x1="(-?[\d.]+)" y1="0" x2="(-?[\d.]+)"/)?.slice(1).map(Number) ?? null,
  shadow: (([cx, cy, rx]) => [cx - rx, cy])(html.match(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)"/).slice(1).map(Number))});

// A cubic Bézier's point at t, and the t where its x is `x` (x rising along it).
const bezier = (P, t) => [0, 1].map(i => (1 - t) ** 3 * P[0][i] + 3 * (1 - t) ** 2 * t * P[1][i] + 3 * (1 - t) * t * t * P[2][i] + t ** 3 * P[3][i]);
const atX = (P, x) => { let [lo, hi] = [0, 1]; for (let i = 0; i < 50; i += 1) { const mid = (lo + hi) / 2; if (bezier(P, mid)[0] < x) lo = mid; else hi = mid; } return lo; };

test('on a phone the cable comes from far beyond the chart’s edge; wider, it lies on the ground from the shadow’s end, fading in inside it', () => {
  // A phone chart is 470px at most and centred, so at 699px its left edge is 114.5px in: -83 in the viewBox.
  const edge = -((699 - 470) / 2) * 340 / 470;
  for (const variant of ['waiting', 'solar']) {
    const phone = lay(car(variant, 'day', 'phone'));
    assert.equal(phone.d, 'M-120 132H-4C32 132 54 116 67 90', 'the concept’s curve with a long lead-in from off the edge');
    assert.deepEqual(phone.fade, [-120, -100]);
    assert.ok(phone.fade[1] < edge, 'the fade lies beyond any phone’s edge, so the cable is solid where the hero clips it');
    for (const layout of ['wide', 'desktop']) {
      const ground = lay(car(variant, 'day', layout));
      assert.equal(ground.d, 'M30 139H34C40 139 43 134 44 124C45 108 50 91 67 90', layout);
      assert.deepEqual(ground.d.match(/^M(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number), ground.shadow, 'it starts at the shadow’s left end, on the ground');
      assert.ok(ground.fade[0] === ground.shadow[0] && ground.fade[1] > ground.fade[0] && ground.fade[1] < 170, 'and fades in only inside the shadow');
      assert.match(ground.d, / 67 90$/, 'into the port');
    }
  }
  // The glow follows the cable from where its fade ends: on the phone's flat lead-in, and wider on the ground cable's first curve.
  const phone = lay(car('solar', 'day', 'phone')), ground = lay(car('solar', 'day', 'desktop'));
  assert.equal(phone.glow, phone.d.replace(/^M-?[\d.]+/, `M${phone.fade[1]}`));
  const [, x, y, tail] = ground.glow.match(/^M(-?[\d.]+) (-?[\d.]+)C[^C]*(C.*)$/);
  assert.equal(Number(x), ground.fade[1]);
  const curve = [[34, 139], [40, 139], [43, 134], [44, 124]];
  assert.ok(ground.d.includes(`H34C40 139 43 134 44 124${tail}`), 'the same curve on to the port');
  assert.ok(Math.abs(bezier(curve, atX(curve, Number(x)))[1] - Number(y)) < 0.05, 'starting on the cable');
  assert.equal(lay(car('unplugged', 'day', 'desktop')).d, null);
});

test('the port’s LED is green and pulsing only while charging, off otherwise, and gone with the Charger', () => {
  const led = html => html.match(/<circle class="(m-car__led[^"]*)" cx="67" cy="90" r="3"><\/circle>/)?.[1] ?? null;
  assert.deepEqual(['unplugged', 'waiting', 'solar', 'offpeak', 'unavailable'].map(variant => led(car(variant))),
    ['m-car__led', 'm-car__led', 'm-car__led m-car__led--on', 'm-car__led m-car__led--on', null]);
  assert.match(carChartStyles, /\.m-car__led\{fill:var\(--m-car-led-off\)\}/);
  assert.match(carChartStyles, /\.m-car__led--on\{fill:var\(--m-green\);animation:m-car-pulse /);
});

test('with the Charger offline the Car is dimmed, with no cable and no LED', () => {
  const value = hero('car', 'unavailable'), html = draw(CarChart, value, 'unknown');
  assert.equal(value.plot.available, false);
  assert.match(html, /^<svg class="m-car m-car--night m-car--offline"/);
  assert.doesNotMatch(html, /m-car__cable|m-car__glow|m-car__led/);
  // Even were it reported plugged in and charging.
  assert.doesNotMatch(draw(CarChart, {...value, plot: {plugged: true, charging: true, source: 'solar', available: false}}), /m-car__cable|m-car__glow|m-car__led/);
  assert.match(carChartStyles, /\.m-car--offline \.m-car__car\{opacity:\.5\}/);
});

test('two Cars in one document keep their own gradient ids, and each reference stays inside its Car', () => {
  const html = renderToStaticMarkup(h(Fragment, null, h(CarChart, {value: hero('car', 'solar'), phase: 'day', layout: 'phone'}),
    h(CarChart, {value: hero('car', 'offpeak'), phase: 'night', layout: 'phone'})));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 4, 'a shadow and a fade in each');
  assert.equal(new Set(ids).size, ids.length);
  for (const svg of html.split('</svg>').filter(Boolean)) {
    const own = new Set([...svg.matchAll(/ id="([^"]+)"/g)].map(match => match[1]));
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(own.has(ref), `url(#${ref}) is this Car's`);
  }
});

test('the Car’s motion stops under reduced motion', () => {
  assert.match(carChartStyles, /\.m-car__flow\{[^}]*animation:m-car-flow /);
  assert.match(carChartStyles, /@media \(prefers-reduced-motion:reduce\)\{\.m-car__flow,\.m-car__led--on\{animation:none\}\}/);
  assert.match(carChartStyles, /@keyframes m-car-flow\{to\{stroke-dashoffset:-10\}\}/, 'dashes move toward the port, the path’s end');
});
