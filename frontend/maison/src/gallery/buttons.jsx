// The buttons section of the gallery (#29): each material in every size
// and state, then IntentButtons drawn from real screen values, idle and with
// their write in flight. Pressed, pointer hover and keyboard focus are states
// React Aria sets only while they happen, so they are drawn as frozen copies:
// the same classes and data attributes on an inert element.
import {Button, IntentButton} from '../ui/button.jsx';
import {Glyph} from '../ui/glyph.jsx';
import {Stepper} from '../ui/stepper.jsx';
import {CAR_FIXTURES} from '../../fixtures/car-fixtures.js';
import {THERMOSTAT, carSnapshot, climateSnapshot, useScreen} from '../gallery-snapshots.js';
import {GalleryGroup, GallerySection, Specimen} from './section.jsx';

const VARIANTS = ['filled', 'tinted', 'gray', 'plain', 'glass'];
const title = variant => variant[0].toUpperCase() + variant.slice(1);
// How each material shows a press: a fill where it has one, a fade where not.
const PRESSED = {filled: 'Pressed: dims a little', tinted: 'Pressed: a deeper tint', gray: 'Pressed: a deeper fill', plain: 'Pressed: fades',
  glass: 'Pressed: shrinks (a fill under reduced motion)'};
// The materials a Control is drawn in, so the ones a write can be in flight
// on; plain and glass draw Links, which never are.
const IN_FLIGHT = {filled: 'In flight: the blue fades, the label stays', tinted: 'In flight: dimmed, keeps focus', gray: 'In flight: dimmed, keeps focus'};

// A button frozen in the states React Aria sets only while they happen:
// labelled "Button", or icon-only with `icon`.
const Frozen = ({variant, states, icon, className}) => <span className={[`m-button m-button--${variant} m-button--regular`, icon && 'm-button--icon-only', 'm-focusable', className].filter(Boolean).join(' ')}
  {...Object.fromEntries(states.map(state => [`data-${state}`, '']))} aria-hidden="true">
  {icon ? <Glyph name={icon}/> : <span className="m-button__label">Button</span>}</span>;
// A Control as screen.js's control() marks it while its key is in flight:
// busy, and so not enabled, with the words its hidden ProgressBar is read by.
const BUSY_LABEL = 'In progress';
const inFlight = action => ({...action, enabled: false, busy: true, busyLabel: BUSY_LABEL});

// One material in every size and state.
function Variant({variant}) {
  return <GalleryGroup title={title(variant)}>
    <div className={`m-gallery-row${variant === 'glass' ? ' m-gallery-row--glass' : ''}`}>
      <Specimen caption="Regular"><Button variant={variant} label="Button"/></Specimen>
      <Specimen caption="With a glyph"><Button variant={variant} icon="plus" label="Add"/></Specimen>
      <Specimen caption="Icon only"><Button variant={variant} icon="settings" ariaLabel="Settings"/></Specimen>
      <Specimen caption="Large"><Button variant={variant} size="large" label="Button"/></Specimen>
      <Specimen caption="Large, icon only"><Button variant={variant} size="large" icon="close" ariaLabel="Close"/></Specimen>
      <Specimen caption="Disabled"><Button variant={variant} label="Button" isDisabled/></Specimen>
      {IN_FLIGHT[variant] && <Specimen caption={IN_FLIGHT[variant]}><Button variant={variant} label="Button" isPending pendingLabel={BUSY_LABEL}/></Specimen>}
      <Specimen caption={PRESSED[variant]}><Frozen variant={variant} states={['pressed']}/></Specimen>
      {variant === 'plain' && <Specimen caption="Pointer hover"><Frozen variant={variant} states={['hovered']}/></Specimen>}
      <Specimen caption="Keyboard focus"><Frozen variant={variant} states={['focus-visible']}/></Specimen>
    </div>
  </GalleryGroup>;
}

