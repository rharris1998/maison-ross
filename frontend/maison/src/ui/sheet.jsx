// Maison's sheet (#29): the one modal surface, in place of HeroUI's Drawer
// and Modal. It is React Aria's ModalOverlay, Modal and Dialog, so focus is
// held inside and given back, Escape and the scrim dismiss it, and the rest
// of the page is hidden from assistive tech while it is open. It is drawn in
// the portal inside Maison's shadow root (PortalContext), and anything opened
// inside it (a select's list, a tooltip) stays inside it (OverlayBoundary),
// where React Aria's slot-aware containment check finds it.
import {createContext, useContext, useEffect, useMemo, useRef} from 'react';
import {Dialog} from 'react-aria-components/Dialog';
import {Heading} from 'react-aria-components/Heading';
import {Modal, ModalOverlay} from 'react-aria-components/Modal';
import {PortalContext} from '../contexts.js';
import {Button} from './button.jsx';
import {OverlayBoundary} from './overlay-boundary.jsx';
import {useWideViewport} from './layout.js';
import {sheetDrag} from './sheet-drag.js';

/**
 * The last non-null `value`, so a sheet keeps its content while it closes (as
 * src/drawer.jsx:25-27 does).
 * @template T
 * @param {T|null|undefined} value
 * @returns {T|null}
 */
export function useLast(value) {
  const last = useRef(null);
  if (value) last.current = value;
  return value || last.current;
}

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Swipe-down dismiss for a bottom sheet: sheet-drag.js's sheetDrag, bound to
 * `ref` (the `.m-sheet` element) and the latest `onDismiss`. The returned
 * pointer handlers go on `.m-sheet`.
 *
 * - Starts only on a `[data-sheet-drag]` inside this sheet, never on a
 *   button, link, input or `[role=button|switch|radio]`.
 * - Starts moving past 8px, clamped at 0 or more, with pointer capture; the
 *   transform goes on `.m-sheet` itself, and the scrim lightens as it goes.
 * - On release it dismisses when the distance is over 30% of the sheet's
 *   height or the speed is over 0.5 px/ms: it calls `onDismiss()` and keeps the
 *   transform, which the exit animation carries on from. Otherwise it snaps
 *   back over --m-dur-sheet (instantly under reduced motion). `pointercancel`
 *   and a lost pointer capture snap back too.
 * - If the sheet is still open 400ms after `onDismiss`, it snaps back.
 *
 * @param {{current: HTMLElement|null}} ref
 * @param {() => void} onDismiss
 * @returns {{onPointerDown: Function, onPointerMove: Function, onPointerUp: Function, onPointerCancel: Function, onLostPointerCapture: Function}}
 */
export function useSheetDrag(ref, onDismiss) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const drag = useMemo(() => sheetDrag(() => ref.current, () => dismiss.current(), {reducedMotion}), [ref]);
  useEffect(() => drag.dispose, [drag]);
  return useMemo(() => { const {dispose, ...handlers} = drag; return handlers; }, [drag]);
}

/**
 * Where the sheet around a part sits, 'bottom' or 'center', which the Sheet
 * provides to its body (v32): a part sized to the sheet, such as the 24-hour
 * chart, reads it rather than the viewport, so a static sheet drawn at
 * another width (the gallery's pages view) can provide its own. Null outside
 * a sheet.
 * @type {import('react').Context<'bottom'|'center'|null>}
 */
export const SheetPlacementContext = createContext(null);

/**
 * The placement of the sheet a part is drawn in: SheetPlacementContext's
 * value, or, outside a sheet, what a Sheet would take at this viewport
 * ('center' from 700px, useWideViewport()).
 * @returns {'bottom'|'center'}
 */
export function useSheetPlacement() {
  const placement = useContext(SheetPlacementContext), wide = useWideViewport();
  return placement ?? (wide ? 'center' : 'bottom');
}

/**
 * A sheet: a bottom sheet on a phone-width viewport, a centred form sheet
 * from 700px (useWideViewport(), since it covers the viewport).
 *
 * DOM, in the portal (PortalContext):
 * - `div.m-sheet-overlay` (React Aria's ModalOverlay): the scrim, sized to the
 *   visual viewport (`--visual-viewport-height`, which React Aria sets on it),
 *   so a bottom sheet rises above the iPhone keyboard;
 * - `div.m-sheet[data-placement=bottom|center]` (Modal), which carries the
 *   enter and exit animations and a swipe's transform;
 * - `section.m-sheet__dialog[role=dialog][aria-label=title]` (Dialog), holding
 *   inside an OverlayBoundary:
 *   - `div.m-sheet__grabber[data-sheet-drag][aria-hidden]`, bottom only;
 *   - `header.m-sheet__header[data-sheet-drag]`: `p.m-sheet__eyebrow`,
 *     `h2.m-sheet__title` (Heading slot="title"), and the close button
 *     (Button glass, icon-only, 36px, `slot="close"`, named `closeLabel`),
 *     centred on the title's line as iOS 26's is;
 *   - `div.m-sheet__body`, which scrolls on its own and keeps wheel events,
 *     and provides SheetPlacementContext (the placement) to what it holds.
 *
 * Every way out (Escape, the scrim, the close button, a swipe) calls
 * `onDismiss`; the sheet closes only when `isOpen` turns false, and focus goes
 * back to what had it before it opened.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onDismiss What closing sends: Escape, the scrim, the close button, a swipe.
 * @param {string} props.title Names the dialog and heads it.
 * @param {string} [props.eyebrow] The line above the title.
 * @param {string} [props.closeLabel='Close'] The close button's name.
 * @param {import('react').ReactNode} props.children
 */
export function Sheet({isOpen, onDismiss, title, eyebrow, closeLabel = 'Close', children}) {
  const portal = useContext(PortalContext), bottom = !useWideViewport(), ref = useRef(null);
  const drag = useSheetDrag(ref, onDismiss);
  return <ModalOverlay className="m-sheet-overlay" isOpen={isOpen} isDismissable onOpenChange={open => { if (!open) onDismiss(); }}
    UNSTABLE_portalContainer={portal || undefined}>
    <Modal ref={ref} className="m-sheet" data-placement={bottom ? 'bottom' : 'center'} {...(bottom ? drag : {})}>
      <Dialog className="m-sheet__dialog" aria-label={title}><OverlayBoundary>
        {bottom && <div className="m-sheet__grabber" data-sheet-drag="" aria-hidden="true"/>}
        <header className="m-sheet__header" data-sheet-drag="">
          <div className="m-sheet__heading">{eyebrow && <p className="m-sheet__eyebrow">{eyebrow}</p>}<Heading slot="title" className="m-sheet__title">{title}</Heading></div>
          <Button variant="glass" icon="close" ariaLabel={closeLabel} slot="close" className="m-sheet__close"/>
        </header>
        <SheetPlacementContext.Provider value={bottom ? 'bottom' : 'center'}>
          <div className="m-sheet__body" onWheel={event => event.stopPropagation()}>{children}</div>
        </SheetPlacementContext.Provider>
      </OverlayBoundary></Dialog>
    </Modal>
  </ModalOverlay>;
}
