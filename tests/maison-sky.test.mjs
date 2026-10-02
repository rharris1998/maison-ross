// Maison's sky (#29 step 3): what sky.js's skyValue() reads from
// sun.sun and weather.forecast_home, and how screen() hands it over as
// chrome.sky on every page. Every condition, the sun or the weather missing,
// and the cloud cover. How the sky is painted is in maison-sky-paint.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {E} from '../config/www/maison/model.js';
import {skyValue} from '../config/www/maison/sky.js';
import {screen, words, PAGE_IDS} from '../config/www/maison/screen.js';
import {SKY_FIXTURES} from '../frontend/maison/fixtures/sky-fixtures.js';
import {skySnapshot} from '../frontend/maison/src/gallery-snapshots.js';

const state = (value, attributes = {}) => ({state: String(value), attributes});
const SUN = state('above_horizon', {elevation: 24.5, azimuth: 201.3, rising: false});
// The sky under `condition` (a weather state, or undefined for none) and `sun` (null for none).
const sky = (condition, {sun = SUN, coverage} = {}) => skyValue({
  ...(sun === null ? {} : {[E.sun]: sun}),
  ...(condition === undefined ? {} : {[E.weather]: state(condition, coverage === undefined ? {temperature: 14} : {temperature: 14, cloud_coverage: coverage})}),
});
const weatherOf = ({kind, plot: {fall, storm, wind}}) => ({kind, fall, storm, wind});
const sunOf = ({plot: {elevation, azimuth, rising}}) => ({elevation, azimuth, rising});
const NO_WEATHER = {kind: 'unknown', fall: null, storm: false, wind: false};
const NO_SUN = {elevation: null, azimuth: null, rising: null};
const deepFreeze = value => {if (value && typeof value === 'object') {Object.values(value).forEach(deepFreeze); Object.freeze(value);} return value;};

// ---- The weather -----------------------------------------------------------------------
test('each of Home Assistant’s 15 weather conditions is a kind, with its fall, storm and wind', () => {
  const clear = {fall: null, storm: false, wind: false};
  const CONDITIONS = {
    'clear-night': {kind: 'clear', ...clear}, sunny: {kind: 'clear', ...clear},
    partlycloudy: {kind: 'partly', ...clear},
    cloudy: {kind: 'cloudy', ...clear}, exceptional: {kind: 'cloudy', ...clear},
    fog: {kind: 'fog', ...clear},
    rainy: {kind: 'cloudy', ...clear, fall: 'rain'}, pouring: {kind: 'cloudy', ...clear, fall: 'rain'},
    lightning: {kind: 'cloudy', ...clear, storm: true}, 'lightning-rainy': {kind: 'cloudy', fall: 'rain', storm: true, wind: false},
    snowy: {kind: 'cloudy', ...clear, fall: 'snow'}, 'snowy-rainy': {kind: 'cloudy', ...clear, fall: 'snow'},
    hail: {kind: 'cloudy', ...clear, fall: 'hail'},
    windy: {kind: 'partly', ...clear, wind: true}, 'windy-variant': {kind: 'cloudy', ...clear, wind: true},
  };
  assert.equal(Object.keys(CONDITIONS).length, 15);
  for (const [condition, expected] of Object.entries(CONDITIONS)) {
    assert.deepEqual(weatherOf(sky(condition)), expected, condition);
    assert.deepEqual(sunOf(sky(condition)), {elevation: 24.5, azimuth: 201.3, rising: false}, `${condition}: the sun is read beside it`);
  }
});

test('a missing, unavailable, unknown or unrecognised weather is the unknown sky, and the sun is still read', () => {
  for (const [name, condition] of [['missing', undefined], ['unavailable', 'unavailable'], ['unknown', 'unknown'], ['empty', ''],
    ['unrecognised', 'drizzle'], ['an Object key', 'constructor']]) {
    const value = sky(condition, {coverage: 70});
    assert.deepEqual(weatherOf(value), NO_WEATHER, name);
    assert.deepEqual(sunOf(value), {elevation: 24.5, azimuth: 201.3, rising: false}, name);
  }
  assert.equal(sky('unavailable', {coverage: 70}).plot.coverage, null, 'an unavailable weather reports no cover');
  assert.deepEqual(skyValue({}), {kind: 'unknown', plot: {...NO_SUN, coverage: null, fall: null, storm: false, wind: false}});
  assert.deepEqual(skyValue(undefined), skyValue({}), 'no states at all');
});

// ---- The sun ---------------------------------------------------------------------------
test('the sun’s elevation, azimuth and rising come from sun.sun, above or below the horizon', () => {
  assert.deepEqual(sunOf(sky('sunny')), {elevation: 24.5, azimuth: 201.3, rising: false});
  assert.deepEqual(sunOf(sky('clear-night', {sun: state('below_horizon', {elevation: -30.2, azimuth: 297, rising: false})})),
    {elevation: -30.2, azimuth: 297, rising: false});
  assert.deepEqual(sunOf(sky('partlycloudy', {sun: state('below_horizon', {elevation: '-3', azimuth: '88.5', rising: true})})),
    {elevation: -3, azimuth: 88.5, rising: true}, 'numbers reported as strings still read');
});

