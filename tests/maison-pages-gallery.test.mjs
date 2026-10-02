// The gallery's pages view (#29 step 4): gallery-snapshots.js's
// TODAY_PAGES and todaySnapshot(), which it draws Today from, and how the
// page opens it (?view=pages through mountGallery). Each
// page is a Today fixture under a sky fixture, at the Today fixture's own
// time, with its agenda and the sky's forecast; screen() draws Today from it.
// From v32 Climate follows (CLIMATE_PAGES and climatePageSnapshot(), each a
// Climate fixture under a sky at CLIMATE_NOW), then its sheets drawn in
// place (CLIMATE_SHEETS and climateSheetSnapshot()), every sheet's 24 hours
// recorded. From v33 Energy follows them (ENERGY_PAGES and
// energyPageSnapshot(), each an Energy fixture under a sky at its own time,
// with its 24 hours of power), then its sheets (ENERGY_SHEETS and
// energySheetSnapshot(), reached through sheetSnapshot()). From v34 the Car
// follows Energy's sheets (CAR_PAGES and carPageSnapshot(), each a Car
// fixture under a sky at CAR_NOW), then its sheets (CAR_SHEETS and
// carSheetSnapshot(), reached through sheetSnapshot() too). From v35 Home
// status follows the Car's sheets (SYSTEM_PAGES and systemPageSnapshot(),
// each a home fixture under a sky at HOME_NOW, its catalogue eight readings
// long), then the dialogs drawn in place (DIALOG_SNAPSHOTS and dialogSnapshot(), each
// a home fixture on Today with one dialog open); Life leaves the gallery.
// How the windows look is the visual spec's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {E} from '../config/www/maison/model.js';
import {screen} from '../config/www/maison/screen.js';
import {TODAY_FIXTURES, TODAY_NOW} from '../frontend/maison/fixtures/today-fixtures.js';
import {SKY_FIXTURES, SKY_FORECAST} from '../frontend/maison/fixtures/sky-fixtures.js';
import {climateHistory} from '../config/www/maison/climate.js';
import {CLIMATE_FIXTURES, CLIMATE_NOW, CLIMATE_SCHEDULES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {ENERGY_FIXTURES, ENERGY_NIGHT_NOW, ENERGY_NIGHT_POWER_HISTORY, ENERGY_NOW, ENERGY_POWER_HISTORY} from '../frontend/maison/fixtures/energy-fixtures.js';
import {HOME_FIXTURES, HOME_MIDNIGHT, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {ENERGY_DETAILS} from '../config/www/maison/energy.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {CAR_DETAILS} from '../config/www/maison/car.js';
import {CAR_PAGES, CAR_SHEETS, CLIMATE_PAGES, CLIMATE_SHEETS, DIALOG_SNAPSHOTS, ENERGY_PAGES, ENERGY_SHEETS, SYSTEM_PAGES, TODAY_PAGES, carPageSnapshot, carSheetSnapshot,
  climatePageSnapshot, climateSheetSnapshot, dialogSnapshot, energyPageSnapshot, energySheetSnapshot, sheetSnapshot, systemPageSnapshot,
  todaySnapshot} from '../frontend/maison/src/gallery-snapshots.js';

const byId = (fixtures, id) => fixtures.find(f => f.id === id);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('TODAY_PAGES pairs each Today fixture with its sky, in the pages view’s order, titled by the fixture', () => {
  assert.deepEqual(TODAY_PAGES.map(({id, fixture, sky}) => [id, fixture, sky]),
    [['quiet', 'quiet', 'noon'], ['busy', 'busy', 'afternoon-cloudy'], ['paused', 'paused', 'dusk'], ['unavailable', 'unavailable', 'unknown'], ['night', 'night', 'night-cloudy']]);
  for (const page of TODAY_PAGES) assert.equal(page.title, byId(TODAY_FIXTURES, page.fixture).title, page.id);
  assert.ok(Object.isFrozen(TODAY_PAGES) && TODAY_PAGES.every(Object.isFrozen), 'frozen');
});

test('todaySnapshot lays the sky’s sun and weather over the fixture, at its own time or TODAY_NOW, with its agenda and the sky’s forecast', () => {
  for (const {id, fixture, sky} of TODAY_PAGES) {
    const snap = todaySnapshot(id), today = byId(TODAY_FIXTURES, fixture), over = byId(SKY_FIXTURES, sky).states;
    assert.equal(snap.now, today.now ?? TODAY_NOW, id);
    assert.deepEqual(snap.route, {page: 'today', detail: null, dialog: null}, id);
    assert.deepEqual(snap.states, {...today.states, ...over}, id);
    for (const entity of [E.sun, E.weather]) if (over[entity]) assert.equal(snap.states[entity], over[entity], `${id} ${entity}`);
    assert.deepEqual(snap.loaded.agenda, today.agenda, id);
    assert.equal(snap.loaded.agendaLoading, today.agendaLoading, id);
    assert.equal(snap.loaded.forecasts, SKY_FORECAST, id);
    assert.equal(snap.online, true, id);
    const {page, chrome} = screen(snap);
    assert.equal(page.id, 'today', id);
    assert.ok(chrome.nav.length > 0, id);
  }
  assert.equal(todaySnapshot('paused').loaded.agendaLoading, true, 'the paused page is the loading case');
  assert.throws(() => todaySnapshot('nowhere'), /nowhere/);
});

test('?view=pages reaches mountGallery, which draws the pages view in its place', () => {
  const html = read('dev/maison/gallery.html');
  assert.match(html, /import \{mountGallery\} from '\/maison\/vendor\/maison-gallery\.js';/);
  assert.match(html, /get\('view'\)==='pages'\?'pages':null;\n\s*mountGallery\(target,\{theme,screen,view\}\);/);
  assert.doesNotMatch(html, /get\('design'\)/, 'a ?design left in a URL is ignored');
  const gallery = read('frontend/maison/src/gallery.jsx');
  assert.match(gallery, /export function mountGallery\(target, \{theme = 'light', screen, view = null\} = \{\}\)/);
  assert.match(gallery, /\{view === 'pages' \? <PagesGallery\/> : <Gallery\/>\}/);
  // Every window the contract names, by size and page.
  const pages = read('frontend/maison/src/gallery/pages.jsx');
  const sizes = Object.fromEntries([...pages.matchAll(/\{size: '(\w+)',[^}]*pages: \[([^\]]*)\]\}/g)].map(([, size, ids]) => [size, [...ids.matchAll(/'(\w+)'/g)].map(m => m[1])]));
  assert.deepEqual(sizes, {phone: ['quiet', 'busy', 'paused', 'unavailable', 'night'], wide: ['busy', 'quiet'], desktop: ['busy', 'quiet', 'night', 'unavailable']});
  assert.match(pages, /data-gallery-page=\{`\$\{size\}-\$\{id\}`\}/);
});

