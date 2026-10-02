// Maison's design (#29): its tokens, its layouts, and the rules every
// Maison stylesheet keeps (contract section 1, rules 4 and 5). The tokens
// are the only place a colour or a type size is written; every selector is
// scoped to Maison's host; text is set only through the type tokens, but in
// Maison's base, one layer of resets and the host's text (v36); nothing is
// loaded from outside Maison; and nothing above the phone tab bar creates a
// containing block, which would unpin the fixed bar. Node has no JSX, so
// this imports the plain modules (tokens, breakpoints, the *.css.js strings)
// and reads the components' source as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';

const SOURCE = new URL('../frontend/maison/src/', import.meta.url);
const UI = new URL('ui/', SOURCE);
const read = url => readFileSync(url, 'utf8');
const name = url => relative(fileURLToPath(SOURCE), fileURLToPath(url)).split('\\').join('/');
// Every file under a folder whose name passes `keep`, as URLs.
const files = (folder, keep, deep = true) => readdirSync(folder, {withFileTypes: true}).flatMap(entry =>
  entry.isDirectory() ? (deep ? files(new URL(`${entry.name}/`, folder), keep) : []) : keep(entry.name) ? [new URL(entry.name, folder)] : []);

const {THEMED, SHARED, LIGHT, DARK, TEMP_SCALE, SKY, tokenStyles} = await import(new URL('tokens.js', UI));
const {layoutFor} = await import(new URL('breakpoints.js', UI));

// ---- A small CSS reader -------------------------------------------------
// Not a CSS parser: a scanner that is enough for Maison's stylesheets.
// tokens() hands out each comment, quoted string and
// escape whole, so a brace, quote, comma or semicolon inside one is never read
// as syntax, and counts the () and [] around each token. readCss() splits on
// '{', '}' and ';' outside those, so a statement at-rule (`@layer x;`,
// `@import …;`) ends at its ';' instead of swallowing the next rule.
function* tokens(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    let token = text[i];
    if (token === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      assert.ok(end >= 0, 'every comment is closed');
      token = text.slice(i, end + 2);
    } else if (token === '\\') token = text.slice(i, i + 2);
    else if (token === '"' || token === "'") {
      let end = i + 1;
      while (end < text.length && text[end] !== token) end += text[end] === '\\' ? 2 : 1;
      assert.ok(end < text.length, 'every string is closed');
      token = text.slice(i, end + 1);
    } else if (token === ')' || token === ']') {
      depth -= 1;
      assert.ok(depth >= 0, 'every bracket is opened');
    }
    i += token.length - 1;
    yield {token, depth};
    if (token === '(' || token === '[') depth += 1;
  }
  assert.equal(depth, 0, 'every bracket is closed');
}

