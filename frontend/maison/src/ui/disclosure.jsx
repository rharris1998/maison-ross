// Maison's disclosure (#29 step 4): a titled section of a sheet that opens
// in place, such as the House sheet's Why and Away, so an explanation is
// there when asked for and out of the way otherwise. React Aria's
// Disclosure gives the trigger its aria-expanded and aria-controls and the
// panel its region; a chevron turns a quarter while open.
import {Button as AriaButton, Disclosure as AriaDisclosure, DisclosurePanel, Heading} from 'react-aria-components/Disclosure';
import {Glyph} from './glyph.jsx';

/**
 * A disclosure.
 *
 * DOM: React Aria `div.m-disclosure` (with `data-expanded` while open)
 * holding `Heading.m-disclosure__heading` at `level` (h3 by default), which
 * holds `button.m-disclosure__trigger.m-focusable[slot=trigger]`: the title
 * in `span.m-disclosure__title`, then a `chevron` Glyph
 * (`.m-disclosure__chevron`) that turns 90° while expanded, with no
 * transition under reduced motion. Then `div.m-disclosure__panel`
 * (React Aria's DisclosurePanel, `role="group"` labelled by the trigger,
 * and `hidden` while closed) holding `children`. The trigger is at least
 * 44px tall, the heading's whole width, the title in headline and the
 * chevron in --m-blue-text at its far end; the panel adds --m-space-1 above
 * what it holds, which brings its own spacing.
 *
 * @param {object} props
 * @param {string} props.title Visible text, from the value.
 * @param {2|3|4|5|6} [props.level=3] The heading's level.
 * @param {boolean} [props.defaultExpanded=false] Open at first.
 * @param {import('react').ReactNode} props.children The panel's content.
 */
export function Disclosure({title, level = 3, defaultExpanded = false, children}) {
  return <AriaDisclosure className="m-disclosure" defaultExpanded={defaultExpanded}>
    <Heading className="m-disclosure__heading" level={level}>
      <AriaButton slot="trigger" className="m-disclosure__trigger m-focusable">
        <span className="m-disclosure__title">{title}</span><Glyph name="chevron" className="m-disclosure__chevron"/>
      </AriaButton>
    </Heading>
    <DisclosurePanel className="m-disclosure__panel">{children}</DisclosurePanel>
  </AriaDisclosure>;
}
