// The segmented controls section of the gallery (#29): two, three and four
// segments, a disabled segment, then the house override's ends drawn from
// real screen values, as the House sheet has them and while offline.
// Each control's command selects the pressed segment locally, so the thumb
// can be watched sliding; nothing is sent. Pressed and keyboard focus are
// drawn as frozen copies: the same classes and data attributes on an inert
// element, with a plain thumb in place of React Aria's indicator.
import {useState} from 'react';
import {CommandContext} from '../contexts.js';
import {SegmentedControl} from '../ui/segmented.jsx';
import {climateSnapshot, useScreen} from '../gallery-snapshots.js';
import {GalleryGroup, GallerySection, Specimen} from './section.jsx';

// Items as a value would give them, with the selection kept here: a press
// selects its segment, as the value would after its intent.
function Local({ariaLabel, items}) {
  const [selected, setSelected] = useState(() => items.findIndex(item => item.selected));
  const local = items.map((item, index) => ({...item, intent: {index}, selected: index === selected}));
  return <CommandContext.Provider value={intent => setSelected(intent.index)}><SegmentedControl ariaLabel={ariaLabel} items={local}/></CommandContext.Provider>;
}
// Gallery items from labels: the first selected unless `selected` says, and
// `disabled` the indexes that can't be chosen.
const made = (labels, selected = 0, disabled = []) => labels.map((label, index) => ({intent: null, label, selected: index === selected, enabled: !disabled.includes(index)}));

// A control frozen with one segment in a state React Aria sets only while it happens.
const Frozen = ({labels, selected, at, state}) => <div className="m-segmented" aria-hidden="true">
  {labels.map((label, index) => <span key={label} className="m-segmented__item m-focusable" data-selected={index === selected || undefined} {...(index === at ? {[`data-${state}`]: ''} : {})}>
    {index === selected && <span className="m-segmented__thumb"/>}<span className="m-segmented__label">{label}</span></span>)}
</div>;

function Items() {
  return <GalleryGroup title="Items">
    <div className="m-gallery-segments">
      <Specimen caption="Two"><Local ariaLabel="Two segments" items={made(['Day', 'Week'])}/></Specimen>
      <Specimen caption="Three"><Local ariaLabel="Three segments" items={made(['Day', 'Week', 'Month'], 1)}/></Specimen>
      <Specimen caption="Four"><Local ariaLabel="Four segments" items={made(['Day', 'Week', 'Month', 'Year'], 3)}/></Specimen>
      <Specimen caption="One segment disabled"><Local ariaLabel="One disabled" items={made(['Day', 'Week', 'Month'], 0, [2])}/></Specimen>
      <Specimen caption="Pressed: Week takes a fill"><Frozen labels={['Day', 'Week', 'Month']} selected={0} at={1} state="pressed"/></Specimen>
      <Specimen caption="Keyboard focus, on Month"><Frozen labels={['Day', 'Week', 'Month']} selected={0} at={2} state="focus-visible"/></Specimen>
    </div>
  </GalleryGroup>;
}

// The house override's ends: the House sheet's three (until the
// thermostat's next change selected), the two while the schedule is off,
// and all disabled while Maison is offline. The group's name is the value's
// endsLabel.
function FromValues() {
  const screen = useScreen(), house = options => screen(options).drawer.body.control, sheet = fixture => climateSnapshot(fixture, {detail: 'house'});
  const running = house(sheet()), manual = house(sheet('house_manual'));
  const offline = house({...sheet(), online: false});
  return <GalleryGroup title="From values">
    <div className="m-gallery-segments">
      <Specimen caption={`${running.endsLabel}, in the House sheet`}><Local ariaLabel={running.endsLabel} items={running.ends}/></Specimen>
      <Specimen caption={`${manual.endsLabel}, the schedule switched off`}><Local ariaLabel={manual.endsLabel} items={manual.ends}/></Specimen>
      <Specimen caption={`${offline.endsLabel}, offline`}><Local ariaLabel={offline.endsLabel} items={offline.ends}/></Specimen>
    </div>
  </GalleryGroup>;
}

export function SegmentedSection() {
  return <GallerySection name="segmented" title="Segmented controls" note="Equal segments on a gray track; the selected one rides a thumb that slides">
    <Items/><FromValues/>
  </GallerySection>;
}

// The section's own layout: each control as wide as a phone card's content,
// several to a row where there is room.
export const segmentedGalleryStyles = `
.m-gallery-segments{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:var(--m-space-5) var(--m-space-6)}
.m-gallery-segments .m-gallery__specimen{justify-items:stretch}
.m-gallery-segments .m-gallery__stage{display:grid;align-items:center}
`;
