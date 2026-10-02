// Home status (#29 step 4, v35), drawn from system.js's
// value as iOS grouped lists: Needs attention, Key devices, Vacuum
// maintenance, All sensors and Home Assistant, in one column on a phone;
// from 700px the checks on the left and All sensors on the right. Every
// word comes from the value and every press is a value's Link: a row opens
// its entity, the search and the category send the value's intents, and
// Show more the next readings. The sections are drawn once, in one DOM at
// every width: on a phone the checks' box gives way (system.css.js) and
// Home Assistant moves after All sensors, so the search field is never
// re-mounted when the layout changes under it. Orange is only what needs
// Alex (an alert, a key device that stopped reporting, a consumable that is
// due); the rest is gray, and blue only Show more, which presses.
import {useLayoutEffect, useRef, useState} from 'react';
import {SectionTitle} from '../ui/card.jsx';
import {Chip} from '../ui/chip.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {Picker} from '../ui/picker.jsx';
import {SearchField} from '../ui/search-field.jsx';
import {useLayout} from '../ui/layout.js';

// One grouped section: its title, the 22px section title every page's
// sections have (with what stands beside it), its rows, then its footnote.
const Section = ({id, title, aside, footer, children}) => <section className={`m-system-page__section m-system-page__section--${id}`}>
  <div className="m-system-page__head"><SectionTitle>{title}</SectionTitle>{aside}</div>
  {children}{footer && <p className="m-system-page__footer">{footer}</p>}
</section>;

// An alert's row: an orange tile that opens its entity, titled as a
// primary row, over what is wrong.
const AlertRow = ({row}) => <ListRow link={row.link} icon={row.icon} tone={row.tone} title={row.title} detail={row.detail} strong/>;
// The one row standing for a section with nothing to flag: a gray check.
const AllClear = ({title}) => <ListRow icon="check" tone="gray" title={title}/>;

// A reading: its category's tile (dashed while it has no reading), its
// name over when it last reported, and its value; it opens the sensor.
const Reading = ({row}) => <ListRow link={row.link} icon={row.icon} title={row.title} detail={row.detail} value={row.value} unavailable={row.unavailable}/>;

// All sensors: the count beside the heading, the search, the category and
// how many match, then the readings, ending with Show more while there are
// more, and the note.
function Sensors({sensors: {title, count, search, category, summary, rows, empty, more, note}}) {
  return <Section id="sensors" title={title} aside={<Chip chip={{label: count, tone: 'gray'}}/>} footer={note}>
    <SearchField link={search}/>
    <div className="m-system-page__filter"><Picker link={category}/><p className="m-system-page__summary">{summary}</p></div>
    <div className="m-system-page__readings"><List>
      {rows.map(row => <Reading key={row.link.intent.entity} row={row}/>)}
      {empty && <ListRow key="empty" icon="search" tone="gray" title={empty}/>}
      {more && <ListRow key="more" link={more} title={more.label} trailing={null}/>}
    </List></div>
  </Section>;
}

// The scroll container a sticky element sticks in: its nearest ancestor,
// through slots and shadow roots as maison-dashboard.js's
// scrollContainers() walks, that scrolls or clips its overflow (Home
// Assistant's own view scroller, a gallery window); null where only the
// document scrolls.
function scrollerOf(node) {
  const up = el => el.assignedSlot || el.parentElement || el.getRootNode().host || null;
  for (let el = up(node); el && el !== document.body && el !== document.documentElement; el = up(el))
    if (/^(?:auto|scroll|overlay|hidden)$/.test(getComputedStyle(el).overflowY)) return el;
  return null;
}

// Whether the checks' column, from 700px, is taller than its scroll
// container leaves it under the tab bar (its sticky top, from that
// container's top): then it scrolls with the page rather than stick, which
// would hide its foot (Home Assistant) until the sensors end. The container
// is the one that actually scrolls (Home Assistant's inner view, or the
// document's window). Measured before the first paint, then on every change
// of its height, the container's or the window's; a phone never sticks, so
// it isn't measured there.
function useTall(ref, wide) {
  const [tall, setTall] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!wide || !node) return undefined;
    const scroller = scrollerOf(node);
    const measure = () => setTall(node.getBoundingClientRect().height + (parseFloat(getComputedStyle(node).top) || 0) > (scroller ? scroller.clientHeight : window.innerHeight));
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    if (scroller) observer?.observe(scroller);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [ref, wide]);
  return wide && tall;
}

