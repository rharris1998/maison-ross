// Read-only data helpers for Maison. Every loader uses the authenticated `hass`
// object supplied by Home Assistant; this module performs no work on import.
// The one service it calls, schedule.get_schedule, only returns a schedule
// helper's configuration.

const BAD_STATES = new Set(['', 'unknown', 'unavailable']);
const MAX_HISTORY_ENTITIES = 12;
// 25 hours: Energy's chart reads from midnight, and the day the clocks go
// back is that long.
const MAX_HISTORY_MS = 25 * 60 * 60 * 1000;
const MAX_AGENDA_MS = 7 * 24 * 60 * 60 * 1000;
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function message(error) {
  return error instanceof Error ? error.message : String(error || 'Request failed');
}

function boundedWindow(start, end, maximumMs) {
  const endDate = new Date(end ?? Date.now());
  if (!Number.isFinite(endDate.getTime())) throw new TypeError('Invalid end date');
  const requestedStart = new Date(start ?? endDate.getTime() - maximumMs);
  if (!Number.isFinite(requestedStart.getTime())) throw new TypeError('Invalid start date');
  if (requestedStart >= endDate) throw new RangeError('Start must be before end');
  const startDate = new Date(Math.max(requestedStart.getTime(), endDate.getTime() - maximumMs));
  return { start: startDate, end: endDate };
}

function stateValue(state) {
  return state == null || BAD_STATES.has(String(state)) ? null : String(state);
}

// The catalogue category a reading files under: one of system.js's
// CATEGORIES ids, so each can be filtered. A binary sensor no class claims
// files under other, as an unclassified sensor does.
function categoryFor(entity) {
  const domain = String(entity?.entity_id || '').split('.')[0];
  const deviceClass = String(entity?.attributes?.device_class || '').toLowerCase();
  const unit = String(entity?.attributes?.unit_of_measurement || '').toLowerCase();
  if (deviceClass === 'temperature' || ['°c', '°f'].includes(unit)) return 'temperature';
  if (deviceClass === 'humidity' || unit === '%rh') return 'humidity';
  if (['aqi', 'carbon_dioxide', 'carbon_monoxide', 'nitrogen_dioxide', 'nitrogen_monoxide', 'nitrous_oxide', 'ozone', 'pm1', 'pm25', 'pm4', 'pm10',
    'sulphur_dioxide', 'volatile_organic_compounds', 'volatile_organic_compounds_parts'].includes(deviceClass)) return 'air-quality';
  if (['illuminance', 'pressure', 'moisture', 'battery', 'power', 'energy', 'signal_strength'].includes(deviceClass)) return deviceClass.replace('_', '-');
  if (domain === 'binary_sensor') {
    if (['motion', 'occupancy', 'presence'].includes(deviceClass)) return 'presence';
    if (['door', 'garage_door', 'opening', 'window'].includes(deviceClass)) return 'opening';
    if (['smoke', 'gas', 'problem', 'safety'].includes(deviceClass)) return 'safety';
  }
  return 'other';
}

// A sensor's state as the catalogue's reading: its state is null while it
// has none, so it is never read as a zero.
function readingFromState(entity) {
  const raw = stateValue(entity?.state);
  return {
    entityId: entity.entity_id,
    name: entity.attributes?.friendly_name || entity.entity_id,
    state: raw,
    displayValue: raw === null ? 'Unavailable' : raw,
    unit: entity.attributes?.unit_of_measurement || '',
    available: raw !== null,
    domain: entity.entity_id.split('.')[0],
    deviceClass: entity.attributes?.device_class || '',
    category: categoryFor(entity),
    lastUpdated: entity.last_updated || entity.last_changed || null,
  };
}

/**
 * Return every sensor and binary sensor currently visible to this user. Missing
 * readings stay in the list so an unavailable device never looks like a zero.
 */
