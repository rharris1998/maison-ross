// The Energy page (#27, recomposed in #29 step 4, v33): the price, the
// billing year's rings and register lines, the bill and the cap credit,
// today's energy, the supplier's rates, the chart and the widgets they fill,
// and its four sheets (Price, Billing year, Bill so far, Energy today), as
// screen() works them out from one snapshot. Every test reads the value,
// never HTML: its words, its links and its plots. The register ledger's
// arithmetic is in maison-dashboard.test.mjs and the chart's own wording in
// maison-history-chart.test.mjs; routing in maison-dashboard and
// -screen.test.mjs; whether pressing a link does what it shows in
// maison-agreement.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {E, REGISTERS, COSTS} from '../config/www/maison/model.js';
import {DAY_STEP, dayWindow, powerDay, stepMeans} from '../config/www/maison/history.js';
import {ENERGY_DETAILS, POWER_HISTORY, POWER_DAY, energyDrawerValue, energyBreakdown} from '../config/www/maison/energy.js';
import {iconNames} from '../config/www/maison/icons.js';
import {screen, controls, words, kit} from '../config/www/maison/screen.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {ENERGY_FIXTURES, ENERGY_NIGHT_NOW, ENERGY_NOW, ENERGY_POWER_HISTORY, ENERGY_NIGHT_POWER_HISTORY} from '../frontend/maison/fixtures/energy-fixtures.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';

const [PEAK, OFF_PEAK] = REGISTERS;
// Every fixture Energy is checked against: its own, then the home's.
const FIXTURES = [...ENERGY_FIXTURES.map(f => ({...f, key: `energy ${f.id}`})), ...HOME_FIXTURES.map(f => ({...f, now: HOME_NOW, key: `home ${f.id}`}))];
const fixture = key => structuredClone(FIXTURES.find(f => f.key === key));
const state = (value, attributes = {}) => ({state: String(value), attributes});
const euro = (value, attributes = {}) => state(value, {unit_of_measurement: '€', ...attributes});
// A fixture with some states changed: a state object replaces, undefined removes.
const patched = (key, changes) => {
  const f = fixture(key);
  for (const [entity, value] of Object.entries(changes)) if (value === undefined) delete f.states[entity]; else f.states[entity] = value;
  return f;
};
// A fixture's snapshot on Energy at its own time, or on one of its sheets.
// `extra` is merged in: online, busy, loaded.
const snapshot = (f, {detail = null, loaded = {}, ...extra} = {}) => fixtureSnapshot({now: f.now ?? ENERGY_NOW, ...extra, states: f.states,
  route: {page: 'energy', detail, dialog: null}, loaded: {agenda: f.agenda, agendaLoading: f.agendaLoading, forecasts: f.forecasts, ...loaded}});
const page = (f, extra) => screen(snapshot(f, extra)).page;
const sheet = (f, id, extra = {}) => screen(snapshot(f, {...extra, detail: id})).drawer;
const intentOf = link => link && [link.intent.command, link.intent.entity];
const line = rich => words([rich]).join('');
// Everything a reader meets: words and link labels.
const everything = value => [...words(value), ...controls(value).map(c => c.label ?? '')].join('\n');
// A reading of zero with a unit: what a missing reading must never become.
const ZERO = /(?<![\d.,])0(?:[.,]0+)?\s?(?:€|kWh|kW|W|%)(?!\w)/;

// ---- Each fixture ----------------------------------------------------------------
// Each card in one line, or a few.
function summary(value) {
  const {priceCard: price, year, billCard: bill, capCard: cap, dayChart, rates} = value;
  const card = c => [c.title, [c.figure, c.unit].filter(Boolean).join(' '), c.line].join(' · ');
  return {
    price: [card(price), price.register && `${price.register.label} (${price.register.tone}, ${price.register.icon})`],
    year: [year.title, ...year.registers.map((r, i) => {
      const {tone, share, state: plotted} = year.rings.plot[i];
      return `${r.name} ${r.figure} · ${r.line} (${r.tone}; ring ${tone} ${plotted} ${share === null ? 'null' : share.toFixed(3)})`;
    })],
    bill: card(bill), cap: card(cap),
    day: dayChart.model.figures.map(f => [f.label, f.value, f.unit].filter(Boolean).join(' ')),
    rates: [...rates.rows.map(r => `${r.name} ${r.value}${r.badge ? ` [${r.badge}]` : ''} (${r.tone}${r.live ? ', live' : ''})`), rates.line],
  };
}

test('every fixture reads in household language on the Energy page', () => {
  const RATES_FULL = ['Peak 0.1234 [Now] (pink, live)', 'Off-peak 0.0987 (indigo)', 'Supplier energy only, €/kWh. Off-peak is about 20% cheaper.'];
  const BILLING = {
    price: ['Next kWh from the grid · 0.341 €/kWh · All-in: supplier, network, levies and VAT.', 'Peak register (pink, sun)'],
    year: ['Billing year · day 89', 'Peak credit used 57% · 617.8 kWh left (pink; ring pink credit 0.568)',
      'Off-peak credit used 100% · 790.3 kWh billed (indigo; ring indigo billing 1.000)'],
    bill: 'Bill so far · 612.45 € · Estimated, year to date', cap: 'Network cap credit · 12.34 € · Binding so far',
    day: ['Solar 8.4 kWh', 'Grid 2.1 kWh', 'Consumed 5.2 kWh'], rates: RATES_FULL,
  };
  const MISSING = {
    price: ['Next kWh from the grid · — · All-in: supplier, network, levies and VAT.', null],
    year: ['Billing year', 'Peak credit used — · No reading (pink; ring pink missing null)', 'Off-peak credit used — · No reading (indigo; ring indigo missing null)'],
    bill: 'Bill so far · — · Estimated, year to date', cap: 'Network cap credit · — · No reading',
    day: ['Solar —', 'Grid —', 'Consumed —'],
    rates: ['Peak — (pink)', 'Off-peak — (indigo)', 'Supplier rates have no reading.'],
  };
  const expected = {
    'energy covered': {
      price: ['Next kWh from the grid · 0.369 €/kWh · All-in: supplier, network, levies and VAT.', 'Peak register (pink, sun)'],
      year: ['Billing year · day 92', 'Peak credit used 36% · 918.1 kWh left (pink; ring pink credit 0.358)',
        'Off-peak credit used 86% · 45.8 kWh left (indigo; ring indigo credit 0.862)'],
      bill: 'Bill so far · 101.99 € · Estimated, year to date', cap: 'Network cap credit · 0.00 € · Not binding yet',
      day: ['Solar 6.8 kWh', 'Grid 0.9 kWh', 'Consumed 3.6 kWh'],
      rates: ['Peak 0.1900 [Now] (pink, live)', 'Off-peak 0.1539 (indigo)', 'Supplier energy only, €/kWh. Off-peak is about 19% cheaper.'],
    },
    'energy billing': BILLING,
    'energy night': {...BILLING,
      price: ['Next kWh from the grid · 0.221 €/kWh · All-in: supplier, network, levies and VAT.', 'Off-peak register (indigo, moon)'],
      day: ['Solar 9.1 kWh', 'Grid 3.9 kWh', 'Consumed 7.4 kWh'],
      rates: ['Peak 0.1234 (pink)', 'Off-peak 0.0987 [Now] (indigo, live)', RATES_FULL[2]]},
    'energy missing': MISSING,
    'home full': BILLING,
    // Off-peak's meters read but its billable doesn't: only the engine says
    // whether a register bills, so its ring is empty, whatever the meters say.
    'home quiet': {
      price: ['Next kWh from the grid · 0.221 €/kWh · All-in: supplier, network, levies and VAT.', 'Off-peak register (indigo, moon)'],
      year: ['Billing year', 'Peak credit used — · No reading (pink; ring pink missing null)', 'Off-peak credit used — · No reading (indigo; ring indigo missing null)'],
      bill: 'Bill so far · — · Estimated, year to date', cap: 'Network cap credit · 0.00 € · Not binding yet',
      day: ['Solar 0.2 kWh', 'Grid 6.8 kWh', 'Consumed 7.0 kWh'],
      rates: ['Peak — (pink)', 'Off-peak — [Now] (indigo, live)', 'Supplier rates have no reading.'],
    },
    'home missing': MISSING,
  };
  assert.deepEqual(FIXTURES.map(f => f.key).sort(), Object.keys(expected).sort(), 'one expectation per fixture');
  for (const f of FIXTURES) {
    const value = page(f);
    assert.equal(value.id, 'energy', f.key);
    assert.deepEqual(summary(value), expected[f.key], f.key);
    assert.deepEqual([value.priceCard.icon, value.year.icon, value.billCard.icon, value.capCard.icon, value.rates.icon, value.dayChart.icon],
      ['energy', 'life', 'paper', 'grid', 'energy', 'chart'], f.key);
    assert.equal(value.energyToday, undefined, `${f.key}: the card left in v37`);
    assert.deepEqual([value.rates.title, value.dayChart.title], ['Supplier rate by register', 'Through the day'], f.key);
  }
});

