// More Car states for the Car's page and sheets (#29 step 4, v34):
// the edges no CAR_FIXTURES entry reaches, each built from one of them at
// the same time (CAR_NOW), in the same shape ({id, title, states, last?,
// expect}), so the tests, the agreement matrix and the gallery read them
// alike. CAR_FIXTURES itself stays as it is. No real readings.
import {E} from '../../../config/www/maison/model.js';
import {CAR_FIXTURES, CAR_NOW} from './car-fixtures.js';

const iso = minutes => new Date(CAR_NOW + minutes * 60000).toISOString();
const from = id => structuredClone(CAR_FIXTURES.find(f => f.id === id).states);
// States with some entities changed, key by key and attribute by attribute;
// null removes an entity.
const patch = (states, changes) => {
  const next = {...states};
  for (const [id, change] of Object.entries(changes)) {
    if (change === null) delete next[id];
    else next[id] = {...next[id], ...change, attributes: {...next[id]?.attributes, ...change.attributes}};
  }
  return next;
};
// The Car asleep: offline, its last confirmed readings from 10:00.
const ASLEEP = {[E.carOnline]: {state: 'off'}, [E.carLastBattery]: {attributes: {confirmed_at: iso(-150)}}, [E.carLastLimit]: {attributes: {confirmed_at: iso(-150)}}};
// Two minutes into a Charger dropout, the session reconnecting.
const DROPOUT = {[E.carConnected]: {state: 'unavailable', last_changed: iso(-2)}, [E.carSession]: {state: 'reconnecting'}};
// The charging energy meters' count starting on 1 July, the billing year.
const JULY = '2026-06-30T22:00:00Z';

export const CAR_PAGE_FIXTURES = [
  // Charge now while the Car falls asleep: Wake, and Return to automatic stays.
  {id: 'override_asleep', title: 'Charge now, the Car asleep', expect: 'charge_now',
    states: patch(from('charge_now'), {...ASLEEP, [E.carPower]: {state: '0.0052'}})},
  // Charge now through a Charger dropout: Return to automatic stays.
  {id: 'override_dropout', title: 'Charge now, Charger dropout', expect: 'charge_now',
    states: patch(from('charge_now'), DROPOUT),
    last: {key: 'charge_now', headline: 'Charge now', detail: 'Charging to 80% without waiting', tone: 'accent', icon: 'energy'}},
  // The policy a render behind the battery: charging from solar at the charge limit, so no Charge now.
  {id: 'solar_limit', title: 'Charging from solar, at the charge limit', expect: 'solar',
    states: patch(from('solar'), {[E.carBattery]: {state: '81'}, [E.carLastBattery]: {state: '81'}, [E.carFullAt]: {state: 'unavailable'}})},
  // The Car awake without fresh data.
  {id: 'stale_awake', title: 'Car data is stale, the Car awake', expect: 'stale',
    states: patch(from('stale'), {[E.carOnline]: {state: 'on'}})},
  // The Car awake with fresh data, the session not yet verified.
  {id: 'unverified_awake', title: 'Not yet verified, the Car awake', expect: 'not_verified',
    states: patch(from('not_verified'), {[E.carOnline]: {state: 'on'}})},
  // Another vehicle's headline kept through a Charger dropout: still not the Car.
  {id: 'other_vehicle_dropout', title: 'Another vehicle, Charger dropout', expect: 'other_vehicle',
    states: patch(from('other_vehicle'), DROPOUT),
    last: {key: 'other_vehicle', headline: 'Another vehicle is charging', detail: 'The Car is not the vehicle at the Charger', tone: 'default', icon: 'plug'}},
  // Plugged in and verified, nothing known of the battery until the Car wakes.
  {id: 'battery_unknown', title: 'Plugged in, battery unknown', expect: 'wait_offpeak',
    states: patch(from('wait_offpeak_asleep'), {[E.carLastBattery]: {state: 'unknown', attributes: {confirmed_at: null}}, [E.carLastLimit]: {state: 'unknown', attributes: {confirmed_at: null}}})},
  // A charging energy meter without a reading.
  {id: 'meter_missing', title: 'Charging energy, a meter missing', expect: 'solar',
    states: patch(from('solar'), {[E.carEnergyPeak]: {state: 'unavailable'}})},
  // The count within the billing year, from 1 July.
  {id: 'billing_year', title: 'Charging energy, the billing year', expect: 'wait_sun',
    states: patch(from('wait_sun'), {[E.carEnergySolar]: {attributes: {counting_since: JULY}}, [E.carEnergyPeak]: {attributes: {last_reset: JULY}}, [E.carEnergyOffpeak]: {attributes: {last_reset: JULY}}})},
  // Automatic charging's switch without a reading: Unavailable, never off.
  {id: 'automatic_unavailable', title: 'Automatic charging unavailable', expect: 'solar',
    states: patch(from('solar'), {[E.carSmart]: {state: 'unavailable'}})},
  // The meters read, but not since when.
  {id: 'period_unknown', title: 'Charging energy, the period unknown', expect: 'unplugged',
    states: patch(from('unplugged'), {[E.carEnergySolar]: {attributes: {counting_since: null}}, [E.carEnergyPeak]: {attributes: {last_reset: null}}, [E.carEnergyOffpeak]: {attributes: {last_reset: null}}})},
];