// The window is the phone bar's containing block: without layout
// containment the fixed bar would float at the gallery's viewport foot, and
// without paint containment and its clip a page wider than its window would
// widen the gallery. Node has no JSX, so the stylesheet is read from the
// source (it interpolates nothing), and each window's element is the one
// the rule styles.
test('each page window contains its layout and paint, so the phone bar stays in it', () => {
  const pages = read('frontend/maison/src/gallery/pages.jsx');
  assert.match(pages, /<div className="m-gallery-page__window" data-gallery-page=\{`\$\{size\}-\$\{id\}`\}>/, 'the tagged window is the one the rule styles');
  const css = pages.match(/^export const pagesGalleryStyles = `([^`]*)`;$/m)?.[1];
  assert.ok(css && !css.includes('${'), 'the stylesheet is read whole');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({selector: selector.trim(),
    declarations: Object.fromEntries(body.split(';').filter(Boolean).map(part => [part.slice(0, part.indexOf(':')).trim(), part.slice(part.indexOf(':') + 1).trim()]))}));
  const window = rules.filter(rule => rule.selector === '.m-gallery-page__window');
  assert.equal(window.length, 1, 'one rule for the window');
  assert.equal(window[0].declarations.contain, 'layout paint');
  assert.equal(window[0].declarations.overflow, 'hidden');
  // Nothing else in the sheet undoes it for a window.
  assert.deepEqual(rules.filter(rule => rule !== window[0] && /\.m-gallery-page__window(?![\w-])[^\s]*$/.test(rule.selector) && ('contain' in rule.declarations || 'overflow' in rule.declarations))
    .map(rule => rule.selector), []);
});

// ---- Climate (v32) ---------------------------------------------------------

test('CLIMATE_PAGES pairs each Climate fixture with its sky, ids starting climate-, titled by the fixture', () => {
  assert.deepEqual(CLIMATE_PAGES.map(({id, fixture, sky}) => [id, fixture, sky]), [['climate-running', 'house_running', 'noon'], ['climate-off', 'house_off', 'night'],
    ['climate-away', 'house_away', 'afternoon-cloudy'], ['climate-override', 'house_override', 'rain'], ['climate-unavailable', 'sensors_unavailable', 'unknown']]);
  for (const page of CLIMATE_PAGES) {
    assert.equal(page.title, byId(CLIMATE_FIXTURES, page.fixture).title, page.id);
    assert.ok(byId(SKY_FIXTURES, page.sky), `${page.id}'s sky`);
  }
  assert.ok(Object.isFrozen(CLIMATE_PAGES) && CLIMATE_PAGES.every(Object.isFrozen), 'frozen');
  assert.deepEqual(CLIMATE_SHEETS.map(({id, fixture, detail}) => [id, fixture, detail]), [['sheet-house', 'house_running', 'house'], ['sheet-house-off', 'house_off', 'house'],
    ['sheet-attic', 'zone_override', 'attic'], ['sheet-noah', 'house_running', 'noah'], ['sheet-rails', 'house_override', 'towel-rails']]);
  for (const sheet of CLIMATE_SHEETS) assert.equal(sheet.title, byId(CLIMATE_FIXTURES, sheet.fixture).title, sheet.id);
  assert.ok(Object.isFrozen(CLIMATE_SHEETS) && CLIMATE_SHEETS.every(Object.isFrozen), 'frozen');
});

// Every chart group climate.js defines over `snap`'s states is loaded, each
// with every series its definition reads, over the 24 hours before
// CLIMATE_NOW, ending there on the sensor's reading ('—' as null); nothing
// is loading and every chart has values to draw.
function expectRecorded(snap, name) {
  const definitions = climateHistory(snap.states);
  assert.deepEqual(Object.keys(snap.loaded.history).sort(), [...new Set(definitions.map(d => d.group))].sort(), name);
  for (const {group, ids} of definitions) {
    const {data, start, end} = snap.loaded.history[group];
    assert.deepEqual([start, end], [CLIMATE_NOW - 24 * 3600000, CLIMATE_NOW], `${name} ${group}`);
    assert.deepEqual(data.errors, {}, `${name} ${group}`);
    for (const id of ids) {
      const points = data.series[id], times = points.map(point => Date.parse(point.timestamp));
      assert.ok(points.length > 1 && times.every((time, i) => time >= start && time <= end && (i === 0 || time > times[i - 1])), `${name} ${id} in order, in the window`);
      const reading = Number(snap.states[id].state);
      assert.deepEqual(points.at(-1), {timestamp: new Date(CLIMATE_NOW).toISOString(), value: Number.isFinite(reading) ? reading : null}, `${name} ${id} ends on its reading`);
    }
  }
  assert.equal(snap.loaded.historyLoading.size, 0, name);
  assert.deepEqual(snap.loaded.schedules, CLIMATE_SCHEDULES, name);
}

test('climatePageSnapshot lays the sky over the Climate fixture at CLIMATE_NOW, with every sheet’s 24 hours and the schedules', () => {
  for (const {id, fixture, sky} of CLIMATE_PAGES) {
    const snap = climatePageSnapshot(id), over = byId(SKY_FIXTURES, sky);
    assert.equal(snap.now, CLIMATE_NOW, `${id}: the fixtures’ morning, not the sky’s ${new Date(over.now).toISOString()}`);
    assert.deepEqual(snap.route, {page: 'climate', detail: null, dialog: null}, id);
    assert.deepEqual(snap.states, {...byId(CLIMATE_FIXTURES, fixture).states, ...over.states}, id);
    for (const entity of [E.sun, E.weather]) if (over.states[entity]) assert.equal(snap.states[entity], over.states[entity], `${id} ${entity}`);
    assert.equal(snap.online, true, id);
    expectRecorded(snap, id);
    const {page, chrome, drawer} = screen(snap);
    assert.equal(page.id, 'climate', id);
    assert.ok(chrome.nav.length > 0 && chrome.hero, id);
    assert.equal(drawer, null, id);
  }
  // The fixtures' futures stay ahead of the page's clock.
  const override = screen(climatePageSnapshot('climate-override')).page;
  assert.match(JSON.stringify(override), /until 12:30/);
  assert.match(JSON.stringify(override), /Drying until 10:15/);
  assert.throws(() => climatePageSnapshot('nowhere'), /nowhere/);
});

