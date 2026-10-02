// The Energy page (#27, recomposed in #29 step 4, v33): figures for what the
// next kilowatt-hour costs, what the billing year has done so far, the bill
// so far and today's power from midnight (v37), each opening one of four
// sheets (ENERGY_DETAILS, energyDrawerValue), and the header's flows.
// Today's energy breakdown is built here and shared with Today
// (energyBreakdown) and the Energy today sheet, which the chart opens.
// It is plain data that React draws: screen.js hands it over. Every visible
// phrase and number is formatted here, so React composes no English, and
// every link comes from the injected kit, so React decides no enablement
// either. It reads only the snapshot (states, now, tz, loaded), never the
// clock or the element, and a missing reading reads '—' or 'No reading',
// never 0. `label` is visible text; any key ending in Label is an accessible
// name only. Link and Kit are the typedefs in climate.js's value section.
import {E, REGISTERS, COSTS, numeric, available, power, ledger, formatReading} from './model.js?v=38';
import {powerDay} from './history.js?v=38';
import {carStatus, chargeSource, wattsOf, SOLAR_ACTIVE_W} from './car.js?v=38';

// Each history definition names the cache group it is loaded and kept under.
// `key: 'power'` names the chart: its Full history intent and its accessible
// description both use it.
export const POWER_HISTORY = Object.freeze({key: 'power', group: 'energy', ids: [E.load, E.solar, E.grid], labels: ['Home', 'Solar', 'Grid'], title: 'Power through the day'});

// What the next kilowatt-hour from the grid costs, all in, to three
// decimals ('0.369', or '—'): the header's reading and the Price card's
// figure.
const allInPrice = states => formatReading(states[E.priceAllIn], 3, '');

/**
 * @typedef {{kind: 'flows', nodes: {solar: FlowNode, grid: FlowNode, house: FlowNode, car: FlowNode},
 *   plot: {links: FlowLink[]}, reading: {figure: string, unit: string, line: string}, ariaLabel: string}} FlowsHero
 *   Energy's header chart (#29 step 3): power now between four nodes. reading is the all-in price
 *   (allInPrice's, or '—') with its unit and a short line, drawn on desktop only.
 *   ariaLabel is the whole reading in one sentence ('Power now: solar 2.84 kW, exporting 1.52 kW, house
 *   1.32 kW, Car 3.80 kW charging from solar.').
 * @typedef {{name: 'Solar'|'Grid'|'Export'|'House'|'Car'|'Charger', value: string, plot: {watts: number|null, active: boolean, available: boolean, asleep: boolean}}} FlowNode
 *   value '2.84 kW', '0 W' or '—'; plot.watts is signed (the grid's is below zero while exporting, and its
 *   node is named 'Export' once that export is active, below −10 W). active: solar ≥ 10 W, grid import > 10 W or export < −10 W, the house
 *   ≥ 10 W, the Car drawing. available: the node has a reading (the Car's is none while the Charger is
 *   offline). The Car's node is named 'Charger' while another vehicle is at it. asleep: solar without a reading while sun.sun's elevation is below 0, drawn dim rather than
 *   as a fault.
 * @typedef {{from: 'solar'|'grid'|'house', to: 'house'|'car', source: 'solar'|'grid'|'export'|null}} FlowLink
 *   Three links: solar → house, grid → house ('export' flows house → grid) and house → Car (its source).
 */

// The grid flows beyond 10 W either way; nearer zero it is at rest. Today's
// power now (today.js) follows the same threshold.
export const GRID_ACTIVE_W = 10;
// A node: its name and power ('2.84 kW', '0 W', or '—' without a reading).
const flowNode = (name, watts, active, asleep = false) => ({name, value: watts === null ? '—' : power(watts),
  plot: {watts, active, available: watts !== null, asleep}});

/**
 * Energy's header: the line under the title (the register and the grid's
 * direction, e.g. 'Off-peak now · importing', or 'Exporting' with the
 * register unknown; unknown parts are left out) and the flows hero, from
 * the snapshot only. Solar without a reading while the
 * sun is down is asleep, not a fault. The Car is the
 * Charger's power, the same carStatus the Car page reads, and none while the
 * Charger is offline; while another vehicle is at the Charger, the node is
 * the Charger's and never claims the Car.
 * @param {object} snap the element's snapshot
 * @returns {{line: string|null, hero: FlowsHero}}
 */
