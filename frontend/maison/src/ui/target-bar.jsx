// Maison's target bar (#29 step 4): a room reading against its target on
// the room scale, the zone capsules laid down flat, so a zone row or a
// sheet reads "above target" at a glance. The reading is a dot in its room
// colour, the target a tick, and the stretch between them is tinted with
// the reading's colour. A missing reading is a dashed, empty track, never a
// dot at the scale's end; a missing target draws no tick.
import {tempColour} from './temp-scale.js';

const known = value => typeof value === 'number' && Number.isFinite(value);
// A temperature's place on the scale, as a share of the track, clamped.
const place = (value, min, max) => (Math.min(max, Math.max(min, value)) - min) / (max - min) * 100;
const percent = share => `${Number(share.toFixed(3))}%`;

/**
 * A target bar.
 *
 * DOM: `span.m-target-bar.m-target-bar--{row|wide}`, plus
 * `.m-target-bar--empty` with no reading and `.m-target-bar--untargeted`
 * with no target, holding:
 * - `span.m-target-bar__track`, the 4px track (dashed while empty);
 * - `span.m-target-bar__span`, between the reading and the target, inline
 *   `left`/`width` in % and `background: tempColour(reading)`; only with
 *   both a reading and a target;
 * - `span.m-target-bar__tick`, the target, in --m-label, inline `left` in %;
 *   only with a target;
 * - `span.m-target-bar__dot`, the reading, filled with tempColour(reading)
 *   inline, with a 2px ring in the surface colour, inline `left` in %; only
 *   with a reading.
 * Positions are clamped to `[plot.min, plot.max]`.
 * - Naming: `role="img" aria-label={bar.ariaLabel}`; with `hidden`,
 *   `aria-hidden="true"` and no role, for a bar inside a row whose name
 *   already says it.
 * - Sizes: `row` is 78 × 12px; `wide` is 100% × 12px. A dot or tick at the
 *   scale's end is centred on it, 5px past the box.
 * - The tick is drawn over the dot, so a reading at its target reads as a
 *   dot split by the tick. The dot's ring and the tick's notch take the
 *   surface's colour: `--m-target-ring` (a fill, transparent by default)
 *   over `--m-target-ground` (--m-bg by default). Cards, inset lists and
 *   widgets set the ring to --m-card-fill, and a sheet sets the ground to
 *   --m-sheet-fill; a surface of any other colour sets both.
 * - It takes no pointer, and is its own stacking context.
 *
 * @param {object} props
 * @param {{plot: {reading: number|null, target: number|null, min: number, max: number}, ariaLabel: string}} props.bar climate.js's TargetBar.
 * @param {'row'|'wide'} [props.size='row']
 * @param {boolean} [props.hidden=false] Hidden from assistive technology, with no role.
 */
export function TargetBar({bar, size = 'row', hidden = false}) {
  const {plot: {reading, target, min, max}, ariaLabel} = bar, hasReading = known(reading), hasTarget = known(target);
  const classes = ['m-target-bar', `m-target-bar--${size}`, !hasReading && 'm-target-bar--empty', !hasTarget && 'm-target-bar--untargeted'].filter(Boolean).join(' ');
  const naming = hidden ? {'aria-hidden': 'true'} : {role: 'img', 'aria-label': ariaLabel};
  const [r, t] = [hasReading ? place(reading, min, max) : 0, hasTarget ? place(target, min, max) : 0], colour = hasReading ? tempColour(reading) : undefined;
  return <span className={classes} {...naming}>
    <span className="m-target-bar__track"/>
    {hasReading && hasTarget && <span className="m-target-bar__span" style={{left: percent(Math.min(r, t)), width: percent(Math.abs(r - t)), background: colour}}/>}
    {hasTarget && <span className="m-target-bar__tick" style={{left: percent(t)}}/>}
    {hasReading && <span className="m-target-bar__dot" style={{left: percent(r), background: colour}}/>}
  </span>;
}
