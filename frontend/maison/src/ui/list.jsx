// Maison's grouped list (#29): rows on one card surface, as iOS Settings and
// Home draw them, with a hairline between rows that starts where the text
// does. A row that opens something is a React Aria Button, so a press, a tap
// and the keyboard all send its link's intent, and it takes data-pressed,
// data-disabled and data-focus-visible, which list.css.js draws.
//
// What it replaces: ListRow({link, icon, tone, title, detail, trailing,
// style}) at src/parts.jsx, and the rows drawn beside it: system/page.jsx's
// Reading (a value before the chevron), Life's Appliances (a value instead
// of it, until v35) and the collection rows (no tone). The one legacy tone
// name still in use is 'amber' (system.js AlertRow), which TONE_ALIASES
// maps. Blue is no tile tone: in Maison blue means something you can press.
import {Children, useId} from 'react';
import {Button as AriaButton} from 'react-aria-components/Button';
import {useCommand} from '../contexts.js';
import {Glyph} from './glyph.jsx';

/**
 * The tones a row's tile can take, and the legacy names that map onto them.
 * `.m-tone-{tone}` tints the tile with the tone at 20% behind a glyph in the
 * tone's text colour; gray's glyph is --m-label.
 */
export const TONES = ['yellow', 'indigo', 'pink', 'green', 'orange', 'gray'];
export const TONE_ALIASES = {amber: 'orange'};
/** A tone or legacy name as one of TONES; anything else, blue included, is gray. */
export const toneOf = tone => TONE_ALIASES[tone] ?? (TONES.includes(tone) ? tone : 'gray');

/**
 * A list of rows.
 *
 * DOM: `div.m-list.m-list--{inset|plain}[role=list]`, each child wrapped in
 * `div.m-list__item[role=listitem]`, named by `ariaLabel` when there is one.
 * - inset: the card surface (--m-card-fill, 0.5px --m-card-border), radius
 *   --m-radius-card, `overflow:hidden`; rows are padded 16px.
 * - plain: no surface, for a list inside a Card: rows sit flush with the
 *   card's text, and a pressed row's fill reaches 8px past it.
 *
 * @param {object} props
 * @param {'inset'|'plain'} [props.variant='inset']
 * @param {string} [props.ariaLabel]
 * @param {import('react').ReactNode} props.children
 */
export function List({variant = 'inset', ariaLabel, children}) {
  return <div className={`m-list m-list--${variant}`} role="list" aria-label={ariaLabel}>
    {Children.toArray(children).map(child => <div key={child.key} className="m-list__item" role="listitem">{child}</div>)}
  </div>;
}

// What every row draws inside its button or div: the tile, the copy, the
// value, then the accessory, the trailing node or the chevron. `ids` names
// the detail and the value, so a row named by its link's ariaLabel can point
// at them. An unavailable row's tile takes no tone: its reading has none. A
// tinted tile (a zone's room colour) is gray behind a glyph in the tint.
function RowBody({icon, tone, tint, title, badge, detail, value, strong, figure, unavailable, ids, end}) {
  const tinted = tint && !unavailable;
  return <>
    {icon && <span className={unavailable ? 'm-row__tile' : tinted ? 'm-row__tile m-tone-gray m-row__tile--tint' : `m-row__tile m-tone-${toneOf(tone)}`}
      style={tinted ? {color: tint} : undefined}><Glyph name={icon}/></span>}
    <span className="m-row__copy"><span className={strong ? 'm-row__title m-row__title--strong' : 'm-row__title'}>{title}</span>
      {badge && <span className="m-row__badge">{badge}</span>}
      {detail && <span className="m-row__detail" id={ids.detail}>{detail}</span>}</span>
    {value != null && value !== '' && <span className={figure ? 'm-row__value m-row__value--figure m-num' : 'm-row__value m-num'} id={ids.value}>{value}</span>}{end}
  </>;
}

