// Maison's 24-hour chart (#29 step 4, v32): history.js's model drawn as its
// own SVG in a sheet, where Recharts drew it until v32. The title and
// the legend's latest values head it, the plot follows, and Full history
// opens Home Assistant's own. Every word and accessible name comes from the
// model; each series is coloured by what it measures (its `role`), never by
// a new hue and never blue. The geometry is history-plot.js's, pure, so
// Energy's chart can reuse it in v33.
//
// Energy's power chart was this chart from v33 to v36, drawn bare in its
// widget; from v37 it is today's power from midnight, its own chart
// (day.jsx), which shares the drawn box's measuring (useDrawnBox) and the
// scrub's slop. This one draws only in a sheet, exactly as in v32.
//
// A pointer over the plot, or a finger drawn sideways across it, scrubs:
// the legend shows the values at the nearest recorded time, and the
// subtitle that time. A finger scrubs only from its first mostly sideways
// move of 6 px, so a tap or a scroll that starts on the chart never
// flickers it; the plot takes only horizontal drags (touch-action: pan-y),
// so a vertical swipe still scrolls the sheet, which cancels the scrub. It
// adds no focus stop: the plot's name and description say what it shows.
import {useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useCommand} from '../contexts.js';
import {Button} from '../ui/button.jsx';
import {useSheetPlacement} from '../ui/sheet.jsx';
import {tempColour} from '../ui/temp-scale.js';
import {BOXES, legendEntries, nearestRow, paintRef, plotLayout, roomPaint, scrubMarks, scrubTime, startsScrub} from './history-plot.js';

// The plot's lines, dots and a scrub's points, one group per series, which
// its paint class colours. A room reading's line takes the gradient, over a
// halo only a browser without light-dark() shows, and its dots and points
// their own reading's colour, which the stylesheet shades in light.
function Series({series, gradient, points}) {
  const room = series.paint === 'room';
  return <g className={`m-history__series m-history__series--${series.paint}`}>
    {room && series.lines.map(points => <polyline key={points} className="m-history__halo" points={points}/>)}
    {series.lines.map(points => <polyline key={points} className={series.dashed ? 'm-history__line m-history__line--dashed' : 'm-history__line'} points={points} style={room ? {stroke: gradient} : undefined}/>)}
    {series.dots.map(dot => <circle key={dot.index} className="m-history__dot" cx={dot.x} cy={dot.y} r="3" style={roomPaint(dot.room)}/>)}
    {points.map(point => <circle key={point.key} className="m-history__point" cx={point.x} cy={point.y} r="4.5" style={roomPaint(point.room)}/>)}
  </g>;
}

// The ready plot: gridlines and their values on the left, the round hours
// and the Now edge under it, then the series, the target under the reading,
// and while scrubbing the rule at the scrubbed time. Named by the model.
function Plot({layout, marks, id, label, describedBy}) {
  const {box, area, grid, hours, now, gradient, series} = layout;
  return <svg className="m-history__svg" role="img" aria-label={label} aria-describedby={describedBy} viewBox={`0 0 ${box.width} ${box.height}`}>
    {gradient && <defs><linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={gradient.y1} x2="0" y2={gradient.y2}>
      {gradient.stops.map(stop => <stop key={stop.offset} className="m-history__stop" offset={stop.offset} style={roomPaint(stop.colour)}/>)}
    </linearGradient></defs>}
    {grid.map(line => <g key={line.y}>
      <line className="m-history__grid" x1={area.left} x2={area.right} y1={line.y} y2={line.y}/>
      <text className="m-history__axis" x={area.left - 6} y={line.y + 4} textAnchor="end">{line.label}</text>
    </g>)}
    {hours.map(hour => <g key={hour.x}>
      <line className="m-history__hour" x1={hour.x} x2={hour.x} y1={area.top} y2={area.bottom}/>
      {hour.label && <text className="m-history__axis" x={hour.x} y={box.height - 6} textAnchor="middle">{hour.label}</text>}
    </g>)}
    <line className="m-history__now" x1={now.x} x2={now.x} y1={area.top} y2={area.bottom}/>
    <text className="m-history__axis" x={now.x} y={box.height - 6} textAnchor="end">{now.label}</text>
    {marks && <line className="m-history__rule" x1={marks.x} x2={marks.x} y1={area.top} y2={area.bottom}/>}
    {series.map(s => <Series key={s.key} series={s} gradient={paintRef(id)} points={marks ? marks.points.filter(point => point.key === s.key) : []}/>)}
  </svg>;
}

