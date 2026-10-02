// The Car's sheets (#29 step 4, v34): Battery and
// Charging energy, drawn in Maison's Sheet from car.js's Drawer bodies as
// iOS grouped sections, as Energy's are: each headed by a value's words
// over an inset list or a card, with a caption under it where the value has
// one, and Why last, collapsed. The summary is bare on the sheet: the
// Battery's ring beside the headline, as the page's Battery card draws it,
// and Charging energy's figure over its bar. Nothing is composed in React:
// every word, heading and caption is the value's. The Car's sheets only
// read and open: their only presses are rows that open a reading in Home
// Assistant, so no button is filled, and a row's tile is green only where
// the value says the Car charges.
import {Card} from '../ui/card.jsx';
import {Disclosure} from '../ui/disclosure.jsx';
import {Figure} from '../ui/figure.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {Ring} from '../ui/ring.jsx';
import {SegmentBar} from '../ui/segment-bar.jsx';

// The ring's ticks from its plot: the reserve and the limit, each while known.
const ticksOf = plot => [{at: plot.reserve, kind: 'reserve'}, {at: plot.limit, kind: 'limit'}].filter(tick => typeof tick.at === 'number');

// One grouped section: its heading from the value (none without one), what
// it groups, then its footer caption.
const Section = ({title, footer, children}) => <section className="m-car-sheet__section">
  {title && <h3 className="m-car-sheet__heading">{title}</h3>}{children}{footer && <p className="m-car-sheet__footer">{footer}</p>}
</section>;

// Why, collapsed: one card of the value's paragraphs, then its logs, each a
// label line over its text, so Why reads as one group.
const Why = ({why}) => <Disclosure title={why.title}><div className="m-car-sheet__panel">
  <Card as="div" className="m-car-sheet__card">
    {why.paragraphs.map((text, i) => <p key={i} className="m-car-sheet__text">{text}</p>)}
    {why.logs.map(log => <div key={log.label} className="m-car-sheet__log">
      <p className="m-car-sheet__log-label">{log.label}</p><p className="m-car-sheet__text">{log.text}</p>
    </div>)}
  </Card>
</div></Disclosure>;

// Rows of readings: a tone tile, the title (over the detail, while there
// is one) and the value. A row with a link opens its reading; one without
// (a reading whose own dialog wouldn't show it) is a plain row, with no
// chevron. A row the value flags `unavailable` has no reading: its tile is
// ListRow's dashed one, never its tone, so it never reads as a 0.
const Rows = ({rows}) => <List>{rows.map(row => <ListRow key={row.title} link={row.link} icon={row.icon} tone={row.tone} title={row.title}
  detail={row.detail ?? undefined} value={row.value} unavailable={row.unavailable === true}/>)}</List>;

/**
 * The Battery sheet's body.
 *
 * DOM: `div.m-car-sheet.m-car-sheet--battery` holding, in order:
 * - `section.m-car-sheet__summary`: a regular Ring (`summary.ring.plot`'s
 *   fill, tone and stale, its reserve and limit as ticks, `summary.label`
 *   in the centre, named by `summary.ring.ariaLabel`) beside
 *   `div.m-car-sheet__status`: `p.m-car-sheet__headline`
 *   (`summary.headline`), `p.m-car-sheet__detail` (`summary.detail`, while
 *   not empty) and `p.m-car-sheet__hint` (`summary.hint`, while set);
 * - `section.m-car-sheet__section` headed `readings.heading`
 *   (`h3.m-car-sheet__heading`): an inset List of `readings.rows`, each a
 *   ListRow with its `link` (a plain row, with no chevron, without one),
 *   `icon`, tile `tone` (ListRow's dashed tile while the row is
 *   `unavailable`), `title`, `detail` (while set) and `value`;
 * - while `plan`: a section headed `plan.heading`, a card
 *   (`.m-car-sheet__card`) of `plan.line` (`p.m-car-sheet__text`), then
 *   `plan.note` as `p.m-car-sheet__footer`, while set;
 * - while `why`: the Why Disclosure (`why.title`), collapsed:
 *   `div.m-car-sheet__panel` holding one card (`.m-car-sheet__card`) of
 *   `why.paragraphs`, each a `p.m-car-sheet__text`, then, in the same
 *   card, per log `div.m-car-sheet__log` holding
 *   `p.m-car-sheet__log-label` (`label`) over
 *   `p.m-car-sheet__text` (`text`).
 *
 * @param {object} props
 * @param {object} props.body car.js's BatterySheet.
 */
export function BatteryDrawer({body: {summary, readings, plan, why}}) {
  const {plot} = summary.ring;
  return <div className="m-car-sheet m-car-sheet--battery">
    <section className="m-car-sheet__summary">
      <Ring value={plot.fill} ticks={ticksOf(plot)} tone={plot.tone} stale={plot.stale} label={summary.label} ariaLabel={summary.ring.ariaLabel}/>
      <div className="m-car-sheet__status">
        <p className="m-car-sheet__headline">{summary.headline}</p>
        {summary.detail && <p className="m-car-sheet__detail">{summary.detail}</p>}
        {summary.hint && <p className="m-car-sheet__hint">{summary.hint}</p>}
      </div>
    </section>
    <Section title={readings.heading}><Rows rows={readings.rows}/></Section>
    {plan && <Section title={plan.heading} footer={plan.note}><Card as="div" className="m-car-sheet__card"><p className="m-car-sheet__text">{plan.line}</p></Card></Section>}
    {why && <Why why={why}/>}
  </div>;
}

/**
 * The Charging energy sheet's body.
 *
 * DOM: `div.m-car-sheet.m-car-sheet--sources` holding, in order:
 * - `section.m-car-sheet__summary.m-car-sheet__summary--energy`: the
 *   breakdown (`summary`, no link): a large Figure (label, value, unit) and
 *   the SegmentBar across the section (empty as `zero` or `missing` by
 *   `bar.kind`), with no Legend: the rows under it say each source's
 *   figure;
 * - `section.m-car-sheet__section` with no heading: an inset List of
 *   `rows`, each a ListRow with its `link` (opening the meter in Home
 *   Assistant), `icon`, tile `tone`, `title` and `value` ('—' without a
 *   reading, when the row is `unavailable` and its tile dashed); then
 *   `footer` as `p.m-car-sheet__footer`, while set;
 * - the Why Disclosure, as the Battery sheet's.
 *
 * @param {object} props
 * @param {object} props.body car.js's SourcesSheet.
 */
export function SourcesDrawer({body: {summary, rows, footer, why}}) {
  return <div className="m-car-sheet m-car-sheet--sources">
    <section className="m-car-sheet__summary m-car-sheet__summary--energy">
      <Figure label={summary.figure.label} value={summary.figure.value} unit={summary.figure.unit}/>
      <SegmentBar segments={summary.bar.segments} ariaLabel={summary.bar.ariaLabel} empty={summary.bar.kind === 'zero' ? 'zero' : 'missing'}/>
    </section>
    <Section footer={footer}><Rows rows={rows}/></Section>
    <Why why={why}/>
  </div>;
}
