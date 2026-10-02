// The hero (#29 step 3): the sky, the header on it, the page's reading and
// its header chart. It bleeds to Maison's edges through the page inset
// rather than a width, and clips its own sky; its bottom var(--m-sky-fade)
// holds nothing, as the sky fades into the page there. Its tokens are the
// dark set (tokens.js), in both schemes, so its text is white, with a shadow
// that keeps it off the brightest sky. It is a sibling of the phone tab bar,
// never its ancestor, so nothing here can unpin the bar; still, nothing here
// may give :host, .wrap, .m-app or .m-content a transform, filter, contain
// or the like. `isolation` keeps whatever the sky and the charts stack inside
// the hero, under the sticky pill.
//
// Phone and wide stack the header, the reading and the chart, which is
// centred and 470px at most. On a phone the hero starts at Maison's top
// edge; from 700px it reaches up behind the pill by var(--m-tabbar-reach),
// only where the pill is there, and its padding keeps the header clear of
// it. Desktop (from 1,100px) keeps the wide header across the top, the
// tools on the title's row, so the title sits at the same height on every
// page; under it two columns, as the concept's: the reading on the left and
// the chart on the right, both at the foot, the chart at the end. A row is
// drawn only for what is there, so Home status ends at the header.
//
// Inside the hero the glass saturates the sky behind it less than the tab
// bar's does: at 180% Chromium turns the tools on a day sky a loud blue.
export const heroStyles = `
.m-hero{--m-glass-blur:blur(22px) saturate(120%);position:relative;isolation:isolate;overflow:hidden;margin-inline:calc(-1 * var(--m-page-inset));padding:var(--m-space-3) var(--m-page-inset) var(--m-sky-fade);color:var(--m-label);text-shadow:var(--m-sky-shadow)}
.m-app:not([data-layout=phone]) .m-hero{padding-top:var(--m-space-6)}
.m-app:not([data-layout=phone]) .m-tabbar+.m-hero{margin-top:calc(-1 * var(--m-tabbar-reach));padding-top:calc(var(--m-tabbar-reach) + var(--m-space-6))}
.m-hero__inner{position:relative;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);row-gap:var(--m-space-5);max-width:var(--m-content-max);margin-inline:auto}
.m-header{display:grid;grid-template:"date tools" auto "title title" auto/minmax(0,1fr) auto;align-items:end;gap:2px var(--m-space-3);padding:0 var(--m-space-1)}
.m-app:not([data-layout=phone]) .m-header{grid-template:"date ." auto "title tools" auto/minmax(0,1fr) auto}
.m-app:not([data-layout=phone]) .m-header__tools{align-self:center}
.m-header__text{display:contents}
.m-header__date{grid-area:date;margin:0;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-header__title{grid-area:title;margin:0;font:var(--m-type-large-title);color:var(--m-label);overflow-wrap:anywhere}
.m-header__line{grid-column:1/-1;margin:0;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-header__tools{grid-area:tools;display:flex;gap:var(--m-space-2)}
.m-hero__reading,.m-hero__chart{box-sizing:border-box;justify-self:center;width:100%;min-width:0;max-width:470px}
.m-hero__chart:empty{display:none}
.m-app[data-layout=desktop] .m-hero__inner{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:var(--m-space-8)}
.m-app[data-layout=desktop] .m-header{grid-column:1/-1}
.m-app[data-layout=desktop] .m-hero__reading{grid-area:2/1;align-self:end;justify-self:stretch;max-width:none}
.m-app[data-layout=desktop] .m-hero__chart{grid-area:2/2;align-self:end;justify-self:end}
`;
