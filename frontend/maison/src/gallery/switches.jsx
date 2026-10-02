// The switches section of the gallery (#29): the switch in every state,
// the unavailable one beside an off one so the two read apart, then
// IntentSwitches drawn from real screen values (Car's Automatic charging and
// the Attic Airco's heating and cooling). A switch flips locally so the page
// can be clicked through; nothing is sent. Pressed and keyboard focus are
// states React Aria sets only while they happen, so they are drawn as frozen
// copies: the same classes and data attributes on an inert element.
import {useState} from 'react';
import {CommandContext} from '../contexts.js';
import {IntentSwitch, Switch, UnavailableSwitch} from '../ui/switch.jsx';
import {CAR_FIXTURES} from '../../fixtures/car-fixtures.js';
import {carSnapshot, climateSnapshot, useScreen} from '../gallery-snapshots.js';
import {GalleryGroup, GallerySection, Specimen} from './section.jsx';

// A switch that flips when pressed, as the value would after its toggle.
function Local({initial, isDisabled, ariaLabel}) {
  const [on, setOn] = useState(initial);
  return <Switch isSelected={on} isDisabled={isDisabled} ariaLabel={ariaLabel} onChange={setOn}/>;
}

// A switch frozen in a state React Aria sets only while it happens.
const Frozen = ({selected, state}) => <span className="m-switch m-focusable" data-selected={selected || undefined} {...{[`data-${state}`]: ''}} aria-hidden="true">
  <span className="m-switch__track"><span className="m-switch__thumb"/></span></span>;

function States() {
  return <GalleryGroup title="States">
    <div className="m-gallery-row">
      <Specimen caption="Off"><Local initial={false} ariaLabel="Off example"/></Specimen>
      <Specimen caption="On"><Local initial ariaLabel="On example"/></Specimen>
      <Specimen caption="Disabled, off"><Switch isSelected={false} isDisabled ariaLabel="Disabled off example"/></Specimen>
      <Specimen caption="Disabled, on"><Switch isSelected isDisabled ariaLabel="Disabled on example"/></Specimen>
      <Specimen caption="Unavailable, beside off"><span className="m-gallery-pair"><UnavailableSwitch/><Switch isSelected={false} ariaLabel="Off, for comparison"/></span></Specimen>
      <Specimen caption="Pressed, off and on"><span className="m-gallery-pair"><Frozen state="pressed"/><Frozen selected state="pressed"/></span></Specimen>
      <Specimen caption="Keyboard focus"><Frozen selected state="focus-visible"/></Specimen>
    </div>
  </GalleryGroup>;
}

// One switch value as a page will draw it, with its note beside it. Its
// command flips it locally instead of sending the toggle.
function FromValue({control, note, caption}) {
  const [selected, setSelected] = useState(!!control.selected);
  return <Specimen caption={caption}><CommandContext.Provider value={() => setSelected(on => !on)}>
    <span className="m-gallery-switch"><IntentSwitch control={{...control, selected}} note={note}/>{note && <span className="m-gallery-switch__note">{note}</span>}</span>
  </CommandContext.Provider></Specimen>;
}

// Car's Automatic charging on, off and offline, as the Car page draws it;
// the Attic Airco's heating and cooling, then both unavailable (every
// sensor and valve unavailable).
function FromValues() {
  const screen = useScreen(), car = id => CAR_FIXTURES.find(fixture => fixture.id === id);
  const on = screen(carSnapshot(car('solar'), 'car')).page.automatic, off = screen(carSnapshot(car('automatic_off'), 'car')).page.automatic;
  const offline = screen({...carSnapshot(car('solar'), 'car'), online: false}).page.automatic;
  const airco = screen(climateSnapshot('airco_heating', {detail: 'attic'})).drawer.body.airco;
  const gone = screen(climateSnapshot('sensors_unavailable', {detail: 'attic'})).drawer.body.airco;
  return <GalleryGroup title="From values">
    <div className="m-gallery-row">
      <FromValue control={on.switch} note={on.note} caption={`${on.title}, on`}/>
      <FromValue control={off.switch} note={off.note} caption={`${off.title}, off`}/>
      <FromValue control={offline.switch} note={offline.note} caption={`${offline.title}, offline`}/>
      <FromValue control={airco.heating.control} note={airco.heating.note} caption={airco.heating.title}/>
      <FromValue control={airco.cooling.control} note={airco.cooling.note} caption={airco.cooling.title}/>
      <FromValue control={gone.heating.control} note={gone.heating.note} caption={`${gone.heating.title}, unavailable`}/>
    </div>
  </GalleryGroup>;
}

export function SwitchesSection() {
  return <GallerySection name="switches" title="Switches" note="Green when on; unavailable is an outline, never off">
    <States/><FromValues/>
  </GallerySection>;
}

// The section's own layout: a value's note beside its switch.
export const switchesGalleryStyles = `
.m-gallery-switch{display:inline-flex;align-items:center;gap:var(--m-space-3)}
.m-gallery-switch__note{font:var(--m-type-footnote);color:var(--m-label-2)}
`;
