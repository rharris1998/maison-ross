// The Car tab and its Today glance (#13, recomposed in #29 step 4, v34):
// carStatus's headlines, plan and controls, the page (the battery,
// charging, the charging energy, Automatic charging and the widgets they
// fill) and its two sheets (Battery, Charging energy), as screen() works
// them out from one snapshot, over every Car fixture and the page's own
// edges (car-page-fixtures.js). Every test reads the value, never HTML: its
// words, its controls, its links and its plots. The headline kept through a
// dropout is the fixture's `last`, as the element keeps it. Routing is in
// maison-car-routes, -dashboard and -screen.test.mjs; whether pressing a
// control or a link does what it shows in maison-agreement.
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {E} from '../config/www/maison/model.js';
import {CAR_DETAILS, CHARGER_OFFLINE_AFTER, carControls, carDrawerValue, carStatus, chargingEnergy, rememberedHeadline} from '../config/www/maison/car.js';
import {guard} from '../config/www/maison/guard.js';
import {iconNames} from '../config/www/maison/icons.js';
import {screen, controls, words, kit} from '../config/www/maison/screen.js';
import {COLUMNS, placeWidgets} from '../frontend/maison/src/ui/grid.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
const registered = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {get: key => registered.get(key), define: (key, value) => registered.set(key, value)};
globalThis.window = {customCards: []};
await import('../config/www/maison/maison-dashboard.js');
const Maison = registered.get('maison-dashboard');
const zone = 'Europe/Brussels';

// Every fixture the page is checked against: the Car's, then the page's own edges.
const FIXTURES = [...CAR_FIXTURES, ...CAR_PAGE_FIXTURES];
const fixture = id => structuredClone(FIXTURES.find(f => f.id === id));
// A fixture with some states changed: an object merges over the state and
// its attributes, undefined removes it.
const patched = (id, changes) => {
  const f = fixture(id);
  for (const [entity, change] of Object.entries(changes)) {
    if (change === undefined) delete f.states[entity];
    else f.states[entity] = {...f.states[entity], ...change, attributes: {...f.states[entity]?.attributes, ...change.attributes}};
  }
  return f;
};
// A fixture's snapshot on the Car at the fixtures' time, or on one of its
// sheets, or on another page. `extra` is merged in: online, busy, feedback.
const snapshot = (f, {detail = null, page = 'car', ...extra} = {}) => fixtureSnapshot({now: CAR_NOW, carLast: f.last ?? null, ...extra, states: f.states,
  route: {page, detail, dialog: null}});
const page = (f, extra) => screen(snapshot(f, extra)).page;
const sheet = (f, id, extra = {}) => screen(snapshot(f, {...extra, detail: id})).drawer;
// The Car on Today.
const glance = (f, extra = {}) => page(f, {...extra, page: 'today'}).car;
const status = (f, options = {}) => carStatus(f.states, {now: CAR_NOW, zone, last: f.last ?? null, ...options});
const headerOf = f => screen(snapshot(f)).chrome.line;
const intentOf = link => link && [link.intent.command, link.intent.entity];
// The controls of a value with this command.
const find = (value, command) => controls(value).filter(c => c.command === command);
// A fresh element whose presses reach a recording Home Assistant (#27).
function harness(states) {
  const card = Object.create(Maison.prototype), calls = [];
  card._hass = {states, connected: true, config: {time_zone: zone}, callService: async (...args) => calls.push(args)};
  card._busy = new Set(); card.render = () => {}; card.toast = () => {};
  return {card, calls};
}
const press = (card, command, entity = '', extras = {}) => card.command({command, entity, ...extras});
// Everything a reader meets: words and control labels.
const everything = value => [...words(value), ...controls(value).map(c => c.label ?? '')].join('\n');
// A reading of zero with a unit: what a missing reading must never become.
const ZERO = /(?<![\d.,])0(?:[.,]0+)?\s?(?:€|kWh|kW|W|%)(?!\w)/;
// Charging's drawn controls, in drawing order.
const drawnOf = charge => charge ? [charge.action, charge.limit?.stepper.minus, charge.limit?.stepper.plus, charge.wake?.control].filter(Boolean) : [];
const FOUR = [{id: 'battery', size: 'medium'}, {id: 'charge', size: 'medium'}, {id: 'energy', size: 'medium'}, {id: 'automatic', size: 'medium'}];
const THREE = [{id: 'battery', size: 'large'}, {id: 'energy', size: 'medium'}, {id: 'automatic', size: 'medium'}];

// ---- The status: headlines, the plan and the controls ------------------------------
test('every Car tab headline renders from a fixture, in household language', () => {
  const expected = {
    solar: ['Charging from solar', 'Following the solar surplus'],
    solar_ridethrough: ['Charging from solar', 'Briefly from the grid while solar dips'],
    offpeak: ['Charging off-peak', 'Restoring the ready reserve to 50%'],
    charge_now: ['Charge now', 'Charging to 80% without waiting'],
    economical: ['Charging (economical)', 'Grid charging now costs less over the year'],
    wait_offpeak: ['Waiting', 'For off-peak at 22:00'],
    wait_offpeak_asleep: ['Waiting', 'For off-peak at 22:00'],
    wait_sun: ['Waiting', 'For sun'],
    solar_paused: ['Waiting', 'Solar paused until 12:42'],
    house_busy: ['Waiting', 'House is busy'],
    complete: ['At charge limit', '80% reached'],
    unplugged: ['Unplugged', 'Not connected to the Charger'],
    never_confirmed: ['Unplugged', 'Not connected to the Charger'],
    automatic_off: ['Automatic charging off', 'The Car charges as Tesla decides'],
    other_vehicle: ['Another vehicle is charging', 'The Car is not the vehicle at the Charger'],
    not_verified: ['Plugged in · not yet verified', 'Wake the Car to confirm it is the vehicle at the Charger'],
    stale: ['Car data is stale', 'Wake the Car for a fresh battery level and charge limit'],
    dropout: ['Waiting', 'For off-peak at 22:00'],
    charger_offline: ['Charger offline', 'No response since 12:23'],
    power_missing: ['Power readings missing', 'Automatic charging pauses until the meters report'],
    initializing: ['Starting up', 'Restoring charging timers'],
  };
  assert.deepEqual(CAR_FIXTURES.map(f => f.id).sort(), Object.keys(expected).sort(), 'one fixture per headline row');
  for (const f of CAR_FIXTURES) {
    const s = status(f), {summary} = sheet(f, 'battery').body, g = glance(f);
    assert.deepEqual([s.headline, s.detail], expected[f.id], f.id);
    assert.equal(s.key, f.expect, f.id);
    assert.deepEqual([summary.headline, summary.detail], expected[f.id], `${f.id}: the Battery sheet`);
    // The whole glance is one link to the Car tab, named by its headline.
    assert.deepEqual(controls(g).map(c => [c.command, c.entity, c.enabled]), [['navigate', 'car', true]], f.id);
    assert.ok(g.link.ariaLabel.startsWith(`Car: ${s.headline}.`), f.id);
    // The detail is its own sentence, so it keeps its capitals ("the Charger").
    if (s.detail) assert.ok(g.link.ariaLabel.includes(` ${s.detail}.`), f.id);
    assert.equal(g.headline, s.headline, f.id);
    assert.ok(words(g).includes(s.headline), f.id);
  }
  assert.equal(status(fixture('unplugged')).policy, 'off', 'unplugged and automatic off share the policy state');
});

test('the policy reason is one tap away, never the headline', () => {
  const reason = 'Cloud ride-through at 6 A; temporary grid import allowed until 12:34.', {summary, why} = sheet(fixture('solar_ridethrough'), 'battery').body;
  assert.deepEqual([why.title, why.paragraphs[0]], ['Why', reason]);
  assert.match(why.paragraphs[1], /Conservative off-peak fallback/);
  assert.ok(![summary.headline, summary.detail].some(line => line.includes(reason)));
  assert.deepEqual(why.logs, [{label: 'Last command · 11:50', text: 'Refreshing vehicle data'}, {label: 'Readiness check · 09:30', text: '27 Sep 09:28: Ready reserve satisfied (63%).'}]);
});

test('another vehicle is the Verified session module’s answer, not Maison’s', () => {
  const other = fixture('other_vehicle');
  assert.equal(status(other).otherVehicle, true);
  // The module needs fresh data from an online Car to say so; otherwise it is only unverified.
  other.states[E.carSession].state = 'unverified';
  assert.equal(status(other).headline, 'Plugged in · not yet verified');
  const idle = fixture('other_vehicle'); idle.states[E.carPower].state = '0.0052';
  assert.equal(status(idle).headline, 'Another vehicle is plugged in');
  assert.deepEqual(status(fixture('other_vehicle')).controls, {chargeNow: {enabled: false, label: 'Charge now to 80%'}, wake: false});
  assert.equal(page(fixture('other_vehicle')).charge, null, 'nothing to charge for another vehicle');
});

test('a Charger dropout keeps the last headline for five minutes, then shows Charger offline', () => {
  const f = fixture('dropout'), since = Date.parse(f.states[E.carConnected].last_changed);
  const at = ms => status(f, {now: since + ms}), summary = extra => sheet(f, 'battery', extra).body.summary;
  assert.equal(at(CHARGER_OFFLINE_AFTER - 1000).headline, 'Waiting');
  assert.equal(at(CHARGER_OFFLINE_AFTER - 1000).reconnecting, true);
  assert.equal(glance(f, {now: since + 60000}).headline, 'Waiting');
  assert.equal(summary({now: since + 60000}).hint, 'Reconnecting to the Charger…');
  assert.equal(at(CHARGER_OFFLINE_AFTER).headline, 'Charger offline');
  assert.equal(at(CHARGER_OFFLINE_AFTER).reconnecting, false);
  assert.deepEqual([summary({now: since + CHARGER_OFFLINE_AFTER}).headline, summary({now: since + CHARGER_OFFLINE_AFTER}).hint], ['Charger offline', null]);
  assert.equal(status(f, {now: since + 60000, last: null}).headline, 'Reconnecting to the Charger', 'no remembered headline after a reload');
  assert.equal(summary({now: since + 60000, carLast: null}).hint, null, 'nothing kept, so nothing to say it is reconnecting');
  // The Charger's own state decides: a policy that lags it never jumps to offline.
  const lag = fixture('wait_offpeak'); lag.states[E.carPolicy].state = 'connection_unavailable';
  assert.equal(status(lag).headline, 'Reconnecting to the Charger');
  const unknown = fixture('unplugged'); unknown.states[E.carPolicy].state = 'unavailable';
  assert.equal(status(unknown).headline, 'Unplugged', 'unplugged needs only the Charger');
  unknown.states[E.carConnected].state = 'on';
  assert.equal(status(unknown).headline, 'Charging status unavailable');
  // A disabled Automatic charging keeps the policy at off, but the Charger is still only reconnecting.
  f.states[E.carPolicy].state = 'off';
  assert.equal(status(f, {now: since + 60000}).reconnecting, true);
});

