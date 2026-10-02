// The Today page (#27, #29 step 4): the home at a glance. The glance chips,
// Needs you, Coming up, the live power, the zones' readings (which open
// Climate), the Car's ring, today's energy, the vacuum's quiet line and the
// widgets they fill, and the dialog a calendar event opens. Today carries no
// climate control: the Climate page owns every one (#21).
// It is plain data that React draws: screen.js hands it over. Every visible
// phrase is formatted here, so React composes no English, and every control
// comes from the injected kit, so React decides no enablement either. It
// reads only the snapshot (states, now, tz, online, loaded, carLast), never
// the clock or the element. `label` is visible text; any key ending in Label
// is an accessible name only. Control, Link and Kit are the typedefs in
// climate.js's value section, CarGlance is car.js's and EnergyBreakdown is
// energy.js's.
import {E, BINS, numeric, available, pretty, alerts} from './model.js?v=38';
import {carGlanceValue, carStatus, clock} from './car.js?v=38';
import {climateHeader} from './climate.js?v=38';
import {energyHeader, energyBreakdown, GRID_ACTIVE_W} from './energy.js?v=38';

/**
 * @typedef {{id: 'today', vacuum: Vacuum, car: CarGlance, glance: Glance, needs: Needs|null, upcoming: Upcoming|null, live: Live,
 *   climate: TodayClimate, carRing: CarRing, energyToday: EnergyBreakdown, vacuumLine: VacuumLine|null, widgets: WidgetSlot[]}} TodayPage
 *   The Car widget reads `car` (its bar, headline, lastConfirmed and link), and the quiet line `vacuum`'s run and dock.
 * @typedef {{run: Control, dock: Control}} Vacuum
 *   run is Clean, Pause or Resume; run and dock carry the icon drawn before their label.
 * @typedef {{label: 'At a glance', items: GlanceItem[]}} Glance
 *   The phone's chips, Climate, Energy and Car in that order; label names the list.
 * @typedef {{id: 'climate'|'energy'|'car', icon: string, tone: 'temperature'|'yellow'|'indigo'|'green'|'gray', title: 'Climate'|'Energy'|'Car',
 *   line: string, link: Link}} GlanceItem
 *   Each opens its page (navigate), named in words by link.ariaLabel ('Climate: 22.7 to 24.2° inside. Open Climate',
 *   'Car: 42% at 10:00, waiting. Open Car'; a missing reading is 'no reading'). line: Climate the range of the zone
 *   readings ('22.7–24.2° inside', '22.7° inside'; tone 'temperature', drawn as the room scale, gray with no reading);
 *   Energy solar while it produces ('2.84 kW solar', yellow, icon sun), else the grid by Energy's 10 W threshold ('316 W
 *   from grid', indigo; '1.00 kW to grid', green; 'Grid idle', gray; icon grid), terse so the third chip peeks on a
 *   phone, where its name says 'the grid'; Car the battery and a short state
 *   from CAR_GLANCE_STATES ('62% · waiting'), 'Charging · 64%' (green) while the Car draws at the Charger, '42% at 10:00'
 *   while the level isn't live, or the state alone without a level ('Unplugged'). '—' with no reading.
 * @typedef {{title: 'Needs you', icon: 'alert', rows: AlertRow[], more: Link|null}} Needs
 *   null while nothing needs attention. The most urgent first: bins due today or tomorrow, then device errors, then the
 *   rest, each group in alerts() order. At most WIDGET_ROWS.medium rows; past it, the first row and `more`, the alerts
 *   dialog labelled '<n> more' and named '<n> more alerts. Open Home alerts'.
 * @typedef {{link: Link, icon: string, tone: 'orange', title: string, detail: string}} AlertRow
 *   One alert, opening its entity (more). detail is '' in place of the model's generic 'Open for details'.
 * @typedef {{title: 'Coming up', icon: 'life', loading: boolean, loadingLabel?: 'Loading the calendar', rows: UpcomingRow[],
 *   note: {text: string, link: Link}|null, more: Link|null}} Upcoming
 *   The events that haven't ended, in order, with the soonest collection two days or more away sorted among them by day,
 *   after that day's events (one due sooner is an alert, under Needs you). While loading there are no event rows and
 *   loadingLabel names the placeholder. note, only while not loading, says the calendar failed ('Some calendars could
 *   not be loaded' beside events, else 'Calendar could not be loaded') and opens the Full calendar (native-calendar),
 *   named '<text>. Open the full calendar'. null with no rows, not loading and no note. Its size (WidgetSlot) follows
 *   rows + 1 while loading or with a note, the loading row or note taking a row of its own; past that size's
 *   WIDGET_ROWS, the first rows and `more`, opening the Full calendar, labelled '<n> more' and named '<n> more coming
 *   up. Open the full calendar'. The collection is never hidden: past the room it is the last row shown, and <n>
 *   counts only the hidden events, which the Full calendar lists.
 * @typedef {{link: Link, icon: string, tone: 'gray', title: string, detail: string, value: string}} UpcomingRow
 *   An event opens its dialog (agenda-event, by its index in the agenda's events). A timed event: detail
 *   'Today', 'Tomorrow' or 'Mon 28 Sep', value its start ('07:00'); on now, 'Now · until 13:30' and value ''. An all-day
 *   one: 'Today · All day', 'Tomorrow · All day' or 'Wed 30 Sep · All day', or 'Until Thu' once it began on an earlier
 *   day, and value ''. The collection opens its bin's sensor (more): detail 'Collection in 3 days', value its weekday
 *   ('Wed'), or its date from 7 days ('Tue 6 Oct').
 * @typedef {{title: 'Power now', icon: string, tone: 'yellow'|'indigo'|'green'|'gray', figure: {value: string, unit: string}, line: string, link: Link}} Live
 *   Solar while it produces ('2.84' 'kW', 'Solar · exporting 1.61 kW', 'Solar · house 1.23 kW', or 'Solar' without a
 *   house reading), else the grid by Energy's 10 W threshold with the live register ('316' 'W', 'From the grid ·
 *   off-peak', indigo; 'To the grid · peak', green; 'Grid idle', gray), else {value: '—', unit: ''} and 'No power
 *   reading' (icon energy, gray). Opens Energy, named in one sentence ('Power now: 316 W from the grid, off-peak. Open
 *   Energy'). The only place Today says the register.
 * @typedef {{title: 'Climate', icon: 'climate', note: string|null, chart: ZonesHero, link: Link}} TodayClimate
 *   climateHeader's line and zone capsules (climate.js's ZonesHero), opening Climate, named by the line and the
 *   capsules' own ariaLabel ('Climate: Warming. Zone temperatures: Living 19.6°, target 20°; …. Open Climate').
 * @typedef {{icon: 'car', label: string, tone: 'green'|'gray'}} CarRing
 *   The Car's battery in the ring ('62%', '—'), green only while the Car draws at the Charger; its level and ticks are car.bar's.
 * @typedef {{icon: 'vacuum', text: string, active: boolean}} VacuumLine
 *   The vacuum in one line ('Roborock is docked, battery 100%', 'Roborock is cleaning · 40% done', 'Roborock is paused',
 *   'Roborock is returning to the dock', 'Roborock has stopped' on an error, which Needs you names, 'Roborock: no
 *   reading', else 'Roborock: <state>'); a part without a reading is left out. active while cleaning or paused, when
 *   the renderer draws vacuum.run and vacuum.dock with it. null only when Home Assistant has no vacuum.
 * @typedef {{id: 'needs'|'car'|'live'|'climate'|'upcoming'|'energyToday', size: 'small'|'medium'|'large'}} WidgetSlot
 *   The widgets from 700px, in drawing order, each absent field left out, sized so that every row of the grid fills.
 */

