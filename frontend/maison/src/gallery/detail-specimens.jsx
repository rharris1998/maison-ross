// The sheet parts in the gallery (#29 step 4, v32), each in every
// state: the target bar below, at and above its target, with no target, no
// reading or neither, and held at the scale's end, at both sizes, on a
// card, on a sheet and in a widget; the disclosure closed and open; the
// date and time field enabled and disabled; the feedback line; a week of
// day bars with today marked; a widget's title action on a phone and from
// 700px, disabled too; and zone rows with a room tint and a flag. Then
// Energy's (v33): the registers' pair of rings in each state, at both sizes,
// and the chip in each tone with a glyph and without, on a card and on a
// sheet. Links and Controls are plain objects of the values' shape, and the
// words are the gallery's, the kind the values write. Every wrapper shrinks
// to the page, so nothing here widens a phone's. Presses act on nothing.
import {TargetBar} from '../ui/target-bar.jsx';
import {Disclosure} from '../ui/disclosure.jsx';
import {DateTimeField} from '../ui/date-field.jsx';
import {Feedback} from '../ui/feedback.jsx';
import {DayBar} from '../ui/day-bar.jsx';
import {IntentButton} from '../ui/button.jsx';
import {Figure} from '../ui/figure.jsx';
import {LayoutContext} from '../ui/layout.js';
import {List, ListRow} from '../ui/list.jsx';
import {Widget, useWidgetSurface} from '../ui/widget.jsx';
import {tempColour} from '../ui/temp-scale.js';
import {RingPair} from '../ui/ring.jsx';
import {Chip} from '../ui/chip.jsx';
import {GalleryGroup, Specimen} from './section.jsx';

const INTENT = {command: 'gallery'};
const link = (ariaLabel, label) => ({intent: INTENT, enabled: true, label, ariaLabel});
const control = label => ({intent: INTENT, enabled: true, label});

// A TargetBar value on climate.js's scale.
const bar = (reading, target, ariaLabel) => ({plot: {reading, target, min: 14, max: 26}, ariaLabel});
// Every state the bar draws, as climate.js names it.
const BARS = [
  {key: 'below', name: 'Below its target', reading: '19.2°', bar: bar(19.2, 21, '19.2°, target 21°')},
  {key: 'at', name: 'At its target', reading: '20.1°', bar: bar(20.1, 20, '20.1°, target 20°')},
  {key: 'above', name: 'Above its target', reading: '24.2°', bar: bar(24.2, 16, '24.2°, target 16°')},
  {key: 'untargeted', name: 'No target', reading: '23.4°', bar: bar(23.4, null, '23.4°, no target while the heating is off')},
  {key: 'empty', name: 'No reading', reading: '—', bar: bar(null, 17, 'No reading, target 17°')},
  {key: 'blank', name: 'Neither', reading: '—', bar: bar(null, null, 'No reading')},
  {key: 'hot', name: 'Past the scale', reading: '27.6°', bar: bar(27.6, 21, '27.6°, target 21°')},
];

// Each bar with its words, at a size: a table on whatever surface it sits.
const BarTable = ({size}) => <div className="m-gallery-details__bars">
  {BARS.map(({key, name, reading, bar: value}) => <div key={key} className={`m-gallery-details__bar m-gallery-details__bar--${size}`}>
    <span className="m-gallery-details__bar-name">{name}</span><span className="m-gallery-details__bar-reading m-num">{reading}</span><TargetBar bar={value} size={size}/>
  </div>)}
</div>;