test('the element remembers the last headline outside a dropout as each state update arrives, in memory only', t => {
  t.mock.timers.enable({apis: ['Date'], now: CAR_NOW});
  const f = fixture('wait_offpeak'), card = Object.create(Maison.prototype);
  card._native = new Map(); card._busy = new Set(); card._page = 'car'; card._modal = 'battery'; card.render = () => {};
  const update = states => {card.hass = {states, connected: true, config: {time_zone: zone}};};
  const shown = () => screen(card.snapshot()).drawer.body.summary;
  update(f.states);
  assert.equal(shown().headline, 'Waiting');
  assert.deepEqual(card._carLast, {key: 'wait_offpeak', headline: 'Waiting', detail: 'For off-peak at 22:00'});
  const dropout = {...f.states, [E.carConnected]: {...f.states[E.carConnected], state: 'unavailable', last_changed: new Date(CAR_NOW - 60000).toISOString()},
    [E.carPolicy]: {...f.states[E.carPolicy], state: 'connection_unavailable'}};
  update(dropout);
  const during = shown();
  assert.deepEqual([during.headline, during.detail, during.hint], ['Waiting', 'For off-peak at 22:00', 'Reconnecting to the Charger…']);
  assert.equal(card._carLast.headline, 'Waiting', 'a dropout keeps the headline it had');
  // Drawing never changes what the next update keeps.
  const kept = card._carLast; shown(); screen(card.snapshot()); assert.equal(card._carLast, kept);
  t.mock.timers.tick(CHARGER_OFFLINE_AFTER);
  assert.equal(shown().headline, 'Charger offline');
  update(dropout);
  assert.equal(card._carLast.headline, 'Charger offline');
  // rememberedHeadline() itself: the new headline outside a dropout, else the one given.
  const last = {key: 'wait_sun', headline: 'Waiting', detail: 'For sun'};
  assert.equal(rememberedHeadline(dropout, {now: CAR_NOW, zone, last}), last);
  assert.equal(rememberedHeadline(dropout, {now: CAR_NOW, zone, last: null}), null);
  assert.deepEqual(rememberedHeadline(f.states, {now: CAR_NOW, zone, last}), {key: 'wait_offpeak', headline: 'Waiting', detail: 'For off-peak at 22:00'});
});

test('controls needing fresh data are disabled while the Car sleeps or the session is unverified', () => {
  for (const id of ['wait_offpeak_asleep', 'not_verified', 'stale']) {
    const s = status(fixture(id)), value = page(fixture(id));
    assert.deepEqual([s.canCommand, s.controls.chargeNow.enabled], [false, false], id);
    // Charging asks for Wake instead: no Charge now and no stepper to press in vain.
    assert.deepEqual([value.charge.kind, find(value, 'charge-now'), find(value, 'charge-limit')], ['asleep', [], []], id);
  }
  const live = page(fixture('wait_offpeak'));
  assert.deepEqual(find(live, 'charge-now').map(c => c.enabled), [true]);
  assert.deepEqual(find(live, 'charge-limit').map(c => c.enabled), [true, true]);
  assert.equal(page(fixture('dropout')).charge.line, 'Controls return when the Charger reconnects.');
  // Offline, only the sheets still open: a link is a navigation.
  assert.deepEqual(controls(page(fixture('wait_offpeak'), {online: false})).filter(c => c.enabled).map(c => [c.command, c.entity]), [['detail', 'battery'], ['detail', 'charging-energy']],
    'no commands while Home Assistant is disconnected');
});

test('Charge now shows its target, and Return to automatic replaces it while active', () => {
  const f = fixture('wait_offpeak'); f.states[E.carLimit].state = '85';
  assert.equal(status(f).controls.chargeNow.label, 'Charge now to 85%');
  assert.deepEqual(page(f).charge.action, {intent: {command: 'charge-now', entity: E.carNow}, label: 'Charge now to 85%', icon: 'energy', enabled: true});
  assert.equal(page(f).charge.kind, 'ready');
  assert.equal(status(fixture('wait_offpeak_asleep')).controls.chargeNow.label, 'Charge now', 'no target from a last confirmed limit');
  assert.deepEqual(find(page(patched('wait_offpeak', {[E.carLimit]: {state: 'unavailable'}})), 'charge-now').map(c => c.label), ['Charge now'], 'nor without a live limit');
  const active = page(fixture('charge_now'));
  assert.deepEqual(find(active, 'charge-automatic').map(c => [c.label, c.enabled]), [['Return to automatic', true]]);
  assert.deepEqual(find(active, 'charge-now'), []);
  assert.equal(active.charge.kind, 'override');
  const asleep = fixture('charge_now'); asleep.states[E.carOnline].state = 'off';
  assert.equal(status(asleep).controls.chargeNow.enabled, true, 'cancelling never waits for fresh data');
  assert.equal(find(page(asleep), 'charge-automatic')[0].enabled, true);
  assert.equal(status(fixture('complete')).controls.chargeNow.enabled, false, 'nothing to charge at the limit');
  assert.deepEqual(find(page(fixture('complete')), 'charge-now'), [], 'so Charge now isn’t drawn');
});

test('the Charge limit stepper moves 5% within the entity limits and only for a verified, fresh session', async t => {
  t.mock.timers.enable({apis: ['Date'], now: CAR_NOW});
  const f = fixture('wait_offpeak'), {card, calls} = harness(f.states);
  await press(card, 'charge-limit', E.carLimit, {direction: 1});
  assert.deepEqual(calls, [['number', 'set_value', {value: 85, entity_id: E.carLimit}]]);
  const top = fixture('wait_offpeak'); top.states[E.carLimit].state = '98';
  const high = harness(top.states); await press(high.card, 'charge-limit', E.carLimit, {direction: 1});
  assert.deepEqual(high.calls, [['number', 'set_value', {value: 100, entity_id: E.carLimit}]]);
  for (const id of ['wait_offpeak_asleep', 'not_verified', 'stale', 'unplugged', 'other_vehicle', 'dropout']) {
    const blocked = harness(fixture(id).states);
    await press(blocked.card, 'charge-limit', E.carLimit, {direction: 1});
    await press(blocked.card, 'charge-now', E.carNow);
    assert.deepEqual(blocked.calls, [], id);
  }
  // At 100% there is nothing to raise: the page disables only Raise, and the press is refused.
  const full = fixture('wait_offpeak'); full.states[E.carLimit].state = '100';
  const max = harness(full.states); await press(max.card, 'charge-limit', E.carLimit, {direction: 1});
  assert.deepEqual(max.calls, []);
  max.card._page = 'car';
  assert.deepEqual(find(screen(max.card.snapshot()).page, 'charge-limit').map(c => [c.direction, c.enabled]), [[-1, true], [1, false]]);
  const low = fixture('wait_offpeak'); low.states[E.carLimit].state = '50';
  assert.deepEqual(find(page(low), 'charge-limit').map(c => [c.direction, c.enabled]), [[-1, false], [1, true]], 'and at 50% only Lower');
  const now = harness(fixture('wait_offpeak').states); await press(now.card, 'charge-now', E.carNow);
  assert.deepEqual(now.calls, [['script', 'turn_on', {entity_id: E.carNow}]]);
  const value = page(f), {limit} = value.charge;
  assert.deepEqual(find(value, 'charge-limit').map(c => c.label), ['Lower the charge limit by 5%', 'Raise the charge limit by 5%']);
  assert.deepEqual([limit.title, limit.detail, limit.stepper.outputLabel, limit.stepper.output], ['Charge limit', 'Shared with automatic charging', 'Charge limit', '80%']);
  assert.doesNotMatch(everything(value), /Tesla limit|Edit limit/);
});

test('Wake appears only when Car data is stale or the session is not yet verified', () => {
  const shown = CAR_FIXTURES.filter(f => status(f).controls.wake).map(f => f.id).sort();
  assert.deepEqual(shown, ['not_verified', 'stale', 'wait_offpeak_asleep']);
  for (const f of CAR_FIXTURES) {
    assert.deepEqual(find(page(f), 'charge-refresh').map(c => [c.entity, c.label, c.enabled]), shown.includes(f.id) ? [[E.carRefresh, 'Wake', true]] : [], f.id);
    assert.equal((page(f).charge?.wake ?? null) === null, !shown.includes(f.id), f.id);
  }
});

test('last confirmed readings carry their time and are never presented as live', () => {
  const asleep = fixture('wait_offpeak_asleep'), s = status(asleep), {battery} = page(asleep);
  assert.deepEqual([s.battery.value, s.battery.live], [42, false]);
  assert.deepEqual([battery.freshness, battery.ring.plot.stale], ['Last confirmed 10:00', true]);
  assert.equal(battery.ring.ariaLabel, 'Battery 42%, ready reserve 50%, charge limit 80%, last confirmed');
  const g = glance(asleep);
  assert.equal(g.lastConfirmed, 'Last confirmed 10:00');
  assert.match(g.link.ariaLabel, /Battery 42% · last confirmed 10:00\./);
  assert.equal(g.bar.stale, true);
  const live = page(fixture('wait_offpeak')).battery;
  assert.deepEqual([live.freshness, live.ring.plot.stale, glance(fixture('wait_offpeak')).bar.stale], ['Live', false, false]);
  assert.equal(glance(fixture('wait_offpeak')).lastConfirmed, null);
  const yesterday = fixture('wait_offpeak_asleep');
  yesterday.states[E.carLastBattery].attributes.confirmed_at = new Date(CAR_NOW - 20 * 3600000).toISOString();
  assert.equal(page(yesterday).battery.freshness, 'Last confirmed Sat 16:30');
  const none = fixture('never_confirmed');
  assert.equal(page(none).battery.freshness, 'Not confirmed yet');
  assert.deepEqual(sheet(none, 'battery').body.readings.rows.slice(0, 2).map(r => r.value), ['—', '—']);
  assert.equal(glance(none).lastConfirmed, null);
  for (const value of [page(none), glance(none)]) assert.doesNotMatch(JSON.stringify(value), /(^|[^\d])0%/);
  const unplugged = page(fixture('unplugged'));
  assert.deepEqual(controls(unplugged).filter(c => c.command.startsWith('charge-')), [], 'unplugged is status only');
  assert.deepEqual(controls(unplugged).map(c => [c.command, c.entity, c.enabled]), [['detail', 'battery', true], ['detail', 'charging-energy', true], ['toggle', E.carSmart, true]],
    'the setting and the sheets stay reachable');
});

