// Energy (#29 step 4, v33), drawn from energy.js's value:
// the page shows figures, and tapping one opens its sheet (Price, Billing
// year, Bill so far). Under the unchanged hero, on a phone the price, the
// billing year's rings, the bill and the cap credit as one inset list, and
// the chart; from 700px the value's widgets on the grid, the chart first,
// Price before it at wide, where the hero doesn't draw the price. A widget
// that opens a sheet is that one press and holds nothing else to press; the
// chart isn't linked, since it scrubs, and its Details (Energy today, v37)
// is the widget's action. Every word comes from the value and every press
// is a value's Link.
import {List, ListRow} from '../ui/list.jsx';
import {Widget, WidgetGrid} from '../ui/widget.jsx';
import {Figure} from '../ui/figure.jsx';
import {Chip} from '../ui/chip.jsx';
import {RingPair} from '../ui/ring.jsx';
import {useLayout} from '../ui/layout.js';
import {DayChart, DAY_PLOT} from '../charts/day.jsx';

// A figure's one line, as the price, the bill and the cap draw it.
const Line = ({text}) => <p className="m-energy__line">{text}</p>;

// The next kilowatt-hour: the all-in price with its unit, the live
// register's chip beside it while it is known, then the line. Opens Price.
function PriceWidget({id, size, value: {priceCard: card}}) {
  return <Widget id={id} size={size} title={card.title} icon={card.icon} link={card.link}>
    <div className="m-energy__price"><Figure value={card.figure} unit={card.unit}/>{card.register && <Chip chip={card.register}/>}</div>
    <Line text={card.line}/>
  </Widget>;
}

// One register's line beside the rings: its name in its tone, then the
// figure with what is left or billed on its baseline.
const RegisterLine = ({line}) => <div className={`m-energy__register m-tone-${line.tone}`}>
  <span className="m-energy__register-name">{line.name}</span>
  <span className="m-energy__register-figure m-num">{line.figure}</span>
  <span className="m-energy__register-line">{line.line}</span>
</div>;

// The billing year, titled by its day: both registers' rings, peak
// outside, beside their two lines. Opens Billing year.
function YearWidget({id, size, value: {year}}) {
  return <Widget id={id} size={size} title={year.title} icon={year.icon} link={year.link}>
    <div className="m-energy__year">
      <RingPair plot={year.rings.plot} size="medium"/>
      <div className="m-energy__registers">{year.registers.map(line => <RegisterLine key={line.name} line={line}/>)}</div>
    </div>
  </Widget>;
}

// From 700px: the bill so far, or the cap credit, as a figure over its
// line. Each opens Bill.
function MoneyCard({id, size, card}) {
  return <Widget id={id} size={size} title={card.title} icon={card.icon} link={card.link}>
    <div className="m-energy__money"><Figure value={card.figure}/></div>
    <Line text={card.line}/>
  </Widget>;
}
const BillWidget = ({id, size, value}) => <MoneyCard id={id} size={size} card={value.billCard}/>;
const CapWidget = ({id, size, value}) => <MoneyCard id={id} size={size} card={value.capCard}/>;

// On a phone: the bill and the cap credit as one inset list with no title
// over it (the rows name themselves), each row its line and its figure (22
// pt, as a reading, since it is the page's money), opening Bill. It sits in
// the stack as a widget does, with no Widget round it, so there is no empty
// heading.
const MoneyList = ({value: {billCard, capCard}}) => <List>
  {[billCard, capCard].map(card => <ListRow key={card.title} link={card.link} title={card.title} detail={card.line} value={card.figure} figure/>)}
</List>;

// Through the day: today's power from midnight (v37), with Details (the
// Energy today sheet) as the widget's action: on a phone's card DAY_PLOT.phone high; in the grid's
// xl widget filling the body (the widget's body is a flex column), the plot
// taking what the figures and any note leave, DAY_PLOT.grid at least.
function ChartWidget({id, size, value: {dayChart}}) {
  const phone = useLayout() === 'phone';
  return <Widget id={id} size={size} title={dayChart.title} icon={dayChart.icon} action={dayChart.action}>
    <DayChart model={dayChart.model} fill={!phone} height={DAY_PLOT[phone ? 'phone' : 'grid']}/>
  </Widget>;
}

