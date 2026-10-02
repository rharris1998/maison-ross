// Maison's chrome and dialogs (#27): the navigation, the date and greeting,
// the header's tools, the offline banner and the action status line, and
// each dialog screen() opens from the route, as React draws them. Every test
// reads the value through controls() and words(), never HTML. How the
// element opens and closes a dialog is in maison-dashboard.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {E, CALENDARS} from '../config/www/maison/model.js';
import {POWER_HISTORY, ENERGY_DETAILS} from '../config/www/maison/energy.js';
import {CAR_DETAILS} from '../config/www/maison/car.js';
import {alertRows} from '../config/www/maison/system.js';
import {climateHistory} from '../config/www/maison/climate.js';
import {screen, controls, words, kit, historyDefinition, NAV, TITLES, PAGE_IDS} from '../config/www/maison/screen.js';
import {HOME_FIXTURES, HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';

const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const fixture = id => structuredClone(HOME_FIXTURES.find(f => f.id === id));
const state = (value, attributes = {}) => ({state: String(value), attributes});
// A home fixture's snapshot on `page` with `dialog` open. `extra` is merged into it: online, now, tz, user, status.
const snapshot = (f, page = 'today', dialog = null, extra = {}) => fixtureSnapshot({now: HOME_NOW, ...extra, states: f.states, route: {page, detail: null, dialog},
  loaded: {agenda: f.agenda, agendaLoading: f.agendaLoading, forecasts: f.forecasts}});
const chrome = (f, page, extra) => screen(snapshot(f, page, null, extra)).chrome;
const dialog = (f, value, extra) => screen(snapshot(f, 'today', value, extra)).dialog;
const intentOf = link => [link.intent.command, link.intent.entity];
// Sunday 27 September 2026 at hh:mm in Brussels (summer time, UTC+2).
const brussels = (hh, mm = 0) => Date.UTC(2026, 8, 27, hh - 2, mm);
const CLOSE = {intent: {command: 'close'}, enabled: true};

test('screen() is the chrome, the page, the drawer and the dialog, and nothing else', () => {
  assert.deepEqual(Object.keys(screen(snapshot(fixture('full')))), ['chrome', 'page', 'drawer', 'dialog']);
});

// ---- The navigation ------------------------------------------------------------------
test('the navigation lists the four pages in order and marks the one shown', () => {
  assert.deepEqual(NAV.map(item => [...item]), [['today', 'Today', 'tab-today'], ['climate', 'Climate', 'tab-climate'], ['car', 'Car', 'tab-car'], ['energy', 'Energy', 'tab-energy']]);
  assert.deepEqual([...PAGE_IDS], ['today', 'climate', 'car', 'energy', 'system'], 'Home status has a route but no tab');
  assert.ok(Object.isFrozen(NAV) && NAV.every(Object.isFrozen) && Object.isFrozen(TITLES) && Object.isFrozen(PAGE_IDS));
  for (const page of PAGE_IDS) {
    const {navLabel, nav} = chrome(fixture('full'), page);
    assert.equal(navLabel, 'Dashboard');
    assert.deepEqual(nav.map(n => [n.label, n.icon, ...intentOf(n.link), n.link.enabled]), NAV.map(([id, label, icon]) => [label, icon, 'navigate', id, true]), page);
    assert.deepEqual(nav.filter(n => n.current).map(n => n.link.intent.entity), page === 'system' ? [] : [page], page);
  }
  assert.deepEqual(chrome(fixture('full'), 'nowhere').nav.filter(n => n.current).map(n => n.label), ['Today'], 'a route to no page shows Today');
});

test('the header’s tools open the home alerts and Home status, each named and drawn with its icon', () => {
  const {alerts, status} = chrome(fixture('full'), 'energy', {online: false});
  assert.deepEqual(alerts, {intent: {command: 'alerts'}, ariaLabel: 'Home alerts', icon: 'alert', enabled: true});
  assert.deepEqual(status, {intent: {command: 'navigate', entity: 'system'}, ariaLabel: 'Home status', icon: 'settings', enabled: true});
});

// ---- The date and greeting ------------------------------------------------------------
test('the date line is the snapshot’s day in Home Assistant’s time zone', () => {
  assert.equal(chrome(fixture('full'), 'energy').date, 'Sunday 27 September');
  // Midnight in Brussels is still 22:00 on Sunday in UTC.
  const midnight = HOME_NOW + 11.5 * HOUR;
  assert.equal(chrome(fixture('full'), 'energy', {now: midnight}).date, 'Monday 28 September');
  assert.equal(chrome(fixture('full'), 'energy', {now: midnight, tz: 'UTC'}).date, 'Sunday 27 September');
});

test('Today greets by the hour in Home Assistant’s time zone; every other page is named', () => {
  const greet = (now, extra = {}) => chrome(fixture('full'), 'today', {now, user: 'Alex Martin', ...extra}).title;
  assert.equal(greet(HOME_NOW), 'Good afternoon, Alex');
  assert.deepEqual([[0, 30], [11, 59], [12, 0], [17, 59], [18, 0], [23, 59]].map(([h, m]) => greet(brussels(h, m))),
    ['Good morning, Alex', 'Good morning, Alex', 'Good afternoon, Alex', 'Good afternoon, Alex', 'Good evening, Alex', 'Good evening, Alex']);
  assert.equal(greet(HOME_NOW, {tz: 'UTC'}), 'Good morning, Alex', '10:30 in UTC');
  assert.equal(greet(HOME_NOW, {user: null}), 'Good afternoon', 'no user, no name');
  assert.equal(greet(HOME_NOW, {user: 'Sam'}), 'Good afternoon, Sam');
  for (const [page, title] of Object.entries({climate: 'Climate', car: 'Car', energy: 'Energy', system: 'Home status'})) {
    assert.equal(TITLES[page], title);
    assert.equal(chrome(fixture('full'), page, {user: 'Alex Martin'}).title, title, page);
  }
});

// ---- Connection and status ---------------------------------------------------------------------
test('offline, a banner says so; online, none', () => {
  const online = chrome(fixture('full'), 'energy'), offline = chrome(fixture('full'), 'energy', {online: false});
  assert.equal(online.offline, null);
  assert.deepEqual(offline.offline, {title: 'Connection interrupted', description: 'Last received readings are shown. Device controls resume when Home Assistant reconnects.'});
});

test('the action status line is the element’s latest, hidden while empty', () => {
  assert.equal(chrome(fixture('full'), 'system', {status: 'Roborock S8 Pro Ultra · waiting for device update…'}).actionStatus, 'Roborock S8 Pro Ultra · waiting for device update…');
  assert.equal(chrome(fixture('full'), 'system').actionStatus, '');
  assert.ok(!words(chrome(fixture('full'), 'system')).includes(''));
});

test('the chrome only navigates: every control is a link, the same online or offline', () => {
  for (const f of HOME_FIXTURES) {
    const online = controls(chrome(f, 'today')), offline = controls(chrome(f, 'today', {online: false}));
    assert.deepEqual([...new Set(online.map(c => c.command))].sort(), ['alerts', 'navigate'], f.id);
    assert.deepEqual(offline, online, f.id);
  }
  // The line and header chart are wording too; the sky has none.
  assert.deepEqual(words(chrome(fixture('full'), 'energy', {online: false})), ['Today', 'Climate', 'Car', 'Energy', 'Sunday 27 September', 'Energy',
    'Peak now · exporting', 'Solar', '2.84 kW', 'Export', '1.52 kW', 'House', '1.32 kW', 'Car', '—', '0.341', '€/kWh from the grid', 'All-in: supplier, network, levies and VAT.',
    'Connection interrupted', 'Last received readings are shown. Device controls resume when Home Assistant reconnects.']);
});

// ---- Dialogs --------------------------------------------------------------------------------
test('no dialog, or one Maison doesn’t know, is none', () => {
  // The shopping list left with Life (v35).
  for (const value of [null, undefined, {kind: 'html', title: 'Home alerts'}, {kind: 'native', native: 'weather'}, {kind: 'native', native: 'shopping'},
    {kind: 'native', native: 'history', chart: 'nowhere'}, {kind: 'native', native: 'history'}])
    assert.equal(dialog(fixture('full'), value), null, JSON.stringify(value));
});

test('the home alerts dialog lists Home status’s alerts and leads there', () => {
  const f = fixture('full'), value = dialog(f, {kind: 'alerts'}), snap = snapshot(f, 'today', {kind: 'alerts'});
  assert.deepEqual([value.kind, value.title, value.eyebrow, value.empty], ['alerts', 'Home alerts', 'Maison', null]);
  assert.deepEqual(value.rows, alertRows(snap, kit(snap)));
  assert.deepEqual(value.rows.map(r => `${r.title} · ${r.detail}`), ['Vacuum filter needs cleaning · Maintenance interval reached', 'Hallway motion battery\u00a0·\u00a012% · Battery running low']);
  assert.deepEqual(value.status, {intent: {command: 'navigate', entity: 'system'}, label: 'Home status', icon: 'settings', enabled: true});
  assert.deepEqual(value.close, CLOSE);
  const quiet = dialog(fixture('quiet'), {kind: 'alerts'});
  assert.deepEqual([quiet.rows, quiet.empty], [[], ['No household alerts right now.', 'Device availability is listed separately in Home status.']]);
  assert.deepEqual(words(quiet), ['Home alerts', 'Maison', 'No household alerts right now.', 'Device availability is listed separately in Home status.', 'Home status']);
});

test('an event dialog says when, where, what and from which calendar', () => {
  const [lunch, , dentist] = fixture('full').agenda.events;
  const value = dialog(fixture('full'), {kind: 'event', event: lunch});
  assert.deepEqual(value, {kind: 'event', title: 'Lunch with Sam', eyebrow: 'Calendar',
    date: 'Sunday 27 September · 13:00–14:30', location: 'Chez Léon', description: 'Table by the window.',
    calendar: 'Alex personal', full: {intent: {command: 'native-calendar'}, label: 'Full calendar', icon: 'life', enabled: true}, close: CLOSE});
  const other = dialog(fixture('full'), {kind: 'event', event: dentist});
  assert.deepEqual([other.date, other.location, other.description, other.calendar],
    ['Monday 28 September · 14:30–15:30', 'Rue de la Loi 12', null, 'Sam personal']);
  // A calendar Home Assistant names goes by its name.
  const named = {...fixture('full'), states: {...fixture('full').states, 'calendar.alex_personal': {entity_id: 'calendar.alex_personal', ...state('on', {friendly_name: 'Alex’s diary'})}}};
  assert.equal(dialog(named, {kind: 'event', event: lunch}).calendar, 'Alex’s diary');
  assert.equal(dialog(fixture('full'), {kind: 'event', event: lunch}, {tz: 'UTC'}).date, 'Sunday 27 September · 11:00–12:30');
  assert.deepEqual(words(value), ['Lunch with Sam', 'Calendar', 'Sunday 27 September · 13:00–14:30', 'Chez Léon', 'Table by the window.', 'Alex personal', 'Full calendar']);
});

test('an all-day event reads All day, names its last day when longer, and says when its calendar was partial', () => {
  const [, park] = fixture('full').agenda.events;
  const value = dialog(fixture('full'), {kind: 'event', event: park});
  assert.deepEqual([value.title, value.date, value.location, value.description, value.calendar], ['Recycling park', 'Monday 28 September · All day', null, null,
    'Kids · Current-event fallback; the full calendar could not be loaded.']);
  const long = {...park, partial: false, endMs: park.startMs + 3 * DAY};
  assert.deepEqual([dialog(fixture('full'), {kind: 'event', event: long}).date, dialog(fixture('full'), {kind: 'event', event: long}).calendar],
    ['Monday 28 – Wednesday 30 September · All day', 'Kids']);
});

// The date reads as a person says it (v35): the day, then the times or All
// day; both ends when it runs into another day or month; the year only when
// it isn't this one's.
test('an event dialog’s date names its day and times, both ends over several days, and a year only when it isn’t this one', () => {
  const date = (start, end, allDay = false) => dialog(fixture('full'), {kind: 'event', event: {summary: 'Trip', startMs: Date.parse(start), endMs: Date.parse(end), allDay}}).date;
  assert.equal(date('2026-09-27T13:00:00+02:00', '2026-09-28T10:00:00+02:00'), 'Sunday 27 September 13:00 – Monday 28 September 10:00');
  assert.equal(date('2026-09-27T22:00:00+02:00', '2026-09-28T00:00:00+02:00'), 'Sunday 27 September · 22:00–00:00', 'ending at midnight is the same day');
  assert.equal(date('2026-09-30T00:00:00+02:00', '2026-10-03T00:00:00+02:00', true), 'Wednesday 30 September – Friday 2 October · All day');
  assert.equal(date('2027-01-01T09:00:00+01:00', '2027-01-01T10:00:00+01:00'), 'Friday 1 January 2027 · 09:00–10:00');
  assert.equal(date('2026-12-31T00:00:00+01:00', '2027-01-02T00:00:00+01:00', true), 'Thursday 31 December – Friday 1 January 2027 · All day');
  assert.equal(date('2027-03-01T00:00:00+01:00', '2027-03-03T00:00:00+01:00', true), 'Monday 1 – Tuesday 2 March 2027 · All day');
});

test('an event dialog is raw text, and none for an event without a readable time', () => {
  const [lunch] = fixture('full').agenda.events;
  const odd = {...lunch, summary: '<img src=x onerror=run()>', location: 'School & gym', description: '<b>Bring</b> & share'};
  const value = dialog(fixture('full'), {kind: 'event', event: odd});
  assert.deepEqual([value.title, value.location, value.description], ['<img src=x onerror=run()>', 'School & gym', '<b>Bring</b> & share']);
  for (const event of [{...lunch, startMs: NaN}, {...lunch, endMs: undefined}, null, undefined])
    assert.equal(dialog(fixture('full'), {kind: 'event', event}), null, JSON.stringify(event));
  const nameless = dialog(fixture('full'), {kind: 'event', event: {startMs: lunch.startMs, endMs: lunch.endMs}});
  assert.deepEqual([nameless.title, nameless.calendar], ['', 'No reading'], 'nothing is made up');
});

test('the full calendar opens Home Assistant’s own card', () => {
  assert.deepEqual(dialog(fixture('full'), {kind: 'native', native: 'calendar'}), {kind: 'native', title: 'Full calendar', eyebrow: 'Maison',
    native: {key: 'calendar-full', config: {type: 'calendar', initial_view: 'listWeek', entities: CALENDARS}}, close: CLOSE});
  // A card's config is not wording.
  assert.deepEqual(words(dialog(fixture('missing'), {kind: 'native', native: 'calendar'})), ['Full calendar', 'Maison']);
});

test('a chart’s full history opens Home Assistant’s history card for that chart’s readings', () => {
  assert.deepEqual(dialog(fixture('missing'), {kind: 'native', native: 'history', chart: 'power'}), {kind: 'native', title: 'Power through the day', eyebrow: 'Maison',
    native: {key: 'history-full-power', config: {type: 'history-graph', hours_to_show: 24,
      entities: [{entity: E.load, name: 'Home'}, {entity: E.solar, name: 'Solar'}, {entity: E.grid, name: 'Grid'}]}}, close: CLOSE});
  const states = structuredClone(CLIMATE_FIXTURES[0].states), attic = climateHistory(states).find(h => h.key === 'climate-attic-temperature');
  const value = screen(fixtureSnapshot({states, route: {page: 'climate', detail: 'attic', dialog: {kind: 'native', native: 'history', chart: attic.key}}})).dialog;
  assert.deepEqual([value.title, value.native.key, value.native.config.entities], [attic.title, 'history-full-climate-attic-temperature',
    attic.ids.map((entity, i) => ({entity, name: attic.labels[i]}))]);
  // A Climate chart Home Assistant has none of the readings for is no chart.
  assert.equal(screen(fixtureSnapshot({route: {page: 'climate', dialog: {kind: 'native', native: 'history', chart: attic.key}}})).dialog, null);
});

test('historyDefinition names the Energy chart and each Climate drawer’s, and nothing else', () => {
  const states = structuredClone(CLIMATE_FIXTURES[0].states);
  assert.deepEqual(historyDefinition({}, 'power'), POWER_HISTORY);
  for (const h of climateHistory(states)) assert.deepEqual(historyDefinition(states, h.key), h, h.key);
  for (const key of ['nowhere', '', undefined, 'climate-attic-temperature']) assert.equal(historyDefinition({}, key), null, String(key));
});

test('every dialog closes with close, and only opens or navigates', () => {
  const [lunch] = fixture('full').agenda.events;
  const kinds = [{kind: 'alerts'}, {kind: 'event', event: lunch}, {kind: 'native', native: 'calendar'}, {kind: 'native', native: 'history', chart: 'power'}];
  for (const f of HOME_FIXTURES) for (const value of kinds) for (const online of [true, false]) {
    const shown = dialog(f, value, {online});
    assert.deepEqual(shown.close, CLOSE, `${f.id} ${value.kind}`);
    for (const c of controls(shown)) assert.ok(['close', 'more', 'navigate', 'native-calendar'].includes(c.command), `${f.id} ${value.kind}: ${c.command}`);
  }
});

test('the Climate drawer closes with close detail, apart from any dialog', () => {
  const states = structuredClone(CLIMATE_FIXTURES[0].states);
  const {drawer, dialog: open} = screen(fixtureSnapshot({states, route: {page: 'climate', detail: 'attic', dialog: {kind: 'alerts'}}}));
  assert.deepEqual(drawer.close, {intent: {command: 'close', entity: 'detail'}, enabled: true});
  assert.deepEqual(open.close, CLOSE);
});

// Energy's sheets (v33) close as Climate's drawers do, and the chrome over
// one is the Energy page's: its title, its header and its tab.
test('each Energy sheet closes with close detail, apart from any dialog, under Energy’s own chrome', () => {
  for (const f of HOME_FIXTURES) for (const online of [true, false]) {
    const plain = screen(snapshot(f, 'energy', null, {online})).chrome;
    for (const {id} of ENERGY_DETAILS) {
      const {chrome: shown, drawer, dialog: open} = screen(fixtureSnapshot({now: HOME_NOW, online, states: f.states, route: {page: 'energy', detail: id, dialog: {kind: 'alerts'}}}));
      assert.deepEqual(drawer.close, {intent: {command: 'close', entity: 'detail'}, enabled: true}, `${f.id} ${id}`);
      assert.deepEqual(open.close, CLOSE, `${f.id} ${id}`);
      assert.deepEqual(shown, plain, `${f.id} ${id}: the chrome is the page's`);
      assert.deepEqual(shown.nav.filter(n => n.current).map(n => n.label), ['Energy']);
    }
  }
});

// The Car's sheets (v34) close as Energy's do, and the chrome over one is
// the Car page's: its title, its header line and hero, and its tab.
test('each Car sheet closes with close detail, apart from any dialog, under the Car’s own chrome', () => {
  for (const f of [...CAR_FIXTURES, ...CAR_PAGE_FIXTURES]) for (const online of [true, false]) {
    const on = (detail, open) => screen(fixtureSnapshot({now: CAR_NOW, online, carLast: f.last ?? null, states: f.states, route: {page: 'car', detail, dialog: open}}));
    const plain = on(null, null).chrome;
    for (const {id} of CAR_DETAILS) {
      const {chrome: shown, drawer, dialog: open} = on(id, {kind: 'alerts'});
      assert.deepEqual(drawer.close, {intent: {command: 'close', entity: 'detail'}, enabled: true}, `${f.id} ${id}`);
      assert.deepEqual(open.close, CLOSE, `${f.id} ${id}`);
      assert.deepEqual(shown, plain, `${f.id} ${id}: the chrome is the page's`);
      assert.deepEqual([shown.title, shown.hero.kind, shown.nav.filter(n => n.current).map(n => n.label)], ['Car', 'car', ['Car']], `${f.id} ${id}`);
    }
  }
});
