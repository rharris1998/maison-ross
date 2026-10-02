// Home status (#27), route #system: what needs attention, which key devices
// have stopped reporting, every sensor Home Assistant shows this account, and
// the vacuum's maintenance intervals. It is a maintenance view, not a
// technical console: everyday controls stay on their own pages.
// It is plain data that React draws: screen.js hands it over, and the home
// alerts dialog takes alertRows() too. Every visible phrase is formatted here,
// so React composes no English, and every link comes from the injected kit,
// so React decides no enablement either. It reads only the snapshot (states,
// now, sensors), never the clock or the element: a sensor's update time is
// measured against snap.now. `label` is visible text; any key ending in Label
// is an accessible name only. Link and Kit are the typedefs in climate.js's
// value section.
import {E, MAINTENANCE, numeric, available, pretty, alerts, formatReading} from './model.js?v=38';
import {allReadings, freshness} from './data.js?v=38';

/**
 * @typedef {{id: 'system', needs: SystemNeeds, devices: SystemDevices, vacuum: SystemVacuum, sensors: Sensors,
 *   homeAssistant: SystemHomeAssistant}} SystemPage
 * @typedef {{link: Link, icon: string, tone: 'amber', title: string, detail: string}} AlertRow
 *   A household alert, opening its entity; tone colours the icon.
 * @typedef {{title: 'Needs attention', rows: AlertRow[], empty: string|null}} SystemNeeds
 *   empty is the one quiet line drawn when there is no alert.
 * @typedef {{title: 'Key devices', rows: AlertRow[], line: string|null, note: string}} SystemDevices
 *   rows: the unavailable key devices, each with icon 'plug', link null for one Home Assistant doesn't
 *   have; line says all of them report, while none is unavailable.
 * @typedef {{title: 'Vacuum maintenance', rows: {link: Link, icon: 'vacuum', title: string, value: string, tone: 'orange'|null}[]}} SystemVacuum
 *   value is hours left, 'Under 1 h', 'Due' (tone orange) or '—'.
 * @typedef {{title: 'All sensors', count: string, search: Search, category: Category, summary: string,
 *   rows: Reading[], empty: string|null, more: Link|null, note: string}} Sensors
 *   count is every reading, whatever the filters; summary counts the matching ones. rows are the
 *   first snap.sensors.limit matches; more shows the next ones, and is null when none are left.
 * @typedef {{intent: {command: 'sensor-search'}, ariaLabel: string, placeholder: string, value: string, enabled: boolean}} Search
 *   The search field, holding snap.sensors.query; a change sends {...intent, value}.
 * @typedef {{intent: {command: 'sensor-category'}, ariaLabel: string, selected: string, options: {id: string, label: string}[], enabled: boolean}} Category
 *   The category select, showing the label of the option whose id is `selected`; a change sends {...intent, value: id}.
 * @typedef {{link: Link, icon: string, title: string, detail: string, value: string, unavailable: boolean}} Reading
 *   detail is when it last reported; value is 'Unavailable' when it has no reading, drawn muted.
 * @typedef {{title: 'Home Assistant', rows: {link: Link, icon: string, title: string, value: string|null}[]}} SystemHomeAssistant
 *   Settings (ha-settings, value null), then Core updates (more-info), whose value says whether an update
 *   waits: 'Up to date', '<latest_version> available', 'Installing…', or '—' while the update entity doesn't know.
 */

// The catalogue's categories, in the select's order. data.js files each
// reading under one of these ids, and under no other.
const CATEGORIES = [['all', 'All readings'], ['temperature', 'Temperature'], ['humidity', 'Humidity'], ['pressure', 'Pressure'], ['presence', 'Motion'],
  ['illuminance', 'Light level'], ['battery', 'Battery'], ['power', 'Power'], ['energy', 'Energy'], ['air-quality', 'Air quality'], ['opening', 'Doors & windows'],
  ['moisture', 'Moisture'], ['safety', 'Safety'], ['signal-strength', 'Signal strength'], ['other', 'Other']];