test('the readiness plan and Tesla estimate follow the policy and actual charging', () => {
  const plan = f => sheet(f, 'battery').body.plan, reading = (f, title) => sheet(f, 'battery').body.readings.rows.find(r => r.title === title) ?? null;
  assert.equal(status(fixture('wait_offpeak')).plan, 'Below reserve: restores to 50% from 22:00');
  assert.equal(status(fixture('offpeak')).plan, 'Below reserve: restoring to 50% now');
  assert.equal(status(fixture('wait_sun')).plan, 'Reserve met: tops up from solar toward 80%, no deadline');
  assert.equal(status(fixture('economical')).plan, 'Reserve met: tops up while grid charging is economical toward 80%, no deadline');
  for (const id of ['automatic_off', 'not_verified', 'stale', 'unplugged']) assert.equal(status(fixture(id)).plan, '', id);
  assert.deepEqual([plan(fixture('wait_offpeak')).line, plan(fixture('automatic_off'))], ['Below reserve: restores to 50% from 22:00', null]);
  assert.equal(status(fixture('solar')).estimate, 'Tesla estimates 80% at 14:40');
  assert.equal(reading(fixture('solar'), 'Tesla’s estimate').value, '80% at 14:40');
  const idle = fixture('solar'); idle.states[E.carPower].state = '0.0052';
  assert.equal(status(idle).estimate, '', 'no estimate unless the Charger is delivering power');
  assert.equal(reading(idle, 'Tesla’s estimate'), null);
  const conflict = fixture('wait_offpeak'); conflict.states[E.carLimit].state = '45';
  Object.assign(conflict.states[E.carPolicy].attributes, {reserve_conflict: true});
  const s = status(conflict);
  assert.equal(s.reserveTarget, 45);
  assert.equal(s.plan, 'Below reserve: restores to 45% from 22:00');
  assert.match(plan(conflict).note, /charge limit is below the ready reserve/);
  assert.equal(plan(fixture('wait_offpeak')).note, null);
  const reserve = fixture('wait_offpeak'); reserve.states[E.carPolicy].attributes.ready_reserve = 40;
  assert.equal(status(reserve).plan, 'Reserve met: tops up from solar toward 80%, no deadline', 'the reserve comes from the policy, not a literal');
  // The Charger's row is what the Charger itself measures, apart from the plan.
  assert.deepEqual([reading(fixture('solar'), 'Charger').value, reading(fixture('solar'), 'Charger').detail], ['3.80 kW', 'Delivering power']);
  assert.equal(reading(fixture('wait_offpeak'), 'Charger').detail, 'Not delivering power');
  const silent = fixture('wait_offpeak'); silent.states[E.carPower].state = 'unavailable';
  assert.deepEqual([reading(silent, 'Charger').value, reading(silent, 'Charger').detail], ['—', 'No power reading']);
  assert.equal(reading(fixture('unplugged'), 'Charger'), null, 'only while connected');
});

test('an off-peak start after midnight reads as tomorrow', () => {
  // The policy says 'Tomorrow 11:00' when the meter reads peak between 22:00 and midnight.
  const late = fixture('wait_offpeak'); late.states[E.carPolicy].attributes.next_offpeak = 'Tomorrow 11:00';
  const s = status(late), {summary, plan} = sheet(late, 'battery').body;
  assert.deepEqual([s.headline, s.detail], ['Waiting', 'For off-peak at 11:00 tomorrow']);
  assert.equal(s.plan, 'Below reserve: restores to 50% from 11:00 tomorrow');
  assert.deepEqual([summary.detail, plan.line], ['For off-peak at 11:00 tomorrow', 'Below reserve: restores to 50% from 11:00 tomorrow']);
});

test('charging energy shows kWh by source since the counting start, then per billing year', () => {
  const f = fixture('wait_offpeak'), shown = () => [page(f).chargingEnergy.figure.label, sheet(f, 'charging-energy').body.rows.map(r => r.value)];
  assert.deepEqual(chargingEnergy(f.states, zone), {period: 'Since 29 Aug', rows: [['Grid off-peak', 167.315, 'moon'], ['Grid peak', 44.917, 'grid'], ['Solar', 83.528, 'sun']]});
  assert.deepEqual(shown(), ['Since 29 Aug', ['167 kWh', '84 kWh', '45 kWh']]);
  assert.doesNotMatch(JSON.stringify([page(f).chargingEnergy, sheet(f, 'charging-energy')]), /€/);
  f.states[E.carEnergySolar].attributes.counting_since = '2027-06-30T22:00:00+00:00';
  assert.equal(chargingEnergy(f.states, zone).period, 'This billing year');
  f.states[E.carEnergySolar].state = 'unavailable';
  assert.deepEqual(chargingEnergy(f.states, zone).rows[2], ['Solar', null, 'sun']);
  assert.deepEqual(shown(), ['This billing year', ['167 kWh', '—', '45 kWh']]);
});

test('Automatic charging is a switch named Automatic charging, with a note when it can’t be used', () => {
  const on = page(fixture('wait_offpeak')).automatic, off = page(fixture('automatic_off')).automatic;
  assert.deepEqual(controls(on), [{command: 'toggle', entity: E.carSmart, direction: undefined, label: 'Automatic charging', enabled: true, selected: true}]);
  assert.deepEqual([on.detail, on.note], ['Charges when it costs least over the year', null]);
  assert.deepEqual([off.switch.selected, off.detail], [false, 'Off: the Car charges as Tesla decides']);
  assert.equal(on.switch.label, undefined, 'the switch has no visible label of its own');
  const gone = fixture('wait_offpeak'); gone.states[E.carSmart].state = 'unavailable';
  assert.deepEqual([page(gone).automatic.switch.enabled, page(gone).automatic.note], [false, 'Unavailable']);
  const offline = page(fixture('wait_offpeak'), {online: false}).automatic;
  assert.deepEqual([offline.switch.enabled, offline.note], [false, 'Offline']);
});

test('the Car has its own tab; Energy and Today don’t repeat it', async t => {
  t.mock.timers.enable({apis: ['Date'], now: CAR_NOW});
  const {card} = harness({...fixture('wait_offpeak').states, [E.solar]: {state: '0', attributes: {}}, [E.offPeakNow]: {state: 'on', attributes: {}}, [E.priceAllIn]: {state: '0.3', attributes: {}}});
  globalThis.location = {hash: '#car', pathname: '/maison-home/home', search: ''};
  try {assert.equal(card.readPage(), 'car');} finally {delete globalThis.location;}
  card._page = 'car';
  const tab = screen(card.snapshot()).page;
  assert.equal(tab.id, 'car');
  assert.equal(tab.legacy, undefined, 'React draws the Car tab from its value');
  card._page = 'today';
  const today = screen(card.snapshot()).page;
  assert.deepEqual(controls(today.car).map(c => [c.command, c.entity]), [['navigate', 'car']]);
  assert.doesNotMatch(everything(today.car), /Model 3|Vehicle controls/);
  assert.deepEqual(controls(today).filter(c => c.command.startsWith('charge-')), [], 'Today sends no charging command');
  card._page = 'energy';
  const energy = screen(card.snapshot()).page;
  assert.equal(energy.id, 'energy');
  assert.deepEqual(controls(energy).filter(c => c.command.startsWith('charge-') || c.entity === E.carPolicy), [], 'Energy sends no charging command');
  assert.doesNotMatch(everything(energy), /Charging policy|Charge now|Charge limit|Model 3/);
  await press(card, 'vehicle');
  assert.equal(card._dialog ?? null, null, 'no vehicle dialog');
  for (const key of ['carRange', 'carCharge', 'carSwitch', 'carLock']) assert.equal(E[key], undefined, key);
});

test('carControls and carStatus drive the Car guard', () => {
  const f = fixture('wait_offpeak'), allowed = command => guard({command, entity: E.carLimit, direction: 1}, fixtureSnapshot({states: f.states, now: CAR_NOW})) !== null;
  assert.equal(carControls(f.states, CAR_NOW).canCommand, true);
  assert.deepEqual([allowed('charge-limit'), allowed('charge-now'), allowed('charge-refresh')], [true, true, false]);
  f.states[E.carSession].state = 'unverified';
  const s = carStatus(f.states, {now: CAR_NOW, zone});
  assert.deepEqual([s.canCommand, s.controls.chargeNow.enabled, s.controls.wake], [false, false, true]);
  assert.deepEqual([allowed('charge-limit'), allowed('charge-now'), allowed('charge-refresh')], [false, false, true], 'an unverified session: only Wake');
});

// ---- Each fixture ------------------------------------------------------------------
// Each card in one line or a few: the battery (its figure, the ring's
// tone, what happens next, the ticks in words and whether it is live), the
// form of charging with its action, limit, Wake and line, and the charging
// energy (the period, the sum, the bar and the legend).
function summary(value) {
  const {battery: b, charge: c, chargingEnergy: e} = value;
  return {
    battery: [b.label, `${b.ring.plot.tone}${b.ring.plot.stale ? ', stale' : ''}`, b.line, b.legend.map(l => l.text).join(' · '), b.freshness],
    charge: c && [c.kind, c.action?.label ?? null, c.limit?.stepper.output ?? null, c.wake?.title ?? null, c.line],
    energy: [e.figure.label, [e.figure.value, e.figure.unit].filter(Boolean).join(' '), e.bar.kind, ...e.legend.map(l => l.text)],
  };
}

