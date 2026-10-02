// Today (#29 step 4), drawn from today.js's value: on a
// phone the glance chips, then Needs you, Coming up and Energy today
// stacked; from 700px the value's widgets in a grid, sized by the value so
// every row fills; then the vacuum's quiet line. Every word and accessible
// name comes from the value, and every press is a value's Link or Control:
// a widget that opens a page is that one press, and holds nothing else to
// press. A missing reading is the value's '—', never a zero: the parts draw
// it apart (a dashed ring, an empty bar, a dashed capsule).
import {IntentButton} from '../ui/button.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {Widget, WidgetGrid, useWidgetSurface} from '../ui/widget.jsx';
import {Ring} from '../ui/ring.jsx';
import {Legend, SegmentBar} from '../ui/segment-bar.jsx';
import {Figure} from '../ui/figure.jsx';
import {GlanceChips} from '../ui/glance.jsx';
import {QuietLine} from '../ui/quiet.jsx';
import {useLayout} from '../ui/layout.js';
import {ZonesChart} from '../charts/zones.jsx';

// While the calendar loads, the shape of a row where the events will be: a
// tile and two lines of fill, still, which assistive technology skips, and
// the value's loadingLabel, which only it reads.
const Placeholder = ({label}) => <div className="m-row m-today__placeholder">
  <span className="m-today__placeholder-tile" aria-hidden="true"/>
  <span className="m-today__placeholder-copy" aria-hidden="true"><span className="m-today__placeholder-line"/><span className="m-today__placeholder-line m-today__placeholder-line--short"/></span>
  {label && <span className="m-today__hidden">{label}</span>}
</div>;

// A widget's rows, each opening what its link opens: a plain list on the
// widget's own surface from 700px, an inset one on a phone; then the note,
// a row without a tile that opens what its link opens, drawn muted.
function Rows({rows, strong = false, note = null}) {
  const onSurface = useWidgetSurface();
  return <List variant={onSurface ? 'plain' : 'inset'}>
    {rows.map((row, i) => <ListRow key={`${i}-${row.title}`} link={row.link} icon={row.icon} tone={row.tone} title={row.title} detail={row.detail} value={row.value} strong={strong}/>)}
    {note && <ListRow key="note" link={note.link} title={note.text}/>}
  </List>;
}

// Needs you: the alerts, each opening its entity, in headline, then "N more".
function NeedsWidget({id, size, value: {needs}}) {
  return <Widget id={id} size={size} title={needs.title} icon={needs.icon} more={needs.more} surface="none"><Rows rows={needs.rows} strong/></Widget>;
}

// Coming up: while the calendar loads, a placeholder in the events' place,
// the whole busy; the collection and the events with their time or day at
// the end, the calendar's error as a muted row that opens the Full calendar;
// then "N more".
// On a phone the agenda is the card, which the list draws on.
function UpcomingWidget({id, size, value: {upcoming: {title, icon, loading, loadingLabel, rows, note, more}}}) {
  return <Widget id={id} size={size} title={title} icon={icon} more={more} surface="none">
    <div className="m-today__agenda" aria-busy={loading ? 'true' : undefined}>
      {loading && <Placeholder label={loadingLabel}/>}
      {(rows.length > 0 || note) && <Rows rows={rows} note={note}/>}
    </div>
  </Widget>;
}

// The Car: its battery as a ring, with the ready reserve and the charge
// limit marked, beside its headline and when the level was last confirmed.
// The whole widget opens the Car.
function CarWidget({id, size, value: {car, carRing}}) {
  const {bar} = car, ring = useLayout() === 'phone' ? 'regular' : 'small';
  const ticks = [{at: bar.reserve, kind: 'reserve'}, {at: bar.limit, kind: 'limit'}].filter(tick => typeof tick.at === 'number');
  return <Widget id={id} size={size} title={car.title} icon={carRing.icon} link={car.link}>
    <div className="m-today__car">
      <Ring value={bar.fill} ticks={ticks} tone={carRing.tone} stale={bar.stale} label={carRing.label} ariaLabel={bar.ariaLabel} size={ring}/>
      <div className="m-today__copy"><p className="m-today__headline">{car.headline}</p>{car.lastConfirmed && <p className="m-today__line">{car.lastConfirmed}</p>}</div>
    </div>
  </Widget>;
}

// Power now: the figure, then where it comes from and goes; the title's
// glyph is its source in its tone. The whole widget opens Energy.
function LiveWidget({id, size, value: {live}}) {
  return <Widget id={id} size={size} title={live.title} icon={live.icon} tone={live.tone} link={live.link}>
    <div className="m-today__live"><Figure value={live.figure.value} unit={live.figure.unit}/><p className="m-today__line">{live.line}</p></div>
  </Widget>;
}