export function allReadings(hass, query = '', category = 'all') {
  const needle = String(query || '').trim().toLocaleLowerCase();
  return Object.values(hass?.states || {})
    .filter(entity => /^(sensor|binary_sensor)\./.test(entity?.entity_id || ''))
    .map(entity => readingFromState(entity))
    .filter(reading => category === 'all' || reading.category === category)
    .filter(reading => !needle || [reading.entityId, reading.name, reading.displayValue, reading.unit, reading.category]
      .some(value => String(value).toLocaleLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.entityId.localeCompare(b.entityId));
}

/** Give descriptive update timing without inferring that an unchanged sensor is stale. */
// Older reports read as a date in British English and in Home Assistant's
// time zone, like every other time Maison shows, whatever the browser's own.
export function freshness(state, now = Date.now(), timeZone = undefined) {
  const raw = state?.last_reported || state?.last_updated || state?.last_changed;
  const timestamp = new Date(raw || NaN);
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(timestamp.getTime()) || !Number.isFinite(nowMs)) {
    return { label: 'Update time unavailable', dateTime: null, ageMs: null };
  }
  const ageMs = Math.max(0, nowMs - timestamp.getTime());
  const minutes = Math.floor(ageMs / 60000);
  const hours = Math.floor(ageMs / 3600000);
  let label;
  if (minutes < 1) label = 'Updated just now';
  else if (minutes < 60) label = `Updated ${minutes} min ago`;
  else if (hours < 24) label = `Updated ${hours} h ago`;
  else if (hours < 48) label = 'Updated yesterday';
  else label = `Updated ${timestamp.toLocaleString('en-GB', { timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  return { label, dateTime: timestamp.toISOString(), ageMs };
}

/** Load and normalize at most 25 hours of numeric state history. */
export async function loadHistory(hass, ids, start, end) {
  const entityIds = [...new Set(Array.isArray(ids) ? ids : [])]
    .filter(id => ENTITY_ID.test(String(id)))
    .slice(0, MAX_HISTORY_ENTITIES);
  const series = Object.fromEntries(entityIds.map(id => [id, []]));
  const errors = {};
  if (!entityIds.length) return { series, errors };
  if (typeof hass?.callApi !== 'function') {
    errors.history = 'History API unavailable';
    return { series, errors };
  }
  let window;
  try { window = boundedWindow(start, end, MAX_HISTORY_MS); }
  catch (error) { errors.history = message(error); return { series, errors }; }
  const path = `history/period/${encodeURIComponent(window.start.toISOString())}`
    + `?end_time=${encodeURIComponent(window.end.toISOString())}`
    + `&filter_entity_id=${encodeURIComponent(entityIds.join(','))}&minimal_response&no_attributes`;
  let response;
  try { response = await hass.callApi('GET', path); }
  catch (error) { errors.history = message(error); return { series, errors }; }
  if (!Array.isArray(response)) {
    errors.history = 'Invalid history response';
    return { series, errors };
  }
  response.forEach((states, index) => {
    if (!Array.isArray(states)) return;
    const id = states.find(item => item?.entity_id)?.entity_id || entityIds[index];
    if (!Object.hasOwn(series, id)) return;
    const byTimestamp = new Map();
    for (const item of states) {
      const timestamp = item?.last_changed || item?.last_updated;
      const time = new Date(timestamp || NaN).getTime();
      if (!Number.isFinite(time)) continue;
      const numeric = Number(item?.state);
      const value = stateValue(item?.state) !== null && Number.isFinite(numeric) ? numeric : null;
      // Recorder can return two changes with the same timestamp. The later
      // entry is the final state at that instant and therefore wins.
      byTimestamp.set(time, { timestamp: new Date(time).toISOString(), value });
    }
    series[id] = [...byTimestamp.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  });
  return { series, errors };
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// A schedule time as "HH:MM". The end of the day, which Home Assistant keeps
// as time.max and returns as "23:59:59.999999" (or "24:00:00" as written),
// is "24:00". null when it is not a time.
function scheduleClock(value, end) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, hour, minute, second = '00'] = match;
  if (end && ((hour === '24' && minute === '00' && second === '00') || (hour === '23' && minute === '59' && second === '59'))) return '24:00';
  return Number(hour) < 24 && Number(minute) < 60 ? `${hour}:${minute}` : null;
}

// A schedule helper's week as schedule.get_schedule returns it
// ({monday: [{from, to, data?}], …}), as {monday: [{from, to}], …} sorted by
// start. null unless every day is a list of readable periods, so a partial
// answer never shows as setback.
function scheduleWeek(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const week = {};
  for (const day of WEEKDAYS) {
    if (!Array.isArray(raw[day])) return null;
    const periods = raw[day].map(period => ({ from: scheduleClock(period?.from, false), to: scheduleClock(period?.to, true) }));
    if (periods.some(period => period.from === null || period.to === null || period.to <= period.from)) return null;
    week[day] = periods.sort((a, b) => a.from.localeCompare(b.from));
  }
  return week;
}

/**
 * Load schedule helpers' weekly periods through the read-only
 * schedule.get_schedule service, one call per helper so one failure keeps the
 * others. It only reads the helper's configuration; nothing is switched.
 */
export async function loadSchedules(hass, scheduleIds) {
  const ids = [...new Set(Array.isArray(scheduleIds) ? scheduleIds : [])]
    .filter(id => /^schedule\.[a-z0-9_]+$/.test(String(id)));
  const schedules = {};
  const errors = {};
  if (!ids.length) return { schedules, errors };
  if (typeof hass?.callWS !== 'function') {
    for (const id of ids) errors[id] = 'Schedule API unavailable';
    return { schedules, errors };
  }
  const settled = await Promise.allSettled(ids.map(id => hass.callWS({
    type: 'call_service', domain: 'schedule', service: 'get_schedule', target: { entity_id: id }, return_response: true,
  })));
  settled.forEach((result, index) => {
    const id = ids[index];
    const week = result.status === 'fulfilled' ? scheduleWeek(result.value?.response?.[id]) : null;
    if (week) schedules[id] = week;
    else errors[id] = result.status === 'rejected' ? message(result.reason) : 'Invalid schedule response';
  });
  return { schedules, errors };
}

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? match.slice(1).map(Number) : null;
}

// Convert a calendar-only date to midnight in Home Assistant's configured zone.
function zonedTime(parts, timeZone) {
  if (!parts) return NaN;
  const [year, month, day, hour = 0, minute = 0, second = 0] = parts;
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    let guess = target;
    for (let pass = 0; pass < 2; pass += 1) {
      const seen = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
      const represented = Date.UTC(+seen.year, +seen.month - 1, +seen.day, +seen.hour, +seen.minute, +seen.second);
      guess += target - represented;
    }
    return guess;
  } catch {
    return target;
  }
}

function zonedMidnight(date, timeZone) {
  return zonedTime(dateParts(date), timeZone);
}

function naiveDateTimeParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(String(value || ''));
  return match ? match.slice(1).map(part => Number(part || 0)) : null;
}

function calendarBoundary(value, timeZone) {
  if (typeof value === 'object' && value) value = value.dateTime ?? value.date;
  if (dateParts(value)) return { raw: value, allDay: true, time: zonedMidnight(value, timeZone) };
  const naive = naiveDateTimeParts(value);
  const time = naive ? zonedTime(naive, timeZone) : new Date(value || NaN).getTime();
  return { raw: value || null, allDay: false, time };
}

function normalizeEvent(event, calendarId, timeZone, source = 'api') {
  const start = calendarBoundary(event?.start ?? event?.start_time, timeZone);
  const end = calendarBoundary(event?.end ?? event?.end_time, timeZone);
  if (!Number.isFinite(start.time) || !Number.isFinite(end.time) || end.time <= start.time) return null;
  return {
    calendarId,
    summary: String(event?.summary ?? event?.message ?? 'Untitled event'),
    description: event?.description == null ? '' : String(event.description),
    location: event?.location == null ? '' : String(event.location),
    start: start.raw,
    end: end.raw,
    startMs: start.time,
    endMs: end.time,
    allDay: start.allDay && end.allDay,
    source,
    partial: source === 'state-fallback',
  };
}

function calendarFallback(hass, id, timeZone) {
  const attributes = hass?.states?.[id]?.attributes;
  if (!attributes?.message || !attributes?.start_time || !attributes?.end_time) return null;
  const fallback = attributes.all_day ? {
    ...attributes,
    start_time: { date: String(attributes.start_time).slice(0, 10) },
    end_time: { date: String(attributes.end_time).slice(0, 10) },
  } : attributes;
  return normalizeEvent(fallback, id, timeZone, 'state-fallback');
}

/** Load up to seven days of calendar events, preserving a per-calendar status. */
export async function loadAgenda(hass, calendarIds, start, end) {
  const ids = [...new Set(Array.isArray(calendarIds) ? calendarIds : [])]
    .filter(id => /^calendar\.[a-z0-9_]+$/.test(String(id)));
  const events = [];
  const errors = {};
  const status = {};
  let window;
  try { window = boundedWindow(start, end, MAX_AGENDA_MS); }
  catch (error) {
    for (const id of ids) { errors[id] = message(error); status[id] = 'error'; }
    return { events, errors, status };
  }
  const timeZone = hass?.config?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const overlaps = event => event.endMs > window.start.getTime() && event.startMs < window.end.getTime();
  if (typeof hass?.callApi !== 'function') {
    for (const id of ids) {
      errors[id] = 'Calendar API unavailable';
      const fallback = calendarFallback(hass, id, timeZone);
      if (fallback && overlaps(fallback)) { events.push(fallback); status[id] = 'error-with-fallback'; }
      else status[id] = 'error';
    }
    return { events: events.sort((a, b) => a.startMs - b.startMs), errors, status };
  }
  const settled = await Promise.allSettled(ids.map(id => hass.callApi('GET',
    `calendars/${encodeURIComponent(id)}?start=${encodeURIComponent(window.start.toISOString())}&end=${encodeURIComponent(window.end.toISOString())}`)));
  settled.forEach((result, index) => {
    const id = ids[index];
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      status[id] = 'ok';
      for (const raw of result.value) {
        const event = normalizeEvent(raw, id, timeZone);
        if (event && overlaps(event)) events.push(event);
      }
      return;
    }
    errors[id] = result.status === 'rejected' ? message(result.reason) : 'Invalid calendar response';
    const fallback = calendarFallback(hass, id, timeZone);
    if (fallback && overlaps(fallback)) { events.push(fallback); status[id] = 'error-with-fallback'; }
    else status[id] = 'error';
  });
  events.sort((a, b) => a.startMs - b.startMs || a.summary.localeCompare(b.summary));
  return { events, errors, status };
}
