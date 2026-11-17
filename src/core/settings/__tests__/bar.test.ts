import { BAR_IDS, DEFAULT_BAR, barLayout, barSections, cleanBar, moveBar } from '../bar';

describe('bottom bar preferences', () => {
  test('by default Home and Planner are pinned and every other page is shown', () => {
    const { pinned, scroll } = barLayout(DEFAULT_BAR);
    expect(pinned).toEqual(['home', 'planner']);
    expect(scroll).toEqual(BAR_IDS.filter((id) => id !== 'home' && id !== 'planner'));
  });

  test('unknown ids go away, missing ones are added at the end, Altro is never hidden', () => {
    const bar = cleanBar({
      order: ['grades', 'nope', 'home'],
      pinned: ['x', 'grades'],
      hidden: ['settings', 'diary'],
    });
    expect(bar.order.slice(0, 2)).toEqual(['grades', 'home']);
    expect(bar.order).toHaveLength(BAR_IDS.length);
    expect(bar.pinned).toEqual(['grades']);
    expect(bar.hidden).toEqual(['diary']);
  });

  test('garbage gives the default', () => {
    expect(cleanBar(null)).toEqual(DEFAULT_BAR);
    expect(cleanBar('x')).toEqual(DEFAULT_BAR);
  });

  test('pin, hide and shift', () => {
    let bar = moveBar(DEFAULT_BAR, { kind: 'pin', id: 'todo', on: true });
    expect(barLayout(bar).pinned).toEqual(['home', 'planner', 'todo']);
    bar = moveBar(bar, { kind: 'hide', id: 'todo', on: true });
    expect(barLayout(bar).pinned).toEqual(['home', 'planner']);
    expect(barSections(bar).hidden).toEqual(['todo']);
    bar = moveBar(bar, { kind: 'hide', id: 'todo', on: false });
    expect(barSections(bar).hidden).toEqual([]);
    bar = moveBar(DEFAULT_BAR, { kind: 'shift', id: 'planner', by: -1 });
    expect(barLayout(bar).pinned).toEqual(['planner', 'home']);
    // il primo non sale, e «Altro» non si nasconde
    expect(moveBar(bar, { kind: 'shift', id: 'planner', by: -1 })).toEqual(bar);
    expect(moveBar(bar, { kind: 'hide', id: 'settings', on: true })).toEqual(bar);
  });
});