// The zones' capsules at the widget's size, with Climate's line after the
// title. The whole widget opens Climate.
function ClimateWidget({id, size, value: {climate}}) {
  return <Widget id={id} size={size} title={climate.title} icon={climate.icon} note={climate.note} link={climate.link}>
    <div className="m-today__zones"><ZonesChart value={climate.chart} variant="widget" size={size}/></div>
  </Widget>;
}

// Today's energy: solar generated, then the split of what was used at home,
// exported and taken from the grid, and its legend; an empty bar is dashed
// while a reading is missing and solid at a real zero. The label sits beside
// the figure in the grid, where the widget is one row high. The whole widget
// opens Energy.
function EnergyWidget({id, size, value: {energyToday: {title, icon, figure, bar, legend, link}}}) {
  const phone = useLayout() === 'phone';
  return <Widget id={id} size={size} title={title} icon={icon} link={link}>
    <div className="m-today__energy">
      <Figure label={figure.label} value={figure.value} unit={figure.unit} labelPlacement={phone ? 'above' : 'beside'}/>
      <div className="m-today__split"><SegmentBar segments={bar.segments} ariaLabel={bar.ariaLabel} empty={bar.kind === 'zero' ? 'zero' : 'missing'}/><Legend items={legend}/></div>
    </div>
  </Widget>;
}

// Each widget by the value's id.
const WIDGETS = {needs: NeedsWidget, car: CarWidget, live: LiveWidget, climate: ClimateWidget, upcoming: UpcomingWidget, energyToday: EnergyWidget};
// On a phone the chips stand in for the Car, power now and Climate: Needs
// you, Coming up and Energy today stack, those the value has.
const PHONE = ['needs', 'upcoming', 'energyToday'];

/**
 * Today.
 *
 * DOM: `div.m-today` holding, on a phone, GlanceChips (`value.glance`),
 * bled to the page's edges, then a stacked WidgetGrid of Needs you, Coming
 * up and Energy today, those the value has; from 700px a WidgetGrid of
 * `value.widgets` in order, each at its size; then, while
 * `value.vacuumLine` is set, a QuietLine holding IntentButtons for
 * `value.vacuum.run` (tinted) and `.dock` (gray) while it is active.
 *
 * Widgets carry the value's glyph (`icon`), in a tone only for live. Their
 * bodies (today.css.js lays them out):
 * - needs: a List (inset on a phone, plain on the widget) of strong
 *   ListRows, then the widget's `more`.
 * - upcoming: `div.m-today__agenda`, `aria-busy="true"` while loading,
 *   holding first, while loading, `div.m-row.m-today__placeholder` (its
 *   shapes aria-hidden, `span.m-today__hidden` holding `loadingLabel`), then
 *   a List of ListRows with each row's value at its end, and the note as a
 *   last ListRow without a tile, opening `note.link`; then the widget's
 *   `more`. On a phone the agenda is the card and the inset List drops its
 *   own surface.
 * - car: `div.m-today__car`, a Ring (80px from 700px) from `car.bar` and
 *   `carRing`, beside `div.m-today__copy` (the headline, then
 *   `lastConfirmed`). Opens `car.link`.
 * - live: `div.m-today__live`, a Figure then `p.m-today__line`; the title's
 *   glyph in `live.tone`. Opens `live.link`.
 * - climate: `div.m-today__zones`, ZonesChart variant widget at the
 *   widget's size, `climate.note` after the title. Opens `climate.link`.
 * - energyToday: `div.m-today__energy`, a Figure (its label beside it from
 *   700px), then `div.m-today__split`, the SegmentBar (empty as `zero` or
 *   `missing` by `bar.kind`) over the Legend. Opens `energyToday.link`.
 *
 * @param {object} props
 * @param {object} props.value today.js's TodayPage.
 */
export function TodayPage({value}) {
  const phone = useLayout() === 'phone', {glance, widgets, vacuumLine, vacuum} = value;
  const slots = phone ? PHONE.filter(id => value[id]).map(id => widgets.find(slot => slot.id === id) ?? {id, size: 'medium'}) : widgets;
  return <div className="m-today">
    {phone && <GlanceChips label={glance.label} items={glance.items}/>}
    <WidgetGrid>{slots.map(({id, size}) => {const Body = WIDGETS[id]; return <Body key={id} id={id} size={size} value={value}/>;})}</WidgetGrid>
    {vacuumLine && <QuietLine icon={vacuumLine.icon} text={vacuumLine.text}>
      {vacuumLine.active && [<IntentButton key="run" action={vacuum.run} variant="tinted"/>, <IntentButton key="dock" action={vacuum.dock} variant="gray"/>]}
    </QuietLine>}
  </div>;
}
