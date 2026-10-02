// The swipe that dismisses Maison's bottom sheet (#29): when a press becomes
// a drag, how far the sheet follows, how fast a release is, and whether it
// dismisses or goes back. frontend/maison/src/ui/sheet-drag.js decides it all
// without React or a DOM, so these tests drive its pointer handlers on
// stand-ins for the sheet; the touch suite (visual/sheet.touch.spec.mjs)
// drives the real sheet in the browsers.
import test from 'node:test';
import assert from 'node:assert/strict';

const {DRAG, NOT_A_HANDLE, dragOffset, dragStarted, releaseOutcome, releaseSpeed, scrimShare, sheetDrag} =
  await import(new URL('../frontend/maison/src/ui/sheet-drag.js', import.meta.url));

test('a press becomes a drag only past 8px, either way', () => {
  assert.deepEqual([0, 5, 8, -8].map(dragStarted), [false, false, false, false]);
  assert.deepEqual([9, -9, 40].map(dragStarted), [true, true, true]);
});

test('the sheet follows down only, never above where it rests', () => {
  assert.equal(dragOffset(100, 160), 60);
  assert.equal(dragOffset(100, 100), 0);
  assert.equal(dragOffset(100, 40), 0);
});

test('the scrim lightens as the sheet goes down, from all of it at rest to none a height down', () => {
  assert.deepEqual([0, 150, 300, 600, 900].map(offset => scrimShare(offset, 600)), [1, 0.75, 0.5, 0, 0]);
  assert.equal(scrimShare(40, 0), 1, 'a sheet not laid out keeps its scrim');
});

test('the release speed is read over the last 100ms, downward positive', () => {
  const samples = [{t: 0, y: 0}, {t: 200, y: 20}, {t: 260, y: 50}, {t: 300, y: 90}];
  assert.equal(releaseSpeed(samples, 300), (90 - 20) / (300 - 200));
  assert.equal(releaseSpeed([{t: 0, y: 90}, {t: 50, y: 40}], 50), -1, 'an upward flick is negative');
  // A drag that stopped before letting go is not a flick.
  assert.equal(releaseSpeed(samples, 450), 0);
  assert.equal(releaseSpeed([{t: 10, y: 0}], 10), 0);
  assert.equal(releaseSpeed([{t: 10, y: 0}, {t: 10, y: 30}], 10), 0, 'no time, no speed');
});

test('a release dismisses past 30% of the height or faster than 0.5px/ms downward', () => {
  const height = 600;
  assert.equal(releaseOutcome({distance: 181, height, speed: 0}), 'dismiss');
  assert.equal(releaseOutcome({distance: 180, height, speed: 0}), 'snap-back');
  assert.equal(releaseOutcome({distance: 20, height, speed: 0.6}), 'dismiss', 'a flick');
  assert.equal(releaseOutcome({distance: 20, height, speed: 0.5}), 'snap-back');
  assert.equal(releaseOutcome({distance: 20, height, speed: -3}), 'snap-back', 'an upward flick never dismisses');
  assert.equal(DRAG.share, 0.3);
  assert.equal(DRAG.speed, 0.5);
});

test('going back is instant under reduced motion, and a cancelled pointer always goes back', () => {
  assert.equal(releaseOutcome({distance: 40, height: 600, speed: 0, reducedMotion: true}), 'jump-back');
  assert.equal(releaseOutcome({distance: 400, height: 600, speed: 0, reducedMotion: true}), 'dismiss', 'reduced motion still dismisses');
  assert.equal(releaseOutcome({distance: 400, height: 600, speed: 2, cancelled: true}), 'snap-back');
  assert.equal(releaseOutcome({distance: 400, height: 600, speed: 2, cancelled: true, reducedMotion: true}), 'jump-back');
});

test('nothing interactive starts a drag, and a still-open sheet goes back after 400ms', () => {
  assert.deepEqual(NOT_A_HANDLE.split(','), ['button', 'a', 'input', 'select', 'textarea', '[role=button]', '[role=switch]', '[role=radio]']);
  assert.equal(DRAG.start, 8);
  assert.equal(DRAG.settle, 400);
});

