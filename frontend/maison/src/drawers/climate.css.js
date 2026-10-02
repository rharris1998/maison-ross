// Climate's sheets (#29 step 4, v32), as iOS grouped
// sections: each a headline heading over its inset list or card, with a
// footnote caption under it, 24px apart, one column in a bottom sheet and
// in a form sheet alike. A section's buttons stack across a bottom sheet
// and sit side by side at their own width in a form sheet, wrapping when
// they don't fit. Headings, captions, the summary and the charts sit
// 4px in from the cards' edge, as a page's section titles do, so their
// words line up with the cards' curve; a disclosure (Away, Why) is a
// heading like the others, its 44px trigger reaching into the gap around it
// rather than pushing its title down. A heading given focus when the
// control that had it left (a Cancel) shows the ring only for a keyboard.
// The summary is bare on the sheet: the reading large (its dash secondary
// while there is none, as on the page), its bar the section's width, the
// line, then the facts in a caption. Prose sits on a card in subhead; a
// needs-you line is the secondary label after the warning glyph in
// --m-orange-text (3:1 and more on the sheet in light, where plain orange
// is under 2.5:1), hung so its words wrap under themselves, as the quiet
// line does. A warning shares a card with the buttons it is about (Radiator
// heat, a heating-off Hold, Away), flush with the card's padding, so a
// tinted button sits on the card, where it reads 4.6:1 in light (4.1:1 on
// the bare sheet). A stacked row (the override's ends, a zone's day) puts
// its part under its words across the row, in the list's own padding and
// hairlines; the ends reach 8px into that padding, so each of three
// segments holds "Until 22:00" in a 327px sheet. A row with a stepper wraps
// the stepper under its words, at the row's end, when the title's longest
// word and the stepper don't fit side by side (a 327px sheet), so no title
// breaks mid-word; side by side holds whenever they fit (359px and up).
// Without :has() such a row keeps its one line. The parts bring their own
// surfaces, type and tones; the cards and lists set the target bar's ring,
// the sheet its ground (target-bar.css.js). Nothing here moves, so reduced
// motion leaves it as it is.
export const climateDrawerStyles = `
.m-climate-sheet{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-6);min-width:0}
.m-climate-sheet__section{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-climate-sheet__heading{margin:0;padding-inline:var(--m-space-1);min-width:0;border-radius:var(--m-radius-tile);font:var(--m-type-headline);color:var(--m-label);overflow-wrap:anywhere}
.m-climate-sheet__heading:focus{outline:none}
.m-climate-sheet__heading:focus-visible{outline:2px solid var(--m-focus-ring);outline-offset:2px}
.m-climate-sheet__figure{min-width:0}
.m-climate-sheet__figure--empty .m-figure__value{color:var(--m-label-2)}
.m-climate-sheet__footer{margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-climate-sheet__summary{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0;padding-inline:var(--m-space-1)}
.m-climate-sheet__line{margin:0;min-width:0;font:var(--m-type-body);color:var(--m-label);overflow-wrap:anywhere}
.m-climate-sheet__facts{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-1) var(--m-space-4);margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-climate-sheet__fact{display:inline-flex;align-items:center;gap:var(--m-space-1);min-width:0;overflow-wrap:anywhere}
.m-climate-sheet__fact-text{display:inline-flex;align-items:center;gap:var(--m-space-1);min-width:0}
.m-climate-sheet__fact-text>.m-glyph{flex:none;width:15px;height:15px}
.m-climate-sheet__flag{box-sizing:border-box;margin-inline-start:2px;padding:1px 7px;border-radius:var(--m-radius-capsule);background:var(--m-fill-gray);color:var(--m-label);font:var(--m-type-footnote-strong)}
.m-climate-sheet__card{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-3)}
.m-climate-sheet__text{margin:0;min-width:0;font:var(--m-type-subhead);color:var(--m-label);overflow-wrap:anywhere}
.m-climate-sheet__days{display:grid;grid-template-columns:minmax(0,1fr);min-width:0}
.m-climate-sheet__warning{box-sizing:border-box;display:flex;align-items:flex-start;gap:var(--m-space-2);margin:0;min-width:0;padding-inline:var(--m-space-1);font:var(--m-type-subhead);color:var(--m-label-2);overflow-wrap:anywhere}
.m-climate-sheet__warning-text{flex:1 1 0;min-width:0}
.m-climate-sheet__warning-glyph{flex:none;width:17px;height:17px;margin-top:1.5px;color:var(--m-orange-text)}
.m-climate-sheet__actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-3);margin-top:var(--m-space-2);min-width:0}
.m-climate-sheet__actions>.m-button{max-width:100%}
.m-climate-sheet__card>.m-climate-sheet__actions{margin-top:0}
.m-climate-sheet__card>.m-climate-sheet__warning{padding-inline:0}
.m-climate-sheet__section>.m-feedback{padding-inline:var(--m-space-1)}
.m-row.m-climate-sheet__stacked{flex-direction:column;align-items:stretch;gap:var(--m-space-2)}
.m-segmented.m-climate-sheet__ends{margin-inline:calc(-1 * var(--m-space-2))}
.m-climate-sheet .m-row:has(>.m-row__accessory>.m-stepper){flex-wrap:wrap;row-gap:var(--m-space-2)}
.m-climate-sheet .m-row:has(>.m-row__accessory>.m-stepper)>.m-row__copy{min-width:min-content}
.m-climate-sheet .m-row:has(>.m-row__accessory>.m-stepper) :is(.m-row__title,.m-row__detail){overflow-wrap:break-word}
.m-climate-sheet .m-row:has(>.m-row__accessory>.m-stepper)>.m-row__accessory{margin-inline-start:auto}
.m-climate-sheet__strong{font:var(--m-type-headline)}
.m-climate-sheet__probe{display:grid;justify-items:end;text-align:right}
.m-climate-sheet__probe-value{font:var(--m-type-figure);font-variant-numeric:tabular-nums;color:var(--m-label);white-space:nowrap}
.m-climate-sheet__probe-caption{font:var(--m-type-footnote);color:var(--m-label-2);white-space:nowrap}
.m-button.m-climate-sheet__link{justify-self:start;max-width:calc(100% + var(--m-space-3));margin-inline-start:calc(var(--m-space-1) - var(--m-space-4))}
.m-climate-sheet__chart{padding-inline:var(--m-space-1)}
.m-climate-sheet>.m-disclosure{margin-block:calc((22px - var(--m-hit)) / 2)}
.m-climate-sheet .m-disclosure__trigger{padding-inline:var(--m-space-1)}
.m-climate-sheet__panel{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-3);min-width:0;padding-block:var(--m-space-1) calc((var(--m-hit) - 22px) / 2)}
`;
