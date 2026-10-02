// A bottom sheet's swipe-down dismiss (#29), with no React and no DOM globals,
// so the Node tests can drive it: the rules (when a press becomes a drag, how
// far the sheet follows, how fast a release is, whether it dismisses or goes
// back) and sheetDrag, the pointer handlers that apply them to the sheet
// element they are handed. sheet.jsx's useSheetDrag puts them on `.m-sheet`.

// A press moves this far (px) before the sheet follows it; a release past
// this share of the sheet's height, or faster than this (px/ms, downward),
// dismisses it. The speed is read over the last `window` ms before release,
// so a drag that stops before letting go is not a flick. A sheet still open
// `settle` ms after a swipe asked to dismiss it goes back.
export const DRAG = {start: 8, share: 0.3, speed: 0.5, window: 100, settle: 400};

// What never starts a drag, even inside a [data-sheet-drag] area.
export const NOT_A_HANDLE = 'button,a,input,select,textarea,[role=button],[role=switch],[role=radio]';

// Whether a pointer `delta` px from where it went down has become a drag.
export const dragStarted = delta => Math.abs(delta) > DRAG.start;

// How far the sheet follows: down only, never above where it rests.
export const dragOffset = (startY, y) => Math.max(0, y - startY);

// How much of the scrim stays while the sheet is `offset` px down: all of
// it at rest, none once the sheet is a whole height down.
export const scrimShare = (offset, height) => height > 0 ? Math.min(1, Math.max(0, 1 - offset / height)) : 1;

// The downward speed (px/ms) at `at` from the samples ({t, y}) of the last
// DRAG.window ms; 0 when fewer than two samples are that recent.
export function releaseSpeed(samples, at) {
  const recent = samples.filter(sample => at - sample.t <= DRAG.window);
  if (recent.length < 2) return 0;
  const first = recent[0], last = recent[recent.length - 1];
  return last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
}

// What a release does: 'dismiss' past 30% of the height or faster than 0.5
// px/ms downward, otherwise back to rest: 'snap-back' over the sheet's
// duration, or 'jump-back' at once under reduced motion. A cancelled pointer
// (the browser took the gesture, or the sheet lost it) always goes back.
export function releaseOutcome({distance, height, speed, reducedMotion = false, cancelled = false}) {
  if (!cancelled && (distance > height * DRAG.share || speed > DRAG.speed)) return 'dismiss';
  return reducedMotion ? 'jump-back' : 'snap-back';
}

// The scrim behind a dragged sheet lightens with it, as the page it uncovers
// comes back; `share` is how much of it stays.
const dim = (overlay, share) => { if (overlay) overlay.style.backgroundColor = share < 1 ? `color-mix(in srgb,var(--m-scrim) ${Math.round(share * 100)}%,transparent)` : ''; };

/**
 * The swipe on one sheet, as pointer handlers for its `.m-sheet` element.
 *
 * - A press starts only on a `[data-sheet-drag]` inside this sheet, never on
 *   anything NOT_A_HANDLE matches. Past 8px the sheet follows it, down only,
 *   with pointer capture, and the scrim lightens as it goes.
 * - On release it dismisses (releaseOutcome): it calls `dismiss()` and keeps
 *   the transform, which the exit animation carries on from; if the sheet is
 *   still open DRAG.settle ms later (not exiting, still in the document), it
 *   goes back. Otherwise it goes back at once.
 * - `pointercancel`, and the sheet losing its pointer capture mid-drag, go
 *   back too and end the drag, so no lost release can leave it shifted.
 *
 * @param {() => HTMLElement|null} sheetOf The `.m-sheet` element, when there is one.
 * @param {() => void} dismiss
 * @param {{reducedMotion?: () => boolean, later?: typeof setTimeout, cancel?: typeof clearTimeout}} [clock]
 * @returns {{onPointerDown: Function, onPointerMove: Function, onPointerUp: Function, onPointerCancel: Function, onLostPointerCapture: Function, dispose: () => void}}
 */
export function sheetDrag(sheetOf, dismiss, {reducedMotion = () => false, later = setTimeout, cancel = clearTimeout} = {}) {
  let drag = null, settling = 0;
  // Back to rest, over --m-dur-sheet or at once. Each inline transition is
  // cleared afterwards, unless a new drag has set its own since.
  const backToRest = (sheet, animate) => {
    const moves = [[sheet, 'transform'], [sheet.parentElement, 'background-color']].filter(([element]) => element);
    for (const [element, property] of moves) element.style.transition = animate ? `${property} var(--m-dur-sheet) var(--m-ease)` : '';
    const set = moves.map(([element]) => element.style.transition);
    sheet.style.transform = ''; dim(sheet.parentElement, 1);
    if (animate) later(() => moves.forEach(([element], i) => { if (element.style.transition === set[i]) element.style.transition = ''; }), 1000);
  };
  const release = (event, cancelled) => {
    const current = drag, sheet = sheetOf();
    if (!current || current.id !== event.pointerId) return;
    drag = null;
    if (!sheet || !current.moving) return;
    try { sheet.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    if (!cancelled) current.samples.push({t: event.timeStamp, y: event.clientY});
    const outcome = releaseOutcome({distance: current.offset, height: sheet.offsetHeight,
      speed: releaseSpeed(current.samples, event.timeStamp), reducedMotion: reducedMotion(), cancelled});
    if (outcome !== 'dismiss') { backToRest(sheet, outcome === 'snap-back'); return; }
    dismiss();
    cancel(settling);
    settling = later(() => { if (sheet.isConnected && !sheet.hasAttribute('data-exiting')) backToRest(sheet, !reducedMotion()); }, DRAG.settle);
  };
  return {
    onPointerDown(event) {
      const sheet = sheetOf(), target = event.target;
      // A press that ended outside the sheet before it moved left no release: replace it.
      if (!sheet || drag?.moving || event.button !== 0 || typeof target?.closest !== 'function') return;
      const handle = target.closest('[data-sheet-drag]');
      if (!handle || handle.closest('.m-sheet') !== sheet || target.closest(NOT_A_HANDLE)) return;
      drag = {id: event.pointerId, startY: event.clientY, offset: 0, moving: false, samples: [{t: event.timeStamp, y: event.clientY}]};
    },
    onPointerMove(event) {
      const sheet = sheetOf();
      if (!drag || drag.id !== event.pointerId || !sheet) return;
      if (!drag.moving) {
        if (!dragStarted(event.clientY - drag.startY)) return;
        drag.moving = true;
        cancel(settling);
        sheet.style.transition = 'none';
        if (sheet.parentElement) sheet.parentElement.style.transition = 'none';
        try { sheet.setPointerCapture(event.pointerId); } catch { /* a synthetic pointer */ }
      }
      drag.offset = dragOffset(drag.startY, event.clientY);
      drag.samples.push({t: event.timeStamp, y: event.clientY});
      if (drag.samples.length > 32) drag.samples.shift();
      sheet.style.transform = `translateY(${drag.offset}px)`;
      dim(sheet.parentElement, scrimShare(drag.offset, sheet.offsetHeight));
    },
    onPointerUp: event => release(event, false),
    onPointerCancel: event => release(event, true),
    // Only the sheet's own capture: a touch's implicit capture on the header
    // is lost, and bubbles here, when the sheet takes the pointer over.
    onLostPointerCapture(event) { if (event.target === sheetOf()) release(event, true); },
    dispose() { cancel(settling); },
  };
}
