// Maison's header (#29 step 3): each page's header builder (todayHeader,
// climateHeader, energyHeader, carHeader) over the fixtures and the
// gallery's hero variants. Each takes the snapshot only and gives the line
// under the title and the header chart as plain values: their words are what
// the charts draw, unavailable reads '—' and is never 0, nothing reads the
// clock and nothing can be pressed. How the frame and the charts draw them is
// in maison-frame and maison-charts-*.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {E, ZONES, HOUSE, TOWEL_RAILS} from '../config/www/maison/model.js';
import {todayHeader} from '../config/www/maison/today.js';
import {climateHeader, houseStatus} from '../config/www/maison/climate.js';
import {energyHeader} from '../config/www/maison/energy.js';
import {carHeader, carStatus, chargeSource, CHARGE_SOURCE, SOLAR_ACTIVE_W} from '../config/www/maison/car.js';
import {screen, controls, words, PAGE_IDS} from '../config/www/maison/screen.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {TODAY_FIXTURES, TODAY_NOW} from '../frontend/maison/fixtures/today-fixtures.js';
import {SKY_FIXTURES, SKY_FORECAST} from '../frontend/maison/fixtures/sky-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {heroSnapshot, skySnapshot, HERO_VARIANTS} from '../frontend/maison/src/gallery-snapshots.js';

const HEADERS = {today: todayHeader, climate: climateHeader, energy: energyHeader, car: carHeader};
const KINDS = {today: 'weather', climate: 'zones', energy: 'flows', car: 'car'};
const byId = (fixtures, id) => fixtures.find(f => f.id === id);
const state = (entity_id, value, attributes = {}) => ({entity_id, state: String(value), attributes});
const watts = (id, value) => state(id, value, {unit_of_measurement: 'W'});
const sun = elevation => state(E.sun, elevation > 0 ? 'above_horizon' : 'below_horizon', {elevation, azimuth: 180, rising: false});
const car = f => fixtureSnapshot({states: structuredClone(f.states), now: CAR_NOW, carLast: f.last ?? null, route: {page: 'car'}});
// A snapshot of `states` at `now` with the daily `forecasts` loaded.
const withForecast = (states, forecasts, extra = {}) => fixtureSnapshot({states, loaded: {forecasts}, ...extra});
// A weather reading at Monday 28 September, 21:04 in Brussels (the night sky).
const NIGHT = byId(SKY_FIXTURES, 'night-cloudy');
const weather = (condition, temperature = 18) => ({[E.weather]: state(E.weather, condition, {temperature})});
const forecast = (iso, condition, temperature) => ({datetime: iso, condition, temperature});
// Every string in a value, accessible names included.
const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const ZERO = /(?<![\d.,])0(?:[.,]0+)?\s?(?:°|%|W|kW|kWh|€)(?!\w)/;

// Replaces Date while `run` runs, so that reading the clock, by Date.now() or
// by a Date made from nothing, throws (as maison-screen.test.mjs does).
function withoutClock(run) {
  const RealDate = Date, stop = () => {throw new Error('a header read the clock');};
  class NoClock extends RealDate {constructor(...args) {if (!args.length) stop(); super(...args);}}
  NoClock.now = stop;
  globalThis.Date = NoClock;
  try {run();} finally {globalThis.Date = RealDate;}
}
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {Object.freeze(value); Object.values(value).forEach(deepFreeze);}
  return value;
};
// Every snapshot the headers are checked over: each gallery hero variant, each
// sky alone, each page fixture, and nothing at all.
const everySnapshot = () => [
  ...Object.entries(HERO_VARIANTS).flatMap(([page, variants]) => variants.map(v => [`hero ${page}/${v}`, heroSnapshot(page, v)])),
  ...SKY_FIXTURES.map(f => [`sky ${f.id}`, skySnapshot(f.id)]),
  ...CAR_FIXTURES.map(f => [`car ${f.id}`, car(f)]),
  ...TODAY_FIXTURES.map(f => [`today ${f.id}`, fixtureSnapshot({states: structuredClone(f.states), now: TODAY_NOW, loaded: {forecasts: structuredClone(f.forecasts)}})]),
  ...HOME_FIXTURES.map(f => [`home ${f.id}`, fixtureSnapshot({states: structuredClone(f.states), now: HOME_NOW})]),
  ...CLIMATE_FIXTURES.map(f => [`climate ${f.id}`, fixtureSnapshot({states: structuredClone(f.states)})]),
  ['nothing', fixtureSnapshot()], ['nothing, offline', fixtureSnapshot({online: false})],
];

