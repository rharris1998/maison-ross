// The heroes section of the gallery (#29 step 3): each page's hero,
// the sky, the header and its header chart, over the variants in
// gallery-snapshots.js's HERO_VARIANTS, drawn from the values the dashboard
// draws for them. One group per chart, in the navigation's order; each group's
// variants are listed by its own file. A phone specimen is 390px wide; a
// desktop one (1,180px) shows only from a 1,240px gallery, as in frames.
// Presses act on nothing.
import {useScreen} from '../gallery-snapshots.js';
import {Hero} from '../hero.jsx';
import {GalleryGroup, GallerySection} from './section.jsx';
import {WeatherHeroes} from './heroes-weather.jsx';
import {ZonesHeroes} from './heroes-zones.jsx';
import {CarHeroes} from './heroes-car.jsx';
import {FlowsHeroes} from './heroes-flows.jsx';

/**
 * One hero, drawn from a snapshot as the dashboard draws it, in a box of a
 * fixed width: `div.m-app[data-layout=size]` holding the Hero, so the page
 * inset and the hero's bleed are the frame's.
 * @param {object} props
 * @param {object} props.snapshot A snapshot (heroSnapshot(page, variant)).
 * @param {'phone'|'desktop'} props.size 390px or 1,180px wide.
 * @param {string} props.caption
 */
export function HeroSpecimen({snapshot, size, caption}) {
  const {chrome} = useScreen()(snapshot);
  return <figure className={`m-gallery-hero m-gallery-hero--${size}`}>
    <div className="m-gallery-hero__box"><div className="m-app" data-layout={size}><Hero chrome={chrome} layout={size}/></div></div>
    <figcaption className="m-gallery__caption">{caption}</figcaption>
  </figure>;
}

export function HeroesSection() {
  return <GallerySection name="heroes" title="Heroes" note="Each page’s sky, header and header chart, from its fixtures">
    <GalleryGroup title="Today · the weather"><WeatherHeroes/></GalleryGroup>
    <GalleryGroup title="Climate · the zones"><ZonesHeroes/></GalleryGroup>
    <GalleryGroup title="Car · the Car"><CarHeroes/></GalleryGroup>
    <GalleryGroup title="Energy · the flows"><FlowsHeroes/></GalleryGroup>
  </GallerySection>;
}

// Phone specimens side by side; desktop ones only where the gallery can hold
// them, reaching out of its column as the desktop frame does. The frame's
// phone padding for the floating tab bar is left out.
export const heroesGalleryStyles = `
.m-gallery-heroes{display:flex;flex-wrap:wrap;gap:var(--m-space-6) var(--m-space-5);align-items:flex-start}
.m-gallery-hero{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-gallery-hero--phone{width:min(100%,390px)}
.m-gallery-hero--desktop{display:none;flex:none;width:1180px;margin-inline-start:calc(50% - 590px)}
.m-gallery-hero__box{overflow:hidden;border:.5px solid var(--m-separator);border-radius:var(--m-radius-card);background:var(--m-bg)}
.m-gallery-hero__box .m-app[data-layout]{padding-top:0;padding-bottom:0}
@media (min-width:1240px){.m-gallery-hero--desktop{display:grid}}
`;
