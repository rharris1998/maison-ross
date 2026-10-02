// What the gallery draws from (#27, #29): snapshots in the exact shape of
// the element's snapshot(), built from the fixtures, which the served
// screen.js's screen() turns into the values production draws. The gallery
// embeds no rule: the page passes screen() in, and ScreenContext hands it to
// every example. Presses act on nothing, and a Home Assistant card's slot
// shows a note.
import {createContext, useContext} from 'react';
import {CAR_FIXTURES, CAR_NOW} from '../fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../fixtures/car-page-fixtures.js';
import {CLIMATE_FIXTURES, CLIMATE_NOW, CLIMATE_SCHEDULES} from '../fixtures/climate-fixtures.js';
import {ENERGY_FIXTURES, ENERGY_NIGHT_POWER_HISTORY, ENERGY_NOW, ENERGY_POWER_HISTORY} from '../fixtures/energy-fixtures.js';
import {TODAY_FIXTURES, TODAY_NOW} from '../fixtures/today-fixtures.js';
import {HOME_FIXTURES, HOME_MIDNIGHT, HOME_NOW, HOME_POWER_HISTORY} from '../fixtures/home-fixtures.js';
import {SKY_FIXTURES, SKY_FORECAST} from '../fixtures/sky-fixtures.js';
import {fixtureSnapshot} from '../fixtures/fixture-snapshot.js';

export const BEDROOM_VALVE = 'climate.bedroom_trv';
export const HOUSE_HEATING = 'sensor.house_heating';

// The served screen.js's screen(), which the page passes in: the gallery
// draws exactly what the dashboard would for the same snapshot.
export const ScreenContext = createContext(null);
export const useScreen = () => useContext(ScreenContext);

// Recorded 24 hours for the Attic's charts: a gap, an isolated sample and the
// schedule's step from setback to comfort.
function atticHistory(start) {
  const at = (hours, value) => ({timestamp: new Date(start + hours * 3600000).toISOString(), value});
  return {
    'sensor.office_sensor_temperature': [at(0, 17.2), at(4, 16.6), at(8, null), at(12, 16.4), at(16, null), at(20, 19.1), at(22, 19.6), at(24, 19.8)],
    'sensor.attic_target_temperature': [at(0, 21), at(8.5, 16), at(22.5, 21), at(24, 21)],
    'sensor.office_sensor_humidity': [at(0, 48), at(6, 47), at(12, 46), at(18, 45), at(24, 45)],
  };
}

const DAY_START = CLIMATE_NOW - 24 * 3600000;
const RECORDED = {series: atticHistory(DAY_START), errors: {}}, NOTHING_YET = {series: {}, errors: {}};
// One Climate fixture as the element would see it on the Climate page: the
// Attic's 24 hours recorded and the zones' schedules read. What a gallery state
// shows beyond that is part of the snapshot too: a request in flight is `busy`,
// its confirmation line `feedback`, a chart still loading `loading`.
export function climateSnapshot(fixtureId = 'house_running', {detail = null, busy = [], feedback = [], history = RECORDED, loading = false} = {}) {
  return fixtureSnapshot({
    states: CLIMATE_FIXTURES.find(f => f.id === fixtureId).states, route: {page: 'climate', detail},
    busy: new Set(busy), feedback: new Map(feedback),
    loaded: {history: {'climate-attic': {data: history, start: DAY_START, end: CLIMATE_NOW}}, historyLoading: new Set(loading ? ['climate-attic'] : []), schedules: CLIMATE_SCHEDULES},
  });
}
export const PENDING = {busy: [BEDROOM_VALVE], feedback: [[BEDROOM_VALVE, 'Bedroom radiator · waiting for device update…']]};
export const REJECTED = {feedback: [[BEDROOM_VALVE, 'Could not complete that action. Simulated device rejection']], history: {series: {}, errors: {history: 'Simulated recorder error'}}};
// A house override sent and not yet read back from the thermostat.
export const THERMOSTAT = {busy: [HOUSE_HEATING], feedback: [[HOUSE_HEATING, 'House heating 22° until 22:00 · waiting for the thermostat, which can take a minute or two']]};
export const LOADING = {history: NOTHING_YET, loading: true}, EMPTY = {history: NOTHING_YET};

