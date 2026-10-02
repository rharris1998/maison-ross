// The living sky (#29 step 3): the layer fills its hero, behind the header
// and the chart, and never takes a press. Its colours come from the paint
// (tokens.js's SKY, capped for the text over it), set inline by sky.jsx;
// here are only its layers' boxes and motion. The glows, the sun's disc and
// the clouds are sized by the hero's height and keep their shape at any
// width, a cloud stretching only where a wide hero would leave it small.
// Clouds drift and what falls falls by transform alone, few and slow, and
// under reduced motion nothing moves: that rule outranks every kind of fall.
// Everything here is inside the hero, never above the tab bar. The bottom
// var(--m-sky-fade) eases into the page's own background on a smoothstep,
// so it has no edge, in oklab where the browser can; a browser without
// color-mix() (whose var() makes it fail only when computed) fades it in a
// straight line instead.
export const skyStyles = `
.m-sky{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.m-sky>*,.m-sky__band>*{position:absolute}
.m-sky__sun,.m-sky__core{aspect-ratio:1;translate:-50% -50%}
.m-sky__horizon{translate:-50% -50%}
.m-sky__haze,.m-sky__stars,.m-sky__band{inset:0}
.m-sky__cloud{min-width:16%;translate:-50% 0;animation:m-sky-drift 50s ease-in-out infinite alternate}
.m-sky__fall{inset:-150px -64px 0;background-size:260px 150px,190px 75px;animation:m-sky-rain 1.8s linear infinite}
.m-sky__fall[data-fall=snow]{inset:-180px 0 0;background-size:300px 180px,220px 90px;animation:m-sky-flakes 12s linear infinite}
.m-sky__fall[data-fall=hail]{inset:-150px 0 0;background-size:260px 150px,190px 75px;animation:m-sky-hail 1.3s linear infinite}
.m-sky__fade{left:0;right:0;bottom:0;height:var(--m-sky-fade);background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--m-page-bg) 3%,transparent) 10%,color-mix(in srgb,var(--m-page-bg) 10%,transparent) 20%,color-mix(in srgb,var(--m-page-bg) 35%,transparent) 40%,color-mix(in srgb,var(--m-page-bg) 65%,transparent) 60%,color-mix(in srgb,var(--m-page-bg) 90%,transparent) 80%,color-mix(in srgb,var(--m-page-bg) 97%,transparent) 90%,var(--m-page-bg))}
@supports not (color:color-mix(in srgb,currentColor 50%,transparent)){.m-sky__fade{background:linear-gradient(180deg,transparent,var(--m-page-bg))}}
@supports (background:linear-gradient(in oklab,transparent,transparent)) and (color:color-mix(in oklab,currentColor 50%,transparent)){.m-sky__fade{background:linear-gradient(180deg in oklab,transparent,color-mix(in oklab,var(--m-page-bg) 3%,transparent) 10%,color-mix(in oklab,var(--m-page-bg) 10%,transparent) 20%,color-mix(in oklab,var(--m-page-bg) 35%,transparent) 40%,color-mix(in oklab,var(--m-page-bg) 65%,transparent) 60%,color-mix(in oklab,var(--m-page-bg) 90%,transparent) 80%,color-mix(in oklab,var(--m-page-bg) 97%,transparent) 90%,var(--m-page-bg))}}
@keyframes m-sky-drift{from{transform:translateX(-22px)}to{transform:translateX(22px)}}
@keyframes m-sky-rain{from{transform:skewX(-9deg) translateY(0)}to{transform:skewX(-9deg) translateY(150px)}}
@keyframes m-sky-flakes{from{transform:translateY(0)}to{transform:translateY(180px)}}
@keyframes m-sky-hail{from{transform:translateY(0)}to{transform:translateY(150px)}}
@media (prefers-reduced-motion:reduce){.m-sky .m-sky__cloud,.m-sky .m-sky__fall,.m-sky .m-sky__fall[data-fall]{animation:none}}
`;