export function energyHeader(snap) {
  const {states} = snap, sun = states[E.sun], car = carStatus(states, {now: snap.now, zone: snap.tz, last: snap.carLast});
  const [solar, grid, house] = [E.solar, E.grid, E.load].map(id => wattsOf(states[id]));
  const carWatts = car.charger === 'offline' ? null : car.watts, charging = carWatts !== null && car.drawing, other = car.otherVehicle || car.key === 'other_vehicle';
  const producing = solar !== null && solar >= SOLAR_ACTIVE_W, importing = grid !== null && grid > GRID_ACTIVE_W, exporting = grid !== null && grid < -GRID_ACTIVE_W;
  const elevation = available(sun) ? numeric(sun.attributes?.elevation) : null, asleep = solar === null && elevation !== null && elevation < 0;
  const source = charging ? chargeSource(car, states) : null;
  const nodes = {solar: flowNode('Solar', solar, producing, asleep), grid: flowNode(exporting ? 'Export' : 'Grid', grid, importing || exporting),
    house: flowNode('House', house, house !== null && house >= GRID_ACTIVE_W), car: flowNode(other ? 'Charger' : 'Car', carWatts, charging)};
  const register = available(states[E.offPeakNow]) ? states[E.offPeakNow].state === 'on' ? 'Off-peak now' : 'Peak now' : null;
  const said = [solar !== null ? `solar ${nodes.solar.value}` : asleep ? 'solar asleep' : 'no solar reading',
    grid === null ? 'no grid reading' : `${importing ? 'importing' : exporting ? 'exporting' : 'grid'} ${nodes.grid.value}`,
    house === null ? 'no house reading' : `house ${nodes.house.value}`,
    carWatts === null ? 'no Car reading' : other ? charging ? `another vehicle charging ${nodes.car.value}` : 'another vehicle plugged in'
      : charging ? `Car ${nodes.car.value} charging from ${source === 'solar' ? 'solar' : 'the grid'}` : 'Car not charging'];
  const line = [register, importing ? 'importing' : exporting ? 'exporting' : ''].filter(Boolean).join(' · ');
  return {line: line ? line[0].toUpperCase() + line.slice(1) : null,
    hero: {kind: 'flows', ariaLabel: `Power now: ${said.join(', ')}.`, nodes,
      plot: {links: [{from: 'solar', to: 'house', source: producing ? 'solar' : null},
        {from: 'grid', to: 'house', source: importing ? 'grid' : exporting ? 'export' : null},
        {from: 'house', to: 'car', source}]},
      reading: {figure: allInPrice(states), unit: '€/kWh from the grid', line: 'All-in: supplier, network, levies and VAT.'}}};
}

