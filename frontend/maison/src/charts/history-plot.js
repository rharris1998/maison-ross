// The 24-hour chart's geometry (#29 step 4, v32): pure functions from
// history.js's model to what HistoryChart draws, so the component only
// draws and the tests read the maths directly. No React, no DOM, no clock:
// the model's start, end and time zone are the only times it knows.
//
// Every coordinate is in viewBox units, which are pixels at the box's width.
// Energy's chart drew here too from v33 to v36, as power; from v37 it is
// today's power from midnight, its own chart (day.jsx, day-plot.js), which
// takes the round hours and the scrub's slop from here.
import {formatHistoryTime, formatHistoryValue, isolatedPointIndices} from '../history-format.js';
import {tempColour} from '../ui/temp-scale.js';
import {TEMP_SCALE} from '../ui/tokens.js';

/**
 * The drawing's box per sheet placement (ui/sheet.jsx's useSheetPlacement):
 * its height, and the width it takes until the chart has measured the width
 * it is drawn at (then a viewBox unit is a pixel), and on the server. About
 * the bottom sheet's body on a phone and the centred form sheet's (640 less
 * 24 each side). The SVG is never drawn wider than its container.
 */
export const BOXES = Object.freeze({bottom: Object.freeze({width: 343, height: 164}), center: Object.freeze({width: 592, height: 216})});

// Room around the plot: above it for the top gridline's label, under it for
// the time labels, right of it for a scrubbed point's ring; `gap` between a
// label and what it names, and `nowGap` the least between an hour's label
// and Now's, so the two never read as one ("06:00 Now"); `char` a caption
// character's width at most (--m-type-caption, 11px semibold), so labels
// are measured without a DOM.
const TOP = 8, BOTTOM = 22, RIGHT = 7, GAP = 6, NOW_GAP = 16, CHAR = 7;
const QUARTER = 15 * 60000;

// A coordinate to a tenth of a unit, so the markup stays short.
const tenth = n => Math.round(n * 10) / 10;
/** A caption label's width in viewBox units, at most. */
export const labelWidth = label => String(label).length * CHAR;

/**
 * A round step for about `rough` per interval: 1, 2 or 5 times a power of
 * ten, the smallest not under `rough`.
 * @param {number} rough > 0
 */
export function niceStep(rough) {
  const power = 10 ** Math.floor(Math.log10(rough)), share = rough / power;
  return [1, 2, 5, 10].find(n => n >= share - 1e-9) * power;
}

/**
 * The value axis over every finite value: gridlines on multiples of a round
 * step (so zero is one whenever the range crosses it), at least three of
 * them, covering every value. A flat series sits on the middle one.
 * @param {number[]} values Anything not finite is skipped.
 * @param {{intervals?: number, minStep?: number, zero?: boolean}} [options] About how many
 *   intervals, the least step (1 keeps readings in whole units), and whether
 *   the axis always reaches zero.
 * @returns {{low: number, high: number, step: number, ticks: number[]}|null} Null with no value.
 */
export function valueScale(values, {intervals = 3, minStep = 0, zero = false} = {}) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  if (zero) finite.push(0);
  const [min, max] = [Math.min(...finite), Math.max(...finite)];
  const step = Math.max(minStep, niceStep((max - min) / intervals || minStep || Math.abs(max) / 10 || 1));
  let low = Math.floor(min / step + 1e-9) * step, high = Math.ceil(max / step - 1e-9) * step;
  // Fewer than two intervals: widen on the side with less room.
  while ((high - low) / step < 2 - 1e-9) {
    if (min - low < high - max) low -= step; else high += step;
  }
  const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const ticks = Array.from({length: Math.round((high - low) / step) + 1}, (_, i) => Number((low + i * step).toFixed(digits)));
  return {low: ticks[0], high: ticks.at(-1), step, ticks};
}