// The weather's name for Home Assistant's condition. Every hyphenated
// condition has its own name, so none prints as a slug.
const weatherName = state => ({partlycloudy: 'Partly cloudy', 'clear-night': 'Clear night', 'lightning-rainy': 'Thunderstorms', snowy: 'Snow', pouring: 'Heavy rain',
  'windy-variant': 'Windy and cloudy', 'snowy-rainy': 'Sleet'}[state] || pretty(state));
const zoned = (tz, options) => new Intl.DateTimeFormat('en-GB', {timeZone: tz, ...options});
const navigate = (kit, page, extra) => kit.link({command: 'navigate', entity: page}, extra);
// A forecast day or an event without a readable time is left out rather than
// drawn, so an odd reply from Home Assistant never stops the page.
const dated = ms => Number.isFinite(ms);
// The Full calendar: Home Assistant's own calendar card, in a dialog.
const fullCalendar = (kit, extra) => kit.link({command: 'native-calendar'}, extra);

// The Roborock's Clean, Pause or Resume and Dock, which its quiet line
// carries while it cleans or pauses. Its commands share one busy key, so
// both wait while one is sent.
function vacuumValue(snap, kit) {
  const state = snap.states[E.vacuum]?.state, running = state === 'cleaning', paused = state === 'paused';
  return {run: kit.control({command: 'vacuum', entity: running ? 'pause' : 'start'}, {label: running ? 'Pause' : paused ? 'Resume' : 'Clean', icon: running ? 'pause' : 'start'}),
    dock: kit.control({command: 'vacuum', entity: 'return_to_base'}, {label: 'Dock', icon: 'dock'})};
}