// ---- Every header ----------------------------------------------------------------
test('each header takes the snapshot only and gives its line and chart as plain data, never reading the clock', () => {
  withoutClock(() => {
    for (const [where, snap] of everySnapshot()) {
      const before = JSON.stringify(snap);
      deepFreeze(snap);
      for (const [page, header] of Object.entries(HEADERS)) {
        assert.equal(header.length, 1, `${page}: the snapshot is its only argument`);
        const value = header(snap);
        assert.deepEqual(Object.keys(value), ['line', 'hero'], `${where} ${page}`);
        assert.ok(value.line === null || (typeof value.line === 'string' && value.line), `${where} ${page}: a line or none`);
        assert.equal(value.hero.kind, KINDS[page], `${where} ${page}`);
        assert.deepEqual(structuredClone(value), value, `${where} ${page}: plain data`);
        assert.deepEqual(header(snap), value, `${where} ${page}: the same snapshot, the same header`);
        assert.deepEqual(controls(value), [], `${where} ${page}: a reading, nothing to press`);
        assert.equal(typeof value.hero.ariaLabel, 'string', `${where} ${page}: named`);
      }
      assert.equal(JSON.stringify(snap), before, where);
    }
  });
});

test('screen() puts each page’s header in the chrome; Home status has none', () => {
  for (const [page, variants] of Object.entries(HERO_VARIANTS)) for (const variant of variants) {
    const snap = heroSnapshot(page, variant), {line, hero} = screen(snap).chrome;
    assert.deepEqual({line, hero}, HEADERS[page](snap), `${page}/${variant}`);
  }
  for (const page of PAGE_IDS.filter(id => !Object.hasOwn(HEADERS, id))) {
    const {line, hero} = screen({...heroSnapshot('energy', 'solar-charging'), route: {page, detail: null, dialog: null}}).chrome;
    assert.deepEqual([line, hero], [null, null], page);
  }
  // A route to no page shows Today, header and all.
  const nowhere = {...heroSnapshot('today', 'day'), route: {page: 'nowhere', detail: null, dialog: null}};
  assert.deepEqual(screen(nowhere).chrome.hero, todayHeader(nowhere).hero);
});

test('with nothing in Home Assistant, no header shows 0 or a made-up reading', () => {
  for (const snap of [fixtureSnapshot(), fixtureSnapshot({now: HOME_NOW, online: false}), heroSnapshot('energy', 'unavailable')]) {
    const values = Object.values(HEADERS).map(header => header(snap));
    assert.doesNotMatch(strings(values).join('\n'), ZERO, 'no 0 anywhere, accessible names included');
    const [today, climate, energy, carValue] = values.map(v => v.hero);
    assert.deepEqual([today.temperature, today.condition, today.line, today.days, today.icon], ['—', 'Weather unavailable', null, [], null]);
    assert.deepEqual(climate.zones.map(z => [z.reading, z.plot.reading, z.plot.target]), Array(5).fill(['—', null, null]));
    assert.deepEqual(Object.values(energy.nodes).map(n => [n.value, n.plot.watts, n.plot.available, n.plot.active, n.plot.asleep]), Array(4).fill(['—', null, false, false, false]));
    assert.deepEqual([energy.reading.figure, energy.plot.links.map(l => l.source)], ['—', [null, null, null]]);
    assert.deepEqual(carValue.plot, {plugged: false, charging: false, source: null, available: false});
  }
});

// ---- Today: the weather ------------------------------------------------------------
test('Today’s hero is outside now, its condition, tomorrow and the next four days; Today has no line', () => {
  assert.deepEqual(todayHeader(heroSnapshot('today', 'day')), {line: null, hero: {kind: 'weather', icon: 'wx-sun', temperature: '24°', condition: 'Sunny', line: 'Tomorrow 17°',
    days: [{name: 'Today', icon: 'wx-sun', value: '24°', ariaLabel: 'Today: sunny, 24°'}, {name: 'Tue', icon: 'wx-rain', value: '17°', ariaLabel: 'Tuesday: rainy, 17°'},
      {name: 'Wed', icon: 'wx-partly', value: '20°', ariaLabel: 'Wednesday: partly cloudy, 20°'}, {name: 'Thu', icon: 'wx-cloud', value: '18°', ariaLabel: 'Thursday: cloudy, 18°'}],
    ariaLabel: 'Outside 24°, sunny. Tomorrow 17°.'}});
  const night = todayHeader(heroSnapshot('today', 'night')).hero;
  assert.deepEqual([night.icon, night.temperature, night.condition, night.line, night.ariaLabel], ['wx-cloud', '18°', 'Cloudy', 'Tomorrow 17°', 'Outside 18°, cloudy. Tomorrow 17°.']);
  // The weather card's own fixture: 17.4° rounds to 17°, and tomorrow's 14.6° to 15°.
  const quiet = byId(TODAY_FIXTURES, 'quiet');
  const hero = todayHeader(fixtureSnapshot({states: quiet.states, now: TODAY_NOW, loaded: {forecasts: quiet.forecasts}})).hero;
  assert.deepEqual([hero.temperature, hero.condition, hero.line, hero.days.map(d => d.name)], ['17°', 'Partly cloudy', 'Tomorrow 15°', ['Today', 'Mon', 'Tue', 'Wed']]);
});

