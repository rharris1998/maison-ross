// The steppers section of the gallery (#29): each stepper the pages and
// sheets draw, from real values, first as a setting (a list row whose
// accessory is the stepper, as Climate's sheets and the Car lay it out),
// then alone in every state. Pressed and keyboard focus are states React
// Aria sets only while they happen, so they are drawn as frozen copies: the
// same classes and data attribute on an inert element. Presses act on
// nothing.
import {Stepper} from '../ui/stepper.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {Glyph} from '../ui/glyph.jsx';
import {CAR_FIXTURES} from '../../fixtures/car-fixtures.js';
import {THERMOSTAT, carSnapshot, climateSnapshot, useScreen} from '../gallery-snapshots.js';
import {GalleryGroup, GallerySection, Specimen} from './section.jsx';

const car = id => CAR_FIXTURES.find(fixture => fixture.id === id);
// A setting as Climate's sheets draw it: a row, its title over its line, the
// stepper beside, named by the title unless its value already is.
const Setting = ({title, detail, stepper}) => <ListRow title={title} detail={detail ?? undefined}
  accessory={stepper && <Stepper {...stepper} label={title === stepper.outputLabel ? undefined : title}/>}/>;
// The Car's charge limit as the Car page draws it: a primary row, its title
// strong over its detail, its stepper named by the title.
const Limit = ({limit}) => <ListRow strong title={limit.title} detail={limit.detail} accessory={<Stepper {...limit.stepper} label={limit.title}/>}/>;

// A step button frozen in a state React Aria sets only while it happens: the
// same classes on an inert span.
const FrozenStep = ({action, state}) => <span className="m-button m-button--gray m-button--regular m-button--icon-only m-focusable m-stepper__step" {...(state ? {[`data-${state}`]: ''} : {})}>
  <Glyph name={action.icon}/></span>;
// A stepper with its plus button frozen in `state`.
const Frozen = ({stepper, state}) => <div className="m-stepper" aria-hidden="true">
  <FrozenStep action={stepper.minus}/><output className="m-stepper__value m-num">{stepper.output}</output><FrozenStep action={stepper.plus} state={state}/>
</div>;

// A Climate sheet's body for a fixture, `detail` open.
const sheet = (screen, fixture, detail, options = {}) => screen(climateSnapshot(fixture, {...options, detail})).drawer.body;

export function SteppersSection() {
  const screen = useScreen(), {control: {step: house}, titles} = sheet(screen, 'house_running', 'house');
  const [attic, noah] = ['attic', 'noah'].map(zone => sheet(screen, 'house_running', zone).control);
  const busy = sheet(screen, 'house_running', 'house', THERMOSTAT).control.step;
  const unread = sheet(screen, 'sensors_unavailable', 'attic').control;
  const {comfort} = sheet(screen, 'house_running', 'attic').schedule;
  const notSetUp = sheet(screen, 'contract_missing', 'sam').schedule.comfort.step;
  const limit = screen(carSnapshot(car('solar'), 'car')).page.charge.limit;
  const offline = screen({...carSnapshot(car('solar'), 'car'), online: false}).page.charge.limit;
  return <GallerySection name="steppers" title="Steppers" note="A figure between two gray circles; the group is named by its setting, the value by its outputLabel">
    <GalleryGroup title="Settings, from values">
      <div className="m-gallery-steppers">
        <Specimen caption="The House sheet’s override temperature: Cooler and Warmer"><List><Setting title={titles.temperature} stepper={house.stepper}/></List></Specimen>
        <Specimen caption="Zone sheets: the Attic’s target now and Noah’s fixed target"><List>
          <Setting title={attic.title} detail={attic.line} stepper={attic.step.stepper}/><Setting title={noah.title} detail={noah.line} stepper={noah.step.stepper}/>
        </List></Specimen>
        <Specimen caption="A comfort helper in the zone sheet"><List><Setting title={comfort.step.title} detail={comfort.line} stepper={comfort.step.stepper}/></List></Specimen>
        <Specimen caption="Car charge limit, steps of 5%"><List><Limit limit={limit}/></List></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="States">
      <div className="m-gallery-row">
        <Specimen caption="Ready"><Stepper {...house.stepper} label={titles.temperature}/></Specimen>
        <Specimen caption="In flight: waiting for the thermostat"><Stepper {...busy.stepper} label={titles.temperature}/></Specimen>
        <Specimen caption="Disabled: sensors unavailable"><Stepper {...unread.step.stepper} label={unread.title}/></Specimen>
        <Specimen caption="Disabled: the Car’s limit, offline"><Stepper {...offline.stepper} label={offline.title}/></Specimen>
        <Specimen caption="Both sides null: not set up"><Stepper {...notSetUp.stepper} label={notSetUp.title}/></Specimen>
        <Specimen caption="Plus null: a spacer holds the value"><Stepper {...attic.step.stepper} plus={null} label={attic.title}/></Specimen>
        <Specimen caption="Pressed, plus"><Frozen stepper={house.stepper} state="pressed"/></Specimen>
        <Specimen caption="Keyboard focus, plus"><Frozen stepper={house.stepper} state="focus-visible"/></Specimen>
      </div>
    </GalleryGroup>
  </GallerySection>;
}

// The section's own layout: settings in columns as wide as a phone's list.
export const steppersGalleryStyles = `
.m-gallery-steppers{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:var(--m-space-5) var(--m-space-6);align-items:start}
.m-gallery-steppers .m-gallery__specimen{justify-items:stretch}
.m-gallery-steppers .m-gallery__stage{display:block}
`;