// A rate's name after a dot in its register's tone, and on the live one
// its badge ('Now') as a chip in that tone, as the price's register chip.
const RateName = ({row}) => <span className="m-energy__rate">
  <span className={`m-energy__dot m-tone-${row.tone}`}/>{row.name}{row.badge && <Chip chip={{label: row.badge, tone: row.tone}}/>}
</span>;

// From 700px: the supplier's rate per register, each a 36px row with its
// dot, its name, 'Now' on the live one and the rate, then the line that
// says what the rates are (€/kWh, supplier energy only). Opens Price.
function RatesWidget({id, size, value: {rates}}) {
  return <Widget id={id} size={size} title={rates.title} icon={rates.icon} link={rates.link}>
    <div className="m-energy__rates"><List variant="plain">{rates.rows.map(row => <ListRow key={row.name} title={<RateName row={row}/>} value={row.value} figure/>)}</List></div>
    <Line text={rates.line}/>
  </Widget>;
}

// The phone's widgets, in order; from 700px the value's, with Price first
// at wide.
const PHONE = [{id: 'price', size: 'medium'}, {id: 'year', size: 'medium'}, {id: 'money', size: 'medium'}, {id: 'chart', size: 'xl'}];
const WIDE_PRICE = {id: 'price', size: 'medium'};
const WIDGETS = {price: PriceWidget, year: YearWidget, money: MoneyList, bill: BillWidget, cap: CapWidget, chart: ChartWidget, rates: RatesWidget};

/**
 * Energy.
 *
 * DOM: `div.m-energy` holding a WidgetGrid as its direct child (no scale,
 * no intro, and none of the hero's nodes or price):
 * - phone: `price`, `year`, the money list, `chart`, stacked:
 *   - `price` (linked, `priceCard.link`), a card: `div.m-energy__price`
 *     holding a large Figure (`figure`, `unit`) and, while the register is
 *     known, a Chip beside it; then `p.m-energy__line`;
 *   - `year` (linked, `year.link`), a card: `div.m-energy__year` holding a
 *     medium RingPair (96px, `year.rings.plot`) and
 *     `div.m-energy__registers`, a `div.m-energy__register.m-tone-{tone}`
 *     per line holding
 *     `span.m-energy__register-name`, `span.m-energy__register-figure.m-num`
 *     and `span.m-energy__register-line`;
 *   - the money list, no Widget and no heading: an inset List of two
 *     ListRows without tiles, the bill and the cap credit, each with its
 *     `link` (opening Bill), its title, `line` as the detail and `figure`
 *     as the value, drawn as a figure (`figure`);
 *   - `chart` (not linked, `action={dayChart.action}`, Details), a card:
 *     the DayChart of `dayChart.model`, its plot DAY_PLOT.phone high.
 * - from 700px: `value.widgets` in order (chart xl, year M, rates M, bill M,
 *   cap M), placed by WidgetGrid, with `{id: 'price', size: 'medium'}`
 *   first at wide; every row fills at 2 and 4 columns:
 *   - `chart` (xl): the DayChart with `fill`, filling the body, its plot
 *     DAY_PLOT.grid high at least;
 *   - `bill` and `cap` (medium, linked): `div.m-energy__money` holding a
 *     large Figure, then `p.m-energy__line`;
 *   - `rates` (medium, linked, `rates.link`): `div.m-energy__rates`
 *     holding a plain List of the two rate rows, 36px each, each titled by
 *     `span.m-energy__rate` (`span.m-energy__dot.m-tone-{tone}`, the name,
 *     and on the live one a Chip of its `badge` in its tone) with its value
 *     as a figure; then `p.m-energy__line` (`rates.line`), one line;
 *   - the others as on a phone, on the widget's own surface.
 *
 * @param {object} props
 * @param {object} props.value energy.js's EnergyPage.
 */
export function EnergyPage({value}) {
  const layout = useLayout(), slots = layout === 'phone' ? PHONE : layout === 'wide' ? [WIDE_PRICE, ...value.widgets] : value.widgets;
  return <div className="m-energy">
    <WidgetGrid>{slots.map(({id, size}) => {const Body = WIDGETS[id]; return <Body key={id} id={id} size={size} value={value}/>;})}</WidgetGrid>
  </div>;
}