// The wall clock's hour and minute in a time zone (UTC when it is unknown),
// one formatter per zone.
const CLOCKS = new Map();
function clockIn(timeZone) {
  if (!CLOCKS.has(timeZone)) {
    const options = {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'};
    let format;
    try { format = new Intl.DateTimeFormat('en-GB', {...options, timeZone}); } catch { format = new Intl.DateTimeFormat('en-GB', {...options, timeZone: 'UTC'}); }
    CLOCKS.set(timeZone, t => Object.fromEntries(format.formatToParts(t).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)])));
  }
  return CLOCKS.get(timeZone);
}

/**
 * The round hours between `start` and `end`, both included: every `every`
 * hours of the wall clock in `timeZone` (00:00, 06:00, 12:00, 18:00), with
 * formatHistoryTime's label. Quarter hours are tried, so a zone half or
 * three quarters of an hour off UTC gets its own round hours, and a day
 * with a clock change keeps them.
 * @returns {{timestamp: number, label: string}[]}
 */
export function hourTicks(start, end, timeZone, every = 6) {
  const clock = clockIn(timeZone), ticks = [];
  for (let t = Math.ceil(start / QUARTER) * QUARTER; t <= end; t += QUARTER) {
    const {hour, minute} = clock(t);
    if (minute === 0 && hour % every === 0) ticks.push({timestamp: t, label: formatHistoryTime(t, timeZone)});
  }
  return ticks;
}

/**
 * A series' runs over the model's rows: each unbroken stretch of finite
 * values, as {timestamp, value, index}, so a missing value leaves a gap.
 * @param {object[]} rows history.js's merged rows.
 * @param {string} key The series' dataKey.
 */
export function seriesRuns(rows, key) {
  const out = [];
  let open = false;
  rows.forEach((row, index) => {
    if (!Number.isFinite(row[key])) { open = false; return; }
    if (!open) out.push([]);
    open = true;
    out.at(-1).push({timestamp: row.timestamp, value: row[key], index});
  });
  return out;
}

/**
 * A stepped series' points (step-after: each value holds until the next),
 * only where it changes, then its end.
 * @param {[number, number][]} points
 */
export function steppedPoints(points) {
  return points.reduce((out, [x, y], i) => {
    if (i === 0) return [[x, y]];
    const held = out.at(-1)[1];
    if (y !== held) out.push([x, held], [x, y]);
    else if (i === points.length - 1) out.push([x, y]);
    return out;
  }, []);
}

/** Points as an SVG `points` list, repeats dropped. */
export const pointList = points => points.map(([x, y]) => `${tenth(x)},${tenth(y)}`).filter((p, i, all) => p !== all[i - 1]).join(' ');

/**
 * How a series is painted, by what it measures (its `role`): 'room', 'target',
 * 'humidity' or 'probe'; or, with no role, 'neutral-0…2' by its colour
 * index. Never a hue of its own and never blue.
 */
export const paintOf = series => series.role ?? `neutral-${series.colorIndex % 3}`;

/**
 * Each series' paint and whether it is dashed, in the model's order: the
 * second valve probe is dashed, so two probes in one --m-label stay apart.
 * @returns {{paint: string, dashed: boolean}[]}
 */
export function seriesPaints(model) {
  const probes = model.series.filter(s => s.role === 'probe');
  return model.series.map(s => ({paint: paintOf(s), dashed: probes.indexOf(s) > 0}));
}

/**
 * The room scale's colours up the value axis, as a vertical gradient's stops
 * from `low` (offset 0, the plot's foot) to `high` (1): each end's colour and
 * TEMP_SCALE's stops between them.
 * @returns {{offset: number, colour: string}[]}
 */
export function roomStops(low, high) {
  const at = [low, ...TEMP_SCALE.map(([t]) => t).filter(t => t > low && t < high), high];
  return at.map(t => ({offset: Number(((t - low) / (high - low || 1)).toFixed(4)), colour: tempColour(t)}));
}

/** A reference to an SVG paint server by its id. */
export const paintRef = id => `url(#${id})`;

/**
 * A room colour as the chart hands it to its stylesheet: the element's
 * --m-history-room, which history.css.js paints with, shaded in light so it
 * reads on a light sheet. Undefined without a colour.
 * @param {string|null} colour tempColour's.
 */