// ---- The price and the register ---------------------------------------------------
test('the price card: the all-in figure, and the register chip only while the meter knows it', () => {
  const price = changes => page(patched('energy billing', changes)).priceCard;
  assert.deepEqual(price({}).register, {label: 'Peak register', tone: 'pink', icon: 'sun'});
  assert.deepEqual(price({[E.offPeakNow]: state('on')}).register, {label: 'Off-peak register', tone: 'indigo', icon: 'moon'});
  for (const unknown of [state('unknown'), state('unavailable'), undefined]) assert.equal(price({[E.offPeakNow]: unknown}).register, null, JSON.stringify(unknown));
  assert.equal(price({[E.priceAllIn]: state(0.30449)}).figure, '0.304', 'three decimals, as the hero has it');
  // Without a reading, the figure is '—' and the unit is left out, as Energy today's is.
  for (const gone of [state('unavailable'), undefined]) assert.deepEqual([price({[E.priceAllIn]: gone}).figure, price({[E.priceAllIn]: gone}).unit], ['—', '']);
  assert.equal(price({}).unit, '€/kWh');
  // The hero's reading and the card are one figure.
  for (const f of FIXTURES) assert.equal(page(f).priceCard.figure, screen(snapshot(f)).chrome.hero.reading.figure, f.key);
});

test('the rates: each register’s supplier rate, the live one badged Now, how much cheaper off-peak is only while it is, and a missing rate by name', () => {
  const rates = changes => page(patched('energy billing', changes)).rates;
  const read = value => value.rows.map(r => [r.name, r.value, r.live, r.tone, r.badge]);
  assert.deepEqual(read(rates({})), [['Peak', '0.1234', true, 'pink', 'Now'], ['Off-peak', '0.0987', false, 'indigo', null]]);
  assert.deepEqual(read(rates({[E.offPeakNow]: state('on')})), [['Peak', '0.1234', false, 'pink', null], ['Off-peak', '0.0987', true, 'indigo', 'Now']]);
  for (const unknown of [state('unknown'), undefined]) assert.deepEqual(rates({[E.offPeakNow]: unknown}).rows.map(r => [r.live, r.badge]), [[false, null], [false, null]]);
  assert.equal(rates({[PEAK.price]: state(0.2), [OFF_PEAK.price]: state(0.15)}).line, 'Supplier energy only, €/kWh. Off-peak is about 25% cheaper.');
  // Nothing about saving unless off-peak is cheaper, by a whole percent at least.
  for (const [peak, off] of [[0.15, 0.2], [0.15, 0.15], [0.2, 0.1995], [0, 0.1], [-0.05, 0.1]])
    assert.equal(rates({[PEAK.price]: state(peak), [OFF_PEAK.price]: state(off)}).line, 'Supplier energy only, €/kWh.', `${peak} and ${off}`);
  // A missing rate is named; with neither, the line says so.
  assert.equal(rates({[PEAK.price]: undefined}).line, 'Supplier energy only, €/kWh. Peak has no reading.');
  assert.equal(rates({[OFF_PEAK.price]: state('unavailable')}).line, 'Supplier energy only, €/kWh. Off-peak has no reading.');
  assert.equal(rates({[PEAK.price]: state('unknown'), [OFF_PEAK.price]: undefined}).line, 'Supplier rates have no reading.');
  for (const f of FIXTURES) assert.ok(page(f).rates.line.length <= 60, `${f.key}: one footnote line on a medium widget`);
  // The Price sheet's rates are the page's.
  for (const f of FIXTURES) {
    const {rates: card} = page(f), {body} = sheet(f, 'price');
    assert.deepEqual([body.rates.heading, body.rates.rows, body.rates.footer], [card.title, card.rows, card.line], f.key);
  }
});

// ---- The billing year ---------------------------------------------------------------
test('the year’s rings: credit used while export covers a register, a full ring while it bills, none without the engine’s verdict', () => {
  const year = changes => page(patched('energy covered', changes)).year;
  const peak = value => [value.rings.plot[0].state, value.rings.plot[0].share, value.registers[0].figure, value.registers[0].line];
  // Credit: imported ÷ exported, a display ratio of the engine's own meters.
  assert.deepEqual(peak(year({})), ['credit', 512.1 / 1430.2, '36%', '918.1 kWh left']);
  // A reserve without a reading leaves its kWh out rather than saying 0; one that reads 0 says so.
  for (const reserve of [state('unavailable'), undefined]) assert.deepEqual(peak(year({[PEAK.reserve]: reserve})).slice(2), ['36%', 'Fully covered']);
  assert.equal(peak(year({[PEAK.reserve]: state(0)}))[3], '0.0 kWh left');
  // Billing: a full ring, whatever the ratio, and the billed kWh.
  assert.deepEqual(peak(year({[PEAK.imported]: state(1500.4), [PEAK.billable]: state(70.2)})), ['billing', 1, '100%', '70.2 kWh billed']);
  // Without the engine's billable the ring is empty, whichever way the meters lean: Maison never decides that a register bills.
  for (const [imported, exported] of [[512.1, 1430.2], [1500.4, 1430.2]])
    for (const billable of [state('unknown'), state('unavailable'), undefined])
      assert.deepEqual(peak(year({[PEAK.imported]: state(imported), [PEAK.exported]: state(exported), [PEAK.billable]: billable})),
        ['missing', null, '—', 'No reading'], `${imported} of ${exported}, billable ${JSON.stringify(billable)}`);
  // Without either meter, the same.
  for (const meter of [PEAK.imported, PEAK.exported]) assert.deepEqual(peak(year({[meter]: state('unavailable')})), ['missing', null, '—', 'No reading'], meter);
  // Only 0 reads 0% and only 1 reads 100%; zero meters are 0%, not a division by zero.
  assert.equal(peak(year({[PEAK.imported]: state(1429.9)}))[2], '99%');
  assert.equal(peak(year({[PEAK.imported]: state(1430.2)}))[2], '100%');
  assert.equal(peak(year({[PEAK.imported]: state(3)}))[2], '1%');
  assert.deepEqual(peak(year({[PEAK.imported]: state(0), [PEAK.exported]: state(0)})).slice(0, 3), ['credit', 0, '0%']);
  // Peak outside, off-peak inside, each in its register's tone, and named as such.
  assert.deepEqual(year({}).registers.map(r => [r.name, r.tone]), [['Peak credit used', 'pink'], ['Off-peak credit used', 'indigo']]);
  assert.deepEqual(year({}).rings.plot.map(p => p.tone), ['pink', 'indigo']);
});