test('climateSheetSnapshot opens each sheet’s drawer on Climate at CLIMATE_NOW, every chart recorded', () => {
  const kinds = {'sheet-house': 'house', 'sheet-house-off': 'house', 'sheet-attic': 'zone', 'sheet-noah': 'zone', 'sheet-rails': 'rails'};
  for (const {id, fixture, detail} of CLIMATE_SHEETS) {
    const snap = climateSheetSnapshot(id);
    assert.equal(snap.now, CLIMATE_NOW, id);
    assert.deepEqual(snap.route, {page: 'climate', detail, dialog: null}, id);
    assert.deepEqual(snap.states, byId(CLIMATE_FIXTURES, fixture).states, `${id}: no sky`);
    expectRecorded(snap, id);
    const {drawer} = screen(snap);
    assert.equal(drawer?.body.kind, kinds[id], id);
    assert.ok(drawer.body.charts.length > 0, id);
    for (const {model} of drawer.body.charts) assert.equal(model.status, 'ready', `${id} ${model.title}`);
  }
  // The Attic's override since this morning is recorded as a step to it.
  const target = climateSheetSnapshot('sheet-attic').loaded.history['climate-attic'].data.series[E.atticTarget];
  assert.deepEqual(target.slice(-2).map(point => point.value), [22, 22]);
  assert.throws(() => climateSheetSnapshot('nowhere'), /nowhere/);
});

// The pages view's source, which Node reads as text (it has no JSX).
const PAGES = read('frontend/maison/src/gallery/pages.jsx');
const ids = list => [...list.matchAll(/'([\w-]+)'/g)].map(m => m[1]);
// A `{size, title, ids}` list's windows by size, read from its declaration
// alone (Climate's and Energy's lists share the shape).
const windowsOf = name => Object.fromEntries([...(PAGES.match(new RegExp(`^const ${name} = \\[\n([\\s\\S]*?)\n\\];$`, 'm'))?.[1] ?? '')
  .matchAll(/\{size: '(\w+)',[^}]*ids: \[([^\]]*)\]\}/g)].map(([, size, list]) => [size, ids(list)]));
// Where each of `marks` first shows in PagesGallery.
const marksAt = marks => marks.map(mark => PAGES.indexOf(mark, PAGES.indexOf('export function PagesGallery')));
// Each Energy sheet's body kind, by its ENERGY_DETAILS id.
const ENERGY_KIND = {price: 'price', 'billing-year': 'year', bill: 'bill', 'energy-today': 'day'}, ENERGY_KINDS = Object.values(ENERGY_KIND);

test('the pages view draws Climate’s windows after Today’s, each size tagged apart from Today’s, and its sheets in place', () => {
  // Climate's windows by size and CLIMATE_PAGES id, in a list shaped apart
  // from Today's {size, pages}.
  const sizes = windowsOf('CLIMATE_WINDOWS');
  assert.deepEqual(sizes, {phone: ['climate-running', 'climate-off', 'climate-away', 'climate-unavailable'], wide: ['climate-running', 'climate-off'],
    desktop: ['climate-running', 'climate-off', 'climate-override', 'climate-unavailable']});
  for (const id of Object.values(sizes).flat()) assert.ok(CLIMATE_PAGES.some(page => page.id === id), id);
  assert.match(PAGES, /data=\{\{'data-gallery-size': size\}\}/);
  assert.match(PAGES, /data=\{\{'data-gallery-climate-size': size\}\}/);
  assert.match(PAGES, /snapshot=\{todaySnapshot\(id\)\}/);
  assert.match(PAGES, /snapshot=\{climatePageSnapshot\(id\)\}/);
  // Today's sections come first, then Climate's, then the sheets.
  const order = marksAt(['SIZES.map(', 'CLIMATE_WINDOWS.map(', 'data-gallery-sheets']);
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `in order: ${order}`);
  // Every sheet in each placement, drawn as DrawerSheet draws its body, with
  // no frame and so no tab bar.
  assert.deepEqual([...PAGES.matchAll(/\{placement: '(\w+)'/g)].map(m => m[1]), ['bottom', 'form']);
  assert.match(PAGES, /<SheetsSection title="Climate · Sheets" data=\{\{'data-gallery-sheets': ''\}\} sheets=\{CLIMATE_SHEETS\}\/>/);
  assert.match(PAGES, /function SheetsSection\(\{title, data, sheets, Window = SheetWindow\}\)/);
  assert.match(PAGES, /sheets\.map\(\(\{id\}\) => <Window key=\{id\} id=\{id\} placement=\{placement\}\/>\)/);
  // The sheet's shell (InPlace) tags its window with the name its caller
  // gives it: a drawer's `{placement}-{id}`.
  assert.match(PAGES, /<div className="m-gallery-sheet__window" data-gallery-sheet=\{name\}>/);
  assert.match(PAGES, /<InPlace name=\{`\$\{placement\}-\$\{id\}`\} placement=\{placement\} eyebrow=\{drawer\.eyebrow\} title=\{drawer\.title\} caption=\{SHEET_TITLES\[id\]\}>\s*<Body body=\{drawer\.body\}\/>\s*<\/InPlace>/);
  // A sheet's page comes from its id; a kind with no body yet (Energy's
  // before they are registered) draws an empty body, never Climate's.
  assert.match(PAGES, /const \{drawer\} = useScreen\(\)\(sheetSnapshot\(id\)\), Body = DRAWERS\[drawer\.body\.kind\] \?\? NoBody;/);
  assert.match(PAGES, /^const NoBody = \(\) => null;$/m);
  // Every Climate sheet's kind has a body, so the old drawer is gone
  // from the view; any other kind registered is an Energy or a Car sheet's.
  assert.doesNotMatch(PAGES, /ClimateDrawer|climate\/drawers\.jsx/);
  const kinds = read('frontend/maison/src/drawers.jsx').match(/export const DRAWERS = \{([^}]*)\};/)?.[1];
  const registered = [...kinds.matchAll(/(\w+): \w+Drawer/g)].map(m => m[1]), climate = ['house', 'rails', 'zone'];
  assert.deepEqual(registered.filter(kind => climate.includes(kind)).sort(), climate);
  assert.deepEqual(registered.filter(kind => !climate.includes(kind) && !ENERGY_KINDS.includes(kind) && !['battery', 'sources'].includes(kind)), []);
  // The body is drawn in the window's placement, as the Sheet provides it,
  // so a chart in a bottom window takes the bottom sheet's box on any
  // viewport: the Sheet's own placement for each, on the sheet and around
  // the body alike.
  assert.match(PAGES, /const SHEET_PLACEMENT = \{bottom: 'bottom', form: 'center'\};/);
  assert.match(PAGES, /<div className="m-sheet" data-placement=\{SHEET_PLACEMENT\[placement\]\}>/);
  assert.match(PAGES, /<SheetPlacementContext\.Provider value=\{SHEET_PLACEMENT\[placement\]\}>\s*<div className="m-sheet__body">\{children\}<\/div>\s*<\/SheetPlacementContext\.Provider>/);
  for (const name of ['function InPlace', 'function SheetWindow']) {
    const source = PAGES.slice(PAGES.indexOf(name), PAGES.indexOf('\n}\n', PAGES.indexOf(name)));
    assert.doesNotMatch(source, /<Frame|m-tabbar/, name);
  }
});

