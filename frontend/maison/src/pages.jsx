// Each page Maison draws, by the screen value's page id (#29), each
// recomposed with Maison's own controls in step 4: Today (v31), Climate
// (v32), Energy (v33), the Car (v34) and Home status (v35).
// App and the gallery's frames draw from it.
import {TodayPage} from './pages/today.jsx';
import {ClimatePage} from './pages/climate.jsx';
import {EnergyPage} from './pages/energy.jsx';
import {CarPage} from './pages/car.jsx';
import {SystemPage} from './pages/system.jsx';

export const PAGES = {today: TodayPage, climate: ClimatePage, energy: EnergyPage, car: CarPage, system: SystemPage};
