import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedPoints, formatHistoryValue, historyChart, prepareHistoryChart} from '../config/www/maison/history.js';
import {
  formatHistoryTime,
  formatHistoryValue as hoverValue,
  isolatedPointIndices,
} from '../frontend/maison/src/history-format.js';

const at = seconds => new Date(Date.parse('2026-09-16T08:00:00Z') + seconds * 1000).toISOString();
const DAY = 24 * 60 * 60 * 1000;

// A chart definition as climateHistory() gives one, kept under one cache group.
const chart = (ids, labels, title, extra = {}) => ({key: 'climate-attic-temperature', group: 'climate-attic', ids, labels, title, ...extra});
// A snapshot holding that group's cache entry, as element.snapshot() gives it.
function snapshot({series = {}, errors = {}, start, end, units = {}, loading = false, tz = 'Europe/Brussels', now} = {}) {
  return {
    states: Object.fromEntries(Object.entries(units).map(([id, unit]) => [id, {state: '0', attributes: {unit_of_measurement: unit}}])),
    now,
    tz,
    loaded: {
      history: {'climate-attic': {data: {series, errors}, start, end}},
      historyLoading: new Set(loading ? ['climate-attic'] : []),
    },
  };
}

test('history chart preserves unavailable gaps on a merged multi-series timeline', () => {
  const model = historyChart(snapshot({
    series: {
      'sensor.temperature': [
        {timestamp: at(0), value: 20},
        {timestamp: at(60), value: null},
        {timestamp: at(120), value: 22},
      ],
      'sensor.humidity': [
        {timestamp: at(30), value: 45},
        {timestamp: at(90), value: 47},
      ],
    },
    start: Date.parse(at(0)),
    end: Date.parse(at(120)),
    units: {'sensor.temperature': '°C', 'sensor.humidity': '%'},
  }), chart(['sensor.temperature', 'sensor.humidity'], ['Temperature', 'Humidity'], 'Room'));

  assert.equal(model.status, 'ready');
  assert.deepEqual(model.rows.map(row => row.timestamp), [0, 30, 60, 90, 120].map(value => Date.parse(at(value))));
  assert.deepEqual(model.rows.map(row => row.series0), [20, null, null, null, 22]);
  assert.deepEqual(model.rows.map(row => row.series1), [null, 45, 46, 47, null]);
  assert.deepEqual(model.series.map(item => item.unit), ['°C', '%']);
  assert.deepEqual([...isolatedPointIndices(model.rows, 'series0')], [0, 4], 'both one-point runs remain visible');
  assert.deepEqual([...isolatedPointIndices(model.rows, 'series1')], [], 'a continuous run needs no extra dots');
});

test('history chart bounds dense series while retaining extrema and a gap', () => {
  const points = Array.from({length: 5000}, (_, index) => ({
    timestamp: at(index),
    value: index === 2300 ? null : index === 3100 ? 9999 : index % 100,
  }));
  const model = historyChart(snapshot({series: {'sensor.power': points}, units: {'sensor.power': 'W'}}),
    chart(['sensor.power'], ['Power'], 'Power'));

  assert.ok(model.series[0].points.length <= 400);
  assert.equal(model.series[0].minimum, 0);
  assert.equal(model.series[0].maximum, 9999);
  assert.ok(model.series[0].points.some(point => point.value === null));
  assert.ok(model.rows.some(row => row.series0 === null), 'an unavailable sample splits the line');
});

test('downsampling keeps every unavailable interval inside one bucket', () => {
  const points = Array.from({length: 5000}, (_, index) => ({timestamp: at(index), value: 50}));
  points[5].value = null;
  points[10].value = 0;
  points[15].value = null;
  points[20].value = 100;
  const model = prepareHistoryChart({
    definition: {ids: ['sensor.power'], labels: ['Power'], title: 'Power'},
    history: {series: {'sensor.power': points}, errors: {}},
    unitFor: () => 'W',
    maximumPerSeries: 400,
  });

  const retained = model.series[0].points;
  assert.ok(retained.length <= 400);
  assert.deepEqual(retained.filter(point => point.value === null).map(point => point.timestamp),
    [Date.parse(at(5)), Date.parse(at(15))], 'both unavailable intervals split the line');
  assert.deepEqual(retained.slice(0, 5).map(point => point.value), [50, null, 0, null, 100]);
});

