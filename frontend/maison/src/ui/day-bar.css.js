// The day bar (#29 step 4): a day of a heating plan as a two-line row, the
// thermostat's week one under another as iOS Weather lists its days. The
// name (subhead-strong) sits in a 44px column with "Today" under it
// (footnote); the plan (footnote) sits beside the name on its baseline, the
// bar under the plan, centred on the second line, which is a footnote line
// high on every day so the week keeps one rhythm whether or not a day is
// today. The bar is 6px: the day's periods on the gray fill, the warm ones
// (comfort) in --m-label-2 as capsules on it, the rest (setback) the fill
// itself; a plan is neutral, never a semantic hue. Today sits on the gray
// fill, a row's radius, reaching 8px past the text either side as a pressed
// plain row's fill does, so its text stays in line with the days around
// it. On that fill "Today" and the plan take --m-label: the secondary label
// falls to 4.1:1 on it on a dark sheet's card, and the fill already marks
// the row. Nothing moves.
export const dayBarStyles = `
.m-day{position:relative;isolation:isolate;box-sizing:border-box;display:grid;grid-template-columns:44px minmax(0,1fr);grid-template-rows:auto 18px;grid-template-areas:"name plan" "today bar";column-gap:var(--m-space-3);row-gap:2px;min-width:0;padding-block:6px}
.m-day[aria-current=date]::before{content:"";position:absolute;inset:0 calc(-1 * var(--m-space-2));z-index:-1;border-radius:var(--m-radius-row);background:var(--m-fill-gray)}
.m-day__name{grid-area:name;align-self:baseline;min-width:0;font:var(--m-type-subhead-strong);color:var(--m-label)}
.m-day__today{grid-area:today;align-self:center;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-day__plan{grid-area:plan;align-self:baseline;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-day[aria-current=date]>:is(.m-day__today,.m-day__plan){color:var(--m-label)}
.m-day__bar{grid-area:bar;align-self:center;display:flex;height:6px;min-width:0;border-radius:3px;overflow:hidden;background:var(--m-fill-gray)}
.m-day__part{display:block;flex:none;height:100%}
.m-day__part--warm{border-radius:3px;background:var(--m-label-2)}
`;
