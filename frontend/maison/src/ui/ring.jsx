// Maison's ring (#29 step 4): a level out of 100 as an arc round a track,
// such as the Car's battery with its ready reserve and charge limit marked
// on it. The track is the tone at 20% and the arc the tone, with round caps,
// from twelve o'clock clockwise, as Apple's activity rings draw; a level of
// 0 is the arc's start cap alone. An unknown level is a thin dashed track
// with nothing filled, never an arc at zero. A tick crosses the ring in a
// notch cut round it, so a gray reserve reads on a gray arc and a limit on
// any tone, whatever the surface behind. Nothing moves.
import {useId} from 'react';

// Each size's geometry in px: its box (the SVG's viewBox is the same, so
// the label's type size is its drawn size), the ring's radius and stroke,
// how far a tick reaches past the track on each side, how thick it is, and
// the notch's clearance on each side of it. A tick's round cap stays inside
// the box: 52 + 6 + 3 + 1.5 < 68 and 31 + 4 + 2 + 1 < 40. The track's
// inside, 92 and 54 across, holds the widest label, '100%', in the styles
// ring.css.js gives each size.
const GEOMETRY = {
  regular: {box: 136, radius: 52, stroke: 12, reach: 3, tick: 3, clearance: 2},
  small: {box: 80, radius: 31, stroke: 8, reach: 2, tick: 2, clearance: 1.5},
};
// The unknown track's dashes: about one every 8px, as many as divide the
// circle evenly, so no short dash is left where it closes.
const DASH_PERIOD = 8;
const clamp = value => Math.min(100, Math.max(0, value));
const known = value => typeof value === 'number' && Number.isFinite(value);
// Three decimals are plenty for a pixel, and keep the markup short.
const px = n => Math.round(n * 1000) / 1000;

// A ring's track and its arc, `stroke` wide at `radius`, filled to `level`
// (0–100, clamped; unknown unless a finite number), as their circles'
// attributes: the track solid in the tone's width, or dashed while unknown,
// the dashes dividing the circle evenly; the arc, drawn only while known,
// one dash in a pattern as long as the circle. A circle's outline starts at
// three o'clock and runs clockwise, so the pattern is offset a quarter of
// the way round to start at twelve without a rotation, which would turn
// Ring's notches with it. Ring and RingPair both draw with it.
function circles(radius, stroke, level) {
  const filled = known(level), length = 2 * Math.PI * radius, arc = filled ? length * clamp(level) / 100 : 0, dash = px(length / Math.round(length / DASH_PERIOD) / 2);
  return {filled, track: {strokeWidth: filled ? stroke : undefined, strokeDasharray: filled ? undefined : `${dash} ${dash}`},
    arc: {strokeWidth: stroke, strokeDasharray: `${px(arc)} ${px(length - arc)}`, strokeDashoffset: px(length / 4)}};
}

// A point `r` from the centre at `at` percent round the ring, clockwise from
// twelve o'clock, `side` px along the ring from there.
function pointAt(centre, at, r, side = 0) {
  const angle = at / 50 * Math.PI, [sin, cos] = [Math.sin(angle), Math.cos(angle)];
  return [px(centre + r * sin + side * cos), px(centre - r * cos + side * sin)];
}

// The mask's path: the whole box, less a notch per tick, a band across the
// ring as wide as the tick and its clearance each side (evenodd leaves
// each notch out).
function notches(geometry, centre, ticks) {
  const {box, radius, stroke, tick, clearance} = geometry, [inner, outer, half] = [radius - stroke / 2 - 1, radius + stroke / 2 + 1, tick / 2 + clearance];
  return [`M0 0H${box}V${box}H0Z`, ...ticks.map(({at}) => `M${[[inner, -half], [outer, -half], [outer, half], [inner, half]]
    .map(([r, side]) => pointAt(centre, at, r, side).join(' ')).join('L')}Z`)].join('');
}

/**
 * A ring.
 *
 * DOM: `svg.m-ring.m-ring--{size}.m-tone-{tone}[role=img][aria-label]`,
 * viewBox and size 136px (`regular`) or 80px (`small`), with `.m-ring--empty`
 * while `value` is null and `.m-ring--stale` while `stale`. Inside: with
 * ticks, `defs` holding `mask.m-ring__mask` (a notch round each tick), which
 * the track and the arc take; `circle.m-ring__track`, the tone at 20%
 * (dashed in --m-label-3 while empty); `circle.m-ring__fill`, the arc in the
 * tone with round caps from twelve o'clock, only while `value` is a number
 * (at 0 its start cap alone); a `line.m-ring__tick.m-ring__tick--{kind}`
 * per tick, crossing the track in its notch, reserve in --m-gray and limit
 * in --m-label; then `text.m-ring__label[aria-hidden=true]`, centred, in
 * --m-type-figure (subhead-strong, rounded, at `small`), when there is a
 * `label`. The children are presentational: the ring is one image named by
 * `ariaLabel`.
 *
 * @param {object} props
 * @param {number|null} props.value 0–100, clamped; null for unknown.
 * @param {{at: number, kind: 'reserve'|'limit'}[]} [props.ticks=[]] Marks on the track, 0–100; one whose `at` is unknown is left out.
 * @param {'yellow'|'indigo'|'pink'|'green'|'orange'|'gray'} [props.tone='green'] The arc's tone.
 * @param {boolean} [props.stale=false] Dims the arc: a level last confirmed, not live.
 * @param {string} [props.label] Drawn in the centre ('62%', '—'), from the value.
 * @param {string} props.ariaLabel The ring's accessible name, from the value.
 * @param {'regular'|'small'} [props.size='regular']
 */