test('every fixture reads in household language on the Car page', () => {
  const ENERGY = ['Since 29 Aug', '296 kWh', 'split', 'Off-peak 167', 'Solar 84', 'Peak 45'], TICKS = 'Reserve 50% · Limit 80%';
  const READY = ['ready', 'Charge now to 80%', '80%', null, null], ASLEEP = ['asleep', null, null, 'The Car is asleep', null];
  const TOPS_UP = 'Reserve met: tops up from solar toward 80%', RECONNECT = 'Controls return when the Charger reconnects.';
  const expected = {
    solar: {battery: ['63%', 'green', TOPS_UP, TICKS, 'Live · Charger 3.80 kW'], charge: READY, energy: ENERGY},
    solar_ridethrough: {battery: ['63%', 'green', TOPS_UP, TICKS, 'Live · Charger 1.40 kW'], charge: READY, energy: ENERGY},
    offpeak: {battery: ['38%', 'green', 'Below reserve: restoring to 50% now', TICKS, 'Live · Charger 7.20 kW'], charge: READY, energy: ENERGY},
    charge_now: {battery: ['63%', 'green', 'To 80%, then back to automatic', TICKS, 'Live · Charger 7.20 kW'], charge: ['override', 'Return to automatic', '80%', null, null], energy: ENERGY},
    economical: {battery: ['63%', 'green', 'Reserve met: tops up from the grid toward 80%', TICKS, 'Live · Charger 7.20 kW'], charge: READY, energy: ENERGY},
    // The header says when off-peak starts.
    wait_offpeak: {battery: ['42%', 'gray', 'Below reserve: restores to 50% off-peak', TICKS, 'Live'], charge: READY, energy: ENERGY},
    wait_offpeak_asleep: {battery: ['42%', 'gray, stale', 'Below reserve: restores to 50% off-peak', TICKS, 'Last confirmed 10:00'], charge: ASLEEP, energy: ENERGY},
    wait_sun: {battery: ['63%', 'gray', TOPS_UP, TICKS, 'Live'], charge: READY, energy: ENERGY},
    solar_paused: {battery: ['63%', 'gray', TOPS_UP, TICKS, 'Live'], charge: READY, energy: ENERGY},
    house_busy: {battery: ['63%', 'gray', TOPS_UP, TICKS, 'Live'], charge: READY, energy: ENERGY},
    // The headline says the Car is at the limit, so the line doesn't, and there is nothing to Charge now.
    complete: {battery: ['80%', 'gray', null, TICKS, 'Live'], charge: ['ready', null, '80%', null, null], energy: ENERGY},
    unplugged: {battery: ['63%', 'gray, stale', null, TICKS, 'Last confirmed 10:00'], charge: null, energy: ENERGY},
    never_confirmed: {battery: ['—', 'gray, stale', null, 'Reserve 50%', 'Not confirmed yet'], charge: null, energy: ENERGY},
    automatic_off: {battery: ['63%', 'gray', null, TICKS, 'Live'], charge: READY, energy: ENERGY},
    other_vehicle: {battery: ['63%', 'gray', null, TICKS, 'Live'], charge: null, energy: ENERGY},
    not_verified: {battery: ['63%', 'gray, stale', null, TICKS, 'Last confirmed 10:00'], charge: ASLEEP, energy: ENERGY},
    stale: {battery: ['63%', 'gray, stale', null, TICKS, 'Last confirmed 10:00'], charge: ASLEEP, energy: ENERGY},
    dropout: {battery: ['63%', 'gray', null, TICKS, 'Live'], charge: ['reconnecting', null, null, null, RECONNECT], energy: ENERGY},
    charger_offline: {battery: ['63%', 'gray', 'No response since 12:23', TICKS, 'Live'], charge: null, energy: ENERGY},
    power_missing: {battery: ['63%', 'gray', 'Automatic charging pauses until the meters report', TICKS, 'Live'], charge: READY, energy: ENERGY},
    initializing: {battery: ['63%', 'gray', 'Restoring charging timers', TICKS, 'Live'], charge: READY, energy: ENERGY},
    // The page's own edges.
    override_asleep: {battery: ['63%', 'gray, stale', 'To 80%, then back to automatic', TICKS, 'Last confirmed 10:00'],
      charge: ['asleep', 'Return to automatic', null, 'The Car is asleep', null], energy: ENERGY},
    override_dropout: {battery: ['63%', 'green', 'Charging to 80% without waiting', TICKS, 'Live'], charge: ['reconnecting', 'Return to automatic', null, null, RECONNECT], energy: ENERGY},
    solar_limit: {battery: ['81%', 'green', 'At the charge limit', TICKS, 'Live · Charger 3.80 kW'], charge: ['ready', null, '80%', null, null], energy: ENERGY},
    stale_awake: {battery: ['63%', 'gray, stale', null, TICKS, 'Last confirmed 10:00'], charge: ['asleep', null, null, 'The Car hasn’t sent fresh data', null], energy: ENERGY},
    unverified_awake: {battery: ['63%', 'gray', null, TICKS, 'Live'], charge: ['asleep', null, null, 'Not yet confirmed as the Car', null], energy: ENERGY},
    other_vehicle_dropout: {battery: ['63%', 'gray', null, TICKS, 'Live'], charge: null, energy: ENERGY},
    battery_unknown: {battery: ['—', 'gray, stale', null, 'Reserve 50%', 'Not confirmed yet'], charge: ASLEEP, energy: ENERGY},
    meter_missing: {battery: ['63%', 'green', TOPS_UP, TICKS, 'Live · Charger 3.80 kW'], charge: READY, energy: ['Since 29 Aug', '—', 'missing', 'Off-peak 167', 'Solar 84', 'Peak —']},
    billing_year: {battery: ['63%', 'gray', TOPS_UP, TICKS, 'Live'], charge: READY, energy: ['This billing year', ...ENERGY.slice(1)]},
    period_unknown: {battery: ['63%', 'gray, stale', null, TICKS, 'Last confirmed 10:00'], charge: null, energy: ['Total', ...ENERGY.slice(1)]},
    // Without Automatic charging's reading there is no plan to promise, so the headline's detail.
    automatic_unavailable: {battery: ['63%', 'green', 'Following the solar surplus', TICKS, 'Live · Charger 3.80 kW'], charge: READY, energy: ENERGY},
  };
  assert.deepEqual(FIXTURES.map(f => f.id).sort(), Object.keys(expected).sort(), 'one expectation per fixture');
  for (const f of FIXTURES) {
    const value = page(f);
    assert.equal(value.id, 'car', f.id);
    assert.deepEqual(summary(value), expected[f.id], f.id);
    assert.deepEqual([value.battery.title, value.battery.icon, value.chargingEnergy.title, value.chargingEnergy.icon], ['Battery', 'battery', 'Charging energy', 'energy'], f.id);
    if (value.charge) assert.deepEqual([value.charge.title, value.charge.icon], ['Charging', 'plug'], f.id);
  }
});

test('the page’s edge fixtures are what they say: each headline as expected, and CAR_FIXTURES left as it was', () => {
  for (const f of CAR_PAGE_FIXTURES) assert.equal(status(f).key, f.expect, f.id);
  assert.deepEqual(CAR_PAGE_FIXTURES.map(f => f.id).filter(id => CAR_FIXTURES.some(c => c.id === id)), [], 'no id twice');
  assert.equal(CAR_FIXTURES.length, 21);
});

// ---- The battery -----------------------------------------------------------------------
test('the battery’s ring is the Today glance’s bar, green and labelled as Today’s ring, and opens Battery', () => {
  for (const f of FIXTURES) {
    const {battery} = page(f), today = page(f, {page: 'today'}), {bar} = today.car, s = status(f);
    assert.deepEqual(battery.ring, {plot: {fill: bar.fill, reserve: bar.reserve, limit: bar.limit, tone: today.carRing.tone, stale: bar.stale}, ariaLabel: bar.ariaLabel}, f.id);
    assert.equal(battery.label, today.carRing.label, f.id);
    // The ring's ticks in words: the reserve, then the limit, each only while known.
    assert.deepEqual(battery.legend, [...s.reserveTarget === null ? [] : [{kind: 'reserve', text: `Reserve ${Math.round(s.reserveTarget)}%`}],
      ...s.limit.value === null ? [] : [{kind: 'limit', text: `Limit ${Math.round(s.limit.value)}%`}]], f.id);
    assert.deepEqual([...intentOf(battery.link), battery.link.enabled], ['detail', 'battery', true], f.id);
  }
  // Green only while the Car itself charges: not another vehicle, and not the Car at rest.
  assert.deepEqual(['solar', 'offpeak', 'other_vehicle', 'wait_sun', 'override_dropout'].map(id => page(fixture(id)).battery.ring.plot.tone), ['green', 'green', 'gray', 'gray', 'green']);
});

test('the battery’s line says once what happens next: the plan, short, or a detail nothing else on the page says', () => {
  for (const f of FIXTURES) {
    const value = page(f), {line} = value.battery, s = status(f);
    if (line === null) continue;
    assert.ok(line.length <= 50 && !line.endsWith('.'), `${f.id}: “${line}” is one short line`);
    // Never the header's line, Charging's Wake or reconnect line, or Automatic charging's row again.
    const others = [headerOf(f), value.charge?.wake?.title, value.charge?.wake?.detail, value.charge?.line, value.automatic.detail].filter(Boolean);
    for (const other of others) {
      const [a, b] = [line, other].map(text => text.toLowerCase().replace(/[.:·]/g, '').trim());
      assert.ok(!a.includes(b) && !b.includes(a), `${f.id}: “${line}” says “${other}” again`);
    }
    assert.doesNotMatch(line, /\bwake\b|verif|stale/i, `${f.id}: waking is Charging’s to ask`);
    // The plan, short (the Battery sheet keeps it whole), or the headline's detail.
    const brief = s.plan.replace(/^Charge now: to /, 'To ').replace(/, no deadline$/, '').replace('while grid charging is economical', 'from the grid');
    assert.equal(line, s.plan ? s.key === 'wait_offpeak' ? brief.replace(/ from \S+(?: tomorrow)?$/, ' off-peak') : brief : s.detail, f.id);
    // No time twice: the header's off-peak time isn't the line's.
    for (const time of headerOf(f).match(/\d\d:\d\d/g) ?? []) assert.ok(!line.includes(time), `${f.id}: ${time} twice`);
  }
  // The header says Charge now; the deadline there isn't, and why grid charging is economical, are the sheet's.
  assert.equal(page(fixture('charge_now')).battery.line, 'To 80%, then back to automatic');
  assert.equal(sheet(fixture('charge_now'), 'battery').body.plan.line, 'Charge now: to 80%, then back to automatic');
  assert.equal(page(fixture('solar')).battery.line, 'Reserve met: tops up from solar toward 80%');
  assert.equal(sheet(fixture('solar'), 'battery').body.plan.line, 'Reserve met: tops up from solar toward 80%, no deadline');
  assert.equal(sheet(fixture('economical'), 'battery').body.plan.line, 'Reserve met: tops up while grid charging is economical toward 80%, no deadline');
  // Details the page already says: the header's (unplugged, another vehicle), Charging's Wake (stale,
  // not verified), Automatic charging's row (off), the ring (at the limit), an unknown level.
  for (const id of ['unplugged', 'never_confirmed', 'other_vehicle', 'stale', 'not_verified', 'automatic_off', 'complete', 'battery_unknown', 'dropout'])
    assert.equal(page(fixture(id)).battery.line, null, id);
  // An offline Charger's detail adds its time, and nothing without one.
  assert.equal(page(fixture('charger_offline')).battery.line, 'No response since 12:23');
  const untimed = patched('charger_offline', {[E.carConnected]: {last_changed: ''}});
  assert.deepEqual([status(untimed).detail, page(untimed).battery.line], ['No response from the Charger', null]);
  // A plan at the limit the headline doesn't say is still said.
  assert.equal(page(fixture('solar_limit')).battery.line, 'At the charge limit');
  // Charging's reserve plans.
  const tomorrow = patched('wait_offpeak', {[E.carPolicy]: {attributes: {next_offpeak: 'Tomorrow 11:00'}}});
  assert.deepEqual([headerOf(tomorrow), page(tomorrow).battery.line], ['Waiting for off-peak at 11:00 tomorrow', 'Below reserve: restores to 50% off-peak']);
  assert.equal(sheet(tomorrow, 'battery').body.plan.line, 'Below reserve: restores to 50% from 11:00 tomorrow', 'the sheet says when');
  // Waiting for something else, the plan keeps its time.
  assert.equal(page(patched('wait_sun', {[E.carBattery]: {state: '42'}, [E.carPolicy]: {attributes: {next_offpeak: 'Today 22:00'}}})).battery.line, 'Below reserve: restores to 50% from 22:00');
  assert.equal(page(patched('wait_offpeak', {[E.carPolicy]: {attributes: {next_offpeak: 'Now'}}})).battery.line, 'Below reserve: restores to 50% during off-peak');
});