test('a series under the cap is kept as it is', () => {
  const points = [{timestamp: 1, value: 1}, {timestamp: 2, value: null}, {timestamp: 3, value: 3}];
  assert.equal(boundedPoints(points), points);
  assert.equal(boundedPoints(points, 3), points);
  assert.ok(boundedPoints(Array.from({length: 50}, (_, index) => ({timestamp: index, value: index})), 16).length <= 16);
});

test('history chart draws at most three series', () => {
  const ids = ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'];
  const model = historyChart(snapshot({
    series: Object.fromEntries(ids.map((id, index) => [id, [{timestamp: at(0), value: index}]])),
  }), chart(ids, ids, 'Chart'));

  assert.equal(model.series.length, 3);
  assert.deepEqual(model.series.map(item => item.id), ['sensor.a', 'sensor.b', 'sensor.c']);
});

test('a kW series is plotted in W, beside one in W, while each keeps its own unit', () => {
  const model = historyChart(snapshot({
    series: {
      'sensor.watts': [{timestamp: at(0), value: 800}],
      'sensor.kilowatts': [{timestamp: at(0), value: 1.2}],
    },
    units: {'sensor.watts': 'W', 'sensor.kilowatts': 'kW'},
  }), chart(['sensor.watts', 'sensor.kilowatts'], ['Home', 'Solar'], 'Power'));

  assert.deepEqual(model.series.map(item => item.factor), [1, 1000]);
  assert.equal(model.series[0].unit, 'W');
  assert.equal(model.series[1].unit, 'kW');
  const sample = model.rows.find(row => row.series0 !== null && row.series1 !== null);
  assert.equal(sample.series0, 800);
  assert.equal(sample.series1, 1200);
  assert.deepEqual(model.series.map(item => formatHistoryValue(item.latest, item.unit)), ['800 W', '1.2 kW'], 'each series reads in its own unit');
  assert.equal(model.description, 'Home ranged from 800 W to 800 W. Solar ranged from 1.2 kW to 1.2 kW.');
});

test('explicit cache bounds exclude old and future samples from rows and extrema', () => {
  const start = Date.parse(at(100));
  const end = Date.parse(at(200));
  const model = historyChart(snapshot({
    series: {'sensor.value': [
      {timestamp: at(0), value: -999},
      {timestamp: at(100), value: 10},
      {timestamp: at(150), value: 15},
      {timestamp: at(200), value: 20},
      {timestamp: at(300), value: 999},
    ]},
    start,
    end,
  }), chart(['sensor.value'], ['Value'], 'Bounded'));

  assert.equal(model.start, start);
  assert.equal(model.end, end);
  assert.deepEqual(model.series[0].points.map(point => point.value), [10, 15, 20]);
  assert.equal(model.series[0].minimum, 10);
  assert.equal(model.series[0].maximum, 20);
  assert.deepEqual(model.rows.map(row => row.timestamp), [start, Date.parse(at(150)), end]);
});

test('history chart distinguishes loading, empty, error, and partial data', () => {
  const definition = chart(['sensor.value'], ['Value'], 'History');
  const empty = {series: {'sensor.value': []}};
  assert.equal(historyChart(snapshot({...empty, loading: true}), definition).status, 'loading');
  assert.equal(historyChart(snapshot(empty), definition).status, 'empty');
  assert.equal(historyChart(snapshot({...empty, errors: {history: 'offline'}}), definition).status, 'error');
  const partial = historyChart(snapshot({series: {'sensor.value': [{timestamp: at(0), value: 1}]}, errors: {history: 'partial'}}), definition);
  assert.equal(partial.status, 'ready');
  assert.equal(partial.partial, true);
});

