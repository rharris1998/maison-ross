// What Maison shows (#27): screen(snapshot) works out everything on screen as
// plain values, and React draws them: the chrome (the navigation, the
// greeting, the sky and header chart, the offline banner and the action
// status line), the page, its drawer (a Climate drawer or, from v33, an
// Energy sheet, or from v34 a Car sheet) and the dialog. Every page is drawn
// from values. The element, the tests and the gallery all call this, and
// nothing else, to know what is shown. It never reads the element, never
// calls Date.now() and never throws for missing state: every value comes from
// the snapshot. NAV, TITLES and PAGE_IDS are the one list of pages; the
// element routes by PAGE_IDS.
//
// The kit is the one place a value's controls are decided. allowed() says
// whether a press would go through now: guard(intent, snapshot) allows it, and
// online and busy, which belong to the action lifecycle and not the guard,
// don't stop it. A control is enabled exactly then, and the element's
// command() sends exactly then; while its own request is in flight it also
// says busy. A value carries the feedback lines it draws, read from the
// snapshot. A link is a navigation and is always enabled, except `more` for
// an entity Home Assistant doesn't have.
import {CALENDARS} from './model.js?v=38';
import {guard} from './guard.js?v=38';
import {CLIMATE_DETAILS, climatePageValue, climateDrawerValue, climateHistory, climateHeader} from './climate.js?v=38';
import {CAR_DETAILS, carPageValue, carDrawerValue, carHeader} from './car.js?v=38';
import {todayPageValue, todayHeader, eventDialogValue} from './today.js?v=38';
import {POWER_HISTORY, ENERGY_DETAILS, energyPageValue, energyDrawerValue, energyHeader} from './energy.js?v=38';
import {NO_ALERTS, alertRows, systemPageValue} from './system.js?v=38';
import {skyValue} from './sky.js?v=38';

/** The guard's action for `intent` when it can go through now: online, allowed and not already in flight. Otherwise null. */
export function allowed(intent, snap) {
  const action = guard(intent, snap);
  return snap.online && action !== null && !snap.busy.has(action.key) ? action : null;
}
/**
 * A write or draft control: `{intent, ...extra, enabled}`, and `busy: true`
 * with `busyLabel: 'In progress'` while its request is in flight: online,
 * allowed by the guard and its key busy, so the button keeps its focus while
 * it waits and says so (#29 step 4). Controls that share a key wait together.
 * Otherwise there is neither key, and no extra can set one.
 */
export function control(intent, snap, extra = {}) {
  const action = guard(intent, snap), {busy, busyLabel, ...rest} = extra, inFlight = snap.online && action !== null && snap.busy.has(action.key);
  return {intent, ...rest, enabled: allowed(intent, snap) !== null, ...(inFlight ? {busy: true, busyLabel: 'In progress'} : {})};
}
/** A navigation: `{intent, ...extra, enabled}`. */
export function link(intent, snap, extra = {}) {
  return {intent, ...extra, enabled: intent.command !== 'more' || Boolean(snap.states[intent.entity])};
}
/** The kit a page's value builders take, bound to one snapshot. */
export function kit(snap) {
  return {control: (intent, extra) => control(intent, snap, extra), link: (intent, extra) => link(intent, snap, extra)};
}

// The pages in the navigation's order, as [id, label, icon]. Home status is
// opened from the header's tools instead. The tab glyphs are filled, as iOS
// draws a tab bar.
export const NAV = Object.freeze([['today', 'Today', 'tab-today'], ['climate', 'Climate', 'tab-climate'], ['car', 'Car', 'tab-car'],
  ['energy', 'Energy', 'tab-energy']].map(item => Object.freeze(item)));
// Each page's heading; Today's greets instead.
export const TITLES = Object.freeze({climate: 'Climate', car: 'Car', energy: 'Energy', system: 'Home status'});
// Every page there is a route to.
export const PAGE_IDS = Object.freeze([...NAV.map(([id]) => id), 'system']);
// Each page's value, by route.
const PAGES = Object.freeze({today: todayPageValue, climate: climatePageValue, car: carPageValue,
  energy: energyPageValue, system: systemPageValue});
// Each page's header (#29 step 3): the line under its title and the chart
// in its hero. Home status has neither.
const HEADERS = Object.freeze({today: todayHeader, climate: climateHeader, energy: energyHeader, car: carHeader});
const header = (snap, page) => Object.hasOwn(HEADERS, page) ? HEADERS[page](snap) : {line: null, hero: null};

