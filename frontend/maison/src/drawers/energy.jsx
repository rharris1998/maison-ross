// Energy's sheets (#29 step 4, v33): Price, Billing year,
// Bill so far and Energy today, drawn in Maison's Sheet from energy.js's
// Drawer bodies as iOS grouped sections, as Climate's are: each headed by a
// value's words over an inset list or a card, with a caption under it where
// the value has one, and Why last but for the Bill's and Energy today's
// links, collapsed. The
// summary is bare on the sheet, as Climate's is. Nothing is composed in
// React: every word, heading and caption is the value's. Energy's sheets
// only read and open: their only presses are rows and links that open a
// reading, Home Assistant's energy dashboard or its power history, so no
// button is filled.
//
// A register is marked by its tone wherever it is named (pink peak, indigo
// off-peak): in its colour beside the rings, as the page draws it, and by a
// dot before its name in a heading or a rate row. A state chip (Fully
// covered, Billing, Binding) sits at its section heading's far end.
import {IntentButton} from '../ui/button.jsx';
import {Card} from '../ui/card.jsx';
import {Chip} from '../ui/chip.jsx';
import {Disclosure} from '../ui/disclosure.jsx';
import {Figure} from '../ui/figure.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {RingPair} from '../ui/ring.jsx';
import {SegmentBar} from '../ui/segment-bar.jsx';

// A register's tone as a dot, before its name.
const Dot = ({tone}) => <span className={`m-energy-sheet__dot m-tone-${tone}`}/>;

// A section's heading from the value, after its register's dot while it has
// a tone.
const Heading = ({title, tone}) => <h3 className="m-energy-sheet__heading">{tone && <Dot tone={tone}/>}{title}</h3>;

// One grouped section: its heading from the value (none without one), with
// its state chip at the heading's far end while it has one, what it groups,
// then its footer caption.
const Section = ({title, tone, chip, footer, children}) => <section className="m-energy-sheet__section">
  {chip ? <div className="m-energy-sheet__head"><Heading title={title} tone={tone}/><Chip chip={chip}/></div> : title && <Heading title={title} tone={tone}/>}
  {children}{footer && <p className="m-energy-sheet__footer">{footer}</p>}
</section>;

// A Rich line: its strong parts bold. A caption under a list, or the
// card's words on a card.
const Rich = ({parts}) => <p className="m-energy-sheet__note">{parts.map((part, i) => typeof part === 'string' ? part : <strong key={i}>{part.strong}</strong>)}</p>;

// Why, collapsed: a card of the value's paragraphs.
const Why = ({why}) => <Disclosure title={why.title}><div className="m-energy-sheet__panel">
  <Card as="div" className="m-energy-sheet__card">{why.paragraphs.map((text, i) => <p key={i} className="m-energy-sheet__text">{text}</p>)}</Card>
</div></Disclosure>;

// The register lines beside the rings, as the page draws them: the name in
// its tone, the figure, then the line.
const RegisterLines = ({registers}) => <div className="m-energy-sheet__registers">{registers.map(line =>
  <p key={line.name} className={`m-energy-sheet__register m-tone-${line.tone}`}>
    <span className="m-energy-sheet__register-name">{line.name}</span>
    <span className="m-energy-sheet__register-figure m-num">{line.figure}</span>
    <span className="m-energy-sheet__register-line">{line.line}</span>
  </p>)}</div>;

// A register's imported and exported energy: a row per bar, its label, an
// 8px capsule filled to its width in its tone, then its value.
const Ledger = ({bars}) => <div className="m-energy-ledger">{bars.map(bar => <div key={bar.label} className="m-energy-ledger__row">
  <span className="m-energy-ledger__label">{bar.label}</span>
  <span className="m-energy-ledger__bar"><i className={`m-energy-ledger__fill m-tone-${bar.tone}`} style={{width: `${bar.width}%`}}/></span>
  <span className="m-energy-ledger__value m-num">{bar.value}</span>
</div>)}</div>;

// A rate row's title: the register's dot and name, then, on the live one,
// its badge as a chip in the register's tone.
const RateName = ({row}) => <><Dot tone={row.tone}/>{row.name}{row.badge && <Chip chip={{label: row.badge, tone: row.tone}}/>}</>;

// Rows of a label and its value, as a list shows a setting's reading: an
// array, so List gives each row its own item.
const rowsOf = rows => rows.map(row => <ListRow key={row.label} title={row.label} value={row.value}/>);

