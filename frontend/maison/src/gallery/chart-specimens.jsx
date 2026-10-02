// The 24-hour chart in the gallery (#29 step 4, v32), drawn from the
// values the sheets draw: the Attic's charts with the fixtures' recorded day
// (a gap, an isolated sample and the schedule's steps), the towel rails'
// valve probes over the pages view's recorded day, then the chart scrubbed,
// partly recorded, loading, with the recorder in error and with nothing
// recorded, each in the bottom sheet's box; then, from 700px, the reading in
// the centred form sheet's. Presses act on nothing.
//
// v37: Energy's chart after them, today's power from midnight, from the
// value Energy's page draws (its `dayChart`) over the Energy fixtures' own
// day: noon exporting with the rest of the solar forecast dotted
// (ENERGY_POWER_HISTORY) and the night importing now, solar asleep
// (ENERGY_NIGHT_POWER_HISTORY). As the page draws it in a widget: on a
// phone's card (DAY_PLOT.phone) in every state and scrubbed (nothing to
// draw: one line), and from 700px filling the grid's xl widget (DAY_PLOT.grid
// at least), two columns at the narrowest wide page and four at the desktop
// page's width, and with nothing recorded its empty axes.
import {useMemo} from 'react';
import {CLIMATE_NOW} from '../../fixtures/climate-fixtures.js';
import {ENERGY_FIXTURES, ENERGY_NIGHT_POWER_HISTORY, ENERGY_NOW, ENERGY_POWER_HISTORY} from '../../fixtures/energy-fixtures.js';
import {fixtureSnapshot} from '../../fixtures/fixture-snapshot.js';
import {EMPTY, LOADING, REJECTED, climateSheetSnapshot, climateSnapshot, useScreen} from '../gallery-snapshots.js';
import {LayoutContext} from '../ui/layout.js';
import {SheetPlacementContext} from '../ui/sheet.jsx';
import {Widget, WidgetGrid} from '../ui/widget.jsx';
import {HistoryChart} from '../charts/history.jsx';
import {DayChart, DAY_PLOT} from '../charts/day.jsx';
import {GalleryGroup, Specimen} from './section.jsx';

// When the scrubbed specimen is held: 08:00, where the Attic's target steps
// up to comfort and its reading lies between two samples.
const SCRUBBED = CLIMATE_NOW - 1.5 * 3600000;

// The Attic sheet's charts for a snapshot option (a preset or a history).
const attic = (screen, options = {}) => screen(climateSnapshot('house_running', {detail: 'attic', ...options})).drawer.body.charts;

export function ChartSpecimens() {
  const screen = useScreen();
  const charts = useMemo(() => {
    const [temperature, humidity] = attic(screen), recorded = climateSnapshot().loaded.history['climate-attic'].data;
    return {temperature, humidity, rails: screen(climateSheetSnapshot('sheet-rails')).drawer.body.charts[0],
      partial: attic(screen, {history: {...recorded, errors: REJECTED.history.errors}})[0], loading: attic(screen, LOADING)[0],
      error: attic(screen, {history: REJECTED.history})[0], empty: attic(screen, EMPTY)[0]};
  }, [screen]);
  // A chart in a sheet's box, as the sheet placed `placement` draws it.
  const specimen = (caption, value, {scrubAt, placement = 'bottom'} = {}) => <Specimen caption={caption}>
    <div className={`m-gallery-charts__box m-gallery-charts__box--${placement}`}><SheetPlacementContext.Provider value={placement}>
      <HistoryChart value={value} scrubAt={scrubAt}/>
    </SheetPlacementContext.Provider></div>
  </Specimen>;
  return <><GalleryGroup title="Charts">
    <div className="m-gallery-charts">
      {specimen('A room reading and its stepped target', charts.temperature)}
      {specimen('Humidity', charts.humidity)}
      {specimen('Two valve probes, the second dotted', charts.rails)}
      {specimen('Scrubbed at 08:00, the reading between samples', charts.temperature, {scrubAt: SCRUBBED})}
      {specimen('Partly recorded', charts.partial)}
      {specimen('Loading', charts.loading)}
      {specimen('The recorder in error', charts.error)}
      {specimen('Nothing recorded', charts.empty)}
    </div>
    <div className="m-gallery-charts__wide">{specimen('In the form sheet, from 700px', charts.temperature, {placement: 'center'})}</div>
  </GalleryGroup><PowerCharts/></>;
}

// When the scrubbed power specimen is held: 11:30, solar covering the house.
const EXPORTING = ENERGY_NOW - 3600000;