/**
 * @typedef {{navLabel: 'Dashboard', nav: {link: Link, label: string, icon: string, current: boolean}[], alerts: Link, status: Link,
 *   date: string, title: string, sky: Sky, line: string|null, hero: Hero|null,
 *   offline: {title: string, description: string}|null, actionStatus: string}} Chrome
 *   navLabel names the page navigation. alerts and status are the header's icon-only tools, named by ariaLabel and
 *   drawn with their icon.
 *   title greets on Today ('Good afternoon, Alex') and names every other page. actionStatus is the
 *   status line under the header, hidden while ''.
 *   sky is sky.js's Sky (#29 step 3), on every page. line is the line under the title and hero the header chart,
 *   from the page's header builder (todayHeader, climateHeader, energyHeader, carHeader); Home status has neither
 *   (null).
 * @typedef {WeatherHero|ZonesHero|FlowsHero|CarHero} Hero
 *   Told apart by kind ('weather', 'zones', 'flows', 'car'): today.js's, climate.js's, energy.js's and car.js's.
 * @typedef {{kind: 'alerts', title: 'Home alerts', eyebrow: 'Maison', rows: object[], empty: string[]|null, status: Link, close: Link}
 *   | EventDialog & {close: Link}
 *   | {kind: 'native', title: string, eyebrow: 'Maison', native: Native, close: Link}} Dialog
 *   rows are system.js's AlertRows; empty is two lines, drawn with a break, while there are none.
 *   EventDialog is today.js's. close is what dismissing the dialog sends.
 * @typedef {{key: string, config: object}} Native
 *   The Home Assistant card the element mounts in the slot named `key`, from `config`.
 */

/**
 * A 24-hour chart's definition by key: the Energy page's power, or one of a
 * Climate drawer's. null for a chart there isn't, as when Home Assistant has
 * none of its readings.
 * @param {object} states
 * @param {string} key
 * @returns {{key: string, group: string, ids: string[], labels: string[], title: string}|null}
 */
export function historyDefinition(states, key) {
  return key === 'power' ? POWER_HISTORY : climateHistory(states).find(chart => chart.key === key) ?? null;
}

// The hour and date are Home Assistant's, from the snapshot's time.
const greeting = hour => hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
function chromeValue(snap, kit, page) {
  const {tz, online} = snap, now = new Date(snap.now), user = snap.user ? String(snap.user) : '';
  const hour = Number(new Intl.DateTimeFormat('en-GB', {hour: 'numeric', hourCycle: 'h23', timeZone: tz}).format(now));
  return {
    navLabel: 'Dashboard',
    nav: NAV.map(([id, label, icon]) => ({link: kit.link({command: 'navigate', entity: id}), label, icon, current: id === page})),
    alerts: kit.link({command: 'alerts'}, {ariaLabel: 'Home alerts', icon: 'alert'}),
    status: kit.link({command: 'navigate', entity: 'system'}, {ariaLabel: 'Home status', icon: 'settings'}),
    date: new Intl.DateTimeFormat('en-GB', {weekday: 'long', day: 'numeric', month: 'long', timeZone: tz}).format(now),
    title: page === 'today' ? `${greeting(hour)}${user ? ', ' + user.split(' ')[0] : ''}` : TITLES[page],
    sky: skyValue(snap.states),
    ...header(snap, page),
    offline: online ? null : {title: 'Connection interrupted', description: 'Last received readings are shown. Device controls resume when Home Assistant reconnects.'},
    actionStatus: snap.status ?? '',
  };
}

// The household alerts, and the way to Home status.
function alertsDialog(snap, kit) {
  const rows = alertRows(snap, kit);
  return {kind: 'alerts', title: 'Home alerts', eyebrow: 'Maison', rows,
    empty: rows.length ? null : NO_ALERTS,
    status: kit.link({command: 'navigate', entity: 'system'}, {label: 'Home status', icon: 'settings'})};
}
// Home Assistant's own cards in a dialog: the full calendar, or a chart's
// full history.
function nativeDialog(snap, {native, chart}) {
  const card = (title, key, config) => ({kind: 'native', title, eyebrow: 'Maison', native: {key, config}});
  if (native === 'calendar') return card('Full calendar', 'calendar-full', {type: 'calendar', initial_view: 'listWeek', entities: [...CALENDARS]});
  const definition = native === 'history' ? historyDefinition(snap.states, chart) : null;
  return definition && card(definition.title, 'history-full-' + definition.key,
    {type: 'history-graph', hours_to_show: 24, entities: definition.ids.map((entity, i) => ({entity, name: definition.labels[i]}))});
}
function dialogValue(snap, kit) {
  const open = snap.route.dialog;
  const value = open?.kind === 'alerts' ? alertsDialog(snap, kit) : open?.kind === 'event' ? eventDialogValue(snap, kit, open.event)
    : open?.kind === 'native' ? nativeDialog(snap, open) : null;
  return value && {...value, close: kit.link({command: 'close'})};
}