// ---- The gesture, on stand-ins for the sheet and its scrim ----------------

// A `.m-sheet` element as sheetDrag touches it: inline styles, a height,
// pointer capture, and its scrim as parent. `closest` answers for the
// sheet's own class and nothing else.
function standIns({height = 600} = {}) {
  const overlay = {style: {}};
  const sheet = {style: {}, offsetHeight: height, parentElement: overlay, isConnected: true, attributes: new Set(), captured: new Set(),
    hasAttribute: name => sheet.attributes.has(name), closest: selector => selector === '.m-sheet' ? sheet : null,
    setPointerCapture: id => sheet.captured.add(id), releasePointerCapture: id => sheet.captured.delete(id)};
  // A target inside the sheet: `handle` marks a [data-sheet-drag] area, `control` a button.
  const target = ({handle = true, control = false} = {}) => ({closest: selector =>
    selector === '[data-sheet-drag]' ? (handle ? {closest: s => s === '.m-sheet' ? sheet : null} : null)
      : selector === NOT_A_HANDLE ? (control ? {} : null) : null});
  return {sheet, overlay, target};
}
// A clock the test moves by hand.
function clock() {
  let now = 0, next = 1;
  const timers = new Map();
  return {
    later: (run, ms) => { timers.set(next, {run, at: now + ms}); return next++; },
    cancel: id => timers.delete(id),
    advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); } },
  };
}
const pointer = (type, y, t, extra = {}) => ({type, pointerId: 1, button: 0, clientY: y, timeStamp: t, ...extra});
// Drives a drag: down at y0, moves in `steps` to y0 + dy, `pause` ms apart.
function drive(handlers, target, {y0 = 100, dy, steps = 8, pause = 30, start = 0}) {
  handlers.onPointerDown({...pointer('pointerdown', y0, start), target});
  for (let i = 1; i <= steps; i++) handlers.onPointerMove(pointer('pointermove', y0 + dy * i / steps, start + i * pause));
  return {y: y0 + dy, t: start + steps * pause};
}

test('a drag from the handle moves the sheet down, captures the pointer and lightens the scrim', () => {
  const {sheet, overlay, target} = standIns(), time = clock();
  const handlers = sheetDrag(() => sheet, () => assert.fail('no dismiss'), time);
  drive(handlers, target(), {dy: 150});
  assert.equal(sheet.style.transform, 'translateY(150px)');
  assert.equal(sheet.style.transition, 'none');
  assert.ok(sheet.captured.has(1));
  assert.equal(overlay.style.backgroundColor, 'color-mix(in srgb,var(--m-scrim) 75%,transparent)');
});

test('a press on a control, or outside the handle, never moves the sheet', () => {
  for (const where of [{control: true}, {handle: false}]) {
    const {sheet, target} = standIns();
    const handlers = sheetDrag(() => sheet, () => assert.fail('no dismiss'), clock());
    drive(handlers, target(where), {dy: 300});
    handlers.onPointerUp(pointer('pointerup', 400, 1000));
    assert.equal(sheet.style.transform, undefined, JSON.stringify(where));
  }
});

test('a short, slow drag goes back over the sheet duration and clears its transitions after', () => {
  const {sheet, overlay, target} = standIns(), time = clock();
  const handlers = sheetDrag(() => sheet, () => assert.fail('no dismiss'), time);
  const end = drive(handlers, target(), {dy: 48, steps: 6, pause: 40});
  handlers.onPointerUp(pointer('pointerup', end.y, end.t + 160));
  assert.equal(sheet.style.transform, '');
  assert.equal(sheet.style.transition, 'transform var(--m-dur-sheet) var(--m-ease)');
  assert.equal(overlay.style.backgroundColor, '');
  assert.ok(!sheet.captured.has(1), 'the capture is released');
  time.advance(1000);
  assert.equal(sheet.style.transition, '');
  assert.equal(overlay.style.transition, '');
});