// A sheet as {rules, atRules}:
// - each style rule as {selector, declarations, context}, `context` being the
//   at-rule preludes around it ('@media …', '@keyframes …') joined by a space,
//   or '' at the top level;
// - each at-rule as {prelude, declarations, context}: a statement has no
//   declarations, @font-face has its descriptors.
// Native nesting (a block inside a style rule) throws. The reader doesn't
// resolve `&`, and no stylesheet nests, so a nested rule is refused rather
// than read as a top-level one that every check would misjudge.
function readCss(css) {
  const rules = [], atRules = [], open = [];
  let text = '';
  const context = () => open.map(block => block.prelude).join(' ');
  // A statement ends: an at-rule, or a declaration of the block it is in.
  const end = () => {
    const part = text.trim();
    text = '';
    if (part.startsWith('@')) atRules.push({prelude: part, declarations: [], context: context()});
    else if (part) {
      assert.ok(open.length, `a declaration outside any rule: ${part}`);
      open.at(-1).declarations.push(declaration(part));
    }
  };
  for (const {token, depth} of tokens(css)) {
    if (token.startsWith('/*')) text += ' ';
    else if (depth || !'{;}'.includes(token)) text += token;
    else if (token === ';') end();
    else if (token === '{') {
      const parent = open.at(-1), prelude = text.trim();
      text = '';
      assert.ok(!parent || parent.prelude.startsWith('@'), `${parent?.prelude} { ${prelude} {…} } nests a rule, which the reader doesn't resolve: write it flat`);
      open.push({prelude, declarations: [], context: context()});
    } else {
      end();
      const block = open.pop();
      assert.ok(block, 'every closing brace is opened');
      if (block.prelude.startsWith('@')) atRules.push(block);
      else rules.push({selector: block.prelude, declarations: block.declarations, context: block.context});
    }
  }
  end();
  assert.equal(open.length, 0, 'every brace is closed');
  return {rules, atRules};
}
const styleRules = css => readCss(css).rules;
// A declaration as [property, value], split on its first ':'.
function declaration(part) {
  const colon = part.indexOf(':');
  assert.ok(colon > 0, `a declaration names its property: ${part}`);
  return [part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim()];
}
// Text split at each top-level token `separator` matches (outside strings, ()
// and []), so `:is(.a,.b)`, `[title="a b"]` and `:has(> .x)` stay whole.
function topLevel(text, separator) {
  const parts = [''];
  for (const {token, depth} of tokens(text)) {
    if (!depth && separator.test(token)) parts.push('');
    else parts[parts.length - 1] += token;
  }
  return parts.map(part => part.trim());
}
const selectorList = selector => topLevel(selector, /^,$/);
// The element a selector styles: its last compound, after the last combinator.
const subject = selector => topLevel(selector, /^[\s>+~]$/).filter(Boolean).at(-1) ?? '';
// A compound's simple selectors: 'div', '.m-app', '[data-layout=phone]',
// ':is(.a,.b)', '::before'.
function simples(compound) {
  const parts = [''];
  for (const {token, depth} of tokens(compound)) {
    const last = parts.at(-1);
    if (!depth && /^[.#[:]$/.test(token) && last && last !== ':') parts.push(token);
    else parts[parts.length - 1] = last + token;
  }
  return parts.filter(Boolean);
}

test('the CSS reader finds rules, their declarations and the at-rules around them', () => {
  const {rules, atRules} = readCss('/* a { */ .m-a,.m-b:is(.x,.y){color:red;font:var(--m-type-body)} @media (min-width:700px){:host .wrap{padding:0}} @keyframes m-in{from{opacity:0}to{opacity:1}}');
  assert.deepEqual(rules.map(rule => [rule.selector, rule.context]), [['.m-a,.m-b:is(.x,.y)', ''], [':host .wrap', '@media (min-width:700px)'], ['from', '@keyframes m-in'], ['to', '@keyframes m-in']]);
  assert.deepEqual(rules[0].declarations, [['color', 'red'], ['font', 'var(--m-type-body)']]);
  assert.deepEqual(atRules.map(at => at.prelude), ['@media (min-width:700px)', '@keyframes m-in']);
  assert.deepEqual(selectorList(rules[0].selector), ['.m-a', '.m-b:is(.x,.y)']);
  assert.equal(subject(':host .wrap'), '.wrap');
  assert.equal(subject('.m-app[data-layout=phone]>.m-tabbar'), '.m-tabbar');
  assert.deepEqual(simples(':host([dark])[x].m-a::before'), [':host([dark])', '[x]', '.m-a', '::before']);
});

// The review's samples (integration cec8c7f), each of which the brace counter
// before this reader misread.
test('the CSS reader ends statements at their semicolon, skips strings and escapes, and refuses nesting', () => {
  // `@layer base;` swallowed the rule after it.
  const layered = readCss('@layer base;:host{transform:scale(1)}');
  assert.deepEqual(layered.rules, [{selector: ':host', declarations: [['transform', 'scale(1)']], context: ''}]);
  assert.deepEqual(layered.atRules, [{prelude: '@layer base', declarations: [], context: ''}]);
  assert.deepEqual(readCss('@charset "utf-8";@import url(x.css) screen;.m-a{color:red}').atRules.map(at => at.prelude), ['@charset "utf-8"', '@import url(x.css) screen']);
  // A '}' in a string crashed it; a ';' in a string or url() split a declaration.
  assert.deepEqual(styleRules('.m-a{content:"}"}.wrap{transform:none}').map(rule => [rule.selector, rule.declarations]),
    [['.m-a', [['content', '"}"']]], ['.wrap', [['transform', 'none']]]]);
  assert.deepEqual(styleRules('.m-a{content:\';{\';background:url(data:image/svg+xml;utf8,x)}')[0].declarations,
    [['content', '\';{\''], ['background', 'url(data:image/svg+xml;utf8,x)']]);
  assert.deepEqual(styleRules('.a\\{b,.c\\:d{top:0}').map(rule => selectorList(rule.selector)), [['.a\\{b', '.c\\:d']]);
  // Nesting hid `color:#fff` from the colour check; now it is refused.
  assert.throws(() => readCss('.m-app{color:#fff;&:hover{opacity:1}}'), /nests a rule/);
  assert.throws(() => readCss('.m-app{.m-tab{transform:none}}'), /nests a rule/);
  assert.throws(() => readCss('.m-app{@media (min-width:700px){transform:none}}'), /nests a rule/);
  assert.doesNotThrow(() => readCss('@media (min-width:700px){@supports (display:grid){.m-a{top:0}}}'));
  assert.throws(() => readCss('.m-a{top:0'), /every brace is closed/);
  assert.throws(() => readCss('.m-a{content:"x}'), /every string is closed/);
  // subject() split the selector lists and combinators inside :has(), :is(), :not() and [].
  assert.equal(subject(':host .wrap:has(> .m-x .y)'), '.wrap:has(> .m-x .y)');
  assert.equal(subject('.m-app:not(.m-x > .y)'), '.m-app:not(.m-x > .y)');
  assert.equal(subject('.m-x [title="a b"]'), '[title="a b"]');
  assert.deepEqual(selectorList(':where(.a,.b) .c,[title="x,y"],:not(.d,.e)'), [':where(.a,.b) .c', '[title="x,y"]', ':not(.d,.e)']);
});

// ---- Tokens -------------------------------------------------------------

test('light and dark name the same tokens, and shared tokens are neither', () => {
  assert.equal(typeof THEMED, 'boolean');
  assert.deepEqual(Object.keys(DARK), Object.keys(LIGHT), 'the same keys in the same order');
  for (const key of [...Object.keys(LIGHT), ...Object.keys(SHARED)]) assert.match(key, /^m-[a-z0-9-]+$/, key);
  assert.deepEqual(Object.keys(SHARED).filter(key => key in LIGHT || key in DARK), []);
});

// Numbers alone may be set larger: the figures are the only type styles
// outside the six text sizes.
const FIGURE = /^m-type-(?:figure|display)\b/;
test('text has exactly six sizes, the figures are exactly three, and every type style names the font', () => {
  const types = Object.entries(SHARED).filter(([key]) => key.startsWith('m-type-'));
  const size = value => Number(value.match(/(\d+)px\//)?.[1]);
  const text = types.filter(([key]) => !FIGURE.test(key)), figures = types.filter(([key]) => FIGURE.test(key));
  assert.equal(text.length, 9);
  assert.deepEqual([...new Set(text.map(([, value]) => size(value)))].sort((a, b) => b - a), [34, 22, 17, 15, 13, 11]);
  assert.deepEqual(Object.fromEntries(figures.map(([key, value]) => [key, size(value)])), {'m-type-figure': 22, 'm-type-figure-large': 44, 'm-type-display': 96});
  for (const [key, value] of types) assert.match(value, /var\(--m-font(?:-rounded)?\)/, key);
});

test('the widget grid has 168px rows and 16px gaps, and a glyph on a bright tone is black', () => {
  assert.deepEqual([SHARED['m-widget-row'], SHARED['m-widget-gap'], SHARED['m-on-bright']], ['168px', '16px', '#000000']);
});

test('the temperature scale and the sky are colours to compute with: the scale is m-temp-1…6, each sky keyframe four hex stops', () => {
  assert.deepEqual(TEMP_SCALE.map(([, colour]) => colour), [1, 2, 3, 4, 5, 6].map(i => SHARED[`m-temp-${i}`]));
  assert.ok(TEMP_SCALE.every(([t], i) => i === 0 || t > TEMP_SCALE[i - 1][0]), 'cold to hot');
  for (const key of ['night', 'twilight', 'day', 'overcast', 'unknown']) {
    assert.equal(SKY[key]?.length, 4, key);
    for (const stop of SKY[key]) assert.match(stop, /^#[0-9a-f]{6}$/i, `${key} ${stop}`);
  }
});

test('the hero draws on the dark tokens in both schemes, with the sky’s secondary text and focus ring, and its sky fades into the page’s own background', () => {
  const hero = styleRules(tokenStyles).filter(rule => rule.selector === ':host .m-hero');
  assert.equal(hero.length, 1, 'one .m-hero block');
  const declared = hero[0].declarations;
  assert.deepEqual(Object.fromEntries(declared.filter(([property]) => property.startsWith('--')).map(([property, value]) => [property.slice(2), value])), {...DARK, 'm-label-2': 'var(--m-sky-label-2)', 'm-focus-ring': 'var(--m-sky-focus-ring)'});
  assert.ok(declared.some(([property, value]) => property === 'color-scheme' && value === 'dark'), 'color-scheme:dark');
  assert.equal(SHARED['m-page-bg'], 'var(--m-bg)', 'read on the host, before the hero redeclares --m-bg');
});

test('the tokens are declared on Maison’s host', () => {
  assert.match(tokenStyles, /:host\{--m-temp-1:/);
  if (THEMED) assert.match(tokenStyles, /:host\(\[dark\]\)\{--m-label:#FFFFFF;.*color-scheme:dark\}/);
  assert.match(tokenStyles, /@media \(prefers-reduced-motion:reduce\)\{:host\{--m-dur-press:0ms;--m-dur-control:0ms;--m-dur-sheet:0ms\}\}/);
  assert.match(tokenStyles, /\.m-num\{font-family:var\(--m-font-rounded\);font-variant-numeric:tabular-nums\}/);
});

test('Maison’s width picks the layout: phone below 700, wide to 1099, desktop from 1100', () => {
  assert.deepEqual([0, 699, 700, 1099, 1100, 1600].map(layoutFor), ['phone', 'phone', 'wide', 'wide', 'desktop', 'desktop']);
  assert.match(read(new URL('layout.js', UI)), /export \{[^}]*\blayoutFor\b[^}]*\} from '\.\/breakpoints\.js'/, 'layout.js re-exports it');
});

// ---- Maison's stylesheets -----------------------------------------------

// Every *.css.js under src/, each read once, and each string it exports,
// plus tokenStyles; tokens.js is where colours are written, so it is left
// out of the colour check only. app.css.js only joins the others, so it is
// left out.
const CSS_FILES = files(SOURCE, n => n.endsWith('.css.js') && n !== 'app.css.js');
const SHEETS = [
  ...await Promise.all(CSS_FILES.map(async url => ({file: name(url), css: Object.values(await import(url)).filter(value => typeof value === 'string').join('\n')}))),
  {file: 'ui/tokens.js', css: tokenStyles},
];

// Maison's base (v36): the resets and the host's text that Tailwind's
// preflight (in HeroUI's sheet) and styles.js gave the shadow root until
// then, in one layer, so that every rule outside it wins whatever its
// weight. It is the only @layer, the only place text is set without a type
// token, and it holds exactly these rules: a change to it is deliberate.
const BASE = {file: 'frame.css.js', layer: '@layer m-base'};
const inBase = (file, rule) => file === BASE.file && rule.context === BASE.layer;
const HOST = ':host';
const SYSTEM_FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"';
const BASE_RULES = [
  [`${HOST} *,${HOST} ::before,${HOST} ::after`, 'box-sizing:border-box;border:0 solid;margin:0;padding:0'],
  [HOST, `font-family:${SYSTEM_FONT};font-size:14px;line-height:1.5;-webkit-text-size-adjust:100%;text-size-adjust:100%;tab-size:4;-webkit-tap-highlight-color:transparent`],
  [`${HOST} :is(button,input,select)`, 'font:inherit;color:inherit;background-color:transparent'],
  [`${HOST} :is(ol,ul)`, 'list-style:none'],
  [`${HOST} ::-webkit-datetime-edit`, 'padding-block:0'],
  [`${HOST} ::-webkit-datetime-edit-fields-wrapper`, 'padding:0'],
  ...['year', 'month', 'day', 'hour', 'minute', 'meridiem'].map(field => [`${HOST} ::-webkit-datetime-edit-${field}-field`, 'padding-block:0']),
  [`${HOST} b`, 'font-variant-numeric:tabular-nums'],
];

// Colour literals: hex, colour functions and every CSS named colour, in a
// value with its custom property names (--m-blue…) taken out first.
const COLOUR_FUNCTION = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const NAMED = new RegExp(`\\b(?:${`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood
  cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey
  darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey
  darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon
  lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue
  lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
  mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
  navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff
  peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver
  skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen`.trim().split(/\s+/).join('|')})\\b`, 'i');
const colourIn = value => {
  const bare = value.replace(/--[\w-]+/g, '');
  return bare.match(COLOUR_FUNCTION)?.[0] ?? bare.match(NAMED)?.[0] ?? null;
};
// Anything that makes an element the containing block of a fixed descendant
// (translate, rotate and scale are transforms too; content-visibility
// contains paint; preserve-3d and an offset-path contain as well).
const CONTAINING = /^(?:-webkit-)?(?:transform|translate|rotate|scale|transform-style|offset|offset-path|filter|backdrop-filter|contain|content-visibility|container|container-type|will-change|perspective)$/;
const ANIMATION = /^(?:-webkit-)?animation(?:-name)?$/, KEYFRAMES = /@(?:-webkit-)?keyframes\s+([^\s{]+)/;
// Whether a compound selector can match an element above the phone tab bar:
// the host, div.wrap, div.m-app or div.m-content. Every simple selector in it
// must be able to: a class only if it is one of theirs, an element only if it
// is div or *, :is() and :where() only if one of their selectors can, and
// never an id or a pseudo-element (a box of its own). Attributes and other
// pseudo-classes may match any element, so `[data-layout=phone]` and
// `:host([dark])[x]` are above the bar; `.m-tab` is not.
function aboveTabbar(compound) {
  return simples(compound).every(simple => {
    if (simple.startsWith('.')) return /^\.(?:wrap|m-app|m-content)$/.test(simple);
    if (simple.startsWith('#') || simple.startsWith('::') || /^:(?:before|after|first-line|first-letter)$/i.test(simple)) return false;
    const inner = simple.match(/^:(?:is|where)\((.*)\)$/is)?.[1];
    if (inner !== undefined) return selectorList(inner).some(selector => aboveTabbar(subject(selector)));
    return simple.startsWith('[') || simple.startsWith(':') || /^(?:\*|div)$/i.test(simple);
  });
}
// Each declaration in `sheets` that makes an element above the phone tab bar
// a containing block, as 'file: [context] selector { property }': one of
// CONTAINING, or an animation whose keyframes (in any of the sheets) set one,
// for as long as it runs.
function containingBlocks(sheets) {
  const parsed = sheets.map(sheet => ({...sheet, rules: styleRules(sheet.css)}));
  const moving = new Set(parsed.flatMap(({rules}) => rules.filter(rule => rule.declarations.some(([property]) => CONTAINING.test(property)))
    .map(rule => rule.context.match(KEYFRAMES)?.[1]).filter(Boolean)));
  const creates = ([property, value]) => CONTAINING.test(property) || (ANIMATION.test(property) && value.split(/[\s,]+/).some(word => moving.has(word)));
  return parsed.flatMap(({file, rules}) => rules.filter(rule => !KEYFRAMES.test(rule.context)).flatMap(rule => selectorList(rule.selector)
    .filter(selector => aboveTabbar(subject(selector)))
    .flatMap(selector => rule.declarations.filter(creates).map(([property]) => `${file}: ${[rule.context, selector].filter(Boolean).join(' ')} { ${property} }`))));
}

// Rule 4's at-rules are the only ones a Maison sheet writes (so no
// @import, @font-face or @layer, but Maison's base layer), and no value
// loads anything from outside Maison: a url() or string that is protocol-relative (//), or starts with
// http:, https:, ftp: or any other scheme followed by //. data: is inline.
const AT_RULES = /^@(?:media|supports|keyframes)\b/;
const REMOTE = /(?:\burl\(\s*['"]?|['"])\s*(?:\/\/|(?:https?|ftp):|[a-z][\w+.-]*:\/\/)/i;
function outside(css) {
  const {rules, atRules} = readCss(css);
  return [
    ...atRules.filter(at => !AT_RULES.test(at.prelude)).map(at => at.prelude),
    ...[...rules, ...atRules].flatMap(block => block.declarations.filter(([, value]) => REMOTE.test(value))
      .map(([property, value]) => `${block.selector ?? block.prelude} { ${property}: ${value} }`)),
  ];
}

test('the reader finds every Maison stylesheet', () => {
  const found = SHEETS.map(sheet => sheet.file);
  for (const file of ['ui/base.css.js', 'ui/button.css.js', 'ui/switch.css.js', 'ui/segmented.css.js', 'ui/stepper.css.js', 'ui/list.css.js',
    'ui/card.css.js', 'ui/sheet.css.js', 'ui/widget.css.js', 'ui/ring.css.js', 'ui/segment-bar.css.js', 'ui/figure.css.js', 'ui/glance.css.js',
    'ui/quiet.css.js', 'ui/target-bar.css.js', 'ui/disclosure.css.js', 'ui/date-field.css.js', 'ui/feedback.css.js', 'ui/day-bar.css.js',
    'ui/chip.css.js', 'frame.css.js', 'sky.css.js', 'hero.css.js', 'charts/weather.css.js',
    'charts/car.css.js', 'charts/zones.css.js', 'charts/flows.css.js', 'charts/history.css.js', 'charts/day.css.js', 'pages/today.css.js',
    'pages/climate.css.js', 'drawers/climate.css.js', 'pages/energy.css.js', 'drawers/energy.css.js', 'pages/car.css.js',
    'drawers/car.css.js', 'pages/system.css.js', 'dialogs.css.js', 'ui/tokens.js'])
    assert.ok(found.includes(file), file);
  assert.equal(new Set(found).size, found.length, 'each once');
  assert.ok(styleRules(SHEETS.find(sheet => sheet.file === 'ui/button.css.js').css).length > 10, 'and reads its rules');
});

test('every Maison selector starts with .m- or :host', () => {
  const stray = SHEETS.flatMap(({file, css}) => styleRules(css).filter(rule => !rule.context.includes('@keyframes'))
    .flatMap(rule => selectorList(rule.selector).filter(s => !s.startsWith('.m-') && !/^:host\b/.test(s)).map(s => `${file}: ${s}`)));
  assert.deepEqual(stray, []);
});

test('no Maison stylesheet writes a colour; only tokens.js does', () => {
  const colours = SHEETS.filter(sheet => sheet.file !== 'ui/tokens.js').flatMap(({file, css}) => styleRules(css)
    .flatMap(rule => rule.declarations.map(([property, value]) => [property, colourIn(value)]).filter(([, colour]) => colour)
      .map(([property, colour]) => `${file}: ${rule.selector} { ${property}: …${colour}… }`)));
  assert.deepEqual(colours, []);
  assert.equal(colourIn('var(--m-blue) linear-gradient(180deg,var(--m-glass-top),transparent) currentColor inherit'), null);
  assert.equal(colourIn('0 1px 0 rgba(0,0,0,.2)'), 'rgba(');
  assert.equal(colourIn('1px solid White'), 'White');
});

test('text is set only with font: var(--m-type-…), but in Maison’s base, captions only by the frame and the charts, and the display figure only by the weather', () => {
  const sizes = SHEETS.flatMap(({file, css}) => styleRules(css).filter(rule => !inBase(file, rule)).flatMap(rule => rule.declarations
    .filter(([property, value]) => property === 'font-size' || (property === 'font' && !/^var\(--m-type-[a-z-]+\)$/.test(value)))
    .map(([property, value]) => `${file}: ${rule.selector} { ${property}: ${value} }`)));
  assert.deepEqual(sizes, []);
  const using = (token, allowed) => SHEETS.filter(sheet => sheet.file !== 'ui/tokens.js' && !allowed(sheet.file) && sheet.css.includes(token)).map(sheet => sheet.file);
  assert.deepEqual(using('--m-type-caption', file => file === 'frame.css.js' || /^charts\/[\w-]+\.css\.js$/.test(file)), []);
  assert.deepEqual(using('--m-type-display', file => file === 'charts/weather.css.js'), []);
});

test('Maison’s base is the one layer, in the frame’s sheet, and holds exactly its resets and the host’s text', () => {
  const layers = SHEETS.flatMap(({file, css}) => readCss(css).atRules.filter(at => /^@layer\b/i.test(at.prelude)).map(at => `${file}: ${at.prelude}`));
  assert.deepEqual(layers, [`${BASE.file}: ${BASE.layer}`], 'one block, no statement');
  const layered = SHEETS.flatMap(({file, css}) => styleRules(css).filter(rule => /@layer\b/i.test(rule.context)).map(rule => ({file, ...rule})));
  assert.ok(layered.every(rule => inBase(rule.file, rule)), 'nothing else is layered, and nothing is nested in it');
  assert.deepEqual(layered.map(rule => [rule.selector, rule.declarations.map(pair => pair.join(':')).join(';')]), BASE_RULES);
  // The host's text is the only text set outside a type token: the system
  // stack at 14px/1.5, which a button, an input or a select inherits.
  const text = layered.flatMap(rule => rule.declarations.filter(([property]) => /^(?:font|font-family|font-size|font-weight|line-height)$/.test(property))
    .map(([property, value]) => `${rule.selector} { ${property}: ${value} }`));
  assert.deepEqual(text, [`${HOST} { font-family: ${SYSTEM_FONT} }`, `${HOST} { font-size: 14px }`, `${HOST} { line-height: 1.5 }`, `${HOST} :is(button,input,select) { font: inherit }`]);
  // No token: no custom property is declared in it.
  assert.deepEqual(layered.flatMap(rule => rule.declarations.filter(([property]) => property.startsWith('--'))), []);
});

// Maison's components, its own controls and parts among them,
// compute colours from tokens.js's objects (TEMP_SCALE, SKY) or name a token;
// none writes one. Comments are left out, and an SVG reference such as
// url(#id) is not a colour.
const COLOUR_LITERAL = /(?<![&\w(])#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/i;
const uncommented = text => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
test('no Maison component writes a colour literal', () => {
  const sources = files(SOURCE, n => n.endsWith('.jsx'));
  assert.ok(sources.some(url => name(url) === 'charts/weather.jsx') && sources.some(url => name(url) === 'gallery/heroes.jsx'), 'the reader finds the charts and the gallery');
  assert.ok(sources.some(url => name(url) === 'ui/glance.jsx') && sources.some(url => name(url) === 'pages/today.jsx'), 'and the parts and the pages');
  assert.ok(sources.some(url => name(url) === 'ui/target-bar.jsx') && sources.some(url => name(url) === 'drawers/climate.jsx'), 'and the sheet parts and the sheets');
  const found = sources.flatMap(url => uncommented(read(url)).split('\n').filter(line => COLOUR_LITERAL.test(line))
    .map(line => `${name(url)}: …${line.match(COLOUR_LITERAL)[0]}…`));
  assert.deepEqual(found, []);
  assert.deepEqual(["fill: '#FFD60A'", 'stroke="#fff"', 'rgba(0,0,0,.2)', 'hsl(0 0% 0%)', 'oklch(70% .1 200)', 'fill="url(#m-sky)"', '&#160;', '(#29)', 'a // #fff']
    .map(sample => COLOUR_LITERAL.test(uncommented(sample))), [true, true, true, true, true, false, false, false, false]);
});

test('Maison’s stylesheets write only @media, @supports and @keyframes, and its base layer, and load nothing from outside Maison', () => {
  assert.deepEqual(SHEETS.flatMap(({file, css}) => outside(css).filter(found => !(file === BASE.file && found === BASE.layer)).map(found => `${file}: ${found}`)), []);
  // The review's samples: neither @import nor a remote @font-face was inspected.
  assert.deepEqual(outside('@import url(https://cdn.example/x.css);.m-a{color:red}'), ['@import url(https://cdn.example/x.css)']);
  assert.deepEqual(outside('@font-face{font-family:x;src:url(https://cdn.example/x.woff2)}'), ['@font-face', '@font-face { src: url(https://cdn.example/x.woff2) }']);
  assert.deepEqual(outside('@layer base;@media (min-width:700px){.m-a{mask:url( "//cdn.example/x.svg" )}.m-b{background:image-set(\'HTTP://cdn.example/y.png\' 1x)}}'),
    ['@layer base', '.m-a { mask: url( "//cdn.example/x.svg" ) }', '.m-b { background: image-set(\'HTTP://cdn.example/y.png\' 1x) }']);
  assert.deepEqual(outside('@supports (mask:none){.m-a{mask:url(data:image/svg+xml;utf8,x),url(glyph.svg);content:"Note: 1"}}@keyframes m-in{to{top:0}}'), []);
});

test('nothing above the phone tab bar creates a containing block', () => {
  assert.ok(SHEETS.some(({css}) => styleRules(css).some(rule => selectorList(rule.selector).includes(':host'))), 'the reader reads the host’s rules');
  assert.deepEqual(containingBlocks(SHEETS), []);
});

test('the containing-block check reads the subject compound and animations', () => {
  const above = selector => aboveTabbar(subject(selector));
  // Above the bar, whatever the order of the compound, and through :is(), :has() and [].
  assert.deepEqual([':host', ':host .wrap', '.m-app[data-layout=phone]', '.m-content', ':host([dark])[x]',
    ':host [data-layout=phone]', '[data-layout=phone].m-app', ':host :is(.wrap,.m-sheet)', '.m-x :where(.a .m-app)',
    ':host .wrap:has(> .m-x .y)', '.m-app:not(.m-x > .y)', '.m-x [title="a b"]', ':host *', '.m-x>div:first-child'].map(above),
  Array(14).fill(true));
  // Below it, beside it or a box of its own.
  assert.deepEqual(['.m-app .m-tabbar', '.m-app>.m-tab:hover', '.m-app__x', '.m-sheet', '.wrapper', '.wrap::before', ':host :is(.m-sheet)',
    '.m-app svg', '.m-app nav', '#m-x', '.m-app.m-x'].map(above), Array(11).fill(false));
  assert.deepEqual(['transform', '-webkit-backdrop-filter', 'container-type', 'will-change', 'content-visibility', 'transform-style', 'opacity', 'outline-offset']
    .map(p => CONTAINING.test(p)), [true, true, true, true, true, true, false, false]);
  const check = css => containingBlocks([{file: 'x', css}]);
  // The review's samples: a statement ate the rule; a '}' in a string crashed the reader.
  assert.deepEqual(check('@layer base;:host{transform:scale(1)}'), ['x: :host { transform }']);
  assert.deepEqual(check('.m-a{content:"}"}.wrap{transform:none}'), ['x: .wrap { transform }']);
  assert.deepEqual(check(':host .m-x,:host [data-layout=phone]{will-change:transform;opacity:1}'),
    ['x: :host [data-layout=phone] { will-change }']);
  assert.deepEqual(check('@media (min-width:700px){.m-app .m-tab{transform:none}.m-content{contain:paint}}'), ['x: @media (min-width:700px) .m-content { contain }']);
  // An animation counts when its keyframes move a containing property.
  assert.deepEqual(check('@keyframes m-up{to{translate:0 -1px}}@keyframes m-fade{to{opacity:0}}.m-app{animation:m-fade 1s,m-up 1s}.m-content{animation-name:m-fade}'),
    ['x: .m-app { animation }']);
  assert.deepEqual(check(':host{contain:paint}@media print{.wrap>.x{filter:none}.wrap{filter:none}}[data-slot=arrow]{rotate:90deg}'),
    ['x: :host { contain }', 'x: @media print .wrap { filter }', 'x: [data-slot=arrow] { rotate }']);
});

// ---- Imports ------------------------------------------------------------

// Every module a file imports or re-exports (as tests/maison-bundles.test.mjs reads them).
const specifiers = text => [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
const UI_IMPORTS = [/^react(?:-dom)?$/, /^react-aria-components\/[\w-]+$/, /^react-aria\/[\w/-]+$/, /^\.\.\/contexts\.js$/,
  /^\.\.\/\.\.\/\.\.\/\.\.\/config\/www\/maison\/icons\.js$/, /^\.\/[\w.-]+$/];

test('Maison’s own controls import only React, React Aria, the contexts, the icons and each other', () => {
  const sources = files(UI, n => /\.jsx?$/.test(n));
  assert.ok(sources.length >= 20, 'the reader finds the controls');
  const all = sources.flatMap(url => specifiers(read(url)).map(spec => ({file: name(url), spec})));
  assert.ok(all.some(i => i.spec.startsWith('react-aria-components/')), 'and their React Aria imports');
  assert.ok(all.some(i => i.file === 'ui/widget.jsx' && i.spec === './grid.js'), 'and the widgets’ placer, a sibling like the rest');
  assert.ok(all.some(i => i.file === 'ui/temp-scale.js' && i.spec === './tokens.js') && all.some(i => i.file === 'ui/target-bar.jsx' && i.spec === './temp-scale.js'),
    'and the room scale, which reads the tokens and colours the target bar');
  assert.deepEqual(all.filter(i => !UI_IMPORTS.some(allowed => allowed.test(i.spec))).map(i => `${i.file} imports ${i.spec}`), []);
  assert.deepEqual(all.filter(i => /@heroui|parts\.jsx|components\.jsx/.test(i.spec)).map(i => `${i.file} imports ${i.spec}`), []);
});

// ---- Composition --------------------------------------------------------

// Each bundle draws only Maison's design (v36): the dashboard mounts App
// and the gallery's entry is mountGallery, and neither reads a `design`.
// Each loads the shadow-DOM adapter first.
test('both bundles load the shadow-DOM adapter first and draw only Maison’s design, reading no design', () => {
  const app = read(new URL('app.jsx', SOURCE)), gallery = read(new URL('gallery.jsx', SOURCE));
  assert.match(app, /^(?:\/\/[^\n]*\n)*import '\.\/shadow-dom\.js';\n/, 'app.jsx');
  assert.match(gallery, /^(?:\/\/[^\n]*\n)*import '\.\/shadow-dom\.js';\n/, 'gallery.jsx');
  assert.match(app, /export function mountDashboard\(host, \{shadowRoot, command, attachNative\}\)/);
  assert.match(app, /root\.render\(<App screen=\{screen\} command=\{command\} attachNative=\{attachNative\} portal=\{portal\} queue=\{queue\}\/>\)/);
  assert.match(gallery, /export function mountGallery\(target, \{theme = 'light', screen, view = null\} = \{\}\)/);
  for (const [file, source] of [['app.jsx', app], ['gallery.jsx', gallery]])
    assert.doesNotMatch(uncommented(source), /\bdesign\s*(?:===|!==)|\bdesign\s*=\s*null|[{,]\s*design\b/, `${file} neither reads nor branches on a design`);
});

// The widgets and the parts come after every control (#29 step 4), then
// the sheet parts (v32), then the chip (v33), then Home status's search
// field and picker (v35), and Maison draws its own pages: Today, Climate
// (v32), Energy (v33), the Car (v34) and Home status (v35), whose styles App
// adds; the gallery's frames draw the same.
// App's styles (app.css.js) are Maison's controls and the frame, then the
// hero's, then the pages': Today's, Climate's page, its sheets and the
// 24-hour chart, then Energy's page and sheets (v33), then the Car's (v34),
// then Home status's and the dialogs' (v35).
test('uiStyles ends with the widgets, the parts and the sheet parts, and App and the frames draw PAGES', () => {
  assert.match(read(new URL('index.js', UI)), /uiStyles = tokenStyles \+ baseStyles \+ buttonStyles \+ switchStyles \+ segmentedStyles \+ stepperStyles \+ listStyles \+ cardStyles \+ sheetStyles\s*\+ widgetStyles \+ ringStyles \+ segmentBarStyles \+ figureStyles \+ glanceStyles \+ quietStyles\s*\+ targetBarStyles \+ disclosureStyles \+ dateFieldStyles \+ feedbackStyles \+ dayBarStyles\s*\+ chipStyles \+ searchFieldStyles \+ pickerStyles \+ toastStyles;/);
  assert.match(read(new URL('pages.jsx', SOURCE)), /export const PAGES = \{today: TodayPage, climate: ClimatePage, energy: EnergyPage, car: CarPage, system: SystemPage\};/);
  for (const file of ['app.jsx', 'gallery/frames.jsx']) assert.match(read(new URL(file, SOURCE)), /\bPAGES\[page\.id\]/, file);
  assert.match(read(new URL('app.css.js', SOURCE)), /appStyles = uiStyles \+ frameStyles\s*\+ skyStyles \+ heroStyles \+ weatherChartStyles \+ carChartStyles \+ zonesChartStyles \+ flowsChartStyles \+ todayPageStyles\s*\+ climatePageStyles \+ climateDrawerStyles \+ historyChartStyles \+ dayChartStyles \+ energyPageStyles \+ energyDrawerStyles \+ carPageStyles \+ carDrawerStyles\s*\+ systemPageStyles \+ dialogStyles;/);
  assert.match(read(new URL('frame.jsx', SOURCE)), /<LayoutContext\.Provider value=\{layout\}>\{children\}<\/LayoutContext\.Provider>/, 'the frame hands its layout to the page');
});

// The widgets come after the frames (#29 step 4) and the sheet parts and
// charts after them (v32), so the earlier sections' baselines never move.
test('the gallery draws its twelve sections in order', () => {
  const order = ['tokens', 'buttons', 'switches', 'segmented', 'steppers', 'lists', 'sheets', 'sky', 'heroes', 'frames', 'widgets', 'details'];
  const components = [...read(new URL('gallery.jsx', SOURCE)).matchAll(/<(\w+)Section\/>/g)].map(m => m[1].toLowerCase());
  assert.deepEqual(components, order);
  for (const section of order) assert.match(read(new URL(`gallery/${section}.jsx`, SOURCE)), new RegExp(`name="${section}"`), section);
});