// Presses in the gallery act on nothing.
export const ignore = async () => {};

// One Car fixture as the element would see it at CAR_NOW on `page`, with the
// headline it kept through a Charger dropout. Its controls act on nothing.
export const carSnapshot = (fixture, page) => fixtureSnapshot({states: fixture.states, now: CAR_NOW, carLast: fixture.last ?? null, route: {page, detail: null, dialog: null}});

// A Today or home fixture as the element would see it on `page`, with what it
// loads beside the states: the agenda and forecast, and Energy's power since
// midnight. `sensors` is Home Status's catalogue query; `dialog` an open dialog's
// route, such as {kind: 'alerts'}.
export function pageSnapshot(fixture, page, now, sensors, dialog = null) {
  return fixtureSnapshot({states: fixture.states, now, route: {page, detail: null, dialog}, ...(sensors ? {sensors} : {}),
    loaded: {agenda: fixture.agenda, agendaLoading: fixture.agendaLoading, forecasts: fixture.forecasts, history: {energy: HOME_POWER_HISTORY}}});
}
// Everything reporting, and Today on a busy day.
export const HOME = HOME_FIXTURES.find(fixture => fixture.id === 'full');
export const TODAY_BUSY = TODAY_FIXTURES.find(fixture => fixture.id === 'busy');

// ---- The sky and the heroes (#29 step 3) ----------------------------------
const byId = (fixtures, id) => {
  const found = fixtures.find(fixture => fixture.id === id);
  if (!found) throw new Error(`No fixture ${id}`);
  return found;
};

/**
 * One sky fixture (SKY_FIXTURES, by id) as the element would see it on
 * `page` at the sky's time: only the sun and the weather, nothing else.
 * @param {string} id
 * @param {string} [page]
 */
export function skySnapshot(id, page = 'today') {
  const sky = byId(SKY_FIXTURES, id);
  return fixtureSnapshot({states: {...sky.states}, now: sky.now, route: {page, detail: null, dialog: null}});
}

// States with some readings replaced, {entity id: watts}, so a hero's
// power flows add up: the house load includes the Car, and the grid meter
// is the load less solar (below zero is export).
const withPower = (states, readings) => Object.fromEntries(Object.entries(states).map(([id, state]) =>
  [id, Object.hasOwn(readings, id) ? {...state, state: String(readings[id])} : state]));

