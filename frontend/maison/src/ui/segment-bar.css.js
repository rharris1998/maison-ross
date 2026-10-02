// The segmented bar and its legend (#29 step 4), as the approved concept
// draws them: a 10px capsule whose segments meet with 2px gaps and are
// square where they meet, the bar's own radius rounding its two ends, as
// iOS's storage bar does; no track shows through the gaps, only the surface.
// A missing reading is a dashed outline of the same capsule in --m-label-3;
// a real zero is the capsule solid in --m-fill-pressed, the track a
// progress bar shows before it starts, which reads on a white card too.
// The legend's dots are the segments' tones at 8px, and its lines wrap
// 14px apart. Fills take the plain tone in both schemes; the text is
// secondary, never in a tone.
export const segmentBarStyles = `
.m-segment-bar{box-sizing:border-box;display:flex;gap:2px;width:100%;min-width:0;height:10px;border-radius:5px;overflow:hidden}
.m-segment-bar--empty{border:1px dashed var(--m-label-3)}
.m-segment-bar--zero{background:var(--m-fill-pressed)}
.m-segment-bar__segment{flex:0 1 0;min-width:2px;background:var(--m-tone)}
.m-legend{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 14px;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-legend__item{display:inline-flex;align-items:center;gap:6px;min-width:0}
.m-legend__dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--m-tone)}
.m-segment-bar__segment.m-tone-yellow,.m-legend__dot.m-tone-yellow{--m-tone:var(--m-yellow)}
.m-segment-bar__segment.m-tone-indigo,.m-legend__dot.m-tone-indigo{--m-tone:var(--m-indigo)}
.m-segment-bar__segment.m-tone-pink,.m-legend__dot.m-tone-pink{--m-tone:var(--m-pink)}
.m-segment-bar__segment.m-tone-green,.m-legend__dot.m-tone-green{--m-tone:var(--m-green)}
.m-segment-bar__segment.m-tone-orange,.m-legend__dot.m-tone-orange{--m-tone:var(--m-orange)}
.m-segment-bar__segment.m-tone-gray,.m-legend__dot.m-tone-gray{--m-tone:var(--m-gray)}
`;
