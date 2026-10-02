// A Maison snapshot for the tests and the gallery, in the exact shape the
// element's snapshot() builds (#27), so guard() and screen() can be driven
// without an element. `overrides` are deep-merged over the defaults: plain
// objects merge key by key, anything else (states' entities, arrays, Sets,
// Maps, null) replaces. Defaults: online, the fixtures' Brussels morning,
// nothing busy, loading or loaded.
import {CLIMATE_NOW} from './climate-fixtures.js';

const defaults = () => ({
  states: {}, online: true, now: CLIMATE_NOW, tz: 'Europe/Brussels', user: null,
  route: {page: 'today', detail: null, dialog: null},
  draft: {house: null, houseEnd: null, awayUntil: ''},
  sensors: {query: '', category: 'all', limit: 60},
  busy: new Set(), feedback: new Map(), status: '',
  loaded: {history: {}, historyLoading: new Set(), schedules: {}, agenda: {events: [], errors: {}, status: {}}, agendaLoading: false, forecasts: []},
  carLast: null,
});

const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
function merge(base, over) {
  if (over === undefined) return base;
  if (!plain(base) || !plain(over)) return over;
  const out = {...base};
  for (const [key, value] of Object.entries(over)) out[key] = merge(base[key], value);
  return out;
}

export function fixtureSnapshot(overrides = {}) {
  return merge(defaults(), overrides);
}
