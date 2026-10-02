// Maison's day bar (#29 step 4): one day of a heating plan, its name, its
// plan in words and a bar of its periods, the warm ones marked, such as the
// thermostat's week in the House sheet or a zone's today. The bar only
// repeats the plan's words, so it is hidden from assistive technology.
// Comfort is --m-label-2 and setback the gray fill: a plan is neutral, never
// a semantic hue.

/**
 * A day of a heating plan.
 *
 * DOM: `div.m-day[role=listitem]` (`aria-current="date"` when `day.today`
 * is set), so VoiceOver steps through a week day by day: the caller wraps
 * the days in a `role="list"`. It holds
 * `span.m-day__name`, then `span.m-day__today` holding `day.today` when it
 * is set, then `span.m-day__plan`, then `span.m-day__bar[aria-hidden=true]`
 * holding one `i.m-day__part` per period (`.m-day__part--warm` for a warm
 * one), each with an inline `width` of `${part.width}%`.
 *
 * @param {object} props
 * @param {{name: string, today: string|null, plan: string, bar: {width: number, warm: boolean}[]}} props.day climate.js's Day.
 */
export function DayBar({day: {name, today, plan, bar}}) {
  return <div className="m-day" role="listitem" aria-current={today ? 'date' : undefined}>
    <span className="m-day__name">{name}</span>{today && <span className="m-day__today">{today}</span>}
    <span className="m-day__plan">{plan}</span>
    <span className="m-day__bar" aria-hidden="true">
      {bar.map((part, i) => <i key={i} className={part.warm ? 'm-day__part m-day__part--warm' : 'm-day__part'} style={{width: `${part.width}%`}}/>)}
    </span>
  </div>;
}
