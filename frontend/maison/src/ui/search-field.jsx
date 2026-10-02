// Maison's search field (#29 step 4, v35): React Aria's SearchField, drawn
// as iOS draws a search bar: a magnifier, the query, and while there is one
// a clear button, on a gray well. It is controlled by the value's query:
// each keystroke sends {...intent, value}, and the dashboard renders the new
// value at once (flushSync, maison-dashboard.js `sensor-search`), so the
// same input is kept, never re-mounted, and its focus and caret stay where
// they were. The body type (17px) keeps iOS from zooming in on focus.
// Escape and the clear button empty it; React Aria keeps the clear button
// out of the Tab order and off focus, so the keyboard stays up. The
// keyboard's Search key (Enter) blurs the input, as iOS's search bars do,
// so the keyboard goes down over the results it was hiding. Nothing wraps
// the input with a tabindex, so after iOS's Done focus has nowhere to go
// but where React Aria's fallback sends it (react-aria-compat.mjs).
import {useRef} from 'react';
import {Button} from 'react-aria-components/Button';
import {Input} from 'react-aria-components/Input';
import {SearchField as AriaSearchField} from 'react-aria-components/SearchField';
import {useCommand} from '../contexts.js';
import {Glyph} from './glyph.jsx';

/**
 * A search field.
 *
 * DOM: React Aria `div.m-search-field` (`data-empty` while the query is
 * empty, `data-disabled` while the link isn't enabled) holding
 * `span.m-glyph.m-search-field__glyph` (the magnifier), React Aria
 * `input.m-search-field__input[type=search]` (`value={link.value}`,
 * `placeholder={link.placeholder}`, no autocorrection or capitals: it
 * matches names and entity ids), then React Aria
 * `button.m-search-field__clear` holding a `close` Glyph, kept in its place
 * but hidden while the query is empty. The field is 44px high
 * (var(--m-hit)) on --m-fill-gray, its text in --m-type-body (17px).
 * Each change, a keystroke, the clear button or Escape, sends
 * `command({...link.intent, value})`; Enter (the keyboard's Search key)
 * sends nothing and blurs the input. The field is disabled while
 * `!link.enabled`, and named by `link.ariaLabel`.
 *
 * @param {object} props
 * @param {{intent: object, enabled: boolean, value: string, placeholder: string, ariaLabel: string}} props.link
 *   system.js's Search: the query the element keeps, and the intent a change sends.
 */
export function SearchField({link}) {
  const command = useCommand(), input = useRef(null);
  return <AriaSearchField className="m-search-field" aria-label={link.ariaLabel} value={link.value} isDisabled={!link.enabled}
    onChange={value => command({...link.intent, value})} onSubmit={() => input.current?.blur()}>
    <Glyph name="search" className="m-search-field__glyph"/>
    <Input ref={input} className="m-search-field__input" placeholder={link.placeholder} autoCorrect="off" autoCapitalize="none" spellCheck={false}/>
    <Button className="m-search-field__clear"><Glyph name="close"/></Button>
  </AriaSearchField>;
}
