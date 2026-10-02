import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  allReadings,
  freshness,
  loadAgenda,
  loadHistory,
  loadSchedules,
} from '../config/www/maison/data.js';

const state = (entityId, value, attributes = {}, updated = '2026-09-16T08:00:00Z') => ({
  entity_id: entityId,
  state: value,
  attributes,
  last_changed: updated,
  last_updated: updated,
});

test('all readings is a searchable complete catalog and keeps unavailable values', () => {
  const hass = { states: {
    'sensor.temperature': state('sensor.temperature', 'unavailable', { friendly_name: 'Nursery temperature', device_class: 'temperature', unit_of_measurement: '°C' }),
    'binary_sensor.motion': state('binary_sensor.motion', 'off', { friendly_name: 'Hall motion', device_class: 'motion' }),
    'switch.hall': state('switch.hall', 'off', { friendly_name: 'Hall switch' }),
  } };
  const all = allReadings(hass);
  assert.equal(all.length, 2);
  assert.equal(all.find(reading => reading.entityId === 'sensor.temperature').available, false);
  assert.equal(allReadings(hass, 'nursery').length, 1);
  assert.equal(allReadings(hass, '', 'presence')[0].entityId, 'binary_sensor.motion');
});

test('freshness prefers last_reported and only describes update time', () => {
  const reading = {
    last_reported: '2026-09-16T11:59:40Z',
    last_updated: '2026-09-16T10:00:00Z',
    last_changed: '2026-09-15T10:00:00Z',
  };
  assert.deepEqual(freshness(reading, '2026-09-16T12:00:00Z'), {
    label: 'Updated just now', dateTime: '2026-09-16T11:59:40.000Z', ageMs: 20000,
  });
  assert.equal(freshness({ last_updated: '2026-09-16T11:47:00Z' }, '2026-09-16T12:00:00Z').label, 'Updated 13 min ago');
  assert.equal(freshness({ last_updated: '2026-09-15T10:00:00Z' }, '2026-09-16T12:00:00Z').label, 'Updated yesterday');
  assert.equal(freshness({}, '2026-09-16T12:00:00Z').label, 'Update time unavailable');
});

// Home status shows the date of an older report in British English and in
// Home Assistant's time zone, whatever the browser's own language and zone.
test('an older report reads as its date and time in Home Assistant’s time zone, in British English', () => {
  const reading = { last_reported: '2026-09-25T10:30:00Z' }, now = Date.parse('2026-09-27T10:30:00Z');
  assert.equal(freshness(reading, now, 'Europe/Brussels').label, 'Updated 25 Sept, 12:30');
  assert.equal(freshness(reading, now, 'UTC').label, 'Updated 25 Sept, 10:30');
  assert.equal(freshness(reading, now, 'America/New_York').label, 'Updated 25 Sept, 06:30');
  assert.equal(freshness({ last_reported: '2026-09-24T23:30:00Z' }, now, 'Europe/Brussels').label, 'Updated 25 Sept, 01:30', 'the day in Brussels, not in UTC');
  // A French browser in New York reads the same.
  const script = `import {freshness} from ${JSON.stringify(new URL('../config/www/maison/data.js', import.meta.url).href)};
    process.stdout.write(freshness({last_reported: '2026-09-25T10:30:00Z'}, ${now}, 'Europe/Brussels').label);`;
  const env = { ...process.env, LANG: 'fr_BE.UTF-8', LC_ALL: 'fr_BE.UTF-8', TZ: 'America/New_York' };
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' }), 'Updated 25 Sept, 12:30');
});

test('history loader bounds the request, preserves zero, and removes gaps', async () => {
  let requested;
  const hass = { callApi: async (method, path) => {
    requested = { method, path };
    return [[
      state('sensor.office_temperature', '0', {}, '2026-09-16T10:00:00Z'),
      { state: 'unavailable', last_changed: '2026-09-16T10:30:00Z' },
      { state: '21.2', last_changed: '2026-09-16T11:00:00Z' },
      { state: '22.1', last_changed: '2026-09-16T11:00:00Z' },
      { state: 'unknown', last_changed: '2026-09-16T11:30:00Z' },
    ]];
  } };
  const result = await loadHistory(hass, ['sensor.office_temperature', 'bad id', 'sensor.office_temperature'],
    '2026-09-14T12:00:00Z', '2026-09-16T12:00:00Z');
  assert.equal(requested.method, 'GET');
  // At most 25 hours: Energy's chart reads from midnight, and the day the
  // clocks go back is that long.
  assert.match(requested.path, /^history\/period\/2026-09-15T11%3A00%3A00\.000Z\?/);
  assert.match(requested.path, /filter_entity_id=sensor.office_temperature/);
  assert.match(requested.path, /minimal_response&no_attributes$/);
  assert.deepEqual(result.series['sensor.office_temperature'].map(point => point.value), [0, null, 22.1, null]);
  assert.deepEqual(result.errors, {});
});

test('history loader exposes API failure instead of drawing a zero line', async () => {
  const result = await loadHistory({ callApi: async () => { throw new Error('recorder offline'); } },
    ['sensor.temperature'], '2026-09-16T10:00:00Z', '2026-09-16T12:00:00Z');
  assert.deepEqual(result.series, { 'sensor.temperature': [] });
  assert.equal(result.errors.history, 'recorder offline');
});

