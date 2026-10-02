// Maison's stepper (#29): a value between a minus and a plus button, as the
// Climate settings and the Car's charge limit draw it. It is a React Aria
// Group, so a screen reader hears the setting's name before its buttons; each
// button is a gray icon-only IntentButton named by its Control's ariaLabel,
// and the value is an <output> named by the value's outputLabel.
//
// The values: climate.js's Stepper {output, outputLabel, minus, plus}, beside
// its Step's title; car.js's Override.limit.stepper, the same keys beside
// limit.title. Adapter: `<Stepper {...step.stepper} label={step.title}/>`.
import {Group} from 'react-aria-components/Group';
import {IntentButton} from './button.jsx';

// One side: its button, or a spacer that keeps the value where it would be.
const Step = ({action}) => action ? <IntentButton action={action} variant="gray" className="m-stepper__step"/> : <span className="m-stepper__spacer" aria-hidden="true"/>;

/**
 * A value between a minus and a plus button.
 *
 * DOM: `div.m-stepper[role=group][aria-label=label]` (React Aria's Group) holding
 * - minus: IntentButton variant="gray", icon-only, className "m-stepper__step"
 *   (a 36px circle with a 44px hit area), or `span.m-stepper__spacer` (36px)
 *   when null;
 * - `output.m-stepper__value.m-num[aria-label=outputLabel]` (--m-type-figure
 *   with tabular digits, centred, --m-label, 64px wide at least, room for
 *   "20.5°" or "100%", so a step never moves the buttons);
 * - plus, the same as minus, 10px apart.
 *
 * A side is null when the setting can't go that way or can't be stepped at
 * all (climate.js's helperValue). A Control in flight (`busy`) draws a
 * pending button, which keeps its focus and ignores presses; any other
 * disabled Control (offline, refused) draws a disabled button, which React
 * Aria keeps out of the Tab order.
 *
 * @param {object} props
 * @param {object|null} props.minus A Control: {intent, enabled, ariaLabel, icon}.
 * @param {object|null} props.plus
 * @param {string} props.output The visible value, such as "20°" or "80%".
 * @param {string} [props.outputLabel] The output's accessible name.
 * @param {string} [props.label] The group's accessible name: the Step's title.
 */
export function Stepper({minus, plus, output, outputLabel, label}) {
  return <Group className="m-stepper" aria-label={label}>
    <Step action={minus}/><output className="m-stepper__value m-num" aria-label={outputLabel}>{output}</output><Step action={plus}/>
  </Group>;
}