test('Today’s words are what the weather draws: the temperature, condition, line and each day’s name and value', () => {
  for (const variant of HERO_VARIANTS.today) {
    const hero = todayHeader(heroSnapshot('today', variant)).hero;
    assert.deepEqual(words(hero), [hero.temperature, hero.condition, hero.line, ...hero.days.flatMap(d => [d.name, d.value])].filter(Boolean), variant);
  }
});

test('the days are grouped by local date in the house’s time zone, from today’s, at most four', () => {
  const forecasts = [forecast('2026-09-27T10:00:00Z', 'sunny', 30), forecast('2026-09-27T22:30:00Z', 'fog', 11), forecast('2026-09-28T10:00:00Z', 'rainy', 13),
    forecast('2026-09-29T10:00:00Z', 'cloudy', 16), forecast('2026-09-29T18:00:00Z', 'clear-night', 9), forecast('2026-09-30T10:00:00Z', 'hail', 12),
    forecast('2026-10-01T10:00:00Z', 'snowy', 2), forecast('2026-10-02T10:00:00Z', 'sunny', 21), forecast('not a date', 'sunny', 40), null, {condition: 'sunny'}];
  const days = tz => todayHeader(withForecast(weather('cloudy'), forecasts, {now: NIGHT.now, tz})).hero.days.map(d => `${d.name} ${d.icon} ${d.value}`);
  // 22:30 UTC on the 27th is 00:30 on the 28th in Brussels: today there, yesterday in UTC.
  assert.deepEqual(days('Europe/Brussels'), ['Today wx-fog 11°', 'Tue wx-cloud 16°', 'Wed wx-hail 12°', 'Thu wx-snow 2°']);
  assert.deepEqual(days('UTC'), ['Today wx-rain 13°', 'Tue wx-cloud 16°', 'Wed wx-hail 12°', 'Thu wx-snow 2°']);
  // In any order, the same days.
  assert.deepEqual(todayHeader(withForecast(weather('cloudy'), [...forecasts].reverse(), {now: NIGHT.now})).hero.days.map(d => d.value), ['11°', '16°', '12°', '2°']);
});

test('the first day is Today only on today’s date, and the line only comes from tomorrow’s', () => {
  const at = (forecasts, now = NIGHT.now) => todayHeader(withForecast(weather('cloudy'), forecasts, {now})).hero;
  const later = at(SKY_FORECAST.slice(1));
  assert.deepEqual([later.days.map(d => d.name), later.line], [['Tue', 'Wed', 'Thu'], 'Tomorrow 17°'], 'the forecast starts tomorrow');
  const after = at(SKY_FORECAST.slice(2));
  assert.deepEqual([after.days.map(d => d.name), after.line, after.ariaLabel], [['Wed', 'Thu'], null, 'Outside 18°, cloudy.'], 'nothing for tomorrow');
  const unknown = at([SKY_FORECAST[0], {...SKY_FORECAST[1], temperature: 'unavailable'}]);
  assert.deepEqual([unknown.line, unknown.days[1]], [null, {name: 'Tue', icon: 'wx-rain', value: '—', ariaLabel: 'Tuesday: rainy'}], 'tomorrow without a temperature');
  assert.deepEqual(at([]).days, [], 'no forecast: no days, and no humidity or wind in their place');
  // Tomorrow is the next date on the calendar, even on the 23-hour day the clocks go forward:
  // 23:30 on Saturday 28 March is 22:30 UTC, and 24 hours on is already Monday.
  const spring = at([forecast('2026-03-28T11:00:00Z', 'sunny', 12), forecast('2026-03-29T10:00:00Z', 'rainy', 9), forecast('2026-03-30T10:00:00Z', 'sunny', 15)], Date.parse('2026-03-28T23:30:00+01:00'));
  assert.deepEqual([spring.days.map(d => d.name), spring.line], [['Today', 'Sun', 'Mon'], 'Tomorrow 9°']);
});

