// App's sheet (app.jsx), which the gallery draws with too: every Maison
// stylesheet, joined in order. It writes no rule of its own, and it lives
// beside app.jsx because the dashboard's entry exports mountDashboard alone.
import {uiStyles} from './ui/index.js';
import {todayPageStyles} from './pages/today.css.js';
import {climatePageStyles} from './pages/climate.css.js';
import {climateDrawerStyles} from './drawers/climate.css.js';
import {historyChartStyles} from './charts/history.css.js';
import {dayChartStyles} from './charts/day.css.js';
import {energyPageStyles} from './pages/energy.css.js';
import {energyDrawerStyles} from './drawers/energy.css.js';
import {carPageStyles} from './pages/car.css.js';
import {carDrawerStyles} from './drawers/car.css.js';
import {systemPageStyles} from './pages/system.css.js';
import {dialogStyles} from './dialogs.css.js';
import {frameStyles} from './frame.css.js';
import {skyStyles} from './sky.css.js';
import {heroStyles} from './hero.css.js';
import {weatherChartStyles} from './charts/weather.css.js';
import {zonesChartStyles} from './charts/zones.css.js';
import {flowsChartStyles} from './charts/flows.css.js';
import {carChartStyles} from './charts/car.css.js';

// Maison's own controls (the toast's among them), then the frame, then the
// hero's sky and header charts, then the pages' own: Today's, then (v32)
// Climate's page, its sheets and the 24-hour chart they draw, then (v33)
// Energy's chart (v37), page and sheets, then (v34) the Car's, then (v35) Home status's
// and the dialogs'. Each comes after what it draws on, so it wins a tie.
// The page's minimum height is the frame's. Beside it the shadow root holds
// only the element's shell (styles.js), in a layer of its own.
export const appStyles = uiStyles + frameStyles
  + skyStyles + heroStyles + weatherChartStyles + carChartStyles + zonesChartStyles + flowsChartStyles + todayPageStyles
  + climatePageStyles + climateDrawerStyles + historyChartStyles + dayChartStyles + energyPageStyles + energyDrawerStyles + carPageStyles + carDrawerStyles
  + systemPageStyles + dialogStyles;