// The pages with drawers, each as [the details #<page>/<id> can open, the
// builder of their Drawer value]: Climate's (#21) and, from v33, Energy's
// sheets and, from v34, the Car's (#29 step 4).
const DRAWERS = Object.freeze({climate: [CLIMATE_DETAILS, climateDrawerValue], energy: [ENERGY_DETAILS, energyDrawerValue],
  car: [CAR_DETAILS, carDrawerValue]});
// The page's drawer while the route's detail is one of its own, which
// closes with `close detail`; null otherwise.
function drawerValue(snap, bound, page, detail) {
  if (!Object.hasOwn(DRAWERS, page)) return null;
  const [details, value] = DRAWERS[page];
  return details.some(({id}) => id === detail) ? {...value(snap, bound, detail), close: bound.link({command: 'close', entity: 'detail'})} : null;
}

/**
 * Everything on screen: the chrome, the page, its drawer (a Climate drawer,
 * an Energy sheet or a Car sheet, by the route's detail) and the dialog. A
 * route to no page shows Today, as the element does.
 * @returns {{chrome: Chrome, page: object, drawer: object|null, dialog: Dialog|null}}
 */
export function screen(snap) {
  const bound = kit(snap), {detail} = snap.route, page = Object.hasOwn(PAGES, snap.route.page) ? snap.route.page : 'today';
  return {
    chrome: chromeValue(snap, bound, page),
    page: PAGES[page](snap, bound),
    drawer: drawerValue(snap, bound, page, detail),
    dialog: dialogValue(snap, bound),
  };
}

// ---- Test helpers --------------------------------------------------------
// Both walk a value depth-first, in property and array order. An object with an
// `intent` is a control or a link: the walk stops at it.
const isAction = value => value !== null && typeof value === 'object' && !Array.isArray(value) && 'intent' in value;

/** Every control and link in reading order. */
export function controls(value) {
  const found = [];
  const walk = node => {
    if (node === null || typeof node !== 'object') return;
    if (isAction(node)) {
      const {command, entity, direction} = node.intent;
      found.push({command, entity, direction, label: node.label ?? node.ariaLabel, enabled: node.enabled, selected: node.selected});
      return;
    }
    for (const child of Array.isArray(node) ? node : Object.values(node)) walk(child);
  };
  walk(value);
  return found;
}

// Keys that hold no visible wording: identities, variants, geometry, a
// chart's plot and whole `model`, history.js's data for the chart component
// (status, time zone, series keys and units), which the history tests cover,
// a Home Assistant card's `config`, and a widget's `size` (#29 step 4).
// Keys ending in Label are accessible names only.
const STRUCTURAL = new Set(['id', 'kind', 'key', 'icon', 'tone', 'width', 'min', 'max', 'plot', 'model', 'config', 'size']);
// A line with strong parts, such as the Airco's heat source: one line.
const isRich = node => node.some(part => part !== null && typeof part === 'object' && typeof part.strong === 'string')
  && node.every(part => typeof part === 'string' || (part !== null && typeof part === 'object' && typeof part.strong === 'string'));

/** The visible wording, one block per line; empty strings are not lines. */
export function words(value) {
  const lines = [];
  const add = text => {if (typeof text === 'string' && text) lines.push(text);};
  const walk = node => {
    if (typeof node === 'string') return add(node);
    if (node === null || typeof node !== 'object') return;
    if (isAction(node)) return add(node.label);
    if (Array.isArray(node)) return isRich(node) ? add(node.map(part => typeof part === 'string' ? part : part.strong).join('')) : node.forEach(walk);
    for (const [key, child] of Object.entries(node)) if (!STRUCTURAL.has(key) && !key.endsWith('Label')) walk(child);
  };
  walk(value);
  return lines;
}