test('the chart carries every phrase it shows, in each state', () => {
  const definition = chart(['sensor.room', 'sensor.target'], ['Room sensor', 'Target'], 'Temperature and target · 24 hours');
  const units = {'sensor.room': '°C', 'sensor.target': '°C'};
  const room = [{timestamp: at(0), value: 19.25}, {timestamp: at(60), value: 21.456}];
  const phrases = model => [model.stateText, model.partialText];

  const ready = historyChart(snapshot({series: {'sensor.room': room}, units}), definition);
  assert.equal(ready.title, 'Temperature and target', 'the subtitle says 24 hours, so the title does not');
  assert.equal(ready.subtitle, 'Last 24 hours');
  assert.equal(ready.legendLabel, 'Latest recorded values');
  assert.deepEqual(ready.series.map(item => [item.label, item.latest]), [['Room sensor', 21.456], ['Target', null]], 'a series with no samples has no latest value');
  assert.equal(ready.description, 'Room sensor ranged from 19.25 °C to 21.46 °C.', 'a series with no samples is not described');
  assert.equal(ready.plotLabel, 'Temperature and target. Use arrow keys to inspect recorded values.');
  assert.equal(ready.imageLabel, 'Temperature and target over the last 24 hours');
  assert.equal(ready.interpolatedMark, '~');
  assert.equal(ready.nowLabel, 'Now');
  assert.equal(ready.fullLabel, 'Full history');
  assert.deepEqual(phrases(ready), ['', '']);

  const partial = historyChart(snapshot({series: {'sensor.room': room}, errors: {history: 'timeout'}, units}), definition);
  assert.deepEqual(phrases(partial), ['', 'Some recorded values could not be loaded.']);
  const loading = historyChart(snapshot({loading: true, units}), definition);
  assert.deepEqual([loading.status, loading.loadingLabel, ...phrases(loading)], ['loading', 'Loading recorded values', '', '']);
  assert.deepEqual(phrases(historyChart(snapshot({units}), definition)), ['No recorded values are available for this period.', '']);
  assert.deepEqual(phrases(historyChart(snapshot({errors: {history: 'offline'}, units}), definition)), ['Recorded values are unavailable right now.', '']);
  assert.equal(historyChart(snapshot(), {group: 'climate-attic', ids: []}).title, 'History', 'a definition without a title');
});

test('a chart reads the cache group its definition names, with units, time zone and request state', () => {
  const snap = {
    states: {'sensor.office': {state: '19.8', attributes: {unit_of_measurement: '°C'}}},
    tz: 'Europe/Brussels',
    loaded: {
      history: {'climate-attic': {data: {series: {'sensor.office': []}, errors: {}}, start: 1, end: 2}, energy: {data: {series: {}, errors: {history: 'other page'}}}},
      historyLoading: new Set(['climate-attic']),
    },
  };
  const model = historyChart(snap, chart(['sensor.office'], ['Office sensor'], 'Temperature · 24 hours'));
  assert.equal(model.status, 'loading');
  assert.equal(model.timeZone, 'Europe/Brussels');
  assert.equal(model.series[0].unit, '°C');
  assert.equal(formatHistoryTime(Date.parse('2026-09-16T08:00:00Z'), model.timeZone), '10:00');
  assert.equal(historyChart(snap, null), null);
  assert.equal(historyChart(snap, {...chart(['sensor.office'], ['Office sensor'], 'Power'), group: 'energy'}).status, 'error');
});