test('the year’s title counts the billing year’s days when it knows them', () => {
  const title = changes => page(patched('energy covered', changes)).year.title;
  assert.equal(title({}), 'Billing year · day 92');
  assert.equal(title({[E.elapsedDays]: state(88.6)}), 'Billing year · day 89', 'rounded');
  for (const days of [state('unavailable'), undefined]) assert.equal(title({[E.elapsedDays]: days}), 'Billing year');
});

// ---- The bill and the cap -------------------------------------------------------------
test('the bill and the cap credit: a figure and one line short enough for a small widget, each opening Bill', () => {
  const cards = changes => {const v = page(patched('energy billing', changes)); return [v.billCard, v.capCard].map(c => [c.figure, c.line]);};
  assert.deepEqual(cards({}), [['612.45 €', 'Estimated, year to date'], ['12.34 €', 'Binding so far']]);
  const cap = attributes => cards({[E.capCredit]: euro(0, attributes)})[1];
  // The engine's binding, a bool or a string in any case.
  for (const binding of [true, 'true', 'True']) assert.deepEqual(cap({binding}), ['0.00 €', 'Binding so far'], String(binding));
  for (const binding of [false, 'false', 'False']) assert.deepEqual(cap({binding}), ['0.00 €', 'Not binding yet'], String(binding));
  // Neither, or no credit to read: no reading, never a guess.
  for (const binding of [undefined, null, 'unknown', '']) assert.deepEqual(cap({binding}), ['0.00 €', 'No reading'], String(binding));
  for (const gone of [state('unavailable', {binding: true}), state('not a number', {binding: true}), undefined]) assert.deepEqual(cards({[E.capCredit]: gone})[1], ['—', 'No reading']);
  assert.deepEqual(cards({[E.bill]: state('unknown')})[0], ['—', 'Estimated, year to date']);
  // A small widget holds one line of footnote, about 30 characters.
  for (const f of FIXTURES) for (const c of [page(f).billCard, page(f).capCard]) assert.ok(c.line.length <= 30 && c.figure.length <= 12, `${f.key}: ${c.line}`);
});

// ---- The chart ------------------------------------------------------------------------
// v37: through the day is today's power from midnight in the house's time
// zone, the record averaged per half hour, headed by the day's three figures
// from the meters, with the rest of Helios's solar forecast.
const MINUTE = 60000, HOUR = 60 * MINUTE;
const SUNDAY = Date.parse('2026-09-27T00:00:00+02:00'), MONDAY = Date.parse('2026-09-28T00:00:00+02:00');
const figures = model => model.figures.map(f => `${f.label} ${[f.value, f.unit].filter(Boolean).join(' ')} (${f.key})`);

test('today runs from the house’s midnight to the next, 23 or 25 hours on the days the clocks change', () => {
  assert.deepEqual(dayWindow(ENERGY_NOW, 'Europe/Brussels'), {start: SUNDAY, end: MONDAY});
  assert.deepEqual(dayWindow(SUNDAY, 'Europe/Brussels'), {start: SUNDAY, end: MONDAY}, 'midnight is its own day’s');
  assert.deepEqual(dayWindow(MONDAY - 1, 'Europe/Brussels'), {start: SUNDAY, end: MONDAY});
  const length = (iso, zone = 'Europe/Brussels') => { const {start, end} = dayWindow(Date.parse(iso), zone); return [new Date(start).toISOString(), (end - start) / HOUR]; };
  assert.deepEqual(length('2026-03-29T12:00:00+02:00'), ['2026-03-28T23:00:00.000Z', 23]);
  assert.deepEqual(length('2026-10-25T00:30:00+02:00'), ['2026-10-24T22:00:00.000Z', 25]);
  assert.deepEqual(length('2026-10-25T23:30:00+01:00'), ['2026-10-24T22:00:00.000Z', 25]);
  assert.deepEqual(length('2026-09-27T12:00:00+02:00', 'Asia/Kolkata'), ['2026-09-26T18:30:00.000Z', 24], 'a zone half an hour off');
  assert.deepEqual(length('2026-09-27T12:00:00Z', 'Not/A_zone'), ['2026-09-27T00:00:00.000Z', 24], 'an unknown zone is UTC');
});

test('a step’s mean weighs each sample by how long it held, over the time it was known', () => {
  const at = minutes => minutes * MINUTE;
  // 10 W from before the window, unknown from 5 to 7, 20 W from 7, 30 W from 25.
  const points = [{timestamp: at(-100), value: 10}, {timestamp: at(5), value: null}, {timestamp: at(7), value: 20}, {timestamp: at(25), value: 30}];
  assert.deepEqual(stepMeans(points, 0, at(32), at(10)), [(10 * 5 + 20 * 3) / 8, 20, 25, 30]);
  assert.deepEqual(stepMeans(points, 0, at(32), at(10), v => v * 2), [27.5, 40, 50, 60], 'mapped first');
  assert.deepEqual(stepMeans([{timestamp: 0, value: null}], 0, at(20), at(10)), [null, null], 'never known: null, never 0');
  assert.deepEqual(stepMeans([], 0, 0, at(10)), []);
  assert.equal(DAY_STEP, 30 * MINUTE);
});

test('through the day is today’s record per half hour: the house, solar and the grid’s import, kW read as W', () => {
  assert.deepEqual({...POWER_HISTORY}, {key: 'power', group: 'energy', ids: [E.load, E.solar, E.grid], labels: ['Home', 'Solar', 'Grid'], title: 'Power through the day'});
  assert.deepEqual({...POWER_DAY}, {group: 'energy', house: E.load, solar: E.solar, grid: E.grid});
  // From midnight: the house at 1 kW (reported in kW) then 2 kW; solar
  // unknown, then 600 W; the grid importing, then exporting.
  const t = minutes => new Date(SUNDAY + minutes * MINUTE).toISOString();
  const data = {series: {[E.load]: [{timestamp: t(0), value: 1}, {timestamp: t(15), value: 2}],
    [E.solar]: [{timestamp: t(0), value: null}, {timestamp: t(30), value: 600}],
    [E.grid]: [{timestamp: t(0), value: 1000}, {timestamp: t(45), value: -400}]}, errors: {}};
  const states = {[E.load]: state(2, {unit_of_measurement: 'kW'}), [E.solar]: state(600, {unit_of_measurement: 'W'}), [E.grid]: state(-400, {unit_of_measurement: 'W'})};
  const snap = loaded => fixtureSnapshot({states, now: SUNDAY + 70 * MINUTE, loaded});
  const day = powerDay(snap({history: {energy: {data, start: SUNDAY, end: SUNDAY + 70 * MINUTE}}}), POWER_DAY);
  assert.deepEqual([day.status, day.when, day.nowLabel, day.start, day.end, day.step, day.timeZone], ['ready', 'Today', 'Now', SUNDAY, MONDAY, DAY_STEP, 'Europe/Brussels']);
  assert.deepEqual(day.rows, [
    {start: SUNDAY, end: SUNDAY + 30 * MINUTE, house: 1500, solar: null, grid: 1000},
    {start: SUNDAY + 30 * MINUTE, end: SUNDAY + 60 * MINUTE, house: 2000, solar: 600, grid: 500},
    {start: SUNDAY + 60 * MINUTE, end: SUNDAY + 70 * MINUTE, house: 2000, solar: 600, grid: 0},
  ], 'each half hour’s mean, the last cut where the record ends; import is above zero only');
  // A cache from another midnight (yesterday's, until today's loads) holds nothing of today.
  for (const [loaded, status] of [[{history: {energy: {data, start: SUNDAY - 24 * HOUR, end: SUNDAY + 70 * MINUTE}}}, 'empty'],
    [{history: {energy: {data, start: SUNDAY - 24 * HOUR, end: SUNDAY}}, historyLoading: new Set(['energy'])}, 'loading'], [{}, 'empty']]) {
    const other = powerDay(snap(loaded), POWER_DAY);
    assert.deepEqual([other.status, other.rows], [status, []]);
  }
  assert.equal(powerDay(snap({}), POWER_DAY).stateText, 'Nothing recorded yet today.');
  const failed = powerDay(snap({history: {energy: {data: {series: {}, errors: {history: 'Recorder failed'}}, start: SUNDAY, end: SUNDAY + HOUR}}}), POWER_DAY);
  assert.deepEqual([failed.status, failed.stateText], ['error', 'Recorded values are unavailable right now.']);
  const partly = powerDay(snap({history: {energy: {data: {...data, errors: {history: 'Recorder failed'}}, start: SUNDAY, end: SUNDAY + HOUR}}}), POWER_DAY);
  assert.deepEqual([partly.status, partly.partial, partly.partialText], ['ready', true, 'Some recorded values could not be loaded.']);
});