// Each page's hero variants: the existing page fixture under it and the sky
// over it. No page fixture is made for a hero; the Energy page's Car comes
// from a Car fixture.
const HEROES = {
  today: {
    day: {fixture: () => byId(TODAY_FIXTURES, 'quiet'), sky: 'noon'},
    night: {fixture: () => byId(TODAY_FIXTURES, 'quiet'), sky: 'night-cloudy'},
    unavailable: {fixture: () => byId(TODAY_FIXTURES, 'unavailable'), sky: 'unknown'},
  },
  climate: {
    running: {fixture: () => byId(CLIMATE_FIXTURES, 'house_running'), sky: 'afternoon-cloudy'},
    'heating-off': {fixture: () => byId(CLIMATE_FIXTURES, 'house_off'), sky: 'night'},
    unavailable: {fixture: () => byId(CLIMATE_FIXTURES, 'sensors_unavailable'), sky: 'unknown'},
  },
  energy: {
    // Off-peak, the inverter's power unavailable, and the Car charging off-peak
    // at 7.2 kW: the meter and the house load read the house's 850 W plus it.
    'night-grid': {fixture: () => ({states: withPower({...byId(HOME_FIXTURES, 'quiet').states, ...byId(CAR_FIXTURES, 'offpeak').states},
      {'sensor.p1_meter_power': 8050, 'sensor.house_load_power': 8050})}), sky: 'night-cloudy'},
    // Solar 6.2 kW covers the house's 1.4 kW and the Car's 3.8 kW, and 1.0 kW
    // goes to the grid.
    'solar-charging': {fixture: () => ({states: withPower({...byId(HOME_FIXTURES, 'full').states, ...byId(CAR_FIXTURES, 'solar').states},
      {'sensor.goodwe_pv_power': 6200, 'sensor.house_load_power': 5200, 'sensor.p1_meter_power': -1000})}), sky: 'noon'},
    unavailable: {fixture: () => byId(HOME_FIXTURES, 'missing'), sky: 'unknown'},
  },
  car: {
    unplugged: {fixture: () => byId(CAR_FIXTURES, 'unplugged'), sky: 'afternoon-cloudy'},
    waiting: {fixture: () => byId(CAR_FIXTURES, 'wait_sun'), sky: 'dawn'},
    solar: {fixture: () => byId(CAR_FIXTURES, 'solar'), sky: 'noon'},
    offpeak: {fixture: () => byId(CAR_FIXTURES, 'offpeak'), sky: 'night'},
    unavailable: {fixture: () => byId(CAR_FIXTURES, 'charger_offline'), sky: 'unknown'},
  },
};
/** Each page's hero variant ids, in the order the gallery draws them: {today: ['day', 'night', 'unavailable'], …}. */
export const HERO_VARIANTS = Object.freeze(Object.fromEntries(Object.entries(HEROES).map(([page, variants]) => [page, Object.freeze(Object.keys(variants))])));

/**
 * A page's hero variant (HERO_VARIANTS) as the element would see it: the
 * sky fixture's states over the page fixture's, at the sky's time, with the
 * Car's kept headline where the fixture has one, and on Today SKY_FORECAST.
 * @param {'today'|'climate'|'energy'|'car'} page
 * @param {string} variant
 */
export function heroSnapshot(page, variant) {
  const hero = HEROES[page]?.[variant];
  if (!hero) throw new Error(`No hero ${page}/${variant}`);
  const fixture = hero.fixture(), sky = byId(SKY_FIXTURES, hero.sky);
  return fixtureSnapshot({states: {...fixture.states, ...sky.states}, now: sky.now, carLast: fixture.last ?? null,
    route: {page, detail: null, dialog: null}, ...(page === 'today' ? {loaded: {forecasts: SKY_FORECAST}} : {})});
}

// ---- Today's pages for the pages view (#29 step 4) ------------------------
/**
 * The Today pages the gallery's pages view draws, in its order: each is
 * a Today fixture (TODAY_FIXTURES, by id) under a sky fixture (SKY_FIXTURES,
 * by id), titled with the Today fixture's title. The paused page is the one
 * whose calendar is still loading.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, sky: string, title: string}>>}
 */
export const TODAY_PAGES = Object.freeze([['quiet', 'noon'], ['busy', 'afternoon-cloudy'], ['paused', 'dusk'], ['unavailable', 'unknown'], ['night', 'night-cloudy']]
  .map(([id, sky]) => Object.freeze({id, fixture: id, sky, title: byId(TODAY_FIXTURES, id).title})));

/**
 * A page of TODAY_PAGES (by id) as the element would see it on Today: the
 * Today fixture's states with the sky fixture's sun and weather laid over
 * them, at the fixture's own time when it has one (the night's evening) and
 * otherwise TODAY_NOW (the time the fixture's agenda is set by, not the
 * sky's), with the fixture's agenda and whether it is still loading, and
 * SKY_FORECAST as the forecast.
 * @param {string} id
 */
export function todaySnapshot(id) {
  const found = byId(TODAY_PAGES, id), fixture = byId(TODAY_FIXTURES, found.fixture), sky = byId(SKY_FIXTURES, found.sky);
  return fixtureSnapshot({states: {...fixture.states, ...sky.states}, now: fixture.now ?? TODAY_NOW, route: {page: 'today', detail: null, dialog: null},
    loaded: {agenda: fixture.agenda, agendaLoading: fixture.agendaLoading, forecasts: SKY_FORECAST}});
}

