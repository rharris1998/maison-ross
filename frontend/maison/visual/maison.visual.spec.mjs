import {expect, test} from '@playwright/test';

// Maison's visual regression (#29): its gallery, its sky strips and
// heroes, its open sheets, the desktop gallery window and the dashboard drawn
// in it, and the gallery's pages view (Today, Climate, Energy, the Car and
// Home status in every frame size, Climate, Energy and the Car each followed
// by their sheets drawn in place, Home status by the dialogs), in light and
// dark, on the config's two widths.
// Beside the images it checks what an image can't show: every control has a
// name; nothing scrolls the page sideways, nor spills out of a window or a
// hero's specimen, whose clips would hide it; nothing above a tab bar gives
// it a containing block, and the hero sits beside the bar, never above it;
// every header chart can be read by a screen reader; nothing in a hero or a
// sky moves while motion is reduced; in every Today, Climate, Energy and Car
// the widgets fill their rows, each row 168px (a Car's large widget two rows
// and the gap), and no body holds more than it shows, and in every Today
// and Climate every image and SVG in a widget is named; and in every sheet
// drawn in place, a bottom sheet in a phone's window and a 640px form
// sheet, the body holds all it has and nothing leaves it, nothing scrolls
// sideways, and in Climate's every image and SVG is named. In every Home
// status (v35), a list page with no widget grid, nothing leaves the page's
// box, nothing scrolls sideways, and its sections stand in one column on a
// phone (Needs attention, Key devices, Vacuum maintenance, All sensors, Home
// Assistant) and from 700px in two equal ones, the checks on the left and
// All sensors on the right; each dialog drawn in place (v35) is checked as
// the sheets are. Energy (v33), the Car (v34), Home status and the dialogs
// (v35) have no accessibility-only checks of their own: they are checked
// for their layout alone, and the whole-root scans above read them as they
// read the rest. The screenshots are soft, so a
// missing or changed image never hides a failing check after it, and so is
// the stillness check, so a sky that moves never hides the checks and images
// after it. Date is frozen before each test; the config reduces motion and
// disables animations, so a sheet is captured at rest.

const GALLERY = '#maison-gallery > section';
const DASHBOARD = 'maison-dashboard';
const SECTIONS = ['tokens', 'buttons', 'switches', 'segmented', 'steppers', 'lists', 'sheets', 'sky', 'heroes', 'frames', 'widgets', 'details'];
// The gallery's frames, in order: six phone windows, then the large ones
// (shown from a 1,240px gallery, so only on the wide project).
const FRAMES = ['phone-today', 'phone-climate', 'phone-car', 'phone-energy', 'phone-system', 'phone-offline', 'wide-climate', 'desktop-today', 'desktop-energy'];
const PHONE_FRAMES = FRAMES.filter(frame => frame.startsWith('phone-'));
// The pages view's windows, by size and TODAY_PAGES id, in order, then
// (v32) Climate's by size and CLIMATE_PAGES id, then (v33) Energy's by size
// and ENERGY_PAGES id, then (v34) the Car's by size and CAR_PAGES id, after
// Energy's sheets, then (v35) Home status's by size and SYSTEM_PAGES id
// after the Car's sheets (`{size}-system-{id}`), whose first word is still
// the size; wide ones show from a 760px viewport and desktop ones from
// 1,180px, so only on the wide project.
const PAGE_WINDOWS = ['phone-quiet', 'phone-busy', 'phone-paused', 'phone-unavailable', 'phone-night', 'wide-busy', 'wide-quiet',
  'desktop-busy', 'desktop-quiet', 'desktop-night', 'desktop-unavailable',
  'phone-climate-running', 'phone-climate-off', 'phone-climate-away', 'phone-climate-unavailable', 'wide-climate-running', 'wide-climate-off',
  'desktop-climate-running', 'desktop-climate-off', 'desktop-climate-override', 'desktop-climate-unavailable',
  'phone-energy-covered', 'phone-energy-billing', 'phone-energy-night', 'phone-energy-missing', 'wide-energy-covered', 'wide-energy-billing',
  'desktop-energy-covered', 'desktop-energy-billing', 'desktop-energy-night', 'desktop-energy-missing',
  'phone-car-solar', 'phone-car-charge_now', 'phone-car-not_verified', 'phone-car-unplugged', 'phone-car-never_confirmed',
  'wide-car-solar', 'wide-car-not_verified', 'wide-car-unplugged',
  'desktop-car-solar', 'desktop-car-not_verified', 'desktop-car-unplugged', 'desktop-car-dropout', 'desktop-car-override_asleep',
  'phone-system-full', 'phone-system-quiet', 'phone-system-missing', 'wide-system-full', 'desktop-system-full', 'desktop-system-missing'];
const PAGE_SIZES = ['phone', 'wide', 'desktop'];
// Whether a pages view window draws Home status (v35), which has no widget
// grid, rather than a page whose widgets fill their rows.
const isSystem = name => /^[a-z]+-system-/.test(name);
// The gallery's frames that draw Today, Climate (the offline one is
// Climate), Energy (v33) or the Car (v34), whose widgets are checked as the
// pages view's are.
const FRAME_PAGES = '[data-gallery-frame$="-today"], [data-gallery-frame$="-climate"], [data-gallery-frame="phone-offline"], [data-gallery-frame$="-energy"], [data-gallery-frame$="-car"]';
// Climate's sheets drawn in place in the pages view, by placement and
// CLIMATE_SHEETS id: bottom sheets in a 375px window (narrower on a phone),
// then form sheets 640px wide, which show from a 760px viewport, so only on
// the wide project. Then (v33) Energy's, likewise by ENERGY_SHEETS id, and
// (v34) the Car's by CAR_SHEETS id, each in a section of their own; then
// (v35) the dialogs by DIALOG_SNAPSHOTS id, each window
// `{placement}-dialog-{id}`. Each section holds its own.
const SHEET_IDS = ['sheet-house', 'sheet-house-off', 'sheet-attic', 'sheet-noah', 'sheet-rails'];
const SHEET_WINDOWS = ['bottom', 'form'].flatMap(placement => SHEET_IDS.map(id => `${placement}-${id}`));
const ENERGY_SHEET_IDS = ['energy-price', 'energy-billing-year', 'energy-billing-year-quiet', 'energy-bill', 'energy-bill-covered', 'energy-bill-missing', 'energy-today'];
const ENERGY_SHEET_WINDOWS = ['bottom', 'form'].flatMap(placement => ENERGY_SHEET_IDS.map(id => `${placement}-${id}`));
const CAR_SHEET_IDS = ['car-battery', 'car-battery-asleep', 'car-battery-missing', 'car-charging-energy', 'car-charging-energy-missing'];
const CAR_SHEET_WINDOWS = ['bottom', 'form'].flatMap(placement => CAR_SHEET_IDS.map(id => `${placement}-${id}`));
const DIALOG_IDS = ['alerts', 'alerts-empty', 'event', 'calendar'];
const DIALOG_WINDOWS = ['bottom', 'form'].flatMap(placement => DIALOG_IDS.map(id => `${placement}-dialog-${id}`));
const SHEET_SECTIONS = {climate: 'section[data-gallery-sheets]', energy: 'section[data-gallery-energy-sheets]', car: 'section[data-gallery-car-sheets]',
  dialogs: 'section[data-gallery-dialogs]'};
