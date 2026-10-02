// Energy's chart (v37): today's power from midnight, drawn from energy.js's
// day model as Stocks draws a day: the day's frame fixed from midnight to
// midnight, the record growing across it and ending in a dot at now, the
// hours still to come left empty but for the rest of the solar forecast,
// dotted. Over it, as Health heads a chart, the day so far in three figures
// (Solar, Grid, Consumed), each named in its colour.
//
// Solar is a yellow curve over a gradient that fades toward zero. The house
// is one heavier curve in the label colour, and where it runs above solar's
// the space between them is indigo, fading too: what came from the grid.
// Where solar's curve runs above the house's, the yellow left over the line
// is what was exported, which needs no word of its own. Nothing goes below
// zero. Every colour is a token, and the geometry is day-plot.js's, pure.
//
// A pointer over the plot, or a finger drawn sideways across it, scrubs
// as the 24-hour chart's does (history.jsx): the figures show the half
// hour's means, and the line over them that half hour.
import {useId, useMemo, useRef, useState} from 'react';
import {useDrawnBox} from './history.jsx';
import {startsScrub} from './history-plot.js';
import {DAY_PLOT, DAY_WIDTH, dayFiguresAt, dayLayout, dayMarks, dayTime} from './day-plot.js';

// The plot's heights, for the page that draws the chart in a widget.
export {DAY_PLOT};

// The plot: the value lines and their labels at the right, the hours under
// it, then solar's fill, the grid's (the house's fill clipped to above
// solar's curve), solar's curve, the forecast, the house's curve, the dot
// at now and, while scrubbing, the rule and its points. Named by the model.
function Plot({layout, marks, id, label}) {
  const {box, area, grid, labelX, hours, solar, house, above, forecast, now, gradient} = layout;
  const ref = name => `url(#${id}-${name})`;
  const fade = name => <linearGradient id={`${id}-${name}`} gradientUnits="userSpaceOnUse" x1="0" y1={gradient.y1} x2="0" y2={gradient.y2}>
    <stop className={`m-power__stop m-power__stop--${name}`} offset="0"/><stop className={`m-power__stop m-power__stop--${name}-foot`} offset="1"/>
  </linearGradient>;
  return <svg className="m-power__svg" role="img" aria-label={label} viewBox={`0 0 ${box.width} ${box.height}`}>
    <defs>{fade('solar')}{fade('grid')}{above && <clipPath id={`${id}-above`}><path d={above}/></clipPath>}</defs>
    {grid.map(line => <g key={line.y}>
      <line className={line.label === '0' ? 'm-power__value m-power__value--zero' : 'm-power__value'} x1={area.left} x2={area.right} y1={line.y} y2={line.y}/>
      <text className="m-power__axis" x={labelX} y={line.y + 4}>{line.label}</text>
    </g>)}
    {hours.map(hour => <g key={hour.x}>
      {hour.x > area.left && <line className="m-power__hour" x1={hour.x} x2={hour.x} y1={area.top} y2={area.bottom}/>}
      <text className="m-power__axis" x={hour.x > area.left ? hour.x + 3 : hour.x} y={box.height - 6}>{hour.label}</text>
    </g>)}
    {solar.areas.map(d => <path key={d} className="m-power__fill" d={d} fill={ref('solar')}/>)}
    {above && <g clipPath={ref('above')}>{house.areas.map(d => <path key={d} className="m-power__fill" d={d} fill={ref('grid')}/>)}</g>}
    {solar.lines.map(d => <path key={d} className="m-power__line m-power__line--solar" d={d}/>)}
    {forecast && <path className="m-power__line m-power__line--forecast" d={forecast}/>}
    {house.lines.map(d => <path key={d} className="m-power__line m-power__line--house" d={d}/>)}
    {now && <circle className="m-power__now" cx={now.x} cy={now.y} r="5"/>}
    {marks && <line className="m-power__rule" x1={marks.x} x2={marks.x} y1={area.top} y2={area.bottom}/>}
    {marks?.points.map(point => <circle key={point.key} className={`m-power__point m-power__point--${point.key}`} cx={point.x} cy={point.y} r="5"/>)}
  </svg>;
}

// The step holding `timestamp`, or null outside the record.
const stepOf = (model, timestamp) => {
  const at = model.rows.findIndex(row => timestamp >= row.start && timestamp < row.end);
  return at < 0 ? null : at;
};