// ---- The page and its sheets (#29 step 4, v33) -----------------------------
/**
 * The Energy page shows figures, and tapping one opens its sheet at
 * #energy/<id> (ENERGY_DETAILS): Price, Billing year, Bill so far or Energy
 * today. Every heading, caption and Why is a value's words; a reading
 * without a number is '—', never 0. Colours have one meaning each: pink is
 * the peak register, indigo the off-peak register and the grid, yellow
 * solar, green export (or the cap's credit coming back), gray anything
 * else. No value carries an ariaLabel a part doesn't require (the
 * breakdown's SegmentBar does): a linked Widget is named by its title.
 *
 * @typedef {{id: 'energy', priceCard: PriceCard, year: YearCard, billCard: BillCard, capCard: CapCard,
 *   rates: RatesCard, dayChart: DayChart, widgets: WidgetSlot[]}} EnergyPage
 *   The Energy today card left in v37: the chart's figures say the day, and its Details open the sheet.
 * @typedef {(string|{strong: string})[]} Rich
 *   One line whose `strong` parts are drawn bold. Always an array, even with no strong part.
 * @typedef {{label: 'Peak register'|'Off-peak register', tone: 'pink'|'indigo', icon: 'sun'|'moon'}} RegisterChip
 *   The live register, as ui/chip.jsx's Chip draws it: label is text, tone and icon are structural.
 * @typedef {{label: string, tone: 'green'|'gray'}} StateChip
 *   A sheet's state chip, drawn by Chip with no glyph: green while export covers a register or the cap gives
 *   credit back, gray otherwise. Energy has no orange chip: nothing here needs Alex to act.
 * @typedef {{title: 'Next kWh from the grid', icon: 'energy', figure: string, unit: '€/kWh'|'', line: string,
 *   register: RegisterChip|null, link: Link}} PriceCard
 *   figure is allInPrice's ('0.369', '—'), unit '' while it is '—'; line 'All-in: supplier, network, levies and VAT.'; register is null
 *   while the register is unknown. link opens Price.
 * @typedef {{tone: 'pink'|'indigo', share: number|null, state: 'credit'|'billing'|'missing'}} RingPlot
 *   One register's ring (ui/ring.jsx's RingPair): the share of its export credit used. By the engine's verdict
 *   (ledger().covered, from the register's billable energy): while export covers it (credit), imported ÷
 *   exported year to date, clamped to 0–1; while it bills (billing), 1; null (missing) with no ledger or while
 *   the billable has no reading, since only the engine decides whether a register bills, never the meters.
 * @typedef {{name: 'Peak credit used'|'Off-peak credit used', tone: 'pink'|'indigo', figure: string, line: string}} RegisterLine
 *   figure '86%' ('0%' and '100%' only at 0 and 1), or '—' while the ring is missing; line '45.8 kWh left',
 *   'Fully covered' (covered, the reserve without a reading: its kWh are left out rather than said as 0),
 *   '12.3 kWh billed' (the full ring and 100% already say the credit is used up) or 'No reading'.
 * @typedef {{title: string, icon: 'life', rings: {plot: RingPlot[]}, registers: RegisterLine[], link: Link}} YearCard
 *   title 'Billing year · day 92', or 'Billing year' without the day. Peak comes first in both arrays. link opens
 *   Billing year.
 * @typedef {{title: 'Bill so far', icon: 'paper', figure: string, line: 'Estimated, year to date', link: Link}} BillCard
 *   figure '101.99 €' or '—', the Estimated bill (never the invoice, as its line says). link opens Bill.
 * @typedef {{title: 'Network cap credit', icon: 'grid', figure: string, line: string, link: Link}} CapCard
 *   figure '6.42 €' or '—'; line 'Binding so far', 'Not binding yet', or 'No reading' while the credit or whether
 *   it binds has no reading. link opens Bill.
 * @typedef {{name: 'Peak'|'Off-peak', value: string, live: boolean, tone: 'pink'|'indigo', badge: 'Now'|null}} RateRow
 *   value '0.1900' or '—' (supplier energy, €/kWh); the live register's row is live, with the badge 'Now'.
 * @typedef {{title: 'Supplier rate by register', icon: 'energy', rows: RateRow[], line: string, link: Link}} RatesCard
 *   rows: peak, then off-peak. line 'Supplier energy only, €/kWh. Off-peak is about 19% cheaper.', the saving said
 *   only while off-peak is cheaper by 1% or more; 'Supplier energy only, €/kWh. Off-peak has no reading.' (or
 *   Peak) with one rate missing; 'Supplier rates have no reading.' with neither. link opens Price.
 * @typedef {{title: 'Through the day', icon: 'chart', model: DayModel, action: Link}} DayChart
 *   Today's power from midnight (v37); action is Details (labelled), the Widget's action, opening Energy
 *   today, whose links hold Full history.
 * @typedef {{key: 'solar'|'grid'|'house', label: 'Solar'|'Grid'|'Consumed', value: string, unit: 'kWh'|''}} DayFigure
 *   One of the chart's three figures for the day so far, from the meters' daily totals Energy today prints:
 *   solar generated, imported, and consumed (used at home plus imported). value '6.8' or '—', unit '' with '—'.
 * @typedef {PowerDay & {figures: DayFigure[], forecast: {start: number, end: number, solar: number}[]}} DayModel
 *   history.js's powerDay over the energy group, with the day's figures (solar, grid, consumed) and the rest of
 *   today's solar forecast: Helios's quarter hours averaged over the day's steps (W) from the record's end
 *   (from now while nothing is recorded) to midnight, the first cut at that end, without the dark hours
 *   either side of the sun's; none when it forecasts no sun.
 * @typedef {{id: 'chart'|'year'|'rates'|'bill'|'cap', size: 'medium'|'xl'}} WidgetSlot
 *   From 700px, the page's widgets in drawing order: the chart first, then the billing year beside the
 *   rates and the bill beside the cap. The renderer puts Price (medium) first where the hero doesn't draw
 *   the price.
 *
 * @typedef {{id: 'price'|'billing-year'|'bill'|'energy-today', title: string, eyebrow: 'Energy',
 *   body: PriceSheet|YearSheet|BillSheet|DaySheet}} EnergyDrawer
 *   title is the detail's name (ENERGY_DETAILS); screen.js adds `close`.
 * @typedef {{title: 'Why', paragraphs: string[]}} Why
 *   A sheet's last section, collapsed.
 * @typedef {{kind: 'price', summary: {figure: string, unit: '€/kWh'|'', line: string, register: RegisterChip|null},
 *   rates: {heading: 'Supplier rate by register', rows: RateRow[], footer: string}, why: Why}} PriceSheet
 *   summary is the page's PriceCard, less its title and link; rates.footer is the RatesCard's line. why: what the
 *   all-in price includes, and where the live register comes from.
 * @typedef {{kind: 'year', summary: {rings: {plot: RingPlot[]}, registers: RegisterLine[]}, registers: RegisterLedger[], why: Why}} YearSheet
 *   summary is the page's YearCard's rings and lines. why: each register is netted on its own across the
 *   July–June year.
 * @typedef {{heading: 'Peak hours'|'Off-peak hours', tone: 'pink'|'indigo', chip: StateChip,
 *   bars: {label: 'Imported'|'Exported', value: string, width: number, tone: 'indigo'|'green'}[]|null, note: Rich}} RegisterLedger
 *   chip 'Fully covered' (green), 'Billing' or 'No reading' (gray). bars: '285.9 kWh', width a share of the
 *   larger in whole percent (zero meters draw empty bars), null with no reading. note is one line with no bold
 *   part, saying why the chip reads as it does rather than repeating the figures: 'Export
 *   has covered every kWh this register drew.', 'Import has passed export, so the difference is billed.', 'No
 *   reading for this register’s compensation.' (the meters read, the billable doesn't) or 'No reading for this
 *   register’s meters.'
 * @typedef {{kind: 'bill', summary: {figure: string, line: 'Estimated, billing year to date', detail: string|null},
 *   lines: {heading: 'Before VAT', rows: {label: string, value: string}[],
 *     covered: {label: 'Covered by your export', detail: string}|null, empty: string|null},
 *   cap: {heading: 'Network cost cap', chip: StateChip, rows: {label: string, value: string}[], line: Rich},
 *   why: Why, links: Link[]}} BillSheet
 *   summary.detail '798 kWh imported', null without a reading. lines.rows: the cost components with a reading,
 *   less those `covered` folds in: the lines charged only on billable kWh (supplier energy, green energy, levies
 *   & taxes) that have a reading, once every one of them reads 0.00, named in covered.detail ('Supplier energy ·
 *   Green energy · Levies & taxes'); covered is null otherwise, when all three stay rows. A line without a number
 *   is neither. empty is the line drawn
 *   with no row and nothing covered.
 *   cap.chip 'Binding' (green), 'Not binding' or 'No reading' (gray): the engine's `binding`, true or false as a
 *   bool or a string in any case, 'No reading' while it is neither or the credit has no number. cap.rows Credit
 *   applied and Cap so far ('—' without its attribute), [] while the cap has no reading. cap.line: binding, 'Network
 *   costs are over the cap so far, so the excess comes back as credit.' (the credit is the excess, so no second
 *   figure); under, 'Network costs are 18.40 € under the cap so far, so no credit yet.', the figure left out without
 *   `slack_eur`; with no reading, 'The cap has no reading.'. why: the lines don't add up
 *   to the estimate (VAT, the prorated ORES fee and the cap's credit), which lines export covers, and the cap is
 *   prorated by elapsed days. links: Bill details and Full energy dashboard.
 * @typedef {{kind: 'day', summary: EnergyBreakdown, rows: {icon: string, tone: 'yellow'|'green'|'indigo'|'gray', title: string, value: string,
 *   link: Link}[], why: Why, links: Link[]}} DaySheet
 *   summary is the breakdown (energyBreakdown) with link null. rows, each opening its reading (more): Solar generated,
 *   Used at home, Exported, From the grid, Solar still to come today, Solar tomorrow (kWh) and Forecast
 *   reliability (%, the Helios solar forecast's), '—' without a reading. The first four print the breakdown's
 *   own tenths ('3.1 kWh'), so they agree with its bar; Used at home, Exported and From the grid take the bar's
 *   tones (yellow, green, indigo), and every other row is gray. why: used at home is solar less
 *   export, including what charged the Car, the grid's counts come from the meter, the inverter sleeps
 *   overnight, and the forecast rows are the Helios solar forecast's. links: Full history (the power's, in
 *   Home Assistant), since v37, when the chart's own action became this sheet.
 * @typedef {{title: 'Energy today', icon: 'sun', figure: {label: 'Solar generated', value: string, unit: string},
 *   bar: {kind: 'split'|'zero'|'missing', segments: {key: 'home'|'export'|'import', tone: 'yellow'|'green'|'indigo', share: number}[], ariaLabel: string},
 *   legend: {tone: 'yellow'|'green'|'indigo', text: string}[], link: Link|null}} EnergyBreakdown
 *   Today's solar, export and import in kWh, to the tenth the legend prints: used at home (solar less export, never
 *   below 0), exported and from the grid, each share a fraction of their sum; a part at 0 has no segment. kind is
 *   'split' with segments, 'zero' while all three are 0 ('Energy today: nothing generated or used yet') and 'missing'
 *   while a reading is missing ('Energy today: some readings are missing'), both with no segments; a missing reading's
 *   legend text reads '— exported', and the figure is '—' with unit '' without a solar reading. Today's widget
 *   opens Energy, its link named with the figure and the split; Energy's opens Energy today; the sheet's has none.
 */