// A sheet's window is contained and clipped as a page's is, and the Sheet
// in it lies in its flow, uncapped, so it shows whole; form sheets show only
// where the viewport holds them.
test('each sheet window contains its layout and paint, and shows its sheet whole', () => {
  const css = PAGES.match(/^export const pagesGalleryStyles = `([^`]*)`;$/m)?.[1];
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({selector: selector.trim(),
    declarations: Object.fromEntries(body.split(';').filter(Boolean).map(part => [part.slice(0, part.indexOf(':')).trim(), part.slice(part.indexOf(':') + 1).trim()]))}));
  const rule = selector => rules.filter(each => each.selector === selector);
  assert.equal(rule('.m-gallery-sheet__window').length, 1, 'one rule for the window');
  assert.equal(rule('.m-gallery-sheet__window')[0].declarations.contain, 'layout paint');
  assert.equal(rule('.m-gallery-sheet__window')[0].declarations.overflow, 'hidden');
  assert.deepEqual(rules.filter(each => /\.m-gallery-sheet__window(?![\w-])[^\s]*$/.test(each.selector) && each !== rule('.m-gallery-sheet__window')[0]
    && ('contain' in each.declarations || 'overflow' in each.declarations)).map(each => each.selector), []);
  assert.deepEqual(rule('.m-gallery-sheet__window .m-sheet[data-placement]')[0]?.declarations, {position: 'relative', inset: 'auto', width: 'auto', 'max-height': 'none', 'min-width': '0'});
  // A bottom sheet in a phone's width; a form sheet as wide as ui/sheet.css.js
  // draws it (640px) in 24px of scrim, shown where the column holds it.
  assert.deepEqual(rule('.m-gallery-sheet--bottom')[0]?.declarations, {width: '375px'});
  assert.deepEqual(rule('.m-gallery-sheet--form')[0]?.declarations, {width: '688px'});
  assert.equal(rule('.m-gallery-sheet--form .m-gallery-sheet__window')[0]?.declarations.padding, 'var(--m-space-6)');
  assert.match(read('frontend/maison/src/ui/sheet.css.js'), /\.m-sheet\[data-placement=center\]\{width:min\(640px,100% - 48px\);/);
  assert.equal(rule('.m-gallery-sheets-group--form')[0]?.declarations.display, 'none');
  assert.match(css, /@media \(min-width:760px\)\{\.m-gallery-sheets-group--form\{display:grid\}\}/);
});

// ---- Energy (v33) ----------------------------------------------------------

test('ENERGY_PAGES pairs each Energy fixture with a sky that fits its hour, ids starting energy-, titled by the fixture', () => {
  assert.deepEqual(ENERGY_PAGES.map(({id, fixture, sky}) => [id, fixture, sky]),
    [['energy-covered', 'covered', 'noon'], ['energy-billing', 'billing', 'noon'], ['energy-night', 'night', 'night'], ['energy-missing', 'missing', 'unknown']]);
  for (const page of ENERGY_PAGES) {
    assert.equal(page.title, byId(ENERGY_FIXTURES, page.fixture).title, page.id);
    assert.ok(byId(SKY_FIXTURES, page.sky), `${page.id}'s sky`);
  }
  assert.ok(Object.isFrozen(ENERGY_PAGES) && ENERGY_PAGES.every(Object.isFrozen), 'frozen');
  // The sheets: Price, Bill so far and Energy today over the billing house;
  // the Billing year over it and over HOME's quiet one, whose off-peak
  // register has no reading; the Bill over the covered and missing ones too.
  assert.deepEqual(ENERGY_SHEETS.map(({id, fixture, detail}) => [id, fixture, detail]), [['energy-price', 'billing', 'price'], ['energy-billing-year', 'billing', 'billing-year'],
    ['energy-billing-year-quiet', 'quiet', 'billing-year'], ['energy-bill', 'billing', 'bill'], ['energy-bill-covered', 'covered', 'bill'],
    ['energy-bill-missing', 'missing', 'bill'], ['energy-today', 'billing', 'energy-today']]);
  for (const sheet of ENERGY_SHEETS) {
    assert.equal(sheet.title, byId([...ENERGY_FIXTURES, ...HOME_FIXTURES], sheet.fixture).title, sheet.id);
    assert.ok(ENERGY_DETAILS.some(({id}) => id === sheet.detail), `${sheet.id}'s detail`);
  }
  assert.deepEqual([...new Set(ENERGY_SHEETS.map(({detail}) => detail))].sort(), ENERGY_DETAILS.map(({id}) => id).sort(), 'every sheet drawn');
  assert.ok(Object.isFrozen(ENERGY_SHEETS) && ENERGY_SHEETS.every(Object.isFrozen), 'frozen');
});

// Energy's power since midnight, as the element keeps it under the chart's
// `energy` group, by fixture: the night's to 21:04, nothing recorded for the
// missing house, HOME's noon for the rest; each ends at its time.
const POWER = {night: ENERGY_NIGHT_POWER_HISTORY, missing: {data: {series: {}, errors: {}}, start: HOME_MIDNIGHT, end: ENERGY_NOW}};
function expectPower(snap, fixture, name) {
  assert.deepEqual(Object.keys(snap.loaded.history), ['energy'], name);
  assert.deepEqual(snap.loaded.history.energy, POWER[fixture] ?? ENERGY_POWER_HISTORY, name);
  assert.equal(snap.loaded.history.energy.end, snap.now, `${name} ends now`);
  assert.equal(snap.loaded.historyLoading.size, 0, name);
}

