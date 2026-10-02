// The quiet line (#29 step 4), the concept's `.quiet`: a 17px glyph and a
// line of subhead in --m-label-2, inset 4px as the section titles are, so
// its glyph lines up with them. It is a wrapping flex line with a hanging
// indent: the line is padded by the glyph and its gap, and the glyph pulled
// back into that padding, so the text starts at the padding and anything
// that wraps (the buttons on a phone) starts under the text, not under the
// glyph. The text grows, so on a wide line the buttons sit at its end.
export const quietStyles = `
.m-quiet{box-sizing:border-box;margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-2);min-width:0;padding:0 var(--m-space-1) 0 calc(var(--m-space-1) + 17px + var(--m-space-2));font:var(--m-type-subhead);color:var(--m-label-2)}
.m-quiet__glyph{width:17px;height:17px;margin-inline-start:calc(-17px - var(--m-space-2))}
.m-quiet__text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.m-quiet__actions{flex:0 1 auto;display:inline-flex;flex-wrap:wrap;gap:var(--m-space-2);min-width:0}
`;