test('through the day is headed by the day’s solar, import and consumption, as Energy today counts them', () => {
  for (const [key, history, end, rows] of [['energy covered', ENERGY_POWER_HISTORY, ENERGY_NOW, 25], ['energy night', ENERGY_NIGHT_POWER_HISTORY, ENERGY_NIGHT_NOW, 43]]) {
    const f = fixture(key);
    for (const [loaded, status] of [[{}, 'empty'], [{history: {energy: history}}, 'ready'], [{historyLoading: new Set(['energy'])}, 'loading']]) {
      const snap = snapshot(f, {loaded}), {dayChart} = screen(snap).page, {figures: _, forecast, ...day} = dayChart.model;
      assert.deepEqual(day, powerDay(snap, POWER_DAY), key);
      assert.equal(day.status, status, key);
      assert.deepEqual([dayChart.title, dayChart.icon, dayChart.action.label, dayChart.action.intent, dayChart.action.enabled],
        ['Through the day', 'chart', 'Details', {command: 'detail', entity: 'energy-today'}, true]);
    }
    const {model} = page(f, {loaded: {history: {energy: history}}}).dayChart;
    assert.deepEqual([model.rows.length, model.rows.at(-1).end], [rows, end], `${key}: to the record’s end`);
    assert.ok(model.rows.every(row => row.grid === null || row.grid >= 0), `${key}: the grid is import`);
  }
  // Consumed is what was used at home (solar less export) plus import.
  assert.deepEqual(figures(page(fixture('energy covered')).dayChart.model), ['Solar 6.8 kWh (solar)', 'Grid 0.9 kWh (grid)', 'Consumed 3.6 kWh (house)']);
  assert.deepEqual(figures(page(fixture('energy night')).dayChart.model), ['Solar 9.1 kWh (solar)', 'Grid 3.9 kWh (grid)', 'Consumed 7.4 kWh (house)']);
  assert.deepEqual(figures(page(fixture('energy missing')).dayChart.model), ['Solar — (solar)', 'Grid — (grid)', 'Consumed — (house)']);
  assert.deepEqual(figures(page(patched('energy covered', {[E.exportToday]: state('unknown')})).dayChart.model), ['Solar 6.8 kWh (solar)', 'Grid 0.9 kWh (grid)', 'Consumed — (house)']);
  // The breakdown's own tenths, so the figures and Energy today never disagree.
  const {legend} = sheet(fixture('energy covered'), 'energy-today').body.summary;
  assert.deepEqual(legend.map(l => l.text), ['2.7 used at home', '4.1 exported', '0.9 from the grid']);
});

test('through the day draws the rest of the solar forecast, Helios’s quarter hours averaged per half hour, from the record’s end', () => {
  const {forecast, rows} = page(fixture('energy covered'), {loaded: {history: {energy: ENERGY_POWER_HISTORY}}}).dayChart.model;
  assert.deepEqual(forecast[0].start, rows.at(-1).end, 'from where the record ends');
  assert.ok(forecast.slice(1).every(step => (step.start - SUNDAY) % DAY_STEP === 0 && step.end - step.start === DAY_STEP), 'then whole half hours');
  assert.deepEqual([forecast.at(-1).solar, forecast.at(-2).solar > 0, forecast.at(-1).start], [0, true, SUNDAY + 19.5 * HOUR], 'landing on zero at sunset');
  const curve = fixture('energy covered').states[E.solarCurve].attributes.forecast;
  const quarter = iso => curve.find(p => Date.parse(p.datetime) === Date.parse(iso)).watts;
  assert.equal(forecast.find(step => step.start === SUNDAY + 14 * HOUR).solar, Math.round((quarter('2026-09-27T14:00:00+02:00') + quarter('2026-09-27T14:15:00+02:00')) / 2));
  // Before dawn, from the record's end: one dark half hour, then the sun's.
  const dawn = screen(snapshot({...fixture('energy covered'), now: SUNDAY + 5 * HOUR})).page.dayChart.model.forecast;
  assert.deepEqual([dawn[0].start, dawn[0].solar, dawn[1].solar > 0], [SUNDAY + 7.5 * HOUR, 0, true]);
  // With nothing recorded, from now.
  assert.equal(page(fixture('energy covered')).dayChart.model.forecast[0].start, ENERGY_NOW);
  // None at night, and none without a curve.
  assert.deepEqual(page(fixture('energy night'), {loaded: {history: {energy: ENERGY_NIGHT_POWER_HISTORY}}}).dayChart.model.forecast, []);
  assert.deepEqual(page(patched('energy covered', {[E.solarCurve]: state('unavailable')})).dayChart.model.forecast, []);
});

// ---- The widgets ------------------------------------------------------------------------
// v37: the chart leads, then the billing year beside the rates and the bill
// beside the cap.
test('from 700px the widgets fill every row, the chart first: four full rows at four columns, seven at two with Price first', () => {
  for (const f of FIXTURES) {
    const {widgets} = page(f);
    assert.deepEqual(widgets, [{id: 'chart', size: 'xl'}, {id: 'year', size: 'medium'}, {id: 'rates', size: 'medium'}, {id: 'bill', size: 'medium'},
      {id: 'cap', size: 'medium'}], f.key);
    const desktop = placeWidgets(widgets, COLUMNS.desktop), wide = placeWidgets([{id: 'price', size: 'medium'}, ...widgets], COLUMNS.wide);
    assert.deepEqual([desktop.holes, desktop.rows], [[], 4], `${f.key} at ${COLUMNS.desktop} columns`);
    assert.deepEqual([wide.holes, wide.rows], [[], 7], `${f.key} at ${COLUMNS.wide} columns`);
    assert.deepEqual(desktop.placements.map(p => `${p.id} r${p.row} c${p.column}`), ['chart r1 c1', 'year r3 c1', 'rates r3 c3', 'bill r4 c1', 'cap r4 c3']);
    assert.deepEqual(wide.placements.map(p => `${p.id} r${p.row}`), ['price r1', 'chart r2', 'year r4', 'rates r5', 'bill r6', 'cap r7']);
  }
});