test('energyPageSnapshot lays the sky over the Energy fixture at its own time, with its 24 hours of power', () => {
  const times = {covered: ENERGY_NOW, billing: ENERGY_NOW, night: ENERGY_NIGHT_NOW, missing: ENERGY_NOW};
  for (const {id, fixture, sky} of ENERGY_PAGES) {
    const snap = energyPageSnapshot(id), energy = byId(ENERGY_FIXTURES, fixture), over = byId(SKY_FIXTURES, sky).states;
    assert.equal(snap.now, energy.now, id);
    assert.equal(snap.now, times[fixture], `${id}: the fixture’s own time`);
    assert.deepEqual(snap.route, {page: 'energy', detail: null, dialog: null}, id);
    assert.deepEqual(snap.states, {...energy.states, ...over}, id);
    for (const entity of [E.sun, E.weather]) if (over[entity]) assert.equal(snap.states[entity], over[entity], `${id} ${entity}`);
    assert.equal(snap.online, true, id);
    expectPower(snap, fixture, id);
    const {page, chrome, drawer} = screen(snap);
    assert.equal(page.id, 'energy', id);
    assert.ok(chrome.nav.length > 0 && chrome.hero, id);
    assert.equal(drawer, null, id);
    assert.equal(page.dayChart.model.status, fixture === 'missing' ? 'empty' : 'ready', id);
  }
  // The night's sun has set, and the missing house has neither sun nor weather.
  assert.equal(energyPageSnapshot('energy-night').states[E.sun].state, 'below_horizon');
  assert.equal(energyPageSnapshot('energy-missing').states[E.sun], undefined);
  assert.throws(() => energyPageSnapshot('nowhere'), /nowhere/);
});

test('energySheetSnapshot opens each sheet on Energy at its fixture’s time, and sheetSnapshot tells Energy’s from Climate’s', () => {
  for (const {id, fixture, detail} of ENERGY_SHEETS) {
    const snap = energySheetSnapshot(id), source = byId(ENERGY_FIXTURES, fixture) ?? byId(HOME_FIXTURES, fixture);
    assert.equal(snap.now, source.now ?? ENERGY_NOW, id);
    assert.deepEqual(snap.route, {page: 'energy', detail, dialog: null}, id);
    assert.deepEqual(snap.states, source.states, `${id}: no sky`);
    expectPower(snap, fixture, id);
    const {page, drawer} = screen(snap);
    assert.equal(page.id, 'energy', id);
    assert.equal(drawer?.eyebrow, 'Energy', id);
    assert.equal(drawer.title, byId(ENERGY_DETAILS, detail).name, id);
    assert.equal(drawer.body.kind, ENERGY_KIND[detail], id);
    assert.deepEqual(sheetSnapshot(id), snap, `${id} through sheetSnapshot`);
  }
  assert.equal(byId(HOME_FIXTURES, 'quiet').now, undefined, 'HOME’s quiet house is at ENERGY_NOW');
  for (const {id} of CLIMATE_SHEETS) assert.deepEqual(sheetSnapshot(id), climateSheetSnapshot(id), id);
  assert.throws(() => energySheetSnapshot('nowhere'), /nowhere/);
  assert.throws(() => sheetSnapshot('energy-nowhere'), /energy-nowhere/);
});

test('the pages view draws Energy’s windows and sheets after Climate’s sheets, each tagged apart', () => {
  // Energy's windows by size and ENERGY_PAGES id, in a list of its own.
  const sizes = windowsOf('ENERGY_WINDOWS');
  assert.deepEqual(sizes, {phone: ['energy-covered', 'energy-billing', 'energy-night', 'energy-missing'], wide: ['energy-covered', 'energy-billing'],
    desktop: ['energy-covered', 'energy-billing', 'energy-night', 'energy-missing']});
  for (const id of Object.values(sizes).flat()) assert.ok(ENERGY_PAGES.some(page => page.id === id), id);
  assert.match(PAGES, /data=\{\{'data-gallery-energy-size': size\}\}/);
  assert.match(PAGES, /snapshot=\{energyPageSnapshot\(id\)\}/);
  assert.match(PAGES, /<SheetsSection title="Energy · Sheets" data=\{\{'data-gallery-energy-sheets': ''\}\} sheets=\{ENERGY_SHEETS\}\/>/);
  // Today's, then Climate's and its sheets, then Energy's and its sheets, so
  // nothing before Energy moves.
  const order = marksAt(['SIZES.map(', 'CLIMATE_WINDOWS.map(', "'data-gallery-sheets'", 'ENERGY_WINDOWS.map(', "'data-gallery-energy-sheets'"]);
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `in order: ${order}`);
  // Every Energy sheet's body kind is one of the four bodies.
  for (const {id, detail} of ENERGY_SHEETS) assert.ok(ENERGY_KINDS.includes(ENERGY_KIND[detail]), id);
});

// ---- The Car (v34) ---------------------------------------------------------

// A Car page's or sheet's fixture: a CAR_FIXTURES one, or one of the page's
// own edges (CAR_PAGE_FIXTURES), such as a meter without a reading.
const carSource = fixture => byId(CAR_FIXTURES, fixture) ?? byId(CAR_PAGE_FIXTURES, fixture);
// Each Car sheet's body kind, by its CAR_DETAILS id.
const CAR_KIND = {battery: 'battery', 'charging-energy': 'sources'};

test('CAR_PAGES pairs each Car fixture with its sky, ids the fixture’s after car-, titled by the fixture', () => {
  assert.deepEqual(CAR_PAGES.map(({id, fixture, sky}) => [id, fixture, sky]), [['car-solar', 'solar', 'noon'], ['car-charge_now', 'charge_now', 'afternoon-cloudy'],
    ['car-not_verified', 'not_verified', 'night'], ['car-unplugged', 'unplugged', 'afternoon-cloudy'], ['car-never_confirmed', 'never_confirmed', 'unknown'],
    ['car-dropout', 'dropout', 'rain'], ['car-override_asleep', 'override_asleep', 'dusk']]);
  for (const page of CAR_PAGES) {
    assert.equal(page.title, carSource(page.fixture).title, page.id);
    assert.ok(byId(SKY_FIXTURES, page.sky), `${page.id}'s sky`);
  }
  assert.ok(Object.isFrozen(CAR_PAGES) && CAR_PAGES.every(Object.isFrozen), 'frozen');
  // The sheets: Battery charging from solar, asleep and unverified (with its
  // Why), and with nothing confirmed; Charging energy with every meter read
  // and with one without a reading.
  assert.deepEqual(CAR_SHEETS.map(({id, fixture, detail}) => [id, fixture, detail]), [['car-battery', 'solar', 'battery'], ['car-battery-asleep', 'not_verified', 'battery'],
    ['car-battery-missing', 'never_confirmed', 'battery'], ['car-charging-energy', 'solar', 'charging-energy'],
    ['car-charging-energy-missing', 'meter_missing', 'charging-energy']]);
  for (const sheet of CAR_SHEETS) {
    assert.equal(sheet.title, carSource(sheet.fixture).title, sheet.id);
    assert.ok(CAR_DETAILS.some(({id}) => id === sheet.detail), `${sheet.id}'s detail`);
  }
  assert.deepEqual([...new Set(CAR_SHEETS.map(({detail}) => detail))].sort(), CAR_DETAILS.map(({id}) => id).sort(), 'every sheet drawn');
  assert.ok(Object.isFrozen(CAR_SHEETS) && CAR_SHEETS.every(Object.isFrozen), 'frozen');
});