// The form sheet's width (ui/sheet.css.js), and a bottom sheet's inset in
// its window, 8px each side.
const FORM_SHEET = 640, BOTTOM_INSET = 16;
// A widget grid's columns by layout (ui/grid.js's COLUMNS; a phone stacks
// them in one), and its row track at default fonts (--m-widget-row).
const COLUMNS = {phone: 1, wide: 2, desktop: 4};
const WIDGET_ROW = 168;
// Home status's sections by id (v35), in the order a phone stacks them, and
// the checks' column's from 700px, All sensors beside it.
const SYSTEM_PHONE = ['needs', 'devices', 'vacuum', 'sensors', 'home-assistant'];
const SYSTEM_CHECKS = ['needs', 'devices', 'vacuum', 'home-assistant'];
// The four real sheets, by opener and dialog name (the dialog's title in
// its value); two are screenshotted. The card is the full calendar (v35).
const SHEETS = [
  {opener: 'Open zone sheet', name: 'Attic', shot: 'sheet'},
  {opener: 'Open alerts sheet', name: 'Home alerts', shot: 'dialog'},
  {opener: 'Open event sheet', name: 'School fair'},
  {opener: 'Open card sheet', name: 'Full calendar'},
];
const SLOTTED = ['maison-preview-shell', 'maison-preview-panel'];
// What tools/maison-preview.mjs serves without --snapshot, pinned so a reused
// preview holding a private snapshot can neither change the dashboard's
// images nor put its states in one.
const NO_SNAPSHOT = {states: {source: 'No snapshot · unavailable-state preview', states: {}}, registry: {areas: [], devices: [], entities: []}};
// A snowy morning with nothing else in Home Assistant: every page's sky has
// clouds that drift and snow that falls, wherever motion is allowed.
const SNOWY = {source: 'Snowy sky · reduced-motion check', states: Object.fromEntries([
  ['sun.sun', 'above_horizon', {elevation: 10, azimuth: 120, rising: true, friendly_name: 'Sun'}],
  ['weather.forecast_home', 'snowy', {temperature: 0, cloud_coverage: 100}],
].map(([entity_id, state, attributes]) => [entity_id, {entity_id, state, attributes, last_changed: '2026-09-16T09:40:00Z', last_updated: '2026-09-16T09:59:00Z'}]))};
// Every page by its hash, with its title (Today's greets) and how many header
// charts it draws under SNOWY: Today's days need a forecast, and Home status
// has the sky and the header alone.
const PAGES = [['today', /^Good /, 0], ['climate', 'Climate', 1], ['car', 'Car', 1], ['energy', 'Energy', 1], ['system', 'Home status', 0]];

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    const fixed = new Date('2026-09-16T12:00:00+02:00').valueOf();
    const NativeDate = Date;
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
  });
});

// In the page: each button, switch, radio and link in `selector`'s shadow
// root (sheets are portalled into it) that assistive technology can reach,
// named as a browser names it: aria-labelledby, aria-label, its <label>, its
// text (a part's aria-label or alt counts, aria-hidden and undisplayed parts
// don't), then title. Returns the ones left without a name.
function unnamedControls(selector) {
  const up = el => el.assignedSlot ?? el.parentElement ?? el.parentNode?.host ?? null;
  const exposed = el => { for (let node = el; node; node = up(node)) if (node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return false; return true; };
  const text = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.data;
    if (node.nodeType !== Node.ELEMENT_NODE || node.hidden || node.getAttribute('aria-hidden') === 'true' || getComputedStyle(node).display === 'none') return '';
    const label = node.getAttribute('aria-label')?.trim();
    if (label) return ` ${label} `;
    if (node.localName === 'img') return node.getAttribute('alt') ?? '';
    const children = node.localName === 'slot' ? node.assignedNodes({flatten: true}) : (node.shadowRoot ?? node).childNodes;
    return [...children].map(text).join(' ');
  };
  const labelledBy = el => (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean).map(id => el.getRootNode().getElementById?.(id)?.textContent ?? '').join(' ');
  const nameOf = el => [labelledBy(el), el.getAttribute('aria-label') ?? '', ...[...(el.labels ?? [])].map(text), el.localName === 'input' ? '' : text(el), el.getAttribute('title') ?? '']
    .map(part => part.replace(/\s+/g, ' ').trim()).find(Boolean) ?? '';
  const controls = [];
  const collect = root => { for (const el of root.querySelectorAll('*')) {
    if (el.matches('button, [role=switch], [role=radio], input[role=switch], a')) controls.push(el);
    if (el.shadowRoot) collect(el.shadowRoot);
  } };
  collect(document.querySelector(selector).shadowRoot);
  return controls.filter(el => exposed(el) && !nameOf(el)).map(el => el.outerHTML.slice(0, 200));
}

// In the page: for each tab bar in `selector`'s shadow root, its flat-tree
// ancestors that would give a fixed bar a containing block other than the
// viewport, or that are a hero or a sky, and whether the hero follows it as
// its sibling. The walk stops at a gallery window (a frame's .m-gallery-frame
// or a pages view's [data-gallery-page]), which contains its bar on purpose;
// the dashboard's walks to the document.
function containingBlocks(selector) {
  const up = el => el.assignedSlot ?? el.parentElement ?? el.parentNode?.host ?? null;
  const initial = {transform: 'none', translate: 'none', rotate: 'none', scale: 'none', perspective: 'none', filter: 'none', backdropFilter: 'none',
    webkitBackdropFilter: 'none', contain: 'none', containerType: 'normal', contentVisibility: 'visible', willChange: 'auto'};
  const describe = el => `${el.localName}${[...el.classList].map(name => `.${name}`).join('')}`;
  return [...document.querySelector(selector).shadowRoot.querySelectorAll('.m-tabbar')].map(bar => {
    const window = bar.closest('.m-gallery-frame, [data-gallery-page]'), found = [];
    for (let el = up(bar); el && el !== window; el = up(el)) {
      const style = getComputedStyle(el);
      for (const [property, value] of Object.entries(initial)) if (style[property] !== undefined && style[property] !== value) found.push(`${describe(el)} ${property}: ${style[property]}`);
      if (el.matches('.m-hero, .m-sky')) found.push(`${describe(el)} holds the bar`);
    }
    return {frame: window?.dataset.galleryFrame ?? window?.dataset.galleryPage ?? 'dashboard', found, beside: bar.nextElementSibling?.matches('.m-hero') ?? false};
  });
}

// In the page: how many header charts `selector`'s shadow root holds, and
// the ones a screen reader can't read, as their markup's start. A chart that
// is an SVG is an image named by its aria-label; the weather's days are a
// list whose every item is named, by aria-label or by text a screen reader
// reads. An empty chart slot holds none.
function unreadCharts(selector) {
  const named = el => Boolean(el.getAttribute('aria-label')?.trim());
  // An item's own text that assistive technology reads: what isn't aria-hidden
  // (a visually hidden sentence counts), or its aria-label.
  const text = node => node.nodeType === Node.TEXT_NODE ? node.data
    : node.nodeType === Node.ELEMENT_NODE && node.getAttribute('aria-hidden') !== 'true' ? [...node.childNodes].map(text).join('') : '';
  const spoken = item => named(item) || Boolean(text(item).trim());
  const readable = el => el.localName === 'svg' ? el.getAttribute('role') === 'img' && named(el)
    : el.localName === 'ul' && [null, 'list'].includes(el.getAttribute('role')) && el.children.length > 0 && [...el.children].every(item => item.localName === 'li' && spoken(item));
  const charts = [...document.querySelector(selector).shadowRoot.querySelectorAll('.m-hero__chart > *')];
  return {charts: charts.length, unread: charts.filter(el => !readable(el)).map(el => el.outerHTML.slice(0, 200))};
}

