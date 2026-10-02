// Energy's header chart (#29 step 3): power now between four nodes (solar
// at the top, the grid on the left, the house in the middle, the Car on the
// right), and on desktop the price beside it. Every word and accessible
// name comes from the value (energy.js's FlowsHero).
import {icon} from '../../../../config/www/maison/icons.js';

// The drawing, in viewBox units, per layout: the nodes' centres, their
// radius, the icon's size, where the value's baseline sits (under a node, or
// beside solar's) and how far below it the name's does. The chart is never
// drawn wider than its box, so a unit is a pixel and the text keeps its type
// size on every phone (narrower than 352px, it shrinks a little; it never
// grows). On a phone the box is the concept's 320×196, centred. From 700px
// the nodes are larger and 150 apart, the grid's and the Car's rings at the
// box's ends and solar above the house: centred on wide, at the end of the
// column on desktop, so the Car's ring ends under the tools' edge.
const BOXES = {
  phone: {width: 320, height: 196, radius: 26, icon: 22, under: 21, beside: 10, name: 17, large: false,
    at: {solar: [160, 36], grid: [54, 118], house: [160, 118], car: [266, 118]}},
  large: {width: 360, height: 224, radius: 29, icon: 24, under: 23, beside: 12, name: 19, large: true,
    at: {solar: [180, 36], grid: [30, 146], house: [180, 146], car: [330, 146]}},
};
// The gap between a ring and the ends of the links that meet it.
const GAP = 5;
// Each node's icon (icons.js).
const ICONS = {solar: 'wx-sun', grid: 'grid', house: 'wx-house', car: 'car'};
// A coordinate to a tenth of a unit, so the markup stays short.
const tenth = n => Math.round(n * 10) / 10;

// An icon's paths from icons.js, and the size of the box they are drawn in,
// so a node can draw them inside its own SVG, in its colour (they paint with
// currentColor), with no nested <svg> for a page's .icon rules to resize.
function iconPaths(name) {
  const [, size, paths] = icon(name).match(/viewBox="0 0 ([\d.]+) [\d.]+"[^>]*>([\s\S]*)<\/svg>$/);
  return {size: Number(size), paths};
}

/**
 * One link, drawn in the direction power flows, between the rings it joins:
 * while it carries power, a neutral track with dashes in its source's colour
 * moving along it (a coloured dashed line when still); otherwise faint dots. Export runs from the
 * house to the grid, so its dashes move toward the grid.
 */
function Link({link: {from, to, source}, box}) {
  const [a, b] = source === 'export' ? [to, from] : [from, to], [[x1, y1], [x2, y2]] = [box.at[a], box.at[b]];
  const length = Math.hypot(x2 - x1, y2 - y1), [ux, uy] = [(x2 - x1) / length, (y2 - y1) / length], end = box.radius + GAP;
  const d = `M${tenth(x1 + ux * end)} ${tenth(y1 + uy * end)}L${tenth(x2 - ux * end)} ${tenth(y2 - uy * end)}`;
  return <g className={`m-flows__link m-flows__link--${source ?? 'idle'}`}>
    {source ? <><path className="m-flows__under" d={d}/><path className="m-flows__dash" d={d}/></> : <path d={d}/>}
  </g>;
}

/**
 * One node: a ring, its icon, its value and its name, beside it for solar
 * (at the top) and under it for the others. Its state: active (ringed in its
 * tone, the source's colour), idle (a faint ring), unavailable (a dashed
 * ring and the value's '—') or asleep (solar at night: its ring and icon
 * dim, the ring solid, and '—', at rest rather than at fault; its words keep
 * their full colours). Its tone: solar, grid
 * (import), export, house or, for the Car, where its charge comes from.
 */
function Node({kind, node: {name, value, plot}, tone, box}) {
  const [x, y] = box.at[kind], {radius, icon: glyph} = box, {size, paths} = iconPaths(ICONS[kind]), side = kind === 'solar';
  const state = plot.asleep ? 'asleep' : !plot.available ? 'unavailable' : plot.active ? 'active' : 'idle';
  const [tx, anchor, ty] = side ? [x + radius + box.beside, 'start', y - 2] : [x, 'middle', y + radius + box.under];
  return <g className={`m-flows__node m-flows__node--${state} m-flows__node--${tone}`}>
    <circle className="m-flows__ring" cx={x} cy={y} r={radius}/>
    <g className="m-flows__icon" transform={`translate(${x - glyph / 2} ${y - glyph / 2}) scale(${tenth(glyph / size * 100) / 100})`} dangerouslySetInnerHTML={{__html: paths}}/>
    <text className="m-flows__value" x={tx} y={ty} textAnchor={anchor} aria-hidden="true">{value}</text>
    <text className="m-flows__name" x={tx} y={ty + box.name} textAnchor={anchor} aria-hidden="true">{name}</text>
  </g>;
}

/**
 * The price, drawn on desktop only (HERO_PARTS' readingOn): the figure in
 * --m-type-figure-large with tabular digits, its unit beside it on the same
 * baseline, and its line under them.
 *
 * @param {object} props
 * @param {object} props.value chrome.hero, energy.js's FlowsHero.
 * @param {'night'|'twilight'|'day'|'unknown'} props.phase The sky's phase.
 * @param {'phone'|'wide'|'desktop'} props.layout
 */
export function FlowsReading({value: {reading}}) {
  return <div className="m-flows-reading">
    <p className="m-flows-reading__price"><span className="m-flows-reading__figure">{reading.figure}</span> <span className="m-flows-reading__unit">{reading.unit}</span></p>
    {reading.line && <p className="m-flows-reading__line">{reading.line}</p>}
  </div>;
}

/**
 * The four nodes and the links between them: an SVG (width 100%, role=img
 * named by `value.ariaLabel`, its text aria-hidden, at most its box's width:
 * 320×196 on a phone, `.m-flows--large` 360×224 from 700px, `.m-flows--end`
 * on desktop), the links from `value.plot.links` under the nodes. Solar is yellow, grid
 * import indigo, export green and the house white; the Car takes its link's
 * source. Only active links move, three at most, and none under reduced
 * motion.
 *
 * @param {object} props
 * @param {object} props.value chrome.hero, energy.js's FlowsHero.
 * @param {'night'|'twilight'|'day'|'unknown'} props.phase The sky's phase.
 * @param {'phone'|'wide'|'desktop'} props.layout
 */
export function FlowsChart({value: {nodes, plot: {links}, ariaLabel}, layout}) {
  const box = layout === 'phone' ? BOXES.phone : BOXES.large;
  const source = (from, to) => links.find(link => link.from === from && link.to === to)?.source ?? null;
  // Only a real export (the link's source) draws the grid green, never the
  // raw sign of an idle meter.
  const tones = {solar: 'solar', grid: source('grid', 'house') === 'export' ? 'export' : 'grid', house: 'house',
    car: source('house', 'car') === 'solar' ? 'solar' : 'grid'};
  const className = ['m-flows', box.large && 'm-flows--large', layout === 'desktop' && 'm-flows--end'].filter(Boolean).join(' ');
  return <svg className={className} viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label={ariaLabel} style={{maxWidth: `${box.width}px`}}>
    {links.map(link => <Link key={`${link.from}-${link.to}`} link={link} box={box}/>)}
    {Object.keys(box.at).map(kind => nodes[kind] && <Node key={kind} kind={kind} node={nodes[kind]} tone={tones[kind]} box={box}/>)}
  </svg>;
}