// Everything #energy/<id> can open, in page order.
export const ENERGY_DETAILS = Object.freeze([{id: 'price', name: 'Price'}, {id: 'billing-year', name: 'Billing year'},
  {id: 'bill', name: 'Bill so far'}, {id: 'energy-today', name: 'Energy today'}].map(Object.freeze));
// Through the day (v37): POWER_HISTORY's cache group and entities, by what
// each measures.
export const POWER_DAY = Object.freeze({group: POWER_HISTORY.group, house: E.load, solar: E.solar, grid: E.grid});

// Each register's words and tone, by REGISTERS' id.
const SIDES = Object.freeze({peak: {tone: 'pink', rate: 'Peak', used: 'Peak credit used'}, offpeak: {tone: 'indigo', rate: 'Off-peak', used: 'Off-peak credit used'}});
const detail = (kit, id) => kit.link({command: 'detail', entity: id});
const more = (kit, entity, extra) => kit.link({command: 'more', entity}, extra);
// Whether the cap binds, as the engine says: true or false (a bool, or the
// string in any case), null while it says neither.
const bindingOf = state => ({true: true, false: false})[String(state?.attributes?.binding).toLowerCase()] ?? null;
// The cap's credit and whether it binds, or null while either has no reading.
function capReading(states) {
  const state = states[E.capCredit], credit = numeric(state?.state), binding = bindingOf(state);
  return credit === null || binding === null ? null : {credit, binding, attributes: state.attributes ?? {}};
}
const why = (...paragraphs) => ({title: 'Why', paragraphs});
const euros = value => `${value.toFixed(2)} €`;
// A share of 0–1 in whole percent: only 0 reads 0% and only 1 reads 100%.
const percent = share => `${share > 0 && share < 1 ? Math.min(99, Math.max(1, Math.round(share * 100))) : Math.round(share * 100)}%`;
// A reading in kWh as the legend prints it, to a tenth; null stays null.
const tenth = value => value === null ? null : Number(value.toFixed(1));
const capitalised = text => text[0].toUpperCase() + text.slice(1);
// Today's kWh to the tenth the breakdown prints, each null without a
// reading: solar generated, used at home (solar less export, never below 0),
// exported and from the grid. The breakdown and the Energy today sheet's
// rows print these same four, so the sheet never gives two numbers for one.
function todaysEnergy(states) {
  const [solar, exported, imported] = [E.solarToday, E.exportToday, E.importToday].map(id => tenth(numeric(states[id]?.state)));
  return {solar, home: solar === null || exported === null ? null : tenth(Math.max(0, solar - exported)), exported, imported};
}

