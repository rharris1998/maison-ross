// Maison's picker (#29 step 4, v35): a choice among a value's options, such
// as Home status's sensor category, drawn as iOS's pop-up button: a gray
// capsule with the chosen option's label and a chevron. The press is a
// native <select> laid over the capsule, unseen, so an iPhone opens its own
// menu and no popover has to find its way out of the shadow DOM. Its text
// is the body type (17px), so iOS doesn't zoom in on focus. Each change
// sends {...intent, value: id}; the dashboard renders the new value at
// once, which the capsule then shows.
import {useCommand} from '../contexts.js';
import {Glyph} from './glyph.jsx';

/**
 * A picker.
 *
 * DOM: `span.m-picker` (`data-disabled` while the link isn't enabled)
 * holding `span.m-picker__label` (the label of the option whose id is
 * `link.selected`), a `chevron` Glyph (`span.m-glyph.m-picker__chevron`,
 * turned down), then `select.m-picker__select` laid over the whole capsule
 * and unseen (`value={link.selected}`, one `option` per `link.options`,
 * `value` its id and its label as text; `disabled` while `!link.enabled`;
 * named by `link.ariaLabel`). A change sends
 * `command({...link.intent, value: id})`. The capsule is 44px high
 * (var(--m-hit)) on --m-fill-gray, as wide as its label (never wider than
 * its line), its text in --m-type-body (17px).
 *
 * @param {object} props
 * @param {{intent: object, enabled: boolean, selected: string, options: {id: string, label: string}[], ariaLabel: string}} props.link
 *   system.js's Category: the chosen option's id and the intent a change sends.
 */
export function Picker({link}) {
  const command = useCommand(), selected = link.options.find(option => option.id === link.selected);
  return <span className="m-picker" data-disabled={link.enabled ? undefined : true}>
    <span className="m-picker__label">{selected?.label}</span><Glyph name="chevron" className="m-picker__chevron"/>
    <select className="m-picker__select" aria-label={link.ariaLabel} value={link.selected} disabled={!link.enabled}
      onChange={event => command({...link.intent, value: event.currentTarget.value})}>
      {link.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </span>;
}