test('each of Home Assistant’s conditions has its icon; partly cloudy at night is for now only', () => {
  const ICONS = {sunny: 'wx-sun', 'clear-night': 'wx-moon', partlycloudy: 'wx-partly', cloudy: 'wx-cloud', exceptional: 'wx-cloud', rainy: 'wx-rain', pouring: 'wx-rain',
    snowy: 'wx-snow', 'snowy-rainy': 'wx-snow', fog: 'wx-fog', lightning: 'wx-storm', 'lightning-rainy': 'wx-storm', windy: 'wx-wind', 'windy-variant': 'wx-wind', hail: 'wx-hail'};
  for (const [condition, icon] of Object.entries(ICONS)) {
    const hero = todayHeader(withForecast({...weather(condition), [E.sun]: sun(30)}, [forecast('2026-09-28T10:00:00Z', condition, 20)], {now: NIGHT.now})).hero;
    assert.deepEqual([hero.icon, hero.days[0].icon], [icon, icon], condition);
  }
  // A condition Home Assistant doesn't list has no icon, and isn't named in a day.
  const odd = todayHeader(withForecast(weather('meteor-shower'), [forecast('2026-09-28T10:00:00Z', 'meteor-shower', 20)], {now: NIGHT.now})).hero;
  assert.deepEqual([odd.icon, odd.condition, odd.days[0]], [null, 'Meteor-shower', {name: 'Today', icon: null, value: '20°', ariaLabel: 'Today: 20°'}]);
  // Partly cloudy with the sun below the horizon: the night icon now, the day icon for the days.
  for (const id of ['dawn', 'dusk']) {
    const hero = todayHeader({...skySnapshot(id), loaded: {forecasts: [forecast('2026-09-28T10:00:00Z', 'partlycloudy', 20)]}}).hero;
    assert.deepEqual([hero.icon, hero.days[0].icon], ['wx-partly-night', 'wx-partly'], id);
  }
  for (const states of [{...weather('partlycloudy'), [E.sun]: sun(12)}, weather('partlycloudy'), {...weather('partlycloudy'), [E.sun]: state(E.sun, 'unavailable')}])
    assert.equal(todayHeader(fixtureSnapshot({states})).hero.icon, 'wx-partly');
});

test('each of Home Assistant’s conditions has a name, never a slug', () => {
  const CONDITIONS = ['clear-night', 'cloudy', 'exceptional', 'fog', 'hail', 'lightning', 'lightning-rainy', 'partlycloudy', 'pouring', 'rainy', 'snowy', 'snowy-rainy', 'sunny', 'windy', 'windy-variant'];
  const names = Object.fromEntries(CONDITIONS.map(condition => {
    const hero = todayHeader(withForecast(weather(condition), [forecast('2026-09-28T10:00:00Z', condition, 20)], {now: NIGHT.now})).hero;
    assert.equal(hero.days[0].ariaLabel, `Today: ${hero.condition.toLowerCase()}, 20°`, condition);
    return [condition, hero.condition];
  }));
  for (const [condition, name] of Object.entries(names)) assert.match(name, /^[A-Z][a-z ]+$/, `${condition}: ${name}`);
  assert.deepEqual([names['windy-variant'], names['snowy-rainy'], names['lightning-rainy'], names['clear-night'], names.partlycloudy],
    ['Windy and cloudy', 'Sleet', 'Thunderstorms', 'Clear night', 'Partly cloudy']);
});

test('while the weather is unavailable, Today’s hero says so, with no days and no line', () => {
  const unavailable = {kind: 'weather', icon: null, temperature: '—', condition: 'Weather unavailable', line: null, days: [], ariaLabel: 'Weather unavailable.'};
  assert.deepEqual(todayHeader(heroSnapshot('today', 'unavailable')), {line: null, hero: unavailable});
  for (const states of [{}, {[E.weather]: state(E.weather, 'unknown', {temperature: 18})}, {[E.weather]: state(E.weather, 'unavailable')}])
    assert.deepEqual(todayHeader(withForecast(states, SKY_FORECAST, {now: NIGHT.now})).hero, unavailable, JSON.stringify(states));
  // A condition without a temperature leaves the temperature out.
  const cold = todayHeader(fixtureSnapshot({states: {[E.weather]: state(E.weather, 'cloudy', {temperature: 'unknown'})}})).hero;
  assert.deepEqual([cold.temperature, cold.condition, cold.ariaLabel], ['—', 'Cloudy', 'Outside: cloudy.']);
});

// ---- Climate: the zone capsules --------------------------------------------------------
test('Climate’s hero is the house, then each zone by its short name, with its reading and target', () => {
  assert.deepEqual(climateHeader(heroSnapshot('climate', 'running')), {line: 'Warming', hero: {kind: 'zones', min: 14, max: 26,
    zones: [{id: 'house', name: 'Living', reading: '19.6°', plot: {reading: 19.6, target: 20}, ariaLabel: 'Living: 19.6°, target 20°'},
      {id: 'attic', name: 'Attic', reading: '19.8°', plot: {reading: 19.8, target: 21}, ariaLabel: 'Attic: 19.8°, target 21°'},
      {id: 'sam', name: 'Sam', reading: '19.2°', plot: {reading: 19.2, target: 20}, ariaLabel: 'Sam: 19.2°, target 20°'},
      {id: 'noah', name: 'Noah', reading: '20.1°', plot: {reading: 20.1, target: 20}, ariaLabel: 'Noah: 20.1°, target 20°'},
      {id: 'bedroom-suite', name: 'Bedroom', reading: '16.8°', plot: {reading: 16.8, target: 17}, ariaLabel: 'Bedroom: 16.8°, target 17°'}],
    ariaLabel: 'Zone temperatures: Living 19.6°, target 20°; Attic 19.8°, target 21°; Sam 19.2°, target 20°; Noah 20.1°, target 20°; Bedroom 16.8°, target 17°.'}});
  assert.deepEqual(ZONES.map(z => z.short), ['Attic', 'Sam', 'Noah', 'Bedroom']);
});