test('carPageSnapshot lays the sky over the Car fixture at CAR_NOW, not the sky’s time', () => {
  // Each page's fixture shows one of the Charging card's forms, or none
  // while the Car is unplugged: every form, the quiet ones (reconnecting,
  // and asleep with an override on) included.
  const forms = {'car-solar': 'ready', 'car-charge_now': 'override', 'car-not_verified': 'asleep', 'car-unplugged': null, 'car-never_confirmed': null,
    'car-dropout': 'reconnecting', 'car-override_asleep': 'asleep'};
  for (const {id, fixture, sky} of CAR_PAGES) {
    const snap = carPageSnapshot(id), car = carSource(fixture), over = byId(SKY_FIXTURES, sky);
    assert.equal(snap.now, CAR_NOW, `${id}: the fixtures’ own time, not the sky’s ${new Date(over.now).toISOString()}`);
    assert.deepEqual(snap.route, {page: 'car', detail: null, dialog: null}, id);
    assert.deepEqual(snap.states, {...car.states, ...over.states}, id);
    for (const entity of [E.sun, E.weather]) if (over.states[entity]) assert.equal(snap.states[entity], over.states[entity], `${id} ${entity}`);
    assert.equal(snap.carLast, car.last ?? null, id);
    assert.equal(snap.online, true, id);
    assert.deepEqual(snap.loaded.history, {}, `${id}: the Car loads nothing`);
    const {page, chrome, drawer} = screen(snap);
    assert.equal(page.id, 'car', id);
    assert.ok(chrome.nav.length > 0 && chrome.hero, id);
    assert.equal(drawer, null, id);
    assert.equal(page.charge?.kind ?? null, forms[id], id);
    // A clock on the fixture's own day reads without its weekday.
    assert.doesNotMatch(JSON.stringify({page, chrome}), /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2}/, id);
  }
  // The dropout keeps the headline it had; asleep with Charge now on, the
  // Car can still return to automatic.
  assert.ok(byId(CAR_FIXTURES, 'dropout').last);
  assert.deepEqual(carPageSnapshot('car-dropout').carLast, byId(CAR_FIXTURES, 'dropout').last);
  const asleep = screen(carPageSnapshot('car-override_asleep')).page.charge;
  assert.ok(asleep.action && asleep.wake, 'Return to automatic and Wake');
  // The night's sun has set, and the unknown sky has neither sun nor weather.
  assert.equal(carPageSnapshot('car-not_verified').states[E.sun].state, 'below_horizon');
  assert.equal(carPageSnapshot('car-never_confirmed').states[E.sun], undefined);
  assert.throws(() => carPageSnapshot('nowhere'), /nowhere/);
});

test('carSheetSnapshot opens each sheet on the Car at CAR_NOW, and sheetSnapshot tells the Car’s from Energy’s and Climate’s', () => {
  for (const {id, fixture, detail} of CAR_SHEETS) {
    const snap = carSheetSnapshot(id), source = carSource(fixture);
    assert.equal(snap.now, CAR_NOW, id);
    assert.deepEqual(snap.route, {page: 'car', detail, dialog: null}, id);
    assert.deepEqual(snap.states, source.states, `${id}: no sky`);
    assert.equal(snap.carLast, source.last ?? null, id);
    const {page, drawer} = screen(snap);
    assert.equal(page.id, 'car', id);
    assert.equal(drawer?.eyebrow, 'Car', id);
    assert.equal(drawer.title, byId(CAR_DETAILS, detail).name, id);
    assert.equal(drawer.body.kind, CAR_KIND[detail], id);
    assert.deepEqual(sheetSnapshot(id), snap, `${id} through sheetSnapshot`);
  }
  // What each sheet is there to show.
  const body = id => screen(carSheetSnapshot(id)).drawer.body;
  assert.notEqual(body('car-battery-asleep').why, null, 'the asleep Battery has its Why');
  assert.equal(body('car-battery-missing').summary.ring.plot.fill, null, 'nothing confirmed');
  assert.equal(body('car-charging-energy').summary.bar.kind, 'split');
  assert.equal(body('car-charging-energy-missing').summary.bar.kind, 'missing');
  // Every sheet reaches its own page's snapshot through sheetSnapshot.
  for (const {id} of ENERGY_SHEETS) assert.deepEqual(sheetSnapshot(id), energySheetSnapshot(id), id);
  for (const {id} of CLIMATE_SHEETS) assert.deepEqual(sheetSnapshot(id), climateSheetSnapshot(id), id);
  assert.throws(() => carSheetSnapshot('nowhere'), /nowhere/);
  assert.throws(() => sheetSnapshot('car-nowhere'), /car-nowhere/);
});

test('the pages view draws the Car’s windows and sheets after Energy’s sheets, each tagged apart', () => {
  // The Car's windows by size and CAR_PAGES id, in a list of its own.
  const sizes = windowsOf('CAR_WINDOWS');
  assert.deepEqual(sizes, {phone: ['car-solar', 'car-charge_now', 'car-not_verified', 'car-unplugged', 'car-never_confirmed'],
    wide: ['car-solar', 'car-not_verified', 'car-unplugged'], desktop: ['car-solar', 'car-not_verified', 'car-unplugged', 'car-dropout', 'car-override_asleep']});
  for (const id of Object.values(sizes).flat()) assert.ok(CAR_PAGES.some(page => page.id === id), id);
  assert.match(PAGES, /data=\{\{'data-gallery-car-size': size\}\}/);
  assert.match(PAGES, /snapshot=\{carPageSnapshot\(id\)\}/);
  assert.match(PAGES, /<SheetsSection title="Car · Sheets" data=\{\{'data-gallery-car-sheets': ''\}\} sheets=\{CAR_SHEETS\}\/>/);
  // Today's, Climate's and Energy's, each with their sheets, then the Car's
  // and its sheets, so nothing before the Car moves.
  const order = marksAt(['SIZES.map(', 'CLIMATE_WINDOWS.map(', "'data-gallery-sheets'", 'ENERGY_WINDOWS.map(', "'data-gallery-energy-sheets'",
    'CAR_WINDOWS.map(', "'data-gallery-car-sheets'"]);
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `in order: ${order}`);
  assert.equal(PAGES.indexOf('CAR_WINDOWS.map(', order.at(-1)), -1, 'the Car’s sections come once');
  // A Car sheet takes its caption from CAR_SHEETS.
  assert.match(PAGES, /const SHEET_TITLES = Object\.fromEntries\(\[\.\.\.CLIMATE_SHEETS, \.\.\.ENERGY_SHEETS, \.\.\.CAR_SHEETS\]/);
});