// The Away date as climate.js's Away.field draws it, and a week as the
// thermostat's (each day's widths add up to 100).
const FIELD = {label: 'Heating back on', control: {intent: {...INTENT, value: '2026-10-18T15:00'}, enabled: true}, min: '2026-10-14T09:35', max: '2027-01-12T09:30'};
const HINT = 'Set it a few hours before you’re back.';
const WORKDAY = {plan: '20° 06:30–22:00, otherwise 18°', bar: [{width: 27.08, warm: false}, {width: 64.58, warm: true}, {width: 8.34, warm: false}]};
const WEEK = [
  {name: 'Mon', today: null, ...WORKDAY},
  {name: 'Tue', today: null, ...WORKDAY},
  {name: 'Wed', today: 'Today', plan: '20° 06:30–08:30 · 20° 17:00–22:00, otherwise 18°',
    bar: [{width: 27.08, warm: false}, {width: 8.33, warm: true}, {width: 35.42, warm: false}, {width: 20.83, warm: true}, {width: 8.34, warm: false}]},
  {name: 'Thu', today: null, ...WORKDAY},
  {name: 'Fri', today: null, plan: '20° 06:30–23:00, otherwise 18°', bar: [{width: 27.08, warm: false}, {width: 68.75, warm: true}, {width: 4.17, warm: false}]},
  {name: 'Sat', today: null, plan: '20° 08:00–23:00, otherwise 18°', bar: [{width: 33.33, warm: false}, {width: 62.5, warm: true}, {width: 4.17, warm: false}]},
  {name: 'Sun', today: null, plan: '18° all day', bar: [{width: 100, warm: false}]},
];

// The House heating widget's body: the reading, its wide bar and its line.
const HOUSE = bar(23.4, 20, '23.4°, target 20°');
const HouseBody = () => <div className="m-gallery-details__house">
  <Figure value="23.4°"/><TargetBar bar={HOUSE} size="wide"/><p className="m-gallery-details__line">Above target · 20° until 22:00, then 18°</p>
</div>;
// The towel rails as the page draws them: strong rows, each with its press,
// Stop gray as every cancel is and Dry towels tinted; plain rows on a
// widget's surface, an inset list on a phone.
const RAILS = [
  {name: 'Ensuite', line: 'Drying until 10:15', action: control('Stop'), variant: 'gray'},
  {name: 'Bathroom', line: 'Off · rail 21.4°', action: control('Dry towels'), variant: 'tinted'},
];
function RailRows() {
  const onSurface = useWidgetSurface();
  return <List variant={onSurface ? 'plain' : 'inset'}>
    {RAILS.map(rail => <ListRow key={rail.name} icon="bath" title={rail.name} detail={rail.line} strong accessory={<IntentButton action={rail.action} variant={rail.variant}/>}/>)}
  </List>;
}
const DETAILS = link('House heating details', 'Details');
const RAIL_DETAILS = link('Towel rails details', 'Details');

// Zones as the Climate page lists them: a room tint, a flag, the line, and
// the reading over its bar at the end (the bar hidden, as the row's name
// says it all). The last is unavailable: no tint, a dashed tile and bar.
const ZONES = [
  {id: 'attic', icon: 'desk', name: 'Attic', flag: 'Humid', line: 'Above target · 16° until 08:00, then 21°', reading: '24.2°', bar: bar(24.2, 16, '24.2°, target 16°')},
  {id: 'sam', icon: 'desk', name: 'Sam’s office', flag: null, line: 'Below target · 20° until 18:00', reading: '18.6°', bar: bar(18.6, 20, '18.6°, target 20°')},
  {id: 'noah', icon: 'moon', name: 'Noah’s room', flag: 'Dry air', line: 'At target · always 20°', reading: '20.1°', bar: bar(20.1, 20, '20.1°, target 20°')},
  {id: 'suite', icon: 'bed', name: 'Bedroom suite and its long name that wraps', flag: 'Humid', line: 'Above target · always 17°', reading: '22.7°', bar: bar(22.7, 17, '22.7°, target 17°')},
  {id: 'office', icon: 'desk', name: 'Office', flag: null, line: 'No reading · always 17°', reading: '—', bar: bar(null, 17, 'No reading, target 17°')},
];
const zoneLink = zone => link(`${zone.name}: ${zone.reading}, ${zone.line}${zone.flag ? `, ${zone.flag}` : ''}. Open ${zone.name}`);
const ZoneRow = ({zone}) => {
  const known = typeof zone.bar.plot.reading === 'number';
  return <ListRow link={zoneLink(zone)} icon={zone.icon} tint={known ? tempColour(zone.bar.plot.reading) : undefined} unavailable={!known} strong
    title={zone.name} badge={zone.flag} detail={zone.line}
    trailing={<span className="m-gallery-details__reading"><span className="m-gallery-details__figure m-num">{zone.reading}</span><TargetBar bar={zone.bar} hidden/></span>}/>;
};

