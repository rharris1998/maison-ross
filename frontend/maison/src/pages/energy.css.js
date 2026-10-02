// Energy (#29 step 4, v33): only what is Energy's own,
// the page's rhythm under the hero and the widget bodies' inner layout. The
// widgets and the parts bring their own surfaces, type and tones.
//
// Rhythm: the page's blocks stand 24px apart, as Climate's do.
//
// Phone. The price card sets the figure (44) with its unit and the
// register's chip beside it, wrapping under it where the card is narrow,
// then the line in subhead 4px under them. The billing year's card sets
// the medium rings (96px) 16px from the two register lines; a register's
// line sits on its figure's baseline where it fits whole, and otherwise
// drops under the figure whole rather than wrap beside it word by word
// (a flex row that wraps, the line never narrower than itself unless it
// is wider than the card). The money list is the part's own inset list;
// the chart sits on its card. Lines wrap without
// leaving a word alone on their last line (where text-wrap: pretty is
// supported); from 700px each is one line. A row's value never splits
// ('10234.56 €' keeps its '€'): it takes its own width, past the list's
// third of the row, and the row's copy wraps instead, as prettily as the
// lines. A widget's title and its action ('Through the day', 'Details')
// share a line where they fit; at 320px the action takes the
// next line, rather than the title breaking inside.
//
// From 700px every body fits its rows with nothing clipped: 107px in a
// small or medium widget, 291px in the xl one.
// - Price (medium, wide only): the figure row centred in the room the line
//   leaves (48px), the line one line at the foot (18px).
// - Billing year (medium): the rings (96px) beside the lines, centred in
//   the body. A register is its name (footnote-strong, 18px) over the
//   figure (22px rounded, 28px) with its line in footnote on the figure's
//   baseline, one line: 2 × 46 + 8 = 100px.
// - Bill and cap (medium since v37, 477px wide at 1,100px): the figure
//   centred in the room the one-line caption leaves; '1234.56 €' at 44px
//   fits with room to spare.
// - The chart (xl): filling the body (the chart's own flex column): the
//   day's line and figures take 66px and the plot the rest, 213px, or 183px
//   while the partial note takes its 30px; DAY_PLOT.grid (180) at least.
//   With nothing recorded, the day's empty axes take the plot's place.
// - Rates (medium): two 36px rows (the widget is the press, so its rows
//   needn't be 52px), each a dot in its register's tone (8px, as a
//   legend's), its name and, on the live one, 'Now' as a chip in that tone,
//   8px apart and centred, then the rate as a figure (28px line, 4px above
//   and below); then the line at the foot, which says the rates are
//   supplier energy in €/kWh: 72 + 18 = 90px.
//
// A register's name is in its tone: pink tinted toward --m-label, as a list
// tile's glyph is (there is no pink text token), indigo its text colour;
// without color-mix() pink falls back to itself.
export const energyPageStyles = `
.m-energy{display:flex;flex-direction:column;gap:var(--m-space-6);min-width:0}
.m-energy__line{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere;text-wrap:pretty}
.m-widget--phone .m-energy__price+.m-energy__line{margin-top:var(--m-space-1);font:var(--m-type-subhead)}
.m-widget:not(.m-widget--phone) .m-energy__line{flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-energy__price{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-2) var(--m-space-3);min-width:0}
.m-widget:not(.m-widget--phone) .m-energy__price{flex:1;align-content:center;min-height:0}
.m-energy__year{flex:1;display:flex;align-items:center;gap:var(--m-space-4);min-width:0;min-height:0}
.m-energy__registers{flex:1 1 0;display:flex;flex-direction:column;gap:var(--m-space-2);min-width:0}
.m-energy__register{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:baseline;column-gap:var(--m-space-2);min-width:0}
.m-energy__register-name{grid-column:1/-1;min-width:0;font:var(--m-type-footnote-strong);color:var(--m-label-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-energy__register.m-tone-pink .m-energy__register-name{color:color-mix(in srgb,var(--m-pink) 80%,var(--m-label))}
.m-energy__register.m-tone-indigo .m-energy__register-name{color:var(--m-indigo-text)}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-energy__register.m-tone-pink .m-energy__register-name{color:var(--m-pink)}}
.m-energy__register-figure{font:var(--m-type-figure);font-variant-numeric:tabular-nums;color:var(--m-label);white-space:nowrap}
.m-energy__register-line{min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere;text-wrap:pretty}
.m-widget:not(.m-widget--phone) .m-energy__register-line{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-widget--phone .m-energy__register{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:var(--m-space-2)}
.m-widget--phone .m-energy__register-name{flex-basis:100%}
.m-widget--phone .m-energy__register-line{flex:1 0 auto;max-width:100%}
.m-energy__money{flex:1;display:flex;align-items:center;min-width:0;min-height:0}
.m-energy .m-row__value{flex:none;max-width:none;white-space:nowrap}
.m-energy .m-list--inset :is(.m-row__title,.m-row__detail){text-wrap:pretty}
.m-energy .m-widget--phone>.m-widget__head{flex-wrap:wrap}
.m-energy__rates{flex:1;min-height:0}
.m-widget:not(.m-widget--phone) .m-energy__rates .m-row{min-height:36px;padding-block:var(--m-space-1)}
.m-energy__rate{display:inline-flex;align-items:center;gap:var(--m-space-2);max-width:100%;vertical-align:top}
.m-energy__dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--m-tone)}
.m-energy__dot.m-tone-pink{--m-tone:var(--m-pink)}
.m-energy__dot.m-tone-indigo{--m-tone:var(--m-indigo)}
`;
