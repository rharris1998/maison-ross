// The figure (#29 step 4), the concept's `.big` and `.mid`: the reading in
// the rounded face with tabular digits (the type style's shorthand resets
// them, so they are set again after it), the large one drawn a touch tight
// as SF's display sizes are; the unit 4px after it on its baseline and the
// label 2px above it or 8px before it, both secondary. A figure is never in
// a tone: its colour is the label's.
export const figureStyles = `
.m-figure{margin:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;color:var(--m-label)}
.m-figure--beside{flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:0 var(--m-space-2)}
.m-figure__label{min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-figure__reading{display:inline-flex;align-items:baseline;gap:var(--m-space-1);min-width:0}
.m-figure__value{font:var(--m-type-figure-large);font-variant-numeric:tabular-nums;letter-spacing:-.5px;color:var(--m-label);white-space:nowrap}
.m-figure--regular .m-figure__value{font:var(--m-type-figure);font-variant-numeric:tabular-nums;letter-spacing:normal}
.m-figure__unit{font:var(--m-type-subhead);color:var(--m-label-2);white-space:nowrap}
`;