test('agenda normalizes timed and all-day events in Home Assistant timezone', async () => {
  const paths = [];
  const hass = {
    config: { time_zone: 'Europe/Brussels' },
    states: {},
    callApi: async (method, path) => {
      paths.push([method, path]);
      return [
        { summary: 'Lunch', start: { dateTime: '2026-09-16T12:00:00+02:00' }, end: { dateTime: '2026-09-16T13:00:00+02:00' } },
        { summary: 'School holiday', start: { date: '2026-09-17' }, end: { date: '2026-09-18' } },
      ];
    },
  };
  const result = await loadAgenda(hass, ['calendar.family'], '2026-09-16T00:00:00Z', '2026-09-20T00:00:00Z');
  assert.equal(paths[0][0], 'GET');
  assert.match(paths[0][1], /^calendars\/calendar.family\?start=2026-09-16T00%3A00%3A00\.000Z&end=2026-09-20/);
  assert.equal(result.status['calendar.family'], 'ok');
  const allDay = result.events.find(event => event.allDay);
  assert.equal(new Date(allDay.startMs).toISOString(), '2026-09-16T22:00:00.000Z');
  assert.equal(allDay.source, 'api');
});

test('agenda interprets naive fallback times in HA timezone and excludes events outside its window', async () => {
  const hass = {
    config: { time_zone: 'America/New_York' },
    states: {
      'calendar.local': state('calendar.local', 'on', {
        message: 'Local appointment', start_time: '2026-01-15 09:00:00', end_time: '2026-01-15 10:00:00',
      }),
      'calendar.next_month': state('calendar.next_month', 'off', {
        message: 'Too late', start_time: '2026-02-15 09:00:00', end_time: '2026-02-15 10:00:00',
      }),
    },
    callApi: async () => { throw new Error('calendar offline'); },
  };
  const result = await loadAgenda(hass, ['calendar.local', 'calendar.next_month'],
    '2026-01-15T00:00:00Z', '2026-01-22T00:00:00Z');
  assert.equal(result.events.length, 1);
  assert.equal(new Date(result.events[0].startMs).toISOString(), '2026-01-15T14:00:00.000Z');
  assert.equal(result.status['calendar.local'], 'error-with-fallback');
  assert.equal(result.status['calendar.next_month'], 'error');
  assert.ok(result.errors['calendar.next_month']);
});

test('calendar API errors remain explicit while current state is marked partial fallback', async () => {
  const hass = {
    config: { time_zone: 'Europe/Brussels' },
    states: {
      'calendar.family': state('calendar.family', 'on', {
        message: 'Current event', all_day: true,
        start_time: '2026-09-16 00:00:00', end_time: '2026-09-17 00:00:00',
      }),
    },
    callApi: async () => { throw new Error('calendar integration unavailable'); },
  };
  const result = await loadAgenda(hass, ['calendar.family', 'calendar.empty'],
    '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z');
  assert.equal(result.errors['calendar.family'], 'calendar integration unavailable');
  assert.equal(result.status['calendar.family'], 'error-with-fallback');
  assert.equal(result.events[0].source, 'state-fallback');
  assert.equal(result.events[0].partial, true);
  assert.equal(result.events[0].allDay, true);
  assert.equal(result.status['calendar.empty'], 'error');
});

test('schedule loader reads each helper’s week with schedule.get_schedule, and calls nothing else', async () => {
  const requests = [];
  const week = {
    monday: [{ from: '13:00:00', to: '18:00:00' }, { from: '08:00:00', to: '12:00:00', data: { note: 'kept out' } }],
    tuesday: [{ from: '00:00:00', to: '23:59:59.999999' }], wednesday: [{ from: '22:00:00', to: '24:00:00' }],
    thursday: [], friday: [], saturday: [], sunday: [],
  };
  const hass = {
    callService: async () => assert.fail('no service call: the loader only reads'),
    callWS: async request => {
      requests.push(request);
      const id = request.target.entity_id;
      if (id === 'schedule.broken') throw new Error('Entity not found');
      if (id === 'schedule.partial') return { response: { [id]: { monday: [] } } };
      if (id === 'schedule.garbled') return { response: { [id]: { ...week, friday: [{ from: '18:00:00', to: '08:00:00' }] } } };
      return { context: {}, response: { [id]: week } };
    },
  };
  const result = await loadSchedules(hass, ['schedule.office', 'schedule.office', 'schedule.broken', 'schedule.partial', 'schedule.garbled', 'sensor.office', 'schedule.Bad']);
  assert.deepEqual(requests.map(r => r.target.entity_id), ['schedule.office', 'schedule.broken', 'schedule.partial', 'schedule.garbled']);
  assert.deepEqual(requests[0], { type: 'call_service', domain: 'schedule', service: 'get_schedule', target: { entity_id: 'schedule.office' }, return_response: true });
  assert.deepEqual(Object.keys(result.schedules), ['schedule.office']);
  const office = result.schedules['schedule.office'];
  assert.deepEqual(office.monday, [{ from: '08:00', to: '12:00' }, { from: '13:00', to: '18:00' }], 'sorted, custom data dropped');
  assert.deepEqual(office.tuesday, [{ from: '00:00', to: '24:00' }], 'time.max is the end of the day');
  assert.deepEqual(office.wednesday, [{ from: '22:00', to: '24:00' }]);
  assert.deepEqual(office.sunday, []);
  assert.deepEqual(result.errors, {
    'schedule.broken': 'Entity not found', 'schedule.partial': 'Invalid schedule response', 'schedule.garbled': 'Invalid schedule response',
  });
  assert.deepEqual(await loadSchedules({}, ['schedule.office']), { schedules: {}, errors: { 'schedule.office': 'Schedule API unavailable' } });
  assert.deepEqual(await loadSchedules(hass, []), { schedules: {}, errors: {} });
});
