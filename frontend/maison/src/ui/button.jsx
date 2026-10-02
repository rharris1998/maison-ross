// Maison's button (#29): a capsule on React Aria's Button, which gives it
// pointer, touch and keyboard presses, and the data-pressed, data-disabled,
// data-pending and data-focus-visible states button.css.js draws.
import {useId} from 'react';
import {Button as AriaButton} from 'react-aria-components/Button';
import {ProgressBar} from 'react-aria-components/ProgressBar';
import {useCommand} from '../contexts.js';
import {Glyph} from './glyph.jsx';

/**
 * A button: its glyph, then its label; with neither label nor children it is
 * icon-only, square, and named by `ariaLabel`.
 *
 * DOM: `button.m-button.m-button--{variant}.m-button--{size}[.m-button--wide][.m-button--icon-only].m-focusable`
 * holding `span.m-glyph` then `span.m-button__label`; while pending with a
 * `pendingLabel`, then `div.m-button__progress[role=progressbar]`, visually
 * hidden.
 *
 * @param {object} props
 * @param {'filled'|'tinted'|'gray'|'plain'|'glass'} [props.variant='tinted'] filled: blue with white
 *   text; tinted: blue fill with blue text; gray: gray fill with label text; plain: blue text only;
 *   glass: the tab bar's material with label text.
 * @param {'regular'|'large'} [props.size='regular'] regular: 36px high, subhead-strong, 17px glyph;
 *   large: 44px high, headline, 20px glyph.
 * @param {boolean} [props.wide=false] Fills its container's width.
 * @param {string} [props.label] Visible text.
 * @param {string} [props.ariaLabel] The accessible name; required when there is no label.
 * @param {string} [props.icon] A name from config/www/maison/icons.js.
 * @param {boolean} [props.isDisabled] Out of the Tab order, `disabled`, drawn gray.
 * @param {boolean} [props.isPending] In flight: React Aria keeps it focusable (no
 *   `disabled`, so focus stays where it was) but sets `aria-disabled="true"` and
 *   `data-pending`, and drops every press and key handler; drawn dimmed. While
 *   pending, a button that holds focus as it starts or stops being pending has
 *   its name announced.
 * @param {string} [props.pendingLabel] While pending, what it is doing ('In
 *   progress'): a visually hidden, indeterminate React Aria ProgressBar named
 *   by it, which React Aria adds to the button's name (`aria-labelledby` the
 *   button, or its label, then the bar), so a screen reader hears "Pause, In
 *   progress". Nothing is drawn.
 * @param {() => void} [props.onPress]
 * @param {string} [props.slot] React Aria's slot, such as a Dialog's "close".
 * @param {boolean} [props.preventFocusOnPress] A press leaves focus where it was (React
 *   Aria's prop), as a toast's close button does, so focus never enters the toasts and
 *   pauses their timers; the keyboard still reaches it by Tab.
 * @param {string} [props.className] A class of its own, after Maison's.
 * @param {import('react').ReactNode} [props.children] Drawn in the label, after `label`.
 */
export function Button({variant = 'tinted', size = 'regular', wide = false, label, ariaLabel, icon, isDisabled, isPending, pendingLabel, onPress, slot, preventFocusOnPress, className, children}) {
  const iconOnly = !label && !children, labelId = useId();
  if (process.env.NODE_ENV !== 'production' && iconOnly && !ariaLabel) throw new Error('Maison Button: an icon-only button needs an ariaLabel.');
  const classes = ['m-button', `m-button--${variant}`, `m-button--${size}`, wide && 'm-button--wide', iconOnly && 'm-button--icon-only', 'm-focusable', className];
  // React Aria joins the bar to the name only when the button is named by
  // an attribute, so a button named by its label is labelled by it here.
  const progress = isPending && pendingLabel, byLabel = progress && !ariaLabel && !iconOnly;
  return <AriaButton className={classes.filter(Boolean).join(' ')} aria-label={ariaLabel} aria-labelledby={byLabel ? labelId : undefined}
    isDisabled={isDisabled} isPending={isPending} onPress={onPress} slot={slot} preventFocusOnPress={preventFocusOnPress}>
    {icon && <Glyph name={icon}/>}{!iconOnly && <span className="m-button__label" id={byLabel ? labelId : undefined}>{label}{children}</span>}
    {progress && <ProgressBar className="m-button__progress" isIndeterminate aria-label={pendingLabel}/>}
  </AriaButton>;
}

/**
 * A Control or Link from a screen value as a Button: pressing it sends
 * `command(action.intent)`. `action.enabled` already folds in busy and
 * offline; `action.busy` is true only while the Control's own write is in
 * flight (screen.js's control(); `enabled` is false then). A busy action is
 * pending, not disabled: the button keeps its focus and its place in the Tab
 * order, ignores presses, and is `aria-disabled="true"` with `data-pending`;
 * `action.busyLabel` ('In progress', beside `busy`) is added to its name
 * through a hidden ProgressBar. Any other action that isn't enabled is
 * disabled. Today's variants map as
 * primary → filled, secondary → tinted, ghost → plain.
 *
 * @param {object} props
 * @param {{intent: object, enabled: boolean, busy?: true, busyLabel?: string, label?: string, ariaLabel?: string, icon?: string}} props.action
 * @param {'filled'|'tinted'|'gray'|'plain'|'glass'} [props.variant]
 * @param {'regular'|'large'} [props.size]
 * @param {boolean} [props.wide]
 * @param {string} [props.className]
 */
export function IntentButton({action, variant, size, wide, className}) {
  const command = useCommand();
  return <Button variant={variant} size={size} wide={wide} className={className} label={action.label} ariaLabel={action.ariaLabel} icon={action.icon}
    isDisabled={!action.enabled && !action.busy} isPending={action.busy === true} pendingLabel={action.busyLabel} onPress={() => command(action.intent)}/>;
}
