// Today's header chart (#29 step 3): the weather's reading and days. Only
// this file sets --m-type-display, the weather's temperature. Everything sits
// on the sky in the hero's dark tokens, so text is --m-label or --m-label-2
// and keeps the hero's text shadow.
//
// The reading is centred and stacked on phone and wide, its degree hanging
// past the digits so the figure centres on them; on desktop the temperature
// sits beside the condition and the line, its degree back in line, and its
// first digit's side bearing pulled back to the title's edge. A reading
// without a figure ('—') is dim, so it never passes for one. The days are
// one row of equal columns on the scrim, with no blur behind them; the sun is
// drawn in its own yellow, as Apple Weather's is. The reading's sentence and
// each day's are visually hidden text, read in place of the hidden parts.
export const weatherChartStyles = `
.m-weather{position:relative;display:grid;justify-items:center;text-align:center}
.m-weather__label,.m-weather-days__label{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.m-weather__temp{position:relative;margin:0;font:var(--m-type-display);font-variant-numeric:tabular-nums;letter-spacing:-.025em;color:var(--m-label)}
.m-weather__degree{position:absolute;left:100%;top:0;letter-spacing:0}
.m-weather__text{display:grid;justify-items:center;gap:2px}
.m-weather__condition{display:inline-flex;align-items:center;gap:6px;margin:0;font:var(--m-type-headline);color:var(--m-label)}
.m-weather__icon{width:20px;height:20px}
.m-weather__icon--wx-sun,.m-weather-days__icon--wx-sun{color:var(--m-yellow)}
.m-weather__line{margin:0;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-weather--missing .m-weather__temp,.m-weather--missing .m-weather__condition{color:var(--m-label-2)}
.m-weather[data-layout=desktop]{grid-template-columns:auto minmax(0,1fr);align-items:center;justify-items:start;column-gap:var(--m-space-4);text-align:start}
.m-weather[data-layout=desktop] .m-weather__temp{margin-inline-start:-.04em}
.m-weather[data-layout=desktop] .m-weather__degree{position:static}
.m-weather[data-layout=desktop] .m-weather__text{justify-items:start}
.m-weather-days{box-sizing:border-box;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:var(--m-space-1);width:100%;margin:0;padding:var(--m-space-3) var(--m-space-2);list-style:none;border-radius:22px;background:var(--m-sky-scrim)}
.m-weather-days__day{position:relative;display:grid;justify-items:center;gap:6px;min-width:0}
.m-weather-days__name{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-weather-days__icon{width:24px;height:24px}
.m-weather-days__value{position:relative;font:var(--m-type-headline);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;color:var(--m-label)}
.m-weather-days__value--missing{color:var(--m-label-2)}
`;
