// What the 24-hour chart (charts/history-plot.js) formats beside its
// model (#27): the time axis and a hovered point's time, the points with no
// neighbour (drawn as dots, or they would not show), and a hovered value in
// history.js's format. Every other phrase the chart shows comes from the
// model history.js builds. The bundle imports no rule module, so the value
// format is history.js's, copied; a node test keeps the two equal.

/** A hovered value, formatted exactly as history.js formats the legend's. */
export function formatHistoryValue(value, unit = '') {
  if (!Number.isFinite(value)) return 'Unavailable';
  const formatted = new Intl.NumberFormat('en-GB', {maximumFractionDigits: 2}).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/** Return finite samples that would otherwise be invisible as one-point runs. */
export function isolatedPointIndices(rows, dataKey) {
  const values = Array.isArray(rows) ? rows : [];
  return new Set(values.flatMap((row, index) => {
    if (!Number.isFinite(row?.[dataKey])) return [];
    const before = index > 0 && Number.isFinite(values[index - 1]?.[dataKey]);
    const after = index + 1 < values.length && Number.isFinite(values[index + 1]?.[dataKey]);
    return before || after ? [] : [index];
  }));
}

export function formatHistoryTime(value, timeZone, includeDate = false) {
  const format = zone => new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    ...(includeDate ? {weekday: 'short', day: 'numeric', month: 'short'} : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
  // An unknown time zone falls back to UTC rather than stopping the chart.
  try { return format(timeZone); } catch { return format('UTC'); }
}