// ---- Today's energy ---------------------------------------------------------------------
// v37: Energy draws no Energy today card; the chart's Details opens the sheet,
// and Today keeps its widget, which opens Energy.
test('today’s energy is Today’s breakdown; the Energy today sheet’s summary is the same with no link, and the chart’s Details opens it', () => {
  for (const f of FIXTURES) {
    const snap = snapshot(f), value = screen(snap).page, today = screen({...snap, route: {page: 'today', detail: null, dialog: null}}).page;
    assert.deepEqual(sheet(f, 'energy-today').body.summary, {...today.energyToday, link: null}, f.key);
    assert.deepEqual([...intentOf(value.dayChart.action), value.dayChart.action.label], ['detail', 'energy-today', 'Details'], f.key);
    assert.deepEqual(sheet(f, 'energy-today').body.links.map(l => [l.label, l.icon, ...intentOf(l), l.enabled]), [['Full history', 'chart', 'native-history', 'power', true]], f.key);
  }
  // The builder makes each link from the breakdown in words.
  const said = [];
  energyBreakdown(snapshot(fixture('energy night')), text => said.push(text));
  assert.deepEqual(said, ['9.1 kWh solar generated. 3.5 kWh used at home, 5.6 kWh exported, 3.9 kWh from the grid.']);
});

// ---- The sheets ---------------------------------------------------------------------------
test('each sheet is titled by its name under Energy, and only ENERGY_DETAILS opens one', () => {
  assert.deepEqual(ENERGY_DETAILS, [{id: 'price', name: 'Price'}, {id: 'billing-year', name: 'Billing year'}, {id: 'bill', name: 'Bill so far'}, {id: 'energy-today', name: 'Energy today'}]);
  assert.ok(Object.isFrozen(ENERGY_DETAILS) && ENERGY_DETAILS.every(Object.isFrozen));
  const snap = snapshot(fixture('energy billing')), bound = kit(snap);
  for (const [{id, name}, kind] of ENERGY_DETAILS.map((d, i) => [d, ['price', 'year', 'bill', 'day'][i]])) {
    const drawer = energyDrawerValue(snap, bound, id);
    assert.deepEqual([drawer.id, drawer.title, drawer.eyebrow, drawer.body.kind, 'close' in drawer], [id, name, 'Energy', kind, false], id);
    assert.equal(drawer.body.why.title, 'Why', id);
    assert.ok(drawer.body.why.paragraphs.length > 0 && drawer.body.why.paragraphs.every(p => typeof p === 'string' && p.endsWith('.')), id);
  }
  for (const id of ['attic', 'house', 'missing', '', undefined, 'bill/']) assert.equal(energyDrawerValue(snap, bound, id), null, String(id));
});

test('the Price sheet: the page’s price, the rates, and why the price is what it is', () => {
  for (const f of FIXTURES) {
    const {body} = sheet(f, 'price'), {priceCard} = page(f);
    assert.deepEqual(body.summary, {figure: priceCard.figure, unit: priceCard.unit, line: priceCard.line, register: priceCard.register}, f.key);
  }
  assert.deepEqual(sheet(fixture('energy billing'), 'price').body.why.paragraphs, [
    'The all-in price counts every charge on a kilowatt-hour from the grid: the supplier’s energy, green energy, distribution, transport and levies, with VAT. It leaves out compensation and the network cap, which settle over the billing year.',
    'The supplier rates read lower than the all-in price because they leave out the network, green energy, levies and VAT.',
    'The live register comes from the meter itself. The register schedule stands in only while the meter can’t be reached.']);
});

