// Maison's widgets (#29 step 4): the titled blocks a page is composed of. On
// a phone they stack, each a section title over its card or inset list; from
// 700px they sit in a grid of 168px rows, each widget its own surface, sized
// small, medium, large or xl by its value and placed by grid.js's
// placeWidgets(), so the rows the Node tests check for holes are the rows the
// page draws. A widget that opens a page is one press: its title's button
// stretches over the whole widget, and it holds nothing else to press.
import {Children, createContext, isValidElement, useContext} from 'react';
import {Button as AriaButton} from 'react-aria-components/Button';
import {useCommand} from '../contexts.js';
import {Glyph} from './glyph.jsx';
import {IntentButton} from './button.jsx';
import {toneOf} from './list.jsx';
import {COLUMNS, placeWidgets} from './grid.js';
import {useLayout} from './layout.js';

// The placement WidgetGrid gives each child, which the Widget draws as its
// grid lines; null outside a grid and on a phone.
const PlacementContext = createContext(null);
// Whether the widget around a body is itself the surface.
const SurfaceContext = createContext(false);

/**
 * Whether the widget around the caller is itself the surface: true from
 * 700px, where the widget is the card; false on a phone, where the body sits
 * in its own card or brings its own inset List, and outside any widget. A
 * body picks its list from it: `<List variant={onSurface ? 'plain' : 'inset'}>`.
 * @returns {boolean}
 */
export const useWidgetSurface = () => useContext(SurfaceContext);

/**
 * The widgets of a page, in the value's order.
 *
 * DOM, by useLayout():
 * - phone: `div.m-widgets.m-widgets--stack`, the children in order, a
 *   --m-space-6 gap between them; sizes are ignored.
 * - wide and desktop: `div.m-widgets.m-widgets--grid[data-columns=2|4]`
 *   (grid.js's COLUMNS): `grid-template-columns: repeat(n, minmax(0, 1fr))`,
 *   `grid-auto-rows: minmax(var(--m-widget-row), auto)`, gap
 *   var(--m-widget-gap). Each child is placed by placeWidgets() from its
 *   `id` and `size` props, and the Widget draws its placement as inline
 *   `gridColumn` / `gridRow` on its own section, so the sections are the
 *   grid's items with no wrapper between. A child may be any component
 *   with `id` and `size` props that renders a Widget.
 * - With an `ariaLabel`, the div is `role="group"` named by it.
 *
 * @param {object} props
 * @param {string} [props.ariaLabel] An accessible name, from the value.
 * @param {import('react').ReactNode} props.children Widgets, each with `id` and `size`.
 */
export function WidgetGrid({ariaLabel, children}) {
  const layout = useLayout(), items = Children.toArray(children).filter(isValidElement), named = ariaLabel ? {role: 'group', 'aria-label': ariaLabel} : {};
  if (layout === 'phone') return <div className="m-widgets m-widgets--stack" {...named}>{items}</div>;
  const columns = COLUMNS[layout] ?? COLUMNS.wide, {placements} = placeWidgets(items.map(child => ({id: child.props.id, size: child.props.size})), columns);
  return <div className="m-widgets m-widgets--grid" data-columns={columns} {...named}>
    {items.map((child, i) => <PlacementContext.Provider key={child.key} value={placements[i]}>{child}</PlacementContext.Provider>)}
  </div>;
}

// A placement as inline grid lines.
const gridLines = p => p && {gridColumn: `${p.column} / span ${p.columnSpan}`, gridRow: `${p.row} / span ${p.rowSpan}`};

// The title: its glyph (in its tone when it has one), its text (the
// stretched press when there is a link), the note, and a chevron at the end
// when it opens something. A linked widget is read as its press alone, so
// its note is hidden from assistive technology: the link's name says it.
// An unlinked widget may end its title row with an action instead
// ("Details ›"), a button of its own beside the heading, never inside it,
// so the heading reads its title alone; it never stretches over the widget.
function Title({className, icon, tone, title, note, link, action}) {
  const command = useCommand();
  const heading = <h2 className={className}>
    {icon && <Glyph name={icon} className={tone ? `m-widget__glyph m-tone-${toneOf(tone)}` : 'm-widget__glyph'}/>}
    {link ? <AriaButton className="m-widget__press m-focusable" aria-label={link.ariaLabel ?? title} isDisabled={!link.enabled}
      onPress={() => command(link.intent)}>{title}</AriaButton> : <span className="m-widget__text">{title}</span>}
    {note && <span className="m-widget__note" aria-hidden={link ? 'true' : undefined}>{note}</span>}
    {link && <Glyph name="chevron" className="m-widget__chevron"/>}
  </h2>;
  if (link || !action) return heading;
  return <div className="m-widget__head">
    {heading}
    <AriaButton className="m-widget__action m-focusable" aria-label={action.ariaLabel} isDisabled={!action.enabled}
      onPress={() => command(action.intent)}><span className="m-widget__action-label">{action.label}</span><Glyph name="chevron" className="m-widget__action-chevron"/></AriaButton>
  </div>;
}

