// Energy's chart's geometry (v37): pure functions from energy.js's day
// model (history.js's powerDay, with the day's figures and the rest of the
// solar forecast) to what DayChart draws, so the component only draws and
// the tests read the maths directly. No React, no DOM, no clock: the model's
// midnight, its next midnight and its time zone are the only times it
// knows.
//
// Each half hour's mean is drawn at the middle of its half hour, and a run
// of them also reaches its first step's start and its last one's end, so
// the day's line starts at midnight and ends where the record does. The
// curves are monotone cubics through those points: smooth, never past a
// value on either side of it, so power never dips below zero between two
// steps or peaks over the larger of them.
import {formatHistoryTime} from '../history-format.js';
import {hourTicks} from './history-plot.js';

/**
 * The plot's height: on a phone's card, and in the grid's xl widget from
 * 700px, where it is the least the plot takes while it fills the body. The
 * page passes one as `height`.
 */
export const DAY_PLOT = Object.freeze({phone: 164, grid: 180});
/**
 * The plot's width until it has measured the width it is drawn at, and on
 * the server: a phone's card body (343 less 16 each side).
 */
export const DAY_WIDTH = 311;

// Room around the plot: above it for the top gridline's label, under it for
// the hours; `gap` between a label and what it names; `char` a caption
// character's width at most (--m-type-caption, 11px semibold), so labels
// are measured without a DOM.
const TOP = 8, BOTTOM = 22, GAP = 6, CHAR = 7;
// A coordinate to a tenth of a unit, so the markup stays short.
const tenth = n => Math.round(n * 10) / 10;
/** A caption label's width in viewBox units, at most. */
export const labelWidth = label => String(label).length * CHAR;

// The steps the value axis may take, in W: 1, 2, 2.5 and 5 times a power
// of ten, from 100 W.
const STEPS = [2, 3, 4, 5, 6].flatMap(power => [1, 2, 2.5, 5].map(n => n * 10 ** power));
/**
 * The value axis, from zero: two or three equal steps to the lowest round
 * top over every value with 4% to spare, so no curve touches the top line.
 * Of the tops that fit, the lowest, then the one with fewer steps. With no
 * value above zero, zero alone.
 * @param {(number|null)[]} values In W; anything not finite is skipped.
 * @returns {{top: number, step: number, ticks: number[]}}
 */
export function dayScale(values) {
  const max = Math.max(0, ...values.filter(Number.isFinite)) * 1.04;
  if (!(max > 0)) return {top: 0, step: 0, ticks: [0]};
  const fits = STEPS.map(step => ({step, count: Math.max(2, Math.ceil(max / step - 1e-9))})).filter(({count}) => count <= 3);
  const {step, count} = fits.reduce((best, fit) => fit.step * fit.count < best.step * best.count ? fit : best);
  return {top: step * count, step, ticks: Array.from({length: count + 1}, (_, i) => i * step)};
}

/**
 * A tick as the value axis writes it: zero bare, else in kW on an axis that
 * reaches 1,000 W with trailing zeros dropped ('2 kW', '2.5 kW', '0.5 kW'),
 * else in W ('500 W').
 * @param {number} w In W.
 * @param {boolean} kilo Whether the axis is in kW.
 */
export function dayTick(w, kilo) {
  if (w === 0) return '0';
  return kilo ? `${Number((w / 1000).toFixed(2))} kW` : `${Math.round(w)} W`;
}

/**
 * Power as the figures write it while scrubbing, as model.js's power() does,
 * the number and its unit apart: ['1.52', 'kW'] from 1,000 W, whole watts
 * under (['850', 'W']), ['—', ''] with no number.
 * @param {number|null} w In W.
 * @returns {[string, string]}
 */
export function powerParts(w) {
  if (!Number.isFinite(w)) return ['—', ''];
  return w >= 1000 ? [(w / 1000).toFixed(2), 'kW'] : [String(Math.round(w)), 'W'];
}

