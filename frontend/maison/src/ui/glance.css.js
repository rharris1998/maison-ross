// The glance chips (#29 step 4), the concept's `.bubbles`. The row is a
// scroller that never widens what holds it (min-width 0, at most its
// container's width), snaps each chip to its start, hides its scrollbar and
// keeps its overscroll, so a swipe along it never pans the page or goes
// back. It is padded 4px above and below, and pulled back by as much, so
// the keyboard ring round a chip is not clipped by the scroller; the page
// bleeds it to its edges with margin-inline and padding-inline (and the
// same scroll-padding-inline), leaving these alone.
//
// A chip is the card's surface as a capsule, 47px tall: its tone's 32px dot
// inset 7px on every side it touches, so dot and capsule are concentric,
// then its title over its line, 8px on, and 11px to the capsule's end. The
// chips stand 8px apart. That is tight enough that on a 375px phone, from
// the page's 16px inset, two chips of the busiest words ('16.8–20.1°
// inside', '2.84 kW solar') leave more than 32px of the third in view, so
// the row says it scrolls. It is pressable without being blue: a press
// darkens it at once through an inset shade and eases back over
// --m-dur-press, a pointer hovering it shades it lightly, the keyboard ring
// is the shared one, and a disabled chip turns tertiary with its dot faded.
// The dot's glyph is black (--m-on-bright), which reads on every tone's
// fill and on the room scale.
export const glanceStyles = `
.m-glance{box-sizing:border-box;display:flex;gap:var(--m-space-2);min-width:0;max-width:100%;margin-block:-4px;padding-block:4px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scrollbar-width:none}
.m-glance::-webkit-scrollbar{display:none}
.m-glance__item{flex:none;display:flex;scroll-snap-align:start}
.m-glance__chip{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:var(--m-space-2);min-height:var(--m-hit);margin:0;padding:4px 11px 4px 7px;border:.5px solid var(--m-card-border);border-radius:var(--m-radius-capsule);background:var(--m-card-fill);color:var(--m-label);text-align:left;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;appearance:none;-webkit-appearance:none;transition:box-shadow var(--m-dur-press) var(--m-ease)}
.m-glance__chip[data-hovered]{box-shadow:inset 0 0 0 100px var(--m-fill-gray)}
.m-glance__chip[data-pressed]{box-shadow:inset 0 0 0 100px var(--m-fill-pressed);transition-duration:0ms}
.m-glance__chip[data-disabled]{cursor:default;box-shadow:none}
.m-glance__chip[data-disabled] .m-glance__title,.m-glance__chip[data-disabled] .m-glance__line{color:var(--m-label-3)}
.m-glance__chip[data-disabled] .m-glance__dot{opacity:.4}
.m-glance__dot{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--m-tone);color:var(--m-on-bright)}
.m-glance__dot .m-glyph{width:17px;height:17px}
.m-glance__dot.m-tone-yellow{--m-tone:var(--m-yellow)}
.m-glance__dot.m-tone-indigo{--m-tone:var(--m-indigo)}
.m-glance__dot.m-tone-pink{--m-tone:var(--m-pink)}
.m-glance__dot.m-tone-green{--m-tone:var(--m-green)}
.m-glance__dot.m-tone-orange{--m-tone:var(--m-orange)}
.m-glance__dot.m-tone-gray{--m-tone:var(--m-gray)}
.m-glance__copy{display:flex;flex-direction:column;min-width:0}
.m-glance__title{font:var(--m-type-subhead-strong);color:var(--m-label);white-space:nowrap}
.m-glance__line{font:var(--m-type-footnote);color:var(--m-label-2);white-space:nowrap}
`;
