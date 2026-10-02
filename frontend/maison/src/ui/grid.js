// Where each widget sits in the widget grid from 700px (#29 step 4), with no
// React, so the Node tests can import it. WidgetGrid (widget.jsx) places its
// children with placeWidgets() as inline grid lines, rather than leaving it to
// the browser's auto-placement, so the grid a test checks for holes is the
// grid the page draws. The value (today.js) picks each widget's size so that
// every row fills; tests/maison-grid.test.mjs holds the placer to CSS's
// own sparse row-major placement.

/** Each size as [columns, rows] it spans. */
export const SIZES = Object.freeze({small: Object.freeze([1, 1]), medium: Object.freeze([2, 1]), large: Object.freeze([2, 2]), xl: Object.freeze([4, 2])});
/** The grid's columns in each layout from 700px; a phone stacks and has none. */
export const COLUMNS = Object.freeze({wide: 2, desktop: 4});

// A size's spans, the columns clamped to the grid's; an unknown size is small.
const spansOf = (size, columns) => {
  const [columnSpan, rowSpan] = SIZES[size] ?? SIZES.small;
  return [Math.min(columnSpan, columns), rowSpan];
};

/**
 * Places widgets in `columns` columns as CSS grid's sparse auto-placement
 * does (`grid-auto-flow: row`): row-major, in order, a cursor that moves
 * forward and never back-fills a gap an earlier widget left. Lines and cells
 * are 1-based, as CSS numbers them, so a placement reads straight into
 * `grid-column: {column} / span {columnSpan}`.
 *
 * - placements: one per item, in the items' order.
 * - rows: how many rows the widgets reach (0 for none).
 * - holes: every empty cell above the last row's bottom, row by row; none
 *   means every row fills.
 *
 * @param {{id: string, size: 'small'|'medium'|'large'|'xl'}[]} items
 * @param {number} columns At least 1; spans wider than it are clamped to it.
 * @returns {{placements: {id: string, column: number, row: number, columnSpan: number, rowSpan: number}[], rows: number, holes: {column: number, row: number}[]}}
 */
export function placeWidgets(items, columns) {
  const width = Math.max(1, Math.floor(columns) || 1), taken = new Set(), cell = (column, row) => `${column},${row}`;
  const free = (column, row, columnSpan, rowSpan) => {
    for (let r = row; r < row + rowSpan; r += 1) for (let c = column; c < column + columnSpan; c += 1) if (taken.has(cell(c, r))) return false;
    return true;
  };
  let cursor = {column: 1, row: 1}, rows = 0;
  const placements = items.map(({id, size}) => {
    const [columnSpan, rowSpan] = spansOf(size, width);
    let {column, row} = cursor;
    // Forward along the row, then to the next row's start: never back.
    while (column + columnSpan - 1 > width || !free(column, row, columnSpan, rowSpan)) {
      if (column + columnSpan - 1 > width) {row += 1; column = 1;} else column += 1;
    }
    for (let r = row; r < row + rowSpan; r += 1) for (let c = column; c < column + columnSpan; c += 1) taken.add(cell(c, r));
    cursor = {column: column + columnSpan, row};
    rows = Math.max(rows, row + rowSpan - 1);
    return {id, column, row, columnSpan, rowSpan};
  });
  const holes = [];
  for (let row = 1; row <= rows; row += 1) for (let column = 1; column <= width; column += 1) if (!taken.has(cell(column, row))) holes.push({column, row});
  return {placements, rows, holes};
}
