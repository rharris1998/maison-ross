// Climate's header chart (#29 step 3): the zone capsules, on the sky, so in
// the hero's dark tokens. The track is a faint capsule; an unavailable zone
// has no track but a dashed outline, which no reading, however cold, can be
// mistaken for. The target's tick is white and rounded. Readings are figures
// in subhead-strong, rounded with tabular digits, over footnote names in the
// secondary label. The chart is centred and never wider than its box (the
// component caps it), so its text keeps its size. The fill's colours are
// computed (scale.js) and set on its gradient's stops.
//
// In a widget (#29 step 4) the chart sits on the card, whose own track and
// tick colours ui/widget.css.js sets; there the unavailable outline, the
// sky's faint white elsewhere, is the tertiary label, so it reads on a light
// card as a missing reading does everywhere else in Maison.
export const zonesChartStyles = `
.m-zones{display:block;width:100%;height:auto;margin-inline:auto;overflow:visible}
.m-zones__track{fill:var(--m-capsule-track)}
.m-zones__capsule--unavailable .m-zones__track{fill:none;stroke:var(--m-node-ring-idle);stroke-width:1.5;stroke-dasharray:4 4}
.m-zones__tick{fill:none;stroke:var(--m-target-tick);stroke-width:2.5;stroke-linecap:round}
.m-zones__reading{font:var(--m-type-subhead-strong);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;fill:var(--m-label)}
.m-zones__name{font:var(--m-type-footnote);fill:var(--m-label-2)}
.m-zones--widget .m-zones__capsule--unavailable .m-zones__track{stroke:var(--m-label-3)}
`;
