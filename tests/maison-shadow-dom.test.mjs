import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {build} from '../frontend/maison/node_modules/esbuild/lib/main.js';
import {
  REACT_ARIA_COMPAT_VERSION,
  REACT_ARIA_SLOT_NEEDLE,
  createReactAriaSlotContainmentCompat,
  patchReactAriaSlotContainment,
} from '../frontend/maison/react-aria-compat.mjs';

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const frontend = join(repository, 'frontend/maison');
const packageJson = JSON.parse(readFileSync(join(frontend, 'node_modules/react-aria/package.json'), 'utf8'));
const upstreamPath = join(frontend, 'node_modules/react-aria/dist/private/utils/shadowdom/DOMFunctions.mjs');
const upstream = readFileSync(upstreamPath, 'utf8');

function actualNodeContains(source, shadowDOMEnabled = true) {
  const functionName = source.match(/function\s+([^\s(]+)\(node, otherNode\)/)?.[1];
  const shadowDOMName = source.match(/import \{shadowDOM as ([^}]+)\}/)?.[1];
  const isShadowRootName = source.match(/isShadowRoot as ([^}]+)\}/)?.[1];
  assert.ok(functionName && shadowDOMName && isShadowRootName, 'installed helper keeps its expected imports and function');
  const executable = source
    .replace(/^import .*;\n/gm, '')
    .replace(/^export \{.*;\n?/gm, '')
    .replace(/^\/\/# sourceMappingURL=.*$/gm, '')
    .replaceAll(`(0, ${shadowDOMName})()`, 'shadowDOM()')
    .replaceAll(`(0, ${isShadowRootName})(currentNode)`, 'isShadowRoot(currentNode)')
    + `\nglobalThis.__nodeContains = ${functionName};`;
  const context = {
    shadowDOM: () => shadowDOMEnabled,
    isShadowRoot: node => Boolean(node?.isShadowRoot),
  };
  vm.runInNewContext(executable, context);
  return context.__nodeContains;
}

function element(name, {parentNode = null, assignedSlot = null, slot = false} = {}) {
  const value = {name, parentNode, assignedSlot};
  if (slot) value.assignedElements = () => [];
  value.contains = other => {
    let current = other;
    while (current) {
      if (current === value) return true;
      current = current.parentNode;
    }
    return false;
  };
  return value;
}

function fixture() {
  const documentRoot = element('document');
  const outside = element('outside', {parentNode: documentRoot});
  const drawer = element('drawer', {parentNode: documentRoot});
  const outerSlot = element('outer-slot', {parentNode: drawer, slot: true});
  const reprojectedHost = element('reprojected-host', {parentNode: outside});
  const innerSlot = element('inner-slot', {parentNode: reprojectedHost, assignedSlot: outerSlot, slot: true});
  const control = element('control', {parentNode: outside, assignedSlot: innerSlot});
  const unrelated = element('unrelated', {parentNode: outside});
  const shadowHost = element('shadow-host', {parentNode: drawer});
  const shadowRoot = {name: 'shadow-root', parentNode: null, host: shadowHost, isShadowRoot: true};
  const shadowControl = element('shadow-control', {parentNode: shadowRoot});
  const lightDomChild = element('light-dom-child', {parentNode: drawer});
  return {drawer, outerSlot, innerSlot, control, unrelated, shadowHost, shadowControl, lightDomChild};
}

function nestedHostFixture() {
  const documentRoot = element('document');
  const body = element('body', {parentNode: documentRoot});
  const outside = element('outside', {parentNode: body});
  const outerHost = element('outer-host', {parentNode: body});
  const outerRoot = {name: 'outer-root', parentNode: null, host: outerHost, isShadowRoot: true};
  const outerSlot = element('outer-slot', {parentNode: outerRoot, slot: true});
  const innerHost = element('inner-host', {parentNode: outerHost, assignedSlot: outerSlot});
  const innerRoot = {name: 'inner-root', parentNode: null, host: innerHost, isShadowRoot: true};
  const innerSlot = element('inner-slot', {parentNode: innerRoot, slot: true});
  const maisonHost = element('maison-host', {parentNode: innerHost, assignedSlot: innerSlot});
  const maisonRoot = {name: 'maison-root', parentNode: null, host: maisonHost, isShadowRoot: true};
  const drawer = element('drawer', {parentNode: maisonRoot});
  const control = element('drawer-control', {parentNode: drawer});
  return {
    ancestors: [drawer, maisonRoot, maisonHost, innerSlot, innerRoot, innerHost, outerSlot, outerRoot, outerHost, body],
    body,
    control,
    outside,
    innerSlot,
  };
}

test('installed React Aria helper skips assigned slots while the adapter contains nested and reprojected slots', () => {
  assert.equal(packageJson.version, REACT_ARIA_COMPAT_VERSION);
  assert.equal(upstream.split(REACT_ARIA_SLOT_NEEDLE).length - 1, 1);
  const original = actualNodeContains(upstream);
  const patched = actualNodeContains(patchReactAriaSlotContainment(upstream, packageJson.version));
  const nodes = fixture();

  assert.equal(original(nodes.innerSlot, nodes.control), false, 'upstream jumps over the assigned slot');
  assert.equal(patched(nodes.innerSlot, nodes.control), true, 'assigned slot is visited before its parent');
  assert.equal(patched(nodes.outerSlot, nodes.control), true, 'slot-to-slot reprojection reaches the outer slot');
  assert.equal(patched(nodes.drawer, nodes.control), true, 'nested slotted control stays within the drawer');
  assert.equal(patched(nodes.drawer, nodes.drawer), true, 'self containment remains true');
  assert.equal(patched(nodes.drawer, nodes.lightDomChild), true, 'ordinary light-DOM parent containment remains true');
  assert.equal(patched(nodes.shadowHost, nodes.shadowControl), true, 'ordinary shadow-root containment remains intact');
  assert.equal(patched(nodes.control, nodes.unrelated), false);
  assert.equal(patched(nodes.unrelated, nodes.control), false, 'unrelated controls remain outside');
  assert.equal(patched(null, nodes.control), false);
  assert.equal(patched(nodes.drawer, null), false);
  assert.equal(patched(null, null), false);

  const nativeBranch = actualNodeContains(patchReactAriaSlotContainment(upstream, packageJson.version), false);
  assert.equal(nativeBranch(nodes.drawer, nodes.lightDomChild), true, 'disabled shadow mode uses native contains');
  assert.equal(nativeBranch(nodes.drawer, nodes.control), false, 'native contains does not invent slot ancestry');
});

test('compatibility transform fails closed on version or source drift', () => {
  assert.throws(() => patchReactAriaSlotContainment(upstream, '3.52.2'), /requires react-aria 3\.52\.1/);
  assert.throws(() => patchReactAriaSlotContainment(upstream.replace(REACT_ARIA_SLOT_NEEDLE, ''), packageJson.version), /exactly once; found 0/);
  assert.throws(() => patchReactAriaSlotContainment(`${upstream}\n${REACT_ARIA_SLOT_NEEDLE}`, packageJson.version), /exactly once; found 2/);
});

test('patched helper follows a real nested host, shadow root, and slot ancestry chain', () => {
  const original = actualNodeContains(upstream);
  const patched = actualNodeContains(patchReactAriaSlotContainment(upstream, packageJson.version));
  const nodes = nestedHostFixture();
  assert.equal(original(nodes.innerSlot, nodes.control), false, 'upstream skips the inner slot boundary');
  for (const ancestor of nodes.ancestors) {
    assert.equal(patched(ancestor, nodes.control), true, `${ancestor.name} contains the nested Maison control`);
  }
  assert.equal(patched(nodes.outside, nodes.control), false);
  assert.equal(patched(nodes.control, nodes.outside), false);
  assert.equal(patched(nodes.body, nodes.outside), true, 'ordinary sibling remains a body descendant');
});

test('esbuild applies the guarded adapter to the actual bundled React Aria module', async () => {
  const unused = createReactAriaSlotContainmentCompat(frontend);
  assert.throws(() => unused.assertApplied({inputs: {}}), /not applied exactly once \(loads: 0, bundle inputs: 0\)/);
  const duplicate = createReactAriaSlotContainmentCompat(frontend);
  let onLoad;
  duplicate.plugin.setup({onLoad(_options, callback) { onLoad = callback; }});
  onLoad({path: duplicate.modulePath});
  onLoad({path: duplicate.modulePath});
  assert.throws(
    () => duplicate.assertApplied({inputs: {[duplicate.modulePath]: {}}}),
    /not applied exactly once \(loads: 2, bundle inputs: 1\)/,
  );
  // Maison's sheet (React Aria Components' Modal) is what pulls in the
  // containment helper.
  const compat = createReactAriaSlotContainmentCompat(frontend);
  const result = await build({
    entryPoints: [join(frontend, 'src/ui/sheet.jsx')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    jsx: 'automatic',
    metafile: true,
    plugins: [compat.plugin],
    define: {'process.env.NODE_ENV': '"production"'},
    logLevel: 'silent',
  });
  assert.ok(Object.keys(result.metafile.inputs).some(input => input.endsWith('react-aria/dist/private/utils/shadowdom/DOMFunctions.mjs')), 'the sheet pulls in DOMFunctions');
  assert.doesNotThrow(() => compat.assertApplied(result.metafile));
  const output = result.outputFiles.map(file => file.text).join('\n');
  assert.match(output, /currentNode = currentNode\.assignedSlot;/);
  assert.doesNotMatch(output, /currentNode = currentNode\.assignedSlot\.parentNode;/);
});
