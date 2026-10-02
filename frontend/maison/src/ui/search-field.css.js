// The search field (#29 step 4, v35), as iOS's search bar: a 44px well on
// the gray fill with a row's radius, the magnifier (17px, secondary) 12px in,
// then the query in the body type (17px, so iOS doesn't zoom in on focus) in
// --m-label over a secondary placeholder, then the clear button, a 44px
// square at the end holding iOS's filled circle: a tertiary disc behind the
// cross in the page's own background colour, deepening to secondary under a
// finger. While the query is empty the button keeps its place, hidden, so
// the text never shifts as it appears. WebKit's own search decorations and
// cancel button are dropped: the field draws its own. Disabled, the query,
// the placeholder and the magnifier turn tertiary. The field fills its line
// and never widens it. Nothing moves.
export const searchFieldStyles = `
.m-search-field{box-sizing:border-box;display:flex;align-items:center;width:100%;min-width:0;height:var(--m-hit);margin:0;border-radius:var(--m-radius-row);background:var(--m-fill-gray);color:var(--m-label-2)}
.m-search-field__glyph{width:17px;height:17px;margin-inline-start:var(--m-space-3)}
.m-search-field__input{flex:1 1 0;box-sizing:border-box;min-width:0;height:100%;margin:0;padding:0 var(--m-space-2);border:0;border-radius:0;background:transparent;color:var(--m-label);font:var(--m-type-body);outline:none;appearance:none;-webkit-appearance:none}
.m-search-field__input::placeholder{color:var(--m-label-2);opacity:1}
.m-search-field__input::-webkit-search-decoration,.m-search-field__input::-webkit-search-cancel-button,.m-search-field__input::-webkit-search-results-button{display:none;-webkit-appearance:none}
.m-search-field__clear{flex:none;box-sizing:border-box;display:grid;place-items:center;width:var(--m-hit);height:var(--m-hit);margin:0;padding:0;border:0;background:transparent;cursor:pointer;appearance:none;-webkit-appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.m-search-field__clear>.m-glyph{box-sizing:border-box;width:18px;height:18px;padding:4px;border-radius:50%;background:var(--m-label-3);color:var(--m-bg);transition:background-color var(--m-dur-press) var(--m-ease)}
.m-search-field__clear[data-pressed]>.m-glyph{background:var(--m-label-2);transition-duration:0ms}
.m-search-field[data-empty] .m-search-field__clear{visibility:hidden}
.m-search-field[data-disabled]{color:var(--m-label-3)}
.m-search-field[data-disabled] .m-search-field__input{color:var(--m-label-3);-webkit-text-fill-color:var(--m-label-3);opacity:1}
.m-search-field[data-disabled] .m-search-field__input::placeholder{color:var(--m-label-3)}
`;