// The plot's drawn box in whole pixels, measured before the first paint
// and followed by a ResizeObserver, so the viewBox is as wide as the SVG is
// drawn and its 11px axis text stays 11px in any sheet on any phone; the
// fallback box (the placement's, or day.jsx's) until then, and on the
// server. It reads the layout size (clientWidth), which a sheet's opening
// scale doesn't shrink. Never under MIN_WIDTH, below which the plot would
// only scale down. The height is the fallback's, but a chart that fills its
// container (`fill`) takes the height it is given, never under the
// fallback's. `drawn` names what the node is (the model's status), so a new
// node is measured anew.
const MIN_WIDTH = 160;
export function useDrawnBox(ref, fallback, drawn, fill) {
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => {
      if (node.clientWidth <= 0) return;
      const width = Math.max(MIN_WIDTH, node.clientWidth), height = fill ? Math.max(fallback.height, node.clientHeight) : fallback.height;
      setSize(old => old?.width === width && old?.height === height ? old : {width, height});
    };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, drawn, fill, fallback.height]);
  return {width: size?.width ?? fallback.width, height: fill ? size?.height ?? fallback.height : fallback.height};
}

/**
 * A 24-hour chart.
 *
 * DOM: `section.m-history[data-box=bottom|center]` holding
 * - `header.m-history__header`: `h3.m-history__title` (model.title) and
 *   `p.m-history__subtitle` (model.subtitle; while scrubbing, the scrubbed
 *   time, formatHistoryTime's with the date);
 * - while ready, `dl.m-history__legend[aria-label=model.legendLabel]`, one
 *   `div.m-history__entry` per series (as the model's legend) holding `dt` (a
 *   `span.m-history__swatch.m-history__swatch--<paint>` (plus `--dashed`
 *   for the second probe; a room reading's in its value's colour) and the
 *   label) and `dd.m-num` (the latest value, as the page writes a reading: '19.8°',
 *   '48%'; while scrubbing, the value then, `model.interpolatedMark` first
 *   where it was not recorded then);
 * - the plot, by `model.status`:
 *   - ready: `div.m-history__plot` (touch-action: pan-y, no focus stop) >
 *     `svg.m-history__svg[role=img]` named by `model.imageLabel` (else
 *     `model.plotLabel`), `aria-describedby` the visually hidden
 *     `p.m-visually-hidden` holding `model.description` when there is one.
 *     Inside: `line.m-history__grid` and `text.m-history__axis` per value
 *     tick, `line.m-history__hour` and its label per round hour (every 6 h
 *     in `model.timeZone`), `line.m-history__now` and `model.nowLabel` at the
 *     right edge; then per series `g.m-history__series--<paint>` with a
 *     `polyline.m-history__line` per run (a gap between runs; a stepped
 *     series stepped), `circle.m-history__dot` per isolated point and, while
 *     scrubbing, `circle.m-history__point`, over
 *     `line.m-history__rule`. `width: 100%`, scaled uniformly, never wider
 *     than its container;
 *   - loading: `div.m-history__placeholder[role=status][aria-label=model.loadingLabel]`, still;
 *   - error: `p.m-history__state[role=alert]` (model.stateText);
 *   - empty: `p.m-history__state` (model.stateText);
 *   the placeholder and the state keep the plot's proportions;
 * - `p.m-history__note` (model.partialText) while `model.partial`;
 * - `button.m-button.m-button--plain.m-history__full`: a plain Button
 *   labelled `model.fullLabel`, named by `full.ariaLabel`, sending
 *   `full.intent`, disabled while `!full.enabled`.
 * The title and Full history stay in every state. The plot is as wide as
 * it is drawn (a ResizeObserver), so a viewBox unit is a pixel, and as tall
 * as its sheet's box: 164 in the bottom sheet, 216 in the centred form sheet
 * (useSheetPlacement(); outside a sheet, by the viewport). Before it is
 * measured, and on the server, it takes the box's width: 343 or 592.
 *
 * @param {object} props
 * @param {{model: object, full: {intent: object, enabled: boolean, ariaLabel?: string}}} props.value climate.js's Chart
 *   (history.js's model, series with `role`, `nowLabel`, and the Full history link).
 * @param {number} [props.scrubAt] For the gallery's specimen only: a row's timestamp to show as scrubbed.
 */