// In the page: what still moves in a hero or a sky in `selector`'s shadow
// root (the gallery's sky strips have no hero), as each animation's element
// and name. Once a transition has ended, reduced motion leaves none.
function moving(selector) {
  const describe = el => `${el.localName}${[...el.classList].map(name => `.${name}`).join('')}`;
  return document.querySelector(selector).shadowRoot.getAnimations()
    .filter(animation => animation.playState !== 'finished' && animation.effect?.target?.closest('.m-hero, .m-sky'))
    .map(animation => `${describe(animation.effect.target)} ${animation.animationName ?? animation.transitionProperty}`);
}

// Nothing in a hero or a sky moves under the config's reduced motion: a
// transition ends within a frame or two there, an animation never. Soft, so
// a sky that moves never hides the checks and images after it.
const expectStill = (page, selector) => expect.configure({soft: true}).poll(() => page.evaluate(moving, selector), {timeout: 2_000}).toEqual([]);

// In the page: the parts of each shown hero specimen that leave its box (the
// hero, its reading and its chart), which the box's clip would hide from an
// image; and each shown desktop specimen's box, its width and whether it
// reaches out of the gallery's column on each side and stays in the viewport.
function heroSpecimens(selector) {
  const root = document.querySelector(selector).shadowRoot, main = root.querySelector('.m-gallery'), style = getComputedStyle(main), column = main.getBoundingClientRect();
  const [left, right] = [column.left + parseFloat(style.paddingLeft), column.right - parseFloat(style.paddingRight)];
  const describe = el => `${el.localName}${[...el.classList].map(name => `.${name}`).join('')}`;
  const spills = [], desktop = [];
  for (const box of [...root.querySelectorAll('[data-gallery-state="heroes"] .m-gallery-hero__box')].filter(el => el.getClientRects().length)) {
    const outer = box.getBoundingClientRect(), caption = box.nextElementSibling?.textContent ?? '';
    for (const el of box.querySelectorAll('.m-hero, .m-hero__reading > *, .m-hero__chart > *')) {
      const inner = el.getBoundingClientRect();
      if (inner.left < outer.left - .5 || inner.right > outer.right + .5 || inner.top < outer.top - .5 || inner.bottom > outer.bottom + .5)
        spills.push(`${caption}: ${describe(el)} [${[inner.left, inner.right, inner.top, inner.bottom].map(Math.round)}] out of [${[outer.left, outer.right, outer.top, outer.bottom].map(Math.round)}]`);
    }
    if (box.querySelector('.m-app').dataset.layout === 'desktop') desktop.push({caption, width: Math.round(outer.width),
      reaches: outer.left < left && outer.right > right, inside: outer.left >= 0 && outer.right <= document.documentElement.clientWidth});
  }
  return {spills, desktop};
}

// In the page: each shown gallery window whose page is wider than the
// window, which the window's clip would hide from an image.
function wideWindows(selector) {
  return [...document.querySelector(selector).shadowRoot.querySelectorAll('[data-gallery-frame]')].filter(el => el.getClientRects().length).map(el => {
    const scroller = el.querySelector('.m-gallery-frame__scroll');
    return scroller.scrollWidth > scroller.clientWidth ? `${el.dataset.galleryFrame}: ${scroller.scrollWidth} > ${scroller.clientWidth}` : null;
  }).filter(Boolean);
}

// In the page: each shown Today, Climate, Energy or Car in `selector`'s
// shadow root, in the windows `windows` selects (a gallery window, or the
// dashboard's .m-app), which page it is (by its root's class: the Car's is
// .m-car-page, as .m-car is its hero chart's), and what an image of it
// can't show. Its widget grid (the page root's own child) has tracks from
// the computed style (a phone's stack is a one-column grid of rows as tall
// as its widgets), and each widget's box is mapped onto them, so the cells
// no widget covers are holes, those two cover overlap, and a box off the
// track lines is misplaced; each widget's size (its class) and height are
// kept too, and the grid's row gap. A body that clips (from 700px) holds no more than it shows; one
// that doesn't (a phone's) holds nothing that reaches out of it, which an
// element inside a clip can't. In a Today or a Climate, every image in a
// widget is named, and so is every SVG there a screen reader meets (one
// that isn't aria-hidden, itself or by an ancestor); Energy's and the Car's
// images aren't read (null). Neither the window nor a gallery frame's
// scroller inside it scrolls sideways. A window with none of the four has
// no grid.
function pageWindows([selector, windows]) {
  const root = document.querySelector(selector).shadowRoot;
  const describe = el => `${el.localName}${[...el.classList].map(name => `.${name}`).join('')}`;
  const edges = el => { const box = el.getBoundingClientRect(); return [box.left, box.right, box.top, box.bottom].map(Math.round); };
  const sizes = value => value === 'none' ? [] : value.split(/\s+/).map(parseFloat);
  const tracks = (start, list, gap) => list.map((size, i) => { const from = start + list.slice(0, i).reduce((sum, each) => sum + each, 0) + i * gap; return [from, from + size]; });
  const near = (a, b) => Math.abs(a - b) <= 1;
  const clips = el => { const style = getComputedStyle(el); return style.overflowX !== 'visible' || style.overflowY !== 'visible'; };
  const sideways = el => { const before = el.scrollLeft; el.scrollLeft = 10_000; const moved = el.scrollLeft; el.scrollLeft = before;
    return el.scrollWidth > el.clientWidth || moved !== 0 ? `${describe(el)} ${el.scrollWidth} > ${el.clientWidth}, scrolled ${moved}` : null; };
  const hidden = (el, top) => { for (let node = el; node && node !== top; node = node.parentElement) if (node.getAttribute('aria-hidden') === 'true') return true; return false; };
  const named = el => Boolean(el.getAttribute('aria-label')?.trim() || (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).some(id => id && el.getRootNode().getElementById(id)?.textContent.trim())
    || (el.localName === 'svg' && el.querySelector(':scope > title')?.textContent.trim()));
  return [...root.querySelectorAll(windows)].filter(el => el.getClientRects().length).map(window => {
    const name = window.dataset.galleryPage ?? window.dataset.galleryFrame ?? 'dashboard';
    const roots = {today: 'm-today', climate: 'm-climate', energy: 'm-energy', car: 'm-car-page'};
    const grid = window.querySelector(`:is(${Object.values(roots).map(root => `.${root}`).join(', ')}) > .m-widgets`);
    if (!grid) return {window: name, page: null};
    const page = Object.keys(roots).find(each => grid.parentElement.classList.contains(roots[each])), style = getComputedStyle(grid), box = grid.getBoundingClientRect();
    const columnSizes = sizes(style.gridTemplateColumns), rowSizes = sizes(style.gridTemplateRows);
    const columns = tracks(box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft), columnSizes, parseFloat(style.columnGap) || 0);
    const rows = tracks(box.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop), rowSizes, parseFloat(style.rowGap) || 0);
    const cells = rows.map(() => columns.map(() => [])), misplaced = [], holes = [], overlaps = [];
    // Energy's phone stack holds its money list as a widget, with no Widget
    // round it, and the Car's its Automatic charging list.
    const widgets = [...grid.children].filter(el => el.matches('[data-widget]') || ['energy', 'car'].includes(page));
    for (const widget of widgets) {
      const {left, right, top, bottom} = widget.getBoundingClientRect(), id = widget.dataset.widget ?? describe(widget);
      const [c0, c1] = [columns.findIndex(([from]) => near(from, left)), columns.findIndex(([, to]) => near(to, right))];
      const [r0, r1] = [rows.findIndex(([from]) => near(from, top)), rows.findIndex(([, to]) => near(to, bottom))];
      if ([c0, c1, r0, r1].includes(-1) || c1 < c0 || r1 < r0) { misplaced.push(`${id} [${edges(widget)}]`); continue; }
      for (let row = r0; row <= r1; row++) for (let column = c0; column <= c1; column++) cells[row][column].push(id);
    }
    cells.forEach((line, row) => line.forEach((ids, column) => {
      if (!ids.length) holes.push(`row ${row + 1}, column ${column + 1}`);
      if (ids.length > 1) overlaps.push(`row ${row + 1}, column ${column + 1}: ${ids.join(', ')}`);
    }));
    const overflows = [];
    for (const body of window.querySelectorAll('[data-widget] .m-widget__body')) {
      const id = body.closest('[data-widget]').dataset.widget;
      if (clips(body)) {
        if (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1) overflows.push(`${id}: ${body.scrollWidth}×${body.scrollHeight} in ${body.clientWidth}×${body.clientHeight}`);
        continue;
      }
      const [left, right, top, bottom] = edges(body);
      for (const el of body.querySelectorAll('*')) {
        let clipped = false;
        for (let up = el.parentElement; up && up !== body && !clipped; up = up.parentElement) clipped = clips(up);
        const [l, r, t, b] = edges(el);
        if (!clipped && el.getClientRects().length && (l < left - 1 || r > right + 1 || t < top - 1 || b > bottom + 1)) overflows.push(`${id}: ${describe(el)} [${[l, r, t, b]}] out of [${[left, right, top, bottom]}]`);
      }
    }
    const images = ['energy', 'car'].includes(page) ? null : [...window.querySelectorAll('[data-widget] [role=img], [data-widget] svg')].filter(el => el.getAttribute('role') === 'img' || !hidden(el, window));
    const sized = widgets.map(el => ({id: el.dataset.widget ?? describe(el), size: [...el.classList].find(name => name.startsWith('m-widget--'))?.slice('m-widget--'.length) ?? null,
      height: Math.round(el.getBoundingClientRect().height)}));
    return {window: name, page, layout: (window.closest('.m-app') ?? window.querySelector('.m-app')).dataset.layout,
      grid: grid.classList.contains('m-widgets--grid') ? 'grid' : grid.classList.contains('m-widgets--stack') ? 'stack' : grid.className,
      columns: columnSizes.length, dataColumns: grid.dataset.columns ?? null, rows: rowSizes, gap: parseFloat(style.rowGap) || 0, widgets: widgets.length, sized, misplaced, holes, overlaps, overflows,
      images: images?.length ?? null, unnamed: images?.filter(el => !named(el)).map(el => el.outerHTML.slice(0, 200)) ?? null,
      sideways: [window, ...window.querySelectorAll('.m-gallery-frame__scroll')].map(sideways).filter(Boolean)};
  });
}