// ---- Climate's pages and sheets for the pages view (#29 step 4, v32) ------
// Recorded 24 hours for every Climate sheet's charts, by climate.js's cache
// group (climateHistory) and sensor, in hours from DAY_START (09:30 the day
// before): the living room warming from 06:30 and cooling after 22:00,
// Sam's office on its schedule, the fixed rooms steady, each towel rail
// dried once (the Ensuite in the evening, the Bathroom in the morning), and
// the Attic's day as climateSnapshot records it (a gap, an isolated sample,
// the step to comfort). The ids are the fixtures', as atticHistory's are:
// nothing under src imports model.js.
const hoursAt = (hours, value) => ({timestamp: new Date(DAY_START + hours * 3600000).toISOString(), value});
const recordedDay = points => points.map(([hours, value]) => hoursAt(hours, value));
const CLIMATE_DAY = {
  'climate-house': {
    'sensor.living_room_sensor_temperature': recordedDay([[0, 19.8], [4, 20.1], [8, 20.2], [12.5, 20], [16, 18.9], [20, 18.2], [21.5, 18.6], [23, 19.3], [24, 19.6]]),
    'sensor.living_room_sensor_humidity': recordedDay([[0, 50], [6, 49], [12, 51], [18, 47], [24, 48]]),
  },
  'climate-attic': atticHistory(DAY_START),
  'climate-sam': {
    'sensor.sams_office_sensor_temperature': recordedDay([[0, 19.9], [4, 20.2], [8.5, 20.1], [12, 18.6], [18, 17.9], [22.5, 17.8], [23.5, 18.6], [24, 19.2]]),
    'sensor.sams_office_target_temperature': recordedDay([[0, 20], [8.5, 18], [22.5, 20], [24, 20]]),
    'sensor.sams_office_sensor_humidity': recordedDay([[0, 51], [8, 49], [16, 52], [24, 50]]),
  },
  'climate-noah': {
    'sensor.noahs_room_sensor_temperature': recordedDay([[0, 20.3], [6, 20.1], [12, 19.8], [18, 19.7], [21, 19.9], [24, 20.1]]),
    'sensor.noahs_room_target_temperature': recordedDay([[0, 20], [24, 20]]),
    'sensor.noahs_room_sensor_humidity': recordedDay([[0, 50], [12, 54], [24, 52]]),
  },
  'climate-bedroom-suite': {
    'sensor.bedroom_sensor_temperature': recordedDay([[0, 17.2], [6, 17], [12, 16.9], [18, 16.6], [21, 16.7], [24, 16.8]]),
    'sensor.bedroom_suite_target_temperature': recordedDay([[0, 17], [24, 17]]),
    'sensor.bedroom_sensor_humidity': recordedDay([[0, 56], [8, 55], [16, 58], [21.5, 62], [24, 55]]),
  },
  'climate-towel-rails': {
    'sensor.ensuite_trv_local_temperature': recordedDay([[0, 21.1], [9.9, 20.9], [10.1, 35.8], [10.9, 38.2], [11.3, 27.4], [12.5, 21.9], [24, 21.4]]),
    'sensor.bathroom_trv_local_temperature': recordedDay([[0, 21.2], [21.4, 21], [21.6, 34.9], [22.4, 37.1], [22.8, 26.2], [23.6, 21.8], [24, 21.4]]),
  },
};
// One sensor's recorded day, ending at CLIMATE_NOW on its reading in
// `states` (a gap while it has none); a zone's target, recorded in steps,
// that has changed since the day's last step reached it half an hour
// before, as an override does.
function endingOn(states, id, points) {
  const number = Number(states[id]?.state), reading = Number.isFinite(number) ? number : null;
  const changed = id.endsWith('_target_temperature') && reading !== null && reading !== points.at(-1).value;
  return [...points.slice(0, -1), ...(changed ? [hoursAt(23.5, reading)] : []), hoursAt(24, reading)];
}
// What the element has loaded on Climate over `states`: every sheet's 24
// hours, by cache group, and the zones' schedules.
const climateLoaded = states => ({schedules: CLIMATE_SCHEDULES, history: Object.fromEntries(Object.entries(CLIMATE_DAY).map(([group, series]) =>
  [group, {data: {series: Object.fromEntries(Object.entries(series).map(([id, points]) => [id, endingOn(states, id, points)])), errors: {}}, start: DAY_START, end: CLIMATE_NOW}]))});
