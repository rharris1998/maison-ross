// The hero at the top of every page (#29 step 3): the
// living sky, the header on it (the date, the large title, the line under it
// and the two glass tools), then the page's reading and header chart. Home
// status has the sky and the header only. Everything in it draws
// on the dark tokens (tokens.js's .m-hero block), since it sits on the sky.
// Every word and accessible name comes from the chrome value.
import {IntentButton} from './ui/button.jsx';
import {skyPaint} from './sky-model.js';
import {Sky} from './sky.jsx';
import {WeatherChart, WeatherReading} from './charts/weather.jsx';
import {ZonesChart} from './charts/zones.jsx';
import {FlowsChart, FlowsReading} from './charts/flows.jsx';
import {CarChart} from './charts/car.jsx';

/**
 * Each hero kind's parts: its Reading (or null) and Chart, and when the
 * reading shows, 'always' or on 'desktop' only.
 */
export const HERO_PARTS = {
  weather: {Reading: WeatherReading, Chart: WeatherChart, readingOn: 'always'},
  zones: {Reading: null, Chart: ZonesChart, readingOn: 'always'},
  flows: {Reading: FlowsReading, Chart: FlowsChart, readingOn: 'desktop'},
  car: {Reading: null, Chart: CarChart, readingOn: 'always'},
};

// The sky while the chrome has none: nothing known.
const UNKNOWN_SKY = {kind: 'unknown', plot: {elevation: null, azimuth: null, rising: null, coverage: null, fall: null, storm: false, wind: false}};

/**
 * The hero: the sky, the header and the page's header chart.
 *
 * DOM: `div.m-hero[data-sky=<paint.phase>]`, in the frame's flow right after
 * the tab bar (a sibling of it, never its ancestor). Inside, in this order:
 * - `Sky` (sky.jsx), filling the hero;
 * - `div.m-hero__inner`, holding:
 *   - `div.m-header` (a div: a header element would be a banner landmark):
 *     `div.m-header__text` (`p.m-header__date`, `h1.m-header__title`, and
 *     `p.m-header__line` only while `chrome.line` is a non-empty string) and
 *     `div.m-header__tools` (44px glass icon-only IntentButtons for
 *     `chrome.alerts` and `chrome.status`, named by their ariaLabel);
 *   - `div.m-hero__reading` with HERO_PARTS[hero.kind].Reading, when it has
 *     one and its readingOn is 'always' or the layout is desktop;
 *   - `div.m-hero__chart` with HERO_PARTS[hero.kind].Chart.
 *   Neither slot is drawn while `chrome.hero` is null (Home status, or a page
 *   whose header has nothing to show).
 * Reading and Chart receive `{value: chrome.hero, phase, layout}`.
 *
 * hero.css.js lays it out: stacked on phone and wide (the chart centred,
 * capped at 470px), two columns from 1,100px (the header's text and the
 * reading on the left, the tools and the chart on the right). From 700px it
 * reaches up behind the pill, which paints above it. It bleeds to Maison's
 * edges, clips its own sky and keeps its bottom var(--m-sky-fade) empty for
 * the sky's fade; nothing in it may make an ancestor of the tab bar a
 * containing block.
 *
 * @param {object} props
 * @param {object} props.chrome screen.js's Chrome value.
 * @param {'phone'|'wide'|'desktop'} props.layout The frame's layout.
 */
export function Hero({chrome: {date, title, line, alerts, status, sky, hero}, layout}) {
  const paint = skyPaint(sky ?? UNKNOWN_SKY), parts = hero ? HERO_PARTS[hero.kind] : null;
  const {Reading = null, Chart = null} = parts ?? {};
  const reading = Reading && (parts.readingOn === 'always' || layout === 'desktop');
  return <div className="m-hero" data-sky={paint.phase}>
    <Sky paint={paint}/>
    <div className="m-hero__inner">
      <div className="m-header">
        <div className="m-header__text"><p className="m-header__date">{date}</p><h1 className="m-header__title">{title}</h1>
          {typeof line === 'string' && line && <p className="m-header__line">{line}</p>}</div>
        <div className="m-header__tools"><IntentButton action={alerts} variant="glass" size="large"/><IntentButton action={status} variant="glass" size="large"/></div>
      </div>
      {reading && <div className="m-hero__reading"><Reading value={hero} phase={paint.phase} layout={layout}/></div>}
      {Chart && <div className="m-hero__chart"><Chart value={hero} phase={paint.phase} layout={layout}/></div>}
    </div>
  </div>;
}
