// Energy's header chart (#29 step 3): the flows between four nodes, and the
// price on desktop, on the sky, so in the hero's dark tokens. A link or node
// takes its tone (--m-flows-tone) from its source: solar yellow, grid import
// indigo, export green, the house white. An active link is its tone's dashes
// on a neutral track (a translucent tone would turn muddy on a blue sky),
// moving with the flow; an idle one is faint dots. An unavailable node's ring
// is dashed; solar asleep at night has its ring (solid) and icon dimmed,
// never its words, which keep their contrast on the sky. The chart is
// centred, at the column's end on desktop, and never wider than its box (the
// component caps it), so its text keeps its size: values in subhead-strong,
// rounded with tabular digits, over footnote names. Nothing moves under
// reduced motion.
export const flowsChartStyles = `
.m-flows{display:block;width:100%;height:auto;margin-inline:auto;overflow:visible}
.m-flows--end{margin-inline:auto 0}
.m-flows__link--solar,.m-flows__node--solar{--m-flows-tone:var(--m-yellow)}
.m-flows__link--grid,.m-flows__node--grid{--m-flows-tone:var(--m-indigo-text)}
.m-flows__link--export,.m-flows__node--export{--m-flows-tone:var(--m-green)}
.m-flows__node--house{--m-flows-tone:var(--m-label)}
.m-flows__link{fill:none;stroke:var(--m-flows-tone);stroke-width:4;stroke-linecap:round}
.m-flows__link--idle{stroke:var(--m-link-idle);stroke-width:2;stroke-dasharray:0 5}
.m-flows__under{stroke:var(--m-capsule-track)}
.m-flows__dash{stroke-dasharray:3 7;animation:m-flows-dash 1.1s linear infinite}
@keyframes m-flows-dash{to{stroke-dashoffset:-10}}
.m-flows__ring{fill:var(--m-node-fill-idle);stroke:var(--m-node-ring-idle);stroke-width:1.5}
.m-flows__node--active .m-flows__ring{fill:var(--m-node-fill);stroke:var(--m-flows-tone)}
.m-flows__node--unavailable .m-flows__ring{stroke-dasharray:3 4}
.m-flows__icon{color:var(--m-label-2)}
.m-flows__node--active .m-flows__icon{color:var(--m-flows-tone)}
.m-flows__node--unavailable .m-flows__icon,.m-flows__node--asleep .m-flows__icon{color:var(--m-label-3)}
.m-flows__node--asleep :is(.m-flows__ring,.m-flows__icon){opacity:.6}
.m-flows__value{font:var(--m-type-subhead-strong);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;fill:var(--m-label)}
.m-flows__name{font:var(--m-type-footnote);fill:var(--m-label-2)}
.m-flows-reading{display:grid;gap:var(--m-space-1);padding:0 var(--m-space-1)}
.m-flows-reading p{margin:0}
.m-flows-reading__figure{font:var(--m-type-figure-large);font-variant-numeric:tabular-nums;color:var(--m-label)}
.m-flows-reading__unit{font:var(--m-type-subhead);color:var(--m-label-2)}
.m-flows-reading__line{font:var(--m-type-footnote);color:var(--m-label-2)}
@media (prefers-reduced-motion:reduce){.m-flows__dash{animation:none}}
`;
