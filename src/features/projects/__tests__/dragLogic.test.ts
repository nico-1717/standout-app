import {
  planDrop,
  reorderPlan,
  shiftFor,
  ownerAt,
  type PlanInput,
  type RowBox,
} from '../dragLogic';

// A (0-60), B (60-120) with a child B1 (120-180), C (180-240): all top level except B1
const boxes: RowBox[] = [
  { id: 'A', parent: null, top: 0, height: 60 },
  { id: 'B', parent: null, top: 60, height: 60 },
  { id: 'B1', parent: 'B', top: 120, height: 60 },
  { id: 'C', parent: null, top: 180, height: 60 },
];
const base = (over: Partial<PlanInput>): PlanInput => ({
  boxes,
  outside: [],
  drag: 'A',
  parent: null,
  blocked: new Set(['A']),
  y: 0,
  canReorder: true,
  ...over,
});

describe('planDrop', () => {
  test('the edge of a sibling reorders; the middle band means "inside" once held', () => {
    // top quarter of B: before B, so the slot is 0 among the others (B, C)
    expect(planDrop(base({ y: 62 }))).toEqual({ kind: 'slot', index: 0 });
    // bottom edge of C: after C
    expect(planDrop(base({ y: 238 }))).toEqual({ kind: 'slot', index: 2 });
    // middle of C
    expect(planDrop(base({ y: 210 }))).toEqual({ kind: 'nest', id: 'C', name: null, held: true });
  });

  test('over a row of another branch the drop goes inside at once', () => {
    expect(planDrop(base({ y: 150 }))).toEqual({ kind: 'nest', id: 'B1', name: null, held: false });
  });

  test('never inside itself, its descendants or the parent it already has', () => {
    const p = planDrop({
      ...base({ drag: 'B', parent: null, blocked: new Set(['B', 'B1']), y: 150 }),
    });
    expect(p.kind).toBe('slot');
    const own = planDrop(base({ drag: 'B1', parent: 'B', blocked: new Set(['B1']), y: 90 }));
    expect(own.kind).toBe('slot');
  });

  test('the label above the list takes the row to the first level, unless it is already there', () => {
    const outside = [{ id: 'P', name: 'Thesis', top: -40, height: 30 }];
    expect(planDrop(base({ outside, drag: 'B1', parent: 'B', y: -20 }))).toEqual({
      kind: 'nest',
      id: 'P',
      name: 'Thesis',
      held: false,
    });
    expect(planDrop(base({ outside, parent: 'P', y: -20 })).kind).toBe('none');
  });

  test('with a sorted (not manual) order nothing is reordered, but nesting still works', () => {
    expect(planDrop(base({ y: 238, canReorder: false })).kind).toBe('none');
    expect(planDrop(base({ y: 150, canReorder: false })).kind).toBe('nest');
    expect(reorderPlan(base({ canReorder: false }))).toEqual({ kind: 'none' });
  });
});

describe('shiftFor', () => {
  const blocks = [
    { id: 'A', top: 0, height: 60 },
    { id: 'B', top: 60, height: 120 },
    { id: 'C', top: 180, height: 60 },
  ];
  test('moving A after C slides B and C up by the height of A', () => {
    const m = shiftFor({ blocks, drag: 'A', index: 2 });
    expect(m.get('B')).toBe(-60);
    expect(m.get('C')).toBe(-60);
  });
  test('moving C to the top slides A and B down by the height of C', () => {
    const m = shiftFor({ blocks, drag: 'C', index: 0 });
    expect(m.get('A')).toBe(60);
    expect(m.get('B')).toBe(60);
  });
  test('staying in place moves nobody', () => {
    const m = shiftFor({ blocks, drag: 'B', index: 1 });
    expect([...m.values()].every((v) => v === 0)).toBe(true);
  });
});

test('ownerAt finds the sibling a deep row belongs to', () => {
  const parentOf = new Map<string, string | null>([
    ['A', null],
    ['B', null],
    ['B1', 'B'],
    ['B2', 'B1'],
  ]);
  expect(ownerAt('B2', parentOf, null)).toBe('B');
  expect(ownerAt('B', parentOf, null)).toBe('B');
  expect(ownerAt('B2', parentOf, 'B')).toBe('B1');
  expect(ownerAt('A', parentOf, 'B')).toBeNull();
});