// With the policy unavailable (a template reload's second, a restart), nothing promises a plan or blames the Car.
const noPolicy = id => {
  const f = patched(id, {[E.carPolicy]: undefined});
  f.states[E.carPolicy] = {entity_id: E.carPolicy, state: 'unavailable', attributes: {}};
  return f;
};
test('while the policy has no reading, the Battery card and sheet promise no plan and Wake doesn’t blame the Car', () => {
  const f = noPolicy('solar'), value = page(f), {plan} = sheet(f, 'battery').body;
  assert.deepEqual([headerOf(f), status(f).plan !== '', value.battery.line, plan], ['Charging status unavailable', true, null, null]);
  assert.deepEqual([value.charge.kind, value.charge.wake.icon, value.charge.wake.title, value.charge.wake.control.label],
    ['asleep', 'refresh', 'Fresh data isn’t confirmed yet', 'Refresh']);
  // Asleep, the Car is still asleep.
  const asleep = noPolicy('wait_offpeak_asleep');
  assert.deepEqual([page(asleep).battery.line, page(asleep).charge.wake.title], [null, 'The Car is asleep']);
});

test('the battery’s freshness: Live, or when it was last confirmed, and the Charger’s power only while it delivers to the Car', () => {
  const fresh = (id, changes = {}) => page(patched(id, changes)).battery.freshness;
  assert.equal(fresh('solar'), 'Live · Charger 3.80 kW');
  assert.equal(fresh('solar', {[E.carPower]: {state: '0.4'}}), 'Live · Charger 400 W');
  assert.equal(fresh('solar', {[E.carPower]: {state: '3800', attributes: {unit_of_measurement: 'W'}}}), 'Live · Charger 3.80 kW', 'in W or kW');
  // Not while it delivers nothing, has no reading, delivers to another vehicle or is reconnecting.
  assert.equal(fresh('wait_sun'), 'Live');
  assert.equal(fresh('solar', {[E.carPower]: {state: 'unavailable'}}), 'Live');
  assert.equal(fresh('other_vehicle'), 'Live');
  assert.equal(fresh('override_dropout'), 'Live');
  assert.equal(fresh('wait_offpeak_asleep'), 'Last confirmed 10:00');
  assert.equal(fresh('never_confirmed'), 'Not confirmed yet');
  // The Car asleep while the Charger still delivers: both.
  assert.equal(fresh('wait_offpeak_asleep', {[E.carPower]: {state: '1.2'}}), 'Last confirmed 10:00 · Charger 1.20 kW');
});

// ---- Charging ----------------------------------------------------------------------------
const INTENTS = [{command: 'charge-now', entity: E.carNow}, {command: 'charge-automatic', entity: E.carAutomatic}, {command: 'charge-refresh', entity: E.carRefresh},
  {command: 'charge-limit', entity: E.carLimit, direction: -1}, {command: 'charge-limit', entity: E.carLimit, direction: 1}];
const sameIntent = (a, b) => a.command === b.command && a.entity === b.entity && a.direction === b.direction;
const KEYS = [E.carNow, E.carAutomatic, E.carRefresh, E.carLimit];

test('charging’s form comes from carStatus: while the Car is at the Charger, reconnecting, asleep, overriding or ready', () => {
  const kinds = new Set();
  for (const f of FIXTURES) {
    const s = status(f), {charge, widgets} = page(f);
    // Only while the Car is at the Charger: plugged in, and not another vehicle kept through a dropout.
    assert.equal(charge === null, !s.plugged || (s.key === 'other_vehicle' && !s.override), f.id);
    assert.deepEqual(widgets, charge ? FOUR : THREE, f.id);
    if (!charge) continue;
    kinds.add(charge.kind);
    const kind = s.charger === 'reconnecting' ? 'reconnecting' : s.controls.wake ? 'asleep' : s.override ? 'override' : 'ready';
    assert.equal(charge.kind, kind, f.id);
    // Each form's parts.
    assert.equal(charge.limit === null, ['asleep', 'reconnecting'].includes(kind), `${f.id}: the limit`);
    assert.equal(charge.wake === null, kind !== 'asleep', `${f.id}: Wake`);
    assert.equal(charge.line, kind === 'reconnecting' ? 'Controls return when the Charger reconnects.' : null, `${f.id}: the line`);
    // Return to automatic whenever an override is on; else Charge now while ready, but not at the charge limit.
    const atLimit = s.battery.live && s.limit.live && s.battery.value >= s.limit.value;
    assert.equal(charge.action?.intent.command ?? null, s.override ? 'charge-automatic' : kind === 'ready' && !atLimit ? 'charge-now' : null, `${f.id}: the action`);
  }
  assert.deepEqual([...kinds].sort(), ['asleep', 'override', 'ready', 'reconnecting'], 'every form is drawn somewhere');
});

test('charging agrees with the guard: what it draws is allowed, what the guard allows is drawn, online, offline and in flight', () => {
  for (const f of FIXTURES) {
    const snap = snapshot(f), {charge} = page(f), drawn = drawnOf(charge);
    // Nothing drawn that waking the Car or the Charger reconnecting would enable: the guard allows each.
    for (const c of drawn) assert.notEqual(guard(c.intent, snap), null, `${f.id}: ${c.intent.command} ${c.intent.direction ?? ''} is drawn but refused`);
    // And nothing it allows is left out.
    for (const intent of INTENTS) if (guard(intent, snap)) assert.ok(drawn.some(c => sameIntent(c.intent, intent)), `${f.id}: ${intent.command} is allowed but not drawn`);
    // Online, each control is enabled exactly as the guard allows; offline and in flight, the same controls stay drawn.
    for (const c of drawn) assert.equal(c.enabled, true, `${f.id}: ${c.intent.command}`);
    const offline = page(f, {online: false}).charge;
    assert.equal(offline?.kind, charge?.kind, `${f.id} offline`);
    assert.deepEqual(drawnOf(offline).map(c => [c.intent, c.enabled, c.busy]), drawn.map(c => [c.intent, false, undefined]), `${f.id} offline: drawn, and disabled`);
    for (const key of KEYS) {
      const busy = page(f, {busy: new Set([key])}).charge;
      assert.equal(busy?.kind, charge?.kind, `${f.id}, ${key} in flight`);
      assert.deepEqual(drawnOf(busy).map(c => c.intent), drawn.map(c => c.intent), `${f.id}, ${key} in flight: the same controls`);
      for (const c of drawnOf(busy)) {
        const own = guard(c.intent, snap).key === key;
        assert.deepEqual([c.enabled, c.busy ?? false], [!own, own], `${f.id}, ${key} in flight: ${c.intent.command}`);
      }
    }
  }
});

test('a charging script Home Assistant doesn’t have draws its control disabled, where waking or reconnecting wouldn’t help', () => {
  for (const [id, script, command] of [['solar', E.carNow, 'charge-now'], ['charge_now', E.carAutomatic, 'charge-automatic'], ['stale_awake', E.carRefresh, 'charge-refresh']]) {
    for (const gone of [undefined, {state: 'unavailable'}]) {
      const f = patched(id, {[script]: gone}), c = drawnOf(page(f).charge).find(x => x.intent.command === command);
      assert.deepEqual([c.enabled, guard(c.intent, snapshot(f))], [false, null], `${id}: ${command}`);
    }
  }
});

test('at the charge limit’s bounds the stepper stays drawn, and only the step that would change nothing is refused', () => {
  for (const [limit, enabled] of [['100', [true, false]], ['50', [false, true]]]) {
    const f = patched('wait_offpeak', {[E.carLimit]: {state: limit}}), {charge} = page(f);
    assert.deepEqual([charge.kind, charge.limit.stepper.output], ['ready', `${limit}%`]);
    assert.deepEqual([charge.limit.stepper.minus.enabled, charge.limit.stepper.plus.enabled], enabled, limit);
    assert.deepEqual([charge.limit.stepper.minus, charge.limit.stepper.plus].map(c => guard(c.intent, snapshot(f)) !== null), enabled, limit);
  }
});