/**
 * One row: a tile, the title over the detail, a value, then a chevron or an
 * accessory.
 *
 * - With a `link` and no `accessory` it is a React Aria Button
 *   `button.m-row.m-row--pressable.m-focusable`; `isDisabled=!link.enabled`;
 *   `onPress → command(link.intent)` through useCommand() from
 *   ../contexts.js. Its name: `aria-label=link.ariaLabel` when the link has
 *   one, with `aria-describedby` pointing at the detail and the value, which
 *   the label would otherwise hide (unless `describe` is false, for a label
 *   that already says them, such as a zone's); else the row's visible text.
 *   Without a link, or with an accessory, it is a static `div.m-row`.
 * - Size: min-height var(--m-row-min) (58), padding 11px 16px, gap 12, items
 *   centred, full width, text left-aligned.
 * - Tile: `span.m-row__tile.m-tone-{tone}`, var(--m-tile) (32) square, radius
 *   --m-radius-tile, the tone at 20% behind an 18px Glyph in the tone.
 *   No `icon`, no tile, and the row takes `.m-row--bare`.
 * - Copy: `span.m-row__copy` holds `span.m-row__title` (body, --m-label; with
 *   `strong`, `.m-row__title--strong` in headline) over `span.m-row__detail`
 *   (subhead, --m-label-2); a long title wraps. `strong` is for a primary
 *   row (a zone, an alert, a setting); list entries keep body.
 * - Value: `span.m-row__value.m-num` (body, --m-label-2), right-aligned, at
 *   most a third of the row: a longer one wraps, so the title keeps its line.
 *   With `figure`, `.m-row__value--figure`: --m-type-figure in --m-label, a
 *   reading such as 19.6°.
 * - Trailing: a `chevron` Glyph (`span.m-row__chevron`, --m-label-3) when
 *   pressable and `trailing === undefined`; `null` draws nothing; anything
 *   else is drawn in `span.m-row__trailing`.
 * - Accessory: drawn in `span.m-row__accessory` in place of the chevron (a
 *   Switch, for instance); the row then stays a div so the accessory keeps
 *   its own press.
 * - Separator: `::after`, 0.5px --m-separator, inset 60px from the left (16px
 *   when there is no icon; 44 and 0 in a plain list), none on the last item,
 *   and hidden on both sides of a pressed or keyboard-focused row.
 * - Pressed: --m-fill-pressed background. Disabled: --m-label-3 text, the
 *   tile dimmed. Keyboard focus: the ring just inside the row.
 * - Unavailable (`unavailable`, static or pressable): the row takes
 *   `.m-row--unavailable` and its tile drops its tone class: no fill, a
 *   1.5px dashed --m-label-3 border (as UnavailableSwitch's track) round a
 *   glyph in --m-label-3; the value (a figure too) is in --m-label-2. The
 *   title, the detail, the chevron, the press and the name are unchanged:
 *   the value's own words ('—', 'Unavailable') say what is missing, so an
 *   unavailable reading never looks like a zero or an off.
 * - Tone: one of TONES, or a legacy name in TONE_ALIASES; default 'gray'.
 * - Tint (v32): a CSS colour, such as tempColour(reading) for a zone. The
 *   tile is gray (`.m-tone-gray.m-row__tile--tint`) behind a glyph in the
 *   tint (inline `color`), in place of the tone. No effect while
 *   `unavailable`.
 * - Badge (v32): a short flag ('Humid'), `span.m-row__badge` after the
 *   title: a neutral gray capsule (--m-fill-gray) of footnote-strong text in
 *   --m-label, on the title's first line; a long title wraps (or clamps in
 *   a widget) beside it, and the detail keeps the line under them.
 * - Without `tint` and `badge` the markup is as before.
 *
 * @param {object} props
 * @param {{intent: object, enabled: boolean, ariaLabel?: string}} [props.link]
 * @param {string} [props.icon]
 * @param {string} [props.tone='gray']
 * @param {string} [props.tint] A CSS colour for the tile's glyph, over the tone; from tempColour().
 * @param {string} props.title
 * @param {string|null} [props.badge] A flag after the title, from the value.
 * @param {string} [props.detail]
 * @param {string} [props.value]
 * @param {boolean} [props.strong=false] The title in headline: a primary row.
 * @param {boolean} [props.figure=false] The value as a figure: a reading.
 * @param {boolean} [props.unavailable=false] The reading is unavailable: drawn apart, never as off.
 * @param {boolean} [props.describe=true] With a link's ariaLabel, describe the row by its detail and value; false when the label already says them.
 * @param {import('react').ReactNode|null} [props.trailing]
 * @param {import('react').ReactNode} [props.accessory]
 */
export function ListRow({link, icon, tone = 'gray', tint, title, badge, detail, value, strong = false, figure = false, unavailable = false, describe = true, trailing, accessory}) {
  const command = useCommand(), id = useId(), pressable = !!link && !accessory;
  const hasValue = value != null && value !== '', ids = {detail: detail ? `${id}-detail` : undefined, value: hasValue ? `${id}-value` : undefined};
  const end = accessory ? <span className="m-row__accessory">{accessory}</span>
    : trailing === undefined ? pressable && <Glyph name="chevron" className="m-row__chevron"/>
      : trailing !== null && <span className="m-row__trailing">{trailing}</span>;
  const body = <RowBody icon={icon} tone={tone} tint={tint} title={title} badge={badge} detail={detail} value={value} strong={strong} figure={figure} unavailable={unavailable} ids={ids} end={end}/>;
  const modifiers = `${icon ? '' : ' m-row--bare'}${unavailable ? ' m-row--unavailable' : ''}`;
  if (!pressable) return <div className={`m-row${modifiers}`}>{body}</div>;
  const described = link.ariaLabel && describe ? [ids.detail, ids.value].filter(Boolean).join(' ') || undefined : undefined;
  return <AriaButton className={`m-row m-row--pressable${modifiers} m-focusable`} aria-label={link.ariaLabel} aria-describedby={described}
    isDisabled={!link.enabled} onPress={() => command(link.intent)}>{body}</AriaButton>;
}
