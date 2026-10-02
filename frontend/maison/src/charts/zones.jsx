// Climate's header chart (#29 step 3): a capsule per zone, the house first,
// filled from cool to the reading on the temperature scale, with a tick at
// the target. Today's Climate widget (#29 step 4) draws the same capsules at
// widget size, on the card rather than the sky. Every word and accessible
// name comes from the value (climate.js's ZonesHero).
import {useId} from 'react';
import {tempColour} from './scale.js';

// Where every fill starts on the scale, at the capsule's foot: cool, as the
// concept's.
const FILL_FROM = 17;
// The drawing, in viewBox units, per layout. The chart is never drawn wider
// than its box, so a unit is a pixel and the text keeps its type size on
// every phone (narrower than 360px, it shrinks a little; it never grows). On
// a phone the box is 328 wide, centred; from 700px the chart is 470px wide,
// and so is the box, with taller capsules. `top` and `bottom` are the
// capsules' ends; the reading's baseline sits `above` over the top, the
// name's `below` under the foot.
//
// In a widget the box is 520 wide, a medium widget's body on a 1,280px
// desktop, drawn a little smaller in a narrower one: 106 high in a medium
// widget, whose body is 107 (ui/widget.css.js's metrics), with the text
// drawn closer to the shorter capsules; 280 high in a large one, whose body
// is 291, with the hero's spacing.
const BOXES = {
  phone: {width: 328, height: 190, capsule: 40, top: 34, bottom: 160, above: 12, below: 22},
  large: {width: 470, height: 226, capsule: 44, top: 34, bottom: 196, above: 12, below: 22},
  widget: {width: 520, height: 106, capsule: 30, top: 22, bottom: 82, above: 8, below: 18},
  widgetLarge: {width: 520, height: 280, capsule: 40, top: 34, bottom: 246, above: 12, below: 22},
};
// The box for a variant, size and layout: the hero's by layout, the
// widget's by size.
const boxFor = (variant, size, layout) => variant === 'widget' ? size === 'large' ? BOXES.widgetLarge : BOXES.widget
  : layout === 'phone' ? BOXES.phone : BOXES.large;
// The room a name needs on either side of its capsule's centre at the box's
// ends, so the outer names stay inside it and the outer capsules reach
// toward its edges (on desktop, under the tools' end); and the most room
// between two capsules, so a few zones stay together.
const EDGE = 30, MAX_PITCH = 110;
// The least fill a reading shows, so a room at the scale's cold end still
// reads as filled rather than empty.
const MIN_FILL = 6;
// A coordinate to a tenth of a unit, so the markup stays short.
const tenth = n => Math.round(n * 10) / 10;

/**
 * One zone: its track, the fill up to the reading (clipped to the capsule,
 * so the level is flat, as a Control Center slider's), the target's tick,
 * the reading above and the name below. An unavailable reading has no fill
 * and a dashed outline instead of the track, under '—' (the value's).
 */
function Capsule({zone: {name, reading, plot}, cx, box, level, id}) {
  const {capsule: width, top, bottom, above, below} = box, x = tenth(cx - width / 2), known = typeof plot.reading === 'number';
  const fill = known ? Math.min(bottom - MIN_FILL, level(plot.reading)) : bottom;
  const shape = {x, y: top, width, height: bottom - top, rx: width / 2};
  return <g className={known ? 'm-zones__capsule' : 'm-zones__capsule m-zones__capsule--unavailable'}>
    {known && <defs>
      <clipPath id={`${id}-clip`}><rect {...shape}/></clipPath>
      <linearGradient id={`${id}-fill`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" style={{stopColor: tempColour(FILL_FROM)}}/><stop offset="1" style={{stopColor: tempColour(plot.reading)}}/>
      </linearGradient>
    </defs>}
    <rect className="m-zones__track" {...shape}/>
    {known && <rect className="m-zones__fill" x={x} y={fill} width={width} height={bottom - fill} clipPath={`url(#${id}-clip)`} fill={`url(#${id}-fill)`}/>}
    {typeof plot.target === 'number' && <path className="m-zones__tick" d={`M${x - 4} ${level(plot.target)}H${x + width + 4}`}/>}
    <text className="m-zones__reading" x={tenth(cx)} y={top - above} textAnchor="middle" aria-hidden="true">{reading}</text>
    <text className="m-zones__name" x={tenth(cx)} y={bottom + below} textAnchor="middle" aria-hidden="true">{name}</text>
  </g>;
}

/**
 * The zone capsules: an SVG (width 100% up to its box's, role=img named by
 * `value.ariaLabel`, its text aria-hidden) with a Capsule per zone, in the
 * value's order, spread evenly between the box's ends. The scale runs from
 * `value.min` (a capsule's foot) to `value.max` (its top), clamped at both
 * ends. Five zones fit at 343px with their names apart. Gradient and clip ids
 * come from useId, so two charts on a page never share one.
 *
 * DOM: `svg.m-zones` in the hero; `svg.m-zones.m-zones--widget` with
 * `variant="widget"`, 520 × 106 (a medium widget) or 520 × 280 (`size`
 * large), which a widget's own chart colours draw on its card.
 *
 * @param {object} props
 * @param {object} props.value chrome.hero, climate.js's ZonesHero.
 * @param {'night'|'twilight'|'day'|'unknown'} [props.phase] The sky's phase.
 * @param {'phone'|'wide'|'desktop'} [props.layout] The hero's box follows it.
 * @param {'hero'|'widget'} [props.variant='hero']
 * @param {'medium'|'large'} [props.size='medium'] The widget's size, for its box.
 */
export function ZonesChart({value: {zones, min, max, ariaLabel}, layout, variant = 'hero', size = 'medium'}) {
  const id = useId(), box = boxFor(variant, size, layout);
  const pitch = Math.min((box.width - 2 * EDGE) / Math.max(1, zones.length - 1), MAX_PITCH), start = (box.width - pitch * (zones.length - 1)) / 2;
  const level = t => tenth(box.bottom - (Math.min(max, Math.max(min, t)) - min) / (max - min || 1) * (box.bottom - box.top));
  return <svg className={variant === 'widget' ? 'm-zones m-zones--widget' : 'm-zones'} viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label={ariaLabel} style={{maxWidth: `${box.width}px`}}>
    {zones.map((zone, i) => <Capsule key={zone.id} zone={zone} cx={start + pitch * i} box={box} level={level} id={`${id}${i}`}/>)}
  </svg>;
}