/**
 * A run's points as an SVG path's drawing commands after its first point
 * (a monotone cubic, Fritsch–Carlson): `M` it, or `L` it to join another
 * path. Two points are a straight line.
 * @param {[number, number][]} points Sorted by x.
 * @param {'M'|'L'} [start]
 */
export function monotonePath(points, start = 'M') {
  if (!points.length) return '';
  const [x0, y0] = points[0], n = points.length;
  let d = `${start}${tenth(x0)},${tenth(y0)}`;
  if (n === 1) return d;
  const dx = [], slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0] || 1e-9);
    slope.push((points[i + 1][1] - points[i][1]) / dx[i]);
  }
  // The tangent at each point: zero at a peak, a valley or a flat, else
  // the weighted harmonic mean of the slopes either side; at the ends, the
  // one slope there is.
  const tangent = points.map((_, i) => i === 0 ? slope[0] : i === n - 1 ? slope[n - 2]
    : slope[i - 1] * slope[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]));
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3, [x1, y1] = points[i], [x2, y2] = points[i + 1];
    d += `C${tenth(x1 + third)},${tenth(y1 + tangent[i] * third)} ${tenth(x2 - third)},${tenth(y2 - tangent[i + 1] * third)} ${tenth(x2)},${tenth(y2)}`;
  }
  return d;
}

/**
 * A key's runs over the day's steps, {start, end, [key]} each: every
 * unbroken stretch of finite values, as [time, value] points, each step's
 * at its middle, the run reaching its first step's start and its last
 * step's end at their values.
 * @param {object[]} steps Sorted by start.
 * @param {string} key
 * @returns {[number, number][][]}
 */
export function stepRuns(steps, key) {
  const runs = [];
  let open = null;
  for (const step of steps) {
    if (!Number.isFinite(step[key])) { open = null; continue; }
    if (!open) runs.push(open = []);
    open.push(step);
  }
  return runs.map(run => [[run[0].start, run[0][key]], ...run.map(step => [(step.start + step.end) / 2, step[key]]), [run.at(-1).end, run.at(-1)[key]]]);
}

// A run as a curve, and as an area closed down to `base`.
const curveOf = (run, xOf, yOf) => monotonePath(run.map(([t, v]) => [xOf(t), yOf(v)]));
const areaOf = (run, xOf, yOf, base) => `${curveOf(run, xOf, yOf)}L${tenth(xOf(run.at(-1)[0]))},${tenth(base)}L${tenth(xOf(run[0][0]))},${tenth(base)}Z`;

/**
 * Everything a day model's plot draws, in `box`:
 * - `area`: the plot's rectangle, with the value labels' gutter on its right;
 * - `grid`: a line per value tick from zero, {y, label}, the label at the
 *   gutter (dayTick's), from `labelX`;
 * - `hours`: every 6 hours of the wall clock from midnight to the next,
 *   {x, label} ('00', '06', '12', '18'), each label right of its line;
 *   midnight's is the plot's left edge, so it draws only its label;
 * - `solar`: solar's runs, each a curve (`lines`) and an area down to zero
 *   (`areas`);
 * - `house`: the house's runs, each a curve and an area down to zero, which
 *   the plot clips to `above`, so the area shows only where the house drew
 *   more than solar gave: the grid's share;
 * - `above`: the region over solar's curve to the plot's top, solar taken as
 *   zero where it has no value (the inverter asleep), across the house's
 *   span;
 * - `forecast`: the rest of today's forecast as one curve, or '';
 * - `now`: the house's last point, where the record ends, {x, y}, or null;
 * - `gradient`: {y1, y2}, the plot's top and bottom, for the fills;
 * - `xOf`, `yOf`, and `stepAt(x)`: the index of the step under x, the last
 *   one past the record's end, -1 with none.
 * With no rows the plot is its axes alone: the hours and zero.
 * @param {object} model energy.js's day model.
 * @param {{width: number, height: number}} box
 */