test('Wake says why it is needed: Wake under the moon while the Car sleeps, Refresh while it is awake; never the header’s line again', () => {
  const seen = new Set();
  for (const f of FIXTURES) {
    const {charge} = page(f), s = status(f);
    if (!charge?.wake) continue;
    const full = s.battery.value !== null && s.limit.value !== null && s.battery.value >= s.limit.value;
    const {icon, title, detail, control} = charge.wake, what = s.override || full ? 'change the limit.' : 'charge now or change the limit.';
    if (!s.carOnline) assert.deepEqual([icon, title, detail, control.label], ['moon', 'The Car is asleep', `Wake it to ${what}`, 'Wake'], f.id);
    else {
      assert.deepEqual([icon, title, detail, control.label], ['refresh', !s.policy ? 'Fresh data isn’t confirmed yet' : !s.fresh ? 'The Car hasn’t sent fresh data' : 'Not yet confirmed as the Car',
        `Refresh to ${what}`, 'Refresh'], f.id);
      assert.doesNotMatch(`${title} ${detail}`, /asleep|wake/i, `${f.id}: the Car is awake`);
    }
    // The button has no glyph, as the concept's; the row's tile carries the icon.
    assert.deepEqual([control.intent, 'icon' in control], [{command: 'charge-refresh', entity: E.carRefresh}, false], f.id);
    assert.notEqual(title, headerOf(f), f.id);
    seen.add(title);
  }
  assert.equal(seen.size, 3, 'each reason is drawn somewhere');
  // Waking promises Charge now only where it brings it back: not while an override is on, nor at the limit as last confirmed.
  assert.equal(page(fixture('override_asleep')).charge.wake.detail, 'Wake it to change the limit.');
  const full = page(patched('wait_offpeak_asleep', {[E.carLastBattery]: {state: '80'}})).charge;
  assert.deepEqual([full.wake.detail, full.action], ['Wake it to change the limit.', null]);
  assert.equal(page(patched('stale_awake', {[E.carLastBattery]: {state: '85'}})).charge.wake.detail, 'Refresh to change the limit.');
  assert.equal(page(fixture('wait_offpeak_asleep')).charge.wake.detail, 'Wake it to charge now or change the limit.');
});

test('each feedback line belongs to its control, and is quiet while the control isn’t drawn', () => {
  const lines = new Map([[E.carNow, 'Charge now · request sent'], [E.carAutomatic, 'Return to automatic · request sent'],
    [E.carLimit, 'Charge limit · sending request…'], [E.carRefresh, 'Wake · request sent']]);
  for (const f of FIXTURES) {
    const {charge} = page(f, {feedback: lines});
    if (!charge) continue;
    assert.deepEqual(charge.feedback, {action: charge.action ? lines.get(charge.action.intent.entity) : '',
      limit: charge.limit ? lines.get(E.carLimit) : '', wake: charge.wake ? lines.get(E.carRefresh) : ''}, f.id);
    assert.deepEqual(page(f).charge.feedback, {action: '', limit: '', wake: ''}, `${f.id}: quiet`);
  }
});

// ---- Automatic charging ----------------------------------------------------------------
test('Automatic charging says on or off only while its switch has a reading', () => {
  for (const f of [...FIXTURES, patched('solar', {[E.carSmart]: {state: 'unavailable'}}), patched('solar', {[E.carSmart]: undefined})]) for (const online of [true, false]) {
    const {automatic} = page(f, {online}), state = f.states[E.carSmart]?.state, known = !['unavailable', 'unknown', undefined].includes(state);
    const detail = !known ? null : state === 'on' ? 'Charges when it costs least over the year' : 'Off: the Car charges as Tesla decides';
    assert.deepEqual([automatic.title, automatic.icon, automatic.detail, automatic.note, automatic.switch.selected, automatic.feedback],
      ['Automatic charging', 'power', detail, !known ? 'Unavailable' : online ? null : 'Offline', state === 'on', ''], `${f.id} ${online}`);
  }
  const auto = (id, changes, extra) => page(patched(id, changes), extra).automatic;
  const on = auto('solar', {});
  assert.deepEqual([on.title, on.icon, on.detail, on.note, on.feedback, on.switch.selected], ['Automatic charging', 'power', 'Charges when it costs least over the year', null, '', true]);
  assert.equal(auto('automatic_off', {}).detail, 'Off: the Car charges as Tesla decides');
  // Unavailable is the one state shown, never off: no detail, a disabled switch, the note.
  const unknown = page(fixture('automatic_unavailable'));
  assert.deepEqual([unknown.automatic.detail, unknown.automatic.note, unknown.automatic.switch.enabled, unknown.automatic.switch.selected], [null, 'Unavailable', false, false]);
  // Offline, the last reading's state stays, with the note.
  assert.deepEqual([auto('solar', {}, {online: false}).detail, auto('solar', {}, {online: false}).note], ['Charges when it costs least over the year', 'Offline']);
  assert.equal(page(patched('solar', {}), {feedback: new Map([[E.carSmart, 'Automatic charging · request sent']])}).automatic.feedback, 'Automatic charging · request sent');
});

// ---- Charging energy --------------------------------------------------------------------
test('the charging energy: the period, the sum of what the legend prints, the split in the legend’s order, opening Charging energy', () => {
  const energy = (id, changes = {}) => page(patched(id, changes)).chargingEnergy;
  for (const f of FIXTURES) {
    const e = page(f).chargingEnergy, parts = e.legend.map(l => l.text.split(' ').at(-1));
    assert.deepEqual(e.legend.map(l => [l.tone, l.text.replace(/ \S+$/, '')]), [['indigo', 'Off-peak'], ['yellow', 'Solar'], ['pink', 'Peak']], f.id);
    assert.deepEqual([...intentOf(e.link), e.link.enabled], ['detail', 'charging-energy', true], f.id);
    if (e.bar.kind === 'missing') {assert.deepEqual([e.figure.value, e.figure.unit, e.bar.segments], ['—', '', []], f.id); continue;}
    assert.equal(e.figure.value, String(parts.reduce((sum, part) => sum + Number(part), 0)), `${f.id}: the sum agrees with the legend`);
    assert.equal(e.figure.unit, 'kWh', f.id);
    assert.ok(Math.abs(e.bar.segments.reduce((sum, s) => sum + s.share, 0) - 1) < 1e-9, f.id);
  }
  // The sum is of the whole kWh the legend prints, so the figure and the legend agree.
  const halves = energy('solar', {[E.carEnergyOffpeak]: {state: '0.5'}, [E.carEnergyPeak]: {state: '0.5'}, [E.carEnergySolar]: {state: '0.5'}});
  assert.deepEqual([halves.figure.value, halves.legend.map(l => l.text)], ['3', ['Off-peak 1', 'Solar 1', 'Peak 1']]);
  // A part at 0 has no segment; all three at 0 is a real zero, with no segment at all.
  const noPeak = energy('solar', {[E.carEnergyPeak]: {state: '0.2'}});
  assert.deepEqual([noPeak.bar.kind, noPeak.bar.segments.map(s => [s.key, s.tone]), noPeak.figure.value], ['split', [['offpeak', 'indigo'], ['solar', 'yellow']], '251']);
  const zero = energy('solar', {[E.carEnergyOffpeak]: {state: '0'}, [E.carEnergyPeak]: {state: '0'}, [E.carEnergySolar]: {state: '0'}});
  assert.deepEqual([zero.figure, zero.bar.kind, zero.bar.segments, zero.bar.ariaLabel], [{label: 'Since 29 Aug', value: '0', unit: 'kWh'}, 'zero', [], 'Charging energy: nothing charged yet']);
  assert.deepEqual(page(fixture('solar')).chargingEnergy.bar.segments.map(s => [s.key, s.tone, s.share.toFixed(3)]),
    [['offpeak', 'indigo', '0.564'], ['solar', 'yellow', '0.284'], ['peak', 'pink', '0.152']]);
  assert.equal(page(fixture('solar')).chargingEnergy.bar.ariaLabel, 'Charging energy, in kWh: off-peak 167, solar 84, peak 45');
});

// ---- The widgets ---------------------------------------------------------------------------
test('from 700px the widgets fill every row: four mediums while the Car is plugged in, else the battery large beside two', () => {
  for (const f of FIXTURES) {
    const {widgets, charge} = page(f), desktop = placeWidgets(widgets, COLUMNS.desktop), wide = placeWidgets(widgets, COLUMNS.wide);
    assert.deepEqual([desktop.holes, desktop.rows], [[], 2], `${f.id} at ${COLUMNS.desktop} columns`);
    assert.deepEqual([wide.holes, wide.rows], [[], 4], `${f.id} at ${COLUMNS.wide} columns`);
    assert.deepEqual(desktop.placements.map(p => `${p.id} r${p.row} c${p.column}`), charge
      ? ['battery r1 c1', 'charge r1 c3', 'energy r2 c1', 'automatic r2 c3'] : ['battery r1 c1', 'energy r1 c3', 'automatic r2 c3'], f.id);
    assert.deepEqual(wide.placements.map(p => `${p.id} r${p.row}`), charge
      ? ['battery r1', 'charge r2', 'energy r3', 'automatic r4'] : ['battery r1', 'energy r3', 'automatic r4'], f.id);
  }
});

// ---- The sheets -----------------------------------------------------------------------------
test('each sheet is titled by its name under Car, and only CAR_DETAILS opens one', () => {
  const snap = snapshot(fixture('solar')), bound = kit(snap);
  for (const [{id, name}, kind] of CAR_DETAILS.map((d, i) => [d, ['battery', 'sources'][i]])) {
    const drawer = carDrawerValue(snap, bound, id);
    assert.deepEqual([drawer.id, drawer.title, drawer.eyebrow, drawer.body.kind, 'close' in drawer], [id, name, 'Car', kind, false], id);
  }
  for (const id of ['bill', 'attic', 'missing', '', undefined, 'battery/']) assert.equal(carDrawerValue(snap, bound, id), null, String(id));
});

