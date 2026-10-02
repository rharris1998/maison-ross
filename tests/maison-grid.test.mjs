// The widget grid's placer (#29 step 4): where ui/grid.js's placeWidgets()
// puts each widget from 700px, as CSS grid's sparse row-major placement
// would, and which cells it leaves empty. WidgetGrid draws exactly these
// placements, so a grid with no holes here is a page whose rows all fill.
// The six Today compositions of contract §3.9 (Needs you absent or medium ×
// Coming up absent, medium or large, with Climate sized by the rule) fill
// every row at two and four columns. grid.js has no React, so Node imports it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {COLUMNS, SIZES, placeWidgets} from '../frontend/maison/src/ui/grid.js';

// A placement as 'id c{column}+{columnSpan} r{row}+{rowSpan}', and a hole as 'c{column} r{row}'.
const at = ({id, column, row, columnSpan, rowSpan}) => `${id} c${column}+${columnSpan} r${row}+${rowSpan}`;
const cell = ({column, row}) => `c${column} r${row}`;
const place = (sizes, columns) => placeWidgets(sizes.map((size, i) => ({id: `w${i}`, size})), columns);

test('the sizes are small 1×1, medium 2×1, large 2×2 and xl 4×2; wide has two columns and desktop four', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(SIZES)), {small: [1, 1], medium: [2, 1], large: [2, 2], xl: [4, 2]});
  assert.deepEqual({...COLUMNS}, {wide: 2, desktop: 4});
  assert.ok(Object.isFrozen(SIZES) && Object.isFrozen(SIZES.large) && Object.isFrozen(COLUMNS));
});

test('each size alone spans its columns and rows from the first cell, and the rest of its rows are holes', () => {
  const alone = size => {const {placements, rows, holes} = place([size], 4); return [at(placements[0]), rows, holes.map(cell)];};
  assert.deepEqual(alone('small'), ['w0 c1+1 r1+1', 1, ['c2 r1', 'c3 r1', 'c4 r1']]);
  assert.deepEqual(alone('medium'), ['w0 c1+2 r1+1', 1, ['c3 r1', 'c4 r1']]);
  assert.deepEqual(alone('large'), ['w0 c1+2 r1+2', 2, ['c3 r1', 'c4 r1', 'c3 r2', 'c4 r2']]);
  assert.deepEqual(alone('xl'), ['w0 c1+4 r1+2', 2, []]);
  assert.deepEqual(placeWidgets([], 4), {placements: [], rows: 0, holes: []}, 'nothing placed, no rows and no holes');
});

test('spans are clamped to the columns there are, and an unknown size is small', () => {
  assert.deepEqual(place(['xl', 'large', 'medium'], 2).placements.map(at), ['w0 c1+2 r1+2', 'w1 c1+2 r3+2', 'w2 c1+2 r5+1']);
  assert.deepEqual(place(['medium', 'large', 'small'], 1).placements.map(at), ['w0 c1+1 r1+1', 'w1 c1+1 r2+2', 'w2 c1+1 r4+1']);
  assert.deepEqual(place(['medium'], 0).placements.map(at), ['w0 c1+1 r1+1'], 'at least one column');
  assert.deepEqual(place(['huge', undefined], 4).placements.map(at), ['w0 c1+1 r1+1', 'w1 c2+1 r1+1']);
});

test('placement is row-major and in order, keeping each id', () => {
  const {placements, rows, holes} = place(['small', 'small', 'medium', 'medium', 'small'], 4);
  assert.deepEqual(placements.map(at), ['w0 c1+1 r1+1', 'w1 c2+1 r1+1', 'w2 c3+2 r1+1', 'w3 c1+2 r2+1', 'w4 c3+1 r2+1']);
  assert.deepEqual([rows, holes.map(cell)], [2, ['c4 r2']]);
});