// The readings and controls whose absence breaks a page, checked by name.
const ESSENTIAL = [['Weather', E.weather], ['Grid meter', E.grid], ['Solar inverter', E.solar], ['Vacuum', E.vacuum], ['Airco', E.airco], ['Boiler pressure', E.boilerPressure]];

// Home Assistant's own update entity for Core.
const CORE_UPDATE = 'update.home_assistant_core_update';

const more = (kit, entity, extra) => kit.link({command: 'more', entity}, extra);

/** How many readings the catalogue shows at first, and how many more each Show more adds. */
export const SENSOR_PAGE = 60;
/** What the home alerts dialog says with no alert: two lines, drawn with a break. Needs attention says the first. */
export const NO_ALERTS = Object.freeze(['No household alerts right now.', 'Device availability is listed separately in Home status.']);

/** The icon a sensor category is drawn with. */
export const categoryIcon = category => ({temperature: 'climate', humidity: 'droplet', presence: 'motion', illuminance: 'sun', battery: 'battery', power: 'energy', energy: 'energy',
  opening: 'lock', 'air-quality': 'leaf', 'signal-strength': 'signal', pressure: 'climate', moisture: 'droplet', safety: 'alert'}[category] || 'info');
// A state that begins with an ISO date and time, as a timestamp sensor reports it.
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
/**
 * A reading in words: a binary sensor as what it means; a timestamp as the
 * day and time in Home Assistant's time zone, as a reading's detail says
 * when it reported ('30 Sept, 03:00'); a number to two decimals, grouped in
 * thousands, with its unit after a no-break space so the two never part.
 * @param {object} reading data.js's reading
 * @param {string} [timeZone] Home Assistant's time zone
 * @returns {string}
 */
