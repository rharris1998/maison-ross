// The grouped list (#29). An inset list is one card surface whose rows are
// padded 16px; a plain list has no surface and its rows sit flush with the
// text of the Card around it. The hairline between rows starts where the
// text does: 16 + 32 + 12 = 60px with a tile, 16px without (44 and 0 in a
// plain list), and the last row has none; each case outranks the one before
// by specificity, never by source order. A pressed row fills at once and
// clears over --m-dur-press; a pressed or focused one hides the hairlines
// above and below it, as iOS does; a disabled one turns tertiary. A row's
// first and last corners follow the list's, so the keyboard ring, drawn just
// inside the row, is never clipped. A value takes at most a third of the row
// and wraps beyond it, so the title keeps its line on a phone; the type
// style's shorthand resets the face, so the value sets .m-num's again.
//
// A tile is its tone at 20% behind a glyph in the tone's text colour: at
// least 3:1 against the tile in both schemes, on a card and in a sheet. Pink
// has no text colour, so its glyph is pink taken 20% towards --m-label
// (4.0:1 light, 3.9:1 dark in a sheet, where plain pink is 2.8:1 light).
// Without color-mix() (Safari before 16.2) the tile falls back to the gray
// fill and pink's glyph to plain pink.
//
// An unavailable row is drawn apart, never as a zero or an off, as the
// unavailable switch is: its tile takes no tone and no fill, only a dashed
// --m-label-3 outline round a --m-label-3 glyph. Its value ('—',
// 'Unavailable') stays secondary, a figure too, so it is still read (tertiary
// is under 3:1); the title keeps its colour. Both rules outrank the tone, the
// figure and the fallback rules by specificity.
//
// A tinted tile (v32, a zone's room colour) is the gray tile behind a glyph
// in the room's colour, as the concept draws a zone. In dark the colour
// stands as it is (3:1 and up on the tile, a sheet's card included); in
// light it is shaded, 55% of it and 45% --m-label, as a tone's text colour
// is darkened for white, so yellow still reads at 3.3:1 on the light tile
// (1.1:1 plain). Without light-dark() it stays plain in both schemes.
//
// A flag (a badge, v32) follows the title's words, as the concept's `.flag`
// does: a gray capsule of footnote-strong text in --m-label (9:1 and up; the
// secondary label falls to 4.1:1 on a sheet's card in dark), inline after
// the title, raised 1px so the line keeps its 22px, 6px on by the title's
// end margin. Nothing separates them but that margin, so the flag holds on
// to the title's last word: when they don't fit, the word comes down to the
// next line with it ("Bedroom / suite Humid"), never leaving the flag at the
// far end of the row; it never breaks inside, and the detail keeps its own
// line under them. From 700px, where a row's lines clamp to one each, the
// copy is a two-column grid instead: the title clamps in its own column and
// the flag sits right after it; the detail spans the line under them and
// adds nothing to either column's width (it is 0 wide until laid out, then
// its whole line). Without :has() the flag takes a line of its own. Rows
// without a badge are untouched.
export const listStyles = `
.m-list{box-sizing:border-box;min-width:0}
.m-list--inset{background:var(--m-card-fill);border:.5px solid var(--m-card-border);border-radius:var(--m-radius-card);overflow:hidden}
.m-row{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:var(--m-space-3);width:100%;min-height:var(--m-row-min);margin:0;padding:11px var(--m-space-4);border:0;border-radius:0;background:transparent;color:var(--m-label);font:var(--m-type-body);text-align:left;text-decoration:none;appearance:none;-webkit-appearance:none}
.m-row--pressable{cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;transition:background-color var(--m-dur-press) var(--m-ease)}
.m-row--pressable[data-pressed]{background:var(--m-fill-pressed);transition-duration:0ms}
.m-row--pressable[data-focus-visible]{outline-offset:-2px}
.m-row[data-disabled]{cursor:default}
.m-row[data-disabled] .m-row__title,.m-row[data-disabled] .m-row__detail,.m-row[data-disabled] .m-row__value,.m-row[data-disabled] .m-row__chevron{color:var(--m-label-3)}
.m-row[data-disabled] .m-row__tile{opacity:.4}
.m-list--inset>.m-list__item:first-child>.m-row{border-top-left-radius:calc(var(--m-radius-card) - .5px);border-top-right-radius:calc(var(--m-radius-card) - .5px)}
.m-list--inset>.m-list__item:last-child>.m-row{border-bottom-left-radius:calc(var(--m-radius-card) - .5px);border-bottom-right-radius:calc(var(--m-radius-card) - .5px)}
.m-list__item:not(:last-child)>.m-row::after{content:"";position:absolute;left:calc(var(--m-space-4) + var(--m-tile) + var(--m-space-3));right:0;bottom:0;border-bottom:.5px solid var(--m-separator);pointer-events:none;transition:opacity var(--m-dur-press) var(--m-ease)}
.m-list>.m-list__item:not(:last-child)>.m-row--bare::after{left:var(--m-space-4)}
.m-list.m-list--plain>.m-list__item:not(:last-child)>.m-row::after{left:calc(var(--m-tile) + var(--m-space-3))}
.m-list.m-list--plain>.m-list__item:not(:last-child)>.m-row.m-row--bare::after{left:0}
.m-list__item:not(:last-child)>.m-row:is([data-pressed],[data-focus-visible])::after,.m-list__item:has(+.m-list__item>.m-row:is([data-pressed],[data-focus-visible]))>.m-row::after{opacity:0}
.m-row__tile{flex:none;display:grid;place-items:center;width:var(--m-tile);height:var(--m-tile);border-radius:var(--m-radius-tile);background:color-mix(in srgb,var(--m-tone) 20%,transparent);color:var(--m-tone)}
.m-row__tile .m-glyph{width:18px;height:18px}
.m-row__tile.m-tone-yellow{--m-tone:var(--m-yellow);color:var(--m-yellow-text)}
.m-row__tile.m-tone-indigo{--m-tone:var(--m-indigo);color:var(--m-indigo-text)}
.m-row__tile.m-tone-pink{--m-tone:var(--m-pink);color:color-mix(in srgb,var(--m-pink) 80%,var(--m-label))}
.m-row__tile.m-tone-green{--m-tone:var(--m-green);color:var(--m-green-text)}
.m-row__tile.m-tone-orange{--m-tone:var(--m-orange);color:var(--m-orange-text)}
.m-row__tile.m-tone-gray{--m-tone:var(--m-gray);color:var(--m-label)}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-row__tile.m-row__tile{background:var(--m-fill-gray)}.m-row__tile.m-tone-pink.m-tone-pink{color:var(--m-pink)}}
.m-row.m-row--unavailable .m-row__tile{box-sizing:border-box;background:transparent;border:1.5px dashed var(--m-label-3);color:var(--m-label-3)}
.m-row__copy{flex:1 1 0;min-width:0;display:flex;flex-direction:column}
.m-row__copy:has(>.m-row__badge){display:block}
.m-row__copy:has(>.m-row__badge)>.m-row__detail{display:block}
.m-row__copy:has(>.m-row__badge)>.m-row__title{margin-inline-end:6px}
.m-row__badge{display:inline-block;box-sizing:border-box;width:max-content;max-width:100%;padding:1px 7px;border-radius:var(--m-radius-capsule);background:var(--m-fill-gray);color:var(--m-label);font:var(--m-type-footnote-strong);white-space:nowrap;vertical-align:1px}
.m-widget:not(.m-widget--phone) .m-row__copy:has(>.m-row__badge){display:grid;grid-template-columns:minmax(0,max-content) minmax(max-content,1fr);align-items:baseline;column-gap:6px}
.m-widget:not(.m-widget--phone) .m-row__copy:has(>.m-row__badge)>.m-row__title{min-width:0;margin-inline-end:0}
.m-widget:not(.m-widget--phone) .m-row__copy:has(>.m-row__badge)>.m-row__detail{grid-column:1/-1;width:0;min-width:100%}
.m-row__tile.m-row__tile--tint>.m-glyph{color:light-dark(color-mix(in srgb,currentColor 55%,var(--m-label)),currentColor)}
.m-row__title{font:var(--m-type-body);color:var(--m-label);overflow-wrap:anywhere}
.m-row__title.m-row__title--strong{font:var(--m-type-headline)}
.m-row__detail{font:var(--m-type-subhead);color:var(--m-label-2);overflow-wrap:anywhere}
.m-row__value{flex:0 1 auto;min-width:0;max-width:33%;font:var(--m-type-body);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums;color:var(--m-label-2);text-align:right;overflow-wrap:anywhere}
.m-row__value.m-row__value--figure{font:var(--m-type-figure);font-variant-numeric:tabular-nums;color:var(--m-label)}
.m-row.m-row--unavailable .m-row__value{color:var(--m-label-2)}
.m-row__trailing{flex:none;display:inline-flex;align-items:center;font:var(--m-type-body);color:var(--m-label-2)}
.m-row__accessory{flex:none;display:inline-flex;align-items:center}
.m-row__chevron{width:16px;height:16px;color:var(--m-label-3)}
.m-list--plain .m-row{min-height:var(--m-hit);padding:9px 0}
.m-list--plain .m-row--pressable{z-index:0}
.m-list--plain .m-row--pressable::before{content:"";position:absolute;inset:0 calc(-1 * var(--m-space-2));z-index:-1;border-radius:var(--m-radius-row);transition:background-color var(--m-dur-press) var(--m-ease)}
.m-list--plain .m-row--pressable[data-pressed]{background:transparent}
.m-list--plain .m-row--pressable[data-pressed]::before{background:var(--m-fill-pressed);transition-duration:0ms}
.m-list--plain .m-row--pressable[data-focus-visible]{outline:none}
.m-list--plain .m-row--pressable[data-focus-visible]::before{outline:2px solid var(--m-focus-ring)}
`;
