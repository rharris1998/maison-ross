// Maison's segmented bar and its legend (#29 step 4): shares of one whole
// side by side, such as today's energy used at home, exported and taken from
// the grid, with a dot and a line per share under it. A bar with nothing to
// split is empty two ways, which must never look alike: a missing reading
// leaves it dashed, and its legend says "—"; a real zero (nothing generated
// or used yet) is a plain solid track. Both are images of what the value
// already says in words: the bar is named by the value's ariaLabel, and the
// legend's dots are hidden.

/**
 * A segmented bar.
 *
 * DOM: `div.m-segment-bar[role=img][aria-label]`, 10px high, radius 5,
 * 2px gaps, holding a `span.m-segment-bar__segment.m-tone-{tone}` per
 * segment, in order, grown by its `share` (inline flex-grow) and filled with
 * its tone; a share too small to see keeps 2px. With no segments it is
 * `.m-segment-bar--empty`, a dashed empty track (`empty='missing'`), or
 * `.m-segment-bar--zero`, a solid gray one (`empty='zero'`).
 *
 * @param {object} props
 * @param {{key: string, tone: string, share: number}[]} props.segments Shares of their sum, 0–1.
 * @param {string} props.ariaLabel The whole bar in words, from the value.
 * @param {'missing'|'zero'} [props.empty='missing'] Why a bar with no segments is empty: a reading
 *   is missing, or every reading is a real 0.
 */
export function SegmentBar({segments, ariaLabel, empty = 'missing'}) {
  const kind = segments.length ? '' : empty === 'zero' ? ' m-segment-bar--zero' : ' m-segment-bar--empty';
  return <div className={`m-segment-bar${kind}`} role="img" aria-label={ariaLabel}>
    {segments.map(({key, tone, share}) => <span key={key} className={`m-segment-bar__segment m-tone-${tone}`} style={{flexGrow: share}}/>)}
  </div>;
}

/**
 * A legend: a tone dot and its text per item, wrapping.
 *
 * DOM: `ul.m-legend`, footnote in --m-label-2, holding `li.m-legend__item`
 * per item: `span.m-legend__dot.m-tone-{tone}[aria-hidden=true]`, then the
 * text.
 *
 * @param {object} props
 * @param {{tone: string, text: string}[]} props.items Visible text, from the value.
 */
export function Legend({items}) {
  return <ul className="m-legend">
    {items.map(({tone, text}, i) => <li key={`${i}-${text}`} className="m-legend__item"><span className={`m-legend__dot m-tone-${tone}`} aria-hidden="true"/>{text}</li>)}
  </ul>;
}