// Each Battery reading as one line: icon and tone, title, value, detail, and the entity it opens.
const readings = (f, extra) => sheet(f, 'battery', extra).body.readings.rows.map(r => [`${r.icon} ${r.tone}`, r.title, r.value, r.detail, r.link?.intent.entity ?? null]);
test('the Battery sheet’s readings: each opens its own, live or last confirmed, the Charger’s while it is the Car’s, and Tesla’s estimate', () => {
  const LAST = [['battery gray', 'Battery', '63%', 'Last confirmed 10:00', E.carLastBattery], ['settings gray', 'Charge limit', '80%', 'Last confirmed 10:00', E.carLastLimit],
    ['moon gray', 'Ready reserve', '50%', null, null]];
  assert.deepEqual(readings(fixture('solar')), [['battery green', 'Battery', '63%', 'Live', E.carBattery], ['settings gray', 'Charge limit', '80%', 'Live', E.carLastLimit],
    ['moon gray', 'Ready reserve', '50%', null, null], ['plug green', 'Charger', '3.80 kW', 'Delivering power', E.carPower],
    ['clock gray', 'Tesla’s estimate', '80% at 14:40', null, E.carFullAt]]);
  assert.deepEqual(readings(fixture('not_verified')), [...LAST, ['plug gray', 'Charger', '5 W', 'Not delivering power', E.carPower]]);
  assert.deepEqual(readings(fixture('unplugged')), LAST);
  assert.deepEqual(readings(fixture('never_confirmed')), [['battery gray', 'Battery', '—', 'Not confirmed yet', E.carLastBattery],
    ['settings gray', 'Charge limit', '—', 'Not confirmed yet', E.carLastLimit], ['moon gray', 'Ready reserve', '50%', null, null]]);
  assert.deepEqual(readings(patched('solar', {[E.carPower]: {state: 'unavailable'}}))[3], ['plug gray', 'Charger', '—', 'No power reading', E.carPower]);
  // Over every fixture, the rows agree with carStatus and the Battery card: the readings, what the Charger measures, and Tesla's estimate.
  const percent = value => value === null ? '—' : `${Math.round(value)}%`;
  for (const f of FIXTURES) {
    const rows = sheet(f, 'battery').body.readings.rows, s = status(f);
    assert.equal(sheet(f, 'battery').body.readings.heading, 'Readings', f.id);
    assert.deepEqual(rows.slice(0, 2).map(r => r.value), [percent(s.battery.value), percent(s.limit.value)], f.id);
    assert.equal(rows[0].detail, page(f).battery.freshness.replace(/ · Charger .+$/, ''), `${f.id}: the Battery card’s freshness`);
    const charger = rows.find(r => r.title === 'Charger');
    assert.equal(Boolean(charger), s.plugged && s.charger === 'connected', `${f.id}: the Charger’s row while it measures the Car`);
    if (charger) assert.equal(charger.detail, s.watts === null ? 'No power reading' : s.drawing ? 'Delivering power' : 'Not delivering power', f.id);
    // The measured power whenever there is a reading, '—' without.
    if (charger) assert.equal(charger.value, s.watts === null ? '—' : s.watts >= 1000 ? `${(s.watts / 1000).toFixed(2)} kW` : `${Math.round(s.watts)} W`, f.id);
    const estimate = rows.find(r => r.title === 'Tesla’s estimate');
    assert.equal(estimate ? `Tesla estimates ${estimate.value}` : null, s.estimate || null, f.id);
    assert.equal(rows[0].tone, page(f).battery.ring.plot.tone, `${f.id}: the Battery row is the ring’s tone`);
    // Each opens its reading, but the ready reserve, which no dialog shows as the row does.
    assert.deepEqual(rows.filter(r => !r.link).map(r => r.title), ['Ready reserve'], f.id);
    assert.ok(rows.every(r => !r.link || (r.link.intent.command === 'more' && r.link.enabled)), f.id);
    assert.equal(rows[2].value, s.reserveTarget === null ? '—' : `${Math.round(s.reserveTarget)}%`, f.id);
  }
});

test('the Battery sheet’s summary is the page’s ring beside the headline, and the hint through a dropout', () => {
  for (const f of FIXTURES) {
    const {battery} = page(f), {summary} = sheet(f, 'battery').body, s = status(f);
    assert.deepEqual(summary, {ring: battery.ring, label: battery.label, headline: s.headline, detail: s.detail,
      hint: s.reconnecting && s.key !== 'reconnecting' ? 'Reconnecting to the Charger…' : null}, f.id);
  }
  assert.equal(sheet(fixture('dropout'), 'battery').body.summary.hint, 'Reconnecting to the Charger…');
});

test('the Battery sheet’s plan is the plan in full with the reserve’s conflict, unless it only says the headline again', () => {
  const CONFLICT = 'The charge limit is below the ready reserve, so the reserve stops at the limit.';
  for (const f of FIXTURES) {
    const {plan} = sheet(f, 'battery').body, s = status(f), again = s.key === 'complete' && s.plan === 'At the charge limit';
    assert.deepEqual(plan, s.plan && !again ? {heading: 'Plan', line: s.plan, note: s.conflict ? CONFLICT : null} : null, f.id);
  }
  assert.equal(sheet(fixture('complete'), 'battery').body.plan, null, 'the headline says it');
  assert.deepEqual(sheet(fixture('solar_limit'), 'battery').body.plan, {heading: 'Plan', line: 'At the charge limit', note: null});
  assert.equal(sheet(fixture('battery_unknown'), 'battery').body.plan.line, 'Battery level unknown until the Car wakes', 'the sheet says what the page leaves to the ring and Wake');
  // A charge limit below the ready reserve: the conflict as the plan's note, or as its line without a plan.
  const conflict = {[E.carPolicy]: {attributes: {ready_reserve: 90, reserve_conflict: true}}};
  assert.deepEqual(sheet(patched('wait_sun', conflict), 'battery').body.plan, {heading: 'Plan', line: 'Below reserve: restores to 80% during off-peak', note: CONFLICT});
  assert.deepEqual(sheet(patched('not_verified', conflict), 'battery').body.plan, {heading: 'Plan', line: CONFLICT, note: null});
});

test('the Battery sheet’s Why: the policy’s reason and basis, then the last command and readiness check; none without any', () => {
  for (const f of FIXTURES) {
    const {why} = sheet(f, 'battery').body, s = status(f);
    if (!s.reason && !s.basis) {assert.ok(why === null || why.paragraphs.length === 0, f.id); continue;}
    assert.deepEqual([why.title, why.paragraphs], ['Why', [s.reason, s.basis].filter(Boolean)], f.id);
  }
  assert.deepEqual(sheet(fixture('solar'), 'battery').body.why.logs, [{label: 'Last command · 11:50', text: 'Refreshing vehicle data'},
    {label: 'Readiness check · 09:30', text: '27 Sep 09:28: Ready reserve satisfied (63%).'}]);
  // Logs alone still make a Why; nothing at all makes none.
  const quiet = {[E.carPolicy]: {attributes: {reason: '', economic_basis: ''}}};
  assert.deepEqual(sheet(patched('wait_sun', quiet), 'battery').body.why.paragraphs, []);
  assert.equal(sheet(patched('wait_sun', {...quiet, [E.carCommand]: undefined, [E.carReadiness]: undefined}), 'battery').body.why, null);
});

test('the Charging energy sheet: the page’s breakdown, each meter in the bar’s order, when the count starts again, and why', () => {
  for (const f of FIXTURES) {
    const {chargingEnergy} = page(f), {body} = sheet(f, 'charging-energy');
    assert.deepEqual(body.summary, {...chargingEnergy, link: null}, f.id);
    assert.deepEqual(body.rows.map(r => [r.icon, r.tone, r.title, r.link.intent.command, r.link.intent.entity]),
      [['moon', 'indigo', 'Grid off\u2011peak', 'more', E.carEnergyOffpeak], ['sun', 'yellow', 'Solar', 'more', E.carEnergySolar], ['grid', 'pink', 'Grid peak', 'more', E.carEnergyPeak]], f.id);
    // Each row is its legend entry, in kWh, in the same tone.
    assert.deepEqual(body.rows.map(r => [r.tone, r.value.replace(' kWh', '')]), chargingEnergy.legend.map(l => [l.tone, l.text.split(' ').at(-1)]), f.id);
    assert.deepEqual(body.why, {title: 'Why', paragraphs: [
      'Grid off-peak and grid peak are what charging added to the house’s grid import, counted in the meter’s register at the time.',
      'Solar is the Charger’s own reading minus what came from the grid. The grid count misses the Charger’s dropouts, so solar can read a few percent high.'], logs: []}, f.id);
  }
  assert.deepEqual(sheet(fixture('solar'), 'charging-energy').body.rows.map(r => r.value), ['167 kWh', '84 kWh', '45 kWh']);
  // The sheet's rows keep 'off‑peak' whole with a non-breaking hyphen; the page's legend and chargingEnergy()'s rows keep theirs.
  assert.equal(sheet(fixture('solar'), 'charging-energy').body.rows[0].title.codePointAt(8), 0x2011);
  assert.deepEqual([page(fixture('solar')).chargingEnergy.legend[0].text, chargingEnergy(fixture('solar').states, zone).rows[0][0]], ['Off-peak 167', 'Grid off-peak']);
  assert.deepEqual(sheet(fixture('meter_missing'), 'charging-energy').body.rows.map(r => r.value), ['167 kWh', '84 kWh', '—']);
  // The summary says since when; the footer, when the count starts again.
  for (const [id, footer] of [['solar', 'The count starts again with the billing year on 1 July.'], ['period_unknown', 'The count starts again with the billing year on 1 July.'],
    ['billing_year', 'The billing year runs from 1 July to 30 June.']]) assert.equal(sheet(fixture(id), 'charging-energy').body.footer, footer, id);
});

test('while Home Assistant is offline nothing says Live: a live reading is the last received, and the Charger’s power is left out', () => {
  const offline = {online: false};
  assert.equal(page(fixture('solar'), offline).battery.freshness, 'Last received 12:28');
  assert.deepEqual(readings(fixture('solar'), offline).slice(0, 2).map(r => r[3]), ['Last received 12:28', 'Last received 12:28']);
  // What was last confirmed stays so.
  assert.equal(page(fixture('wait_offpeak_asleep'), offline).battery.freshness, 'Last confirmed 10:00');
  // Without a report time, only that it was last received.
  const untimed = patched('solar', {[E.carBattery]: {last_reported: '', last_updated: ''}});
  assert.equal(page(untimed, offline).battery.freshness, 'Last received');
  for (const f of FIXTURES) {
    const shown = [...words(page(f, offline)), ...CAR_DETAILS.flatMap(d => words(sheet(f, d.id, offline).body.readings ?? []))];
    assert.deepEqual(shown.filter(text => /\bLive\b/.test(text)), [], f.id);
  }
});

test('a sheet row without a reading is flagged unavailable, for the dashed tile, and every row with one isn’t', () => {
  for (const f of [...FIXTURES, {id: 'nothing', states: {}}, patched('solar', {[E.carPower]: {state: 'unavailable'}})]) for (const d of CAR_DETAILS) {
    const {body} = sheet(f, d.id);
    for (const r of body.readings?.rows ?? body.rows) assert.equal(r.unavailable, r.value === '—', `${f.id} ${d.id}: ${r.title} ${r.value}`);
  }
  assert.deepEqual(sheet(fixture('meter_missing'), 'charging-energy').body.rows.map(r => r.unavailable), [false, false, true]);
  assert.deepEqual(sheet(fixture('never_confirmed'), 'battery').body.readings.rows.map(r => r.unavailable), [true, true, false]);
});

