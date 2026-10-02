// Energy's chart (v37), as Health heads a chart and Stocks draws a day.
//
// The header: the day's line in footnote, then the three figures in equal
// columns, each its name in footnote-strong over its value in the rounded
// figure (22px) with its unit in subhead-strong, secondary. A name is in its
// series' colour, the value in the label colour: Solar in yellow's text
// colour, Grid in indigo's, Consumed in the label colour, as its curve is.
// Each figure keeps to one line. On a phone's card the three share its
// width; filling a grid widget, each is as wide as it is, 32px apart, so
// they read together at the left rather than spread across the widget.
//
// The plot: hairline value lines, zero a whole pixel; the hours dashed, the
// axis text a caption at the right and under the plot. Solar's curve is 2px
// of yellow over its fade, 50% at the plot's top to 6% at zero; the grid's
// fade is indigo, 50% to 28%, so it still reads at the foot through the
// night. The house's curve is 2px of the label colour, over everything
// but the dot and a scrub. The forecast is solar's curve dotted (round caps
// on zero-length dashes). The dot at now and a scrubbed point are ringed in
// the card's fill, or in dark, where the card is translucent, in the page's
// background. The loading placeholder is still.
//
// Filling (the grid's xl widget), the chart is a flex column that grows
// into its container: the header and the note keep their height, and the
// plot (or what stands in for it) takes the rest, at least its inline
// min-height. With nothing to draw it says so in one footnote line;
// filling, it draws the day's empty axes and centres the sentence over
// their upper half.
export const dayChartStyles = `
.m-power{--m-power-surface:var(--m-card-fill);display:grid;gap:var(--m-space-3);min-width:0;max-width:100%}
:host([dark]) .m-power{--m-power-surface:var(--m-bg)}
.m-power__header{display:grid;gap:2px;min-width:0}
.m-power__when{margin:0;font:var(--m-type-footnote);font-variant-numeric:tabular-nums;color:var(--m-label-2)}
.m-power__figures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--m-space-2);margin:0;min-width:0}
.m-power__figure{display:grid;min-width:0}
.m-power__figure dt{min-width:0;font:var(--m-type-footnote-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-power__figure--solar dt{color:var(--m-yellow-text)}
.m-power__figure--grid dt{color:var(--m-indigo-text)}
.m-power__figure--house dt{color:var(--m-label)}
.m-power__figure dd{margin:0;min-width:0;font:var(--m-type-figure);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;color:var(--m-label);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-power__unit{font:var(--m-type-subhead-strong);color:var(--m-label-2)}
.m-power__plot{position:relative;min-width:0;max-width:100%;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.m-power__svg{display:block;width:100%;height:auto;max-width:100%}
.m-power__value{stroke:var(--m-separator);stroke-width:.5}
.m-power__value--zero{stroke-width:1}
.m-power__hour{stroke:var(--m-separator);stroke-width:1;stroke-dasharray:2 3}
.m-power__axis{font:var(--m-type-caption);font-variant-numeric:tabular-nums;fill:var(--m-label-2)}
.m-power__stop--solar{stop-color:var(--m-yellow);stop-opacity:.5}
.m-power__stop--solar-foot{stop-color:var(--m-yellow);stop-opacity:.06}
.m-power__stop--grid{stop-color:var(--m-indigo);stop-opacity:.5}
.m-power__stop--grid-foot{stop-color:var(--m-indigo);stop-opacity:.28}
.m-power__fill{stroke:none}
.m-power__line{fill:none;stroke-linecap:round;stroke-linejoin:round}
.m-power__line--solar{stroke:var(--m-yellow);stroke-width:2}
.m-power__line--forecast{stroke:var(--m-yellow);stroke-width:2;stroke-dasharray:0 5}
.m-power__line--house{stroke:var(--m-label);stroke-width:2}
.m-power__now,.m-power__point{stroke:var(--m-power-surface);stroke-width:3}
.m-power__now,.m-power__point--house{fill:var(--m-label)}
.m-power__point--solar{fill:var(--m-yellow)}
.m-power__rule{stroke:var(--m-label-3);stroke-width:1.5}
.m-power__placeholder{width:100%;border-radius:var(--m-radius-row);background:var(--m-fill-gray)}
.m-power__state{margin:0;display:grid;place-items:center;padding-inline:var(--m-space-4);box-sizing:border-box;width:100%;text-align:center;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-power__state--line{display:block;padding-inline:0;text-align:start;font:var(--m-type-footnote)}
.m-power__note{margin:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-power--fill{display:flex;flex-direction:column;flex:1;min-height:0}
.m-power--fill .m-power__figures{grid-template-columns:repeat(3,minmax(0,max-content));column-gap:var(--m-space-7)}
.m-power--fill>*{flex:none}
.m-power--fill>:is(.m-power__plot,.m-power__placeholder,.m-power__blank){flex:1 1 0}
.m-power__blank{position:relative;min-width:0;max-width:100%}
.m-power__blank>.m-power__state{position:absolute;inset:0 0 50%}
`;