/**
 * Today's solar, where it went and what came from the grid, to the tenth
 * the legend prints: used at home is solar less export. The bar splits them
 * while all three have a reading and one isn't 0; a part at 0 has no
 * segment. Today's widget (today.js), Energy's and the Energy today sheet's
 * summary are this one value, each with its own link, which `linkOf` makes
 * from the breakdown said in words ('11.5 kWh solar generated. 6.6 kWh used
 * at home, 4.9 kWh exported, 4.6 kWh from the grid.'), for a link that must
 * name all the widget shows.
 * @param {object} snap the element's snapshot
 * @param {(said: string) => Link|null} linkOf
 * @returns {EnergyBreakdown}
 */
export function energyBreakdown(snap, linkOf) {
  const {solar, home, exported, imported} = todaysEnergy(snap.states), kwh = value => value === null ? '—' : value.toFixed(1);
  const parts = [['home', 'yellow', home, 'used at home'], ['export', 'green', exported, 'exported'], ['import', 'indigo', imported, 'from the grid']];
  const missing = parts.some(([, , value]) => value === null), sum = missing ? 0 : home + exported + imported, kind = missing ? 'missing' : sum > 0 ? 'split' : 'zero';
  const legend = parts.map(([, tone, value, text]) => ({tone, text: `${kwh(value)} ${text}`}));
  const known = parts.filter(([, , value]) => value !== null).map(([, , value, text]) => `${kwh(value)} kWh ${text}`);
  const told = {split: `${known.join(', ')}.`, zero: 'Nothing generated or used yet.', missing: `${capitalised([known.join(', '), 'some readings are missing'].filter(Boolean).join('; '))}.`}[kind];
  return {title: 'Energy today', icon: 'sun', figure: {label: 'Solar generated', value: kwh(solar), unit: solar === null ? '' : 'kWh'},
    bar: {kind, segments: kind === 'split' ? parts.filter(([, , value]) => value > 0).map(([key, tone, value]) => ({key, tone, share: value / sum})) : [],
      ariaLabel: {split: `Energy today, in kWh: ${legend.map(l => l.text).join(', ')}`, zero: 'Energy today: nothing generated or used yet', missing: 'Energy today: some readings are missing'}[kind]},
    legend, link: linkOf(kind === 'zero' ? told.toLowerCase() : `${solar === null ? 'no solar reading' : `${kwh(solar)} kWh solar generated`}. ${told}`)};
}