export function Ring({value, ticks = [], tone = 'green', stale = false, label, ariaLabel, size = 'regular'}) {
  const maskId = `m-ring-${useId()}`;
  const shape = GEOMETRY[size] ? size : 'regular', geometry = GEOMETRY[shape], {box, radius, stroke, reach, tick} = geometry, centre = box / 2;
  const {filled, track, arc} = circles(radius, stroke, value), marks = ticks.filter(mark => known(mark.at)).map(mark => ({...mark, at: clamp(mark.at)}));
  const mask = marks.length ? `url(#${maskId})` : undefined;
  const classes = ['m-ring', `m-ring--${shape}`, `m-tone-${tone}`, !filled && 'm-ring--empty', stale && 'm-ring--stale'].filter(Boolean).join(' ');
  return <svg className={classes} role="img" aria-label={ariaLabel} viewBox={`0 0 ${box} ${box}`} width={box} height={box}>
    {mask && <defs><mask className="m-ring__mask" id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={box} height={box}>
      <path className="m-ring__notches" fillRule="evenodd" d={notches(geometry, centre, marks)}/>
    </mask></defs>}
    <circle className="m-ring__track" cx={centre} cy={centre} r={radius} {...track} mask={mask}/>
    {filled && <circle className="m-ring__fill" cx={centre} cy={centre} r={radius} {...arc} mask={mask}/>}
    {marks.map(({at, kind}) => {
      const [x1, y1] = pointAt(centre, at, radius - stroke / 2 - reach), [x2, y2] = pointAt(centre, at, radius + stroke / 2 + reach);
      return <line key={`${kind}-${at}`} className={`m-ring__tick m-ring__tick--${kind}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={tick}/>;
    })}
    {label && <text className="m-ring__label" x={centre} y={centre} textAnchor="middle" dominantBaseline="central" aria-hidden="true">{label}</text>}
  </svg>;
}

// Two rings, one inside the other (v33): Energy's two registers, each the
// share of its export credit used, peak outside and off-peak inside, as
// Apple's activity rings nest. Each is Ring's track and arc in its tone,
// from twelve o'clock; a billing register is the whole ring, and one without
// a reading a dashed track. No label and no name: the register lines beside
// it say every figure. Each size's box, stroke and two radii, outer first,
// in px: the outer ring's edge 1px inside the box, a stroke about an
// eighth of the box, a gap between the rings about a third of a stroke
// (3px, 4px, 5px), so they read as two, and a hole that leaves the pair
// rings, not a disc (32px, 38px and 60px across). The medium pair sits
// beside the two register lines, in the Billing year widget's 107px body
// and on the phone's card; the regular one heads the Billing year sheet;
// the small one is for a tighter place.
const PAIR = {
  regular: {box: 136, stroke: 16, radii: [59, 38]},
  medium: {box: 96, stroke: 12, radii: [41, 25]},
  small: {box: 80, stroke: 10, radii: [34, 21]},
};
// A register's level, 0–100: the whole ring while billing (import past
// export), none while missing, else its share of the credit used.
const levelOf = ({state, share}) => state === 'billing' ? 100 : state === 'missing' || !known(share) ? null : share * 100;

/**
 * A pair of rings.
 *
 * DOM: `svg.m-rings.m-rings--{size}[aria-hidden=true]`, viewBox and size
 * 136px (`regular`), 96px (`medium`) or 80px (`small`), with no role: it is
 * a picture of the lines beside it. It holds a `g.m-rings__ring.m-tone-{tone}`
 * per plot, the first outside (radius 59, 41 or 34) and the second inside
 * (38, 25 or 21), strokes 16, 12 or 10 wide, each with
 * `.m-rings__ring--empty` while missing. In each, `circle.m-rings__track`,
 * the tone at 22% (indigo's at 35% in dark; a thin dashed --m-label-3 line
 * while missing), then, unless missing, `circle.m-rings__fill`, the arc in
 * the tone with round caps from twelve o'clock: the whole ring while
 * billing, else to its share (at 0 its start cap alone). No centre label.
 *
 * @param {object} props
 * @param {{tone: string, share: number|null, state: 'credit'|'billing'|'missing'}[]} props.plot The two rings,
 *   outer first, from the value (energy.js's RingPlot): share 0–1, clamped; `billing` fills the ring and
 *   `missing` (or a share that isn't a number) leaves it empty, whatever the share.
 * @param {'regular'|'medium'|'small'} [props.size='regular']
 */
export function RingPair({plot, size = 'regular'}) {
  const shape = PAIR[size] ? size : 'regular', {box, stroke, radii} = PAIR[shape], centre = box / 2;
  return <svg className={`m-rings m-rings--${shape}`} aria-hidden="true" viewBox={`0 0 ${box} ${box}`} width={box} height={box}>
    {plot.slice(0, 2).map((ring, i) => {
      const radius = radii[i], {filled, track, arc} = circles(radius, stroke, levelOf(ring));
      return <g key={i ? 'inner' : 'outer'} className={`m-rings__ring m-tone-${ring.tone}${filled ? '' : ' m-rings__ring--empty'}`}>
        <circle className="m-rings__track" cx={centre} cy={centre} r={radius} {...track}/>
        {filled && <circle className="m-rings__fill" cx={centre} cy={centre} r={radius} {...arc}/>}
      </g>;
    })}
  </svg>;
}
