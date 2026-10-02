// The chip (#29 step 4, v33), as the approved concept's `.pillchip`: a
// capsule 24px high, the tone at 16% behind footnote-strong words in the
// tone's text colour, its glyph 14px and 4px before them, 10px in from each
// end (8px before a glyph, which is optically lighter than a letter). Pink
// words are tinted toward --m-label, as a list tile's glyph is, since there
// is no pink text token; gray's are the secondary label, a state that says
// nothing is due. It never wraps; a label too long for its row is cut short.
// It sits on a card, a widget or the bare sheet. Without color-mix()
// (Safari before 16.2) the fill falls back to the gray fill and pink to
// itself.
export const chipStyles = `
.m-chip{display:inline-flex;align-items:center;gap:4px;box-sizing:border-box;flex:none;max-width:100%;height:24px;padding:0 10px;border-radius:var(--m-radius-capsule);background:color-mix(in srgb,var(--m-tone) 16%,transparent);color:var(--m-tone);font:var(--m-type-footnote-strong);white-space:nowrap}
.m-chip:has(>.m-chip__glyph){padding-inline-start:8px}
.m-chip.m-tone-yellow{--m-tone:var(--m-yellow);color:var(--m-yellow-text)}
.m-chip.m-tone-indigo{--m-tone:var(--m-indigo);color:var(--m-indigo-text)}
.m-chip.m-tone-pink{--m-tone:var(--m-pink);color:color-mix(in srgb,var(--m-pink) 80%,var(--m-label))}
.m-chip.m-tone-green{--m-tone:var(--m-green);color:var(--m-green-text)}
.m-chip.m-tone-orange{--m-tone:var(--m-orange);color:var(--m-orange-text)}
.m-chip.m-tone-gray{--m-tone:var(--m-gray);color:var(--m-label-2)}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-chip.m-chip{background:var(--m-fill-gray)}.m-chip.m-tone-pink.m-tone-pink{color:var(--m-pink)}}
.m-chip__glyph{flex:none;width:14px;height:14px}
.m-chip__label{min-width:0;overflow:hidden;text-overflow:ellipsis}
`;