export const roomPaint = colour => colour ? {'--m-history-room': colour} : undefined;

/** The least sideways move, in px, that starts a touch scrub. */
export const SCRUB_SLOP = 6;

/**
 * Whether a touch that has moved (dx, dy) px since it came down starts a
 * scrub: its first mostly sideways move of SCRUB_SLOP or more. Anything
 * shorter is a tap or the start of a scroll, which the sheet takes (the plot
 * is pan-y), so the legend never flickers as a scroll begins on the chart.
 */
export const startsScrub = (dx, dy) => Math.abs(dx) >= SCRUB_SLOP && Math.abs(dx) > Math.abs(dy);

/**
 * The index of the row nearest `timestamp` (the earlier on a tie).
 * @param {{timestamp: number}[]} rows Sorted by time.
 * @returns {number} -1 with no rows.
 */
export function nearestRow(rows, timestamp) {
  if (!rows.length) return -1;
  let [low, high] = [0, rows.length - 1];
  while (low < high) {
    const mid = (low + high) >> 1;
    if (rows[mid].timestamp < timestamp) low = mid + 1; else high = mid;
  }
  return low > 0 && timestamp - rows[low - 1].timestamp <= rows[low].timestamp - timestamp ? low - 1 : low;
}

// A target as climate.js's degrees writes it: up to a tenth ('21°', '21.5°').
const TARGET = new Intl.NumberFormat('en-GB', {maximumFractionDigits: 1});

/**
 * A value as the page writes it, so the chart's legend and the sheet's
 * summary agree. In °C with a bare degree: a reading to a tenth ('19.8°', as
 * climate.js's readingText), a target to a tenth at most ('21°', as its
 * degrees). A percentage whole with no space ('48%', as its percent). Any
 * other unit, and no value, as history.js formats it (formatHistoryValue).
 * @param {number|null} value In the series' own unit.
 * @param {string} unit The unit Home Assistant reports.
 * @param {string|null} [role] The series' role: a 'target' is written as one.
 */
export function formatReading(value, unit = '', role = null) {
  if (!Number.isFinite(value)) return formatHistoryValue(null);
  if (unit === '°C') return `${role === 'target' ? TARGET.format(value) : value.toFixed(1)}°`;
  if (unit === '%') return `${Math.round(value)}%`;
  return formatHistoryValue(value, unit);
}

/** The legend's latest values, in the model's legend order, as formatReading writes them. */
export const latestValues = model => model.series.map(s => formatReading(s.latest, s.unit, s.role));

/**
 * The legend's values at a row, in the model's legend order, as
 * formatReading writes them, marked with `model.interpolatedMark` where the
 * row's value was not recorded then.
 * @returns {string[]}
 */
export const legendAt = (model, row) => model.series.map(s => {
  const value = row[s.dataKey], exact = row[`${s.dataKey}Exact`] !== false;
  return Number.isFinite(value) ? `${exact ? '' : model.interpolatedMark}${formatReading(value / s.factor, s.unit, s.role)}` : formatReading(null, s.unit, s.role);
});

/**
 * The legend's entries at `row`, or at the latest values without one, in the
 * model's legend order, each {key, series, label, paint, dashed, value}: a
 * series' label, its paint (seriesPaints') and its value (legendAt's or
 * latestValues').
 * @returns {{key: string, series: object, label: string, paint: string, dashed: boolean, value: string}[]}
 */
export function legendEntries(model, row = null) {
  const values = row ? legendAt(model, row) : latestValues(model), paints = seriesPaints(model);
  return model.series.map((series, i) => ({key: series.id, series, label: series.label, ...paints[i], value: values[i]}));
}

/** A scrubbed row's time, as the chart's header says it. */
export const scrubTime = (model, row) => formatHistoryTime(row.timestamp, model.timeZone, true);

