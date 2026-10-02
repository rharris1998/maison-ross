// Maison's on/off switch (#29): the iOS track on React Aria's Switch, which
// gives it a real checkbox input with role=switch (Space toggles it, a tap on
// the label does too) and the data-selected, data-pressed, data-disabled and
// data-focus-visible states switch.css.js draws. A switch whose device is
// unavailable is drawn apart, never as off.
//
// Today's values (read, not changed):
// - Car's Automatic charging, car.js Settings: `{title, detail, switch:
//   Control, note: 'Unavailable' | 'Offline' | null, feedback}`.
// - The Airco's heating and cooling, climate.js AircoSwitch: `{kind: 'switch',
//   title, detail, control: Control, note: '' | 'Unavailable' | 'Offline',
//   feedback}`.
// In both the Control is `{intent: {command: 'toggle', entity}, ariaLabel,
// selected, enabled}`: `selected` is whether it is on, `enabled` is false while
// busy, offline or unavailable, and `note` says which of the last two it is.
// An unavailable device's state reads as off, so `note === 'Unavailable'` is
// what tells the two apart.
import {Switch as AriaSwitch} from 'react-aria-components/Switch';
import {useCommand} from '../contexts.js';

const classes = (base, className) => className ? `${base} ${className}` : base;

// The track and its thumb, shared by the live switch and the unavailable one.
const Track = () => <span className="m-switch__track"><span className="m-switch__thumb"/></span>;

/**
 * An on/off switch on React Aria's Switch. It draws what `isSelected` says:
 * a change calls `onChange(next)` and waits for the caller to re-render.
 *
 * DOM: `label.m-switch.m-focusable` holding React Aria's visually hidden
 * `input[type=checkbox][role=switch]` (named by `ariaLabel`), then
 * `span.m-switch__track` holding `span.m-switch__thumb`.
 *
 * Look: a 51×31 capsule, --m-switch-off when off and --m-green when on; the
 * 27px thumb slides 20px over --m-dur-control --m-ease and stretches while
 * pressed. Disabled: opacity .4. Keyboard focus draws the shared ring round
 * the track. The label reaches a 44px hit area with an ::after inset.
 *
 * @param {object} props
 * @param {boolean} props.isSelected
 * @param {boolean} [props.isDisabled]
 * @param {string} props.ariaLabel The switch's accessible name; it has no visible label.
 * @param {(isSelected: boolean) => void} [props.onChange]
 * @param {string} [props.className]
 */
export function Switch({isSelected, isDisabled, ariaLabel, onChange, className}) {
  if (process.env.NODE_ENV !== 'production' && !ariaLabel) throw new Error('Maison Switch: a switch needs an ariaLabel.');
  return <AriaSwitch className={classes('m-switch m-focusable', className)} aria-label={ariaLabel} isSelected={!!isSelected} isDisabled={isDisabled} onChange={onChange}>
    <Track/>
  </AriaSwitch>;
}

/**
 * A switch whose device is unavailable: visibly neither on nor off. It has no
 * input, so nothing is pressable or announced; the value's own visible words
 * (its `note`, drawn by the caller) say it is unavailable.
 *
 * DOM: `span.m-switch.m-switch--unavailable[aria-hidden=true]` holding the
 * track and its thumb. Look: the same 51×31 outline, a 1.5px dashed
 * --m-label-3 track with no fill and a smaller --m-label-3 thumb in its middle.
 *
 * @param {object} [props]
 * @param {string} [props.className]
 */
export const UnavailableSwitch = ({className} = {}) =>
  <span className={classes('m-switch m-switch--unavailable', className)} aria-hidden="true"><Track/></span>;

/**
 * A switch from a screen value: `isSelected=control.selected`,
 * `isDisabled=!control.enabled`, named by `control.ariaLabel` (or its label),
 * and a change sends `command(control.intent)`, a toggle. The value decides
 * what it shows next render.
 *
 * Pass the value's `note` ('Unavailable' | 'Offline' | '' | null): an
 * unavailable device draws UnavailableSwitch instead; offline stays a
 * disabled switch at its last state. `unavailable` overrides the note.
 * Car: `<IntentSwitch control={settings.switch} note={settings.note}/>`;
 * the Airco: `<IntentSwitch control={s.control} note={s.note}/>`.
 *
 * @param {object} props
 * @param {{intent: object, enabled: boolean, selected?: boolean, ariaLabel?: string, label?: string}} props.control
 * @param {string|null} [props.note]
 * @param {boolean} [props.unavailable] Defaults to `note === 'Unavailable'`.
 * @param {string} [props.className]
 */
export function IntentSwitch({control, note = null, unavailable = note === 'Unavailable', className}) {
  const command = useCommand();
  if (unavailable) return <UnavailableSwitch className={className}/>;
  return <Switch className={className} isSelected={!!control.selected} isDisabled={!control.enabled} ariaLabel={control.ariaLabel ?? control.label}
    onChange={() => command(control.intent)}/>;
}
