import {readFileSync} from 'node:fs';
import {join, normalize, resolve} from 'node:path';

export const REACT_ARIA_COMPAT_VERSION = '3.52.1';
export const REACT_ARIA_DOM_FUNCTIONS = 'node_modules/react-aria/dist/private/utils/shadowdom/DOMFunctions.mjs';
export const REACT_ARIA_PREVENT_SCROLL = 'node_modules/react-aria/dist/private/overlays/usePreventScroll.mjs';

// The iOS keyboard-Done fallback must not handle useDialog's 500 ms
// accessibility blur/refocus. Otherwise a nested dialog focuses its parent
// and dismisses itself. Keep the fallback for elements that open the keyboard.
export const REACT_ARIA_IOS_BLUR_NEEDLE = `        } else if (!relatedTarget) {
            // When tapping the Done button on the keyboard, focus moves to the body.`;
export const REACT_ARIA_IOS_BLUR_REPLACEMENT = `        } else if (!relatedTarget && (0, $bb39c0fc1c19b34c$export$c57958e35f31ed73)(target)) {
            // When tapping the Done button on the keyboard, focus moves to the body.`;

// react-aria 3.52.1 skips the assigned slot itself and jumps straight to the
// slot's parent. That makes a slotted Maison host appear outside a nested
// Drawer/Popover containment boundary. Visit the slot before its ancestors;
// this also follows slot-to-slot reprojection.
export const REACT_ARIA_SLOT_NEEDLE = `        if (typeof currentNode.assignedElements !== 'function' && currentNode.assignedSlot?.parentNode) // Element is slotted
        currentNode = currentNode.assignedSlot.parentNode;`;

export const REACT_ARIA_SLOT_REPLACEMENT = `        if (currentNode.assignedSlot) // Element is slotted
        currentNode = currentNode.assignedSlot;`;

function occurrences(source, needle) {
  return source.split(needle).length - 1;
}

export function patchReactAriaSlotContainment(source, version = REACT_ARIA_COMPAT_VERSION) {
  if (version !== REACT_ARIA_COMPAT_VERSION) {
    throw new Error(`Maison React Aria compatibility adapter requires react-aria ${REACT_ARIA_COMPAT_VERSION}; found ${version}`);
  }
  const count = occurrences(source, REACT_ARIA_SLOT_NEEDLE);
  if (count !== 1) {
    throw new Error(`Maison React Aria compatibility adapter expected its source needle exactly once; found ${count}`);
  }
  return source.replace(REACT_ARIA_SLOT_NEEDLE, REACT_ARIA_SLOT_REPLACEMENT);
}

export function patchReactAriaIOSBlur(source, version = REACT_ARIA_COMPAT_VERSION) {
  if (version !== REACT_ARIA_COMPAT_VERSION) {
    throw new Error(`Maison React Aria iOS blur adapter requires react-aria ${REACT_ARIA_COMPAT_VERSION}; found ${version}`);
  }
  const count = occurrences(source, REACT_ARIA_IOS_BLUR_NEEDLE);
  const keyboardImport = 'import {willOpenKeyboard as $bb39c0fc1c19b34c$export$c57958e35f31ed73}';
  if (count !== 1 || !source.includes(keyboardImport)) {
    throw new Error(`Maison React Aria iOS blur adapter expected its source needle exactly once and the keyboard helper import; found ${count}`);
  }
  return source.replace(REACT_ARIA_IOS_BLUR_NEEDLE, REACT_ARIA_IOS_BLUR_REPLACEMENT);
}

export function createReactAriaIOSBlurCompat(frontendRoot) {
  const packageRoot = resolve(frontendRoot);
  const metadata = JSON.parse(readFileSync(join(packageRoot, 'node_modules/react-aria/package.json'), 'utf8'));
  const modulePath = resolve(packageRoot, REACT_ARIA_PREVENT_SCROLL);
  // Validate eagerly even if a future build stops importing this module.
  patchReactAriaIOSBlur(readFileSync(modulePath, 'utf8'), metadata.version);
  let applications = 0;
  const plugin = {
    name: 'maison-react-aria-ios-blur',
    setup(build) {
      build.onLoad({filter: /react-aria[\\/]dist[\\/]private[\\/]overlays[\\/]usePreventScroll\.mjs$/}, args => {
        if (resolve(args.path) !== modulePath) return null;
        applications += 1;
        return {contents: patchReactAriaIOSBlur(readFileSync(args.path, 'utf8'), metadata.version), loader: 'js'};
      });
    },
  };
  const assertApplied = metafile => {
    const suffix = normalize(REACT_ARIA_PREVENT_SCROLL).replaceAll('\\', '/');
    const inputs = Object.keys(metafile?.inputs || {}).filter(input => normalize(input).replaceAll('\\', '/').endsWith(suffix));
    if (applications !== 1 || inputs.length !== 1) {
      throw new Error(`Maison React Aria iOS blur adapter was not applied exactly once (loads: ${applications}, bundle inputs: ${inputs.length})`);
    }
  };
  return {plugin, assertApplied, modulePath, version: metadata.version};
}

export function createReactAriaSlotContainmentCompat(frontendRoot) {
  const packageRoot = resolve(frontendRoot);
  const packageJson = join(packageRoot, 'node_modules/react-aria/package.json');
  const modulePath = resolve(packageRoot, REACT_ARIA_DOM_FUNCTIONS);
  const metadata = JSON.parse(readFileSync(packageJson, 'utf8'));
  if (metadata.version !== REACT_ARIA_COMPAT_VERSION) {
    throw new Error(`Maison React Aria compatibility adapter requires react-aria ${REACT_ARIA_COMPAT_VERSION}; found ${metadata.version}`);
  }
  let applications = 0;
  const plugin = {
    name: 'maison-react-aria-slot-containment',
    setup(build) {
      build.onLoad({filter: /react-aria[\\/]dist[\\/]private[\\/]utils[\\/]shadowdom[\\/]DOMFunctions\.mjs$/}, args => {
        if (resolve(args.path) !== modulePath) return null;
        applications += 1;
        return {
          contents: patchReactAriaSlotContainment(readFileSync(args.path, 'utf8'), metadata.version),
          loader: 'js',
        };
      });
    },
  };
  const assertApplied = metafile => {
    const suffix = normalize(REACT_ARIA_DOM_FUNCTIONS).replaceAll('\\', '/');
    const inputs = Object.keys(metafile?.inputs || {}).filter(input => normalize(input).replaceAll('\\', '/').endsWith(suffix));
    if (applications !== 1 || inputs.length !== 1) {
      throw new Error(`Maison React Aria compatibility adapter was not applied exactly once (loads: ${applications}, bundle inputs: ${inputs.length})`);
    }
  };
  return {plugin, assertApplied, modulePath, version: metadata.version};
}
