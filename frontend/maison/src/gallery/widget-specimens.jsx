// The widgets in the gallery (#29 step 4): the phone stack, then two
// columns as from 700px and four as from 1,100px. Each grid is shown only
// where the gallery is as wide as that layout's narrowest page (652px and
// 1,036px of column), so a specimen is drawn at a width the dashboard draws
// it at and never widens a phone's page. The four columns hold every size
// with a stub body the size the widget leaves it; the two columns and the
// stack draw a list at capacity with "N more", five rows in a large widget,
// linked widgets (a toned glyph, a note in the title) and a row too long for
// one line, which clamps from 700px and wraps on a phone. Gallery words only;
// presses act on nothing.
import {LayoutContext} from '../ui/layout.js';
import {SIZES} from '../ui/grid.js';
import {List, ListRow} from '../ui/list.jsx';
import {Widget, WidgetGrid, useWidgetSurface} from '../ui/widget.jsx';
import {GalleryGroup} from './section.jsx';

const link = ariaLabel => ({intent: {command: 'gallery'}, enabled: true, ariaLabel});
const more = label => ({intent: {command: 'gallery'}, enabled: true, label});
const ALERT = {link: link('Office switch: battery at 16%. Replace it soon'), icon: 'battery', tone: 'orange', title: 'Office switch', detail: 'Battery at 16%. Replace it soon.'};
const EVENTS = [
  {icon: 'life', title: 'Jump rope', detail: 'Tomorrow', value: '07:00'},
  {icon: 'life', title: 'Doctor’s appointment at the clinic on the Rue de la Station, second floor', detail: 'Tomorrow · Partial calendar', value: '17:30'},
  {icon: 'bin', title: 'PMD recycling', detail: 'Collection in 3 days', value: 'Wed'},
  {icon: 'life', title: 'Workout', detail: 'Wed 30 Sep', value: '07:00'},
  {icon: 'life', title: 'Jump rope', detail: 'Thu 1 Oct', value: '07:00'},
].map(row => ({...row, tone: 'gray', link: link(`${row.title}, ${row.detail}`)}));
const CLIMATE_NOTE = 'Heating is off at the thermostat';

// A body of list rows: plain on the widget's own surface, inset on a phone.
function Rows({rows, strong = false}) {
  const onSurface = useWidgetSurface();
  return <List variant={onSurface ? 'plain' : 'inset'}>{rows.map(row => <ListRow key={`${row.title} ${row.detail}`} {...row} strong={strong}/>)}</List>;
}

// A stub body: a dashed box filling what the widget leaves its body.
const Stub = ({children}) => <p className="m-gallery-widgets__stub">{children}</p>;

// The widgets Today is made of, as stubs and rows: Needs you at capacity
// with "N more", the live figure and the Car linked, Climate with its note,
// Coming up with `events`, and Energy today linked.
const needs = <Widget key="needs" id="needs" size="medium" title="Needs you" icon="alert" tone="orange" more={more('2 more')} surface="none"><Rows rows={[ALERT]} strong/></Widget>;
const live = <Widget key="live" id="live" size="small" title="Energy" icon="sun" tone="yellow" link={link('Energy: 2.84 kW solar. Open Energy')}><Stub>The whole widget opens Energy</Stub></Widget>;
const car = <Widget key="car" id="car" size="small" title="Car" icon="car" link={link('Car: 62%, waiting. Open Car')}><Stub>The whole widget opens Car</Stub></Widget>;
const climate = <Widget key="climate" id="climate" size="medium" title="Climate" icon="climate" note={CLIMATE_NOTE} link={link('Climate: 22.7–24.2° inside. Open Climate')}><Stub>A note after the title</Stub></Widget>;
const upcoming = (events, extra) => <Widget key="upcoming" id="upcoming" size="large" title="Coming up" icon="life" more={extra} surface="none"><Rows rows={events}/></Widget>;
const energy = <Widget key="energyToday" id="energyToday" size="medium" title="Energy today" icon="sun" link={link('Energy today: 11.5 kWh solar generated. Open Energy')}><Stub>The whole widget opens Energy</Stub></Widget>;

// Every size, in an order that fills four columns: two smalls and a
// medium, a large beside two mediums, then the extra large.
const SIZED = [['small', 'Small'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['medium', 'Medium'], ['medium', 'Medium'], ['xl', 'Extra large']];

// One specimen: a layout's widgets at the width the gallery gives them.
const Specimen = ({layout, caption, children}) => <figure className={`m-gallery-widgets__specimen m-gallery-widgets__specimen--${layout}`}>
  <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>
  <figcaption className="m-gallery__caption">{caption}</figcaption>
</figure>;

export function WidgetSpecimens() {
  return <GalleryGroup title="Widgets">
    <p className="m-gallery__note">The two-column grid shows from a 700 px window, the four-column one from 1,100 px, each at the width the page gives it there</p>
    <div className="m-gallery-widgets">
      <Specimen layout="phone" caption="On a phone they stack: a section title over a card or an inset list, a chevron after a title that opens a page, and nothing clamps">
        <WidgetGrid>{needs}{upcoming(EVENTS.slice(0, 2), more('3 more'))}{climate}{energy}</WidgetGrid>
      </Specimen>
      <Specimen layout="wide" caption="Two columns, from 700 px: 168 px rows, one line to each row of text, Needs you at capacity with “2 more”, and five rows in a large widget">
        <WidgetGrid>{needs}{live}{car}{climate}{upcoming(EVENTS)}</WidgetGrid>
      </Specimen>
      <Specimen layout="desktop" caption="Four columns, from 1,100 px: small 1 × 1, medium 2 × 1, large 2 × 2 and extra large 4 × 2, each body a stub the size the widget leaves it">
        <WidgetGrid>{SIZED.map(([size, title], i) => <Widget key={`${size}-${i}`} id={`${size}-${i}`} size={size} title={title}><Stub>{SIZES[size].join(' × ')}</Stub></Widget>)}</WidgetGrid>
      </Specimen>
    </div>
  </GalleryGroup>;
}

// The specimens one under another; the grids only where the gallery's column
// is as wide as their layout's narrowest page.
export const widgetSpecimensStyles = `
.m-gallery-widgets{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-7);min-width:0}
.m-gallery-widgets__specimen{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-3);min-width:0}
.m-gallery-widgets__specimen--phone{max-width:343px}
.m-gallery-widgets__specimen--wide{max-width:760px}
.m-gallery-widgets__specimen--wide,.m-gallery-widgets__specimen--desktop{display:none}
@media (min-width:700px){.m-gallery-widgets__specimen--wide{display:grid}}
@media (min-width:1100px){.m-gallery-widgets__specimen--desktop{display:grid}}
.m-gallery-widgets__stub{flex:1;display:grid;place-items:center;box-sizing:border-box;min-height:var(--m-hit);margin:0;padding:var(--m-space-2);border:1px dashed var(--m-separator);border-radius:calc(var(--m-radius-card) - var(--m-card-padding));font:var(--m-type-footnote);color:var(--m-label-2);text-align:center}
.m-widget--phone .m-gallery-widgets__stub{min-height:88px}
`;