export function readingValue(reading, timeZone = undefined) {
  if (!reading.available) return 'Unavailable';
  if (reading.domain === 'binary_sensor') {
    if (reading.category === 'presence') return reading.state === 'on' ? 'Motion detected' : 'No motion detected';
    if (reading.category === 'opening') return reading.state === 'on' ? 'Open' : 'Closed';
    return pretty(reading.state);
  }
  const time = reading.deviceClass === 'timestamp' || ISO_TIME.test(reading.state) ? new Date(reading.state) : null;
  if (time && Number.isFinite(time.getTime())) return time.toLocaleString('en-GB', {timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
  const n = numeric(reading.state);
  return `${n === null ? pretty(reading.state) : new Intl.NumberFormat('en-GB', {maximumFractionDigits: 2}).format(n)}${reading.unit ? '\u00a0' + reading.unit : ''}`;
}

/**
 * The household alerts, each opening its entity: Home status and the home
 * alerts dialog list the same rows.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @returns {AlertRow[]}
 */
export function alertRows(snap, kit) {
  return alerts(snap.states).map(a => ({link: more(kit, a.entity), icon: a.icon, tone: 'amber', title: a.title, detail: a.detail}));
}

// The key readings and controls that have stopped reporting, each opening
// its entity, and the note on what a missing one means.
function availabilityValue(snap, kit) {
  const unavailable = ESSENTIAL.filter(([, id]) => !available(snap.states[id]));
  return {rows: unavailable.map(([name, id]) => ({link: more(kit, id), icon: 'plug', tone: 'amber', title: name, detail: 'No current reading'})),
    note: 'Solar can stop reporting overnight. An unavailable reading is shown as missing, never as zero.'};
}
// A count grouped in thousands, as the readings are: '12,744'.
const count = n => new Intl.NumberFormat('en-GB').format(n);
// Every sensor and binary sensor, filtered by the viewer's search and
// category, a page at a time.
function sensorsValue(snap, kit) {
  const {states} = snap, query = snap.sensors?.query || '', category = snap.sensors?.category || 'all', limit = snap.sensors?.limit || SENSOR_PAGE;
  const readings = allReadings({states}, query, category);
  const rows = readings.slice(0, limit).map(r => ({link: more(kit, r.entityId), icon: categoryIcon(r.category), title: r.name,
    // When it last reported, not whether it is stale: an unchanged reading is no fault.
    detail: freshness(states[r.entityId], snap.now, snap.tz).label, value: readingValue(r, snap.tz), unavailable: !r.available}));
  return {title: 'All sensors', count: count(allReadings({states}).length),
    search: kit.link({command: 'sensor-search'}, {ariaLabel: 'Find a sensor', placeholder: 'Search sensors', value: query}),
    category: kit.link({command: 'sensor-category'}, {ariaLabel: 'Sensor category', selected: category, options: CATEGORIES.map(([id, label]) => ({id, label}))}),
    summary: `${count(readings.length)} matching ${readings.length === 1 ? 'reading' : 'readings'} · ${count(readings.filter(r => !r.available).length)} unavailable`,
    rows, empty: rows.length ? null : 'No sensors match these filters.',
    more: readings.length > limit ? kit.link({command: 'sensor-more'}, {label: `Show more (${count(readings.length - limit)} remaining)`, icon: 'plus'}) : null,
    note: 'Update times describe the last report. A reading that has not changed recently is not automatically a fault.'};
}
// Hours left on each consumable, to the hour: at or below zero it is due
// (and model.js's alert fires), and under an hour it says so rather than
// rounding to a 0 h that isn't due.
function hoursLeft(state) {
  const n = numeric(state?.state);
  return n === null ? '—' : n <= 0 ? 'Due' : n < 1 ? 'Under 1 h' : formatReading(state, 0, ' h');
}
// Each consumable, opening its sensor, with its hours left.
function maintenanceValue(snap, kit) {
  return MAINTENANCE.map(([title, id]) => ({link: more(kit, id, {ariaLabel: `${title} details`}), icon: 'vacuum', value: hoursLeft(snap.states[id]), title}));
}

// Needs attention: the household alerts, or one quiet line.
function needsValue(snap, kit) {
  const rows = alertRows(snap, kit);
  return {title: 'Needs attention', rows, empty: rows.length ? null : NO_ALERTS[0]};
}
// Key devices: the unavailable ones, or one line saying all of them report.
// One Home Assistant doesn't have has nothing to open, so its row has no
// link: a plain row, as urgent as the rest, not a dimmed press.
function devicesValue(snap, kit) {
  const {rows, note} = availabilityValue(snap, kit);
  return {title: 'Key devices', rows: rows.map(row => row.link.enabled ? row : {...row, link: null}),
    line: rows.length ? null : `All ${ESSENTIAL.length} key devices are reporting.`, note};
}
// The vacuum's consumables as rows: hours left, 'Due' (orange) or '—'.
function vacuumRowsValue(snap, kit) {
  return {title: 'Vacuum maintenance', rows: maintenanceValue(snap, kit).map(({link, icon, value, title}) =>
    ({link, icon, title, value, tone: value === 'Due' ? 'orange' : null}))};
}
// Whether a Core update waits, from its update entity: Home Assistant turns
// it on while latest_version is newer than installed_version and not
// skipped, so on names latest_version (or says it is installing, while
// in_progress: true, or a percentage on older versions) and off is up to
// date. Unknown, unavailable, missing, or on with no version to name: '—'.
function coreUpdateValue(state) {
  const {latest_version: latest, in_progress: progress} = state?.attributes ?? {};
  if (state?.state === 'off') return 'Up to date';
  if (state?.state !== 'on') return '—';
  if (progress === true || Number.isFinite(progress)) return 'Installing…';
  return typeof latest === 'string' && latest ? `${latest} available` : '—';
}
// The way into Home Assistant: its settings, then Core updates.
function homeAssistantValue(snap, kit) {
  return {title: 'Home Assistant', rows: [
    {link: kit.link({command: 'ha-settings'}), icon: 'settings', title: 'Settings', value: null},
    {link: more(kit, CORE_UPDATE), icon: 'home', title: 'Core updates', value: coreUpdateValue(snap.states[CORE_UPDATE])}]};
}

/**
 * Home status, in drawing order.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @returns {SystemPage}
 */
export function systemPageValue(snap, kit) {
  return {id: 'system', needs: needsValue(snap, kit), devices: devicesValue(snap, kit), vacuum: vacuumRowsValue(snap, kit),
    sensors: sensorsValue(snap, kit), homeAssistant: homeAssistantValue(snap, kit)};
}