// ---- Home status and the dialogs (v35) -------------------------------------

test('SYSTEM_PAGES pairs each home fixture with its sky, ids the fixture’s, titled by the fixture', () => {
  assert.deepEqual(SYSTEM_PAGES.map(({id, fixture, sky}) => [id, fixture, sky]), [['full', 'full', 'noon'], ['quiet', 'quiet', 'afternoon-cloudy'], ['missing', 'missing', 'unknown']]);
  for (const page of SYSTEM_PAGES) {
    assert.equal(page.title, byId(HOME_FIXTURES, page.fixture).title, page.id);
    assert.ok(byId(SKY_FIXTURES, page.sky), `${page.id}'s sky`);
  }
  assert.ok(Object.isFrozen(SYSTEM_PAGES) && SYSTEM_PAGES.every(Object.isFrozen), 'frozen');
});

test('systemPageSnapshot lays the sky over the home fixture at HOME_NOW, its catalogue eight readings long, loading nothing', () => {
  for (const {id, fixture, sky} of SYSTEM_PAGES) {
    const snap = systemPageSnapshot(id), home = byId(HOME_FIXTURES, fixture), over = byId(SKY_FIXTURES, sky);
    assert.equal(snap.now, HOME_NOW, `${id}: the fixtures’ own time, not the sky’s ${new Date(over.now).toISOString()}`);
    assert.deepEqual(snap.route, {page: 'system', detail: null, dialog: null}, id);
    assert.deepEqual(snap.states, {...home.states, ...over.states}, id);
    for (const entity of [E.sun, E.weather]) if (over.states[entity]) assert.equal(snap.states[entity], over.states[entity], `${id} ${entity}`);
    assert.deepEqual(snap.sensors, {query: '', category: 'all', limit: 8}, id);
    assert.equal(snap.online, true, id);
    assert.deepEqual(snap.loaded.history, {}, `${id}: Home status loads nothing`);
    assert.deepEqual(snap.loaded.agenda.events, [], id);
    const {page, chrome, drawer, dialog} = screen(snap);
    assert.equal(page.id, 'system', id);
    assert.ok(chrome.nav.length > 0 && chrome.title, id);
    assert.equal(drawer, null, id);
    assert.equal(dialog, null, id);
    assert.ok(page.sensors.rows.length <= 8, `${id}: a short window`);
    for (const key of ['needs', 'devices', 'vacuum', 'homeAssistant']) assert.ok(page[key], `${id} ${key}`);
  }
  // The full house has more readings than the window shows, and Show more;
  // the missing house has none, and its key devices stay missing under the
  // unknown sky, the weather among them.
  const full = screen(systemPageSnapshot('full')).page;
  assert.equal(full.sensors.rows.length, 8);
  assert.ok(full.sensors.more, 'Show more');
  assert.equal(full.devices.rows.length, 0, 'every key device reporting');
  const missing = screen(systemPageSnapshot('missing'));
  assert.deepEqual(missing.page.sensors.rows, []);
  assert.equal(systemPageSnapshot('missing').states[E.weather].state, 'unavailable');
  assert.equal(systemPageSnapshot('missing').states[E.sun], undefined);
  assert.ok(missing.page.devices.rows.some(row => row.link.intent.entity === E.weather), 'the weather is a missing key device');
  assert.ok(screen(systemPageSnapshot('quiet')).page.devices.rows.length > 0, 'the quiet house has key devices missing');
  assert.throws(() => systemPageSnapshot('nowhere'), /nowhere/);
});

test('DIALOG_SNAPSHOTS opens the alerts with two waiting and with none, the full house’s first event and the full calendar, each over a home fixture', () => {
  assert.deepEqual(DIALOG_SNAPSHOTS.map(({id, fixture, dialog}) => [id, fixture, dialog.kind]),
    [['alerts', 'full', 'alerts'], ['alerts-empty', 'quiet', 'alerts'], ['event', 'full', 'event'], ['calendar', 'full', 'native']]);
  assert.equal(byId(DIALOG_SNAPSHOTS, 'event').dialog.event, byId(HOME_FIXTURES, 'full').agenda.events[0], 'the event as the element opens it');
  assert.equal(byId(DIALOG_SNAPSHOTS, 'calendar').dialog.native, 'calendar');
  for (const {id, fixture, title} of DIALOG_SNAPSHOTS) {
    assert.ok(byId(HOME_FIXTURES, fixture), `${id}'s fixture`);
    assert.ok(typeof title === 'string' && title.length > 0, `${id}'s caption`);
  }
  assert.ok(Object.isFrozen(DIALOG_SNAPSHOTS) && DIALOG_SNAPSHOTS.every(entry => Object.isFrozen(entry) && Object.isFrozen(entry.dialog)), 'frozen');
});

test('dialogSnapshot opens each dialog on Today at HOME_NOW, and screen() returns it beside the page', () => {
  for (const {id, fixture, dialog: route} of DIALOG_SNAPSHOTS) {
    const snap = dialogSnapshot(id), home = byId(HOME_FIXTURES, fixture);
    assert.equal(snap.now, HOME_NOW, id);
    assert.deepEqual(snap.route, {page: 'today', detail: null, dialog: route}, id);
    assert.deepEqual(snap.states, home.states, `${id}: no sky`);
    assert.deepEqual(snap.loaded.agenda, home.agenda, id);
    const {page, drawer, dialog} = screen(snap);
    assert.equal(page.id, 'today', id);
    assert.equal(drawer, null, id);
    assert.equal(dialog?.kind, route.kind, id);
    assert.equal(dialog.close.intent.command, 'close', id);
  }
  // What each dialog is there to show.
  const dialog = id => screen(dialogSnapshot(id)).dialog;
  assert.ok(dialog('alerts').rows.length > 1 && dialog('alerts').empty === null, 'alerts waiting');
  assert.deepEqual(dialog('alerts-empty').rows, []);
  assert.equal(dialog('alerts-empty').empty.length, 2, 'none waiting: two lines');
  assert.ok(dialog('event').location && dialog('event').description, 'an event with a place and a note');
  assert.equal(dialog('event').title, byId(HOME_FIXTURES, 'full').agenda.events[0].summary);
  assert.equal(dialog('calendar').native.config.type, 'calendar', 'Home Assistant’s calendar card');
  assert.throws(() => dialogSnapshot('nowhere'), /nowhere/);
});