test('a missing or unavailable sun, or one with non-numeric attributes, gives nulls, and the weather is still read', () => {
  const cases = [
    ['missing', null],
    ['unavailable', state('unavailable', {elevation: 20, azimuth: 180, rising: true})],
    ['unknown', state('unknown', {elevation: 20, azimuth: 180, rising: true})],
    ['without attributes', {state: 'above_horizon'}],
    ['with empty attributes', state('above_horizon')],
    ['with non-numeric attributes', state('above_horizon', {elevation: 'high', azimuth: 'unknown', rising: 'yes'})],
    ['with null attributes', state('above_horizon', {elevation: null, azimuth: {}, rising: null})],
  ];
  for (const [name, sun] of cases) {
    const value = sky('rainy', {sun, coverage: 100});
    assert.deepEqual(sunOf(value), NO_SUN, name);
    assert.deepEqual(weatherOf(value), {kind: 'cloudy', fall: 'rain', storm: false, wind: false}, name);
    assert.equal(value.plot.coverage, 100, name);
  }
  // Each attribute stands alone: a bad one doesn't blank the others.
  assert.deepEqual(sunOf(sky('sunny', {sun: state('above_horizon', {elevation: 12, azimuth: 'n/a', rising: 1})})), {elevation: 12, azimuth: null, rising: null});
});

// ---- The cloud cover -------------------------------------------------------------------
test('the weather’s cloud cover passes through, clamped to 0–100, and is null when it isn’t reported', () => {
  for (const [coverage, expected] of [[0, 0], [45, 45], [100, 100], [62.5, 62.5], ['80', 80], [-5, 0], [130, 100],
    [undefined, null], [null, null], ['unknown', null], ['', null], ['lots', null]]) {
    assert.equal(sky('partlycloudy', {coverage}).plot.coverage, expected, String(coverage));
  }
  assert.equal(sky('drizzle', {coverage: 40}).plot.coverage, 40, 'an unrecognised condition still reports its cover');
  assert.equal(sky(undefined).plot.coverage, null, 'no weather, no cover');
});

// ---- The value's shape -----------------------------------------------------------------
test('the sky is exactly {kind, plot} with the plot’s seven fields, fresh on every call, and never changes the states', () => {
  const states = deepFreeze({[E.sun]: SUN, [E.weather]: state('lightning-rainy', {cloud_coverage: 100})});
  const value = skyValue(states);
  assert.deepEqual(Object.keys(value), ['kind', 'plot']);
  assert.deepEqual(Object.keys(value.plot), ['elevation', 'azimuth', 'rising', 'coverage', 'fall', 'storm', 'wind']);
  assert.deepEqual(value, {kind: 'cloudy', plot: {elevation: 24.5, azimuth: 201.3, rising: false, coverage: 100, fall: 'rain', storm: true, wind: false}});
  assert.deepEqual(Object.keys(skyValue({}).plot), Object.keys(value.plot), 'the unknown sky has the same shape');
  assert.notEqual(skyValue({}), skyValue({}));
  assert.notEqual(skyValue({}).plot, skyValue({}).plot);
  skyValue({}).plot.elevation = 5;
  assert.equal(skyValue({}).plot.elevation, null, 'changing one sky leaves the next alone');
});

// ---- The fixtures and screen() ---------------------------------------------------------
test('each sky fixture reads as the sky it is named for', () => {
  const EXPECTED = {
    night: ['clear', -30, null], 'night-cloudy': ['cloudy', -30, null], dawn: ['partly', -3, null], noon: ['clear', 38, null],
    'afternoon-cloudy': ['cloudy', 25, null], rain: ['cloudy', 20, 'rain'], storm: ['cloudy', 12, 'rain'], snow: ['cloudy', 10, 'snow'],
    fog: ['fog', 4, null], dusk: ['partly', -2, null], unknown: ['unknown', null, null],
  };
  assert.deepEqual(SKY_FIXTURES.map(f => f.id), Object.keys(EXPECTED));
  for (const f of SKY_FIXTURES) {
    const {kind, plot} = skyValue(f.states);
    assert.deepEqual([kind, plot.elevation, plot.fall], EXPECTED[f.id], f.id);
    assert.equal(plot.storm, f.id === 'storm', f.id);
  }
  const dawn = skyValue(SKY_FIXTURES.find(f => f.id === 'dawn').states).plot, dusk = skyValue(SKY_FIXTURES.find(f => f.id === 'dusk').states).plot;
  assert.deepEqual([dawn.rising, dusk.rising], [true, false], 'dawn rises, dusk sets');
  assert.deepEqual(skyValue(SKY_FIXTURES.find(f => f.id === 'unknown').states), skyValue({}), 'no sun and the weather unavailable is the unknown sky');
});

test('screen() gives chrome.sky on every page, from the snapshot’s states', () => {
  for (const f of SKY_FIXTURES) for (const page of PAGE_IDS) {
    assert.deepEqual(screen(skySnapshot(f.id, page)).chrome.sky, skyValue(f.states), `${f.id} on ${page}`);
  }
});

test('the sky adds no visible wording', () => {
  for (const f of SKY_FIXTURES) {
    assert.deepEqual(words({sky: skyValue(f.states)}), [], f.id);
    assert.deepEqual(words({sky: screen(skySnapshot(f.id)).chrome.sky}), [], `${f.id} through screen()`);
  }
  assert.deepEqual(words({sky: skyValue({})}), []);
});

test('skyValue never reads the clock', () => {
  const RealDate = Date, stop = () => {throw new Error('skyValue read the clock');};
  class NoClock extends RealDate {constructor(...args) {if (!args.length) stop(); super(...args);}}
  NoClock.now = stop;
  globalThis.Date = NoClock;
  try {
    for (const f of SKY_FIXTURES) skyValue(f.states);
    for (const condition of [undefined, 'unavailable', 'sunny', 'drizzle']) for (const sun of [null, SUN, state('unavailable')]) sky(condition, {sun, coverage: 50});
  } finally {globalThis.Date = RealDate;}
});