// A register's ring as energy.js's RingPlot has it: its share of the
// credit used, billing (the whole ring) or missing (no share).
const plot = (tone, share, state = share === null ? 'missing' : 'credit') => ({tone, share, state});
// The pair in every state, peak outside and off-peak inside, each named
// and with its two figures, as the register lines beside it would say them.
const PAIRS = [
  {key: 'credit', name: 'Both in credit', figures: 'Peak 36% · off-peak 86% used', plot: [plot('pink', 0.358), plot('indigo', 0.862)]},
  {key: 'billing', name: 'Off-peak billing', figures: 'Peak 57% used · off-peak billing', plot: [plot('pink', 0.568), plot('indigo', 1, 'billing')]},
  {key: 'both', name: 'Both billing', figures: 'Peak and off-peak billing', plot: [plot('pink', 1, 'billing'), plot('indigo', 1, 'billing')]},
  {key: 'peak-missing', name: 'Peak without a reading', figures: 'Peak — · off-peak 60% used', plot: [plot('pink', null), plot('indigo', 0.6)]},
  {key: 'missing', name: 'No readings', figures: 'Peak — · off-peak —', plot: [plot('pink', null), plot('indigo', null)]},
];
// Each pair at a size with its words: beside them at `medium`, as the
// Billing year widget and the phone's card set it, and at `small`; over
// them at `regular`, as a table.
const PairTable = ({size}) => <div className={`m-gallery-details__pairs m-gallery-details__pairs--${size}`}>
  {PAIRS.map(pair => <div key={pair.key} className="m-gallery-details__pair">
    <RingPair plot={pair.plot} size={size}/>
    <span className="m-gallery-details__pair-words"><span className="m-gallery-details__pair-name">{pair.name}</span>
      <span className="m-gallery-details__pair-figures">{pair.figures}</span></span>
  </div>)}
</div>;

// The chip in the four tones Energy draws, each with a glyph, the
// registers' as the price carries them, then each without one, as the
// sheets' states are.
const CHIPS = [
  {label: 'Peak register', tone: 'pink', icon: 'sun'},
  {label: 'Off-peak register', tone: 'indigo', icon: 'moon'},
  {label: 'Fully covered', tone: 'green', icon: 'check'},
  {label: 'No reading', tone: 'gray', icon: 'info'},
  {label: 'Peak register', tone: 'pink'},
  {label: 'Off-peak register', tone: 'indigo'},
  {label: 'Binding', tone: 'green'},
  {label: 'Billing', tone: 'gray'},
];
const ChipRows = () => <div className="m-gallery-details__chips">
  {CHIPS.map(chip => <Chip key={`${chip.label}-${chip.icon ?? 'bare'}`} chip={chip}/>)}
</div>;