/**
 * The Price sheet's body.
 *
 * DOM: `div.m-energy-sheet.m-energy-sheet--price` holding, in order:
 * - `section.m-energy-sheet__summary`: `div.m-energy-sheet__price` holding a
 *   large Figure (`summary.figure`, `summary.unit`), as every sheet leads
 *   with, and, while the register is known, its Chip beside it (under it
 *   where the two don't fit); then `p.m-energy-sheet__line` (`summary.line`);
 * - `section.m-energy-sheet__section` headed `rates.heading`
 *   (`h3.m-energy-sheet__heading`): an inset List of the two rate rows,
 *   each titled by a `span.m-energy-sheet__dot.m-tone-{tone}` and its name,
 *   then on the live one its `badge` ('Now') as a Chip in the register's
 *   tone, as the price's register chip is; the value in the list's tabular
 *   numerals (secondary, so the price above stays the figure); then
 *   `rates.footer` as `p.m-energy-sheet__footer`;
 * - the Why Disclosure (`why.title`): `div.m-energy-sheet__panel` holding a
 *   card (`.m-energy-sheet__card`) of `why.paragraphs`, each a
 *   `p.m-energy-sheet__text`.
 *
 * @param {object} props
 * @param {object} props.body energy.js's PriceSheet.
 */
export function PriceDrawer({body: {summary, rates, why}}) {
  return <div className="m-energy-sheet m-energy-sheet--price">
    <section className="m-energy-sheet__summary">
      <div className="m-energy-sheet__price"><Figure value={summary.figure} unit={summary.unit}/>{summary.register && <Chip chip={summary.register}/>}</div>
      <p className="m-energy-sheet__line">{summary.line}</p>
    </section>
    <Section title={rates.heading} footer={rates.footer}>
      <List>{rates.rows.map(row => <ListRow key={row.name} title={<RateName row={row}/>} value={row.value}/>)}</List>
    </Section>
    <Why why={why}/>
  </div>;
}

/**
 * The Billing year sheet's body.
 *
 * DOM: `div.m-energy-sheet.m-energy-sheet--year` holding, in order:
 * - `section.m-energy-sheet__summary.m-energy-sheet__rings`: a regular
 *   RingPair (`summary.rings.plot`) beside `div.m-energy-sheet__registers`,
 *   a `p.m-energy-sheet__register.m-tone-{tone}` per line holding
 *   `span.m-energy-sheet__register-name` (in its tone),
 *   `span.m-energy-sheet__register-figure.m-num` (22pt rounded) and
 *   `span.m-energy-sheet__register-line`; the lines go under the rings
 *   where the two don't fit side by side;
 * - per register a `section.m-energy-sheet__section`: `div.m-energy-sheet__head`
 *   holding its heading (`h3.m-energy-sheet__heading`, the register's
 *   `span.m-energy-sheet__dot.m-tone-{tone}` before `heading`) and its
 *   StateChip at the far end; then a card (`div.m-card.m-energy-sheet__card`)
 *   holding, while it has bars, `div.m-energy-ledger` (a
 *   `div.m-energy-ledger__row` per bar: `span.m-energy-ledger__label`,
 *   `span.m-energy-ledger__bar` > `i.m-energy-ledger__fill.m-tone-{tone}`
 *   at `width`%, `span.m-energy-ledger__value.m-num`), then the note
 *   (`p.m-energy-sheet__note`, strong parts bold); without bars, the note
 *   alone;
 * - the Why Disclosure, as the Price sheet's.
 *
 * @param {object} props
 * @param {object} props.body energy.js's YearSheet.
 */
export function YearDrawer({body: {summary, registers, why}}) {
  return <div className="m-energy-sheet m-energy-sheet--year">
    <section className="m-energy-sheet__summary m-energy-sheet__rings">
      <RingPair plot={summary.rings.plot} size="regular"/><RegisterLines registers={summary.registers}/>
    </section>
    {registers.map(register => <Section key={register.heading} title={register.heading} tone={register.tone} chip={register.chip}>
      <Card as="div" className="m-energy-sheet__card">{register.bars && <Ledger bars={register.bars}/>}<Rich parts={register.note}/></Card>
    </Section>)}
    <Why why={why}/>
  </div>;
}

