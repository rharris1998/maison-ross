// Climate (#29 step 4, v32), drawn from climate.js's
// value: rows read, sheets change. Under the hero, the room scale's legend,
// then on a phone the House heating card, the zones as one inset list and
// the towel rails; from 700px the value's widgets in a grid, the house and
// the rails medium and each zone a small widget that opens its sheet. The
// page shows readings against targets; every control lives in a sheet, and
// the only writes left here are the House card's one action and the rails'
// Dry towels and Stop. Every word and accessible name comes from the value,
// and every press is a value's Link or Control. A missing reading is the
// value's '—' over a dashed bar, never a zero.
import {IntentButton} from '../ui/button.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {Widget, WidgetGrid, useWidgetSurface} from '../ui/widget.jsx';
import {Figure} from '../ui/figure.jsx';
import {TargetBar} from '../ui/target-bar.jsx';
import {Feedback} from '../ui/feedback.jsx';
import {tempColour} from '../ui/temp-scale.js';
import {useLayout} from '../ui/layout.js';

// The legend under the hero: low, the room scale (climate.css.js paints
// it with the room colours, stop for stop), high, then the target's tick
// and its word. It only explains the capsules and the bars, which are named
// themselves, so it is hidden from assistive technology.
const Scale = ({scale}) => <div className="m-climate__scale" aria-hidden="true">
  <span className="m-climate__scale-end m-num">{scale.low}</span><span className="m-climate__scale-strip"/><span className="m-climate__scale-end m-num">{scale.high}</span>
  <span className="m-climate__scale-key"><span className="m-climate__scale-tick"/>{scale.target}</span>
</div>;

// A reading set large, with its flag ('Humid') beside it, never on a line
// of its own; without a reading its '—' is secondary. Where a named bar
// follows (`named`), the bar's name already starts with the reading, or
// says there is none, so the figure is hidden from assistive technology and
// only the flag is read.
const Reading = ({reading, named = false}) => <div className={typeof reading.bar.plot.reading === 'number' ? 'm-climate__figure' : 'm-climate__figure m-climate__figure--empty'}>
  {named ? <div className="m-climate__figure-value" aria-hidden="true"><Figure value={reading.reading}/></div> : <Figure value={reading.reading}/>}
  {reading.flag && <span className="m-climate__flag">{reading.flag}</span>}
</div>;

// While the heating is quiet (switched off, Away, unknown or not set up)
// on a phone, the House card's first row: the line, then the reading in the
// row figure at its end with its flag, as a zone row ends; with no reading,
// the line alone. There is no bar: nothing runs, or no target shows.
const QuietLine = ({reading}) => <div className="m-climate__quiet">
  <p className="m-climate__line">{reading.line}</p>
  {typeof reading.bar.plot.reading === 'number' && <span className="m-climate__quiet-reading">
    {reading.flag && <span className="m-climate__flag">{reading.flag}</span>}<span className="m-climate__value m-num">{reading.reading}</span>
  </span>}
</div>;

// House heating. On a phone its card: the reading, the bar, the line, the
// caption, the one action (gray, never filled) and what became of it; while
// quiet, compact: the line with the reading at its end, then the caption
// and the action. From 700px the same anatomy as a zone's, so the bars and
// the lines line up across the row: the reading, the bar, then the line, or
// the feedback in its place, then the action, which climate.css.js's grid
// places at the reading's row end, so it is read after what it acts on;
// with no reading, the line takes the reading's row. The caption is the
// sheet's. "Details" opens the House sheet.
function HouseWidget({id, size, value: {house}}) {
  const {reading, action, feedback, quiet} = house, phone = useLayout() === 'phone', known = typeof reading.bar.plot.reading === 'number';
  const button = action && <IntentButton action={action} variant="gray"/>;
  const line = feedback ? <Feedback text={feedback}/> : <p className="m-climate__line">{reading.line}</p>;
  return <Widget id={id} size={size} title={house.title} icon={house.icon} action={house.details}>
    {phone ? <div className={quiet ? 'm-climate__house m-climate__house--quiet' : 'm-climate__house'}>
      {quiet ? <QuietLine reading={reading}/> : <>
        <Reading reading={reading} named/>
        <TargetBar bar={reading.bar} size="wide"/>
        <p className="m-climate__line">{reading.line}</p>
      </>}
      <p className="m-climate__caption">{house.note}</p>
      {button}
      <Feedback text={feedback}/>
    </div> : <div className="m-climate__reading-block">
      {known ? <Reading reading={reading} named/> : <p className="m-climate__line m-climate__lead">{reading.line}</p>}
      <TargetBar bar={reading.bar} size="wide"/>
      {(known || feedback) && line}
      {button}
    </div>}
  </Widget>;
}

