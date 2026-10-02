// One renderer (#27): the served modules make no markup, and the React
// bundles carry no rule. What Maison shows is worked out in
// config/www/maison (screen.js and the page modules) and handed to React as
// values, so a wording change there never needs a rebuild. The bundles take
// only the icons from the served side: the element's shell sheet (styles.js)
// is the element's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';

const ROOT = new URL('../', import.meta.url);
const SERVED = new URL('config/www/maison/', ROOT);
const SOURCE = new URL('frontend/maison/src/', ROOT);
const read = url => readFileSync(url, 'utf8');

// Every .js and .jsx file under a folder, as URLs.
const sources = folder => readdirSync(folder, {withFileTypes: true}).flatMap(entry =>
  entry.isDirectory() ? sources(new URL(`${entry.name}/`, folder)) : /\.jsx?$/.test(entry.name) ? [new URL(entry.name, folder)] : []);
// Every module a file imports or re-exports: static, side-effect or dynamic.
const specifiers = text => [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
// A relative import as a path under config/www/maison, or null when it points elsewhere.
const served = (spec, file) => {
  if (!spec.startsWith('.')) return null;
  const path = relative(fileURLToPath(SERVED), fileURLToPath(new URL(spec.split('?')[0], file))).split('\\').join('/');
  return path.startsWith('..') ? null : path;
};

// The string literals of a JavaScript source, with comments and code left
// out: each quoted string, and each static part of a template literal.
// Regular expressions are skipped, told from a division by what precedes them.
function literals(source) {
  const found = [], word = /[\w$]/;
  let i = 0, prev = '';
  const regexMayStart = () => prev === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prev)
    || ['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await'].includes(prev);
  const quoted = quote => {
    let text = ''; i++;
    while (i < source.length && source[i] !== quote) {if (source[i] === '\\') text += source[i++]; text += source[i++];}
    i++; found.push(text); prev = quote;
  };
  const template = () => {
    let text = ''; i++;
    while (i < source.length && source[i] !== '`') {
      if (source[i] === '\\') {text += source[i++] + source[i++]; continue;}
      if (source[i] === '$' && source[i + 1] === '{') {found.push(text); text = ''; i += 2; code(true); continue;}
      text += source[i++];
    }
    i++; found.push(text); prev = '`';
  };
  const regex = () => {
    let inClass = false; i++;
    while (i < source.length) {
      const c = source[i++];
      if (c === '\\') i++;
      else if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
    }
    while (i < source.length && word.test(source[i])) i++;
    prev = 'regex';
  };
  function code(inTemplate) {
    let depth = 0;
    while (i < source.length) {
      const c = source[i], next = source[i + 1];
      if (c === '/' && next === '/') {while (i < source.length && source[i] !== '\n') i++; continue;}
      if (c === '/' && next === '*') {const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; continue;}
      if (c === '\'' || c === '"') {quoted(c); continue;}
      if (c === '`') {template(); continue;}
      if (c === '/' && regexMayStart()) {regex(); continue;}
      if (/\s/.test(c)) {i++; continue;}
      if (word.test(c)) {const start = i; while (i < source.length && word.test(source[i])) i++; prev = source.slice(start, i); continue;}
      if (c === '{') depth++;
      if (c === '}') {if (inTemplate && depth === 0) {i++; prev = '}'; return;} depth--;}
      prev = c; i++;
    }
  }
  code(false);
  return found;
}
// An HTML tag in a string: an opening or closing tag name followed by a space, > or />.
const TAG = /<\/?[a-z][a-z0-9-]*(?=[\s>/]|$)/i;
// The one piece of markup a served module may hold: the element's shell,
// which says Loading until React mounts.
const SHELL = '`<style>${styles}</style><div class="wrap"><p class="m-loading" role="status">Loading Maison…</p></div>`';

test('the literal reader finds strings and template parts, and never comments or regular expressions', () => {
  const source = [
    '// <div> in a comment', '/* <section> too */', 'const a = \'<span class="x">\', b = "plain", c = `<b>${a ? `<i>` : \'<u>\'}</b>`;',
    'const r = /[&<>"]<div>/g, d = 4 / 2 / 1, e = x.replace(/<p>/, \'\');', 'if (a < b && c > d) f(`${ {k: 1}.k }<em>`);',
  ].join('\n');
  assert.deepEqual(literals(source), ['<span class="x">', 'plain', '<b>', '<i>', '<u>', '</b>', '', '', '<em>']);
  assert.deepEqual(literals(source).filter(s => TAG.test(s)), ['<span class="x">', '<b>', '<i>', '<u>', '</b>', '<em>']);
  assert.ok(!TAG.test('a < b, 2<3, <= 0, Search by name…'), 'comparisons and words are not tags');
});

