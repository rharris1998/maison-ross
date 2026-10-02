// Today (#29 step 4): only what is Today's own, the
// page's rhythm under the hero, the chips' bleed to the page's edges, the
// quiet line's place and the widget bodies' inner layout. The widgets and the
// parts bring their own surfaces, type and tones.
//
// Rhythm: the page's blocks stand 24px apart, as the phone's sections do;
// the quiet line belongs to the widgets above it and sits a grid gap (16px)
// under them. The chips scroll edge to edge, their row pulled out to the
// page's inset on both sides and padded back in, and snap to the same inset
// (margin-inline, padding-inline and scroll-padding-inline, never the margin
// shorthand, so the chips' own block margin for the focus ring stays); the
// row is at most the page's width plus the two insets, never wider.
//
// Bodies, which the widget draws as a flex column that clips at its rows
// (107px in a medium or small widget, 291px in a large one):
// - Car: the ring and its copy centred in the body, the headline and when
//   the level was last confirmed each at most two lines, which a small
//   widget's 107px hold together.
// - Power now: the figure centred in the room the line under it leaves, the
//   line one line from 700px.
// - Climate: the capsules centred in the body, never wider than their box.
// - Energy today: the figure at the top, the bar and its legend at the foot;
//   on a phone they follow each other, 12px and 10px apart, on the card.
// - Coming up: while the calendar loads, a row's shape in the gray fill, a
//   tile and two lines that never move, above the list where the events
//   will be, with a hairline under it as between rows; its name is visually
//   hidden. On a phone the agenda around them is the inset list's card (the
//   list inside draws no surface of its own, and its first row squares its
//   top corners under the placeholder); from 700px both sit flush on the
//   widget. The calendar's error is the list's only row without a tile, its
//   title in the secondary label at subhead.
export const todayPageStyles = `
.m-today{display:flex;flex-direction:column;gap:var(--m-space-6);min-width:0}
.m-today .m-glance{margin-inline:calc(-1 * var(--m-page-inset));padding-inline:var(--m-page-inset);scroll-padding-inline:var(--m-page-inset);max-width:calc(100% + 2 * var(--m-page-inset))}
.m-today>.m-quiet{margin-top:calc(var(--m-widget-gap) - var(--m-space-6))}
.m-today__car{flex:1;display:flex;align-items:center;gap:var(--m-space-4);min-width:0;min-height:0}
.m-today__copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.m-today__headline{margin:0;font:var(--m-type-headline);color:var(--m-label);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
.m-today__line{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-today__copy>.m-today__line{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.m-widget:not(.m-widget--phone) .m-today__live>.m-today__line{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-today__live{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.m-today__live>.m-figure{flex:1;justify-content:center;min-height:0}
.m-today__zones{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;min-height:0}
.m-today__energy{flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:var(--m-space-3);min-width:0;min-height:0}
.m-today__split{display:flex;flex-direction:column;gap:10px;min-width:0}
.m-widget--phone .m-today__agenda{background:var(--m-card-fill);border:.5px solid var(--m-card-border);border-radius:var(--m-radius-card);overflow:hidden}
.m-widget--phone .m-today__agenda>.m-list--inset{background:none;border:0;border-radius:0}
.m-today__placeholder+.m-list--inset>.m-list__item:first-child>.m-row{border-top-left-radius:0;border-top-right-radius:0}
.m-widget:not(.m-widget--phone) .m-today__placeholder{padding-inline:0}
.m-today__placeholder:not(:last-child)::after{content:"";position:absolute;left:calc(var(--m-space-4) + var(--m-tile) + var(--m-space-3));right:0;bottom:0;border-bottom:.5px solid var(--m-separator)}
.m-widget:not(.m-widget--phone) .m-today__placeholder:not(:last-child)::after{left:calc(var(--m-tile) + var(--m-space-3))}
.m-today__placeholder-tile{flex:none;width:var(--m-tile);height:var(--m-tile);border-radius:var(--m-radius-tile);background:var(--m-fill-gray)}
.m-today__placeholder-copy{flex:1 1 0;display:flex;flex-direction:column;gap:8px;min-width:0}
.m-today__placeholder-line{display:block;width:60%;height:10px;border-radius:5px;background:var(--m-fill-gray)}
.m-today__placeholder-line--short{width:35%}
.m-today__hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.m-today__agenda .m-row--bare .m-row__title{font:var(--m-type-subhead);color:var(--m-label-2)}
`;