export function dayLayout(model, box) {
  const {rows, forecast = [], start, end} = model;
  const scale = dayScale([...rows.flatMap(row => [row.solar, row.house]), ...forecast.map(step => step.solar)]);
  const kilo = scale.top >= 1000, labels = scale.ticks.map(w => dayTick(w, kilo));
  const area = {left: 0, right: box.width - Math.max(...labels.map(labelWidth)) - GAP, top: TOP, bottom: box.height - BOTTOM};
  const span = end - start || 1;
  const xOf = t => area.left + (t - start) / span * (area.right - area.left);
  const yOf = w => scale.top ? area.bottom - w / scale.top * (area.bottom - area.top) : area.bottom;
  const runs = key => stepRuns(rows, key);
  const fill = list => ({lines: list.map(run => curveOf(run, xOf, yOf)), areas: list.map(run => areaOf(run, xOf, yOf, yOf(0)))});
  const [solar, house] = [runs('solar'), runs('house')];
  // Solar as zero where it has no value, over every step the house has.
  const covered = rows.filter(row => Number.isFinite(row.house)), floor = covered.length ? stepRuns(covered.map(row => ({...row, floor: row.solar ?? 0})), 'floor') : [];
  const above = floor.map(run => `${curveOf(run, xOf, yOf)}L${tenth(xOf(run.at(-1)[0]))},${area.top}L${tenth(xOf(run[0][0]))},${area.top}Z`).join('');
  const last = rows.at(-1);
  const stepAt = x => {
    if (!rows.length) return -1;
    const t = start + (x - area.left) / (area.right - area.left) * span, at = rows.findIndex(row => t < row.end);
    return at < 0 ? rows.length - 1 : at;
  };
  return {
    box, area, xOf, yOf, stepAt,
    grid: scale.ticks.map((w, i) => ({y: tenth(yOf(w)), label: labels[i]})), labelX: tenth(area.right + GAP),
    hours: hourTicks(start, end - 1, model.timeZone).map(({timestamp}) => ({x: tenth(xOf(timestamp)), label: formatHistoryTime(timestamp, model.timeZone).slice(0, 2)})),
    solar: fill(solar), house: fill(house), above,
    forecast: forecast.length > 1 ? curveOf(stepRuns(forecast, 'solar')[0] ?? [], xOf, yOf) : '',
    now: last && Number.isFinite(last.house) ? {x: tenth(xOf(last.end)), y: tenth(yOf(last.house))} : null,
    gradient: {y1: area.top, y2: area.bottom},
  };
}

/**
 * What a scrub at step `index` draws: the rule at the step's middle and a
 * point on the house's and solar's curves where each has a value there
 * (solar's only above zero), {x, y, key}.
 */
export function dayMarks(model, layout, index) {
  const row = model.rows[index], x = tenth(layout.xOf((row.start + row.end) / 2));
  return {x, points: [['solar', row.solar > 0 ? row.solar : null], ['house', row.house]].filter(([, w]) => Number.isFinite(w))
    .map(([key, w]) => ({key, x, y: tenth(layout.yOf(w))}))};
}

/**
 * The figures while step `index` is scrubbed, in the model's order: each
 * figure's label and key with the step's mean as powerParts writes it.
 * Grid is the step's import.
 */
export const dayFiguresAt = (model, index) => model.figures.map(figure => {
  const [value, unit] = powerParts(model.rows[index][figure.key]);
  return {...figure, value, unit};
});

/**
 * A scrubbed step's time, as the header says it: its half hour
 * ('14:00–14:30'), or the model's `nowLabel` for the last, which runs to
 * the record's end.
 */
export const dayTime = (model, index) => index === model.rows.length - 1 ? model.nowLabel
  : `${formatHistoryTime(model.rows[index].start, model.timeZone)}–${formatHistoryTime(model.rows[index].end, model.timeZone)}`;