test('the Billing year sheet: the page’s rings, then each register’s chip, ledger bars and note', () => {
  const ledgers = f => sheet(f, 'billing-year').body.registers.map(r => [r.heading, r.tone, `${r.chip.label} (${r.chip.tone})`,
    ...(r.bars ?? []).map(b => `${b.label} ${b.value} ${b.width} ${b.tone}`), line(r.note)]);
  assert.deepEqual(ledgers(fixture('energy covered')), [
    ['Peak hours', 'pink', 'Fully covered (green)', 'Imported 512.1 kWh 36 indigo', 'Exported 1430.2 kWh 100 green', 'Export has covered every kWh this register drew.'],
    ['Off-peak hours', 'indigo', 'Fully covered (green)', 'Imported 285.9 kWh 86 indigo', 'Exported 331.7 kWh 100 green', 'Export has covered every kWh this register drew.']]);
  assert.deepEqual(ledgers(fixture('energy billing'))[1], ['Off-peak hours', 'indigo', 'Billing (gray)', 'Imported 1210.6 kWh 100 indigo', 'Exported 420.3 kWh 35 green',
    'Import has passed export, so the difference is billed.']);
  // The meters read but the billable doesn't: the bars, with no verdict.
  assert.deepEqual(ledgers(fixture('home quiet')), [['Peak hours', 'pink', 'No reading (gray)', 'No reading for this register’s meters.'],
    ['Off-peak hours', 'indigo', 'No reading (gray)', 'Imported 1210.6 kWh 100 indigo', 'Exported 420.3 kWh 35 green', 'No reading for this register’s compensation.']]);
  // A covered register without its reserve reading says the same: the note explains the chip, not the kWh.
  assert.deepEqual(sheet(patched('energy covered', {[PEAK.reserve]: undefined}), 'billing-year').body.registers[0].note, ['Export has covered every kWh this register drew.']);
  // Zero meters draw empty bars, never a division by zero.
  assert.deepEqual(ledgers(patched('energy covered', {[PEAK.imported]: state(0), [PEAK.exported]: state(0), [PEAK.billable]: state(0)}))[0].slice(3, 5),
    ['Imported 0.0 kWh 0 indigo', 'Exported 0.0 kWh 0 green']);
  for (const f of FIXTURES) {
    const {body} = sheet(f, 'billing-year'), {year} = page(f);
    assert.deepEqual(body.summary, {rings: year.rings, registers: year.registers}, f.key);
    for (const r of body.registers) {
      // One line of the sheet's own, with no bold part: no figure the summary or the bars already give, a curly apostrophe and no em dash.
      assert.ok(r.note.length === 1 && typeof r.note[0] === 'string', `${f.key} ${r.heading}`);
      assert.doesNotMatch(r.note[0], /\d|'|—/, `${f.key} ${r.heading}: ${r.note[0]}`);
    }
  }
  assert.deepEqual(sheet(fixture('energy billing'), 'billing-year').body.why.paragraphs, [
    'Each register is netted on its own across the billing year, July to June: peak export offsets only peak import, and off-peak export only off-peak import.',
    'Credit used is a register’s import as a share of its export. Once import passes export, the difference is billed.']);
});

// The lines of a Bill sheet in one line each.
const billLines = body => [...body.lines.rows.map(r => `${r.label} ${r.value}`), ...(body.lines.covered ? [`${body.lines.covered.label}: ${body.lines.covered.detail}`] : []),
  ...(body.lines.empty ? [body.lines.empty] : [])];

test('the Bill sheet: the estimate, the lines before VAT, the cap, and the bill’s two links', () => {
  const bill = f => sheet(f, 'bill').body;
  const read = body => ({summary: [body.summary.figure, body.summary.line, body.summary.detail], lines: billLines(body),
    cap: [body.cap.heading, `${body.cap.chip.label} (${body.cap.chip.tone})`, ...body.cap.rows.map(r => `${r.label} ${r.value}`), line(body.cap.line)]});
  assert.deepEqual(read(bill(fixture('energy covered'))), {
    summary: ['101.99 €', 'Estimated, billing year to date', '798 kWh imported'],
    lines: ['Supplier standing charge 10.59 €', 'Distribution 64.12 €', 'Transport 8.40 €', 'Covered by your export: Supplier energy · Green energy · Levies & taxes'],
    cap: ['Network cost cap', 'Not binding (gray)', 'Credit applied 0.00 €', 'Cap so far 95.20 €', 'Network costs are 22.68 € under the cap so far, so no credit yet.'],
  });
  assert.deepEqual(read(bill(fixture('energy billing'))), {
    summary: ['612.45 €', 'Estimated, billing year to date', '2023 kWh imported'],
    lines: ['Supplier energy 310.12 €', 'Green energy 18.40 €', 'Supplier standing charge 42.00 €', 'Distribution 160.75 €', 'Transport 21.30 €', 'Levies & taxes 38.90 €'],
    cap: ['Network cost cap', 'Binding (green)', 'Credit applied 12.34 €', 'Cap so far 169.71 €', 'Network costs are over the cap so far, so the excess comes back as credit.'],
  });
  assert.deepEqual(read(bill(fixture('energy missing'))), {
    summary: ['—', 'Estimated, billing year to date', null], lines: ['No cost line has a reading.'],
    cap: ['Network cost cap', 'No reading (gray)', 'The cap has no reading.'],
  });
  assert.equal(bill(fixture('energy missing')).lines.heading, 'Before VAT');
  // The fixtures' caps agree with their own rows: distribution and transport less the cap is the slack.
  for (const f of ENERGY_FIXTURES.filter(x => x.id !== 'missing')) {
    const a = f.states[E.capCredit].attributes, cost = id => Number(f.states[id].state);
    assert.equal((cost(COSTS[3][1]) + cost(COSTS[4][1]) - a.cap_eur).toFixed(2), a.slack_eur.toFixed(2), f.id);
  }
  // The cap with no reading says nothing of the attributes it had.
  const stale = bill(patched('energy billing', {[E.capCredit]: state('unavailable', {slack_eur: 12.34, binding: true, cap_eur: 245.6})})).cap;
  assert.deepEqual([stale.chip, stale.rows, line(stale.line)], [{label: 'No reading', tone: 'gray'}, [], 'The cap has no reading.']);
  // Its edges: a credit whose binding the engine doesn't say, and a cap reading without its other attributes.
  const cap = attributes => bill(patched('energy billing', {[E.capCredit]: euro(6.42, attributes)})).cap;
  const said = value => [`${value.chip.label} (${value.chip.tone})`, ...value.rows.map(r => `${r.label} ${r.value}`), line(value.line)];
  assert.deepEqual(said(cap({slack_eur: 6.42, cap_eur: 85.73})), ['No reading (gray)', 'The cap has no reading.']);
  assert.deepEqual(said(cap({binding: 'True'})), ['Binding (green)', 'Credit applied 6.42 €', 'Cap so far —', 'Network costs are over the cap so far, so the excess comes back as credit.']);
  assert.deepEqual(said(bill(patched('energy billing', {[E.capCredit]: euro(0, {binding: false})})).cap),
    ['Not binding (gray)', 'Credit applied 0.00 €', 'Cap so far —', 'Network costs are under the cap so far, so no credit yet.'], 'no slack, no figure');
  // While it binds, the credit is the excess: one figure, never two.
  for (const f of FIXTURES) {
    const {cap: shown} = bill(f), credit = shown.rows[0]?.value;
    if (shown.chip.label === 'Binding') assert.ok(!line(shown.line).includes(credit), `${f.key}: ${line(shown.line)}`);
  }
  assert.equal(line(bill(patched('energy billing', {[E.capCredit]: euro(0, {slack_eur: 0, binding: false, cap_eur: 245.6})})).cap.line),
    'Network costs are 0.00 € under the cap so far, so no credit yet.');
  // The bill's links: its reading, Bill details, and Home Assistant's energy dashboard. No bill in Home Assistant, nothing to open.
  for (const f of FIXTURES) {
    const {links} = bill(f), known = f.states[E.bill] !== undefined;
    assert.deepEqual(links.map(l => [l.label, l.icon, ...intentOf(l), l.enabled]), [['Bill details', 'paper', 'more', E.bill, known], ['Full energy dashboard', 'energy', 'ha-energy', undefined, true]], f.key);
  }
  assert.equal(bill(fixture('home missing')).links[0].enabled, false);
  assert.deepEqual(bill(fixture('energy billing')).why.paragraphs, [
    'These lines are before VAT and leave out the prorated ORES standing fee and the cap’s credit, so they don’t add up to the estimate.',
    'Supplier energy, green energy and levies & taxes are charged only on billable energy: what a register imports beyond what it exports.',
    'The cap is prorated by the days elapsed, so early in the billing year it can read as not binding even when it will bind at settlement. It says how the year has gone so far, not a forecast.']);
});

// ---- The covered rule -----------------------------------------------------------------------
test('the covered rule: the billable-based lines fold into “Covered by your export” only when every one with a reading reads 0.00 €', () => {
  // COSTS says which lines the tariff charges only on billable energy (pricing.jinja's estimated_bill).
  assert.deepEqual(COSTS.filter(([, , billable]) => billable).map(([label]) => label), ['Supplier energy', 'Green energy', 'Levies & taxes']);
  assert.ok(COSTS.every(row => row.length === 3 && typeof row[2] === 'boolean'));
  const [[, supplier], [, green], [, fixed], , , [, taxes]] = COSTS;
  // None of them with a reading: nothing folds.
  assert.equal(sheet(patched('energy covered', {[supplier]: undefined, [green]: undefined, [taxes]: state('unavailable')}), 'bill').body.lines.covered, null);
  const lines = changes => billLines(sheet(patched('energy billing', changes), 'bill').body);
  // They share one base (billable energy), so one line at 0.00 beside the others' charges folds nothing.
  assert.deepEqual(lines({[green]: euro(0)}), ['Supplier energy 310.12 €', 'Green energy 0.00 €', 'Supplier standing charge 42.00 €', 'Distribution 160.75 €', 'Transport 21.30 €',
    'Levies & taxes 38.90 €']);
  // At the rounding edge: a cent of supplier energy keeps all three as rows.
  assert.deepEqual(lines({[supplier]: euro(0.01), [green]: euro(0), [taxes]: euro(0)}).filter(l => /Supplier energy|Green|Levies|Covered/.test(l)),
    ['Supplier energy 0.01 €', 'Green energy 0.00 €', 'Levies & taxes 0.00 €']);
  // Reading 0.00 to the cent is 0.00, so all three fold.
  assert.deepEqual(lines({[supplier]: euro(0.004), [green]: euro(0), [taxes]: euro(-0.001)}).filter(l => /Supplier energy|Green|Levies|Covered/.test(l)),
    ['Covered by your export: Supplier energy · Green energy · Levies & taxes']);
  // A line charged on gross import or by the day stays a row at 0.00 €.
  assert.ok(lines({[fixed]: euro(0)}).includes('Supplier standing charge 0.00 €'));
  assert.ok(!lines({[fixed]: euro(0)}).some(l => l.startsWith('Covered')));
  // A line without a reading is neither a row nor covered; the others with a reading fold on their own.
  for (const gone of [state('unavailable'), state('unknown'), state('not a number'), undefined]) {
    const shown = lines({[supplier]: gone, [green]: euro(0), [taxes]: euro(0)});
    assert.deepEqual(shown.filter(l => /Supplier energy|Green|Levies|Covered/.test(l)), ['Covered by your export: Green energy · Levies & taxes'], JSON.stringify(gone));
  }
  // Everything covered and nothing else read: the covered row alone, and no empty line.
  const only = sheet(patched('energy covered', {[COSTS[2][1]]: undefined, [COSTS[3][1]]: undefined, [COSTS[4][1]]: undefined}), 'bill').body.lines;
  assert.deepEqual([only.rows, only.covered?.detail, only.empty], [[], 'Supplier energy · Green energy · Levies & taxes', null]);
  // Covered is the bill's word only: the page's cards say nothing of it.
  for (const f of FIXTURES) assert.doesNotMatch(everything(page(f)), /Covered by your export/, f.key);
});

test('the Bill sheet lists only the cost components with a reading, a real zero among them', () => {
  const [[, first], [, second]] = COSTS;
  const lines = changes => sheet(patched('home full', changes), 'bill').body.lines;
  assert.deepEqual(lines({[first]: state('unavailable'), [second]: undefined}).rows.map(r => `${r.label} ${r.value}`),
    ['Supplier standing charge 42.00 €', 'Distribution 160.75 €', 'Transport 21.30 €', 'Levies & taxes 38.90 €'], 'unavailable and missing are left out');
  assert.equal(`${lines({[first]: state(0)}).rows[0].label} ${lines({[first]: state(0)}).rows[0].value}`, 'Supplier energy 0.00 €', 'a zero cost is a row');
  assert.equal(lines({[first]: state(0)}).empty, null);
  assert.ok(COSTS.every(([label]) => !/&\w+;/.test(label)), 'labels are raw text; React escapes them');
});

test('a Rich line is always an array, its bold parts marked strong', () => {
  for (const f of FIXTURES) {
    const {registers} = sheet(f, 'billing-year').body, {cap} = sheet(f, 'bill').body;
    for (const rich of [...registers.map(r => r.note), cap.line]) {
      assert.ok(Array.isArray(rich), `${f.key}: ${JSON.stringify(rich)}`);
      assert.ok(rich.every(part => typeof part === 'string' || typeof part?.strong === 'string'), f.key);
    }
  }
  assert.deepEqual(sheet(fixture('energy covered'), 'bill').body.cap.line.filter(p => typeof p !== 'string'), [{strong: '22.68 €'}]);
});

// The split's rows are the bar's legend: the breakdown's own tenths in its
// tones, never a sensor's rounding beside them.
test('the Energy today sheet’s first four rows print the breakdown’s own tenths, in the bar’s tones', () => {
  const split = (f, extra) => {
    const {summary, rows} = sheet(f, 'energy-today', extra).body;
    return {rows: rows.slice(0, 4).map(r => `${r.title} ${r.value} (${r.tone})`), legend: summary.legend.map(l => `${l.text} (${l.tone})`), figure: summary.figure.value,
      parts: summary.legend.map(l => [l.text.split(' ')[0], l.tone])};
  };
  const kwh = value => value === '—' ? '—' : `${value} kWh`;
  // Solar 6.84 and export 4.16 print 6.8 and 4.2, so used at home is 2.6, whatever the self-consumption sensor rounds to.
  const probe = split(patched('energy covered', {[E.solarToday]: state(6.84), [E.exportToday]: state(4.16), [E.importToday]: state(0.94), [E.selfConsumed]: state(2.68)}));
  assert.deepEqual({...probe, parts: undefined}, {parts: undefined, rows: ['Solar generated 6.8 kWh (gray)', 'Used at home 2.6 kWh (yellow)', 'Exported 4.2 kWh (green)', 'From the grid 0.9 kWh (indigo)'],
    legend: ['2.6 used at home (yellow)', '4.2 exported (green)', '0.9 from the grid (indigo)'], figure: '6.8'});
  for (const f of FIXTURES) {
    const {rows, figure, parts} = split(fixture(f.key));
    assert.deepEqual(rows, [`Solar generated ${kwh(figure)} (gray)`, ...parts.map(([value, tone], i) => `${['Used at home', 'Exported', 'From the grid'][i]} ${kwh(value)} (${tone})`)], f.key);
  }
  // Export over solar: used at home is 0.0, never below.
  assert.equal(split(patched('energy covered', {[E.exportToday]: state(9)})).rows[1], 'Used at home 0.0 kWh (yellow)');
});

test('the Energy today sheet: its readings each open their own, forecast reliability among them', () => {
  const rows = f => sheet(f, 'energy-today').body.rows.map(r => [r.icon, r.tone, r.title, r.value, ...intentOf(r.link), r.link.enabled]);
  assert.deepEqual(rows(fixture('energy covered')), [
    ['sun', 'gray', 'Solar generated', '6.8 kWh', 'more', E.solarToday, true], ['home', 'yellow', 'Used at home', '2.7 kWh', 'more', E.selfConsumed, true],
    ['grid', 'green', 'Exported', '4.1 kWh', 'more', E.exportToday, true], ['grid', 'indigo', 'From the grid', '0.9 kWh', 'more', E.importToday, true],
    ['sun', 'gray', 'Solar still to come today', '9.6 kWh', 'more', E.solarRemaining, true], ['sun', 'gray', 'Solar tomorrow', '18.4 kWh', 'more', E.solarTomorrow, true],
    ['chart', 'gray', 'Forecast reliability', '91%', 'more', E.reliability, true]]);
  assert.deepEqual(rows(fixture('energy missing')).map(r => [r[3], r.at(-1)]), Array(7).fill(['—', false]), 'no reading, nothing to open');
  // The Helios solar forecast's reliability belongs with the solar forecasts, not on the bill.
  for (const f of FIXTURES) {
    assert.ok(words(sheet(f, 'energy-today')).includes('Forecast reliability'), f.key);
    for (const id of ['price', 'billing-year', 'bill']) assert.doesNotMatch(words(sheet(f, id)).join('\n'), /reliab/i, `${f.key} ${id}`);
    assert.doesNotMatch(words(page(f)).join('\n'), /reliab/i, f.key);
  }
  assert.deepEqual(sheet(fixture('energy billing'), 'energy-today').body.why.paragraphs, [
    'Used at home is the solar you didn’t export, including what charged the Car.',
    'The grid meter itself counts what was exported and what came from the grid.',
    'The inverter sleeps overnight and reports no power, but the day’s solar total stays.',
    'Solar still to come, solar tomorrow and forecast reliability come from the Helios solar forecast.']);
});

// ---- Missing is missing ---------------------------------------------------------------------
test('— is never 0: a missing reading is —, No reading, a null share or no chip, on the page and in every sheet', () => {
  const nothing = {now: ENERGY_NOW, states: {}, agenda: {events: [], errors: {}, status: {}}, agendaLoading: false, forecasts: []};
  for (const [where, f] of [['missing', fixture('energy missing')], ['nothing', nothing], ['nothing, offline', nothing]]) {
    const extra = where.endsWith('offline') ? {online: false} : {};
    const value = page(f, extra), sheets = ENERGY_DETAILS.map(d => sheet(f, d.id, extra));
    for (const shown of [value, ...sheets]) {
      assert.doesNotMatch(everything(shown), ZERO, where);
      assert.doesNotMatch(JSON.stringify(shown), ZERO, `${where}: accessible names too`);
    }
    assert.deepEqual([value.priceCard.figure, value.priceCard.register, value.billCard.figure, value.capCard.figure, value.capCard.line], ['—', null, '—', '—', 'No reading'], where);
    assert.deepEqual(value.year.rings.plot.map(p => [p.share, p.state]), [[null, 'missing'], [null, 'missing']], where);
    assert.deepEqual(value.year.registers.map(r => [r.figure, r.line]), [['—', 'No reading'], ['—', 'No reading']], where);
    assert.deepEqual(value.rates.rows.map(r => [r.value, r.badge]), [['—', null], ['—', null]], where);
    const {summary} = sheets[3].body;
    assert.deepEqual([summary.figure, summary.bar.kind, summary.bar.segments], [{label: 'Solar generated', value: '—', unit: ''}, 'missing', []], where);
    assert.deepEqual(value.dayChart.model.figures.map(f => f.value), ['—', '—', '—'], where);
    const [, year, bill] = sheets.map(s => s.body);
    assert.deepEqual(year.registers.map(r => [r.chip.label, r.bars]), [['No reading', null], ['No reading', null]], where);
    assert.deepEqual([bill.lines.rows, bill.lines.covered, bill.cap.rows, bill.cap.chip.label], [[], null, [], 'No reading'], where);
  }
  // A real zero is still a reading.
  const zeroed = patched('energy covered', {[E.solarToday]: state(0), [E.exportToday]: state(0), [E.importToday]: state(0)}), zero = page(zeroed);
  const {summary} = sheet(zeroed, 'energy-today').body;
  assert.deepEqual([summary.figure.value, summary.bar.kind, zero.capCard.figure, zero.dayChart.model.figures.map(f => f.value)], ['0.0', 'zero', '0.00 €', ['0.0', '0.0', '0.0']]);
});

// ---- Words ---------------------------------------------------------------------------------
// What Energy draws, as the contract lists it: on the page, then in each sheet.
const pageWords = v => [v.priceCard.title, v.priceCard.figure, v.priceCard.unit, v.priceCard.line, v.priceCard.register?.label,
  v.year.title, ...v.year.registers.flatMap(r => [r.name, r.figure, r.line]), ...[v.billCard, v.capCard].flatMap(c => [c.title, c.figure, c.line]),
  v.rates.title, ...v.rates.rows.flatMap(r => [r.name, r.value, r.badge]), v.rates.line, v.dayChart.title, v.dayChart.action.label];
const why = body => [body.why.title, ...body.why.paragraphs];
const sheetWords = body => body.kind === 'price' ? [body.summary.figure, body.summary.unit, body.summary.line, body.summary.register?.label, body.rates.heading,
  ...body.rates.rows.flatMap(r => [r.name, r.value, r.badge]), body.rates.footer, ...why(body)]
  : body.kind === 'year' ? [...body.summary.registers.flatMap(r => [r.name, r.figure, r.line]),
    ...body.registers.flatMap(r => [r.heading, r.chip.label, ...(r.bars ?? []).flatMap(b => [b.label, b.value]), line(r.note)]), ...why(body)]
    : body.kind === 'bill' ? [body.summary.figure, body.summary.line, body.summary.detail, body.lines.heading, ...body.lines.rows.flatMap(r => [r.label, r.value]),
      body.lines.covered?.label, body.lines.covered?.detail, body.lines.empty, body.cap.heading, body.cap.chip.label, ...body.cap.rows.flatMap(r => [r.label, r.value]),
      line(body.cap.line), ...why(body), ...body.links.map(l => l.label)]
      : [body.summary.title, body.summary.figure.label, body.summary.figure.value, ...body.summary.legend.map(l => l.text),
        ...body.rows.flatMap(r => [r.title, r.value]), ...why(body), ...body.links.map(l => l.label)];
// A string under a key words() skips is a token (an id, an icon, a kind, a
// tone, a size, a ring's state), never words; a chart's model is the chart's.
const TOKEN = /^[a-z][a-z0-9_.-]*$/;
function structural(value, found = []) {
  const skipped = new Set(['id', 'kind', 'key', 'icon', 'tone', 'width', 'min', 'max', 'plot', 'size']);
  const leaves = node => typeof node === 'string' ? [node] : node && typeof node === 'object' ? Object.values(node).flatMap(leaves) : [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'model') continue;
      if (skipped.has(key)) found.push(...leaves(child).map(text => [key, text])); else walk(child);
    }
  };
  walk(value);
  return found;
}

