// The 24-hour chart in a sheet (#29 step 4, v32): the title in headline
// over its subtitle, then the legend, each series' name in footnote over its
// value, a rounded figure in headline, as Apple Health heads a chart. The
// plot follows, scaled to its box and never wider, its hairlines faint and
// its axis text a caption; a vertical swipe on it is left to the sheet, and
// a long press selects nothing. Full history sits under it, its text on
// the chart's edge as a plain button's in an iOS list.
//
// A series takes its colour by what it measures: a room reading the room
// scale, a target and a probe --m-label, humidity --m-label-2, and a series
// with no role the labels by its colour index. Never a new hue and never
// blue. A room colour (the gradient's stops, a dot, a scrubbed point, the
// swatch) comes as the element's --m-history-room. Dark draws it as it is
// (4.9:1 and up on the sheet); in light it is shaded as a tinted row tile's
// glyph is (list.css.js), 55% of it and 45% --m-label, so the reading line
// reads at 4:1 and up on the light sheet, where yellow alone is 1.3:1.
// Without light-dark() or color-mix() (Safari before 17.5) the colours stay
// plain and the line takes a 1px halo of --m-label at 40% instead. A
// scrubbed point is ringed in --m-history-surface, the sheet's fill unless
// the chart's container says otherwise. The loading placeholder is still.
//
// Energy's power chart drew with these rules from v33 to v36; from v37 it
// has its own (day.css.js).
export const historyChartStyles = `
.m-history{--m-history-surface:var(--m-sheet-fill);display:grid;gap:var(--m-space-3);min-width:0;max-width:100%}
.m-history__header{display:grid;gap:2px;min-width:0}
.m-history__title{margin:0;font:var(--m-type-headline);color:var(--m-label)}
.m-history__subtitle{margin:0;font:var(--m-type-footnote);font-variant-numeric:tabular-nums;color:var(--m-label-2)}
.m-history__legend{display:flex;flex-wrap:wrap;gap:var(--m-space-2) var(--m-space-5);margin:0;min-width:0}
.m-history__entry{display:grid;gap:2px;min-width:0}
.m-history__entry dt{display:flex;align-items:center;gap:6px;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-history__entry dd{margin:0;font:var(--m-type-headline);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;color:var(--m-label)}
.m-history__swatch{flex:none;width:12px;height:3px;border-radius:2px;background:currentColor}
.m-history__swatch--dashed{height:0;border-top:3px dotted currentColor;border-radius:0;background:none}
.m-history__swatch--room{background:var(--m-history-room,var(--m-label-3))}
.m-history__swatch--target,.m-history__swatch--probe,.m-history__swatch--neutral-0{color:var(--m-label)}
.m-history__swatch--humidity,.m-history__swatch--neutral-1{color:var(--m-label-2)}
.m-history__swatch--neutral-2{color:var(--m-label-3)}
.m-history__plot{position:relative;min-width:0;max-width:100%;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.m-history__svg{display:block;width:100%;height:auto;max-width:100%}
.m-history__grid{stroke:var(--m-separator);stroke-width:.5}
.m-history__hour{stroke:var(--m-separator);stroke-width:.5;stroke-dasharray:2 3}
.m-history__now{stroke:var(--m-label-3);stroke-width:1;stroke-dasharray:2 3}
.m-history__axis{font:var(--m-type-caption);font-variant-numeric:tabular-nums;fill:var(--m-label-2)}
.m-history__series--target,.m-history__series--probe,.m-history__series--neutral-0{color:var(--m-label)}
.m-history__series--humidity,.m-history__series--neutral-1{color:var(--m-label-2)}
.m-history__series--neutral-2{color:var(--m-label-3)}
.m-history__line{fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.m-history__series--room .m-history__line{stroke-width:2.5}
.m-history__series--target .m-history__line{stroke-width:1.5}
.m-history__line--dashed{stroke-dasharray:1 4}
.m-history__stop{stop-color:var(--m-history-room)}
.m-history__halo{display:none}
.m-history__dot{fill:currentColor}
.m-history__series--room .m-history__dot,.m-history__series--room .m-history__point{fill:var(--m-history-room)}
.m-history__point{fill:currentColor;stroke:var(--m-history-surface);stroke-width:2}
.m-history__rule{stroke:var(--m-label-2);stroke-width:1}
.m-history__placeholder{width:100%;border-radius:var(--m-radius-row);background:var(--m-fill-gray)}
.m-history__state{margin:0;display:grid;place-items:center;padding-inline:var(--m-space-4);box-sizing:border-box;width:100%;text-align:center;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-history__note{margin:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-button.m-history__full{justify-self:start;margin-inline-start:calc(-1 * var(--m-space-4))}
@supports (color:light-dark(transparent,transparent)) and (color:color-mix(in srgb,currentColor 40%,transparent)){.m-history__stop{stop-color:light-dark(color-mix(in srgb,var(--m-history-room) 55%,var(--m-label)),var(--m-history-room))}.m-history__series--room .m-history__dot,.m-history__series--room .m-history__point{fill:light-dark(color-mix(in srgb,var(--m-history-room) 55%,var(--m-label)),var(--m-history-room))}.m-history__swatch--room{background:light-dark(color-mix(in srgb,var(--m-history-room,var(--m-label-3)) 55%,var(--m-label)),var(--m-history-room,var(--m-label-3)))}}
@supports not ((color:light-dark(transparent,transparent)) and (color:color-mix(in srgb,currentColor 40%,transparent))){.m-history__halo{display:inline;fill:none;stroke:var(--m-label);stroke-opacity:.4;stroke-width:4.5;stroke-linejoin:round;stroke-linecap:round}}
`;