// Each page `pageWindows` found, `names` in order, drawing `page` (by
// default Energy where its name says energy, the Car where a word of it is
// car, Climate where it says climate, as the offline frame's Climate does,
// else Today) laid out as `layout` (by default its window's size, its
// name's first word): a stack of one column on a phone, else a grid of
// COLUMNS[layout] columns whose every row track is WIDGET_ROW high, and in
// a Car each medium widget one row high and the large one two rows and the
// grid's gap between them (352px once the page has settled; its first
// frames can still hold another gap); its widgets fill every row, none
// misplaced, none overlapping; no body overflows; in a Today or a Climate
// every image and SVG in a widget is named (Energy's and the Car's aren't
// read); nothing scrolls sideways.
const pageOf = name => /energy/.test(name) ? 'energy' : /(^|-)car(-|$)/.test(name) ? 'car' : /climate|offline/.test(name) ? 'climate' : 'today';
function expectPageWindows(found, names, {layout = name => name.split('-')[0], page = pageOf} = {}) {
  expect(found.map(({window}) => window)).toEqual(names);
  for (const shown of found) {
    const size = layout(shown.window), drawn = page(shown.window);
    expect(shown, shown.window).toMatchObject({page: drawn, layout: size, grid: size === 'phone' ? 'stack' : 'grid', columns: COLUMNS[size],
      dataColumns: size === 'phone' ? null : String(COLUMNS[size]), misplaced: [], holes: [], overlaps: [], overflows: [], sideways: [], ...!['energy', 'car'].includes(drawn) && {unnamed: []}});
    expect(shown.widgets, shown.window).toBeGreaterThan(0);
    if (size !== 'phone') expect(shown.rows.filter(height => height !== WIDGET_ROW), `${shown.window} row tracks`).toEqual([]);
    if (drawn === 'car' && size !== 'phone') expect(shown.sized.filter(({size, height}) => height !== (size === 'large' ? 2 * WIDGET_ROW + shown.gap : WIDGET_ROW)),
      `${shown.window} widget heights`).toEqual([]);
  }
}

// In the page: each shown Home status (v35) in `selector`'s shadow root, in
// the windows `windows` selects (a gallery window, or the dashboard's
// .m-app), and what an image of it can't show, as a list page has no widget
// grid: the frame's layout and the page's own (its class); its sections by
// id, in the column each starts at (0 at the page's left edge, else 1), in
// reading order (by column, then from the top); how many columns they make
// (their distinct left edges); from 700px, the two columns' boxes' widths
// (the checks' and All sensors'), and their grid's tracks; what reaches out
// of the page's box (each element that no clip inside it holds, on any
// side), and whether the page sits inside its window, whose clip would cut
// it; and whether the window, a gallery frame's scroller inside it or the
// page scrolls sideways. A window with no Home status has none (page null).
function systemWindows([selector, windows]) {
  const root = document.querySelector(selector).shadowRoot;
  const describe = el => `${el.localName}${[...el.classList].map(name => `.${name}`).join('')}`;
  const edges = el => { const box = el.getBoundingClientRect(); return [box.left, box.right, box.top, box.bottom].map(Math.round); };
  const clips = el => { const style = getComputedStyle(el); return style.overflowX !== 'visible' || style.overflowY !== 'visible'; };
  const sideways = el => { const before = el.scrollLeft; el.scrollLeft = 10_000; const moved = el.scrollLeft; el.scrollLeft = before;
    return el.scrollWidth > el.clientWidth || moved !== 0 ? `${describe(el)} ${el.scrollWidth} > ${el.clientWidth}, scrolled ${moved}` : null; };
  const near = (a, b) => Math.abs(a - b) <= 1;
  return [...root.querySelectorAll(windows)].filter(el => el.getClientRects().length).map(window => {
    const name = window.dataset.galleryPage ?? window.dataset.galleryFrame ?? 'dashboard', page = window.querySelector('.m-system-page');
    if (!page) return {window: name, page: null};
    const box = page.getBoundingClientRect(), style = getComputedStyle(page), prefix = 'm-system-page__section--';
    const sections = [...page.querySelectorAll('.m-system-page__section')].map(el => {
      const {left, top} = el.getBoundingClientRect();
      return {id: [...el.classList].find(name => name.startsWith(prefix))?.slice(prefix.length) ?? describe(el), column: near(left, box.left) ? 0 : 1, left: Math.round(left), top};
    }).sort((a, b) => a.column - b.column || a.top - b.top);
    const [checks, sensors] = ['.m-system-page__checks', '.m-system-page__sensors'].map(part => page.querySelector(`:scope > ${part}`));
    const [left, right, top, bottom] = edges(page), overflows = [];
    for (const el of page.querySelectorAll('*')) {
      let clipped = false;
      for (let up = el.parentElement; up && up !== page && !clipped; up = up.parentElement) clipped = clips(up);
      const [l, r, t, b] = edges(el);
      if (!clipped && el.getClientRects().length && (l < left - 1 || r > right + 1 || t < top - 1 || b > bottom + 1)) overflows.push(`${describe(el)} [${[l, r, t, b]}] out of [${[left, right, top, bottom]}]`);
    }
    const [wl, wr, wt, wb] = edges(window);
    return {window: name, page: 'system', layout: (window.closest('.m-app') ?? window.querySelector('.m-app')).dataset.layout,
      own: [...page.classList].find(name => /^m-system-page--/.test(name))?.slice('m-system-page--'.length) ?? null,
      sections: sections.map(({id, column}) => ({id, column})), columns: new Set(sections.map(({left}) => left)).size,
      tracks: style.display === 'grid' ? style.gridTemplateColumns.split(/\s+/).map(parseFloat).map(Math.round) : null,
      widths: style.display === 'grid' ? [checks, sensors].map(el => Math.round(el.getBoundingClientRect().width)) : null,
      overflows, inside: left >= wl - 1 && right <= wr + 1 && top >= wt - 1 && bottom <= wb + 1,
      sideways: [window, ...window.querySelectorAll('.m-gallery-frame__scroll'), page].map(sideways).filter(Boolean)};
  });
}