/**
 * The Bill so far sheet's body.
 *
 * DOM: `div.m-energy-sheet.m-energy-sheet--bill` holding, in order:
 * - `section.m-energy-sheet__summary`: a large Figure (`summary.figure`),
 *   `p.m-energy-sheet__line` (`summary.line`), then, while there is one,
 *   `p.m-energy-sheet__detail` (`summary.detail`);
 * - a section headed `lines.heading`: an inset List of `lines.rows` (label,
 *   value), then, while `lines.covered`, a row titled
 *   `span.m-energy-sheet__covered` (`covered.label`, in the green text
 *   tone: export covers these lines) over `covered.detail`, the lines it
 *   covers; with neither, no list, and `lines.empty` as the footer;
 * - a section headed `cap.heading`, its StateChip at the heading's far
 *   end: an inset List of `cap.rows` while it has any (none while the cap
 *   has no reading, so the chip and the line say so once), then `cap.line`
 *   (`p.m-energy-sheet__note`, a caption, strong parts bold);
 * - the Why Disclosure, as the Price sheet's;
 * - `div.m-energy-sheet__links`: an IntentButton per link, plain (Bill
 *   details, Full energy dashboard), their glyphs lined up with the
 *   headings.
 *
 * @param {object} props
 * @param {object} props.body energy.js's BillSheet.
 */
export function BillDrawer({body: {summary, lines, cap, why, links}}) {
  return <div className="m-energy-sheet m-energy-sheet--bill">
    <section className="m-energy-sheet__summary">
      <Figure value={summary.figure}/>
      <p className="m-energy-sheet__line">{summary.line}</p>
      {summary.detail && <p className="m-energy-sheet__detail">{summary.detail}</p>}
    </section>
    <Section title={lines.heading} footer={lines.empty}>
      {(lines.rows.length > 0 || lines.covered) && <List>
        {rowsOf(lines.rows)}
        {lines.covered && <ListRow key="covered" title={<span className="m-energy-sheet__covered">{lines.covered.label}</span>} detail={lines.covered.detail}/>}
      </List>}
    </Section>
    <Section title={cap.heading} chip={cap.chip}>
      {cap.rows.length > 0 && <List>{rowsOf(cap.rows)}</List>}
      <Rich parts={cap.line}/>
    </Section>
    <Why why={why}/>
    <div className="m-energy-sheet__links">{links.map(link => <IntentButton key={link.intent.command} action={link} variant="plain"/>)}</div>
  </div>;
}

/**
 * The Energy today sheet's body.
 *
 * DOM: `div.m-energy-sheet.m-energy-sheet--day` holding, in order:
 * - `section.m-energy-sheet__summary`: the breakdown (`summary`, no link):
 *   a large Figure (label, value, unit) and the SegmentBar across the
 *   section (empty as `zero` or `missing` by `bar.kind`), with no Legend:
 *   the rows under it say each part's figure, so the sheet says each once;
 * - a section with no heading: an inset List of `rows`, each a ListRow
 *   with its `link` (opening the reading in Home Assistant), `icon`, its
 *   tile tinted by `tone` (Used at home yellow, Exported green, From the
 *   grid indigo, as the bar's parts, so the rows are the bar's key; the
 *   rest gray), `title` and `value` ('—' without a reading);
 * - the Why Disclosure, as the Price sheet's;
 * - `div.m-energy-sheet__links`: Full history, a plain IntentButton, as
 *   the Bill's links (v37: the chart's action is this sheet now, so the
 *   chart's Full history is here).
 *
 * @param {object} props
 * @param {object} props.body energy.js's DaySheet.
 */
export function DayDrawer({body: {summary, rows, why, links}}) {
  return <div className="m-energy-sheet m-energy-sheet--day">
    <section className="m-energy-sheet__summary">
      <Figure label={summary.figure.label} value={summary.figure.value} unit={summary.figure.unit}/>
      <SegmentBar segments={summary.bar.segments} ariaLabel={summary.bar.ariaLabel} empty={summary.bar.kind === 'zero' ? 'zero' : 'missing'}/>
    </section>
    <Section>
      <List>{rows.map(row => <ListRow key={row.title} link={row.link} icon={row.icon} tone={row.tone} title={row.title} value={row.value}/>)}</List>
    </Section>
    <Why why={why}/>
    <div className="m-energy-sheet__links">{links.map(link => <IntentButton key={link.intent.command} action={link} variant="plain"/>)}</div>
  </div>;
}
