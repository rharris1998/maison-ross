// Verified against the live entity registry on 2026-09-06. This is a new,
// deliberately explicit household model, independent of other dashboards.
export const E = Object.freeze({
  weather: 'weather.forecast_home',
  // Ross's house (maison-ross). The bedroom air purifier, the Ring doorbell
  // and cameras, and Home Assistant's own health.
  purifier: 'fan.bedroom_purifier', airQuality: 'sensor.core_300s_series_air_quality',
  pm25: 'sensor.core_300s_series_pm2_5', filterLife: 'sensor.core_300s_series_filter_lifetime',
  doorbellActivity: 'sensor.front_door_last_activity', remoteUi: 'binary_sensor.remote_ui',
  lastBackup: 'sensor.backup_last_successful_automatic_backup',
  // The sun's elevation and azimuth, for the sky (#29).
  sun: 'sun.sun',
  solar: 'sensor.goodwe_pv_power', solarToday: 'sensor.goodwe_today_s_pv_generation',
  grid: 'sensor.p1_meter_power', load: 'sensor.house_load_power', importToday: 'sensor.whole_home_energy_daily_usage',
  exportToday: 'sensor.electricity_export_daily', solarTomorrow: 'sensor.helios_forecast_energy_day_1',
  solarRemaining: 'sensor.helios_forecast_energy_today_remaining', reliability: 'sensor.helios_forecast_forecast_reliability',
  solarCurve: 'sensor.helios_forecast_power_now',
  selfConsumed: 'sensor.electricity_self_consumption_today', bill: 'sensor.electricity_estimated_bill',
  airco: 'climate.ec3a56bc6527', atticTarget: 'sensor.attic_target_temperature', atticSchedule: 'schedule.attic_occupied',
  atticComfort: 'input_number.attic_comfort_temperature', atticSetback: 'input_number.attic_setback_temperature',
  heatingAuto: 'input_boolean.airco_solar_heating', heatingSource: 'sensor.attic_heating_source',
  hotWater: 'sensor.hot_water_cylinder_temperature', boilerPressure: 'sensor.boiler_water_pressure',
  vacuum: 'vacuum.roborock_s8_pro_ultra', vacuumBattery: 'sensor.roborock_s8_pro_ultra_battery',
  vacuumProgress: 'sensor.roborock_s8_pro_ultra_cleaning_progress', vacuumArea: 'sensor.roborock_s8_pro_ultra_cleaning_area',
  // The Car and the Charger (CONTEXT.md). Maison reads charging, readiness and
  // charging energy only; vehicle functions belong to the Tesla app. Checked
  // against live states on 2026-09-27.
  carBattery: 'sensor.other_tesla_model_3_battery_level', carLimit: 'number.other_tesla_model_3_charge_limit',
  carOnline: 'binary_sensor.other_tesla_model_3_status', carFullAt: 'sensor.other_tesla_model_3_time_to_full_charge',
  // Whether the vehicle at the Charger is the Car: the Verified session module (#19).
  carSession: 'sensor.verified_session',
  carLastBattery: 'sensor.car_last_confirmed_battery', carLastLimit: 'sensor.car_last_confirmed_charge_limit',
  carPower: 'sensor.tesla_wall_connector_total_power', carConnected: 'binary_sensor.tesla_wall_connector_vehicle_connected',
  carSmart: 'input_boolean.tesla_solar_charging_active', carOverride: 'input_boolean.tesla_charge_now',
  carReadiness: 'input_text.tesla_charge_readiness_report', carCommand: 'input_text.tesla_charge_command_status',
  carNow: 'script.tesla_charge_now', carAutomatic: 'script.tesla_charge_automatic', carRefresh: 'script.tesla_charge_refresh',
  carPolicy: 'sensor.tesla_charge_policy',
  carEnergyOffpeak: 'sensor.ev_charge_billing_year_offpeak', carEnergyPeak: 'sensor.ev_charge_billing_year_peak',
  carEnergySolar: 'sensor.solar_attributed_charging_energy_billing_year',
  // Money layer. priceAllIn is the marginal delivered cost of the next imported
  // kWh, register-aware and VAT-inclusive; the register prices below are the
  // supplier commodity component only, which is why they read much lower.
  priceAllIn: 'sensor.electricity_price_all_in', offPeakNow: 'binary_sensor.electricity_off_peak_now',
  capCredit: 'sensor.electricity_network_cap_credit', grossImport: 'sensor.electricity_gross_import_billing_year',
  elapsedDays: 'sensor.electricity_billing_year_elapsed_days',
});
// The billing year nets import against export PER REGISTER (a peak surplus does
// not offset off-peak consumption), so the ledger is two independent stories.
// Deliberately no hour boundaries here: the register schedule has been reformed before and
// binary_sensor.electricity_off_peak_now follows the meter's own register.
export const REGISTERS = [
 {id:'peak', name:'Peak hours', imported:'sensor.electricity_import_peak_billing_year', exported:'sensor.electricity_export_peak_billing_year', reserve:'sensor.electricity_peak_compensation_reserve', billable:'sensor.electricity_billable_peak', price:'sensor.electricity_price_engie_peak_effective'},
 {id:'offpeak', name:'Off-peak hours', imported:'sensor.electricity_import_offpeak_billing_year', exported:'sensor.electricity_export_offpeak_billing_year', reserve:'sensor.electricity_off_peak_compensation_reserve', billable:'sensor.electricity_billable_off_peak', price:'sensor.electricity_price_engie_off_peak_effective'},
];
// The Estimated bill's lines, ex-VAT, as [label, sensor, billable]. billable
// is true for a line charged only on billable energy (the tariff's
// estimated_bill in config/custom_templates/tariff/pricing.jinja: supplier
// energy, green energy, and the levy and raccordement under levies & taxes),
// which reads 0.00 € while export covers both registers. The standing charge
// accrues by day, and distribution and transport are charged on gross import.
export const COSTS = [
 ['Supplier energy','sensor.electricity_cost_supplier_energy',true],
 ['Green energy','sensor.electricity_cost_green',true],
 ['Supplier standing charge','sensor.electricity_cost_supplier_fixed',false],
 ['Distribution','sensor.electricity_cost_distribution',false],
 ['Transport','sensor.electricity_cost_transport',false],
 ['Levies & taxes','sensor.electricity_cost_taxes',true],
];
// ---- Climate (#21) -------------------------------------------------------
// The house heats by zone, not by room (CONTEXT.md, Climate). Readings are
// explicit mappings checked read-only against Home Assistant on 2026-09-28.
// A radiator valve's own temperature is a probe on the radiator, never an
// ambient reading, and is always labelled as such.

