// The 24-hour recorder chart (#27): the model HistoryChart draws, built
// from the snapshot's per-group Recorder cache, with every phrase the chart
// shows. Nothing here fetches, calls a service, reads the element or reads
// the clock: the snapshot's `now` is the only time it knows. The plot's
// geometry, its ticks and its times stay with the chart in the bundle.
//
// v37: Energy's chart is today's power instead (powerDay): midnight to
// midnight in the house's time zone, the record averaged per half hour.

const DAY = 24 * 60 * 60 * 1000;

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? Number(value)
  : null;

function labelFor(labels, id, index) {
  if (Array.isArray(labels)) return labels[index] || id;
  return labels?.[id] || id;
}

function normalizePoints(points) {
  const byTime = new Map();
  for (const point of Array.isArray(points) ? points : []) {
    const timestamp = new Date(point?.timestamp || NaN).getTime();
    if (!Number.isFinite(timestamp)) continue;
    byTime.set(timestamp, {
      timestamp,
      value: finite(point?.value),
    });
  }
  return [...byTime.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function rangeFor(points) {
  return points.reduce((range, point) => {
    if (point.value === null) return range;
    return {min: Math.min(range.min, point.value), max: Math.max(range.max, point.value)};
  }, {min: Infinity, max: -Infinity});
}

// What a series' values are multiplied by in the merged rows: kW is
// plotted in W, so power from either unit shares one scale.
function scaleFactor(unit) {
  return String(unit || '').trim().toLowerCase() === 'kw' ? 1000 : 1;
}

// A reading as the model writes it: its description uses this, and the
// bundle's copy (history-format.js) reads a value the same.
export function formatHistoryValue(value, unit = '') {
  if (!Number.isFinite(value)) return 'Unavailable';
  const formatted = new Intl.NumberFormat('en-GB', {maximumFractionDigits: 2}).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

// Keep charts bounded even when Recorder returns sub-minute samples. Every
// retained point is an original sample; each bucket keeps extrema and a null
// marker so unavailable periods do not become a continuous line.
export function boundedPoints(points, maximum = 1200) {
  if (points.length <= maximum) return points;
  // Four numeric representatives plus at most one separating gap per adjacent
  // representative stays below the cap with a conservative eight slots/bucket.
  const bucketSize = Math.ceil(points.length / Math.max(1, Math.floor(maximum / 8)));
  const selected = new Set();
  for (let offset = 0; offset < points.length; offset += bucketSize) {
    const bucket = points.slice(offset, offset + bucketSize);
    const numeric = bucket.map((point, index) => ({point, index})).filter(item => Number.isFinite(item.point?.value));
    if (numeric.length) {
      selected.add(offset + numeric[0].index);
      selected.add(offset + numeric[numeric.length - 1].index);
      selected.add(offset + numeric.reduce((best, item) => item.point.value < best.point.value ? item : best).index);
      selected.add(offset + numeric.reduce((best, item) => item.point.value > best.point.value ? item : best).index);
    }
  }
  const numericIndices = [...selected].sort((left, right) => left - right);
  // A gap can occur more than once inside one bucket. Insert an original null
  // point between every retained numeric pair whose source interval had a gap.
  for (let index = 1; index < numericIndices.length; index += 1) {
    const from = numericIndices[index - 1];
    const to = numericIndices[index];
    for (let pointIndex = from + 1; pointIndex < to; pointIndex += 1) {
      if (!Number.isFinite(points[pointIndex]?.value)) {
        selected.add(pointIndex);
        break;
      }
    }
  }
  return [...selected].sort((left, right) => left - right).slice(0, maximum).map(index => points[index]);
}

// Interpolate only between adjacent retained finite samples. A retained null
// makes the whole interval unavailable, so an offline period can never be
// drawn as a continuous line when series timestamps are merged. A stepped
// series (a target) holds each value until the next change instead: a target
// jumps, it never ramps.
function valueAt(points, timestamp, cursor, stepped = false) {
  while (cursor.index + 1 < points.length && points[cursor.index + 1].timestamp <= timestamp) cursor.index += 1;
  const left = points[cursor.index];
  if (!left) return {value: null, exact: false};
  if (left.timestamp === timestamp || stepped) return {value: left.value, exact: left.value !== null};
  const right = points[cursor.index + 1];
  if (!right || left.value === null || right.value === null || right.timestamp <= left.timestamp) {
    return {value: null, exact: false};
  }
  const progress = (timestamp - left.timestamp) / (right.timestamp - left.timestamp);
  return {value: left.value + (right.value - left.value) * progress, exact: false};
}

function mergedRows(series, start, end) {
  const timeline = new Set([start, end]);
  for (const item of series) {
    for (const point of item.points) timeline.add(point.timestamp);
  }
  const timestamps = [...timeline].filter(Number.isFinite).sort((left, right) => left - right);
  const cursors = series.map(() => ({index: -1}));
  return timestamps.map(timestamp => {
    const row = {timestamp};
    series.forEach((item, index) => {
      const sample = valueAt(item.points, timestamp, cursors[index], item.stepped);
      row[item.dataKey] = sample.value === null ? null : sample.value * item.factor;
      row[`${item.dataKey}Exact`] = sample.exact;
    });
    return row;
  });
}

/**
 * Convert one Recorder cache entry into a bounded chart model: its series,
 * their merged rows and every phrase the chart shows. With neither cache
 * bounds nor samples, the window is the 24 hours before `now`, which the
 * caller passes: this never reads the clock.
 */
export function prepareHistoryChart({
  definition,
  history = {series: {}, errors: {}},
  loading = false,
  start,
  end,
  unitFor = () => '',
  timeZone = 'UTC',
  maximumPerSeries = 400,
  now = null,
} = {}) {
  const ids = [...new Set(Array.isArray(definition?.ids) ? definition.ids : [])].slice(0, 3);
  const normalized = ids.map(id => normalizePoints(history?.series?.[id]));
  const allTimestamps = normalized.flatMap(points => points.map(point => point.timestamp));
  const timeRange = allTimestamps.reduce((range, timestamp) => ({
    min: Math.min(range.min, timestamp),
    max: Math.max(range.max, timestamp),
  }), {min: Infinity, max: -Infinity});
  const clock = finite(now) ?? 0;
  const startFallback = allTimestamps.length ? timeRange.min : clock - DAY;
  const endFallback = allTimestamps.length ? timeRange.max : clock;
  const chartStart = finite(start) ?? startFallback;
  const proposedEnd = finite(end) ?? endFallback;
  const chartEnd = proposedEnd > chartStart ? proposedEnd : chartStart + 1;
  const rawSeries = ids.map((id, index) => {
    // Recorder responses occasionally include a state immediately outside the
    // requested window. Keep the plotted domain and extrema tied to the cache
    // window rather than allowing that sample to expand or skew the chart.
    const original = normalized[index].filter(point => point.timestamp >= chartStart && point.timestamp <= chartEnd);
    const numeric = original.filter(point => point.value !== null);
    const range = rangeFor(original);
    const unit = String(unitFor(id) || '');
    const latest = numeric.at(-1)?.value ?? null;
    return {
      id,
      colorIndex: index,
      dataKey: `series${index}`,
      label: labelFor(definition?.labels, id, index),
      stepped: Boolean(definition?.stepped?.[index]),
      // What the series measures, from the definition's `roles` (climate.js:
      // 'room', 'target', 'humidity' or 'probe'), so the chart colours it
      // by meaning; null for a definition that says nothing.
      role: definition?.roles?.[index] ?? null,
      unit,
      factor: scaleFactor(unit),
      points: boundedPoints(original, maximumPerSeries),
      minimum: numeric.length ? range.min : null,
      maximum: numeric.length ? range.max : null,
      latest,
    };
  });
  const hasValues = rawSeries.some(item => item.latest !== null);
  const error = history?.errors?.history ? String(history.errors.history) : '';
  const status = hasValues ? 'ready' : loading ? 'loading' : error ? 'error' : 'empty';
  // The chart always shows the last 24 hours, which its subtitle says, so a
  // definition's "· 24 hours" suffix is not repeated in the title.
  const title = String(definition?.title || 'History').replace(/\s*·\s*24 hours\s*$/i, '');
  const partial = hasValues && Boolean(error);
  return {
    title,
    subtitle: 'Last 24 hours',
    status,
    // What the plot area says instead of a plot: loading is a skeleton with
    // an accessible name, error and empty are one line each.
    stateText: status === 'error' ? 'Recorded values are unavailable right now.'
      : status === 'empty' ? 'No recorded values are available for this period.' : '',
    loadingLabel: 'Loading recorded values',
    partial,
    partialText: partial ? 'Some recorded values could not be loaded.' : '',
    legendLabel: 'Latest recorded values',
    // Read out for the plot, which is otherwise only lines.
    description: rawSeries.filter(item => item.latest !== null).map(item =>
      `${item.label} ranged from ${formatHistoryValue(item.minimum, item.unit)} to ${formatHistoryValue(item.maximum, item.unit)}.`
    ).join(' '),
    plotLabel: `${title}. Use arrow keys to inspect recorded values.`,
    // The plot is an image with no keys to press: its name says what it
    // shows and over when, and no more.
    imageLabel: `${title} over the last 24 hours`,
    // A scrubbed value between two recorded samples is marked.
    interpolatedMark: '~',
    fullLabel: 'Full history',
    // The plot's right edge, which is the snapshot's time.
    nowLabel: 'Now',
    timeZone,
    start: chartStart,
    end: chartEnd,
    series: rawSeries,
    rows: hasValues ? mergedRows(rawSeries, chartStart, chartEnd) : [],
  };
}

/**
 * One chart from the snapshot: the cache group its definition names (a
 * drawer's charts load together and never share a request, an error or a time
 * window with another page's), whether that group is loading, the units Home
 * Assistant reports, and the snapshot's time zone and clock. Null without a
 * definition.
 */
export function historyChart(snapshot, definition) {
  if (!definition) return null;
  const cached = snapshot?.loaded?.history?.[definition.group];
  return prepareHistoryChart({
    definition,
    history: cached?.data,
    loading: snapshot?.loaded?.historyLoading?.has?.(definition.group) || false,
    start: cached?.start,
    end: cached?.end,
    unitFor: id => snapshot?.states?.[id]?.attributes?.unit_of_measurement || '',
    timeZone: snapshot?.tz || 'UTC',
    now: snapshot?.now,
  });
}

// ---- Today's power (v37) ----

/**
 * A half hour: Energy's chart averages the record over each, long enough
 * that a kettle or a dishwasher's heater is a rise, not a spike.
 */
export const DAY_STEP = 30 * 60 * 1000;

// The wall clock in a time zone (UTC when it is unknown), as numbers, one
// formatter per zone.
const CLOCKS = new Map();
function wallClock(timeZone) {
  if (!CLOCKS.has(timeZone)) {
    const options = {year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'};
    let format;
    try { format = new Intl.DateTimeFormat('en-GB', {...options, timeZone}); } catch { format = new Intl.DateTimeFormat('en-GB', {...options, timeZone: 'UTC'}); }
    CLOCKS.set(timeZone, t => Object.fromEntries(format.formatToParts(t).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)])));
  }
  return CLOCKS.get(timeZone);
}

// How far the zone's wall clock is ahead of UTC at `t`, in ms.
function offsetAt(t, timeZone) {
  const c = wallClock(timeZone)(t);
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - Math.floor(t / 1000) * 1000;
}

// The instant the zone's wall clock reads midnight on a date; a day past the
// month's end rolls over, as Date.UTC's does. The offset is read twice, the
// second time at the corrected instant, so a clock change between UTC
// midnight and the zone's lands on the right side.
function midnightOn(year, month, day, timeZone) {
  const wall = Date.UTC(year, month - 1, day);
  return wall - offsetAt(wall - offsetAt(wall, timeZone), timeZone);
}

/**
 * Today in the house's time zone: its midnight and the next, both instants,
 * so a day with a clock change is 23 or 25 hours long.
 * @param {number} now
 * @param {string} [timeZone]
 * @returns {{start: number, end: number}}
 */
export function dayWindow(now, timeZone = 'UTC') {
  const {year, month, day} = wallClock(timeZone)(now);
  return {start: midnightOn(year, month, day, timeZone), end: midnightOn(year, month, day + 1, timeZone)};
}

/**
 * A recorded series' time-weighted mean over each `step` from `start` to
 * `end` (the last step cut at `end`). A sample holds until the next, as a
 * sensor's state does, the last one until `end`; one before `start` holds
 * into it. Unavailable (null) holds nothing, so a step's mean is over the
 * time it was known, and null when it never was. `map` turns each value
 * first (the grid's import is its value above zero).
 * @param {{timestamp: number, value: number|null}[]} points Sorted by time.
 * @returns {(number|null)[]}
 */
export function stepMeans(points, start, end, step, map = value => value) {
  const count = Math.max(0, Math.ceil((end - start) / step)), sums = new Array(count).fill(0), known = new Array(count).fill(0);
  points.forEach((point, index) => {
    if (point.value === null) return;
    const value = map(point.value);
    for (let t = Math.max(point.timestamp, start), to = Math.min(points[index + 1]?.timestamp ?? end, end); t < to;) {
      const at = Math.floor((t - start) / step), edge = Math.min(to, start + (at + 1) * step);
      sums[at] += value * (edge - t);
      known[at] += edge - t;
      t = edge;
    }
  });
  return sums.map((sum, at) => known[at] > 0 ? sum / known[at] : null);
}

/**
 * @typedef {{start: number, end: number, house: number|null, solar: number|null, grid: number|null}} PowerStep
 *   One half hour of today's record, each a mean in W (null where it was never known): the house's
 *   load, solar, and the grid's import (its power above zero, so 0 while exporting). The last step ends
 *   where the record does.
 * @typedef {{status: 'ready'|'loading'|'error'|'empty', when: string, nowLabel: string, stateText: string,
 *   loadingLabel: string, partial: boolean, partialText: string, imageLabel: string, timeZone: string,
 *   start: number, end: number, step: number, rows: PowerStep[]}} PowerDay
 *   Today's power: `when` heads the chart ('Today'), `nowLabel` names the record's last step while it is
 *   scrubbed ('Now'); start and end are midnight and the next (dayWindow's), the plot's time axis. Rows
 *   only while ready.
 */

/**
 * Today's power from the snapshot (v37): the cache group `group` holds, from
 * the element, the record since today's midnight, averaged per DAY_STEP for
 * the house, solar and the grid (each an entity id). A cache that starts at
 * another midnight (yesterday's, until the element loads today's) holds
 * nothing of today. kW is read as W. Never reads the clock: the snapshot's
 * `now` and `tz` are its day.
 * @param {object} snapshot
 * @param {{group: string, house: string, solar: string, grid: string}} source
 * @returns {PowerDay}
 */
export function powerDay(snapshot, {group, house, solar, grid}) {
  const timeZone = snapshot?.tz || 'UTC', {start, end} = dayWindow(finite(snapshot?.now) ?? 0, timeZone);
  const cached = snapshot?.loaded?.history?.[group], today = cached?.start === start ? cached : null;
  const until = Math.min(finite(today?.end) ?? start, end);
  const means = (id, map) => {
    const factor = scaleFactor(snapshot?.states?.[id]?.attributes?.unit_of_measurement);
    return stepMeans(normalizePoints(today?.data?.series?.[id]), start, until, DAY_STEP, value => map(value * factor)).map(w => w === null ? null : Math.round(w));
  };
  const [houses, solars, imports] = [means(house, w => w), means(solar, w => w), means(grid, w => Math.max(0, w))];
  const rows = houses.map((w, i) => ({start: start + i * DAY_STEP, end: Math.min(start + (i + 1) * DAY_STEP, until), house: w, solar: solars[i], grid: imports[i]}));
  const hasValues = rows.some(row => [row.house, row.solar, row.grid].some(w => w !== null));
  const error = today?.data?.errors?.history ? String(today.data.errors.history) : '';
  const loading = snapshot?.loaded?.historyLoading?.has?.(group) || false;
  const status = hasValues ? 'ready' : loading ? 'loading' : error ? 'error' : 'empty', partial = hasValues && Boolean(error);
  return {
    status, when: 'Today', nowLabel: 'Now',
    stateText: status === 'error' ? 'Recorded values are unavailable right now.'
      : status === 'empty' ? 'Nothing recorded yet today.' : '',
    loadingLabel: 'Loading recorded values',
    partial, partialText: partial ? 'Some recorded values could not be loaded.' : '',
    imageLabel: 'Solar, grid and consumption today',
    timeZone, start, end, step: DAY_STEP,
    rows: hasValues ? rows : [],
  };
}