test('without cache bounds or samples the window is the 24 hours before the snapshot, never the wall clock', () => {
  const now = Date.parse('2026-10-14T07:30:00Z');
  const clock = Date.now;
  Date.now = () => { throw new Error('history.js read the clock'); };
  try {
    const model = historyChart(snapshot({now}), chart(['sensor.value'], ['Value'], 'History'));
    assert.equal(model.status, 'empty');
    assert.equal(model.start, now - DAY);
    assert.equal(model.end, now);
  } finally {
    Date.now = clock;
  }
});

test('a target series holds each value until the next change, to the end of the window', () => {
  const model = historyChart(snapshot({
    series: {
      'sensor.room': [{timestamp: at(0), value: 20}, {timestamp: at(120), value: 22}],
      'sensor.target': [{timestamp: at(0), value: 21}, {timestamp: at(60), value: 16}],
    },
    start: Date.parse(at(0)),
    end: Date.parse(at(180)),
    units: {'sensor.room': '°C', 'sensor.target': '°C'},
  }), chart(['sensor.room', 'sensor.target'], ['Room sensor', 'Target'], 'Temperature and target', {stepped: [false, true]}));
  assert.deepEqual(model.series.map(item => item.stepped), [false, true]);
  assert.deepEqual(model.rows.map(row => row.series1), [21, 16, 16, 16], 'a target jumps and stays');
  assert.deepEqual(model.rows.map(row => row.series1Exact), [true, true, true, true], 'a held value is not an interpolation');
  assert.deepEqual(model.rows.map(row => row.series0), [20, 21, 22, null], 'a reading still ramps and is not extended');
});

test('the legend, the description and a hovered point share one value format', () => {
  assert.equal(formatHistoryValue(21.456, '°C'), '21.46 °C');
  assert.equal(formatHistoryValue(1234.5), '1,234.5');
  assert.equal(formatHistoryValue(null, 'W'), 'Unavailable');
});

// The chart component formats a hovered point itself, and must read it as the
// legend and the description do.
test('a hovered point reads exactly as history.js reads the same value', () => {
  const values = [0, -0, 1, -1, 0.5, 0.004, 0.005, 0.015, 1.005, 19.25, 21.456, -3.333, 999.999, 1000, 1234.5, 12500, -1520, 1e6, 0.1 + 0.2,
    null, undefined, NaN, Infinity, -Infinity, '12', ''];
  for (const unit of ['', '°C', '%', 'W', 'kW', 'kWh', 'bar', '€/kWh', undefined])
    for (const value of values) assert.equal(hoverValue(value, unit), formatHistoryValue(value, unit), `${String(value)} ${String(unit)}`);
  assert.equal(hoverValue(21.456, '°C'), '21.46 °C');
  assert.equal(hoverValue(12500, 'lx'), '12,500 lx', 'grouped in British English, whatever the runtime locale');
});

test('the time axis and a hovered time read in Home Assistant’s time zone, falling back to UTC', () => {
  const at8 = Date.parse('2026-09-16T08:00:00Z');
  assert.equal(formatHistoryTime(at8, 'Europe/Brussels'), '10:00');
  assert.equal(formatHistoryTime(at8, 'UTC'), '08:00');
  assert.match(formatHistoryTime(at8, 'Europe/Brussels', true), /^Wed 16 Sept?, 10:00$/);
  assert.equal(formatHistoryTime(at8, 'Not/AZone'), '08:00', 'an unknown time zone reads as UTC');
  assert.equal(formatHistoryTime(Date.parse('2026-09-16T22:30:00Z'), 'Europe/Brussels'), '00:30', 'a 24-hour clock');
});

test('a point with no neighbour is marked so it still shows', () => {
  const rows = [{a: 1}, {a: null}, {a: 2}, {a: 3}, {a: undefined}, {a: 4}, {a: NaN}];
  assert.deepEqual([...isolatedPointIndices(rows, 'a')], [0, 5]);
  assert.deepEqual([...isolatedPointIndices(null, 'a')], []);
  assert.deepEqual([...isolatedPointIndices([{a: 7}], 'a')], [0], 'a lone sample');
});