const onClimate = (states, detail) => fixtureSnapshot({states, now: CLIMATE_NOW, route: {page: 'climate', detail, dialog: null}, loaded: climateLoaded(states)});

/**
 * The Climate pages the gallery's pages view draws: each is a Climate
 * fixture (CLIMATE_FIXTURES, by id) under a sky fixture (SKY_FIXTURES, by
 * id), titled with the Climate fixture's title. Ids start `climate-`, so a
 * pages view window `{size}-{id}` never takes a Today page's name.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, sky: string, title: string}>>}
 */
export const CLIMATE_PAGES = Object.freeze([['climate-running', 'house_running', 'noon'], ['climate-off', 'house_off', 'night'],
  ['climate-away', 'house_away', 'afternoon-cloudy'], ['climate-override', 'house_override', 'rain'], ['climate-unavailable', 'sensors_unavailable', 'unknown']]
  .map(([id, fixture, sky]) => Object.freeze({id, fixture, sky, title: byId(CLIMATE_FIXTURES, fixture).title})));

/**
 * A page of CLIMATE_PAGES (by id) as the element would see it on Climate: the
 * Climate fixture's states with the sky fixture's sun and weather laid over
 * them, at CLIMATE_NOW (not the sky's time, so the fixture's "until 12:30"
 * and "drying until 10:15" stay ahead), with every sheet's 24 hours recorded
 * (the house, each zone and the towel rails, ending on the fixture's
 * readings) and the zones' schedules read.
 * @param {string} id
 */
export function climatePageSnapshot(id) {
  const found = byId(CLIMATE_PAGES, id);
  return onClimate({...byId(CLIMATE_FIXTURES, found.fixture).states, ...byId(SKY_FIXTURES, found.sky).states}, null);
}

/**
 * The Climate sheets the pages view draws in place: each is a Climate
 * fixture (CLIMATE_FIXTURES, by id) with one drawer open (`detail`: 'house',
 * a zone id or 'towel-rails'), titled with the fixture's title.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, detail: string, title: string}>>}
 */
export const CLIMATE_SHEETS = Object.freeze([['sheet-house', 'house_running', 'house'], ['sheet-house-off', 'house_off', 'house'],
  ['sheet-attic', 'zone_override', 'attic'], ['sheet-noah', 'house_running', 'noah'], ['sheet-rails', 'house_override', 'towel-rails']]
  .map(([id, fixture, detail]) => Object.freeze({id, fixture, detail, title: byId(CLIMATE_FIXTURES, fixture).title})));

/**
 * A sheet of CLIMATE_SHEETS (by id) as the element would see it: the Climate
 * fixture's states on Climate with its drawer open, at CLIMATE_NOW, with
 * every sheet's 24 hours recorded and the zones' schedules read, as
 * climatePageSnapshot has them. No sky: a sheet doesn't draw one.
 * @param {string} id
 */
export function climateSheetSnapshot(id) {
  const found = byId(CLIMATE_SHEETS, id);
  return onClimate(byId(CLIMATE_FIXTURES, found.fixture).states, found.detail);
}