// A zone's row: its glyph tinted by its reading on the room scale (a dashed
// tile while there is none), its name in headline with its flag, its line,
// and at the end the reading over its bar. The row opens the zone's sheet
// through `link`, whose name says all the row shows, so the row isn't
// described by its line again.
export function ZoneRow({zone: {reading, opener, link}}) {
  const {plot} = reading.bar, known = typeof plot.reading === 'number';
  return <ListRow link={link} describe={false} icon={opener.icon} tint={known ? tempColour(plot.reading) : undefined} unavailable={!known} strong
    title={opener.name} badge={reading.flag} detail={reading.line}
    trailing={<span className="m-climate__trailing"><span className="m-climate__value m-num">{reading.reading}</span><TargetBar bar={reading.bar} hidden/></span>}/>;
}

// On a phone: every zone in one inset list.
function ZonesWidget({id, size, value: {zonesTitle, zones}}) {
  return <Widget id={id} size={size} title={zonesTitle} surface="none"><List>{zones.map(zone => <ZoneRow key={zone.id} zone={zone}/>)}</List></Widget>;
}

// From 700px: one zone as a small widget that opens its sheet through
// `link`, whose name says all it shows: the reading with its flag, the bar,
// and the line in at most two lines.
function ZoneWidget({id, size, value: {zones}}) {
  const {opener, reading, link} = zones.find(zone => zone.id === id);
  return <Widget id={id} size={size} title={opener.name} icon={opener.icon} link={link}>
    <div className="m-climate__reading-block">
      <Reading reading={reading}/>
      <TargetBar bar={reading.bar} size="wide" hidden/>
      <p className="m-climate__line">{reading.line}</p>
    </div>
  </Widget>;
}

// A rail's press: Dry towels tinted, the page's one write that isn't the
// house's; Stop gray, as every cancel on Climate is.
const railVariant = control => control.intent.command === 'drying-stop' ? 'gray' : 'tinted';

// The rails' rows, primary as the zones' are, each with its line and its
// `action`, Dry towels or Stop, none while the rail can't dry for a lasting
// reason (Away, unavailable), which its line says: a plain list on the
// widget's own surface from 700px, the two rows alone, the caption left to
// the sheet; on a phone an inset list, then the caption as its footer
// while there is one.
function RailRows({rails}) {
  const onSurface = useWidgetSurface();
  return <>
    <List variant={onSurface ? 'plain' : 'inset'}>
      {rails.rows.map(row => <ListRow key={row.name} icon={row.icon} strong title={row.name} detail={row.line} accessory={row.action && <IntentButton action={row.action} variant={railVariant(row.action)}/>}/>)}
    </List>
    {!onSurface && rails.caption && <p className="m-climate__caption m-climate__footer">{rails.caption}</p>}
  </>;
}

// The towel rails, with their glyph. "Details" opens the rails' sheet.
function RailsWidget({id, size, value: {railsTitle, rails}}) {
  return <Widget id={id} size={size} title={railsTitle} icon={rails.icon} action={rails.details} surface="none"><RailRows rails={rails}/></Widget>;
}

