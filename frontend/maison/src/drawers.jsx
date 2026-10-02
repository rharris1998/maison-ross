// Maison's sheet bodies (#29 step 4), by the Drawer body's kind:
// Climate's 'house', 'zone' and 'rails' (drawers/climate.jsx, v32),
// Energy's 'price', 'year', 'bill' and 'day' (drawers/energy.jsx, v33) and
// the Car's 'battery' and 'sources' (drawers/car.jsx, v34). DrawerSheet
// (sheets.jsx) and the gallery's sheet windows draw
// `DRAWERS[body.kind]`. Each body takes `{body}`, its page's Drawer
// body (climate.js's, energy.js's or car.js's).
import {BatteryDrawer, SourcesDrawer} from './drawers/car.jsx';
import {HouseDrawer, RailsDrawer, ZoneDrawer} from './drawers/climate.jsx';
import {BillDrawer, DayDrawer, PriceDrawer, YearDrawer} from './drawers/energy.jsx';

export const DRAWERS = {house: HouseDrawer, zone: ZoneDrawer, rails: RailsDrawer, price: PriceDrawer, year: YearDrawer, bill: BillDrawer, day: DayDrawer,
  battery: BatteryDrawer, sources: SourcesDrawer};