test('while the house heating is switched off, the house has no target; the zones keep theirs', () => {
  const {line, hero} = climateHeader(heroSnapshot('climate', 'heating-off'));
  assert.equal(line, 'Heating switched off on the thermostat');
  assert.deepEqual(hero.zones[0], {id: 'house', name: 'Living', reading: '19.6°', plot: {reading: 19.6, target: null}, ariaLabel: 'Living: 19.6°, heating switched off'});
  assert.deepEqual(hero.zones.slice(1).map(z => z.plot.target), [21, 20, 20, 17]);
  assert.match(hero.ariaLabel, /^Zone temperatures: Living 19\.6°, heating switched off; Attic 19\.8°, target 21°; /);
  // An unknown target is no target either.
  const unknown = climateHeader(fixtureSnapshot({states: byId(CLIMATE_FIXTURES, 'house_unknown').states})).hero.zones[0];
  assert.deepEqual([unknown.plot.target, unknown.ariaLabel], [null, 'Living: 19.6°, target unknown']);
});

test('Climate’s line is the house’s own wording: its target line while off, away or unknown, else its status', () => {
  const lines = Object.fromEntries(CLIMATE_FIXTURES.map(f => [f.id, climateHeader(fixtureSnapshot({states: f.states})).line]));
  assert.deepEqual(lines, {house_running: 'Warming', house_override: 'Warming', house_manual: 'Warming', house_off: 'Heating switched off on the thermostat',
    house_away: 'Away until Sun 17:00', house_unknown: 'Thermostat state unknown', zone_override: 'At target', airco_heating: 'At target', dry_humid: 'Warming',
    sensors_unavailable: 'Thermostat state unknown', contract_missing: 'Warming'});
  for (const f of CLIMATE_FIXTURES) {
    const snap = fixtureSnapshot({states: f.states}), h = houseStatus(snap.states, {now: snap.now, tz: snap.tz});
    assert.equal(lines[f.id], ['off', 'away', 'unknown'].includes(h.mode) ? h.targetLine : h.status.label, f.id);
  }
});

test('a capsule reads only its room sensor: unavailable is —, never a valve’s probe or 0, and the towel rails are left out', () => {
  const {hero} = climateHeader(heroSnapshot('climate', 'unavailable'));
  assert.deepEqual(hero.zones.map(z => [z.reading, z.plot.reading, z.plot.target, z.ariaLabel]),
    ['Living', 'Attic', 'Sam', 'Noah', 'Bedroom'].map(name => ['—', null, null, `${name}: no reading, target unknown`]));
  // Room sensors gone, every probe reading 34.5°: still no reading.
  const states = structuredClone(byId(CLIMATE_FIXTURES, 'house_running').states);
  for (const place of [HOUSE, ...ZONES]) delete states[place.temperature];
  for (const v of [...HOUSE.valves, ...ZONES.flatMap(z => z.valves)]) states[v.probe] = state(v.probe, 34.5, {unit_of_measurement: '°C'});
  for (const rail of TOWEL_RAILS) states[rail.probe] = state(rail.probe, 34.5, {unit_of_measurement: '°C'});
  const probed = climateHeader(fixtureSnapshot({states})).hero;
  assert.deepEqual(probed.zones.map(z => [z.id, z.reading, z.plot.reading]), [['house', '—', null], ...ZONES.map(z => [z.id, '—', null])]);
  assert.doesNotMatch(strings(probed).join('\n'), /34\.5|Towel|Ensuite|Bathroom/, 'no probe and no rail');
});

test('Climate’s words are what the capsules draw: each zone’s name and reading', () => {
  for (const variant of HERO_VARIANTS.climate) {
    const hero = climateHeader(heroSnapshot('climate', variant)).hero;
    assert.deepEqual(words(hero), hero.zones.flatMap(z => [z.name, z.reading]), variant);
  }
});

// ---- Energy: the four nodes --------------------------------------------------------------
test('Energy’s hero: solar, the grid, the house and the Car, the links between them, and the price', () => {
  assert.deepEqual(energyHeader(heroSnapshot('energy', 'solar-charging')), {line: 'Peak now · exporting', hero: {kind: 'flows',
    ariaLabel: 'Power now: solar 6.20 kW, exporting 1.00 kW, house 5.20 kW, Car 3.80 kW charging from solar.',
    nodes: {solar: {name: 'Solar', value: '6.20 kW', plot: {watts: 6200, active: true, available: true, asleep: false}},
      grid: {name: 'Export', value: '1.00 kW', plot: {watts: -1000, active: true, available: true, asleep: false}},
      house: {name: 'House', value: '5.20 kW', plot: {watts: 5200, active: true, available: true, asleep: false}},
      car: {name: 'Car', value: '3.80 kW', plot: {watts: 3800, active: true, available: true, asleep: false}}},
    plot: {links: [{from: 'solar', to: 'house', source: 'solar'}, {from: 'grid', to: 'house', source: 'export'}, {from: 'house', to: 'car', source: 'solar'}]},
    reading: {figure: '0.341', unit: '€/kWh from the grid', line: 'All-in: supplier, network, levies and VAT.'}}});
});

