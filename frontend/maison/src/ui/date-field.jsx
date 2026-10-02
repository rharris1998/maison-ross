// Maison's date and time field (#29 step 4): the native input, so an
// iPhone opens its own wheels, such as the House sheet's "Heating back on".
// It is uncontrolled: it starts at the value's draft and each change sends
// the draft back as the control's intent with its value, as today's Away
// does, so nothing is sent to the house while choosing. The body type keeps
// iOS from zooming in on focus. No wrapper takes a tabindex, so after iOS's
// Done, when the input blurs with nowhere to go, React Aria's fallback
// hands focus back to the sheet's dialog (the nearest [tabindex]), never to
// a wrapper of the field: the sheet stays open and in place, and the value
// has been sent.
import {useId} from 'react';
import {useCommand} from '../contexts.js';

/**
 * A date and time field.
 *
 * DOM: `div.m-date-field` holding `label.m-date-field__label[for]` (the
 * field's label), `input.m-date-field__input[type=datetime-local]` (its id
 * from useId; `defaultValue={control.intent.value}`, `min`, `max`,
 * `disabled` while `!control.enabled`; each change sends
 * `command({...control.intent, value})`), then `p.m-date-field__hint` when
 * there is a `hint`, its id from useId too, and the input then
 * `aria-describedby` it, so the hint is read with the field. The input is
 * at least 44px tall, in --m-type-body (17px). No wrapper has a tabindex,
 * so focus goes back to the sheet's dialog after iOS's Done.
 *
 * @param {object} props
 * @param {{label: string, control: {intent: object, enabled: boolean}, min: string, max: string}} props.field
 *   climate.js's Away.field: min and max are datetime-local values.
 * @param {string} [props.hint] A line under the field, from the value.
 */
export function DateTimeField({field: {label, control, min, max}, hint}) {
  const command = useCommand(), id = useId(), hintId = useId();
  return <div className="m-date-field">
    <label className="m-date-field__label" htmlFor={id}>{label}</label>
    <input className="m-date-field__input" id={id} type="datetime-local" defaultValue={control.intent.value} min={min} max={max} disabled={!control.enabled}
      aria-describedby={hint ? hintId : undefined} onChange={event => command({...control.intent, value: event.currentTarget.value})}/>
    {hint && <p className="m-date-field__hint" id={hintId}>{hint}</p>}
  </div>;
}
