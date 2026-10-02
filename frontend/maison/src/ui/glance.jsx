// Maison's glance chips (#29 step 4): a row of pages at a glance on a phone,
// each a chip with its reading that opens its page, as the concept's
// bubbles. A chip is pressable, but it says so by its shape and its press,
// not by blue: its colour is its tone's dot. The row scrolls sideways on its
// own and snaps chip by chip; it never scrolls or widens the page.
import {Button as AriaButton} from 'react-aria-components/Button';
import {useCommand} from '../contexts.js';
import {Glyph} from './glyph.jsx';
import {TEMP_SCALE} from './tokens.js';

// The room scale, cold to hot, as a dot's background: each of TEMP_SCALE's
// stops at the share of the scale its reading stands at (16° at 0%, 26.5°
// at 100%), so the dot is the capsules' own scale. Computed from the
// tokens, so no colour is written here.
const [COLDEST, HOTTEST] = [TEMP_SCALE[0][0], TEMP_SCALE.at(-1)[0]];
const ROOM_SCALE = `linear-gradient(135deg,${TEMP_SCALE.map(([at, colour]) => `${colour} ${Math.round((at - COLDEST) / (HOTTEST - COLDEST) * 1000) / 10}%`).join(',')})`;

/**
 * The glance chips.
 *
 * DOM: `div.m-glance[role=list][aria-label=label]`, a horizontal scroller
 * that snaps, shows no scrollbar, contains its own overscroll
 * (`overscroll-behavior-x: contain`) and never grows past its container,
 * holding `div.m-glance__item[role=listitem]` per item, each holding a React
 * Aria `button.m-glance__chip.m-focusable` (47px tall, at least 44px) named
 * by `item.link.ariaLabel`, sending `command(item.link.intent)` and disabled
 * while `!item.link.enabled`. Inside the chip: `span.m-glance__dot.m-tone-{tone}`,
 * a 32px dot in the tone (with tone `temperature`, the room scale from
 * TEMP_SCALE as an inline gradient) holding the item's Glyph in
 * --m-on-bright; then `span.m-glance__copy` with `span.m-glance__title`
 * (subhead-strong) over `span.m-glance__line` (footnote, --m-label-2).
 * Bleeding the row to the page's edges is the page's to do.
 *
 * @param {object} props
 * @param {string} props.label The list's accessible name, from the value.
 * @param {{id: string, icon: string, tone: string, title: string, line: string,
 *   link: {intent: object, enabled: boolean, ariaLabel: string}}[]} props.items
 */
export function GlanceChips({label, items}) {
  const command = useCommand();
  return <div className="m-glance" role="list" aria-label={label}>
    {items.map(({id, icon, tone, title, line, link}) => <div key={id} className="m-glance__item" role="listitem">
      <AriaButton className="m-glance__chip m-focusable" aria-label={link.ariaLabel} isDisabled={!link.enabled} onPress={() => command(link.intent)}>
        <span className={`m-glance__dot m-tone-${tone}`} style={tone === 'temperature' ? {background: ROOM_SCALE} : undefined}><Glyph name={icon}/></span>
        <span className="m-glance__copy"><span className="m-glance__title">{title}</span><span className="m-glance__line">{line}</span></span>
      </AriaButton>
    </div>)}
  </div>;
}
