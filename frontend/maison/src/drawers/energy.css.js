// Energy's sheets (#29 step 4, v33), as iOS grouped
// sections, as Climate's are: each a headline heading over its inset list
// or card, with a footnote caption under it, 24px apart, one column in a
// bottom sheet and in a form sheet alike. Headings, captions and the
// summary sit 4px in from the cards' edge, as a page's section titles do; a
// state chip sits at its heading's far end, and goes under it where the two
// don't fit; Why is a heading like the others, its 44px trigger reaching
// into the gap around it rather than pushing its title down.
//
// The summary is bare on the sheet: the price, the bill and today's solar
// large (44pt), as every sheet leads, the price's register chip beside it,
// then the line in body and the detail in a caption. Energy today's bar has
// no legend: the rows under it give each part's figure. The billing year's
// rings (136px) sit beside the register lines, the name in its tone (pink
// tinted toward --m-label, as a list tile's glyph is), the figure 22pt
// rounded and the line a caption; in a sheet too narrow for both, the lines
// go under the rings. A register's dot, before its name in a heading or a
// rate row, is its tone at 8px, as a legend's dot is; the live rate's 'Now'
// is a chip in its tone after the name, on the name's baseline. A register's
// card holds its ledger (a row per bar: the label, an 8px capsule filled to
// its width in its tone, indigo imported and green exported, over a gray
// track, then the value in tabular numerals) and its note in subhead; the
// cap's note is a caption under its list, its strong parts in the label
// colour. A row's value keeps one line, so '1234.56 €' never leaves its '€'
// on a second line in a 320px phone's sheet: the title beside it wraps
// instead. The row export covers is titled in the green text tone. The
// Bill's and Energy today's links are plain buttons whose glyphs line up
// with the headings, side by side where they fit. The parts bring their own surfaces, type and
// tones. Nothing here moves, so reduced motion leaves it as it is.
export const energyDrawerStyles = `
.m-energy-sheet{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-6);min-width:0}
.m-energy-sheet__section{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-energy-sheet__head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--m-space-1) var(--m-space-3);min-width:0;padding-inline:var(--m-space-1)}
.m-energy-sheet__heading{margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-headline);color:var(--m-label);overflow-wrap:anywhere}
.m-energy-sheet__head>.m-energy-sheet__heading{flex:1 1 auto;padding-inline:0}
.m-energy-sheet__dot{display:inline-block;width:8px;height:8px;margin-inline-end:var(--m-space-2);border-radius:50%;background:var(--m-gray);vertical-align:middle}
.m-energy-sheet__dot.m-tone-pink{background:var(--m-pink)}
.m-energy-sheet__dot.m-tone-indigo{background:var(--m-indigo)}
.m-energy-sheet .m-row__title>.m-chip{margin-inline-start:var(--m-space-2)}
.m-energy-sheet .m-row__value{flex-shrink:0;max-width:none;white-space:nowrap}
.m-energy-sheet__footer{margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-energy-sheet__summary{display:grid;grid-template-columns:minmax(0,1fr);justify-items:start;gap:var(--m-space-2);min-width:0;padding-inline:var(--m-space-1)}
.m-energy-sheet__summary>.m-segment-bar{justify-self:stretch;margin-block:var(--m-space-1)}
.m-energy-sheet__price{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-2) var(--m-space-3);min-width:0}
.m-energy-sheet__line{margin:0;min-width:0;font:var(--m-type-body);color:var(--m-label);overflow-wrap:anywhere}
.m-energy-sheet__detail{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-energy-sheet__rings{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-4)}
.m-energy-sheet__registers{flex:1 1 140px;display:flex;flex-direction:column;gap:var(--m-space-2);min-width:0}
.m-energy-sheet__register{display:flex;flex-direction:column;margin:0;min-width:0}
.m-energy-sheet__register-name{font:var(--m-type-footnote-strong);color:var(--m-label-2);overflow-wrap:anywhere}
.m-energy-sheet__register.m-tone-pink .m-energy-sheet__register-name{color:color-mix(in srgb,var(--m-pink) 80%,var(--m-label))}
.m-energy-sheet__register.m-tone-indigo .m-energy-sheet__register-name{color:var(--m-indigo-text)}
.m-energy-sheet__register-figure{font:var(--m-type-figure);font-variant-numeric:tabular-nums;color:var(--m-label)}
.m-energy-sheet__register-line{font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-energy-sheet__register.m-tone-pink .m-energy-sheet__register-name{color:var(--m-pink)}}
.m-energy-sheet__card{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-3)}
.m-energy-sheet__note{margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-energy-sheet__note strong{font:var(--m-type-footnote-strong);color:var(--m-label)}
.m-energy-sheet__card>.m-energy-sheet__note{padding-inline:0;font:var(--m-type-subhead);color:var(--m-label)}
.m-energy-sheet__card>.m-energy-sheet__note strong{font:var(--m-type-subhead-strong)}
.m-energy-ledger{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--m-space-2) var(--m-space-3);min-width:0}
.m-energy-ledger__row{display:contents}
.m-energy-ledger__label{font:var(--m-type-subhead);color:var(--m-label)}
.m-energy-ledger__bar{display:block;height:8px;min-width:0;border-radius:var(--m-radius-capsule);background:var(--m-fill-gray);overflow:hidden}
.m-energy-ledger__fill{display:block;height:100%;border-radius:inherit;background:var(--m-gray)}
.m-energy-ledger__fill.m-tone-indigo{background:var(--m-indigo)}
.m-energy-ledger__fill.m-tone-green{background:var(--m-green)}
.m-energy-ledger__value{font:var(--m-type-subhead);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;color:var(--m-label-2);text-align:right;white-space:nowrap}
.m-energy-sheet__covered{color:var(--m-green-text)}
.m-energy-sheet__text{margin:0;min-width:0;font:var(--m-type-subhead);color:var(--m-label);overflow-wrap:anywhere}
.m-energy-sheet__links{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-2);min-width:0;margin-inline-start:calc(var(--m-space-1) - var(--m-space-4))}
.m-energy-sheet__links>.m-button{max-width:100%}
.m-energy-sheet>.m-disclosure{margin-block:calc((22px - var(--m-hit)) / 2)}
.m-energy-sheet .m-disclosure__trigger{padding-inline:var(--m-space-1)}
.m-energy-sheet__panel{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-3);min-width:0;padding-block:var(--m-space-1) calc((var(--m-hit) - 22px) / 2)}
`;
