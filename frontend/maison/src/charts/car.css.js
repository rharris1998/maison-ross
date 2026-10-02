// The Car tab's header chart (#29 step 3): the Car at the Charger. Its
// colours are the --m-car-* tokens, the same in both schemes as it sits on
// the sky: the body and windows lighter by day and deeper otherwise, the
// wheel wells as dark as the tyres. The cable's stroke is its gradient, whose
// stops take the cable's colour; on a phone it runs past the chart's left
// edge and the hero clips it. While charging, the glow takes its source's
// colour through currentColor (on the cable's group, and on its gradient for
// the stops): a faint halo, the cable mixed toward it (mixed with the cable's
// own grey rather than made translucent, so it never turns muddy on a blue
// sky) and brighter dashes running toward the port; the LED pulses. A browser
// without color-mix() keeps the plain cable, which would otherwise turn black
// (the stops' initial colour). Nothing moves under reduced motion. An offline
// Charger leaves the Car at half opacity.
export const carChartStyles = `
.m-car{display:block;width:100%;height:auto;overflow:visible}
.m-car__body{fill:var(--m-car-body-night)}
.m-car__window{fill:var(--m-car-window-night)}
.m-car--day .m-car__body{fill:var(--m-car-body-day)}
.m-car--day .m-car__window{fill:var(--m-car-window-day)}
.m-car__well,.m-car__tyre{fill:var(--m-car-tyre)}
.m-car__hub{fill:var(--m-car-hub)}
.m-car--offline .m-car__car{opacity:.5}
.m-car__cable,.m-car__halo,.m-car__flow{fill:none;stroke-linecap:round}
.m-car__cable{stroke-width:2.4px}
.m-car__stop{stop-color:var(--m-car-cable)}
.m-car__glow--solar{color:var(--m-yellow)}
.m-car__glow--grid{color:var(--m-indigo-text)}
.m-car__halo{stroke:currentColor;stroke-width:8px;stroke-opacity:.16}
.m-car__glow .m-car__stop{stop-color:color-mix(in srgb,currentColor 45%,var(--m-car-cable))}
@supports not (color:color-mix(in srgb,currentColor 20%,transparent)){.m-car__glow .m-car__stop{stop-color:var(--m-car-cable)}}
.m-car__flow{stroke:currentColor;stroke-width:3px;stroke-dasharray:3 7;animation:m-car-flow 1.1s linear infinite}
.m-car__led{fill:var(--m-car-led-off)}
.m-car__led--on{fill:var(--m-green);animation:m-car-pulse 2.4s ease-in-out infinite}
@keyframes m-car-flow{to{stroke-dashoffset:-10}}
@keyframes m-car-pulse{50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.m-car__flow,.m-car__led--on{animation:none}}
`;