test('at night solar without a reading is asleep, and the Car charges off-peak from the grid', () => {
  const {line, hero} = energyHeader(heroSnapshot('energy', 'night-grid'));
  assert.equal(line, 'Off-peak now · importing');
  assert.deepEqual(hero.nodes.solar, {name: 'Solar', value: '—', plot: {watts: null, active: false, available: false, asleep: true}});
  assert.deepEqual([hero.nodes.grid.name, hero.nodes.grid.value, hero.nodes.car.value], ['Grid', '8.05 kW', '7.20 kW']);
  assert.deepEqual(hero.plot.links.map(l => l.source), [null, 'grid', 'grid']);
  assert.equal(hero.ariaLabel, 'Power now: solar asleep, importing 8.05 kW, house 8.05 kW, Car 7.20 kW charging from the grid.');
});

test('solar is asleep only while it has no reading and the sun’s elevation is below 0', () => {
  const solar = (value, sunState) => energyHeader(fixtureSnapshot({states: {[E.solar]: watts(E.solar, value), ...(sunState ? {[E.sun]: sunState} : {})}})).hero.nodes.solar;
  assert.deepEqual(solar('unavailable', sun(-5)).plot, {watts: null, active: false, available: false, asleep: true});
  assert.equal(solar('unknown', sun(-0.5)).plot.asleep, true);
  for (const [value, sunState, why] of [['unavailable', sun(3), 'the sun is up'], ['unavailable', null, 'no sun'], ['unavailable', state(E.sun, 'unavailable', {elevation: -20}), 'the sun unavailable'],
    ['unavailable', state(E.sun, 'below_horizon', {}), 'no elevation'], [0, sun(-30), 'a reading of 0 is a reading']]) assert.equal(solar(value, sunState).plot.asleep, false, why);
  assert.deepEqual(solar(0, sun(-30)), {name: 'Solar', value: '0 W', plot: {watts: 0, active: false, available: true, asleep: false}});
});

test('a node flows past its threshold: solar from 10 W, the grid beyond 10 W either way, the house from 10 W', () => {
  const at = (solar, grid, house = 500) => energyHeader(fixtureSnapshot({states: {[E.solar]: watts(E.solar, solar), [E.grid]: watts(E.grid, grid), [E.load]: watts(E.load, house)}}));
  assert.equal(SOLAR_ACTIVE_W, 10);
  assert.deepEqual([9, 10].map(w => [at(w, 0).hero.nodes.solar.plot.active, at(w, 0).hero.plot.links[0].source]), [[false, null], [true, 'solar']]);
  const grid = w => {const {line, hero} = at(0, w); return [hero.nodes.grid.name, hero.nodes.grid.value, hero.nodes.grid.plot.active, hero.plot.links[1].source, line];};
  // Export only once it flows: an idle reading either side of zero is the Grid, at rest.
  assert.deepEqual([11, 10, 5, 0, -5, -10, -11].map(grid), [['Grid', '11 W', true, 'grid', 'Importing'], ['Grid', '10 W', false, null, null], ['Grid', '5 W', false, null, null],
    ['Grid', '0 W', false, null, null], ['Grid', '5 W', false, null, null], ['Grid', '10 W', false, null, null], ['Export', '11 W', true, 'export', 'Exporting']]);
  assert.deepEqual([5, -5, -11].map(w => at(0, w).hero.ariaLabel.split(', ')[1]), ['grid 5 W', 'grid 5 W', 'exporting 11 W'], 'the name agrees with the words');
  assert.deepEqual([9, 10].map(w => at(0, 0, w).hero.nodes.house.plot.active), [false, true]);
  // Readings in kW are read in W.
  const kw = energyHeader(fixtureSnapshot({states: {[E.grid]: state(E.grid, -1.2, {unit_of_measurement: 'kW'})}})).hero.nodes.grid;
  assert.deepEqual([kw.name, kw.value, kw.plot.watts], ['Export', '1.20 kW', -1200]);
});

test('Energy’s line is the register and the grid’s direction, leaving out what isn’t known', () => {
  const line = (register, grid) => energyHeader(fixtureSnapshot({states: {...(register ? {[E.offPeakNow]: state(E.offPeakNow, register)} : {}), ...(grid === null ? {} : {[E.grid]: watts(E.grid, grid)})}})).line;
  assert.deepEqual([['on', 850], ['off', -1520], ['on', 3], ['off', null], ['unavailable', 850], [null, -600], [null, null], ['unavailable', 'unavailable']].map(([r, g]) => line(r, g)),
    ['Off-peak now · importing', 'Peak now · exporting', 'Off-peak now', 'Peak now', 'Importing', 'Exporting', null, null]);
});

