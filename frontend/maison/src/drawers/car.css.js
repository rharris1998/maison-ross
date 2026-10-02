// The Car's sheets (#29 step 4, v34), as iOS grouped
// sections, as Energy's are: each a headline heading over its inset list or
// card, with a footnote caption under it, 24px apart, one column in a
// bottom sheet and in a form sheet alike. Headings, captions, the logs and
// the summary sit 4px in from the cards' edge, as a page's section titles
// do; Why is a heading like the others, its 44px trigger reaching into the
// gap around it rather than pushing its title down.
//
// The summary is bare on the sheet. The Battery's ring (136px) sits beside
// the headline (in headline), the detail (subhead, secondary) and the
// reconnecting hint (a caption), centred on them, as the page's Battery
// card draws it; in a sheet too narrow for both (a 320px phone's), the
// words go under the ring, which is then centred on its line rather than
// leaving half the sheet empty beside it (beside the ring, the words grow
// to fill the line, so centring moves nothing there). A headline that
// wraps is balanced across its lines, never leaving 'verified' alone under
// 'Plugged in · not yet'. Charging energy's figure is large (44pt), as
// every sheet leads, over its bar the section's width, with no legend: the
// rows under it give each source's figure.
//
// In a row, neither the title nor the value breaks inside a word: the title
// never narrows past its longest word, and the value takes the rest,
// keeping one line while it fits and otherwise wrapping only between its
// words. So in a 320px phone's sheet "Tesla's estimate" keeps its words
// beside "80% at / 14:40", where a value held to one line would squeeze the
// title to a few letters a line, and a figure ('167 kWh', '3.80 kW') keeps
// its unit, since every title leaves it room. A title or detail that wraps
// leaves no word alone on its last line (text-wrap: pretty), as Energy's
// lists do.
//
// The plan's line is on a card in subhead, its note a caption under it.
// Why is one card: its paragraphs in subhead, then each log, a label line
// in a caption over its text, 12px apart, as the paragraphs are. The parts
// bring their own surfaces, type and tones (the ring's arc, the tiles, the
// bar). Nothing here moves, so reduced motion leaves it as it is.
export const carDrawerStyles = `
.m-car-sheet{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-6);min-width:0}
.m-car-sheet__section{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-car-sheet__heading{margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-headline);color:var(--m-label);overflow-wrap:anywhere}
.m-car-sheet__footer{margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-car-sheet__summary{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--m-space-4);min-width:0;padding-inline:var(--m-space-1)}
.m-car-sheet__summary>.m-ring{flex:none;max-width:100%;height:auto}
.m-car-sheet__summary--energy{display:grid;grid-template-columns:minmax(0,1fr);justify-items:start;gap:var(--m-space-2)}
.m-car-sheet__summary--energy>.m-segment-bar{justify-self:stretch;margin-block:var(--m-space-1)}
.m-car-sheet__status{flex:1 1 140px;display:flex;flex-direction:column;gap:var(--m-space-1);min-width:0}
.m-car-sheet__headline{margin:0;min-width:0;font:var(--m-type-headline);color:var(--m-label);overflow-wrap:anywhere;text-wrap:balance}
.m-car-sheet__detail{margin:0;min-width:0;font:var(--m-type-subhead);color:var(--m-label-2);overflow-wrap:anywhere}
.m-car-sheet__hint{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-car-sheet .m-row__copy{min-width:min-content}
.m-car-sheet :is(.m-row__title,.m-row__detail){overflow-wrap:break-word;text-wrap:pretty}
.m-car-sheet .m-row__value{flex:0 1 auto;min-width:min-content;max-width:none;overflow-wrap:normal}
.m-car-sheet__card{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-3)}
.m-car-sheet__text{margin:0;min-width:0;font:var(--m-type-subhead);color:var(--m-label);overflow-wrap:anywhere}
.m-car-sheet>.m-disclosure{margin-block:calc((22px - var(--m-hit)) / 2)}
.m-car-sheet .m-disclosure__trigger{padding-inline:var(--m-space-1)}
.m-car-sheet__panel{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-3);min-width:0;padding-block:var(--m-space-1) calc((var(--m-hit) - 22px) / 2)}
.m-car-sheet__log{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;min-width:0}
.m-car-sheet__log-label{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
`;