export function HistoryChart({value: {model, full}, scrubAt}) {
  const command = useCommand(), id = useId(), describedBy = useId(), plot = useRef(null), touch = useRef(null);
  const ready = model.status === 'ready', placement = useSheetPlacement();
  const box = useDrawnBox(plot, BOXES[placement], model.status, false);
  const [scrub, setScrub] = useState(scrubAt ?? null);
  const layout = useMemo(() => ready ? plotLayout(model, box) : null, [ready, model, box.width, box.height]);
  const row = layout && scrub !== null ? model.rows[nearestRow(model.rows, scrub)] : null;
  const entries = ready ? legendEntries(model, row) : [];
  // The time under a pointer at clientX, from the plot's drawn width, which
  // the SVG fills.
  const follow = event => {
    const rect = plot.current?.getBoundingClientRect();
    if (rect?.width) setScrub(layout.timeAt((event.clientX - rect.left) / rect.width * box.width));
  };
  const reset = () => setScrub(scrubAt ?? null);
  // A mouse scrubs as it moves. A finger is followed from where it came
  // down, and scrubs once startsScrub() says it is moving sideways; lifting
  // it, or the sheet taking it for a scroll (pointercancel), resets.
  const down = event => { if (event.pointerType === 'mouse') follow(event); else touch.current = {x: event.clientX, y: event.clientY, scrubbing: false}; };
  const move = event => {
    const start = touch.current;
    if (event.pointerType === 'mouse') return follow(event);
    if (start && !start.scrubbing) start.scrubbing = startsScrub(event.clientX - start.x, event.clientY - start.y);
    if (start?.scrubbing) follow(event);
  };
  const end = event => { if (event.pointerType !== 'mouse') touch.current = null; reset(); };
  // A legend swatch: its entry's paint, and a room reading's own colour.
  const swatch = ({series, paint, dashed}) => {
    const reading = row ? row[series.dataKey] / series.factor : series.latest;
    return {className: `m-history__swatch m-history__swatch--${paint}${dashed ? ' m-history__swatch--dashed' : ''}`,
      style: series.role === 'room' && Number.isFinite(reading) ? roomPaint(tempColour(reading)) : undefined};
  };
  // The plot's, the placeholder's and the state's height: the box's.
  const shape = {height: box.height};
  return <section className="m-history" data-box={placement}>
    <header className="m-history__header">
      <h3 className="m-history__title">{model.title}</h3>
      <p className="m-history__subtitle">{row ? scrubTime(model, row) : model.subtitle}</p>
    </header>
    {ready && <dl className="m-history__legend" aria-label={model.legendLabel}>
      {entries.map(entry => <div key={entry.key} className="m-history__entry">
        <dt><span {...swatch(entry)}/>{entry.label}</dt>
        <dd className="m-num">{entry.value}</dd>
      </div>)}
    </dl>}
    {ready ? <div className="m-history__plot" ref={plot} onPointerDown={down} onPointerMove={move} onPointerUp={event => event.pointerType !== 'mouse' && end(event)} onPointerCancel={end} onPointerLeave={end}>
      <Plot layout={layout} marks={row ? scrubMarks(model, layout, row) : null} id={id} label={model.imageLabel ?? model.plotLabel} describedBy={model.description ? describedBy : undefined}/>
      {model.description && <p className="m-visually-hidden" id={describedBy}>{model.description}</p>}
    </div> : model.status === 'loading' ? <div className="m-history__placeholder" role="status" aria-label={model.loadingLabel} style={shape}/>
      : <p className="m-history__state" role={model.status === 'error' ? 'alert' : undefined} style={shape}>{model.stateText}</p>}
    {model.partial && <p className="m-history__note">{model.partialText}</p>}
    <Button variant="plain" className="m-history__full" label={model.fullLabel} ariaLabel={full.ariaLabel} isDisabled={!full.enabled} onPress={() => command(full.intent)}/>
  </section>;
}
