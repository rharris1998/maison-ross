// The living sky behind each page's hero (#29 step 3), drawn from
// sky-model.js's paint: the gradient, then the sun's glow and the warm
// horizon, fog's haze, the stars, the clouds and what falls, and last the
// band where it fades into the page. It is decoration: the hero's text and
// chart carry every reading. Every colour comes from the paint (tokens.js's
// SKY, capped for the text over it); this file only lays the layers out.
import {memo} from 'react';
import {CLOUD_LOBES, CLOUD_PROFILE, CORE_PROFILE, GLOW_PROFILE, STOP_AT, TEXT_TOP} from './sky-model.js';

const pct = v => `${+(v * 100).toFixed(2)}%`;
// A profile's colours at their stops, as a gradient's colour list.
const ramp = (fills, profile) => fills.map((fill, i) => `${fill} ${pct(profile[i][0])}`).join(',');
// A soft glow filling its box (the sun's, or the horizon's), or the sun's disc.
const glow = (fills, profile = GLOW_PROFILE) => `radial-gradient(closest-side,${ramp(fills, profile)})`;
// What falls shows whole above the text and at .4 where text sits.
const FALL_BAND = `linear-gradient(180deg,currentColor ${pct(TEXT_TOP)},color-mix(in srgb,currentColor 40%,transparent) ${pct(TEXT_TOP + 0.04)})`;

// Rain, snow and hail as two tiles of drops, each drop [x, y, rx, ry] in px,
// taking the tiles in turn (sky.css.js sizes them, the second half as tall
// as the first and of a width that rarely lines up, and moves both down by
// the first's height): rain in thin streaks, snow in soft flakes, hail in
// small stones, each at its own height so the fall never reads as a grid.
const DROPS = {
  rain: [[249, 61, 0.5, 9], [133, 42, 0.5, 6], [91, 13, 0.6, 8], [158, 59, 0.6, 7], [87, 121, 0.6, 8], [81, 7, 0.5, 6], [61, 87, 0.5, 7],
    [166, 71, 0.6, 8], [188, 136, 0.5, 6], [153, 21, 0.6, 7], [133, 34, 0.5, 6], [30, 31, 0.5, 8]],
  snow: [[184, 48, 2.4, 2.4], [14, 40, 1.8, 1.8], [187, 10, 2.6, 2.6], [30, 59, 2.6, 2.6], [251, 96, 3.2, 3.2], [16, 79, 1.8, 1.8],
    [8, 166, 3, 3], [66, 10, 1.8, 1.8], [217, 129, 2.9, 2.9]],
  hail: [[99, 135, 1.1, 1.1], [45, 15, 1.2, 1.2], [97, 24, 1, 1], [46, 44, 1.1, 1.1], [191, 86, 1.3, 1.3], [167, 72, 1.1, 1.1],
    [69, 62, 1, 1], [25, 22, 1.1, 1.1]],
};
// How much of each drop is solid before it softens: snow is all softness.
const CORE = {rain: 40, snow: 0, hail: 50};
const drops = (fall, ink) => DROPS[fall].map(([x, y, rx, ry]) => `radial-gradient(${rx}px ${ry}px at ${x}px ${y}px,${ink} ${CORE[fall]}%,transparent)`).join(',');

// One cloud: its lobes, each a soft radial gradient; its box keeps the
// cloud's shape at any hero width (sky.css.js sizes it by its height).
function Cloud({cloud: {x, y, w, h, duration, delay, fills}}) {
  const lobes = CLOUD_LOBES.map(([cx, cy, rx, ry]) => `radial-gradient(${rx}% ${ry}% at ${cx}% ${cy}%,${ramp(fills, CLOUD_PROFILE)})`).join(',');
  return <div className="m-sky__cloud" style={{left: pct(x), top: pct(y - h / 2), height: pct(h), aspectRatio: `${+(w / h).toFixed(3)}`,
    backgroundImage: lobes, animationDuration: `${duration}s`, animationDelay: `${delay}s`}}/>;
}

/**
 * The sky layer of the hero.
 *
 * DOM: `div.m-sky[aria-hidden=true]`, absolutely filling its `.m-hero`
 * (inset 0), its background the paint's four stops at STOP_AT. Inside, in
 * paint order:
 * - `div.m-sky__sun`, the sun's glow (by day and at twilight, when it shows),
 *   and `div.m-sky__core`, its disc, on the top edge above the text;
 * - `div.m-sky__horizon`, the warm horizon on the sun's side at twilight;
 * - `div.m-sky__haze`, fog's low haze;
 * - `div.m-sky__stars`, the stars as one layer, faded in by the paint;
 * - `div.m-sky__cloud` each, keyed by the paint so its drift never restarts;
 * - `div.m-sky__band` holding `div.m-sky__fall[data-fall]`, rain, snow or
 *   hail: the band is still and fades what falls to .4 where text sits;
 * - `div.m-sky__fade`, the bottom var(--m-sky-fade) into var(--m-page-bg).
 * Clouds are soft radial gradients (no filter); they drift, and what falls
 * falls, only by transform, and nothing moves under reduced motion. Each
 * cloud is keyed by the paint alone, and Sky is memoised on the paint
 * (itself memoised on the rounded sky), so a Home Assistant update that
 * leaves the sky alone never re-renders it, and one that moves the sun
 * never re-keys a cloud or restarts its drift.
 *
 * @param {object} props
 * @param {import('./sky-model.js').SkyPaint} props.paint skyPaint(chrome.sky).
 */
export const Sky = memo(function Sky({paint}) {
  const {stops, sun, horizon, haze, stars, starAlpha, clouds, fall, fallInk} = paint;
  return <div className="m-sky" aria-hidden="true" style={{backgroundImage: `linear-gradient(180deg,${stops.map((stop, i) => `${stop} ${pct(STOP_AT[i])}`).join(',')})`}}>
    {sun && sun.alpha > 0 && <div className="m-sky__sun" style={{left: pct(sun.x), top: pct(sun.y), height: pct(2 * sun.r), backgroundImage: glow(sun.fills)}}/>}
    {sun?.core && <div className="m-sky__core"
      style={{left: pct(sun.core.x), top: pct(sun.core.y), height: pct(2 * sun.core.r), backgroundImage: glow(sun.core.fills, CORE_PROFILE)}}/>}
    {horizon && horizon.alpha > 0 && <div className="m-sky__horizon"
      style={{left: pct(horizon.x), top: pct(horizon.y), width: pct(2 * horizon.rx), height: pct(2 * horizon.ry), backgroundImage: glow(horizon.fills)}}/>}
    {haze && <div className="m-sky__haze" style={{backgroundImage: `linear-gradient(180deg,${haze.stops.map(({at, fill}) => `${fill} ${pct(at)}`).join(',')})`}}/>}
    {stars.length > 0 && starAlpha > 0 && <div className="m-sky__stars"
      style={{opacity: starAlpha, backgroundImage: stars.map(({x, y, r, fill}) => `radial-gradient(${r}px ${r}px at ${pct(x)} ${pct(y)},${fill} 45%,transparent)`).join(',')}}/>}
    {clouds.map(cloud => <Cloud key={cloud.key} cloud={cloud}/>)}
    {fall && <div className="m-sky__band" style={{WebkitMaskImage: FALL_BAND, maskImage: FALL_BAND}}>
      <div className="m-sky__fall" data-fall={fall} style={{backgroundImage: drops(fall, fallInk)}}/></div>}
    <div className="m-sky__fade"/>
  </div>;
});
