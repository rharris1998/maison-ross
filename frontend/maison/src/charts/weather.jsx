// Today's header chart (#29 step 3): the weather. The reading is outside
// now, large, with its condition and tomorrow; the chart is the next days in
// a row on a scrim. Every word and accessible name comes from the value
// (today.js's WeatherHero); both sit on the sky, in the hero's dark tokens.
// The weather is real text, never an image of it.
import {Glyph} from '../ui/glyph.jsx';

// A temperature split into its figure and a trailing degree sign, so the
// degree can hang past the digits and the figure centres on them, as Apple
// Weather's does. Anything else ('—') is all figure.
const figure = text => text.endsWith('°') ? [text.slice(0, -1), '°'] : [text, null];
// A reading has a digit in it; '—' is none.
const measured = text => /\d/.test(text);

// A temperature as a figure hidden from a screen reader (its sentence is
// read instead): `span.<className>` with the degree in a hanging
// `span.m-weather__degree`, and `<className>--missing` when it is no reading.
const Figure = ({text, className}) => {
  const [digits, degree] = figure(text);
  return <span className={measured(text) ? className : `${className} ${className}--missing`} aria-hidden="true">{digits}{degree && <span className="m-weather__degree">{degree}</span>}</span>;
};

/**
 * The weather's reading, drawn in every layout.
 *
 * DOM: `div.m-weather[data-layout]`, holding `value.ariaLabel` for a screen
 * reader (visually hidden), then, hidden from it, `span.m-weather__temp` (the
 * temperature in --m-type-display, its degree hanging) and
 * `div.m-weather__text` (`p.m-weather__condition`, with `value.icon`'s
 * glyph when set, and `p.m-weather__line` while `value.line` is set).
 * Centred and stacked on phone and wide; on desktop the temperature sits
 * beside the condition and line. Without a reading ('—') it is
 * `m-weather--missing`, drawn dim so it never reads as one.
 *
 * @param {object} props
 * @param {object} props.value chrome.hero, today.js's WeatherHero.
 * @param {'night'|'twilight'|'day'|'unknown'} props.phase The sky's phase.
 * @param {'phone'|'wide'|'desktop'} props.layout
 */
export function WeatherReading({value: {temperature, condition, line, icon, ariaLabel}, layout}) {
  return <div className={measured(temperature) ? 'm-weather' : 'm-weather m-weather--missing'} data-layout={layout}>
    <span className="m-weather__label">{ariaLabel}</span>
    <Figure text={temperature} className="m-weather__temp"/>
    <div className="m-weather__text" aria-hidden="true">
      <p className="m-weather__condition">{icon && <Glyph name={icon} className={`m-weather__icon m-weather__icon--${icon}`}/>}{condition}</p>
      {line && <p className="m-weather__line">{line}</p>}
    </div>
  </div>;
}

/**
 * The next days, up to four.
 *
 * DOM: `ul.m-weather-days[role=list]` (Safari drops a styled list's role
 * otherwise) on --m-sky-scrim, radius 22 and no backdrop blur, with one
 * `li.m-weather-days__day` per day, holding its ariaLabel for a screen reader
 * (visually hidden text, which every reader reads, where an aria-label over
 * hidden children may be read as empty), then its parts, hidden from one:
 * the name (footnote), the icon (a 24px Glyph, or an empty box for a
 * condition without one) and the value (headline, rounded, tabular, its
 * degree hanging so the digits centre under the icon; dim when it is '—').
 * Nothing at all while `days` is empty.
 *
 * @param {object} props
 * @param {object} props.value chrome.hero, today.js's WeatherHero.
 * @param {'night'|'twilight'|'day'|'unknown'} props.phase The sky's phase.
 * @param {'phone'|'wide'|'desktop'} props.layout
 */
export function WeatherChart({value: {days}}) {
  if (!days?.length) return null;
  return <ul className="m-weather-days" role="list">
    {days.slice(0, 4).map(day => <li key={day.name} className="m-weather-days__day">
      <span className="m-weather-days__label">{day.ariaLabel}</span>
      <span className="m-weather-days__name" aria-hidden="true">{day.name}</span>
      {day.icon ? <Glyph name={day.icon} className={`m-weather-days__icon m-weather-days__icon--${day.icon}`}/> : <span className="m-weather-days__icon" aria-hidden="true"/>}
      <Figure text={day.value} className="m-weather-days__value"/>
    </li>)}
  </ul>;
}
