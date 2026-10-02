// The Car's sheets have routes of their own from v34 (#29 step 4):
// #car/battery opens Battery and #car/charging-energy Charging energy, and
// no page opens another's sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {screen, kit} from '../config/www/maison/screen.js';
import {CAR_DETAILS, carDrawerValue} from '../config/www/maison/car.js';
import {CAR_FIXTURES, CAR_NOW} from '../frontend/maison/fixtures/car-fixtures.js';
import {CAR_PAGE_FIXTURES} from '../frontend/maison/fixtures/car-page-fixtures.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';

const registered = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = {get: key => registered.get(key), define: (key, value) => registered.set(key, value)};
globalThis.window = {customCards: []};
await import('../config/www/maison/maison-dashboard.js');
const Maison = registered.get('maison-dashboard');
// Only registering the element needs a window.
delete globalThis.window;

// Every Car fixture, and the Car page's own edges.
const CARS = [...CAR_FIXTURES, ...CAR_PAGE_FIXTURES];
// The Car's screen at a route, from a fixture's states at the fixtures' time.
const onCar = (f, detail, extra = {}) => screen(fixtureSnapshot({...extra, states: structuredClone(f.states), now: CAR_NOW, carLast: f.last ?? null,
  route: {page: 'car', detail}}));

test('CAR_DETAILS names the Car’s two sheets, in page order', () => {
  assert.deepEqual(CAR_DETAILS, [{id: 'battery', name: 'Battery'}, {id: 'charging-energy', name: 'Charging energy'}]);
  assert.ok(Object.isFrozen(CAR_DETAILS) && CAR_DETAILS.every(Object.isFrozen));
});

test('#car/battery and #car/charging-energy route to the Car’s sheets; another page’s ids don’t', () => {
  const card = Object.create(Maison.prototype);
  globalThis.location = {hash: '#car'};
  try {
    for (const {id} of CAR_DETAILS) {
      location.hash = `#car/${id}`;
      assert.deepEqual([card.readPage(), card.routeDetail()], ['car', id], location.hash);
    }
    for (const hash of ['#car/bill', '#car/attic', '#car/', '#car/missing', '#energy/battery', '#energy/charging-energy', '#climate/battery', '#today/battery'])
      {location.hash = hash; assert.equal(card.routeDetail(), null, hash);}
  } finally {delete globalThis.location;}
});

test('screen() opens each Car sheet by its id, titled by its name, and closes it with close detail', () => {
  for (const f of CARS) for (const online of [true, false]) {
    for (const d of CAR_DETAILS) {
      const {page, drawer} = onCar(f, d.id, {online});
      assert.equal(page.id, 'car', `${f.id} ${d.id}`);
      assert.deepEqual([drawer.id, drawer.title, drawer.eyebrow, drawer.body.kind], [d.id, d.name, 'Car', d.id === 'battery' ? 'battery' : 'sources'], `${f.id} ${d.id}`);
      assert.deepEqual(drawer.close, {intent: {command: 'close', entity: 'detail'}, enabled: true}, `${f.id} ${d.id}`);
    }
    for (const id of ['bill', 'attic', 'missing', '', null]) assert.equal(onCar(f, id, {online}).drawer, null, `${f.id} ${id}`);
  }
  // Neither another page nor another page's route opens a Car sheet.
  const f = CAR_FIXTURES[0];
  for (const page of ['energy', 'climate', 'today']) for (const {id} of CAR_DETAILS)
    assert.equal(screen(fixtureSnapshot({states: f.states, now: CAR_NOW, route: {page, detail: id}})).drawer, null, `${page}/${id}`);
  const snap = fixtureSnapshot({states: f.states, now: CAR_NOW, route: {page: 'car'}});
  assert.equal(carDrawerValue(snap, kit(snap), 'bill'), null);
});

test('the Car page links to both sheets, online or not, and a sheet open over it changes nothing on the page', () => {
  for (const f of CARS) for (const online of [true, false]) {
    const {page} = onCar(f, null, {online});
    assert.deepEqual([page.battery.link, page.chargingEnergy.link].map(l => [l.intent.command, l.intent.entity, l.enabled]),
      [['detail', 'battery', true], ['detail', 'charging-energy', true]], f.id);
    for (const {id} of CAR_DETAILS) assert.deepEqual(onCar(f, id, {online}).page, page, `${f.id} ${id}`);
  }
});