test('the House → Car link takes the headline’s source, and where it doesn’t say, solar while solar produces', () => {
  for (const f of CAR_FIXTURES) {
    const snap = car(f), s = carStatus(snap.states, {now: snap.now, zone: snap.tz, last: snap.carLast}), link = energyHeader(snap).hero.plot.links[2].source;
    assert.equal(link, !s.drawing || s.charger === 'offline' ? null : CHARGE_SOURCE[s.key] ?? 'grid', f.id);
  }
  // Another vehicle drawing: its headline doesn't say, so solar decides.
  const other = byId(CAR_FIXTURES, 'other_vehicle');
  const source = solar => energyHeader(fixtureSnapshot({states: {...other.states, [E.solar]: watts(E.solar, solar)}, now: CAR_NOW})).hero.plot.links[2].source;
  assert.deepEqual([source(2000), source(SOLAR_ACTIVE_W), source(9), source('unavailable')], ['solar', 'solar', 'grid', 'grid']);
  assert.equal(chargeSource({drawing: true, key: 'constructor'}, {}), 'grid', 'only the table’s own keys');
  assert.equal(chargeSource({drawing: false, key: 'solar'}, {}), null, 'nothing drawn, no source');
  // The Charger offline: no Car reading and no link, whatever its last power.
  const offline = energyHeader(car(byId(CAR_FIXTURES, 'charger_offline'))).hero;
  assert.deepEqual([offline.nodes.car.value, offline.nodes.car.plot, offline.plot.links[2].source], ['—', {watts: null, active: false, available: false, asleep: false}, null]);
});

test('CHARGE_SOURCE covers every headline key car.js can give, and only charging ones have a source', () => {
  const source = readFileSync(new URL('../config/www/maison/car.js', import.meta.url), 'utf8');
  const keys = new Set([...source.matchAll(/\bkey: '([a-z_]+)'/g)].map(m => m[1]));
  assert.ok(keys.size >= 20 && keys.has('solar') && keys.has('charger_offline'), [...keys].join(', '));
  assert.deepEqual(new Set(Object.keys(CHARGE_SOURCE)), keys);
  assert.ok(Object.isFrozen(CHARGE_SOURCE));
  assert.deepEqual(Object.entries(CHARGE_SOURCE).filter(([, s]) => s !== null), [['solar', 'solar'], ['solar_ridethrough', 'solar'], ['offpeak', 'grid'], ['economical', 'grid'], ['charge_now', 'grid']]);
  // Every fixture's headline is in it.
  for (const f of CAR_FIXTURES) assert.ok(Object.hasOwn(CHARGE_SOURCE, f.expect), f.id);
});

test('another vehicle at the Charger is never the Car: Energy names the Charger, and the Car isn’t plugged in', () => {
  const other = byId(CAR_FIXTURES, 'other_vehicle'), charging = car(other);
  const energy = energyHeader(charging).hero;
  assert.deepEqual(energy.nodes.car, {name: 'Charger', value: '7.20 kW', plot: {watts: 7200, active: true, available: true, asleep: false}});
  assert.equal(energy.ariaLabel, 'Power now: no solar reading, no grid reading, no house reading, another vehicle charging 7.20 kW.');
  assert.doesNotMatch(energy.ariaLabel, /\bCar\b/);
  assert.deepEqual(carHeader(charging), {line: 'Another vehicle is charging',
    hero: {kind: 'car', plot: {plugged: false, charging: false, source: null, available: true}, ariaLabel: 'The Car, not the vehicle plugged in at the Charger'}});
  // Plugged in and drawing nothing.
  const idle = fixtureSnapshot({states: {...other.states, [E.carPower]: {...other.states[E.carPower], state: '0.0052'}}, now: CAR_NOW});
  const still = energyHeader(idle).hero;
  assert.deepEqual([still.nodes.car.name, still.nodes.car.value, still.nodes.car.plot.active, still.plot.links[2].source], ['Charger', '5 W', false, null]);
  assert.match(still.ariaLabel, /, another vehicle plugged in\.$/);
  assert.deepEqual([carHeader(idle).line, carHeader(idle).hero.plot.plugged], ['Another vehicle is plugged in', false]);
  // Its headline kept through a Charger dropout: still not the Car.
  const kept = car({...byId(CAR_FIXTURES, 'dropout'), last: {key: 'other_vehicle', headline: 'Another vehicle is charging', detail: 'The Car is not the vehicle at the Charger'}});
  assert.deepEqual([carHeader(kept).line, carHeader(kept).hero.plot.plugged, energyHeader(kept).hero.nodes.car.name], ['Another vehicle is charging', false, 'Charger']);
  // Only then: the Car's own session keeps its name.
  for (const f of CAR_FIXTURES.filter(f => f.id !== 'other_vehicle')) assert.equal(energyHeader(car(f)).hero.nodes.car.name, 'Car', f.id);
});