// The live register as a chip, or null while it is unknown.
function registerChip(states) {
  if (!available(states[E.offPeakNow])) return null;
  return states[E.offPeakNow].state === 'on' ? {label: 'Off-peak register', tone: 'indigo', icon: 'moon'} : {label: 'Peak register', tone: 'pink', icon: 'sun'};
}
// The next kilowatt-hour: the page's figure and the Price sheet's summary,
// its unit left out while the figure is '—', as Energy today's is.
function priceSummary(snap) {
  const figure = allInPrice(snap.states);
  return {figure, unit: figure === '—' ? '' : '€/kWh', line: 'All-in: supplier, network, levies and VAT.', register: registerChip(snap.states)};
}
// Each register's supplier rate, the live one badged, and one line: what
// the rates are, how much cheaper off-peak is (only while it is), and which
// register's rate has no reading.
function ratesOf(states) {
  const known = available(states[E.offPeakNow]), offPeak = known && states[E.offPeakNow].state === 'on';
  const [peak, off] = REGISTERS.map(r => numeric(states[r.price]?.state));
  const cheaper = peak !== null && off !== null && peak > 0 ? Math.round((peak - off) / peak * 100) : 0;
  const rows = REGISTERS.map(r => {
    const live = known && (r.id === 'offpeak') === offPeak;
    return {name: SIDES[r.id].rate, value: formatReading(states[r.price], 4, ''), live, tone: SIDES[r.id].tone, badge: live ? 'Now' : null};
  });
  const said = peak === null && off === null ? null : peak === null ? 'Peak has no reading.' : off === null ? 'Off-peak has no reading.'
    : cheaper >= 1 ? `Off-peak is about ${cheaper}% cheaper.` : '';
  return {rows, line: said === null ? 'Supplier rates have no reading.' : `Supplier energy only, €/kWh.${said ? ` ${said}` : ''}`};
}
// One register's ring and line: how much of its export credit is used. Only
// the engine decides whether a register bills (ledger().covered, from its
// billable energy), so while that verdict has no reading the ring is empty
// and the line says so, however the two meters compare. Covered, the share
// is its import over its export, a display ratio; billing, a full ring.
function registerUse(states, register) {
  const l = ledger(states, register), covered = l?.covered ?? null, {tone, used} = SIDES[register.id];
  const share = covered === null ? null : covered === false ? 1 : Math.min(1, Math.max(0, l.exported > 0 ? l.imported / l.exported : l.imported > 0 ? 1 : 0));
  const line = covered === null ? 'No reading' : covered === false ? `${l.billable.toFixed(1)} kWh billed`
    : l.reserve === null ? 'Fully covered' : `${l.reserve.toFixed(1)} kWh left`;
  return {plot: {tone, share, state: covered === null ? 'missing' : covered ? 'credit' : 'billing'},
    line: {name: used, tone, figure: share === null ? '—' : percent(share), line}};
}
function yearCard(snap, kit) {
  const days = numeric(snap.states[E.elapsedDays]?.state), uses = REGISTERS.map(r => registerUse(snap.states, r));
  return {title: days === null ? 'Billing year' : `Billing year · day ${Math.round(days)}`, icon: 'life',
    rings: {plot: uses.map(u => u.plot)}, registers: uses.map(u => u.line), link: detail(kit, 'billing-year')};
}
function capCard(snap, kit) {
  const state = snap.states[E.capCredit], cap = capReading(snap.states);
  return {title: 'Network cap credit', icon: 'grid', figure: formatReading(state, 2, ' €'),
    line: !cap ? 'No reading' : cap.binding ? 'Binding so far' : 'Not binding yet', link: detail(kit, 'bill')};
}

// The day so far, as Energy today counts it: solar generated, imported, and
// consumed, which is what was used at home plus what came from the grid.
function dayFigures(states) {
  const {solar, home, imported} = todaysEnergy(states), consumed = home === null || imported === null ? null : tenth(home + imported);
  return [['solar', 'Solar', solar], ['grid', 'Grid', imported], ['house', 'Consumed', consumed]]
    .map(([key, label, kwh]) => ({key, label, value: kwh === null ? '—' : kwh.toFixed(1), unit: kwh === null ? '' : 'kWh'}));
}
// The rest of today's solar forecast, in the record's steps (`day.step`
// from its midnight): Helios's quarter hours averaged over each, from
// `from` to midnight, the first cut at `from`, trimmed to the sun's (one
// dark step kept either side, so the dotted line rises from zero and lands
// on it); none when it forecasts no sun or has no curve.
function solarForecast(states, from, {start, end, step}) {
  const curve = states[E.solarCurve]?.attributes?.forecast, sums = new Map();
  for (const point of Array.isArray(curve) ? curve : []) {
    const t = Date.parse(point?.datetime), watts = Number(point?.watts);
    if (!Number.isFinite(t) || !Number.isFinite(watts) || t < start || t >= end) continue;
    const at = Math.floor((t - start) / step), sum = sums.get(at) ?? {watts: 0, count: 0};
    sums.set(at, {watts: sum.watts + Math.max(0, watts), count: sum.count + 1});
  }
  const steps = [...sums].sort(([a], [b]) => a - b)
    .map(([at, {watts, count}]) => ({start: Math.max(start + at * step, from), end: Math.min(start + (at + 1) * step, end), solar: Math.round(watts / count)}))
    .filter(p => p.end > from);
  const first = steps.findIndex(p => p.solar > 0), last = steps.findLastIndex(p => p.solar > 0);
  return first < 0 ? [] : steps.slice(Math.max(0, first - 1), last + 2);
}
// Through the day: today's power, the day's figures and the rest of the
// solar forecast, from the record's end, or from now while nothing is
// recorded.
function dayModel(snap) {
  const day = powerDay(snap, POWER_DAY), from = day.rows.at(-1)?.end ?? Math.min(Math.max(snap.now, day.start), day.end);
  return {...day, figures: dayFigures(snap.states), forecast: solarForecast(snap.states, from, day)};
}

