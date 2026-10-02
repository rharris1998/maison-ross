import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {
  REACT_ARIA_PREVENT_SCROLL, REACT_ARIA_IOS_BLUR_NEEDLE,
  createReactAriaIOSBlurCompat, patchReactAriaIOSBlur,
} from '../frontend/maison/react-aria-compat.mjs';

const frontend = fileURLToPath(new URL('../frontend/maison/', import.meta.url));
const upstream = readFileSync(new URL(`../frontend/maison/${REACT_ARIA_PREVENT_SCROLL}`, import.meta.url), 'utf8');

// Execute the installed callback, including its keyboard-transition branches.
// The browser regression exercises the complete nested drawer/popover interaction.
function blurHandler(source, scrolls) {
  const callback = source.slice(source.indexOf('let onBlur = (e)=>{'), source.indexOf('    // Override programmatic focus'));
  const context = {
    $23f2114a1b82827e$export$e58f029f0fbfdb29: event => event.target,
    $bb39c0fc1c19b34c$export$c57958e35f31ed73: target => Boolean(target.opensKeyboard),
    $0644e3663365bfe5$var$scrollIntoViewWhenReady: (target, wasOpen) => scrolls.push({target, wasOpen}),
  };
  vm.runInNewContext(`${callback}\nglobalThis.blur = onBlur;`, context);
  return context.blur;
}

test('iOS dialog refocusing does not activate keyboard-Done fallback, while input transitions still do', () => {
  let parentFocuses = 0;
  const parent = {focus() { parentFocuses++; }};
  const dialog = {parentElement: {closest: () => parent}};
  const input = {...dialog, opensKeyboard: true};
  const scrolls = [];
  const original = blurHandler(upstream, scrolls);
  const patched = blurHandler(patchReactAriaIOSBlur(upstream), scrolls);
  original({target: dialog, relatedTarget: null});
  assert.equal(parentFocuses, 1, 'upstream steals focus from the nested dialog');
  patched({target: dialog, relatedTarget: null});
  assert.equal(parentFocuses, 1, 'dialog blur leaves accessibility refocusing alone');
  patched({target: input, relatedTarget: null});
  assert.equal(parentFocuses, 2, 'keyboard Done still focuses the parent');
  let fieldFocuses = 0;
  const nextInput = {opensKeyboard: true, focus(options) { assert.equal(options.preventScroll, true); fieldFocuses++; }};
  patched({target: input, relatedTarget: nextInput});
  patched({target: dialog, relatedTarget: nextInput});
  assert.equal(fieldFocuses, 2);
  assert.deepEqual(scrolls, [{target: nextInput, wasOpen: true}, {target: nextInput, wasOpen: false}]);
  patched({target: input, relatedTarget: dialog});
  assert.equal(parentFocuses, 2, 'explicit focus to a non-input is preserved');
});

test('iOS blur adapter rejects dependency and source drift', () => {
  assert.throws(() => patchReactAriaIOSBlur(upstream, '3.52.2'), /requires react-aria/);
  assert.throws(() => patchReactAriaIOSBlur(upstream.replace(REACT_ARIA_IOS_BLUR_NEEDLE, '')), /exactly once/);
  assert.throws(() => patchReactAriaIOSBlur(upstream + REACT_ARIA_IOS_BLUR_NEEDLE), /exactly once/);
  assert.throws(() => patchReactAriaIOSBlur(upstream.replace('import {willOpenKeyboard as', 'import {other as')), /keyboard helper import/);
});

test('iOS blur adapter applies exactly once to the bundled module', async () => {
  const compat = createReactAriaIOSBlurCompat(frontend);
  assert.throws(() => compat.assertApplied({inputs: {}}), /not applied exactly once/);
  const result = await build({
    entryPoints: [compat.modulePath], bundle: true, write: false, format: 'esm',
    platform: 'browser', metafile: true, plugins: [compat.plugin],
    define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent',
  });
  assert.doesNotThrow(() => compat.assertApplied(result.metafile));
  assert.match(result.outputFiles[0].text, /else if \(!relatedTarget && .*\(target\)\)/);
});
