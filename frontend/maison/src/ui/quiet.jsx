// Maison's quiet line (#29 step 4): something the home is doing that needs
// no card, such as the vacuum docked, one secondary line under the page's
// widgets, with its buttons at the end while there is something to do.
// Where the line is too narrow for both, the buttons wrap under the text,
// lined up with it rather than with the glyph.
import {Children} from 'react';
import {Glyph} from './glyph.jsx';

/**
 * A quiet line.
 *
 * DOM: `p.m-quiet` holding `span.m-glyph.m-quiet__glyph` (17px), then
 * `span.m-quiet__text` (subhead, --m-label-2), then, when there are
 * children other than false, null and undefined, `span.m-quiet__actions`
 * holding them at the end; they wrap
 * under the text, aligned with it, where the line is too narrow (a phone).
 *
 * @param {object} props
 * @param {string} props.icon A name from config/www/maison/icons.js.
 * @param {string} props.text Visible text, from the value.
 * @param {import('react').ReactNode} [props.children] Buttons, such as IntentButtons for the value's controls.
 */
export function QuietLine({icon, text, children}) {
  // toArray drops false, null and undefined, which count() counts: a page's
  // `{active && buttons}` leaves no empty actions behind.
  const actions = Children.toArray(children);
  return <p className="m-quiet">
    <Glyph name={icon} className="m-quiet__glyph"/><span className="m-quiet__text">{text}</span>
    {actions.length > 0 && <span className="m-quiet__actions">{actions}</span>}
  </p>;
}