// Each thing is said once on Today: an alert only under Needs you (a bin due
// within a day is one, so Coming up leaves it out), an event only in Coming
// up, and the live register only in power now's line. On a phone the chips
// stand in for the Car, power now and Climate widgets. A widget with a link
// is read as one element, so its link's name says all its body shows.

/**
 * How many list rows a widget's body holds from 700px, by size: what
 * frontend/maison/src/ui/widget.css.js's metrics leave room for (168px rows,
 * 16px padding, a 20px title and its 8px gap, 52px list rows). Needs you and
 * Coming up hold at most this many, and say "N more" past it. Change one and
 * the other follows.
 */
export const WIDGET_ROWS = Object.freeze({medium: 2, large: 5});
// The cells each size covers in the grid (ui/grid.js's SIZES), for the
// Climate widget's size.
const CELLS = Object.freeze({small: 1, medium: 2, large: 4});
const percent = value => value === null ? '—' : `${Math.round(value)}%`;
const upcomingSize = count => count <= 2 ? 'medium' : 'large';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const capitalised = text => text[0].toUpperCase() + text.slice(1);
// A 'YYYY-MM-DD' date in words, and the days from one date to another.
const onDate = (date, options) => zoned('UTC', options).format(new Date(`${date}T12:00:00Z`));
const daysFrom = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/**
 * The Car's state in a word or two for its chip ('62% · waiting'), by
 * carStatus's headline key, so the chip's line stays near 20 characters.
 * The charging keys read 'plugged in' until the Charger draws, when the chip
 * says Charging instead. 'Charger' keeps its capital (CONTEXT.md).
 */
export const CAR_GLANCE_STATES = Object.freeze({
  charger_offline: 'Charger offline', reconnecting: 'reconnecting', unplugged: 'unplugged', unavailable: 'status unknown',
  initializing: 'starting up', other_vehicle: 'Charger in use', automatic_off: 'auto charging off', not_verified: 'not verified',
  stale: 'out of date', power_missing: 'paused', complete: 'charged', house_busy: 'waiting', wait_offpeak: 'waiting',
  wait_sun: 'waiting', solar_paused: 'waiting', solar: 'plugged in', solar_ridethrough: 'plugged in', offpeak: 'plugged in',
  economical: 'plugged in', charge_now: 'plugged in', other: 'plugged in',
});
// The Car charges while it, not another vehicle, is at the Charger and the
// Charger draws, as on the Car's header (car.js's carHeader).
const carCharging = s => s.plugged && s.key !== 'other_vehicle' && s.drawing;
// Needs you's order: the bins due today or tomorrow, then the devices'
// errors (model.js's alerts() reads these two sensors), then the rest.
const DEVICE_ERRORS = new Set(['sensor.roborock_s8_pro_ultra_vacuum_error', 'sensor.roborock_s8_pro_ultra_dock_dock_error']);
const BIN_IDS = new Set(BINS.map(([, id]) => id));
const urgency = alert => BIN_IDS.has(alert.entity) ? 0 : DEVICE_ERRORS.has(alert.entity) ? 1 : 2;
// The grid's direction by Energy's threshold (energy.js's GRID_ACTIVE_W):
// 'export' below −10 W, 'import' above 10 W, 'idle' between, null without a
// reading. It reads the watts, never a node's name.
const gridFlow = ({plot: {watts}}) => watts === null ? null : watts < -GRID_ACTIVE_W ? 'export' : watts > GRID_ACTIVE_W ? 'import' : 'idle';
// Where power comes from now: solar while it produces, else the grid's flow.
const powerSource = ({solar, grid}) => solar.plot.active ? 'solar' : gridFlow(grid);

