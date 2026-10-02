// Climate (#29 step 4, v32): only what is Climate's own,
// the page's rhythm under the hero, the scale's legend and the widget
// bodies' inner layout. The widgets and the parts bring their own surfaces,
// type and tones.
//
// Rhythm: the page's blocks stand 24px apart, as the phone's sections do,
// the legend first, right under the hero whose capsules it explains.
//
// The legend: the scale's ends in footnote over the rounded figures, the
// strip between them, then the target's tick (the bars' own, 2 × 12px in
// --m-label) and its word. The strip is the room scale over 14–26°
// (climate.js's scale.plot, as the capsules and the bars): each of
// TEMP_SCALE's stops at its place, 16° at 16.667% and so on to 25° at
// 91.667%, so it is the colour tempColour() gives at every point. Below 16°
// the coldest stop holds; the hottest, 26.5°, sits past the end, at
// 104.167%, so the strip ends on 26°'s colour. On a phone the strip takes
// the room the words leave, and the legend is inset 4px as the section
// titles are, so it starts where they do and ends where their Details does;
// from 700px the strip stops at 240px.
//
// Phone. The House card stacks the reading (its flag beside it), the bar
// 8px under it, the line in body 12px under that, the caption in footnote,
// the one action 16px under the caption at its natural width, and the
// feedback. While the heating is quiet (off, Away, unknown, not set up) the
// card is compact, as the concept's heating-off card: the line in body with
// the reading at its end in the row figure (a zone row's), on one
// baseline, then the caption 4px under it; no bar, since nothing runs or no
// target shows; with no reading, the line alone. A zone row's reading is a figure over its 78px bar, 2px apart,
// right-aligned; with no reading its '—' is secondary, as an unavailable
// row's value is. A row's line, the House's line and the captions wrap
// without leaving a word alone on their last line (where text-wrap: pretty
// is supported); a row's only on a phone, since from 700px a row's lines
// never wrap. The rails' note is the list's footer, 8px under it and inset
// 16px as the rows' content is.
//
// From 700px every body is one anatomy, so the bars and the lines line up
// across a row of widgets: the reading's 48px row, the bar 4px under it and
// the line 4px under that, in footnote, at most two lines (48 + 4 + 12 + 4
// + 36 = 104px of the body's 107). It is a grid of named areas, so the
// House's action, last in the DOM (read after the reading, the bar and the
// line it acts on), ends the reading's row, 12px from it, centred on it and
// 2px lower, so its 44px hit area begins 12px under the title, exactly
// where the title's Details ends. A zone has no action, so its reading takes
// the row. The House's feedback takes the line's place, two lines at most;
// with no reading, its line takes the reading's 48px row instead, in body,
// centred in it, so its bar still lines up with the zones'.
//
// The flag is the row badge's capsule: gray fill, footnote-strong in
// --m-label, beside the reading and centred on it, never on its own line.
// Without a reading the figure's '—' is secondary, as a row's is.
export const climatePageStyles = `
.m-climate{display:flex;flex-direction:column;gap:var(--m-space-6);min-width:0}
.m-climate__scale{display:flex;align-items:center;gap:var(--m-space-2);min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-climate__scale-end{flex:none}
.m-climate__scale-strip{flex:1 1 0;min-width:0;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--m-temp-1) 16.667%,var(--m-temp-2) 41.667%,var(--m-temp-3) 58.333%,var(--m-temp-4) 75%,var(--m-temp-5) 91.667%,var(--m-temp-6) 104.167%)}
.m-app:not([data-layout=phone]) .m-climate__scale-strip{max-width:240px}
.m-app[data-layout=phone] .m-climate__scale{padding-inline:var(--m-space-1)}
.m-climate__scale-key{flex:none;display:inline-flex;align-items:center;gap:6px;margin-inline-start:var(--m-space-2)}
.m-climate__scale-tick{flex:none;width:2px;height:12px;border-radius:1px;background:var(--m-label)}
.m-climate__figure{display:flex;align-items:center;gap:var(--m-space-2);min-width:0}
.m-climate__figure-value{min-width:0}
.m-climate__figure--empty .m-figure__value{color:var(--m-label-2)}
.m-climate__flag{flex:none;padding:1px 7px;border-radius:var(--m-radius-capsule);background:var(--m-fill-gray);color:var(--m-label);font:var(--m-type-footnote-strong);white-space:nowrap}
.m-climate__line{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere;text-wrap:pretty}
.m-climate__caption{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere;text-wrap:pretty}
.m-climate__house{display:flex;flex-direction:column;min-width:0}
.m-climate__house>.m-target-bar{margin-top:var(--m-space-2)}
.m-climate__house>.m-climate__line{margin-top:var(--m-space-3);font:var(--m-type-body);color:var(--m-label)}
.m-climate__quiet{display:flex;align-items:baseline;gap:var(--m-space-3);min-width:0}
.m-climate__quiet>.m-climate__line{flex:1 1 0;font:var(--m-type-body);color:var(--m-label)}
.m-climate__quiet-reading{flex:none;display:inline-flex;align-items:baseline;gap:var(--m-space-2)}
.m-climate__house>.m-climate__caption{margin-top:var(--m-space-1)}
.m-climate__house>.m-button{align-self:flex-start;margin-top:var(--m-space-4)}
.m-climate__house>.m-feedback{margin-top:var(--m-space-2)}
.m-climate__trailing{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.m-climate__value{font:var(--m-type-figure);font-variant-numeric:tabular-nums;color:var(--m-label);white-space:nowrap}
.m-row.m-row--unavailable .m-climate__value{color:var(--m-label-2)}
.m-climate .m-widget--phone .m-row__detail{text-wrap:pretty}
.m-climate__footer{margin:var(--m-space-2) var(--m-space-4) 0}
.m-climate__reading-block{flex:1;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:minmax(48px,auto) auto auto;grid-template-areas:"figure action" "bar bar" "line line";align-content:start;row-gap:var(--m-space-1);min-width:0;min-height:0}
.m-climate__reading-block>.m-climate__figure{grid-area:figure}
.m-climate__reading-block>.m-target-bar{grid-area:bar}
.m-climate__reading-block>:is(.m-climate__line,.m-feedback){grid-area:line;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.m-climate__reading-block>.m-climate__lead{grid-area:figure;align-self:center;font:var(--m-type-body);color:var(--m-label)}
.m-climate__reading-block>.m-button{grid-area:action;align-self:center;margin:var(--m-space-1) 0 0 var(--m-space-3)}
`;