// Each Home status `systemWindows` found, `names` in order, laid out as
// `layout` (by default its window's size, its name's first word): on a phone
// one column, Needs attention, Key devices, Vacuum maintenance, All sensors
// and Home Assistant in that order; from 700px two equal columns (equal
// tracks, and the two boxes as wide as each other), the checks on the left
// in their order and All sensors on the right. Nothing leaves the page or
// its window (unless `inside` is false: a gallery frame crops its page on
// purpose, and its scroller holds the rest), and nothing scrolls sideways.
function expectSystemWindows(found, names, {layout = name => name.split('-')[0], inside = true} = {}) {
  expect(found.map(({window}) => window)).toEqual(names);
  for (const shown of found) {
    const size = layout(shown.window), phone = size === 'phone';
    expect(shown, shown.window).toMatchObject({page: 'system', layout: size, own: size, columns: phone ? 1 : 2, overflows: [], sideways: [], ...inside && {inside: true},
      sections: phone ? SYSTEM_PHONE.map(id => ({id, column: 0})) : [...SYSTEM_CHECKS.map(id => ({id, column: 0})), {id: 'sensors', column: 1}]});
    if (phone) continue;
    expect(shown.tracks, `${shown.window} tracks`).toHaveLength(2);
    expect(Math.abs(shown.tracks[0] - shown.tracks[1]), `${shown.window} tracks ${shown.tracks}`).toBeLessThanOrEqual(1);
    expect(Math.abs(shown.widths[0] - shown.widths[1]), `${shown.window} columns ${shown.widths}`).toBeLessThanOrEqual(1);
  }
}

// In the page: each shown sheet drawn in place in `selector`'s shadow root
// (a pages view's [data-gallery-sheet] window) within `section` (Climate's
// sheets, Energy's, the Car's or the dialogs, SHEET_SECTIONS), and what an image of it
// can't show: its placement, its window's width and its sheet's; whether
// the window, whose clip would cut it, holds the sheet whole; what reaches
// out of the body, which isn't capped there and so shows all it holds (its
// scroll box beyond its box, and each element that no clip inside it holds,
// beyond its box on any side; a closed disclosure's panel, hidden until
// found, draws none of what it holds, so it counts as a clip); unless
// `readImages` is false (Energy's and the Car's, whose images are null),
// every image in the sheet named, and every SVG a screen reader meets
// there; and whether the window, the sheet's dialog or its body scrolls
// sideways.
function sheetWindows([selector, section, readImages = true]) {
  const root = document.querySelector(selector).shadowRoot;
  const describe = el => `${el.localName}${[...el.classList].map(name => `.${name}`).join('')}`;
  const edges = el => { const box = el.getBoundingClientRect(); return [box.left, box.right, box.top, box.bottom].map(Math.round); };
  const clips = el => { const style = getComputedStyle(el); return style.overflowX !== 'visible' || style.overflowY !== 'visible' || style.contentVisibility === 'hidden'; };
  const sideways = el => { const before = el.scrollLeft; el.scrollLeft = 10_000; const moved = el.scrollLeft; el.scrollLeft = before;
    return el.scrollWidth > el.clientWidth || moved !== 0 ? `${describe(el)} ${el.scrollWidth} > ${el.clientWidth}, scrolled ${moved}` : null; };
  const hidden = (el, top) => { for (let node = el; node && node !== top; node = node.parentElement) if (node.getAttribute('aria-hidden') === 'true') return true; return false; };
  const named = el => Boolean(el.getAttribute('aria-label')?.trim() || (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).some(id => id && el.getRootNode().getElementById(id)?.textContent.trim())
    || (el.localName === 'svg' && el.querySelector(':scope > title')?.textContent.trim()));
  return [...root.querySelectorAll(`${section} [data-gallery-sheet]`)].filter(el => el.getClientRects().length).map(window => {
    const name = window.dataset.gallerySheet, sheet = window.querySelector('.m-sheet'), body = sheet.querySelector('.m-sheet__body');
    const outer = window.getBoundingClientRect(), inner = sheet.getBoundingClientRect();
    const overflows = [];
    if (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1) overflows.push(`body ${body.scrollWidth}×${body.scrollHeight} in ${body.clientWidth}×${body.clientHeight}`);
    const [left, right, top, bottom] = edges(body);
    for (const el of body.querySelectorAll('*')) {
      let clipped = false;
      for (let up = el.parentElement; up && up !== body && !clipped; up = up.parentElement) clipped = clips(up);
      const [l, r, t, b] = edges(el);
      if (!clipped && el.getClientRects().length && (l < left - 1 || r > right + 1 || t < top - 1 || b > bottom + 1)) overflows.push(`${describe(el)} [${[l, r, t, b]}] out of [${[left, right, top, bottom]}]`);
    }
    const images = readImages ? [...sheet.querySelectorAll('[role=img], svg')].filter(el => el.getAttribute('role') === 'img' || !hidden(el, window)) : null;
    return {window: name, placement: name.split('-')[0], windowWidth: Math.round(outer.width), sheetWidth: Math.round(inner.width),
      holds: inner.left >= outer.left - .5 && inner.right <= outer.right + .5 && inner.top >= outer.top - .5 && inner.bottom <= outer.bottom + .5,
      overflows, images: images?.length ?? null, unnamed: images?.filter(el => !named(el)).map(el => el.outerHTML.slice(0, 200)) ?? null,
      sideways: [window, sheet.querySelector('.m-sheet__dialog'), body].map(sideways).filter(Boolean)};
  });
}

// A sheet `sheetWindows` found is as wide as its placement makes it: a form
// sheet FORM_SHEET, a bottom sheet its window less BOTTOM_INSET, in a 375px
// window on the wide project and one no wider on a phone.
function expectSheetWidth(sheet, wide) {
  if (sheet.placement === 'form') expect(sheet.sheetWidth, sheet.window).toBe(FORM_SHEET);
  else {
    expect(sheet.sheetWidth, sheet.window).toBe(sheet.windowWidth - BOTTOM_INSET);
    if (wide) expect(sheet.windowWidth, sheet.window).toBe(375);
    else expect(sheet.windowWidth, sheet.window).toBeLessThanOrEqual(375);
  }
}

// In the page: the images in `selector`'s shadow root that sit in a widget
// or among the gallery's widgets and parts, and those left without a name;
// Energy's widgets (v33) aren't read.
function unnamedImages(selector) {
  const images = [...document.querySelector(selector).shadowRoot.querySelectorAll('.m-widget [role=img], [data-gallery-state="widgets"] [role=img]')].filter(el => !el.closest('.m-energy'));
  const named = el => Boolean(el.getAttribute('aria-label')?.trim() || (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).some(id => id && el.getRootNode().getElementById(id)?.textContent.trim()));
  return {images: images.length, unnamed: images.filter(el => !named(el)).map(el => el.outerHTML.slice(0, 200))};
}