// The Car's chip: its battery and a word or two ('62% · waiting'), Charging
// while it draws, when a level that isn't live was confirmed ('42% at
// 10:00'), or the state alone without a level ('Unplugged'); `said` is both,
// for its name.
function carChip(snap, car) {
  const charging = carCharging(car), state = charging ? 'charging' : CAR_GLANCE_STATES[car.key] ?? 'plugged in', {value, live, confirmedAt} = car.battery;
  if (value === null) return {line: capitalised(state), said: `${state}, battery unknown`};
  const when = !live && confirmedAt ? clock(confirmedAt, snap.tz, snap.now) : '', battery = `${percent(value)}${when ? ` ${when.includes(':') ? 'at' : 'on'} ${when}` : ''}`;
  return {line: charging ? `Charging · ${percent(value)}` : when ? battery : `${battery} · ${state}`, said: `${battery}, ${state}`};
}
// The chips: the zones' range, power now and the Car, each named in words.
// Their lines are terse, so the third chip peeks on a phone: 'from grid'
// where the names say 'from the grid'.
function glanceValue(snap, kit, {zones, nodes, car}) {
  const readings = zones.zones.map(z => z.plot.reading).filter(r => typeof r === 'number');
  const [low, high] = [Math.min(...readings), Math.max(...readings)].map(r => r.toFixed(1)), one = low === high;
  const inside = !readings.length ? '—' : one ? `${low}° inside` : `${low}–${high}° inside`;
  const {solar, grid} = nodes, energy = {solar: {icon: 'sun', tone: 'yellow', line: `${solar.value} solar`, said: `${solar.value} of solar`},
    export: {icon: 'grid', tone: 'green', line: `${grid.value} to grid`, said: `${grid.value} to the grid`},
    import: {icon: 'grid', tone: 'indigo', line: `${grid.value} from grid`, said: `${grid.value} from the grid`},
    idle: {icon: 'grid', tone: 'gray', line: 'Grid idle', said: 'grid idle'}}[powerSource(nodes)] ?? {icon: 'grid', tone: 'gray', line: '—', said: 'no reading'};
  const chip = carChip(snap, car);
  const item = (id, icon, tone, title, line, said) => ({id, icon, tone, title, line, link: kit.link({command: 'navigate', entity: id}, {ariaLabel: `${title}: ${said}. Open ${title}`})});
  return {label: 'At a glance', items: [
    item('climate', 'climate', readings.length ? 'temperature' : 'gray', 'Climate', inside, !readings.length ? 'no reading' : one ? inside : `${low} to ${high}° inside`),
    item('energy', energy.icon, energy.tone, 'Energy', energy.line, energy.said), item('car', 'car', carCharging(car) ? 'green' : 'gray', 'Car', chip.line, chip.said)]};
}
// What needs attention, the most urgent first, each opening its entity;
// past the widget's rows, the first one and "N more", opening the alerts.
function needsValue(snap, kit) {
  const found = [...alerts(snap.states)].sort((a, b) => urgency(a) - urgency(b));
  if (!found.length) return null;
  const shown = found.length > WIDGET_ROWS.medium ? found.slice(0, WIDGET_ROWS.medium - 1) : found, hidden = found.length - shown.length;
  return {title: 'Needs you', icon: 'alert',
    rows: shown.map(a => ({link: kit.link({command: 'more', entity: a.entity}), icon: a.icon, tone: 'orange', title: a.title, detail: a.detail === 'Open for details' ? '' : a.detail})),
    more: hidden ? kit.link({command: 'alerts'}, {label: `${hidden} more`, ariaLabel: `${plural(hidden, 'more alert')}. Open Home alerts`}) : null};
}
// An event's row: when it is and its start. A timed event on now says when
// it ends; an all-day one never says now, and one that began on an earlier
// day says its last day.
function eventRow(e, {now, tz, today, tomorrow, time, link}) {
  const date = localDate(Math.max(e.startMs, now), tz), last = localDate(e.endMs - 1, tz), started = e.startMs <= now;
  const day = (on, ms) => on === today ? 'Today' : on === tomorrow ? 'Tomorrow' : zoned(tz, {weekday: 'short', day: 'numeric', month: 'short'}).format(new Date(ms));
  const until = on => on === today ? 'today' : on === tomorrow ? 'tomorrow' : onDate(on, daysFrom(today, on) < 7 ? {weekday: 'short'} : {weekday: 'short', day: 'numeric', month: 'short'});
  const detail = !e.allDay ? started ? `Now · until ${last === today ? '' : `${until(last)} `}${time.format(new Date(e.endMs))}` : day(date, e.startMs)
    : started && localDate(e.startMs, tz) !== today && last !== today ? `Until ${until(last)}` : `${day(date, Math.max(e.startMs, now))} · All day`;
  return {date, row: {link, icon: 'life', tone: 'gray', title: String(e.summary ?? ''), detail, value: e.allDay || started ? '' : time.format(new Date(e.startMs))}};
}
// The events that haven't ended and the soonest collection that isn't an
// alert, by day, with the widget size they need: {value, size}. Each event
// opens its dialog by its index in the agenda, the collection its bin's
// sensor, and the calendar's failure and "N more" the Full calendar.
function upcomingValue(snap, kit) {
  const {states, now, tz} = snap, agenda = snap.loaded?.agenda ?? {}, loading = Boolean(snap.loaded?.agendaLoading);
  const today = localDate(now, tz), tomorrow = nextDate(today), time = zoned(tz, {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  const events = loading ? [] : (Array.isArray(agenda.events) ? agenda.events : []).map((e, index) => ({e, index}))
    .filter(({e}) => dated(e?.startMs) && dated(e?.endMs) && e.endMs > now)
    .map(({e, index}) => eventRow(e, {now, tz, today, tomorrow, time, link: kit.link({command: 'agenda-event', entity: String(index)})}));
  // A bin due within a day is an alert, under Needs you only.
  const bin = BINS.map(([name, id, icon]) => ({name, id, icon, days: numeric(states[id]?.state)})).filter(b => b.days !== null && b.days >= 2).sort((a, b) => a.days - b.days)[0];
  const rows = events.map(x => x.row), date = bin && addDays(today, bin.days);
  const collection = bin && {link: kit.link({command: 'more', entity: bin.id}), icon: bin.icon, tone: 'gray', title: bin.name,
    detail: `Collection in ${bin.days} days`, value: onDate(date, bin.days < 7 ? {weekday: 'short'} : {weekday: 'short', day: 'numeric', month: 'short'})};
  if (collection) {
    const before = events.findIndex(x => x.date > date);
    rows.splice(before < 0 ? rows.length : before, 0, collection);
  }
  const failed = !loading && Object.keys(agenda.errors || {}).length > 0, text = events.length ? 'Some calendars could not be loaded' : 'Calendar could not be loaded';
  const note = failed ? {text, link: fullCalendar(kit, {ariaLabel: `${text}. Open the full calendar`})} : null;
  if (!rows.length && !loading && !note) return {value: null, size: null};
  // The loading row or the note takes a row of its own.
  const extra = loading || note ? 1 : 0, size = upcomingSize(rows.length + extra), room = WIDGET_ROWS[size] - extra;
  // Past the room, the first rows and "N more". The collection is on no
  // calendar, so it is never hidden: it is the last row shown, and "N more"
  // counts only the events the Full calendar lists.
  let shown = rows.length > room ? rows.slice(0, room - 1) : rows;
  if (collection && !shown.includes(collection)) shown = [...shown.slice(0, room - 2), collection];
  const hidden = events.length - shown.filter(row => row !== collection).length;
  return {size, value: {title: 'Coming up', icon: 'life', loading, ...(loading ? {loadingLabel: 'Loading the calendar'} : {}), rows: shown, note,
    more: hidden ? fullCalendar(kit, {label: `${hidden} more`, ariaLabel: `${hidden} more coming up. Open the full calendar`}) : null}};
}
// Power now: solar while it produces, else the grid either way or idle, with
// the live register, else nothing to read. The one place Today says the
// register. Its name is the whole reading in one sentence.
function liveValue(snap, kit, nodes) {
  const {solar, grid, house} = nodes, source = powerSource(nodes), out = gridFlow(grid) === 'export';
  const split = value => {const [figure, unit = ''] = value.split(' '); return {value: figure, unit};};
  const offPeak = snap.states[E.offPeakNow], register = available(offPeak) ? offPeak.state === 'on' ? 'off-peak' : 'peak' : null;
  const line = text => `${text}${register ? ` · ${register}` : ''}`, said = text => `${text}${register ? `, ${register}` : ''}`;
  const live = source === 'solar' ? {icon: 'sun', tone: 'yellow', figure: split(solar.value),
    line: out ? `Solar · exporting ${grid.value}` : house.plot.available ? `Solar · house ${house.value}` : 'Solar',
    name: `${solar.value} of solar${out ? `, exporting ${grid.value}` : house.plot.available ? `, the house using ${house.value}` : ''}`}
    : source === 'export' ? {icon: 'grid', tone: 'green', figure: split(grid.value), line: line('To the grid'), name: said(`${grid.value} to the grid`)}
      : source === 'import' ? {icon: 'grid', tone: 'indigo', figure: split(grid.value), line: line('From the grid'), name: said(`${grid.value} from the grid`)}
        : source === 'idle' ? {icon: 'grid', tone: 'gray', figure: split(grid.value), line: line('Grid idle'), name: said('grid idle')}
          : {icon: 'energy', tone: 'gray', figure: {value: '—', unit: ''}, line: 'No power reading', name: 'no reading'};
  const {name, ...shown} = live;
  return {title: 'Power now', ...shown, link: navigate(kit, 'energy', {ariaLabel: `Power now: ${name}. Open Energy`})};
}
// Today's energy is Energy's breakdown (energy.js), opening Energy, named
// with everything the widget shows.
const energyTodayValue = (snap, kit) => energyBreakdown(snap, said => navigate(kit, 'energy', {ariaLabel: `Energy today: ${said} Open Energy`}));
// Home Assistant's other vacuum states, in words. An error is Needs you's to
// name, so the line only says the vacuum stopped.
const VACUUM_STATES = Object.freeze({paused: 'Roborock is paused', returning: 'Roborock is returning to the dock', idle: 'Roborock is idle', error: 'Roborock has stopped'});
// The vacuum in one line; null only when Home Assistant has no vacuum.
// Cleaning, its progress reads as done so it isn't taken for the battery.
function vacuumLineValue(snap) {
  const {states} = snap, vacuum = states[E.vacuum], state = vacuum?.state;
  if (!vacuum) return null;
  const battery = numeric(states[E.vacuumBattery]?.state), progress = numeric(states[E.vacuumProgress]?.state);
  const text = !available(vacuum) ? 'Roborock: no reading'
    : state === 'docked' ? `Roborock is docked${battery === null ? '' : `, battery ${percent(battery)}`}`
      : state === 'cleaning' ? `Roborock is cleaning${progress === null ? '' : ` · ${percent(Math.min(100, Math.max(0, progress)))} done`}`
        : VACUUM_STATES[state] ?? `Roborock: ${pretty(state)}`;
  return {icon: 'vacuum', text, active: state === 'cleaning' || state === 'paused'};
}
// The widgets in drawing order, sized so that every row fills: Climate is
// large when Needs you and Coming up together cover a multiple of four cells.
function widgetsValue(needs, upcoming) {
  const covered = (needs ? CELLS.medium : 0) + (upcoming ? CELLS[upcoming] : 0);
  return [needs && {id: 'needs', size: 'medium'}, {id: 'car', size: 'small'}, {id: 'live', size: 'small'},
    {id: 'climate', size: covered % 4 === 0 ? 'large' : 'medium'}, upcoming && {id: 'upcoming', size: upcoming}, {id: 'energyToday', size: 'medium'}].filter(Boolean);
}

/**
 * The Today page: the vacuum's controls and the Car that its widgets carry,
 * then what it draws, in drawing order (#29 step 4).
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @returns {TodayPage}
 */
export function todayPageValue(snap, kit) {
  const zones = climateHeader(snap), {nodes} = energyHeader(snap).hero, car = carStatus(snap.states, {now: snap.now, zone: snap.tz, last: snap.carLast});
  const needs = needsValue(snap, kit), upcoming = upcomingValue(snap, kit);
  return {id: 'today', vacuum: vacuumValue(snap, kit), car: carGlanceValue(snap, kit),
    glance: glanceValue(snap, kit, {zones: zones.hero, nodes, car}), needs, upcoming: upcoming.value, live: liveValue(snap, kit, nodes),
    climate: {title: 'Climate', icon: 'climate', note: zones.line ?? null, chart: zones.hero,
      link: navigate(kit, 'climate', {ariaLabel: `Climate${zones.line ? `: ${zones.line}` : ''}. ${zones.hero.ariaLabel} Open Climate`})},
    carRing: {icon: 'car', label: percent(car.battery.value), tone: carCharging(car) ? 'green' : 'gray'},
    energyToday: energyTodayValue(snap, kit), vacuumLine: vacuumLineValue(snap), widgets: widgetsValue(needs, upcoming.size)};
}

/**
 * @typedef {{kind: 'event', title: string, eyebrow: 'Calendar', date: string, location: string|null, description: string|null,
 *   calendar: string, full: Link}} EventDialog
 *   date is the event's day and times in the house's time zone: 'Sunday 27 September · 13:00–14:30', or both ends of a
 *   timed event that ends on a later day ('Sunday 27 September 13:00 – Monday 28 September 10:00'); 'Sunday 27
 *   September · All day', or 'Sunday 27 – Tuesday 29 September · All day' over several days. A day outside the
 *   snapshot's year names its year ('Friday 1 January 2027'). calendar is the calendar's name, and says so when
 *   only the current event could be read.
 */

// A moment's day in words, 'Sunday 27 September': its month left out for
// the first day of a range within one month, and its year named only when
// it isn't the snapshot's.
function longDay(ms, snap, {month = true} = {}) {
  const part = Object.fromEntries(zoned(snap.tz, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return [part.weekday, part.day, month && part.month, month && localDate(ms, snap.tz).slice(0, 4) !== localDate(snap.now, snap.tz).slice(0, 4) && part.year].filter(Boolean).join(' ');
}
// When an event is: its day and times, or both ends when it ends on a later
// day; All day, over a range of days when it lasts longer. Its end is the
// moment after it, so its last day is the one before that moment.
function eventDate(snap, {startMs, endMs, allDay}) {
  const time = ms => zoned(snap.tz, {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(ms));
  const first = localDate(startMs, snap.tz), last = localDate(endMs - 1, snap.tz);
  if (allDay) return first === last ? `${longDay(startMs, snap)} · All day`
    : `${longDay(startMs, snap, {month: first.slice(0, 7) !== last.slice(0, 7)})} – ${longDay(endMs - 1, snap)} · All day`;
  return first === last ? `${longDay(startMs, snap)} · ${time(startMs)}–${time(endMs)}` : `${longDay(startMs, snap)} ${time(startMs)} – ${longDay(endMs, snap)} ${time(endMs)}`;
}
/**
 * The dialog an event opens, from Coming up: when, where, what and from
 * which calendar. `event` is the one that was drawn, from
 * snap.loaded.agenda.events. null for an event without a readable time,
 * which Today never draws.
 * @param {object} snap
 * @param {Kit} kit
 * @param {object} event
 * @returns {EventDialog|null}
 */
export function eventDialogValue(snap, kit, event) {
  if (!dated(event?.startMs) || !dated(event?.endMs)) return null;
  const id = typeof event.calendarId === 'string' ? event.calendarId : undefined;
  const calendar = snap.states[id]?.attributes?.friendly_name || pretty(id?.split('.')[1]);
  return {kind: 'event', title: String(event.summary ?? ''), eyebrow: 'Calendar', date: eventDate(snap, event),
    location: event.location || null, description: event.description || null,
    calendar: `${calendar}${event.partial ? ' · Current-event fallback; the full calendar could not be loaded.' : ''}`,
    full: fullCalendar(kit, {label: 'Full calendar', icon: 'life'})};
}

/**
 * @typedef {{kind: 'weather', icon: string|null, temperature: string, condition: string, line: string|null, days: WeatherDay[], ariaLabel: string}} WeatherHero
 *   Today's header chart (#29 step 3). temperature is outside now, rounded ('18°'), or '—';
 *   condition is the weather's name ('Cloudy'), or 'Weather unavailable'. line is 'Tomorrow 28°' from tomorrow's
 *   local date, else null. ariaLabel is the whole reading in one sentence ('Outside 18°, cloudy. Tomorrow 28°.').
 *   icon is the current conditions' wx-* icon ('wx-partly-night' for partly cloudy while sun.sun is below the
 *   horizon), null for a condition Home Assistant doesn't list.
 *   While the weather is unavailable: '—', 'Weather unavailable', icon and line null and no days.
 * @typedef {{name: string, icon: string|null, value: string, ariaLabel: string}} WeatherDay
 *   At most four, grouped by local date in snap.tz, from today's on: 'Today' if the forecast has today's date,
 *   then short weekdays ('Tue'). icon is a wx-* icon (the day icons only), null for a condition Home Assistant
 *   doesn't list; value '28°' or '—'. ariaLabel reads the day in full ('Tuesday: cloudy, 28°'), leaving out
 *   what it doesn't know. No forecast: no days, with no humidity or wind in their place.
 */

// The hero's icon for each of Home Assistant's fifteen conditions.
const WX = Object.freeze({sunny: 'wx-sun', 'clear-night': 'wx-moon', partlycloudy: 'wx-partly', cloudy: 'wx-cloud', exceptional: 'wx-cloud',
  rainy: 'wx-rain', pouring: 'wx-rain', snowy: 'wx-snow', 'snowy-rainy': 'wx-snow', fog: 'wx-fog',
  lightning: 'wx-storm', 'lightning-rainy': 'wx-storm', windy: 'wx-wind', 'windy-variant': 'wx-wind', hail: 'wx-hail'});
const listed = condition => typeof condition === 'string' && Object.hasOwn(WX, condition);
const rounded = value => numeric(value) === null ? '—' : Math.round(numeric(value)) + '°';
// A moment's local date in `tz` as 'YYYY-MM-DD', which sorts as it reads.
function localDate(ms, tz) {
  const part = Object.fromEntries(zoned(tz, {year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}
// The date `n` days after `date` by the calendar, so a 23- or 25-hour day
// can't skip or repeat one; nextDate is the day after.
const addDays = (date, n) => {const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);};
const nextDate = date => addDays(date, 1);

// The forecast by local date, from today's on: each date's first entry,
// dated, in order. An entry without a readable time is left out.
function forecastDays(snap, today) {
  const seen = new Set();
  return (snap.loaded?.forecasts ?? []).map(f => ({f, ms: new Date(f?.datetime).getTime()})).filter(d => dated(d.ms))
    .sort((a, b) => a.ms - b.ms).map(d => ({...d, date: localDate(d.ms, snap.tz)}))
    .filter(d => d.date >= today && !seen.has(d.date) && seen.add(d.date));
}
// One forecast day on the hero: its name, day icon and temperature.
function heroDay({f, ms, date}, today, tz) {
  const value = rounded(f.temperature), said = [listed(f.condition) ? weatherName(f.condition).toLowerCase() : '', value === '—' ? '' : value].filter(Boolean).join(', ');
  const full = date === today ? 'Today' : zoned(tz, {weekday: 'long'}).format(new Date(ms));
  return {name: date === today ? 'Today' : zoned(tz, {weekday: 'short'}).format(new Date(ms)), icon: listed(f.condition) ? WX[f.condition] : null,
    value, ariaLabel: said ? `${full}: ${said}` : full};
}

/**
 * Today's header (#29 step 3): no line under the title, and the weather
 * hero: outside now, its condition, tomorrow's temperature and the next four
 * days, from the snapshot only.
 * @param {object} snap the element's snapshot
 * @returns {{line: null, hero: WeatherHero}}
 */
export function todayHeader(snap) {
  const w = snap.states[E.weather];
  if (!available(w)) return {line: null, hero: {kind: 'weather', icon: null, temperature: '—', condition: 'Weather unavailable', line: null, days: [], ariaLabel: 'Weather unavailable.'}};
  const today = localDate(snap.now, snap.tz), found = forecastDays(snap, today), tomorrow = found.find(d => d.date === nextDate(today));
  const temperature = rounded(w.attributes?.temperature), condition = weatherName(w.state);
  const line = tomorrow && numeric(tomorrow.f.temperature) !== null ? `Tomorrow ${rounded(tomorrow.f.temperature)}` : null;
  const night = w.state === 'partlycloudy' && snap.states[E.sun]?.state === 'below_horizon';
  return {line: null, hero: {kind: 'weather', icon: night ? 'wx-partly-night' : listed(w.state) ? WX[w.state] : null, temperature, condition, line,
    days: found.slice(0, 4).map(d => heroDay(d, today, snap.tz)),
    ariaLabel: `${temperature === '—' ? 'Outside:' : `Outside ${temperature},`} ${condition.toLowerCase()}.${line ? ` ${line}.` : ''}`}};
}