export function DetailSpecimens() {
  return <>
    <GalleryGroup title="Target bars">
      <div className="m-gallery-details">
        <Specimen caption="Row size, 78 × 12 px, on a card: the dot’s ring and the tick’s notch are the card’s colour"><div className="m-card m-gallery-details__panel"><BarTable size="row"/></div></Specimen>
        <Specimen caption="Wide, on a card"><div className="m-card m-gallery-details__panel"><BarTable size="wide"/></div></Specimen>
        <Specimen caption="Wide, on a sheet: bare on its fill, then on a card inside it">
          <div className="m-sheet m-gallery-details__sheet m-gallery-details__sheet--span">
            <div className="m-gallery-details__bars"><div className="m-gallery-details__bar m-gallery-details__bar--wide">
              <span className="m-gallery-details__bar-name">{BARS[2].name}</span><span className="m-gallery-details__bar-reading m-num">{BARS[2].reading}</span><TargetBar bar={BARS[2].bar} size="wide"/>
            </div></div>
            <div className="m-card"><div className="m-gallery-details__bars"><div className="m-gallery-details__bar m-gallery-details__bar--wide">
              <span className="m-gallery-details__bar-name">{BARS[1].name}</span><span className="m-gallery-details__bar-reading m-num">{BARS[1].reading}</span><TargetBar bar={BARS[1].bar} size="wide"/>
            </div></div></div>
          </div>
        </Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Rows with a room tint and a flag">
      <div className="m-gallery-details">
        <Specimen caption="Zones on a phone: the glyph in the room’s colour (shaded in light), the flag beside the name, the reading over its bar"><div className="m-gallery-details__column">
          <List>{ZONES.map(zone => <ZoneRow key={zone.id} zone={zone}/>)}</List>
        </div></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Widget title actions">
      <div className="m-gallery-details">
        <Specimen caption="On a phone: “Details ›” at the end of the section title, its hit area 44 px high"><div className="m-gallery-details__column"><LayoutContext.Provider value="phone">
          <div className="m-gallery-details__stack">
            <Widget id="house" title="House heating" icon="home" action={DETAILS}><HouseBody/></Widget>
            <Widget id="rails" title="Towel rails" icon="bath" action={RAIL_DETAILS} surface="none"><RailRows/></Widget>
          </div>
        </LayoutContext.Provider></div></Specimen>
        <Specimen caption="From 700 px, in a medium widget: the action’s hit area ends where the first row’s button’s begins"><div className="m-gallery-details__cells"><LayoutContext.Provider value="wide">
          <div className="m-gallery-details__cell"><Widget id="house" size="medium" title="House heating" icon="home" action={DETAILS}><HouseBody/></Widget></div>
          <div className="m-gallery-details__cell"><Widget id="rails" size="medium" title="Towel rails" icon="bath" action={RAIL_DETAILS}><RailRows/></Widget></div>
          <div className="m-gallery-details__cell"><Widget id="disabled" size="medium" title="House heating" icon="home" action={{...DETAILS, enabled: false}}><HouseBody/></Widget></div>
        </LayoutContext.Provider></div></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Disclosures, date fields and feedback">
      <div className="m-gallery-details">
        <Specimen caption="On a sheet: a disclosure closed, then one open holding the date field, its hint and its button">
          <div className="m-sheet m-gallery-details__sheet">
            <Disclosure title="Why"><p className="m-gallery-details__line">The house thermostat decides when the living room is warm.</p></Disclosure>
            <Disclosure title="Away until a date" defaultExpanded>
              <div className="m-gallery-details__panel-body">
                <p className="m-gallery-details__line">The house stays at 15° and the rails stay off until you’re back.</p>
                <DateTimeField field={FIELD} hint={HINT}/>
                <IntentButton action={control('Set Away')} variant="tinted"/>
              </div>
            </Disclosure>
          </div>
        </Specimen>
        <Specimen caption="A date and time field, disabled while offline"><div className="m-gallery-details__column">
          <DateTimeField field={{...FIELD, control: {...FIELD.control, enabled: false}}} hint={HINT}/>
        </div></Specimen>
        <Specimen caption="A feedback line under its control; drawn only while there is something to say"><div className="m-gallery-details__column m-gallery-details__feedback">
          <IntentButton action={control('Cancel override')} variant="gray"/><Feedback text="House heating 22° until 22:00 · waiting for the thermostat"/><Feedback text=""/>
        </div></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Day bars">
      <div className="m-gallery-details">
        <Specimen caption="The thermostat’s week, today marked: comfort in the secondary label, setback the gray fill"><div className="m-card m-gallery-details__panel" role="list">
          {WEEK.map(day => <DayBar key={day.name} day={day}/>)}
        </div></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Register rings">
      <div className="m-gallery-details">
        <Specimen caption="Medium, 96 px, on a card beside their words, as the Billing year widget and the phone’s card set them: peak outside in pink, off-peak inside in indigo, billing the whole ring, a missing register a dashed track">
          <div className="m-card m-gallery-details__panel"><PairTable size="medium"/></div>
        </Specimen>
        <Specimen caption="Small, 80 px, on a card beside their words">
          <div className="m-card m-gallery-details__panel"><PairTable size="small"/></div>
        </Specimen>
        <Specimen caption="Regular, 136 px, on a sheet, as the Billing year sheet opens">
          <div className="m-sheet m-gallery-details__sheet"><PairTable size="regular"/></div>
        </Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Chips">
      <div className="m-gallery-details">
        <Specimen caption="On a card: the registers pink and indigo, the states green and gray, with a glyph, then without"><div className="m-card m-gallery-details__panel"><ChipRows/></div></Specimen>
        <Specimen caption="On a sheet’s fill, where the sheets set them"><div className="m-sheet m-gallery-details__sheet"><ChipRows/></div></Specimen>
      </div>
    </GalleryGroup>
  </>;
}