// Controls and Links as the pages and sheets draw them: the House sheet's
// override start (filled), its stepper's icon-only buttons and Away's Set
// while no date is chosen (disabled by the value), the Attic schedule's link
// (plain), and the Car's Charge now, wide.
function FromValues() {
  const screen = useScreen(), house = screen(climateSnapshot('house_running', {detail: 'house'})).drawer.body.control;
  const schedule = screen(climateSnapshot('house_running', {detail: 'attic'})).drawer.body.schedule;
  const car = screen(carSnapshot(CAR_FIXTURES.find(fixture => fixture.id === 'solar'), 'car')).page;
  return <GalleryGroup title="From values">
    <div className="m-gallery-row">
      <Specimen caption="Override start, filled"><IntentButton action={house.start} variant="filled"/></Specimen>
      <Specimen caption="Stepper buttons, gray"><span className="m-gallery-pair"><IntentButton action={house.step.stepper.minus} variant="gray"/><IntentButton action={house.step.stepper.plus} variant="gray"/></span></Specimen>
      <Specimen caption="Disabled by its value"><IntentButton action={house.away.set}/></Specimen>
      <Specimen caption="A link, plain"><IntentButton action={schedule.link} variant="plain"/></Specimen>
    </div>
    <div className="m-gallery-wide"><Specimen caption="Wide, large"><IntentButton action={car.charge.action} variant="filled" size="large" wide/></Specimen></div>
  </GalleryGroup>;
}

// The House sheet's override Controls while its write is in flight (the
// thermostat is slow to confirm): each keeps its material and its place in
// the Tab order, dimmed, and ignores presses. The stepper's steps inherit it
// from IntentButton, the stepper named by its row's title as the sheet
// names it; a keyboard user who pressed Warmer is still on it, its ring at
// full strength.
function InFlight() {
  const screen = useScreen(), {control: house, titles} = screen(climateSnapshot('house_running', {...THERMOSTAT, detail: 'house'})).drawer.body;
  const {step} = house, minus = inFlight(step.stepper.minus), plus = inFlight(step.stepper.plus);
  return <GalleryGroup title="In flight, from values">
    <div className="m-gallery-row">
      <Specimen caption="Override start, filled"><IntentButton action={inFlight(house.start)} variant="filled"/></Specimen>
      <Specimen caption="The house stepper, both steps"><Stepper {...step.stepper} minus={minus} plus={plus} label={titles.temperature}/></Specimen>
      <Specimen caption="Keyboard focus stays on Warmer"><div className="m-stepper" aria-hidden="true">
        <Frozen variant="gray" states={['pending']} icon={minus.icon} className="m-stepper__step"/><output className="m-stepper__value m-num">{step.stepper.output}</output>
        <Frozen variant="gray" states={['pending', 'focus-visible']} icon={plus.icon} className="m-stepper__step"/>
      </div></Specimen>
    </div>
  </GalleryGroup>;
}

export function ButtonsSection() {
  return <GallerySection name="buttons" title="Buttons" note="Capsules in five materials; a press deepens the fill, disabled turns gray, in flight dims">
    {VARIANTS.map(variant => <Variant key={variant} variant={variant}/>)}
    <FromValues/>
    <InFlight/>
  </GallerySection>;
}

// The section's own layout. The glass row sits on a sample gradient, as glass
// always sits over content.
export const buttonsGalleryStyles = `
.m-gallery-row{display:flex;flex-wrap:wrap;gap:var(--m-space-4) var(--m-space-5);align-items:flex-start}
.m-gallery-row--glass{padding:var(--m-space-4);border-radius:var(--m-radius-card);background:linear-gradient(135deg,var(--m-blue),var(--m-indigo) 40%,var(--m-pink) 75%,var(--m-orange))}
.m-gallery-row--glass .m-gallery__caption{color:var(--m-on-color)}
.m-gallery-pair{display:inline-flex;gap:var(--m-space-2)}
.m-gallery-wide{max-width:420px}
.m-gallery-wide .m-gallery__specimen{justify-items:stretch}
`;
