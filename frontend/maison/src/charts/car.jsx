// The Car tab's header chart (#29 step 3): the Car at the Charger, from the
// concept's silhouette. Its body follows the sky's phase; the cable shows
// while it is plugged in and glows with its source while it charges. Every
// accessible name comes from the value (car.js's CarHero).
import {useId} from 'react';

// The concept's silhouette, in its own 71×28 units: the body, the windows,
// then for each wheel its well (the arch's upper half-disc, r 6, so no ring of
// sky shows between arch and tyre), its tyre and its hub.
const BODY = 'M2 20Q2 14 9 13L20 11 29 4Q32 2 36 2H50Q55 2 58 5L64 11Q69 12 69 17V20Q69 22 67 22H61A6 6 0 0 0 49 22H22A6 6 0 0 0 10 22H4Q2 22 2 20Z';
const WINDOWS = 'M23.5 11 30.5 5Q32.5 4 35.5 4H43V11Z M45 4H50Q54 4 56 6.5L60.5 11H45Z';
const WHEELS = [16, 55];
const well = cx => `M${cx - 6} 22A6 6 0 0 1 ${cx + 6} 22Z`;
// The cable to the port on the front wing, by layout: its path `d`, the x
// range its gradient stroke fades it in over, and `glow`, the same path from
// where the cable is fully opaque, for the halo and the moving dashes, which
// are never masked (a mask around a moving stroke is re-rendered every frame
// on iOS). On a phone the cable comes from far beyond the chart's left edge,
// the concept's curve with a long lead-in, so it is solid where the hero clips
// it at the screen's edge even at 699px, where the chart is 470px and centred;
// its fade lies beyond any phone's edge. Wider, the chart sits in open sky, so
// the cable lies on the ground from the shadow's left end, fading in inside
// the shadow, never starting in mid-air, and rises in front of the nose into
// the port, so all of its short length shows.
const CABLES = {
  phone: {d: 'M-120 132H-4C32 132 54 116 67 90', fade: [-120, -100], glow: 'M-100 132H-4C32 132 54 116 67 90'},
  ground: {d: 'M30 139H34C40 139 43 134 44 124C45 108 50 91 67 90', fade: [30, 37], glow: 'M37 138.5C41 137 43.2 132.2 44 124C45 108 50 91 67 90'},
};
const PORT = {cx: 67, cy: 90};

/**
 * The Car.
 *
 * DOM: `svg.m-car` (viewBox 340×160, width 100%, role=img named by
 * `value.ariaLabel`), `m-car--day` by day and `m-car--night` otherwise
 * (twilight and unknown too), which picks the body and window tokens. In it,
 * `g.m-car__car` (the shadow ellipse, a radial gradient, under the concept's
 * carShape at translate(46 44) scale(3.5), each wheel in a --m-car-tyre well);
 * while `plot.plugged`, the cable in --m-car-cable, its stroke a gradient that
 * fades it in from the left: from far beyond the chart's edge on a phone,
 * along the ground from the shadow's left end and up in front of the nose in
 * the wide and desktop layouts. While `plot.charging` the cable's group and
 * its gradient are `m-car__glow m-car__glow--solar` (--m-yellow) or `--grid`
 * (--m-indigo-text): a faint halo under the cable, the cable tinted toward
 * that colour, and dashes over it moving toward the Car, the halo and dashes
 * unmasked and starting where the cable is opaque. Then the port's LED,
 * `m-car__led--on` (green, pulsing) while charging and off otherwise.
 * `plot.available` false: `m-car--offline`, the Car at half opacity with no
 * cable and no LED. Gradient ids come from useId(), so two Cars in one
 * document keep their own.
 *
 * @param {object} props
 * @param {object} props.value chrome.hero, car.js's CarHero.
 * @param {'night'|'twilight'|'day'|'unknown'} props.phase The sky's phase.
 * @param {'phone'|'wide'|'desktop'} props.layout
 */
export function CarChart({value: {plot, ariaLabel}, phase, layout}) {
  const id = useId(), shadow = `${id}shadow`, fade = `${id}fade`, lay = CABLES[layout === 'phone' ? 'phone' : 'ground'];
  const {plugged = false, charging = false, source = null, available = false} = plot ?? {};
  const cable = available && plugged, glow = cable && charging, tint = glow ? `m-car__glow m-car__glow--${source === 'solar' ? 'solar' : 'grid'}` : undefined;
  const classes = ['m-car', `m-car--${phase === 'day' ? 'day' : 'night'}`, !available && 'm-car--offline'].filter(Boolean).join(' ');
  return <svg className={classes} viewBox="0 0 340 160" role="img" aria-label={ariaLabel}>
    <defs>
      <radialGradient id={shadow}><stop offset="0" style={{stopColor: 'var(--m-car-shadow)'}}/><stop offset="1" style={{stopColor: 'var(--m-car-shadow)', stopOpacity: 0}}/></radialGradient>
      {cable && <linearGradient id={fade} className={tint} gradientUnits="userSpaceOnUse" x1={lay.fade[0]} y1="0" x2={lay.fade[1]} y2="0">
        <stop offset="0" className="m-car__stop" style={{stopOpacity: 0}}/><stop offset="1" className="m-car__stop"/>
      </linearGradient>}
    </defs>
    <g className="m-car__car">
      <ellipse cx="170" cy="139" rx="140" ry="12" fill={`url(#${shadow})`}/>
      {cable && <g className={tint}>
        {glow && <path className="m-car__halo" d={lay.glow}/>}
        <path className="m-car__cable" d={lay.d} stroke={`url(#${fade})`}/>
        {glow && <path className="m-car__flow" d={lay.glow}/>}
      </g>}
      <g transform="translate(46 44) scale(3.5)">
        <path className="m-car__body" d={BODY}/>
        <path className="m-car__window" d={WINDOWS}/>
        {WHEELS.map(cx => <g key={cx}><path className="m-car__well" d={well(cx)}/><circle className="m-car__tyre" cx={cx} cy="22" r="5.2"/><circle className="m-car__hub" cx={cx} cy="22" r="2.2"/></g>)}
      </g>
      {available && <circle className={charging && cable ? 'm-car__led m-car__led--on' : 'm-car__led'} {...PORT} r="3"/>}
    </g>
  </svg>;
}