/**
 * Home status's body.
 *
 * DOM: `div.m-system-page.m-system-page--{phone|wide|desktop}` (the frame's
 * layout) holding `div.m-system-page__checks` (Needs attention, Key
 * devices, Vacuum maintenance, Home Assistant) then
 * `div.m-system-page__sensors` (All sensors). Each section is
 * `section.m-system-page__section.m-system-page__section--{id}` (`needs`,
 * `devices`, `vacuum`, `home-assistant`, `sensors`) holding
 * `div.m-system-page__head` > SectionTitle's `h2.m-section-title` (its
 * title, 22px, as every page's sections), an inset List, then
 * `p.m-system-page__footer` while it has a footnote:
 * - needs: `needs.rows`, each a strong ListRow (its link, icon, orange tile
 *   by its tone, title, detail); while `needs.empty`, one row of it with a
 *   gray `check` tile and no press;
 * - devices: `devices.rows` as needs' rows; while `devices.line`, one row of
 *   it with a gray `check` tile; `devices.note` as the footnote;
 * - vacuum: `vacuum.rows`, each a ListRow (its link, the `vacuum` tile,
 *   orange while its tone is, gray otherwise; title; value);
 * - home-assistant: `homeAssistant.rows`, each a ListRow (its link, icon,
 *   title, and its value while it has one) with a chevron;
 * - sensors: the head also holds a gray Chip of `sensors.count`; then the
 *   SearchField (`sensors.search`), `div.m-system-page__filter` holding the
 *   Picker (`sensors.category`) and `p.m-system-page__summary`
 *   (`sensors.summary`), then `div.m-system-page__readings` > the List:
 *   `sensors.rows`, each a ListRow (its link, icon, title, detail, value,
 *   `unavailable`), keyed by its entity; while `sensors.empty`, one row of
 *   it with a gray `search` tile; while `sensors.more`, a last bare row
 *   pressing it, titled by its label, with no chevron; `sensors.note` as
 *   the footnote.
 * On a phone (system.css.js) the checks' box gives way and the sections
 * stack in the order Needs attention, Key devices, Vacuum maintenance, All
 * sensors, Home Assistant; from 700px the two boxes are two equal columns,
 * the checks one sticky under the tab bar while it fits the scroll
 * container under it, and `m-system-page__checks--tall` (scrolling with the
 * page) when it doesn't, as measured by useTall(). No section is drawn
 * twice.
 *
 * @param {object} props
 * @param {object} props.value system.js's SystemPage (its fields: needs, devices, vacuum, homeAssistant; and sensors).
 */
export function SystemPage({value: {needs, devices, vacuum, sensors, homeAssistant}}) {
  const layout = useLayout(), checks = useRef(null), tall = useTall(checks, layout !== 'phone');
  return <div className={`m-system-page m-system-page--${layout}`}>
    <div className={tall ? 'm-system-page__checks m-system-page__checks--tall' : 'm-system-page__checks'} ref={checks}>
      <Section id="needs" title={needs.title}><List>
        {needs.rows.map((row, i) => <AlertRow key={`${i}-${row.title}`} row={row}/>)}{needs.empty && <AllClear key="empty" title={needs.empty}/>}
      </List></Section>
      <Section id="devices" title={devices.title} footer={devices.note}><List>
        {devices.rows.map(row => <AlertRow key={row.title} row={row}/>)}{devices.line && <AllClear key="line" title={devices.line}/>}
      </List></Section>
      <Section id="vacuum" title={vacuum.title}><List>
        {vacuum.rows.map(row => <ListRow key={row.title} link={row.link} icon={row.icon} tone={row.tone ?? 'gray'} title={row.title} value={row.value}/>)}
      </List></Section>
      <Section id="home-assistant" title={homeAssistant.title}><List>
        {homeAssistant.rows.map(row => <ListRow key={row.title} link={row.link} icon={row.icon} title={row.title} value={row.value ?? undefined}/>)}
      </List></Section>
    </div>
    <div className="m-system-page__sensors"><Sensors sensors={sensors}/></div>
  </div>;
}