/**
 * The Energy page, in drawing order.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @returns {EnergyPage}
 */
export function energyPageValue(snap, kit) {
  const {states} = snap;
  return {id: 'energy',
    priceCard: {title: 'Next kWh from the grid', icon: 'energy', ...priceSummary(snap), link: detail(kit, 'price')},
    year: yearCard(snap, kit),
    billCard: {title: 'Bill so far', icon: 'paper', figure: formatReading(states[E.bill], 2, ' €'), line: 'Estimated, year to date', link: detail(kit, 'bill')},
    capCard: capCard(snap, kit),
    rates: {title: 'Supplier rate by register', icon: 'energy', ...ratesOf(states), link: detail(kit, 'price')},
    dayChart: {title: 'Through the day', icon: 'chart', model: dayModel(snap),
      action: kit.link({command: 'detail', entity: 'energy-today'}, {label: 'Details'})},
    widgets: [{id: 'chart', size: 'xl'}, {id: 'year', size: 'medium'}, {id: 'rates', size: 'medium'}, {id: 'bill', size: 'medium'},
      {id: 'cap', size: 'medium'}],
  };
}

// ---- The sheets ----
function priceSheet(snap) {
  const {rows, line} = ratesOf(snap.states);
  return {kind: 'price', summary: priceSummary(snap), rates: {heading: 'Supplier rate by register', rows, footer: line},
    why: why('The all-in price counts every charge on a kilowatt-hour from the grid: the supplier’s energy, green energy, distribution, transport and levies, with VAT. It leaves out compensation and the network cap, which settle over the billing year.',
      'The supplier rates read lower than the all-in price because they leave out the network, green energy, levies and VAT.',
      'The live register comes from the meter itself. The register schedule stands in only while the meter can’t be reached.')};
}
// A register's imported and exported kWh as bars, each a share of the
// larger in whole percent. The ledger's scale is at least 1 kWh, so zero
// meters draw empty bars rather than divide by zero.
const ledgerBars = l => [['Imported', l.imported, 'indigo'], ['Exported', l.exported, 'green']]
  .map(([label, value, tone]) => ({label, value: `${value.toFixed(1)} kWh`, width: Math.round(value / l.scale * 100), tone}));
