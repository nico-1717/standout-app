import { checklistData, tableConfig, tableData } from '../blocks';
import { evaluate } from '../formula';
import { BLIND75_PROBLEMS, STREAK_DAYS, templateBlock } from '../templates';

describe('Programming templates', () => {
  test('Blind 75 is a checklist of exactly 75 different problems, none done', () => {
    expect(BLIND75_PROBLEMS).toHaveLength(75);
    expect(new Set(BLIND75_PROBLEMS).size).toBe(75);
    const b = templateBlock('blind75');
    expect(b.kind).toBe('checklist');
    const items = checklistData(b.data).items;
    expect(items).toHaveLength(75);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(75);
    expect(items[0]?.text).toBe('Two Sum (Array)');
  });

  test('the daily streak table counts the days with minutes and adds them up', () => {
    const b = templateBlock('streak');
    expect(b.kind).toBe('table');
    const cfg = tableConfig(b.config);
    expect(cfg.cols).toBe(4);
    expect(cfg.rows).toBe(STREAK_DAYS + 1);
    const cells = { ...tableData(b.data).cells, D1: '30', D2: '45', B1: 'Two Sum' };
    const v = evaluate(cells);
    expect(v[`B${STREAK_DAYS + 1}`]).toBe(2);
    expect(v[`D${STREAK_DAYS + 1}`]).toBe(75);
  });
});