// ---- Energy's pages and sheets for the pages view (#29 step 4, v33) -------
// The fixtures Energy's windows draw from: ENERGY_FIXTURES, and HOME's quiet
// house (a register with no reading) at its own time, ENERGY_NOW.
const ENERGY_SOURCES = [...ENERGY_FIXTURES, {...byId(HOME_FIXTURES, 'quiet'), now: ENERGY_NOW}];
// Energy's power since midnight, by fixture: the night's to 21:04, nothing
// recorded for the missing house, and HOME's noon for the rest.
const NO_POWER = {data: {series: {}, errors: {}}, start: HOME_MIDNIGHT, end: ENERGY_NOW};
const POWER_DAYS = {night: ENERGY_NIGHT_POWER_HISTORY, missing: NO_POWER};
// One Energy fixture's states (with a sky's laid over them, if any) on
// Energy at the fixture's own time, `detail`'s sheet open, with its power
// since midnight loaded under the chart's cache group.
const onEnergy = (fixture, states, detail) => fixtureSnapshot({states, now: fixture.now, route: {page: 'energy', detail, dialog: null},
  loaded: {history: {energy: POWER_DAYS[fixture.id] ?? ENERGY_POWER_HISTORY}}});

/**
 * The Energy pages the gallery's pages view draws: each is an Energy
 * fixture (ENERGY_FIXTURES, by id) under a sky fixture (SKY_FIXTURES, by
 * id) that fits its hour, titled with the Energy fixture's title. Ids start
 * `energy-`, so a window `{size}-{id}` never takes a Today or Climate
 * page's name.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, sky: string, title: string}>>}
 */
export const ENERGY_PAGES = Object.freeze([['energy-covered', 'covered', 'noon'], ['energy-billing', 'billing', 'noon'],
  ['energy-night', 'night', 'night'], ['energy-missing', 'missing', 'unknown']]
  .map(([id, fixture, sky]) => Object.freeze({id, fixture, sky, title: byId(ENERGY_FIXTURES, fixture).title})));

/**
 * A page of ENERGY_PAGES (by id) as the element would see it on Energy: the
 * Energy fixture's states with the sky fixture's sun and weather laid over
 * them, at the fixture's own time (noon, or 21:04 for the night), with its
 * power since midnight under the `energy` group (ENERGY_POWER_HISTORY, the
 * night's ENERGY_NIGHT_POWER_HISTORY, nothing recorded for the missing
 * house).
 * @param {string} id
 */
export function energyPageSnapshot(id) {
  const found = byId(ENERGY_PAGES, id), fixture = byId(ENERGY_FIXTURES, found.fixture);
  return onEnergy(fixture, {...fixture.states, ...byId(SKY_FIXTURES, found.sky).states}, null);
}

/**
 * The Energy sheets the pages view draws in place: each is an Energy
 * fixture (ENERGY_FIXTURES, by id, or HOME's `quiet`) with one sheet open
 * (`detail`, an ENERGY_DETAILS id), titled with the fixture's title. Ids
 * start `energy-`, which is how sheetSnapshot tells them from Climate's.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, detail: string, title: string}>>}
 */
export const ENERGY_SHEETS = Object.freeze([['energy-price', 'billing', 'price'], ['energy-billing-year', 'billing', 'billing-year'],
  ['energy-billing-year-quiet', 'quiet', 'billing-year'], ['energy-bill', 'billing', 'bill'], ['energy-bill-covered', 'covered', 'bill'],
  ['energy-bill-missing', 'missing', 'bill'], ['energy-today', 'billing', 'energy-today']]
  .map(([id, fixture, detail]) => Object.freeze({id, fixture, detail, title: byId(ENERGY_SOURCES, fixture).title})));

/**
 * A sheet of ENERGY_SHEETS (by id) as the element would see it: the
 * fixture's states on Energy with its sheet open, at the fixture's own
 * time, with its 24 hours of power loaded as energyPageSnapshot has them.
 * No sky: a sheet doesn't draw one.
 * @param {string} id
 */
export function energySheetSnapshot(id) {
  const found = byId(ENERGY_SHEETS, id), fixture = byId(ENERGY_SOURCES, found.fixture);
  return onEnergy(fixture, fixture.states, found.detail);
}