test('a long drag or a quick flick dismisses and keeps the transform; a sheet still open 400ms later goes back', () => {
  // Past 30% but held still before letting go (no speed); a flick of 80px at 2px/ms.
  for (const [name, move, hold] of [['past 30%', {dy: 200}, 150], ['a flick', {dy: 80, steps: 4, pause: 10}, 0]]) {
    const {sheet, target} = standIns(), time = clock();
    let dismissed = 0;
    const handlers = sheetDrag(() => sheet, () => dismissed++, time);
    const end = drive(handlers, target(), move);
    handlers.onPointerUp(pointer('pointerup', end.y, end.t + hold));
    assert.equal(dismissed, 1, name);
    assert.match(sheet.style.transform, /^translateY\(\d+px\)$/, `${name}: the exit carries on from here`);
    time.advance(399);
    assert.notEqual(sheet.style.transform, '', name);
    time.advance(1);
    assert.equal(sheet.style.transform, '', `${name}: still open, so it goes back`);
  }
});

test('a sheet already closing when the 400ms are up is left to its exit', () => {
  const {sheet, target} = standIns(), time = clock();
  const handlers = sheetDrag(() => sheet, () => sheet.attributes.add('data-exiting'), time);
  const end = drive(handlers, target(), {dy: 250});
  handlers.onPointerUp(pointer('pointerup', end.y, end.t + 150));
  time.advance(400);
  assert.equal(sheet.style.transform, 'translateY(250px)');
});

test('pointercancel and a lost capture send the sheet back and end the drag', () => {
  for (const lose of ['pointercancel', 'lostpointercapture']) {
    const {sheet, target} = standIns(), time = clock();
    const handlers = sheetDrag(() => sheet, () => assert.fail('no dismiss'), time);
    drive(handlers, target(), {dy: 300, pause: 5});
    if (lose === 'pointercancel') handlers.onPointerCancel(pointer(lose, 0, 100));
    else handlers.onLostPointerCapture(pointer(lose, 0, 100, {target: sheet}));
    assert.equal(sheet.style.transform, '', lose);
    // The drag is over: later moves and a stray release do nothing.
    handlers.onPointerMove(pointer('pointermove', 500, 120));
    handlers.onPointerUp(pointer('pointerup', 500, 130));
    assert.equal(sheet.style.transform, '', `${lose}: nothing follows`);
  }
});

test('the header losing a touch’s implicit capture to the sheet does not end the drag', () => {
  const {sheet, target} = standIns();
  const handlers = sheetDrag(() => sheet, () => {}, clock());
  drive(handlers, target(), {dy: 60});
  handlers.onLostPointerCapture(pointer('lostpointercapture', 0, 300, {target: {}}));
  handlers.onPointerMove(pointer('pointermove', 180, 330));
  assert.equal(sheet.style.transform, 'translateY(80px)');
});

test('under reduced motion the sheet goes back at once', () => {
  const {sheet, target} = standIns(), time = clock();
  const handlers = sheetDrag(() => sheet, () => assert.fail('no dismiss'), {...time, reducedMotion: () => true});
  const end = drive(handlers, target(), {dy: 40, steps: 4, pause: 40});
  handlers.onPointerUp(pointer('pointerup', end.y, end.t + 160));
  assert.equal(sheet.style.transform, '');
  assert.equal(sheet.style.transition, '');
});

// ---- The stylesheet -----------------------------------------------------

test('the sheet sizes by the visual viewport and Home Assistant’s safe areas, never by vh', async () => {
  const {sheetStyles} = await import(new URL('../frontend/maison/src/ui/sheet.css.js', import.meta.url));
  assert.match(sheetStyles, /\.m-sheet-overlay\{[^}]*height:var\(--visual-viewport-height,100dvh\)/);
  assert.doesNotMatch(sheetStyles, /\d(?:s|l)?vh\b/);
  assert.doesNotMatch(sheetStyles.replace(/var\(--safe-area-inset-(\w+),env\(safe-area-inset-\1,0px\)\)/g, ''), /safe-area-inset/,
    'every safe area reads HA’s variable first');
});
