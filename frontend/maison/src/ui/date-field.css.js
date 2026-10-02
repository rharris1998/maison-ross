// The date and time field (#29 step 4): the label in subhead-strong over
// the native input, then the hint in footnote, both labels in --m-label-2.
// The input is a 44px well on the gray fill with a row's radius, its value
// a 22px body line (17px, so iOS doesn't zoom in on focus) padded 11px
// above and below, so it sits centred in every engine, in --m-label,
// left-aligned as a form's text is (iOS centres a date's by default), the
// scheme's own picker icon at its end. It fills the field's width and never
// widens it, so a sheet at 343px holds it. Keyboard focus draws the shared
// ring 2px out; disabled, its text turns tertiary on the same fill. Nothing
// moves.
export const dateFieldStyles = `
.m-date-field{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;min-width:0}
.m-date-field__label{font:var(--m-type-subhead-strong);color:var(--m-label-2)}
.m-date-field__input{display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:var(--m-hit);margin:0;padding:11px var(--m-space-3);border:0;border-radius:var(--m-radius-row);background:var(--m-fill-gray);color:var(--m-label);font:var(--m-type-body);font-variant-numeric:tabular-nums;text-align:left;appearance:none;-webkit-appearance:none;outline:none}
.m-date-field__input:focus-visible{outline:2px solid var(--m-focus-ring);outline-offset:2px}
.m-date-field__input::-webkit-date-and-time-value{text-align:left}
.m-date-field__input::-webkit-calendar-picker-indicator{cursor:pointer}
.m-date-field__input:disabled{color:var(--m-label-3);cursor:default;opacity:1;-webkit-text-fill-color:var(--m-label-3)}
.m-date-field__input:disabled::-webkit-calendar-picker-indicator{opacity:.4;cursor:default}
.m-date-field__hint{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
`;