/**
 * Energy's chart: today's power from midnight.
 *
 * DOM: `section.m-power` holding
 * - `header.m-power__header`: `p.m-power__when` (`model.when`, 'Today'; while
 *   scrubbing, the half hour, '14:00–14:30', or `model.nowLabel` on the
 *   last), then `dl.m-power__figures`, a `div.m-power__figure.m-power__figure--<key>`
 *   per figure (solar, grid, house) holding `dt` (its label) and `dd.m-num`
 *   (its value, then `span.m-power__unit` with its unit after a space, none
 *   with '—'); at rest the model's day figures, while scrubbing the half
 *   hour's means (powerParts');
 * - the plot, by `model.status`:
 *   - ready: `div.m-power__plot` (touch-action: pan-y, no focus stop) >
 *     `svg.m-power__svg[role=img]` named by `model.imageLabel`. Inside: the
 *     two fades and the clip in `defs`; `line.m-power__value` per value tick
 *     (`--zero` on zero) with its `text.m-power__axis` at the right; per
 *     hour after midnight `line.m-power__hour`, and every hour's label;
 *     `path.m-power__fill` per solar run, then, clipped to above solar, per
 *     house run; `path.m-power__line--solar` per run, `--forecast` while there
 *     is one, `--house` per run; `circle.m-power__now` at the record's end;
 *     while scrubbing, `line.m-power__rule` and `circle.m-power__point--<key>`;
 *   - loading: `div.m-power__placeholder[role=status][aria-label=model.loadingLabel]`;
 *   - error or empty: `p.m-power__state.m-power__state--line` (`role=alert` in
 *     error), one footnote line; with `fill`, `div.m-power__blank`, the day's
 *     empty axes in the same named SVG with `p.m-power__state` over their
 *     upper half;
 *   the placeholder and the blank keep the plot's proportions;
 * - `p.m-power__note` (`model.partialText`) while `model.partial`.
 * The figures show in every state, since they are the meters' and not the
 * record's. The plot is as wide as it is drawn (a ResizeObserver), so a
 * viewBox unit is a pixel, `height` tall, DAY_WIDTH wide until measured and
 * on the server. With `fill` (the grid's xl widget) the section fills its
 * container, a flex column: the header and the note keep their height and
 * the plot takes the rest, `height` at least (an inline `min-height`).
 *
 * @param {object} props
 * @param {object} props.model energy.js's day model.
 * @param {number} [props.height] The plot's height, DAY_PLOT's; with `fill`, its least height.
 * @param {boolean} [props.fill=false] Fill the container, the plot taking what the rest leaves.
 * @param {number} [props.scrubAt] For the gallery's specimen only: a time to show as scrubbed.
 */
export function DayChart({model, height = DAY_PLOT.phone, fill = false, scrubAt}) {
  const id = useId(), plot = useRef(null), touch = useRef(null);
  const ready = model.status === 'ready';
  const box = useDrawnBox(plot, {width: DAY_WIDTH, height}, model.status, fill);
  const held = scrubAt === undefined ? null : stepOf(model, scrubAt);
  const [scrub, setScrub] = useState(held);
  const layout = useMemo(() => dayLayout(model, box), [model, box.width, box.height]);
  const index = ready && scrub !== null && scrub < model.rows.length ? scrub : null;
  const figures = index === null ? model.figures : dayFiguresAt(model, index);
  // The step under a pointer at clientX, from the plot's drawn width, which
  // the SVG fills.
  const follow = event => {
    const rect = plot.current?.getBoundingClientRect();
    if (rect?.width) setScrub(layout.stepAt((event.clientX - rect.left) / rect.width * box.width));
  };
  const reset = () => setScrub(held);
  // A mouse scrubs as it moves. A finger is followed from where it came
  // down, and scrubs once startsScrub() says it is moving sideways; lifting
  // it, or the page taking it for a scroll (pointercancel), resets.
  const down = event => { if (event.pointerType === 'mouse') follow(event); else touch.current = {x: event.clientX, y: event.clientY, scrubbing: false}; };
  const move = event => {
    const start = touch.current;
    if (event.pointerType === 'mouse') return follow(event);
    if (start && !start.scrubbing) start.scrubbing = startsScrub(event.clientX - start.x, event.clientY - start.y);
    if (start?.scrubbing) follow(event);
  };
  const end = event => { if (event.pointerType !== 'mouse') touch.current = null; reset(); };
  const shape = fill ? {minHeight: height} : {height: box.height};
  const alert = model.status === 'error' ? 'alert' : undefined;
  return <section className={fill ? 'm-power m-power--fill' : 'm-power'}>
    <header className="m-power__header">
      <p className="m-power__when">{index === null ? model.when : dayTime(model, index)}</p>
      <dl className="m-power__figures">{figures.map(figure => <div key={figure.key} className={`m-power__figure m-power__figure--${figure.key}`}>
        <dt>{figure.label}</dt>
        <dd className="m-num">{figure.value}{figure.unit && <span className="m-power__unit"> {figure.unit}</span>}</dd>
      </div>)}</dl>
    </header>
    {ready ? <div className="m-power__plot" ref={plot} style={fill ? shape : undefined} onPointerDown={down} onPointerMove={move}
      onPointerUp={event => event.pointerType !== 'mouse' && end(event)} onPointerCancel={end} onPointerLeave={end}>
      <Plot layout={layout} marks={index === null ? null : dayMarks(model, layout, index)} id={id} label={model.imageLabel}/>
    </div> : model.status === 'loading' ? <div className="m-power__placeholder" role="status" aria-label={model.loadingLabel} style={shape}/>
      : fill ? <div className="m-power__blank" ref={plot} style={shape}>
        <Plot layout={layout} marks={null} id={id} label={model.imageLabel}/>
        <p className="m-power__state" role={alert}>{model.stateText}</p>
      </div>
      : <p className="m-power__state m-power__state--line" role={alert}>{model.stateText}</p>}
    {model.partial && <p className="m-power__note">{model.partialText}</p>}
  </section>;
}