// ---- — is never 0 ---------------------------------------------------------------------------
test('— is never 0: a missing reading is —, Not confirmed yet, No power reading or no segment, on the page and in both sheets', () => {
  const nothing = {id: 'nothing', states: {}};
  const cases = [['nothing', nothing, {}], ['nothing, offline', nothing, {online: false}], ...['never_confirmed', 'battery_unknown', 'meter_missing'].map(id => [id, fixture(id), {}]),
    ['no power reading', patched('solar', {[E.carPower]: {state: 'unavailable'}}), {}]];
  for (const [where, f, extra] of cases) {
    const value = page(f, extra), sheets = CAR_DETAILS.map(d => sheet(f, d.id, extra));
    for (const shown of [value, ...sheets]) {
      assert.doesNotMatch(everything(shown), ZERO, where);
      assert.doesNotMatch(JSON.stringify(shown), ZERO, `${where}: accessible names too`);
    }
  }
  const empty = page(nothing), [battery, sources] = CAR_DETAILS.map(d => sheet(nothing, d.id).body);
  assert.deepEqual([empty.battery.label, empty.battery.ring.plot, empty.battery.legend, empty.battery.freshness, empty.charge],
    ['—', {fill: null, reserve: null, limit: null, tone: 'gray', stale: true}, [], 'Not confirmed yet', null]);
  assert.deepEqual([empty.chargingEnergy.figure, empty.chargingEnergy.bar.kind, empty.chargingEnergy.bar.segments, empty.chargingEnergy.legend.map(l => l.text)],
    [{label: 'Total', value: '—', unit: ''}, 'missing', [], ['Off-peak —', 'Solar —', 'Peak —']]);
  assert.deepEqual(battery.readings.rows.map(r => [r.title, r.value, r.detail]), [['Battery', '—', 'Not confirmed yet'], ['Charge limit', '—', 'Not confirmed yet'], ['Ready reserve', '—', null]]);
  assert.deepEqual([battery.plan, battery.why], [null, null]);
  assert.deepEqual(sources.rows.map(r => r.value), ['—', '—', '—']);
  // The stepper's output without a live limit is — too.
  assert.equal(page(patched('wait_offpeak', {[E.carLimit]: {state: 'unavailable'}})).charge.limit.stepper.output, '—');
});

// ---- Words -----------------------------------------------------------------------------------
// What the Car draws, as the contract lists it: on the page, then in each sheet.
const pageWords = v => [v.battery.title, v.battery.label, v.battery.line, ...v.battery.legend.map(l => l.text), v.battery.freshness,
  ...(v.charge ? [v.charge.title, v.charge.action?.label, v.charge.limit?.title, v.charge.limit?.detail, v.charge.limit?.stepper.output,
    v.charge.wake?.title, v.charge.wake?.detail, v.charge.wake?.control.label, v.charge.line, ...Object.values(v.charge.feedback)] : []),
  v.chargingEnergy.title, v.chargingEnergy.figure.label, v.chargingEnergy.figure.value, v.chargingEnergy.figure.unit, ...v.chargingEnergy.legend.map(l => l.text),
  v.automatic.title, v.automatic.detail, v.automatic.note, v.automatic.feedback];
// A sheet's own words: not its summary's headline and detail (carStatus's, as the header and the glance say them)
// nor Why's paragraphs and logs (the policy's own words).
const sheetOwn = body => body.kind === 'battery'
  ? [body.summary.label, body.summary.hint, body.readings.heading, ...body.readings.rows.flatMap(r => [r.title, r.value, r.detail]), body.plan?.heading, body.plan?.line, body.plan?.note, body.why?.title]
  : [body.summary.title, body.summary.figure.label, body.summary.figure.value, body.summary.figure.unit, ...body.summary.legend.map(l => l.text),
    ...body.rows.flatMap(r => [r.title, r.value]), body.footer, body.why.title, ...body.why.paragraphs];
const sheetWords = body => [...sheetOwn(body), ...(body.kind === 'battery' ? [body.summary.headline, body.summary.detail, ...(body.why?.paragraphs ?? []),
  ...(body.why?.logs ?? []).flatMap(l => [l.label, l.text])] : [])];
// A string under a key words() skips is a token (an id, an icon, a kind, a tone, a size), never words.
const TOKEN = /^[a-z][a-z0-9_.-]*$/;
function structural(value, found = []) {
  const skipped = new Set(['id', 'kind', 'key', 'icon', 'tone', 'width', 'min', 'max', 'plot', 'size']);
  const leaves = node => typeof node === 'string' ? [node] : node && typeof node === 'object' ? Object.values(node).flatMap(leaves) : [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) if (skipped.has(key)) found.push(...leaves(child).map(text => [key, text])); else walk(child);
  };
  walk(value);
  return found;
}

test('every word the Car draws is one words() reads, and nothing drawn sits under a key it skips', () => {
  const lines = new Map(KEYS.map(key => [key, `${key} · request sent`]));
  for (const f of FIXTURES) {
    const value = page(f, {feedback: lines}), said = [...words(value), ...controls(value).map(c => c.label).filter(Boolean)];
    for (const text of pageWords(value).filter(Boolean)) assert.ok(said.includes(text), `${f.id}, the page: ${text}`);
    for (const [key, text] of structural(value)) assert.match(text, TOKEN, `${f.id}, the page: ${key} holds “${text}”`);
    for (const d of CAR_DETAILS) {
      const drawer = sheet(f, d.id), inSheet = words(drawer);
      for (const text of sheetWords(drawer.body).filter(Boolean)) assert.ok(inSheet.includes(text), `${f.id}, ${d.id}: ${text}`);
      for (const [key, text] of structural(drawer)) assert.match(text, TOKEN, `${f.id}, ${d.id}: ${key} holds “${text}”`);
      for (const icon of drawer.body.readings?.rows.map(r => r.icon) ?? drawer.body.rows.map(r => r.icon)) assert.ok(iconNames.includes(icon), icon);
    }
    // The ring and the widgets draw no words but the ring's label.
    assert.deepEqual(words([value.battery.ring, value.widgets]), [], f.id);
    for (const icon of [value.battery.icon, value.charge?.icon, value.charge?.wake?.icon, value.chargingEnergy.icon, value.automatic.icon].filter(Boolean)) assert.ok(iconNames.includes(icon), icon);
  }
  // No kind or tone leaks as words: 'ready', 'asleep', 'green'…
  const all = FIXTURES.flatMap(f => [...words(page(f)), ...CAR_DETAILS.flatMap(d => words(sheet(f, d.id)))]);
  assert.deepEqual(all.filter(text => TOKEN.test(text)), [], 'no bare token is drawn');
});

test('the Car’s own words use CONTEXT.md’s terms, curly apostrophes, and a dash only for a missing reading', () => {
  for (const f of FIXTURES) {
    const lines = new Map(KEYS.map(key => [key, 'Sent']));
    const own = [...pageWords(page(f, {feedback: lines})), ...CAR_DETAILS.flatMap(d => sheetOwn(sheet(f, d.id).body))].filter(Boolean);
    for (const text of own) {
      assert.doesNotMatch(text, /\bvehicles?\b|\bEVs?\b|Model 3|\bcar\b|Wake & refresh/, `${f.id}: “${text}”`);
      // Tesla only for Tesla's own estimate, and for how the Car charges without Automatic charging (CONTEXT.md's words).
      assert.ok(!/Tesla/.test(text) || text === 'Tesla’s estimate' || text === 'Off: the Car charges as Tesla decides', `${f.id}: “${text}”`);
      assert.doesNotMatch(text, /'/, `${f.id}: “${text}” has a straight apostrophe`);
      // — only as a missing reading: the whole value, or after a legend's name.
      assert.ok(!text.includes('—') || /^(?:[A-Z][a-z-]+ )?—$/.test(text), `${f.id}: “${text}”`);
    }
  }
});

// ---- Links -------------------------------------------------------------------------------------
// A reading's details are Home Assistant's own dialog, which for a number,
// a helper, a switch, a script or a button can write: the Car's sheets only
// ever open sensors, so nothing there goes around the guard.
test('every reading a Car sheet opens is a read-only sensor, never the charge limit’s number', () => {
  const opened = new Set();
  for (const f of [...FIXTURES, {id: 'nothing', states: {}}]) for (const extra of [{}, {online: false}]) for (const d of CAR_DETAILS) {
    for (const c of controls(sheet(f, d.id, extra)).filter(c => c.command === 'more')) {
      assert.match(c.entity, /^(?:sensor|binary_sensor)\./, `${f.id} ${d.id}: ${c.entity}`);
      opened.add(c.entity);
    }
  }
  assert.ok(!opened.has(E.carLimit), 'the charge limit opens its last confirmed sensor');
  assert.deepEqual([...opened].sort(), [E.carBattery, E.carLastBattery, E.carLastLimit, E.carPower, E.carFullAt,
    E.carEnergyOffpeak, E.carEnergySolar, E.carEnergyPeak].sort(), 'every reading is opened somewhere');
});

test('the Car only opens its sheets and readings: the Battery card and Charging energy open theirs, and each sheet only opens readings', () => {
  for (const f of FIXTURES) {
    const value = page(f), where = f.id;
    const links = controls(value).filter(c => ['detail', 'more', 'close'].includes(c.command));
    assert.deepEqual(links.map(c => [c.command, c.entity, c.enabled]), [['detail', 'battery', true], ['detail', 'charging-energy', true]], where);
    assert.deepEqual([...new Set(controls(value).map(c => c.command))].filter(c => !c.startsWith('charge-')).sort(), ['detail', 'toggle'], where);
    assert.deepEqual(controls(value.automatic).map(c => [c.command, c.entity]), [['toggle', E.carSmart]], `${where}: Automatic charging’s switch`);
    for (const d of CAR_DETAILS) {
      const commands = controls(sheet(f, d.id)).map(c => c.command);
      assert.ok(commands.every(c => ['more', 'close'].includes(c)), `${where} ${d.id}: ${commands.join(', ')}`);
      assert.equal(commands.at(-1), 'close', `${where} ${d.id}: closes with close detail`);
      for (const extra of [{online: false}, {busy: new Set(KEYS)}]) assert.deepEqual(controls(sheet(f, d.id, extra)), controls(sheet(f, d.id)), `${where} ${d.id}: changes nothing`);
    }
  }
  // A reading Home Assistant doesn't have opens nothing.
  const nothing = {id: 'nothing', states: {}};
  for (const d of CAR_DETAILS) assert.ok(controls(sheet(nothing, d.id)).filter(c => c.command === 'more').every(c => !c.enabled), d.id);
});
mock.reset();
