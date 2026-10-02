// The widgets (#29 step 4). On a phone a widget is a section: the 22px
// section title, inset 4px to line up with the card's curve, 8px over its
// card or its own inset list, 24px under the widget before it; its glyph
// stays out of sight, as a section header has none, and its note takes a
// line of its own under the title. From 700px a widget is a quiet surface of
// its own, the card's (frosted in dark, white on the light page), holding a
// one-line footnote-strong title in --m-label-2 over a body that never
// overflows its rows.
//
// Metrics, which today.js's WIDGET_ROWS ({medium: 2, large: 5}) follows. A
// grid row is 168px (--m-widget-row), and a widget spanning two rows takes
// the 16px gap between them too (352px). Inside it: a 0.5px border and 16px
// of padding each side, then the title, 20px high, and 8px under it. That
// leaves a medium body 168 − 1 − 32 − 28 = 107px and a large one
// 352 − 1 − 32 − 28 = 291px, or 106px and 290px where Chromium draws the
// border a whole pixel wide. A list row in a widget is 52px: a 22px title
// line and a 20px detail line (each one line, clamped) and 5px above and
// below, with the 32px tile inside that. So a medium widget holds two rows
// (104px), or one and the 36px "N more" button at its foot (88px), and never
// three (156px); a large one holds five (260px), or four and "N more"
// (244px), and never six (312px). Change one number here and WIDGET_ROWS,
// and this sum, follow.
//
// The body clips what overflows, yet reaches 12px past the text on either
// side and 4px above and below (a negative margin its padding gives back, so
// the 107px and 291px stay): "N more" pulls 8px out to line its text up with
// the rows, and its focus ring (2px, 2px out) and hit area (4px out) end
// exactly at that reach, as a pressed row's fill (8px out, as in any plain
// list) and its ring end inside it. A pressed or focused row inside a widget
// takes a 16px radius, concentric with the widget's 24px 8px in. A pressed
// widget lays the pressed fill over its surface, edge included, while the
// press lasts (it opens a page, so there is nothing to ease back to); on a
// phone the fill is on its card or inset list. The title's press stretches
// over the whole widget with z-index 1 in the widget's own stacking context
// (isolation), so a positioned row inside can't take the press from it. Its
// focus ring is drawn on the widget, following its 24px curve 2px out; on a
// phone it goes 4px around the title and the body together, its top corners
// tight to the title (12px) and its bottom ones concentric with the card.
// Where :has() isn't supported the press keeps its own ring.
//
// A widget that doesn't open anything may end its title row with an action
// (v32), "Details ›": the row is then a head holding the h2 and the button
// side by side, so the heading reads only its title. The head takes the
// title's place, height and margins (20px and 8px under it from 700px; on a
// phone the section title's 4px inset), and the h2 inside it takes the rest
// of the line. The head sits over the body (z-index 1 in the widget's own
// stacking context), so the first row, positioned and later in the page,
// never takes the lower part of the action's hit area; a widget with an
// action has no stretched press to compete with. The action is blue, as what
// presses is, in the title's own scale (body on a phone beside the 22px
// section title, footnote from 700px), its box the title row's height (28px,
// 20px) and padded 8px either side, which a negative margin gives back so
// its text ends where the title row does. Its hit area is 44px high, centred
// on the title, and reaches 8px past the box on either side: from 700px it
// ends 12px under the 20px title, exactly where the 44px hit area of a first
// row's accessory (a 52px row, the body 8px under the title) begins, so the
// two never overlap. A press fades it as a plain button's does; a pointer
// hovering it draws its capsule; the keyboard ring follows the capsule;
// disabled, it turns tertiary. It never stretches over the widget.
//
// A glyph in a tone takes the tone's text colour, as a row's tile does (pink
// has none, so it is pink taken 20% towards --m-label). Inside a widget the
// sky-tuned chart colours give way to the card's, so the zone capsules read
// on a card in both schemes: the target tick in --m-label and the track in
// --m-separator, 1.7:1 on the light card and 1.56:1 on the dark one (the
// gray fill was 1.15:1 on white).
export const widgetStyles = `
.m-widgets{box-sizing:border-box;min-width:0;max-width:100%}
.m-widgets--stack{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-6)}
.m-widgets--grid{display:grid;grid-auto-rows:minmax(var(--m-widget-row),auto);gap:var(--m-widget-gap)}
.m-widgets--grid[data-columns="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.m-widgets--grid[data-columns="4"]{grid-template-columns:repeat(4,minmax(0,1fr))}
.m-widget{position:relative;isolation:isolate;box-sizing:border-box;min-width:0;margin:0;display:flex;flex-direction:column;color:var(--m-label);--m-capsule-track:var(--m-separator);--m-target-tick:var(--m-label)}
.m-widget:not(.m-widget--phone){min-height:0;padding:var(--m-card-padding);background:var(--m-card-fill);border:.5px solid var(--m-card-border);border-radius:var(--m-radius-card);overflow:hidden}
.m-widget--phone{gap:var(--m-space-2);border-radius:var(--m-radius-row) var(--m-radius-row) var(--m-radius-card) var(--m-radius-card)}
.m-widget__title{display:flex;align-items:center;gap:6px;min-width:0}
.m-widget:not(.m-widget--phone)>.m-widget__title{flex:none;height:20px;margin:0 0 var(--m-space-2);font:var(--m-type-footnote-strong);color:var(--m-label-2);white-space:nowrap}
.m-widget--phone>.m-widget__title{flex-wrap:wrap;column-gap:var(--m-space-1);margin-top:0}
.m-widget__glyph{width:15px;height:15px}
.m-widget--phone .m-widget__glyph{display:none}
.m-widget__glyph.m-tone-yellow{color:var(--m-yellow-text)}
.m-widget__glyph.m-tone-indigo{color:var(--m-indigo-text)}
.m-widget__glyph.m-tone-pink{color:color-mix(in srgb,var(--m-pink) 80%,var(--m-label))}
.m-widget__glyph.m-tone-green{color:var(--m-green-text)}
.m-widget__glyph.m-tone-orange{color:var(--m-orange-text)}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-widget__glyph.m-tone-pink.m-tone-pink{color:var(--m-pink)}}
.m-widget__text,.m-widget__press{flex:0 1 auto;min-width:0}
.m-widget__press{margin:0;padding:0;border:0;border-radius:0;background:transparent;color:inherit;font:var(--m-type-footnote-strong);text-align:left;cursor:pointer;appearance:none;-webkit-appearance:none;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.m-widget--phone .m-widget__press{font:var(--m-type-title)}
.m-widget__press::after{content:"";position:absolute;inset:0;z-index:1}
.m-widget__press[data-disabled]{cursor:default}
.m-widget__note{flex:0 100 auto;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-widget:not(.m-widget--phone) .m-widget__note::before{content:"·";content:"·"/"";margin-inline-end:6px}
.m-widget--phone .m-widget__note{order:1;flex-basis:100%;font:var(--m-type-subhead)}
.m-widget:not(.m-widget--phone) :is(.m-widget__text,.m-widget__press,.m-widget__note){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-widget__chevron{flex:none;width:13px;height:13px;margin-inline-start:auto;color:var(--m-label-3)}
.m-widget--phone .m-widget__chevron{width:18px;height:18px;margin-inline-start:0}
.m-widget__head{position:relative;z-index:1;display:flex;align-items:center;gap:6px;min-width:0}
.m-widget:not(.m-widget--phone)>.m-widget__head{flex:none;height:20px;margin:0 0 var(--m-space-2)}
.m-widget:not(.m-widget--phone)>.m-widget__head>.m-widget__title{flex:1 1 auto;height:20px;margin:0;font:var(--m-type-footnote-strong);color:var(--m-label-2);white-space:nowrap}
.m-widget--phone>.m-widget__head{align-items:flex-start;margin:0 var(--m-space-1)}
.m-widget--phone>.m-widget__head>.m-widget__title{flex:1 1 auto;flex-wrap:wrap;column-gap:var(--m-space-1);margin:0}
.m-widget__action{position:relative;flex:none;align-self:flex-start;box-sizing:border-box;display:inline-flex;align-items:center;gap:2px;height:20px;margin:0 calc(-1 * var(--m-space-2)) 0 auto;padding:0 var(--m-space-2);border:0;border-radius:var(--m-radius-capsule);background:transparent;color:var(--m-blue-text);font:var(--m-type-footnote);cursor:pointer;appearance:none;-webkit-appearance:none;touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:opacity var(--m-dur-press) var(--m-ease),background-color var(--m-dur-press) var(--m-ease)}
.m-widget__action::after{content:"";position:absolute;inset:-12px calc(-1 * var(--m-space-2))}
.m-widget--phone .m-widget__action{height:28px;font:var(--m-type-body)}
.m-widget--phone .m-widget__action::after{inset:-8px calc(-1 * var(--m-space-2))}
.m-widget__action-chevron{width:12px;height:12px}
.m-widget--phone .m-widget__action-chevron{width:15px;height:15px}
.m-widget__action[data-hovered]{background:var(--m-fill-gray)}
.m-widget__action[data-pressed]{opacity:.55;transition-duration:0ms}
.m-widget__action[data-disabled]{color:var(--m-label-3);cursor:default}
.m-widget__body{display:flex;flex-direction:column;min-width:0}
.m-widget:not(.m-widget--phone)>.m-widget__body{flex:1;min-height:0;margin:-4px -12px;padding:4px 12px;overflow:hidden}
.m-widget__body--card{padding:var(--m-card-padding);background:var(--m-card-fill);border:.5px solid var(--m-card-border);border-radius:var(--m-radius-card)}
.m-widget:not(.m-widget--phone) .m-row{min-height:52px;padding-block:5px}
.m-widget:not(.m-widget--phone) :is(.m-row__title,.m-row__detail,.m-row__value){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-widget .m-list--plain .m-row--pressable::before{border-radius:calc(var(--m-radius-card) - var(--m-card-padding) + var(--m-space-2))}
.m-button.m-widget__more{flex:none;align-self:flex-start;margin-inline-start:calc(-1 * var(--m-space-2));padding-inline:var(--m-space-2)}
.m-widget:not(.m-widget--phone) .m-button.m-widget__more{margin-top:auto}
.m-widget--phone>.m-widget__body:not(.m-widget__body--card)>.m-button.m-widget__more{margin-inline-start:0;padding-inline:var(--m-space-4)}
@supports selector(:has(*)){.m-widget:not(.m-widget--phone):has(.m-widget__press[data-pressed]),.m-widget--phone:has(.m-widget__press[data-pressed])>.m-widget__body--card,.m-widget--phone:has(.m-widget__press[data-pressed])>.m-widget__body>.m-list--inset{background-image:linear-gradient(var(--m-fill-pressed),var(--m-fill-pressed))}}
@supports selector(:has(*)){.m-widget__press.m-focusable[data-focus-visible]{outline:none}}
@supports selector(:has(*)){.m-widget:has(.m-widget__press[data-focus-visible]){outline:2px solid var(--m-focus-ring);outline-offset:2px}.m-widget.m-widget--phone:has(.m-widget__press[data-focus-visible]){outline-offset:4px}}
`;