/**
 * Everything a ready model's plot draws, in `box`:
 * - `area`: the plot's rectangle, with the value labels' gutter on its left;
 * - `grid`: a gridline per value tick, {y, label};
 * - `hours`: a line per round hour (every 6), {x, label}, the label '' where
 *   it would run off the box or come within 16 units of the Now label;
 * - `now`: the right edge, {x, label: model.nowLabel};
 * - `gradient`: the room scale's stops up the plot, {y1, y2, stops}, while
 *   a series is a room reading;
 * - `series`: per series, drawn first to last, {key, paint, dashed, lines
 *   (a `points` list per run of two or more), dots (isolated points, {index,
 *   x, y, room}: the row's index, which keys it, since a sensor that blips
 *   puts two dots on one rounded x; room the reading's colour for a room
 *   reading)}; the model's first series (the reading) is drawn last, on top.
 *   The second probe is dashed.
 * - `xOf`, `yOf`, `timeAt`: the scales, and their inverse along x.
 * @param {object} model history.js's model, ready.
 * @param {{width: number, height: number}} box
 */
export function plotLayout(model, box) {
  const {rows, series, start, end} = model, span = end - start || 1;
  const values = rows.flatMap(row => series.map(s => row[s.dataKey]));
  const scale = valueScale(values, {minStep: 1}) ?? {low: 0, high: 1, ticks: [0, 1]};
  const labels = scale.ticks.map(value => formatHistoryValue(value));
  const area = {left: Math.max(...labels.map(labelWidth)) + GAP, right: box.width - RIGHT, top: TOP, bottom: box.height - BOTTOM};
  const xOf = t => area.left + (t - start) / span * (area.right - area.left);
  const yOf = v => area.bottom - (v - scale.low) / (scale.high - scale.low || 1) * (area.bottom - area.top);
  const timeAt = x => start + Math.min(1, Math.max(0, (x - area.left) / (area.right - area.left))) * span;
  const nowEdge = area.right - labelWidth(model.nowLabel) - NOW_GAP;
  const hours = hourTicks(start, end, model.timeZone).map(({timestamp, label}) => {
    const x = tenth(xOf(timestamp)), half = labelWidth(label) / 2;
    return {x, label: x - half >= 0 && x + half <= nowEdge ? label : ''};
  });
  const paints = seriesPaints(model);
  const drawn = series.map((s, i) => {
    const {paint, dashed} = paints[i], isolated = isolatedPointIndices(rows, s.dataKey), runs = seriesRuns(rows, s.dataKey).filter(run => run.length > 1);
    const lines = runs.map(run => {
      const points = run.map(p => [xOf(p.timestamp), yOf(p.value)]);
      return pointList(s.stepped ? steppedPoints(points) : points);
    });
    const dots = [...isolated].map(i => ({index: i, x: tenth(xOf(rows[i].timestamp)), y: tenth(yOf(rows[i][s.dataKey])), room: paint === 'room' ? tempColour(rows[i][s.dataKey] / s.factor) : null}));
    return {key: s.dataKey, paint, dashed, lines, dots};
  });
  return {
    box, area, xOf, yOf, timeAt,
    grid: scale.ticks.map((value, i) => ({y: tenth(yOf(value)), label: labels[i]})),
    hours, now: {x: area.right, label: model.nowLabel},
    gradient: series.some(s => s.role === 'room') ? {y1: tenth(yOf(scale.low)), y2: tenth(yOf(scale.high)), stops: roomStops(scale.low, scale.high)} : null,
    series: drawn.reverse(),
  };
}

/**
 * What a scrub at `row` draws: the rule at its time and a point on each
 * series with a value there, {x, y, key, paint, room}: room is a room
 * reading's colour.
 */
export function scrubMarks(model, layout, row) {
  const x = tenth(layout.xOf(row.timestamp));
  return {x, points: model.series.filter(s => Number.isFinite(row[s.dataKey])).map(s => ({
    x, y: tenth(layout.yOf(row[s.dataKey])), key: s.dataKey, paint: paintOf(s), room: s.role === 'room' ? tempColour(row[s.dataKey] / s.factor) : null,
  }))};
}