// Every id the Climate page reads or writes that the heating packages provide
// (#22–#26), in one place. Until each exists the page shows it as unknown or
// "Not set up yet", never as 0 or a broken control. The scripts are the page's
// only way to change the heating apart from the fixed zones' valves; each is
// allowlisted with its guard in climate.js.
export const CLIMATE_CONTRACT = Object.freeze({
  // State off | schedule | manual | override | away | unknown (#22). Attributes:
  // target, next_change, override_until, override_temperature, away_from,
  // away_until, day_temperature (the week's highest temperature),
  // room_temperature (the thermostat's corrected reading), calling, pump,
  // clock_offset_s (real minus thermostat) and week ({monday: [{start, end,
  // temperature}], …} in the thermostat's own clock). Times are real local
  // ISO strings.
  houseHeating: 'sensor.house_heating',
  // Sam's office becomes the second scheduled zone (#24). Zone targets carry
  // mode (comfort | setback | override), override_until, next_change and
  // needs_house_heat.
  samTarget: 'sensor.sams_office_target_temperature',
  // The fixed zones' targets: the valve's own setpoint, with mode fixed. The
  // charts draw them; until they exist the cards read the valve itself.
  bedroomTarget: 'sensor.bedroom_suite_target_temperature',
  noahTarget: 'sensor.noahs_room_target_temperature',
  samSchedule: 'schedule.sams_office_occupied',
  samComfort: 'input_number.sams_office_comfort_temperature',
  samSetback: 'input_number.sams_office_setback_temperature',
  // A zone override's temperature; its min, max and step bound the card's stepper.
  atticOverride: 'input_number.attic_override_temperature',
  samOverride: 'input_number.sams_office_override_temperature',
  // Drying, with an `until` attribute (#26).
  ensuiteDrying: 'binary_sensor.ensuite_towel_rail_drying',
  bathroomDrying: 'binary_sensor.bathroom_towel_rail_drying',
  // The cooling switch (#25).
  aircoCooling: 'input_boolean.airco_cooling',
  scripts: Object.freeze({
    zoneOverride: 'script.heating_zone_override',
    zoneOverrideCancel: 'script.heating_zone_override_cancel',
    dryingStart: 'script.towel_rail_drying_start',
    dryingStop: 'script.towel_rail_drying_stop',
    houseOverrideSet: 'script.house_heating_override_set',
    houseOverrideCancel: 'script.house_heating_override_cancel',
    houseAwaySet: 'script.house_heating_away_set',
    houseAwayCancel: 'script.house_heating_away_cancel',
    houseWarmUntil: 'script.house_heating_warm_until',
  }),
});
const valve = (id, name, probe) => Object.freeze({id, name, probe});
// The Open plan's valves. The house thermostat leads (ADR 0004): these are not
// controls.
export const HOUSE_VALVES = Object.freeze([
  valve('climate.living_room_trv', 'Living room radiator', 'sensor.living_room_trv_local_temperature'),
  valve('climate.kitchen_trv', 'Kitchen radiator', 'sensor.kitchen_trv_local_temperature'),
]);
// House heating is the Open plan's control, measured in the living room. The
// outdoor sensor is the boiler's own, on the north wall and always shaded.
export const HOUSE = Object.freeze({
  id: 'house', name: 'House heating', rooms: 'Living room · Kitchen · Dining room',
  temperature: 'sensor.living_room_sensor_temperature', humidity: 'sensor.living_room_sensor_humidity',
  readingLabel: 'Living room sensor', pump: 'sensor.boiler_pump_state', outdoor: 'sensor.boiler_outside_temperature',
  valves: HOUSE_VALVES,
});
// Zones in page order: the Attic, then the first floor. A fixed zone holds the
// target of its one valve; a scheduled zone follows comfort and setback. Every
// zone's `target` is its target sensor. `short` names it where space is tight,
// under its capsule on the Climate header chart.
export const ZONES = Object.freeze([
  Object.freeze({id: 'attic', name: 'Attic', short: 'Attic', rooms: 'Alex’s office · Playground', floor: 'Second floor', kind: 'scheduled', icon: 'desk',
    temperature: 'sensor.office_sensor_temperature', humidity: 'sensor.office_sensor_humidity', readingLabel: 'Office sensor',
    valves: Object.freeze([valve('climate.office_trv', 'Office radiator', 'sensor.office_trv_local_temperature'),
      valve('climate.playground_trv', 'Playground radiator', 'sensor.playground_trv_local_temperature')]),
    target: E.atticTarget, schedule: E.atticSchedule, comfort: E.atticComfort, setback: E.atticSetback,
    // `zone` as script.heating_zone_override names it.
    script: 'attic', override: CLIMATE_CONTRACT.atticOverride,
    airco: E.airco, heatingSource: E.heatingSource, aircoHeating: E.heatingAuto}),
  Object.freeze({id: 'sam', name: 'Sam’s office', short: 'Sam', rooms: 'Sam’s office', floor: 'First floor', kind: 'scheduled', icon: 'desk',
    temperature: 'sensor.sams_office_sensor_temperature', humidity: 'sensor.sams_office_sensor_humidity', readingLabel: 'Room sensor',
    valves: Object.freeze([valve('climate.sams_office_trv', 'Radiator', 'sensor.sams_office_trv_local_temperature')]),
    target: CLIMATE_CONTRACT.samTarget, schedule: CLIMATE_CONTRACT.samSchedule,
    comfort: CLIMATE_CONTRACT.samComfort, setback: CLIMATE_CONTRACT.samSetback,
    script: 'sams_office', override: CLIMATE_CONTRACT.samOverride}),
  Object.freeze({id: 'noah', name: 'Noah’s room', short: 'Noah', rooms: 'Noah’s room', floor: 'First floor', kind: 'fixed', icon: 'moon',
    temperature: 'sensor.noahs_room_sensor_temperature', humidity: 'sensor.noahs_room_sensor_humidity', readingLabel: 'Room sensor',
    valves: Object.freeze([valve('climate.noahs_room_trv', 'Radiator', 'sensor.noahs_room_trv_local_temperature')]),
    target: CLIMATE_CONTRACT.noahTarget}),
  Object.freeze({id: 'bedroom-suite', name: 'Bedroom suite', short: 'Bedroom', rooms: 'Bedroom · Ensuite', floor: 'First floor', kind: 'fixed', icon: 'bed',
    temperature: 'sensor.bedroom_sensor_temperature', humidity: 'sensor.bedroom_sensor_humidity', readingLabel: 'Bedroom sensor',
    valves: Object.freeze([valve('climate.bedroom_trv', 'Bedroom radiator', 'sensor.bedroom_trv_local_temperature')]),
    target: CLIMATE_CONTRACT.bedroomTarget}),
]);
// Towel rails follow no zone's target, even inside the Bedroom suite. No room
// sensor: the only temperature is the valve's probe. The id is the `rail` the
// Drying scripts take.
export const TOWEL_RAILS = Object.freeze([
  Object.freeze({id: 'ensuite', name: 'Ensuite', valve: 'climate.ensuite_trv', probe: 'sensor.ensuite_trv_local_temperature', drying: CLIMATE_CONTRACT.ensuiteDrying}),
  Object.freeze({id: 'bathroom', name: 'Bathroom', valve: 'climate.bathroom_trv', probe: 'sensor.bathroom_trv_local_temperature', drying: CLIMATE_CONTRACT.bathroomDrying}),
]);
// Old #rooms/<room> links open the drawer of that room's zone. The Hallway's
// radiator only keeps the circuit open and belongs to no zone.
export const ROOM_DETAIL = Object.freeze({
  living: 'house', kitchen: 'house', dining: 'house', office: 'attic', playground: 'attic',
  bedroom: 'bedroom-suite', noah: 'noah', sam: 'sam', ensuite: 'towel-rails', bathroom: 'towel-rails', hallway: null,
});
// No calendars yet: Coming up stays hidden until one is added here.
export const CALENDARS = [];
// The Ring cameras, in the order Today lists them: [name, camera, last activity, battery].
export const CAMERAS = Object.freeze([
 Object.freeze(['Front door','camera.front_door_live_view','sensor.front_door_last_activity','sensor.front_door_battery']),
 Object.freeze(['Garden','camera.garden_live_view','sensor.garden_last_activity','sensor.garden_battery']),
 Object.freeze(['Living room','camera.living_room_live_view','sensor.living_room_last_activity','sensor.living_room_battery']),
 Object.freeze(['Dining room','camera.dining_room_live_view','sensor.dining_room_last_activity','sensor.dining_room_battery']),
]);
export const BINS = [];
export const MAINTENANCE = [
 ['Vacuum filter','sensor.roborock_s8_pro_ultra_filter_time_left'],
 ['Dock strainer','sensor.roborock_s8_pro_ultra_dock_strainer_time_left'],
 ['Side brush','sensor.roborock_s8_pro_ultra_side_brush_time_left'],
 ['Vacuum sensors','sensor.roborock_s8_pro_ultra_sensor_time_left'],
];
export const BAD = new Set(['unknown','unavailable','']);
export function numeric(value) { return value === null || value === undefined || BAD.has(String(value)) || !Number.isFinite(Number(value)) ? null : Number(value); }
export function available(state) { return !!state && !BAD.has(state.state); }
export function pretty(value) { return String(value ?? 'No reading').replaceAll('_',' ').replace(/^\w/, c => c.toUpperCase()); }
export function power(value, unit='W') { const n=numeric(value); if(n===null) return '—'; const watts=unit==='kW'?n*1000:n; return Math.abs(watts)>=1000 ? `${(Math.abs(watts)/1000).toFixed(2)} kW` : `${Math.round(Math.abs(watts))} W`; }
export function binDay(value) { const n=numeric(value); return n===null?'Date unavailable':n===0?'Today':n===1?'Tomorrow':`In ${n} days`; }
/** A reading with `digits` decimals and `suffix`, or the state's own unit when no suffix is given; '—' when it has no number. */
export function formatReading(state, digits=1, suffix) { const n=numeric(state?.state); return n===null?'—':`${n.toFixed(digits)}${suffix??(' '+(state?.attributes?.unit_of_measurement||''))}`.trim(); }
export function alerts(states) {
 const out=[];
 for(const [name,id] of MAINTENANCE) { const n=numeric(states[id]?.state); if(n!==null&&n<=0) out.push({title:`${name} needs cleaning`,detail:'Maintenance interval reached',entity:id,icon:'vacuum'}); }
 for(const [title,id] of [['Vacuum needs water','binary_sensor.roborock_s8_pro_ultra_water_shortage'],['Empty the dirty-water tank','binary_sensor.roborock_s8_pro_ultra_dock_dirty_water_box'],['Check the clean-water tank','binary_sensor.roborock_s8_pro_ultra_dock_clean_water_box'],['Charging needs attention','binary_sensor.tesla_charge_not_accepting'],['Check solar export','binary_sensor.solar_zero_export_suspected'],['Rate card needs new rates','binary_sensor.rate_card_ends_within_30_days']]) if(states[id]?.state==='on') out.push({title,detail:'Open for details',entity:id,icon:'alert'});
 for(const [name,id,ok] of [['Vacuum','sensor.roborock_s8_pro_ultra_vacuum_error','none'],['Vacuum dock','sensor.roborock_s8_pro_ultra_dock_dock_error','ok']]) if(available(states[id])&&states[id].state!==ok) out.push({title:`${name}: ${pretty(states[id].state)}`,detail:'Device reported an error',entity:id,icon:'alert'});
 for(const [name,id] of BINS) { const n=numeric(states[id]?.state); if(n!==null&&n<=1&&n>=0) out.push({title:`${name} · ${binDay(n).toLowerCase()}`,detail:'Put the bin out',entity:id,icon:'bin'}); }
 for(const s of Object.values(states)) if(s.attributes?.device_class==='battery'&&s.attributes?.unit_of_measurement==='%'&&numeric(s.state)!==null&&numeric(s.state)<=20&&!/tesla|iphone/i.test(s.entity_id)) out.push({title:`${s.attributes.friendly_name || 'Device battery'}\u00a0·\u00a0${s.state}%`,detail:'Battery running low',entity:s.entity_id,icon:'battery'});
 for(const [name,,,battery] of CAMERAS) if(states[battery]&&!available(states[battery])&&states[battery].state==='unavailable') out.push({title:`${name} camera offline`,detail:'Check its power and Wi-Fi',entity:battery,icon:'signal'});
 { const n=numeric(states[E.filterLife]?.state); if(n!==null&&n<=10) out.push({title:`Purifier filter · ${n}% left`,detail:'Order a replacement filter',entity:E.filterLife,icon:'leaf'}); }
 { const due=Object.values(states).filter(s=>s.entity_id.startsWith('update.')&&s.state==='on'); if(due.length) out.push({title:due.length===1?`${due[0].attributes?.title||due[0].attributes?.friendly_name||'An update'} update ready`:`${due.length} updates ready`,detail:'Install from Settings',entity:due[0].entity_id,icon:'refresh'}); }
 return out;
}

// Reads one register's year-to-date ledger. Returns null when either meter is
// missing so the card can say so rather than draw an empty bar at zero.
export function ledger(states, register) {
 const imported=numeric(states[register.imported]?.state), exported=numeric(states[register.exported]?.state);
 if(imported===null||exported===null) return null;
 const reserve=numeric(states[register.reserve]?.state), billable=numeric(states[register.billable]?.state);
 return {imported, exported, reserve, billable, covered: billable===null?null:billable<=0, scale: Math.max(imported, exported, 1)};
}
