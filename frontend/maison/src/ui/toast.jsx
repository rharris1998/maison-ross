// Maison's toast (#29 step 4, v35): a short note about a press ('Home
// Assistant is disconnected…', 'Request sent…', a write that failed), in
// place of HeroUI's. It is React Aria's toast region and toasts, on a queue the
// element fills through mountDashboard's toast(message): the region is
// drawn in the portal (UNSAFE_PortalProvider's container, inside Maison's
// shadow root) only while a toast is shown. A toast raised while a sheet is
// open stays usable above it: React Aria treats the region as a top layer
// (no scrim press, no focus trap). One already showing when a sheet opens
// is made inert with the rest of the page, as React Aria's first walk for
// top layers doesn't look inside the shadow root, so it is hidden until the
// sheet closes (toast.css.js) rather than drawn over the sheet, letting a
// tap through to it. A toast closes after its timeout, or from its close
// button, which takes no focus: focus inside the region would pause every
// remaining toast's timer until something else took it.
import {Text} from 'react-aria-components/Text';
import {UNSTABLE_Toast as AriaToast, UNSTABLE_ToastContent as AriaToastContent, UNSTABLE_ToastQueue as AriaToastQueue,
  UNSTABLE_ToastRegion as AriaToastRegion} from 'react-aria-components/Toast';
import {Button} from './button.jsx';

/**
 * Maison's toast queue: React Aria's ToastQueue showing at most two toasts,
 * the newest first. Fill it with `queue.add({title}, {timeout})`, as
 * mountDashboard's toast(message) does; `queue.clear()` empties it.
 *
 * @returns {AriaToastQueue<{title: string}>}
 */
export function createToastQueue() {
  return new AriaToastQueue({maxVisibleToasts: 2});
}

/**
 * One toast, as ToastRegion draws it.
 *
 * DOM: `div.m-toast` (React Aria's Toast) holding `div.m-toast__content`
 * (its alert, ToastContent) > `span.m-toast__title` (the toast's `title`,
 * its title slot), then the close button (Button gray, icon-only, 36px with
 * a 44px hit area, `slot="close"`, named `closeLabel`), which closes it
 * and leaves focus where it was (`preventFocusOnPress`).
 *
 * Look: the tab bar's glass, radius --m-radius-card, subhead text in
 * --m-label, 44px high for one line; it rises in over --m-dur-sheet.
 *
 * @param {object} props
 * @param {{key: string, content: {title: string}}} props.toast A queued toast, from the region.
 * @param {string} [props.closeLabel='Close'] The close button's name.
 */
export function Toast({toast, closeLabel = 'Close'}) {
  return <AriaToast toast={toast} className="m-toast">
    <AriaToastContent className="m-toast__content"><Text slot="title" className="m-toast__title">{toast.content.title}</Text></AriaToastContent>
    <Button variant="gray" icon="close" ariaLabel={closeLabel} slot="close" preventFocusOnPress className="m-toast__close"/>
  </AriaToast>;
}

/**
 * The toasts.
 *
 * DOM, in the portal, only while there is a toast:
 * `div.m-toast-region[.{className}]` (React Aria's ToastRegion, a landmark),
 * fixed at the bottom centre, at most 480px wide and 16px off the screen's
 * sides, holding a Toast per shown toast, the newest nearest the bottom.
 * Where it sits above the screen's bottom is the frame's (`.m-toasts`,
 * frame.css.js): above the phone tab bar.
 *
 * @param {object} props
 * @param {AriaToastQueue<{title: string}>} props.queue From createToastQueue().
 * @param {string} [props.className] A class of its own, after Maison's.
 * @param {string} [props.closeLabel] Each close button's name (Toast's default).
 */
export function ToastRegion({queue, className, closeLabel}) {
  return <AriaToastRegion queue={queue} className={className ? `m-toast-region ${className}` : 'm-toast-region'}>
    {({toast}) => <Toast toast={toast} closeLabel={closeLabel}/>}
  </AriaToastRegion>;
}