test('Energy’s words are what the nodes and the price draw', () => {
  for (const variant of HERO_VARIANTS.energy) {
    const hero = energyHeader(heroSnapshot('energy', variant)).hero;
    assert.deepEqual(words(hero), [...Object.values(hero.nodes).flatMap(n => [n.name, n.value]), hero.reading.figure, hero.reading.unit, hero.reading.line], variant);
  }
});

// ---- The Car ---------------------------------------------------------------------
test('the Car’s line is its headline, a bare Waiting completed by its detail, and its hero the Car at the Charger', () => {
  const expected = {
    solar: ['Charging from solar', true, true, 'solar', true], solar_ridethrough: ['Charging from solar', true, true, 'solar', true],
    offpeak: ['Charging off-peak', true, true, 'grid', true], charge_now: ['Charge now', true, true, 'grid', true], economical: ['Charging (economical)', true, true, 'grid', true],
    wait_offpeak: ['Waiting for off-peak at 22:00', true, false, null, true], wait_offpeak_asleep: ['Waiting for off-peak at 22:00', true, false, null, true],
    wait_sun: ['Waiting for sun', true, false, null, true], solar_paused: ['Waiting · Solar paused until 12:42', true, false, null, true],
    house_busy: ['Waiting · House is busy', true, false, null, true], complete: ['At charge limit', true, false, null, true],
    unplugged: ['Unplugged', false, false, null, true], never_confirmed: ['Unplugged', false, false, null, true], automatic_off: ['Automatic charging off', true, false, null, true],
    other_vehicle: ['Another vehicle is charging', false, false, null, true], not_verified: ['Plugged in · not yet verified', true, false, null, true],
    stale: ['Car data is stale', true, false, null, true], dropout: ['Waiting for off-peak at 22:00', true, false, null, true],
    charger_offline: ['Charger offline', false, false, null, false], power_missing: ['Power readings missing', true, false, null, true], initializing: ['Starting up', true, false, null, true],
  };
  assert.deepEqual(CAR_FIXTURES.map(f => f.id), Object.keys(expected));
  for (const f of CAR_FIXTURES) {
    const {line, hero} = carHeader(car(f)), [text, plugged, charging, source, available] = expected[f.id];
    assert.deepEqual([line, hero.kind, hero.plot], [text, 'car', {plugged, charging, source, available}], f.id);
  }
  // Waiting for off-peak with off-peak now.
  const now = byId(CAR_FIXTURES, 'wait_offpeak');
  const states = {...now.states, [E.carPolicy]: {...now.states[E.carPolicy], attributes: {...now.states[E.carPolicy].attributes, next_offpeak: 'Now'}}};
  assert.equal(carHeader(fixtureSnapshot({states, now: CAR_NOW})).line, 'Waiting for off-peak');
});

test('the Car’s hero is named in one sentence and draws no words', () => {
  const names = Object.fromEntries(['solar', 'offpeak', 'wait_sun', 'unplugged', 'other_vehicle', 'charger_offline'].map(id => [id, carHeader(car(byId(CAR_FIXTURES, id))).hero.ariaLabel]));
  assert.deepEqual(names, {solar: 'The Car, plugged in, charging from solar', offpeak: 'The Car, plugged in, charging from the grid', wait_sun: 'The Car, plugged in',
    unplugged: 'The Car, unplugged', other_vehicle: 'The Car, not the vehicle plugged in at the Charger', charger_offline: 'The Car, Charger offline'});
  for (const variant of HERO_VARIANTS.car) assert.deepEqual(words(carHeader(heroSnapshot('car', variant)).hero), [], variant);
});

test('through a Charger dropout the line keeps the headline the Battery sheet keeps', () => {
  const dropout = byId(CAR_FIXTURES, 'dropout'), snap = car(dropout), shown = screen({...snap, route: {page: 'car', detail: 'battery', dialog: null}});
  const {summary} = shown.drawer.body;
  assert.deepEqual([summary.headline, summary.detail, summary.hint], ['Waiting', 'For off-peak at 22:00', 'Reconnecting to the Charger…']);
  assert.equal(shown.chrome.line, 'Waiting for off-peak at 22:00');
  assert.deepEqual(carHeader(snap).hero.plot, {plugged: true, charging: false, source: null, available: true});
  // With no headline kept, both say it is reconnecting.
  const fresh = screen({...snap, carLast: null, route: {page: 'car', detail: 'battery', dialog: null}});
  assert.deepEqual([fresh.drawer.body.summary.headline, fresh.chrome.line], ['Reconnecting to the Charger', 'Reconnecting to the Charger']);
  // Energy's Car reads the same status.
  assert.equal(energyHeader(snap).hero.nodes.car.plot.available, true);
});