// Energy's chart for a fixture (ENERGY_FIXTURES, by id) at its own time, as
// the page's value carries it ({title, icon, model, action}), over its
// recorded day, or with a gallery state's recorder answer in its place.
function powerChart(screen, id, {history, loading = false} = {}) {
  const fixture = ENERGY_FIXTURES.find(f => f.id === id), recorded = id === 'night' ? ENERGY_NIGHT_POWER_HISTORY : ENERGY_POWER_HISTORY;
  return screen(fixtureSnapshot({states: fixture.states, now: fixture.now, route: {page: 'energy', detail: null, dialog: null},
    loaded: {history: {energy: history ? {...recorded, data: history} : recorded}, historyLoading: new Set(loading ? ['energy'] : [])}})).page.dayChart;
}

// The page's chart widget: the chart under the widget's title, with Full
// history as its action, at the layout's plot height; in the grid it fills
// the widget's body, that height at least.
const PowerWidget = ({id, size, chart, height, fill = false, scrubAt}) => <Widget id={id} size={size} title={chart.title} icon={chart.icon} action={chart.action}>
  <DayChart model={chart.model} fill={fill} height={height} scrubAt={scrubAt}/>
</Widget>;

// Energy's chart, after Climate's charts.
function PowerCharts() {
  const screen = useScreen();
  const charts = useMemo(() => {
    const recorded = ENERGY_POWER_HISTORY.data;
    return {day: powerChart(screen, 'covered'), night: powerChart(screen, 'night'), partial: powerChart(screen, 'covered', {history: {...recorded, errors: REJECTED.history.errors}}),
      loading: powerChart(screen, 'covered', LOADING), error: powerChart(screen, 'covered', REJECTED), empty: powerChart(screen, 'covered', EMPTY)};
  }, [screen]);
  const STATES = [['Partly recorded', charts.partial], ['Loading', charts.loading], ['The recorder in error', charts.error], ['Nothing recorded', charts.empty]];
  // The chart in a phone's widget: the section title over its card.
  const phone = (caption, chart, scrubAt) => <Specimen key={caption} caption={caption}>
    <LayoutContext.Provider value="phone"><PowerWidget id="chart" chart={chart} height={DAY_PLOT.phone} scrubAt={scrubAt}/></LayoutContext.Provider>
  </Specimen>;
  // The chart filling the grid's xl widget, in `layout`'s grid.
  const grid = (layout, caption, chart) => <figure className={`m-gallery-power__grid m-gallery-power__grid--${layout}`}>
    <LayoutContext.Provider value={layout}><WidgetGrid><PowerWidget id="chart" size="xl" chart={chart} height={DAY_PLOT.grid} fill/></WidgetGrid></LayoutContext.Provider>
    <figcaption className="m-gallery__caption">{caption}</figcaption>
  </figure>;
  return <GalleryGroup title="Power through the day">
    <div className="m-gallery-power">
      <div className="m-gallery-charts">
        {phone('Noon: solar over the house, the rest of the forecast dotted', charts.day)}
        {phone('At night: importing now, solar asleep', charts.night)}
        {phone('Scrubbed at 11:30: the quarter hour’s means, its points ringed in the card’s fill', charts.day, EXPORTING)}
        {STATES.map(([caption, chart]) => phone(caption, chart))}
      </div>
      {grid('wide', 'Filling the xl widget from 700px, two columns at the narrowest wide page', charts.night)}
      {grid('desktop', 'Filling the xl widget from 1,100px, four columns at the desktop page’s width', charts.day)}
      {grid('wide', 'Nothing recorded, filling the xl widget: the day’s empty axes', charts.empty)}
    </div>
  </GalleryGroup>;
}

// The charts wrap, each in its sheet's box, never wider than the page: a
// specimen shrinks from 343px, and its stage is a block, not a flex row
// that would grow to the chart's width, as the detail specimens' are. A
// scrubbed point is ringed in the page's background, where they sit. The
// form sheet's chart shows only where its box fits.
export const chartSpecimensStyles = `
.m-gallery-charts{display:flex;flex-wrap:wrap;gap:var(--m-space-6) var(--m-space-5);align-items:flex-start;min-width:0}
.m-gallery-charts>.m-gallery__specimen{flex:0 1 343px;min-width:0;max-width:100%;justify-items:stretch}
.m-gallery-charts .m-gallery__stage,.m-gallery-charts__wide .m-gallery__stage{display:block;min-width:0}
.m-gallery-charts__box{--m-history-surface:var(--m-bg);width:343px;max-width:100%;min-width:0}
.m-gallery-charts__box--center{width:592px}
.m-gallery-charts__wide{display:none;min-width:0}
@media (min-width:700px){.m-gallery-charts__wide{display:block}}
.m-gallery-power{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-7);min-width:0}
.m-gallery-power__grid{margin:0;display:none;gap:var(--m-space-3);min-width:0}
.m-gallery-power__grid--wide{max-width:652px}
.m-gallery-power__grid--desktop{max-width:1088px}
@media (min-width:700px){.m-gallery-power__grid--wide{display:grid}}
@media (min-width:1100px){.m-gallery-power__grid--desktop{display:grid}}
`;