// CSS's sparse placement never goes back: a gap an earlier widget leaves
// stays a gap, even when a later one would fit it (grid-auto-flow: dense
// would fill it; Maison never uses dense, so the order is the reading order).
test('the cursor never moves back, so a gap left behind stays a hole', () => {
  const two = place(['small', 'large', 'small'], 2);
  assert.deepEqual(two.placements.map(at), ['w0 c1+1 r1+1', 'w1 c1+2 r2+2', 'w2 c1+1 r4+1']);
  assert.deepEqual([two.rows, two.holes.map(cell)], [4, ['c2 r1', 'c2 r4']]);
  const four = place(['small', 'medium', 'medium', 'small'], 4);
  assert.deepEqual(four.placements.map(at), ['w0 c1+1 r1+1', 'w1 c2+2 r1+1', 'w2 c1+2 r2+1', 'w3 c3+1 r2+1'], 'c4 r1 is passed over');
  assert.deepEqual(four.holes.map(cell), ['c4 r1', 'c4 r2']);
  // A large widget's second row is taken: the next widget in that row goes past it.
  const beside = place(['large', 'small', 'small', 'small', 'small', 'medium'], 4);
  assert.deepEqual(beside.placements.map(at), ['w0 c1+2 r1+2', 'w1 c3+1 r1+1', 'w2 c4+1 r1+1', 'w3 c3+1 r2+1', 'w4 c4+1 r2+1', 'w5 c1+2 r3+1']);
  assert.deepEqual(beside.holes.map(cell), ['c3 r3', 'c4 r3']);
});

test('holes are every empty cell above the last row’s bottom, row by row', () => {
  const {rows, holes} = place(['small', 'large', 'small'], 4);
  assert.deepEqual([rows, holes.map(cell)], [2, ['c1 r2', 'c4 r2']], 'under the smalls, beside the large one');
  const ragged = place(['small', 'large', 'medium'], 4);
  assert.deepEqual([ragged.rows, ragged.holes.map(cell)], [3, ['c4 r1', 'c1 r2', 'c4 r2', 'c3 r3', 'c4 r3']], 'the medium one wraps past the large one');
  assert.deepEqual(place(['medium', 'medium'], 4).holes, [], 'a full row has none');
});

// ---- Today's six compositions (contract §3.9) --------------------------------
// Today's widgets in order, each absent one left out: Needs you medium or
// absent; the Car and the live power small; Climate large when the cells Needs
// you and Coming up cover (medium 2, large 4, absent 0) make a multiple of four,
// else medium; Coming up absent, medium or large; Energy today medium.
const CELLS = {medium: 2, large: 4};
function today(needs, upcoming) {
  const covered = (needs ? CELLS[needs] : 0) + (upcoming ? CELLS[upcoming] : 0);
  return [needs && {id: 'needs', size: needs}, {id: 'car', size: 'small'}, {id: 'live', size: 'small'},
    {id: 'climate', size: covered % 4 === 0 ? 'large' : 'medium'}, upcoming && {id: 'upcoming', size: upcoming}, {id: 'energyToday', size: 'medium'}].filter(Boolean);
}
const CASES = [null, 'medium'].flatMap(needs => [null, 'medium', 'large'].map(upcoming => [needs, upcoming]));

test('Climate’s size makes each of Today’s six compositions', () => {
  assert.equal(CASES.length, 6);
  assert.deepEqual(CASES.map(([needs, upcoming]) => `${needs ?? '—'} ${upcoming ?? '—'} → ${today(needs, upcoming).find(w => w.id === 'climate').size}`),
    ['— — → large', '— medium → medium', '— large → large', 'medium — → medium', 'medium medium → large', 'medium large → medium']);
});

for (const [name, columns] of Object.entries(COLUMNS)) {
  test(`every row fills in each of Today’s six compositions at ${columns} columns (${name})`, () => {
    for (const [needs, upcoming] of CASES) {
      const widgets = today(needs, upcoming), {placements, rows, holes} = placeWidgets(widgets, columns);
      const where = `needs ${needs ?? 'absent'}, upcoming ${upcoming ?? 'absent'}: ${placements.map(at).join(', ')}`;
      assert.deepEqual(holes, [], where);
      assert.deepEqual(placements.map(p => p.id), widgets.map(w => w.id), `${where}: in the value's order`);
      const cells = placements.reduce((sum, p) => sum + p.columnSpan * p.rowSpan, 0);
      assert.equal(cells, rows * columns, `${where}: the widgets cover the rows exactly`);
    }
  });
}

test('on a desktop, Needs you and a large Coming up sit beside a large Climate, and Energy today closes the last row', () => {
  assert.deepEqual(placeWidgets(today('medium', 'medium'), 4).placements.map(at),
    ['needs c1+2 r1+1', 'car c3+1 r1+1', 'live c4+1 r1+1', 'climate c1+2 r2+2', 'upcoming c3+2 r2+1', 'energyToday c3+2 r3+1']);
  assert.deepEqual(placeWidgets(today(null, 'large'), 4).placements.map(at),
    ['car c1+1 r1+1', 'live c2+1 r1+1', 'climate c3+2 r1+2', 'upcoming c1+2 r2+2', 'energyToday c3+2 r3+1']);
});
