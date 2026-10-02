// Maison's feedback line (#29 step 4): what became of a write, under the
// control that sent it ('Warm the house: waiting for the thermostat…'). It
// is drawn only while there is something to say. It has no live role: the
// same words reach the frame's status region (m-status-region), which
// announces them once.

/**
 * A feedback line.
 *
 * DOM: `p.m-feedback` holding `text`, only while `text` is non-empty;
 * nothing otherwise. No live role.
 *
 * @param {object} props
 * @param {string|null} [props.text] The control's feedback, from the value.
 */
export function Feedback({text}) {
  return text ? <p className="m-feedback">{text}</p> : null;
}