// The specimens' own layout: panels and columns a phone wide (343px) that
// shrink to the page; the target bars' sheet on a row of its own, as wide
// as the two cards above it and their gap, so the block leaves no hole;
// the widget cells a medium widget's size from 700px (a 168px row),
// narrower on a phone, never wider than the page; a table of bars, each
// named, its reading and its bar on one line. The medium and small ring
// pairs each sit beside their words, 16px apart, as the Billing year
// widget sets them; the regular ones in columns at least a pair wide,
// their words under them, one column on a narrow phone; the chips wrap,
// 8px apart.
export const detailSpecimensStyles = `
.m-gallery-details{display:flex;flex-wrap:wrap;gap:var(--m-space-6) var(--m-space-5);align-items:flex-start;min-width:0}
.m-gallery-details>.m-gallery__specimen{flex:0 1 343px;min-width:0;max-width:100%;justify-items:stretch}
.m-gallery-details .m-gallery__stage{display:block;min-width:0}
.m-gallery-details__panel,.m-gallery-details__column,.m-gallery-details__sheet{box-sizing:border-box;width:343px;max-width:100%;min-width:0}
.m-gallery-details__panel{display:grid;gap:var(--m-space-1)}
.m-gallery-details__sheet{display:grid;gap:var(--m-space-3);padding:var(--m-space-4);border-radius:var(--m-radius-card);box-shadow:none}
.m-gallery-details>.m-gallery__specimen:has(>.m-gallery__stage>.m-gallery-details__sheet--span){flex-basis:100%}
.m-gallery-details__sheet.m-gallery-details__sheet--span{width:calc(2 * 343px + var(--m-space-5))}
.m-gallery-details__bars{display:grid;gap:var(--m-space-3);min-width:0}
.m-gallery-details__bar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;column-gap:var(--m-space-3);min-width:0}
.m-gallery-details__bar--wide{grid-template-columns:minmax(0,1fr) auto;row-gap:6px}
.m-gallery-details__bar--wide>.m-target-bar{grid-column:1/-1}
.m-gallery-details__bar-name{min-width:0;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-gallery-details__bar-reading{font:var(--m-type-subhead-strong);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;color:var(--m-label);text-align:right}
.m-gallery-details__reading{display:grid;justify-items:end;gap:6px}
.m-gallery-details__figure{font:var(--m-type-figure);font-variant-numeric:tabular-nums;color:var(--m-label)}
.m-gallery-details__house{display:grid;gap:var(--m-space-1);min-width:0}
.m-gallery-details__line{margin:0;min-width:0;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-gallery-details__stack{display:grid;gap:var(--m-space-6);min-width:0}
.m-gallery-details>.m-gallery__specimen:has(>.m-gallery__stage>.m-gallery-details__cells){flex-basis:100%}
.m-gallery-details__cells{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,477px),1fr));grid-auto-rows:var(--m-widget-row);gap:var(--m-widget-gap);min-width:0}
.m-gallery-details__cell{display:grid;min-width:0}
.m-gallery-details__panel-body{display:grid;gap:var(--m-space-3);justify-items:start;min-width:0}
.m-gallery-details__panel-body>.m-date-field{justify-self:stretch}
.m-gallery-details__feedback{display:grid;gap:var(--m-space-2);justify-items:start}
.m-gallery-details__pairs{display:grid;gap:var(--m-space-4);min-width:0}
.m-gallery-details__pairs--regular{grid-template-columns:repeat(auto-fill,minmax(136px,1fr));gap:var(--m-space-5) var(--m-space-4)}
.m-gallery-details__pair{display:flex;align-items:center;gap:var(--m-space-4);min-width:0}
.m-gallery-details__pairs--regular>.m-gallery-details__pair{flex-direction:column;align-items:flex-start;gap:var(--m-space-2)}
.m-gallery-details__pair-words{display:flex;flex-direction:column;min-width:0}
.m-gallery-details__pair-name{font:var(--m-type-subhead-strong);color:var(--m-label)}
.m-gallery-details__pair-figures{font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-gallery-details__chips{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-2);min-width:0}
`;