// Maison's dialog bodies, by kind, as dialogs.jsx registers them.
const DIALOG_KINDS = () => [...(read('frontend/maison/src/dialogs.jsx').match(/export const DIALOGS = \{([^}]*)\};/)?.[1] ?? '').matchAll(/(\w+):/g)].map(m => m[1]);

test('the pages view draws Home status’s windows after the Car’s sheets, then the dialogs in place, each tagged apart', () => {
  // Home status's windows by size and SYSTEM_PAGES id, in a list of its own.
  const sizes = windowsOf('SYSTEM_WINDOWS');
  assert.deepEqual(sizes, {phone: ['full', 'quiet', 'missing'], wide: ['full'], desktop: ['full', 'missing']});
  for (const id of Object.values(sizes).flat()) assert.ok(SYSTEM_PAGES.some(page => page.id === id), id);
  assert.match(PAGES, /data=\{\{'data-gallery-system-size': size\}\}/);
  // A window is `{size}-system-{id}`, so it never takes another page's name.
  assert.match(PAGES, /<PageWindow key=\{id\} id=\{`system-\$\{id\}`\} size=\{size\} snapshot=\{systemPageSnapshot\(id\)\} title=\{SYSTEM_TITLES\[id\]\}\/>/);
  // The dialogs in place, `{placement}-dialog-{id}`, each body the one the
  // dashboard's dialog sheet draws for its kind, in the window's placement.
  assert.match(PAGES, /<SheetsSection title="Dialogs" data=\{\{'data-gallery-dialogs': ''\}\} sheets=\{DIALOG_SNAPSHOTS\} Window=\{DialogWindow\}\/>/);
  assert.match(PAGES, /^import \{DIALOGS\} from '\.\.\/dialogs\.jsx';$/m);
  assert.match(PAGES, /const \{dialog\} = useScreen\(\)\(dialogSnapshot\(id\)\), Body = DIALOGS\[dialog\.kind\] \?\? NoBody;/);
  assert.match(PAGES, /<InPlace name=\{`\$\{placement\}-dialog-\$\{id\}`\} placement=\{placement\} eyebrow=\{dialog\.eyebrow\} title=\{dialog\.title\} caption=\{DIALOG_TITLES\[id\]\}>\s*<Body value=\{dialog\}\/>\s*<\/InPlace>/);
  const dialogWindow = PAGES.slice(PAGES.indexOf('function DialogWindow'), PAGES.indexOf('\n}\n', PAGES.indexOf('function DialogWindow')));
  assert.doesNotMatch(dialogWindow, /<Frame|m-tabbar/);
  // Every dialog's kind has a body.
  const kinds = DIALOG_KINDS();
  for (const {id} of DIALOG_SNAPSHOTS) assert.ok(kinds.includes(screen(dialogSnapshot(id)).dialog.kind), `${id} has a body`);
  // Every section before stays where it was; Home status's sections, then
  // the dialogs, are the last.
  const order = marksAt(['SIZES.map(', 'CLIMATE_WINDOWS.map(', "'data-gallery-sheets'", 'ENERGY_WINDOWS.map(', "'data-gallery-energy-sheets'",
    'CAR_WINDOWS.map(', "'data-gallery-car-sheets'", 'SYSTEM_WINDOWS.map(', "'data-gallery-dialogs'"]);
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `in order: ${order}`);
  const main = PAGES.slice(PAGES.indexOf('export function PagesGallery'), PAGES.indexOf('\n}\n', PAGES.indexOf('export function PagesGallery')));
  assert.match(main, /'data-gallery-dialogs': ''\}\} sheets=\{DIALOG_SNAPSHOTS\} Window=\{DialogWindow\}\/>\n {2}<\/main>;$/, 'the dialogs are the last');
  // A dialog takes its caption from DIALOG_SNAPSHOTS.
  assert.match(PAGES, /const DIALOG_TITLES = Object\.fromEntries\(DIALOG_SNAPSHOTS\.map\(\(\{id, title\}\) => \[id, title\]\)\);/);
});

// The visual spec's PAGE_WINDOWS lists every page window in the view's
// order: each size's Today windows, then Climate's, Energy's, the Car's and
// Home status's, each list read from the view's source.
test('the visual spec’s PAGE_WINDOWS lists every window the pages view draws, in its order', () => {
  const spec = read('frontend/maison/visual/maison.visual.spec.mjs').match(/^const PAGE_WINDOWS = \[([\s\S]*?)\];$/m)?.[1];
  const today = Object.fromEntries([...PAGES.matchAll(/\{size: '(\w+)',[^}]*pages: \[([^\]]*)\]\}/g)].map(([, size, list]) => [size, ids(list)]));
  const named = (sizes, prefix = '') => Object.entries(sizes).flatMap(([size, list]) => list.map(id => `${size}-${prefix}${id}`));
  assert.deepEqual(ids(spec), [...named(today), ...named(windowsOf('CLIMATE_WINDOWS')), ...named(windowsOf('ENERGY_WINDOWS')), ...named(windowsOf('CAR_WINDOWS')),
    ...named(windowsOf('SYSTEM_WINDOWS'), 'system-')]);
});

// Life leaves the gallery (v35): no example builds on its page, and no
// dialog body comes from the old renderer; the card sheet is the full calendar.
test('the gallery draws nothing of Life, and its dialogs are Maison’s', () => {
  const gallery = ['frames', 'lists', 'sheets', 'pages'].map(name => [name, read(`frontend/maison/src/gallery/${name}.jsx`)]);
  for (const [name, source] of gallery) {
    assert.doesNotMatch(source, /'life'|\blife\./, `${name} builds nothing on Life`);
    assert.doesNotMatch(source, /from '\.\.\/\.\.\/dialogs\.jsx'/, `${name} takes no old dialog body`);
  }
  const sheets = read('frontend/maison/src/gallery/sheets.jsx');
  assert.match(sheets, /^import \{DIALOGS\} from '\.\.\/dialogs\.jsx';$/m);
  assert.match(sheets, /const Body = DIALOGS\[value\.kind\];/);
  assert.match(sheets, /card: screen\(dialogSnapshot\('calendar'\)\)\.dialog,/);
  assert.doesNotMatch(read('frontend/maison/src/gallery/frames.jsx'), /\blife\b/i);
});
