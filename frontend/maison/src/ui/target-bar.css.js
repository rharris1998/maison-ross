// The target bar (#29 step 4), the concept's `.tbar`: a 4px track in a 12px
// box on --m-fill-pressed, the empty track a progress bar shows, which reads
// on a white card too (the segmented bar's zero). The reading is a 10px dot
// in its room colour; the stretch back to the target is the same colour at
// 45%, the concept's trail; the target is a 2px tick the box's full height
// in --m-label, drawn over the dot. The positions and the room colours are
// inline, from the value; a dot or a tick at the scale's end is centred on
// it, so it reaches 5px past the box, as the concept's does.
//
// Surfaces. The dot wears a 2px ring and the tick a 1px one in the colour of
// the surface under the bar, so the dot stands clear of its trail and the
// tick notches the track, the trail and the dot, as the Car ring's ticks
// notch it: a reading at its target reads as a dot split by the tick, never
// as a lone dot, which is what no target draws. The surface's colour is its
// fill laid over its ground, two shadows at once, since a card in dark is a
// translucent white: --m-target-ring (the fill, transparent on a bare
// ground) over --m-target-ground (--m-bg on the page, --m-sheet-fill in a
// sheet). Cards, inset lists and widgets set the fill; a sheet sets the
// ground; a surface of its own sets both.
//
// Contrast. The tick is 13.7:1 at least, on a dark sheet's card. Every room
// colour stands at 4:1 or more on a dark surface (the hottest, on a sheet's
// card), but yellow is 1.4:1 on white, so in light the dot takes a 1px rim
// of --m-label at 40% inside its edge, the room colour shaded as a tone's
// text colour is: 3.8:1 at worst on a white card, 3.4:1 on the sheet's bare
// gray (both yellow, 21°); dark needs none. Without light-dark() (Safari
// before 17.5) or color-mix() the dot keeps its ring and loses the rim. The
// bar is its own stacking context and takes no pointer, so the tick never
// lifts over a linked widget's press. Nothing here moves, so there is
// nothing to stop under reduced motion.
export const targetBarStyles = `
.m-card,.m-list--inset,.m-widget__body--card,.m-widget:not(.m-widget--phone){--m-target-ring:var(--m-card-fill)}
.m-sheet{--m-target-ground:var(--m-sheet-fill)}
.m-target-bar{position:relative;isolation:isolate;display:block;flex:none;box-sizing:border-box;height:12px;min-width:0;max-width:100%;pointer-events:none}
.m-target-bar--row{width:78px}
.m-target-bar--wide{width:100%}
.m-target-bar__track{position:absolute;inset-inline:0;top:4px;height:4px;border-radius:2px;background:var(--m-fill-pressed)}
.m-target-bar.m-target-bar--empty .m-target-bar__track{top:5px;height:0;border-radius:0;background:none;border-top:2px dashed var(--m-label-3)}
.m-target-bar__span{position:absolute;top:4px;height:4px;border-radius:2px;opacity:.45}
.m-target-bar__dot{position:absolute;top:1px;box-sizing:border-box;width:10px;height:10px;margin-left:-5px;border-radius:50%;box-shadow:inset 0 0 0 1px light-dark(color-mix(in srgb,var(--m-label) 40%,transparent),transparent),0 0 0 2px var(--m-target-ring,transparent),0 0 0 2px var(--m-target-ground,var(--m-bg))}
.m-target-bar__tick{position:absolute;top:0;z-index:1;width:2px;height:12px;margin-left:-1px;border-radius:1px;background:var(--m-label);box-shadow:0 0 0 1px var(--m-target-ring,transparent),0 0 0 1px var(--m-target-ground,var(--m-bg))}
@supports not ((color:light-dark(transparent,transparent)) and (color:color-mix(in srgb,currentColor 40%,transparent))){.m-target-bar__dot.m-target-bar__dot{box-shadow:0 0 0 2px var(--m-target-ring,transparent),0 0 0 2px var(--m-target-ground,var(--m-bg))}}
`;