// The page never scrolls sideways: the document is no wider than its
// viewport, and asking it to scroll right leaves it where it was.
async function expectNoSidewaysScroll(page) {
  const {scrollWidth, clientWidth, scrolled} = await page.evaluate(() => {
    const y = scrollY;
    scrollTo(10_000, y);
    const scrolled = scrollX;
    scrollTo(0, y);
    return {scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrolled};
  });
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  expect(scrolled).toBe(0);
}

// A gallery section's rows across the whole page, for its image: the heroes'
// desktop specimens reach out of the gallery's column, where an image of the
// section's own box would cut them.
function sectionBand(page, name) {
  return page.locator(GALLERY).evaluate((host, name) => {
    const box = host.shadowRoot.querySelector(`[data-gallery-state="${name}"]`).getBoundingClientRect(), top = Math.floor(box.top + scrollY);
    return {x: 0, y: top, width: document.documentElement.clientWidth, height: Math.ceil(box.bottom + scrollY) - top};
  }, name);
}

async function openGallery(page, theme, query = '') {
  await page.goto(`/gallery?theme=${theme}${query}`);
  await expect(page.locator('[data-gallery-ready="true"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const sections = page.locator('[data-gallery-state]');
  await expect(sections).toHaveCount(SECTIONS.length);
  expect(await sections.evaluateAll(els => els.map(el => el.dataset.galleryState))).toEqual(SECTIONS);
  for (const section of await sections.all()) await expect(section).toBeVisible();
}

// Opens the gallery's pages view, whose size groups come in order and show
// by the viewport's width.
async function openPages(page, theme) {
  await page.goto(`/gallery?view=pages&theme=${theme}`);
  await expect(page.locator('main.m-gallery--pages[data-gallery-ready="true"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const sizes = page.locator('section[data-gallery-size]');
  expect(await sizes.evaluateAll(els => els.map(el => el.dataset.gallerySize))).toEqual(PAGE_SIZES);
  await expect(page.locator('[data-gallery-page]')).toHaveCount(PAGE_WINDOWS.length);
}

// Opens the dashboard at `hash`, over `states` (pinned, so
// a reused preview's snapshot never reaches it) and in `theme`.
async function openDashboard(page, theme, hash, states = NO_SNAPSHOT.states) {
  await page.route('**/states.json', route => route.fulfill({json: states}));
  await page.route('**/registry.json', route => route.fulfill({json: NO_SNAPSHOT.registry}));
  await page.goto(`/#${hash}`);
  const dashboard = page.locator(DASHBOARD);
  await expect(dashboard.locator('.m-app')).toBeVisible();
  if (theme === 'dark') await page.locator('#theme').selectOption('dark');
  if (theme === 'dark') await expect(dashboard).toHaveAttribute('dark');
  else await expect(dashboard).not.toHaveAttribute('dark');
  await page.evaluate(() => document.fonts.ready);
  return dashboard;
}

// Opens a gallery sheet and waits until it has entered: React Aria drops
// data-entering when the entry animations end, and nothing is left running.
// The pointer then moves to the scrim's corner: left where the opener was,
// it would hover whichever row the sheet brought under it.
async function openSheet(page, {opener, name}) {
  const button = page.getByRole('button', {name: opener, exact: true});
  await button.click();
  const sheet = page.getByRole('dialog', {name, exact: true});
  await expect(sheet).toBeVisible();
  await expect(page.locator('.m-sheet[data-entering], .m-sheet-overlay[data-entering]')).toHaveCount(0);
  await expect.poll(() => sheet.evaluate(el => [el.closest('.m-sheet'), el.closest('.m-sheet-overlay')].flatMap(node => node.getAnimations()).length)).toBe(0);
  await page.mouse.move(0, 0);
  await expect(sheet.locator('[data-hovered]')).toHaveCount(0);
  return {button, sheet};
}

for (const theme of ['light', 'dark']) {
  test(`Gallery · ${theme}`, async ({page}, testInfo) => {
    await openGallery(page, theme);
    expect(await page.evaluate(unnamedControls, GALLERY)).toEqual([]);
    await expectNoSidewaysScroll(page);
    // Every window's bar, with the hero beside it and nothing below its
    // window that holds it or gives it a containing block.
    const bars = await page.evaluate(containingBlocks, GALLERY);
    expect(bars.map(bar => bar.frame)).toEqual(FRAMES);
    expect(bars.filter(bar => bar.found.length || !bar.beside)).toEqual([]);
    // A shown window lays its page out for its size, holds its bar and
    // nothing wider than itself.
    const windows = await page.locator('[data-gallery-frame]').evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => {
      const box = el.getBoundingClientRect(), bar = el.querySelector('.m-tabbar').getBoundingClientRect();
      return {frame: el.dataset.galleryFrame, layout: el.querySelector('.m-app').dataset.layout,
        holdsBar: bar.left >= box.left && bar.right <= box.right && bar.top >= box.top && bar.bottom <= box.bottom};
    }));
    const wide = testInfo.project.name === 'desktop-1280';
    expect(windows).toEqual((wide ? FRAMES : PHONE_FRAMES).map(frame => ({frame, layout: frame.split('-')[0], holdsBar: true})));
    expect(await page.evaluate(wideWindows, GALLERY)).toEqual([]);
    // The windows' Todays, Climates, Energies and Car are the pages'
    // widgets, filling their rows; every image among the widgets and parts,
    // but Energy's, is named. Home status (v35) stands in one column, its
    // window cropping it on purpose.
    expectPageWindows(await page.evaluate(pageWindows, [GALLERY, FRAME_PAGES]),
      ['phone-today', 'phone-climate', 'phone-car', 'phone-energy', 'phone-offline', ...wide ? ['wide-climate', 'desktop-today', 'desktop-energy'] : []]);
    expectSystemWindows(await page.evaluate(systemWindows, [GALLERY, '[data-gallery-frame$="-system"]']), ['phone-system'], {inside: false});
    const images = await page.evaluate(unnamedImages, GALLERY);
    expect(images.images).toBeGreaterThan(0);
    expect(images.unnamed).toEqual([]);
    // The desktop windows reach out of the gallery's column on purpose, and
    // stay within the viewport.
    if (wide) {
      const {column, windows} = await page.locator(GALLERY).evaluate(host => {
        const main = host.shadowRoot.querySelector('.m-gallery'), style = getComputedStyle(main), box = main.getBoundingClientRect();
        const windows = [...host.shadowRoot.querySelectorAll('[data-gallery-frame^="desktop-"]')].map(el => el.getBoundingClientRect()).map(({left, right}) => ({left, right}));
        return {column: {left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight)}, windows};
      });
      expect(windows).toHaveLength(2);
      for (const window of windows) {
        expect(window.left).toBeLessThan(column.left);
        expect(window.right).toBeGreaterThan(column.right);
        expect(window.left).toBeGreaterThanOrEqual(0);
        expect(window.right).toBeLessThanOrEqual(page.viewportSize().width);
      }
    }
    // Every header chart, in the heroes and the windows, can be read.
    const {charts, unread} = await page.evaluate(unreadCharts, GALLERY);
    expect(charts).toBeGreaterThan(0);
    expect(unread).toEqual([]);
    // Each hero stays in its specimen's box, whose clip would hide it. A
    // desktop specimen is as wide as the desktop window, and reaches out of
    // the column as it does, within the viewport: soft, as a narrower one
    // still draws the desktop hero, and the images after it still matter.
    const specimens = await page.evaluate(heroSpecimens, GALLERY);
    expect(specimens.spills).toEqual([]);
    expect.soft(specimens.desktop.filter(box => box.width !== 1180 || !box.reaches || !box.inside)).toEqual([]);
    if (wide) expect(specimens.desktop).toHaveLength(14);
    else expect(specimens.desktop).toEqual([]);
    await expectStill(page, GALLERY);
    await expect.soft(page).toHaveScreenshot(`maison-gallery-${theme}.png`, {fullPage: true});
    await expect.soft(page.locator('[data-gallery-state="sky"]')).toHaveScreenshot(`maison-sky-${theme}.png`);
    await expect.soft(page).toHaveScreenshot(`maison-heroes-${theme}.png`, {fullPage: true, clip: await sectionBand(page, 'heroes')});
  });

  for (const spec of SHEETS) {
    test(`Sheet: ${spec.name} · ${theme}`, async ({page}) => {
      await openGallery(page, theme);
      const {button, sheet} = await openSheet(page, spec);
      // Outside the sheet is inert now, so this names the sheet's own controls.
      expect(await page.evaluate(unnamedControls, GALLERY)).toEqual([]);
      if (spec.shot) await expect.soft(page).toHaveScreenshot(`maison-${spec.shot}-${theme}.png`);
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(button).toBeFocused();
    });
  }

  // Today drawn whole in every frame size, from each TODAY_PAGES fixture,
  // then Climate from each CLIMATE_PAGES one, Energy from each ENERGY_PAGES
  // one, the Car from each CAR_PAGES one and Home status from each
  // SYSTEM_PAGES one: an image per page and size group, phone on both
  // widths, wide and desktop where they show (the wide project); beside
  // them, every check an image can't make: the widget grids of the first
  // four, and Home status's columns, a list page's. Fifteen tall section
  // images on the wide project, each a changed one retried for its 5s, so
  // the test has two minutes.
  test(`Pages view · ${theme}`, async ({page}, testInfo) => {
    test.setTimeout(120_000);
    await openPages(page, theme);
    const wide = testInfo.project.name === 'desktop-1280', shown = wide ? PAGE_WINDOWS : PAGE_WINDOWS.filter(name => name.startsWith('phone-'));
    expect(await page.evaluate(unnamedControls, GALLERY)).toEqual([]);
    await expectNoSidewaysScroll(page);
    // Every window's bar, with the hero beside it and nothing below its
    // window that holds it or gives it a containing block.
    const bars = await page.evaluate(containingBlocks, GALLERY);
    expect(bars.map(bar => bar.frame)).toEqual(PAGE_WINDOWS);
    expect(bars.filter(bar => bar.found.length || !bar.beside)).toEqual([]);
    // A shown window lays its page out for its size and holds its bar.
    const windows = await page.locator('[data-gallery-page]').evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => {
      const box = el.getBoundingClientRect(), bar = el.querySelector('.m-tabbar').getBoundingClientRect();
      return {window: el.dataset.galleryPage, layout: el.querySelector('.m-app').dataset.layout,
        holdsBar: bar.left >= box.left && bar.right <= box.right && bar.top >= box.top && bar.bottom <= box.bottom};
    }));
    expect(windows).toEqual(shown.map(window => ({window, layout: window.split('-')[0], holdsBar: true})));
    expectPageWindows(await page.evaluate(pageWindows, [GALLERY, '[data-gallery-page]:not([data-gallery-page*="-system-"])']), shown.filter(name => !isSystem(name)));
    expectSystemWindows(await page.evaluate(systemWindows, [GALLERY, '[data-gallery-page*="-system-"]']), shown.filter(isSystem));
    const {charts, unread} = await page.evaluate(unreadCharts, GALLERY);
    expect(charts).toBeGreaterThan(0);
    expect(unread).toEqual([]);
    await expectStill(page, GALLERY);
    for (const size of wide ? PAGE_SIZES : ['phone']) await expect.soft(page.locator(`section[data-gallery-size="${size}"]`)).toHaveScreenshot(`maison-today-${size}-${theme}.png`);
    for (const size of wide ? PAGE_SIZES : ['phone']) await expect.soft(page.locator(`section[data-gallery-climate-size="${size}"]`)).toHaveScreenshot(`maison-climate-${size}-${theme}.png`);
    for (const size of wide ? PAGE_SIZES : ['phone']) await expect.soft(page.locator(`section[data-gallery-energy-size="${size}"]`)).toHaveScreenshot(`maison-energy-${size}-${theme}.png`);
    for (const size of wide ? PAGE_SIZES : ['phone']) await expect.soft(page.locator(`section[data-gallery-car-size="${size}"]`)).toHaveScreenshot(`maison-car-${size}-${theme}.png`);
    for (const size of wide ? PAGE_SIZES : ['phone']) await expect.soft(page.locator(`section[data-gallery-system-size="${size}"]`)).toHaveScreenshot(`maison-system-${size}-${theme}.png`);
  });

  // Climate's sheets drawn in place and whole, from each CLIMATE_SHEETS
  // fixture: bottom sheets in a phone's window, form sheets 640px wide where
  // they show (the wide project). Each is about 700 to 2,300px tall, so the
  // images go by placement, each where it is drawn at the width it is used
  // at: the bottom sheets on the phone project, one under another at a
  // narrow phone's width, where a long line wraps first; the form sheets on
  // the wide project. The wide project's bottom sheets are the same bodies
  // 32px wider: checked, not imaged.
  test(`Climate sheets in place · ${theme}`, async ({page}, testInfo) => {
    await openPages(page, theme);
    const wide = testInfo.project.name === 'desktop-1280';
    const found = await page.evaluate(sheetWindows, [GALLERY, SHEET_SECTIONS.climate]);
    expect(found.map(({window}) => window)).toEqual(wide ? SHEET_WINDOWS : SHEET_WINDOWS.filter(name => name.startsWith('bottom-')));
    for (const sheet of found) {
      expect(sheet, sheet.window).toMatchObject({holds: true, overflows: [], unnamed: [], sideways: []});
      expect(sheet.images, sheet.window).toBeGreaterThan(0);
      expectSheetWidth(sheet, wide);
    }
    await expectNoSidewaysScroll(page);
    await expect.soft(page.locator(`${SHEET_SECTIONS.climate} .m-gallery-sheets-group--${wide ? 'form' : 'bottom'}`)).toHaveScreenshot(`maison-climate-sheets-${wide ? 'form' : 'bottom'}-${theme}.png`);
  });

  // Energy's sheets (v33) drawn in place and whole, from each ENERGY_SHEETS
  // fixture, as Climate's are: each window holds its sheet, whose body holds
  // all it has with nothing leaving it, nothing scrolls sideways, and each
  // sheet is as wide as its placement makes it. No image or name is read.
  // The images go by placement as Climate's do.
  test(`Energy sheets in place · ${theme}`, async ({page}, testInfo) => {
    await openPages(page, theme);
    const wide = testInfo.project.name === 'desktop-1280';
    const found = await page.evaluate(sheetWindows, [GALLERY, SHEET_SECTIONS.energy, false]);
    expect(found.map(({window}) => window)).toEqual(wide ? ENERGY_SHEET_WINDOWS : ENERGY_SHEET_WINDOWS.filter(name => name.startsWith('bottom-')));
    for (const sheet of found) {
      expect(sheet, sheet.window).toMatchObject({holds: true, overflows: [], sideways: []});
      expectSheetWidth(sheet, wide);
    }
    await expectNoSidewaysScroll(page);
    await expect.soft(page.locator(`${SHEET_SECTIONS.energy} .m-gallery-sheets-group--${wide ? 'form' : 'bottom'}`)).toHaveScreenshot(`maison-energy-sheets-${wide ? 'form' : 'bottom'}-${theme}.png`);
  });

  // The Car's sheets (v34) drawn in place and whole, from each CAR_SHEETS
  // fixture, as Energy's are: each window holds its sheet, whose body holds
  // all it has with nothing leaving it, nothing scrolls sideways, and each
  // sheet is as wide as its placement makes it. No image or name is read.
  // The images go by placement as Climate's do.
  test(`Car sheets in place · ${theme}`, async ({page}, testInfo) => {
    await openPages(page, theme);
    const wide = testInfo.project.name === 'desktop-1280';
    const found = await page.evaluate(sheetWindows, [GALLERY, SHEET_SECTIONS.car, false]);
    expect(found.map(({window}) => window)).toEqual(wide ? CAR_SHEET_WINDOWS : CAR_SHEET_WINDOWS.filter(name => name.startsWith('bottom-')));
    for (const sheet of found) {
      expect(sheet, sheet.window).toMatchObject({holds: true, overflows: [], sideways: []});
      expectSheetWidth(sheet, wide);
    }
    await expectNoSidewaysScroll(page);
    await expect.soft(page.locator(`${SHEET_SECTIONS.car} .m-gallery-sheets-group--${wide ? 'form' : 'bottom'}`)).toHaveScreenshot(`maison-car-sheets-${wide ? 'form' : 'bottom'}-${theme}.png`);
  });

  // The dialogs (v35) drawn in place and whole, from each DIALOG_SNAPSHOTS
  // fixture, as the Car's sheets are: each window holds its sheet, whose
  // body holds all it has with nothing leaving it, nothing scrolls
  // sideways, and each sheet is as wide as its placement makes it. No image
  // or name is read.
  // The images go by placement as Climate's do.
  test(`Dialogs in place · ${theme}`, async ({page}, testInfo) => {
    await openPages(page, theme);
    const wide = testInfo.project.name === 'desktop-1280';
    const found = await page.evaluate(sheetWindows, [GALLERY, SHEET_SECTIONS.dialogs, false]);
    expect(found.map(({window}) => window)).toEqual(wide ? DIALOG_WINDOWS : DIALOG_WINDOWS.filter(name => name.startsWith('bottom-')));
    for (const sheet of found) {
      expect(sheet, sheet.window).toMatchObject({holds: true, overflows: [], sideways: []});
      expectSheetWidth(sheet, wide);
    }
    await expectNoSidewaysScroll(page);
    await expect.soft(page.locator(`${SHEET_SECTIONS.dialogs} .m-gallery-sheets-group--${wide ? 'form' : 'bottom'}`)).toHaveScreenshot(`maison-dialogs-${wide ? 'form' : 'bottom'}-${theme}.png`);
  });

  test(`Desktop gallery window · ${theme}`, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1280', 'The gallery shows its desktop windows from 1,240px only.');
    await openGallery(page, theme);
    const window = page.locator('[data-gallery-frame="desktop-today"]');
    await expect(window).toBeVisible();
    await expect(window.locator('.m-app')).toHaveAttribute('data-layout', 'desktop');
    await expect.soft(window).toHaveScreenshot(`maison-desktop-window-${theme}.png`);
  });

  test(`Zone sheet stays interactive inside slotted HA ancestry · ${theme}`, async ({page}) => {
    await openGallery(page, theme, '&host=slotted');
    const {button, sheet} = await openSheet(page, SHEETS[0]);
    for (const tag of SLOTTED) expect(await page.locator(tag).evaluate(el => el.shadowRoot.querySelector('slot').hasAttribute('inert'))).toBe(false);
    const backgroundTop = () => page.locator('maison-preview-shell').evaluate(el => el.shadowRoot.querySelector('.ha-view').scrollTop);
    const backgroundBefore = await backgroundTop();
    const body = sheet.locator('.m-sheet__body');
    expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    const bounds = await body.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await backgroundTop()).toBe(backgroundBefore);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  // The element itself, over the preview's no-snapshot
  // states (every reading unavailable), which never change. On a phone the
  // image is the first screen: Chromium's full-page capture leaves a fixed
  // element where the viewport put it, so the tab bar would float mid-page
  // over the content. From 700px the pill is sticky and the whole page is
  // taken. Energy (v33) and the Car (v34) are drawn and imaged as the
  // others are, and checked for their layout alone: pageWindows doesn't read
  // their images. Home status (v35), behind the header's settings button,
  // is no tab, so no tab is current there; it has no widget grid, so its
  // columns are checked as the pages view's are.
  for (const [hash, title] of [['today', 'Today'], ['climate', 'Climate'], ['energy', 'Energy'], ['car', 'Car'], ['system', null]]) {
    test(`Dashboard, ${title ?? 'Home status'} · ${theme}`, async ({page}, testInfo) => {
      const dashboard = await openDashboard(page, theme, hash);
      if (title) await expect(dashboard.locator('.m-tabbar').getByRole('button', {name: title, exact: true})).toHaveAttribute('aria-current', 'page');
      else await expect(dashboard.locator('.m-tabbar [aria-current]')).toHaveCount(0);
      const layout = testInfo.project.name === 'desktop-1280' ? 'desktop' : 'phone';
      await expect(dashboard.locator('.m-app')).toHaveAttribute('data-layout', layout);
      expect(await page.evaluate(unnamedControls, DASHBOARD)).toEqual([]);
      await expectNoSidewaysScroll(page);
      expect(await page.evaluate(containingBlocks, DASHBOARD)).toEqual([{frame: 'dashboard', found: [], beside: true}]);
      // No weather, so Today draws no days; Climate's capsules are all '—',
      // and Energy's flow and the Car's chart have every reading missing;
      // Home status has no header chart.
      expect(await page.evaluate(unreadCharts, DASHBOARD)).toEqual({charts: ['today', 'system'].includes(hash) ? 0 : 1, unread: []});
      // Each page's widgets fill their rows with every reading missing too,
      // once its layout has settled: in its first frames a page can still be
      // laying out (Energy's chart a few pixels taller than its body), so
      // the same check is retried for up to 2s and its last failure kept.
      // Home status's columns are retried the same way.
      if (hash === 'system') await expect(async () => expectSystemWindows(await page.evaluate(systemWindows, [DASHBOARD, '.m-app']), ['dashboard'],
        {layout: () => layout})).toPass({timeout: 2_000});
      else await expect(async () => expectPageWindows(await page.evaluate(pageWindows, [DASHBOARD, '.m-app']), ['dashboard'],
        {layout: () => layout, page: () => hash})).toPass({timeout: 2_000});
      await expectStill(page, DASHBOARD);
      await expect.soft(page).toHaveScreenshot(`maison-app-${hash}-${theme}.png`, {fullPage: testInfo.project.name === 'desktop-1280'});
    });
  }

  // Every page's hero under a snowy sky, whose clouds and snow would move
  // were motion allowed: no image, only what an image can't show.
  test(`Dashboard heroes under a snowy sky · ${theme}`, async ({page}) => {
    const dashboard = await openDashboard(page, theme, PAGES[0][0], SNOWY);
    for (const [hash, title, charts] of PAGES) {
      await page.evaluate(hash => { location.hash = hash; }, hash);
      await expect(dashboard.locator('.m-header__title')).toHaveText(title);
      await expect(dashboard.locator('.m-hero')).toHaveAttribute('data-sky', 'day');
      expect(await page.evaluate(unnamedControls, DASHBOARD), hash).toEqual([]);
      await expectNoSidewaysScroll(page);
      expect(await page.evaluate(containingBlocks, DASHBOARD), hash).toEqual([{frame: 'dashboard', found: [], beside: true}]);
      expect(await page.evaluate(unreadCharts, DASHBOARD), hash).toEqual({charts, unread: []});
      await expect(dashboard.locator('.m-sky__fall[data-fall=snow]')).toHaveCount(1);
      await expectStill(page, DASHBOARD);
    }
  });
}
