// Maison's dialog bodies (#29 step 4, v35), in Maison's Sheet: the
// alerts, an event and a Home Assistant card, one column 20px apart in a
// bottom sheet and a form sheet alike. Lines on the sheet (the event's date
// and location, a footnote) sit 4px in from the cards' edge, as the sheets'
// headings do, and a footnote sits 8px under its card, as every footnote
// does. With no alert, the sheet says so as Home status does: one
// gray-check row on a card, its second line the footnote. The alert rows
// and the onward button bring their own surfaces, type and tones. An event
// leads with when (body), then where (subhead, secondary); its description
// is on a card in body, its line breaks kept, and a long one makes the
// sheet's body scroll rather than the card; its calendar is the card's
// footnote.
//
// A Home Assistant card (.m-native) sits on a card surface of Maison's, and
// Home Assistant's own variables are mapped onto Maison's tokens, so it
// takes the sheet's type and colours in both themes: its card draws no
// surface, border or shadow of its own (the frame is the card), its text is
// Maison's labels, its separators Maison's, and its pressables blue, white
// on blue fills. What it draws on (a tooltip, a sticky header, a menu) must
// be opaque, so it is the card's own white in light and, as the card is
// translucent in dark, the sheet's fill there. These are styles.js's
// `.native` rule and the host's card variables, which point at HeroUI's
// palette, ported (contract §1.4: Home Assistant's variables, set to
// tokens, never literals). When the card can't load, the element puts a
// note in the slot (p.note), drawn as a footnote on the card, as the
// gallery's placeholder is.
export const dialogStyles = `
.m-dialog{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-5);min-width:0}
.m-dialog__empty{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-dialog__footnote{margin:0;min-width:0;padding-inline:var(--m-space-1);font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere;text-wrap:pretty}
.m-dialog__facts{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-1);min-width:0;padding-inline:var(--m-space-1)}
.m-dialog__date{margin:0;min-width:0;font:var(--m-type-body);color:var(--m-label);overflow-wrap:anywhere}
.m-dialog__location{margin:0;min-width:0;font:var(--m-type-subhead);color:var(--m-label-2);overflow-wrap:anywhere}
.m-dialog__details{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-dialog__description{margin:0;min-width:0;font:var(--m-type-body);color:var(--m-label);white-space:pre-wrap;overflow-wrap:anywhere}
.m-dialog__calendar{margin:0;min-width:0;padding-inline:var(--m-space-1);font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-native{box-sizing:border-box;min-width:0;background:var(--m-card-fill);border:.5px solid var(--m-card-border);border-radius:var(--m-radius-card);color:var(--m-label)}
.m-native>.native{min-width:0;--ha-card-background:transparent;--ha-card-border-width:0;--ha-card-box-shadow:none;--ha-card-border-radius:var(--m-radius-card);--card-background-color:var(--m-card-fill);--primary-background-color:var(--m-sheet-fill);--secondary-background-color:var(--m-fill-gray);--primary-text-color:var(--m-label);--secondary-text-color:var(--m-label-2);--primary-color:var(--m-blue);--text-primary-color:var(--m-on-color);--divider-color:var(--m-separator);--state-icon-color:var(--m-label-2);--paper-item-icon-color:var(--m-label-2);--mdc-theme-primary:var(--m-blue);--mdc-theme-on-primary:var(--m-on-color);--md-sys-color-primary:var(--m-blue);--md-sys-color-on-primary:var(--m-on-color);--md-sys-color-surface:var(--m-card-fill);--md-sys-color-on-surface:var(--m-label);--md-sys-color-on-surface-variant:var(--m-label-2);--ha-font-family-body:var(--m-font);--ha-font-family-heading:var(--m-font)}
:host([dark]) .m-native>.native{--card-background-color:var(--m-sheet-fill);--md-sys-color-surface:var(--m-sheet-fill)}
.m-native>.native>*{display:block}
.m-native .note{margin:0;padding:var(--m-space-3) var(--m-space-4);border-radius:0;background:transparent;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
`;