// The phone's three widgets; from 700px, the value's, a zone by its id.
const PHONE = [{id: 'house', size: 'medium'}, {id: 'zones', size: 'medium'}, {id: 'rails', size: 'medium'}];
const WIDGETS = {house: HouseWidget, zones: ZonesWidget, rails: RailsWidget};

/**
 * Climate.
 *
 * DOM: `div.m-climate` holding `div.m-climate__scale[aria-hidden=true]`
 * (the legend, from `value.scale`: `span.m-climate__scale-end.m-num` low,
 * `span.m-climate__scale-strip`, the room scale over `scale.plot` (14–26°,
 * painted by climate.css.js), the high end, then
 * `span.m-climate__scale-key` holding `span.m-climate__scale-tick` and the
 * target's word), then a WidgetGrid as a direct child:
 * - phone: three widgets stacked:
 *   - `house`: a Widget with `action={house.details}`, its card holding
 *     `div.m-climate__house`:
 *     - unless `house.quiet`: `div.m-climate__figure` (plus `--empty`
 *       without a reading) holding `div.m-climate__figure-value[aria-hidden=true]`
 *       (a large Figure of `reading.reading`, which the bar's name says),
 *       then `span.m-climate__flag` while there is a flag; a wide
 *       TargetBar (named); `p.m-climate__line`;
 *     - while `house.quiet` (`.m-climate__house--quiet`):
 *       `div.m-climate__quiet` holding `p.m-climate__line`, then, while
 *       there is a reading, `span.m-climate__quiet-reading` (the flag, then
 *       `span.m-climate__value.m-num`); no bar;
 *     - then `p.m-climate__caption` (`house.note`), the `house.action`
 *       IntentButton (gray) while there is one, and Feedback;
 *   - `zones`: `surface="none"`, an inset List of ListRows pressed with
 *     each zone's `link` and named by it, undescribed (`describe={false}`):
 *     strong, `tint` from tempColour, or `unavailable` with no reading;
 *     `badge` the flag; `detail` the line; `trailing`
 *     `span.m-climate__trailing` with `span.m-climate__value.m-num` over a
 *     hidden TargetBar;
 *   - `rails`: `surface="none"`, `icon={rails.icon}` (out of sight on a
 *     phone), `action={rails.details}`, an inset List of strong rail rows
 *     (`icon`, `name`, `line` as the detail, `row.action` as an IntentButton
 *     accessory while there is one: tinted, or gray for `drying-stop`),
 *     then, while `rails.caption` is set, `p.m-climate__caption.m-climate__footer`.
 * - from 700px: `value.widgets` in order, placed by WidgetGrid:
 *   - `house` (medium): `div.m-climate__reading-block` holding, in this
 *     order, the figure (hidden, as on a phone), or with no reading
 *     `p.m-climate__line.m-climate__lead` in its row; the wide TargetBar
 *     (named); the line, or Feedback in its place while there is feedback;
 *     then the action's IntentButton, which the block's grid places at the
 *     reading row's end; no caption;
 *   - each zone (small): a Widget with `link={zone.link}`, its title the
 *     zone's name and glyph, its body `div.m-climate__reading-block`: the
 *     figure with its flag, a wide TargetBar (hidden: the link names it)
 *     and the line, at most two lines;
 *   - `rails` (medium): its glyph, and a plain List of the rail rows alone.
 * No stepper, segmented control or switch: every control is in a sheet.
 *
 * @param {object} props
 * @param {object} props.value climate.js's ClimatePage.
 */
export function ClimatePage({value}) {
  const phone = useLayout() === 'phone', slots = phone ? PHONE : value.widgets;
  return <div className="m-climate">
    <Scale scale={value.scale}/>
    <WidgetGrid>{slots.map(({id, size}) => {const Body = WIDGETS[id] ?? ZoneWidget; return <Body key={id} id={id} size={size} value={value}/>;})}</WidgetGrid>
  </div>;
}