// ---- The Car's pages and sheets for the pages view (#29 step 4, v34) ------
// The fixtures the Car's windows draw from: CAR_FIXTURES, and the page's
// edges (CAR_PAGE_FIXTURES), such as a charging energy meter without a
// reading.
const CAR_SOURCES = [...CAR_FIXTURES, ...CAR_PAGE_FIXTURES];
// One Car fixture's states (with a sky's laid over them, if any) on the Car
// at CAR_NOW, `detail`'s sheet open, with the headline it kept through a
// Charger dropout where it has one. The Car loads nothing.
const onCar = (fixture, states, detail) => fixtureSnapshot({states, now: CAR_NOW, carLast: fixture.last ?? null, route: {page: 'car', detail, dialog: null}});

/**
 * The Car pages the gallery's pages view draws: each is a Car fixture
 * (CAR_FIXTURES or CAR_PAGE_FIXTURES, by id) under a sky fixture
 * (SKY_FIXTURES, by id), titled with the Car fixture's title. The last two
 * are the quiet forms: two minutes into a Charger dropout, the headline
 * kept, and Charge now while the Car sleeps. Ids are the fixture's with
 * `car-` before it, so a window `{size}-{id}` never takes another page's
 * name.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, sky: string, title: string}>>}
 */
export const CAR_PAGES = Object.freeze([['solar', 'noon'], ['charge_now', 'afternoon-cloudy'], ['not_verified', 'night'],
  ['unplugged', 'afternoon-cloudy'], ['never_confirmed', 'unknown'], ['dropout', 'rain'], ['override_asleep', 'dusk']]
  .map(([fixture, sky]) => Object.freeze({id: `car-${fixture}`, fixture, sky, title: byId(CAR_SOURCES, fixture).title})));

/**
 * A page of CAR_PAGES (by id) as the element would see it on the Car: the
 * Car fixture's states with the sky fixture's sun and weather laid over
 * them, at the fixture's own time, CAR_NOW (not the sky's, a day later, so
 * a clock on the fixture's day reads '10:00', not 'Sun 10:00'), with the
 * headline it kept through a Charger dropout where it has one.
 * @param {string} id
 */
export function carPageSnapshot(id) {
  const found = byId(CAR_PAGES, id), fixture = byId(CAR_SOURCES, found.fixture);
  return onCar(fixture, {...fixture.states, ...byId(SKY_FIXTURES, found.sky).states}, null);
}

/**
 * The Car sheets the pages view draws in place: each is a Car fixture
 * (CAR_FIXTURES or CAR_PAGE_FIXTURES, by id) with one sheet open
 * (`detail`, a CAR_DETAILS id), titled with the fixture's title: Battery
 * while charging from solar, while the Car sleeps unverified and with
 * nothing confirmed, then Charging energy with every meter read and with
 * one missing. Ids start `car-`, which is how sheetSnapshot tells them
 * from the others.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, detail: string, title: string}>>}
 */
export const CAR_SHEETS = Object.freeze([['car-battery', 'solar', 'battery'], ['car-battery-asleep', 'not_verified', 'battery'],
  ['car-battery-missing', 'never_confirmed', 'battery'], ['car-charging-energy', 'solar', 'charging-energy'],
  ['car-charging-energy-missing', 'meter_missing', 'charging-energy']]
  .map(([id, fixture, detail]) => Object.freeze({id, fixture, detail, title: byId(CAR_SOURCES, fixture).title})));

/**
 * A sheet of CAR_SHEETS (by id) as the element would see it: the fixture's
 * states on the Car with its sheet open, at CAR_NOW. No sky: a sheet
 * doesn't draw one.
 * @param {string} id
 */
export function carSheetSnapshot(id) {
  const found = byId(CAR_SHEETS, id), fixture = byId(CAR_SOURCES, found.fixture);
  return onCar(fixture, fixture.states, found.detail);
}

/**
 * A sheet the pages view draws, by id: an ENERGY_SHEETS one (ids starting
 * `energy-`), a CAR_SHEETS one (`car-`) or a CLIMATE_SHEETS one.
 * @param {string} id
 */