/**
 * One widget: a title over a body.
 *
 * - Phone: `section.m-widget.m-widget--phone[data-widget=id]` holding
 *   `h2.m-section-title.m-widget__title` (the section title, 22px, over the
 *   body; its glyph is left out of sight, as a section header has none, and
 *   its note takes a line of its own), then `div.m-widget__body`; with
 *   `surface='card'` the body takes `.m-widget__body--card`, the card surface
 *   (--m-card-fill, a 0.5px --m-card-border, radius --m-radius-card, padding
 *   --m-card-padding); `surface='none'` leaves it bare, for a body that
 *   brings its own inset List. Nothing clamps.
 * - Wide and desktop: `section.m-widget.m-widget--{size}[data-widget=id]`,
 *   the surface itself (the card's fill, border, radius and padding), a
 *   column holding `h2.m-widget__title` (20px high: footnote-strong,
 *   --m-label-2, a 15px glyph, then `span.m-widget__note`, one line, cut
 *   short with an ellipsis) and `div.m-widget__body` (`flex: 1; min-height:
 *   0; overflow: hidden`). In a WidgetGrid it carries its placement as
 *   inline gridColumn / gridRow. List rows inside are 52px and each of their
 *   lines clamps to one (widget.css.js's metrics, today.js's WIDGET_ROWS).
 * - Body: a flex column in both layouts, so a child that should fill the
 *   body takes `flex: 1`.
 * - Title: `span.m-glyph.m-widget__glyph` when there is an `icon`, in the
 *   `tone`'s text colour when there is one (`.m-tone-{tone}`, one of
 *   list.jsx's TONES); the title text in `span.m-widget__text`, or, with a
 *   `link`, a React Aria `button.m-widget__press.m-focusable` holding it,
 *   named by `link.ariaLabel` or the title, sending `command(link.intent)`,
 *   disabled while `!link.enabled`, whose `::after` covers the whole widget;
 *   then `span.m-widget__note`; then a `chevron` Glyph (`.m-widget__chevron`)
 *   when there is a link. The focus ring is drawn on the widget
 *   (`.m-widget:has(.m-widget__press[data-focus-visible])`), on a phone
 *   around the title and the body together; a press tints the surface.
 * - A linked widget is one element, as an iOS widget is: its press, named
 *   by `link.ariaLabel`, is all assistive technology reads, and its note and
 *   body are `aria-hidden="true"`, so the link's name must say everything
 *   the body shows.
 * - `more`: an IntentButton, variant plain, `.m-widget__more`, at the
 *   body's foot, its focus ring and hit area never clipped. A widget with a
 *   `link` holds no other pressable, so it draws no `more`, and its body
 *   must hold nothing pressable.
 * - `action` (v32): the title row becomes `div.m-widget__head`, holding
 *   the same h2 (unchanged inside, so the heading reads only its title and
 *   note) and then, as its sibling, a React Aria
 *   `button.m-widget__action.m-focusable` holding
 *   `span.m-widget__action-label` (its label) and a `chevron` Glyph
 *   (`.m-widget__action-chevron`), named by `action.ariaLabel`, sending
 *   `command(action.intent)`, disabled while `!action.enabled`; phone and
 *   grid alike. Its hit area is 44px high, centred on the title, and it
 *   never uses `.m-widget__press`, so it never covers the widget. Without
 *   an action there is no head: the h2 is the section's first child, as
 *   before. It is never drawn with a `link`: there `action` is ignored, and
 *   in development a console error names the widget.
 * - The section has no aria-labelledby, so widgets never become landmarks;
 *   their h2 headings sit under the page's h1.
 * - useWidgetSurface() is true inside it from 700px.
 *
 * @param {object} props
 * @param {string} props.id The value's widget id; WidgetGrid places by it.
 * @param {'small'|'medium'|'large'|'xl'} [props.size='medium'] grid.js's SIZES; ignored on a phone.
 * @param {string} props.title Visible text, from the value.
 * @param {string} [props.icon] A glyph before the title.
 * @param {string} [props.tone] The glyph's tone, such as the live figure's yellow or indigo; label-2 without one.
 * @param {string|null} [props.note] A line after the title, from the value.
 * @param {{intent: object, enabled: boolean, ariaLabel?: string}|null} [props.link] What the whole widget opens; its ariaLabel says all the widget shows.
 * @param {{intent: object, enabled: boolean, label: string}|null} [props.more] The "N more" link at the body's foot; never drawn with a `link`.
 * @param {{intent: object, enabled: boolean, label: string, ariaLabel?: string}|null} [props.action] A link at the title's end ("Details"); ignored with a `link`.
 * @param {'card'|'none'} [props.surface='card'] On a phone: whether the body sits on a card.
 * @param {import('react').ReactNode} props.children The body.
 */
export function Widget({id, size = 'medium', title, icon, tone, note, link, more, action, surface = 'card', children}) {
  const phone = useLayout() === 'phone', placement = useContext(PlacementContext);
  if (process.env.NODE_ENV !== 'production' && link && action) console.error(`Maison Widget ${id}: a widget with a link draws no action; the action is ignored.`);
  const body = <div className={phone && surface === 'card' ? 'm-widget__body m-widget__body--card' : 'm-widget__body'} aria-hidden={link ? 'true' : undefined}>
    {children}{more && !link && <IntentButton action={more} variant="plain" className="m-widget__more"/>}
  </div>;
  return <section className={`m-widget m-widget--${phone ? 'phone' : size}`} data-widget={id} style={phone ? undefined : gridLines(placement)}>
    <SurfaceContext.Provider value={!phone}>
      <Title className={phone ? 'm-section-title m-widget__title' : 'm-widget__title'} icon={icon} tone={tone} title={title} note={note} link={link} action={action}/>
      {body}
    </SurfaceContext.Provider>
  </section>;
}