// Acceptance of #27: no module in config/www/maison produces HTML markup.
test('no served module holds an HTML tag, apart from the element’s loading shell', () => {
  const files = readdirSync(SERVED).filter(name => name.endsWith('.js') && name !== 'icons.js');
  assert.ok(files.includes('screen.js') && files.includes('maison-dashboard.js') && !files.some(name => name.includes('/')), 'the served modules, vendor/ left out');
  for (const name of files) {
    let text = read(new URL(name, SERVED));
    if (name === 'maison-dashboard.js') {
      assert.equal(text.split(SHELL).length, 2, 'the element keeps exactly one loading shell');
      text = text.replace(SHELL, '``');
    }
    const tags = literals(text).filter(s => TAG.test(s)).map(s => s.match(TAG)[0]);
    assert.deepEqual([...new Set(tags)], [], `${name} holds markup`);
  }
});

test('the HTML builders are gone', () => {
  for (const path of ['frontend/maison/src/markup.jsx', 'frontend/maison/src/history-chart-model.js', 'config/www/maison/widgets.js', 'config/www/maison/experience.js'])
    assert.ok(!existsSync(new URL(path, ROOT)), `${path} still exists`);
  for (const file of [...sources(SOURCE), ...sources(SERVED).filter(url => !url.pathname.includes('/vendor/'))])
    assert.doesNotMatch(read(file), /\bpatchContent\b|\bescapeHTML\b|\bMarkup\b/, relative(fileURLToPath(ROOT), fileURLToPath(file)));
});

// Acceptance of #27: both bundles import no rule module, so a wording change
// in a served module leaves them byte-identical.
test('nothing under frontend/maison/src imports a served module but the icons', () => {
  const files = sources(SOURCE);
  assert.ok(files.length > 10, 'the parser reads the React sources');
  const all = files.flatMap(file => specifiers(read(file)).map(spec => ({file, spec, path: served(spec, file)})));
  assert.ok(all.some(i => i.path === 'icons.js'), 'the parser finds a served import');
  assert.ok(all.some(i => i.spec === 'react'), 'and a package import');
  const rules = all.filter(i => i.path !== null && i.path !== 'icons.js')
    .map(i => `${relative(fileURLToPath(SOURCE), fileURLToPath(i.file))} imports ${i.path}`);
  assert.deepEqual(rules, []);
});

// What config/www/maison/vendor serves, exactly: the two bundles and their
// licences. A deploy never deletes a file, so a bundle or licence brought
// back by a merge (HeroUI's sheet, Recharts' notices) would ship unnoticed;
// npm run check compares only the files it builds.
test('vendor/ holds exactly the two bundles and their licences', () => {
  assert.deepEqual(readdirSync(new URL('vendor/', SERVED)).sort(), [
    'LICENSE.Gravity-Icons.txt', 'LICENSE.Lucide-Icons.txt', 'LICENSE.Phosphor-Icons.txt', 'LICENSE.React-Aria.txt', 'LICENSE.React.txt',
    'LICENSE.clsx.txt',
    'maison-gallery.js', 'maison-react.js',
  ]);
});

// The gallery bundle takes its fixtures from frontend/maison/fixtures, so they
// hold the same line: model.js's entity ids and each other, never a rule module.
test('the fixtures import only model.js and each other', () => {
  const FIXTURES = new URL('frontend/maison/fixtures/', ROOT), MODEL = new URL('model.js', SERVED).href;
  const files = sources(FIXTURES);
  assert.ok(files.length >= 5, 'the parser reads the fixtures');
  const all = files.flatMap(file => specifiers(read(file)).map(spec => ({file, spec, url: new URL(spec.split('?')[0], file).href})));
  assert.ok(all.some(i => i.url === MODEL), 'the parser finds model.js');
  const outside = all.filter(i => !i.spec.startsWith('.') || (i.url !== MODEL && !i.url.startsWith(FIXTURES.href)))
    .map(i => `${relative(fileURLToPath(ROOT), fileURLToPath(i.file))} imports ${i.spec}`);
  assert.deepEqual(outside, []);
});