export const sheetSnapshot = id => id.startsWith('energy-') ? energySheetSnapshot(id) : id.startsWith('car-') ? carSheetSnapshot(id) : climateSheetSnapshot(id);

// ---- Home status and the dialogs for the pages view (#29 step 4, v35) -----
// Home status's catalogue query in its windows: the first eight readings,
// then Show more, so a window stays short.
const SYSTEM_SENSORS = {query: '', category: 'all', limit: 8};

/**
 * The Home status pages the gallery's pages view draws: each is a
 * home fixture (HOME_FIXTURES, by id) under a sky fixture (SKY_FIXTURES, by
 * id), titled with the home fixture's title. The missing house's sky is the
 * unknown one, whose weather is unavailable, so its key devices stay
 * missing. A pages view window is `{size}-system-{id}`.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, sky: string, title: string}>>}
 */
export const SYSTEM_PAGES = Object.freeze([['full', 'noon'], ['quiet', 'afternoon-cloudy'], ['missing', 'unknown']]
  .map(([fixture, sky]) => Object.freeze({id: fixture, fixture, sky, title: byId(HOME_FIXTURES, fixture).title})));

/**
 * A page of SYSTEM_PAGES (by id) as the element would see it on Home
 * status: the home fixture's states with the sky fixture's sun and weather
 * laid over them, at HOME_NOW (the fixtures' own time, not the sky's, as
 * carPageSnapshot has it), its catalogue showing its first eight readings.
 * Home status loads nothing.
 * @param {string} id
 */
export function systemPageSnapshot(id) {
  const found = byId(SYSTEM_PAGES, id);
  return fixtureSnapshot({states: {...byId(HOME_FIXTURES, found.fixture).states, ...byId(SKY_FIXTURES, found.sky).states}, now: HOME_NOW,
    route: {page: 'system', detail: null, dialog: null}, sensors: SYSTEM_SENSORS});
}

/**
 * The dialogs the pages view draws in place: each is a home fixture
 * (HOME_FIXTURES, by id) on Today, where they open from, with one dialog's
 * route open (`dialog`, as the element opens it): the home alerts with two
 * waiting and with none, the full house's first event (a place and a note),
 * and the full calendar, Home Assistant's own card. `title` is the
 * gallery's caption for it: a fixture's title describes a house, not a
 * dialog. A pages view window is `{placement}-dialog-{id}`.
 * @type {ReadonlyArray<Readonly<{id: string, fixture: string, dialog: object, title: string}>>}
 */
export const DIALOG_SNAPSHOTS = Object.freeze([
  ['alerts', 'full', {kind: 'alerts'}, 'Home alerts, two waiting'],
  ['alerts-empty', 'quiet', {kind: 'alerts'}, 'Home alerts, none waiting'],
  ['event', 'full', {kind: 'event', event: byId(HOME_FIXTURES, 'full').agenda.events[0]}, 'A calendar event with a place and a note'],
  ['calendar', 'full', {kind: 'native', native: 'calendar'}, 'The full calendar, a Home Assistant card'],
].map(([id, fixture, dialog, title]) => Object.freeze({id, fixture, dialog: Object.freeze(dialog), title})));

/**
 * A dialog of DIALOG_SNAPSHOTS (by id) as the element would see it: the home
 * fixture's states on Today at HOME_NOW with the dialog open, and the
 * fixture's agenda loaded, so screen() returns it as `{dialog}` beside the
 * page. No sky: a dialog doesn't draw one.
 * @param {string} id
 */
export function dialogSnapshot(id) {
  const found = byId(DIALOG_SNAPSHOTS, id);
  return pageSnapshot(byId(HOME_FIXTURES, found.fixture), 'today', HOME_NOW, undefined, found.dialog);
}

// A Home Assistant card's slot, which only the installed dashboard can fill.
export function placeholderCard(slot, key, config) {
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = `${config.type.replaceAll('-', ' ')} · a Home Assistant card, drawn in the installed dashboard`;
  slot.replaceChildren(note);
}