test('every word Energy draws is one words() reads, and nothing drawn sits under a key it skips', () => {
  for (const f of FIXTURES) {
    const value = page(f), said = words(value);
    for (const text of pageWords(value).filter(Boolean)) assert.ok(said.includes(text), `${f.key}, the page: ${text}`);
    for (const [key, text] of structural(value)) assert.match(text, TOKEN, `${f.key}, the page: ${key} holds “${text}”`);
    for (const d of ENERGY_DETAILS) {
      const drawer = sheet(f, d.id), inSheet = words(drawer);
      for (const text of sheetWords(drawer.body).filter(Boolean)) assert.ok(inSheet.includes(text), `${f.key}, ${d.id}: ${text}`);
      for (const [key, text] of structural(drawer)) assert.match(text, TOKEN, `${f.key}, ${d.id}: ${key} holds “${text}”`);
      for (const icon of drawer.body.rows?.map(r => r.icon) ?? []) assert.ok(iconNames.includes(icon), icon);
    }
    // The rings and the widgets draw no words, and the chart's are its title and Details.
    assert.deepEqual(words([value.year.rings, value.widgets]), [], f.key);
    assert.deepEqual(words(value.dayChart), ['Through the day', 'Details'], f.key);
    for (const icon of [value.priceCard.icon, value.priceCard.register?.icon, value.year.icon, value.billCard.icon, value.capCard.icon, value.rates.icon, value.dayChart.icon].filter(Boolean))
      assert.ok(iconNames.includes(icon), icon);
  }
  // No state or tone leaks as words: 'credit', 'billing', 'missing', 'pink'…
  const all = FIXTURES.flatMap(f => [...words(page(f)), ...ENERGY_DETAILS.flatMap(d => words(sheet(f, d.id)))]);
  assert.deepEqual(all.filter(text => TOKEN.test(text)), [], 'no bare token is drawn');
});