// Each register's own ledger: its chip, its imported and exported bars, and
// a note that says why the chip reads as it does rather than repeating the
// figures above it.
function yearSheet(snap, kit) {
  const {rings, registers} = yearCard(snap, kit);
  return {kind: 'year', summary: {rings, registers},
    registers: REGISTERS.map(r => {
      const l = ledger(snap.states, r), covered = l?.covered ?? null;
      const note = !l ? 'No reading for this register’s meters.' : covered === null ? 'No reading for this register’s compensation.'
        : covered ? 'Export has covered every kWh this register drew.' : 'Import has passed export, so the difference is billed.';
      return {heading: r.name, tone: SIDES[r.id].tone, chip: {label: covered === null ? 'No reading' : covered ? 'Fully covered' : 'Billing', tone: covered ? 'green' : 'gray'},
        bars: l && ledgerBars(l), note: [note]};
    }),
    why: why('Each register is netted on its own across the billing year, July to June: peak export offsets only peak import, and off-peak export only off-peak import.',
      'Credit used is a register’s import as a share of its export. Once import passes export, the difference is billed.')};
}
// The network cost cap: binding or not, its credit and the cap so far, and
// how network costs sit against it. While it binds the credit is the
// excess, so the line gives no second figure; under it, how far under.
// While the cap has no reading, its chip and line say so, and no row.
function capSection(states) {
  const cap = capReading(states), heading = 'Network cost cap';
  if (!cap) return {heading, chip: {label: 'No reading', tone: 'gray'}, rows: [], line: ['The cap has no reading.']};
  const slack = numeric(cap.attributes.slack_eur), limit = numeric(cap.attributes.cap_eur);
  return {heading, chip: {label: cap.binding ? 'Binding' : 'Not binding', tone: cap.binding ? 'green' : 'gray'},
    rows: [{label: 'Credit applied', value: euros(cap.credit)}, {label: 'Cap so far', value: limit === null ? '—' : euros(limit)}],
    line: cap.binding ? ['Network costs are over the cap so far, so the excess comes back as credit.']
      : slack === null || slack > 0 ? ['Network costs are under the cap so far, so no credit yet.']
        : ['Network costs are ', {strong: euros(Math.abs(slack))}, ' under the cap so far, so no credit yet.']};
}
// The bill so far: the estimate, the lines before VAT, and the cap. The
// lines charged only on billable energy (COSTS' third field) share one
// base, so they fold into one covered row only together: when every one of
// them with a reading reads 0.00 €. Whether a register bills is the
// engine's to say, never Maison's. The lines are the billing engine's own
// outputs, never itemised into the estimate: that arithmetic belongs to
// energy_billing.yaml. Its links open the bill's reading and Home
// Assistant's energy dashboard.
function billSheet(snap, kit) {
  const {states} = snap, amount = id => numeric(states[id]?.state);
  const read = COSTS.filter(([, id]) => amount(id) !== null), based = read.filter(([, , billable]) => billable);
  const covered = based.length && based.every(([, id]) => Math.round(amount(id) * 100) === 0) ? based : [];
  const rows = read.filter(line => !covered.includes(line)).map(([label, id]) => ({label, value: formatReading(states[id], 2, ' €')}));
  return {kind: 'bill',
    summary: {figure: formatReading(states[E.bill], 2, ' €'), line: 'Estimated, billing year to date',
      detail: amount(E.grossImport) === null ? null : `${formatReading(states[E.grossImport], 0, ' kWh')} imported`},
    lines: {heading: 'Before VAT', rows, covered: covered.length ? {label: 'Covered by your export', detail: covered.map(([label]) => label).join(' · ')} : null,
      empty: rows.length || covered.length ? null : 'No cost line has a reading.'},
    cap: capSection(states),
    why: why('These lines are before VAT and leave out the prorated ORES standing fee and the cap’s credit, so they don’t add up to the estimate.',
      'Supplier energy, green energy and levies & taxes are charged only on billable energy: what a register imports beyond what it exports.',
      'The cap is prorated by the days elapsed, so early in the billing year it can read as not binding even when it will bind at settlement. It says how the year has gone so far, not a forecast.'),
    links: [more(kit, E.bill, {label: 'Bill details', icon: 'paper'}), kit.link({command: 'ha-energy'}, {label: 'Full energy dashboard', icon: 'energy'})]};
}
// Today's readings, each opening its own, as [id, title, icon, tone, the
// breakdown's part]. The first four print the breakdown's own tenths, and
// the three it splits take the bar's tones, so the rows are its legend; the
// rest are gray. The forecasts and the reliability read their sensors.
const DAY_ROWS = [[E.solarToday, 'Solar generated', 'sun', 'gray', 'solar'], [E.selfConsumed, 'Used at home', 'home', 'yellow', 'home'],
  [E.exportToday, 'Exported', 'grid', 'green', 'exported'], [E.importToday, 'From the grid', 'grid', 'indigo', 'imported'],
  [E.solarRemaining, 'Solar still to come today', 'sun', 'gray'], [E.solarTomorrow, 'Solar tomorrow', 'sun', 'gray'],
  [E.reliability, 'Forecast reliability', 'chart', 'gray']];
function daySheet(snap, kit) {
  const {states} = snap, today = todaysEnergy(states);
  const value = (id, part) => part ? today[part] === null ? '—' : `${today[part].toFixed(1)} kWh`
    : id === E.reliability ? formatReading(states[id], 0, '%') : formatReading(states[id], 1, ' kWh');
  return {kind: 'day', summary: energyBreakdown(snap, () => null),
    rows: DAY_ROWS.map(([id, title, icon, tone, part]) => ({icon, tone, title, value: value(id, part), link: more(kit, id)})),
    why: why('Used at home is the solar you didn’t export, including what charged the Car.',
      'The grid meter itself counts what was exported and what came from the grid.',
      'The inverter sleeps overnight and reports no power, but the day’s solar total stays.',
      'Solar still to come, solar tomorrow and forecast reliability come from the Helios solar forecast.'),
    links: [kit.link({command: 'native-history', entity: POWER_HISTORY.key}, {label: 'Full history', icon: 'chart'})]};
}
const SHEETS = Object.freeze({price: priceSheet, 'billing-year': yearSheet, bill: billSheet, 'energy-today': daySheet});

/**
 * An Energy sheet (#29 step 4, v33) by its id, or null for an id
 * ENERGY_DETAILS doesn't have. screen.js adds its `close`.
 * @param {object} snap the element's snapshot
 * @param {Kit} kit
 * @param {string} id
 * @returns {EnergyDrawer|null}
 */
export function energyDrawerValue(snap, kit, id) {
  const d = ENERGY_DETAILS.find(x => x.id === id);
  return d ? {id, title: d.name, eyebrow: 'Energy', body: SHEETS[id](snap, kit)} : null;
}
