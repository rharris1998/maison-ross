// The ring (#29 step 4). ring.jsx draws the geometry (radius, stroke widths,
// dashes and the ticks' notches, as attributes); this sheet colours it. The
// track is the tone at 20%, as a list tile's tint is, and the arc the tone
// itself, with round caps; the tone is a fill, so light takes the plain
// tone, not its *-text colour. An unknown level's track is a 2px dashed line
// in --m-label-3, as a missing reading is dashed everywhere in Maison (the
// segmented bar, an unavailable row's tile). A stale level's arc is dimmed,
// not greyed, so its tone still says charging or not. The ticks' mask is an
// alpha mask painted opaque white (--m-on-color, white in both schemes), so
// it shows the ring everywhere but the notches whichever way a browser reads
// it. The label is the figure style at 136px and subhead-strong in the
// rounded face at 80px, where anything larger crowds '100%' against the
// track. Without color-mix() (Safari before 16.2) the track falls back to
// the gray fill. The pair (v33) is coloured the same way, ring by ring, as
// each `g` carries its tone (pink the peak register, indigo off-peak), but
// its tracks are the tone at 22%, as the approved concept draws them, a
// shade firmer than a single ring's, so the empty part of each ring still
// reads as its own beside the other. In dark, indigo at 22% sinks into the
// card, so its track takes 35% there (--m-rings-track), which reads as
// firmly as pink's maroon does. A missing register is the same thin dashed
// line in --m-label-3.
export const ringStyles = `
.m-ring{display:block;flex:none;overflow:visible}
.m-ring.m-tone-yellow{--m-tone:var(--m-yellow)}
.m-ring.m-tone-indigo{--m-tone:var(--m-indigo)}
.m-ring.m-tone-pink{--m-tone:var(--m-pink)}
.m-ring.m-tone-green{--m-tone:var(--m-green)}
.m-ring.m-tone-orange{--m-tone:var(--m-orange)}
.m-ring.m-tone-gray{--m-tone:var(--m-gray)}
.m-ring__mask{mask-type:alpha}
.m-ring__notches{fill:var(--m-on-color)}
.m-ring__track{fill:none;stroke:color-mix(in srgb,var(--m-tone) 20%,transparent)}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-ring__track.m-ring__track{stroke:var(--m-fill-gray)}}
.m-ring.m-ring--empty .m-ring__track{stroke:var(--m-label-3);stroke-width:2px;stroke-linecap:butt}
.m-ring__fill{fill:none;stroke:var(--m-tone);stroke-linecap:round}
.m-ring--stale .m-ring__fill{opacity:.6}
.m-ring__tick{stroke-linecap:round}
.m-ring__tick--reserve{stroke:var(--m-gray)}
.m-ring__tick--limit{stroke:var(--m-label)}
.m-ring__label{font:var(--m-type-figure);font-variant-numeric:tabular-nums;fill:var(--m-label)}
.m-ring--small .m-ring__label{font:var(--m-type-subhead-strong);font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums}
.m-rings{display:block;flex:none;overflow:visible}
.m-rings__ring.m-tone-pink{--m-tone:var(--m-pink)}
.m-rings__ring.m-tone-indigo{--m-tone:var(--m-indigo)}
:host([dark]) .m-rings__ring.m-tone-indigo{--m-rings-track:35%}
.m-rings__track{fill:none;stroke:color-mix(in srgb,var(--m-tone) var(--m-rings-track,22%),transparent)}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-rings__track.m-rings__track{stroke:var(--m-fill-gray)}}
.m-rings__ring--empty .m-rings__track{stroke:var(--m-label-3);stroke-width:2px;stroke-linecap:butt}
.m-rings__fill{fill:none;stroke:var(--m-tone);stroke-linecap:round}
`;