test('Energy calls a tariff period a register, never a band, and names the Car only in what used at home includes', () => {
  for (const f of FIXTURES) {
    const shown = [everything(page(f)), ...ENERGY_DETAILS.map(d => everything(sheet(f, d.id)))].join('\n');
    assert.doesNotMatch(shown, /\bbands?\b/i, f.key);
    assert.deepEqual(shown.split('\n').flatMap(text => text.match(/[^.]*\bcar\b[^.]*\./gi) ?? []).map(s => s.trim()), ['Used at home is the solar you didn’t export, including what charged the Car.'], f.key);
    assert.doesNotMatch(shown, /Charging policy|Charge now|Model 3|tesla/i, f.key);
  }
  assert.match(everything(page(fixture('energy billing'))), /Peak register/);
});

// ---- Links -----------------------------------------------------------------------------------
test('Energy only opens things: each figure opens its sheet, each sheet only opens readings, and offline or busy changes nothing', () => {
  for (const f of FIXTURES) {
    const value = page(f), where = f.key;
    assert.deepEqual([value.priceCard, value.year, value.billCard, value.capCard, value.rates].map(c => intentOf(c.link)),
      [['detail', 'price'], ['detail', 'billing-year'], ['detail', 'bill'], ['detail', 'bill'], ['detail', 'price']], where);
    assert.deepEqual(intentOf(value.dayChart.action), ['detail', 'energy-today'], where);
    const shown = controls(value);
    assert.deepEqual([...new Set(shown.map(c => c.command))].sort(), ['detail'], where);
    assert.ok(shown.every(c => c.enabled), `${where}: every link opens`);
    for (const c of shown.filter(c => c.command === 'detail')) assert.ok(ENERGY_DETAILS.some(d => d.id === c.entity), `${where}: ${c.entity}`);
    assert.deepEqual(new Set(shown.filter(c => c.command === 'detail').map(c => c.entity)), new Set(ENERGY_DETAILS.map(d => d.id)), `${where}: every sheet is reachable`);
    for (const extra of [{online: false}, {busy: new Set([E.vacuum, E.bill, 'energy'])}]) {
      assert.deepEqual(controls(page(f, extra)), shown, `${where} ${JSON.stringify(Object.keys(extra))}: changes nothing`);
      for (const d of ENERGY_DETAILS) assert.deepEqual(controls(sheet(f, d.id, extra)), controls(sheet(f, d.id)), `${where} ${d.id}: changes nothing`);
    }
    for (const d of ENERGY_DETAILS) {
      const commands = controls(sheet(f, d.id)).map(c => c.command);
      assert.ok(commands.every(c => ['more', 'ha-energy', 'native-history', 'close'].includes(c)), `${where} ${d.id}: ${commands.join(', ')}`);
      assert.equal(commands.at(-1), 'close', `${where} ${d.id}: closes with close detail`);
    }
  }
});
