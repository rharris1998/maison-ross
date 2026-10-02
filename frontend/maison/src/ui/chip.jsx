// Maison's chip (#29 step 4, v33): a short state in a tinted capsule, such
// as the live register ('Peak register', pink, with the sun) beside Energy's
// price, or a sheet's state ('Fully covered', green). It reads; nothing
// presses it. The words and the tone come from the value.
import {Glyph} from './glyph.jsx';
import {toneOf} from './list.jsx';

/**
 * A chip.
 *
 * DOM: `span.m-chip.m-tone-{tone}` holding, when the chip has an `icon`, a
 * Glyph (`span.m-glyph.m-chip__glyph`, 14px), then `span.m-chip__label`
 * (its label). A capsule 24px high, the tone at 16% behind footnote-strong
 * words in the tone's text colour: pink tinted toward --m-label, as a list
 * tile's glyph, indigo and green their *-text tokens, gray the secondary
 * label. It never wraps: a label too long is cut short with an ellipsis.
 *
 * @param {object} props
 * @param {{label: string, tone: string, icon?: string|null}} props.chip From the value: `label` is visible text,
 *   `tone` one of list.jsx's TONES (aliases resolved by toneOf), `icon` a glyph before the label, none without one.
 */
export function Chip({chip: {label, tone, icon}}) {
  return <span className={`m-chip m-tone-${toneOf(tone)}`}>
    {icon && <Glyph name={icon} className="m-chip__glyph"/>}<span className="m-chip__label">{label}</span>
  </span>;
}
