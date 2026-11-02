import type { PillPlan } from '../logic';
import {
  draftOf,
  emptyDraft,
  hex6,
  legend,
  levelOf,
  monthCells,
  monthRange,
  perDay,
  planOf,
  rhythmText,
  shiftMonth,
  type RhythmWords,
} from '../pillsLogic';

const words: RhythmWords = {
  everyDay: 'every day',
  never: 'never',
  paused: 'paused',
  monthly: (d) => `on the ${d} of every month`,
  everyN: (n) => `every ${n} days`,
  until: (x) => `until ${x}`,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
};

const plan = (o: Partial<PillPlan> = {}): PillPlan => ({
  uuid: 'p1',
  name: 'Vitamin D',
  dose: '1 tablet',
  notes: '',
  color: '#B7A6D6',
  freq_type: 'daily',
  weekdays: '1111111',
  month_days: '',
  interval_days: 1,
  times: '08:00x1,20:00x2',
  start_date: '2026-11-01',
  end_date: null,
  is_active: 1,
  schedule_from: null,
  created_at: null,
  ...o,
});

describe('ritmo a parole', () => {
  it('ogni giorno con gli orari e le volte', () => {
    expect(rhythmText(plan(), words)).toBe('every day  ·  08:00, 20:00 ×2');
  });
  it('alcuni giorni della settimana', () => {
    expect(rhythmText(plan({ weekdays: '1010100', times: '09:00x1' }), words)).toBe(
      'mon, wed, fri  ·  09:00',
    );
    expect(rhythmText(plan({ weekdays: '0000000', times: '09:00x1' }), words)).toBe(
      'never  ·  09:00',
    );
  });
  it('mensile, ogni N giorni, fine e sospesa', () => {
    expect(
      rhythmText(plan({ freq_type: 'monthly', month_days: '1,15', times: '09:00x1' }), words),
    ).toBe('on the 1,15 of every month  ·  09:00');
    expect(
      rhythmText(
        plan({
          freq_type: 'interval',
          interval_days: 3,
          times: '09:00x1',
          end_date: '2026-12-31',
          is_active: 0,
        }),
        words,
      ),
    ).toBe('every 3 days  ·  09:00  ·  until 31/12  ·  paused');
  });
});

describe('calendario', () => {
  it('quante prese al giorno', () => {
    expect(perDay({ times: '08:00x1,20:00x2' })).toBe(3);
    expect(perDay({ times: '' })).toBe(1);
  });
  it('i colori: tutte, nessuna e le vie di mezzo (due sole)', () => {
    expect(levelOf(3, 3)).toBe('ok');
    expect(levelOf(0, 3)).toBe('no');
    expect(levelOf(1, 3)).toBe('low');
    expect(levelOf(2, 3)).toBe('high');
    expect(levelOf(2, 4)).toBe('low');
    expect(levelOf(0, 0)).toBe('none');
  });
  it('la legenda si scrive sulla terapia', () => {
    expect(legend(1).map((v) => v.level)).toEqual(['ok', 'no', 'wait']);
    expect(legend(2).map((v) => v.level)).toEqual(['ok', 'low', 'no', 'wait']);
    const l3 = legend(3);
    expect(l3.map((v) => v.level)).toEqual(['ok', 'low', 'high', 'no', 'wait']);
    expect(l3[1]!.counts).toEqual([1]);
    expect(legend(5)[1]!.counts).toEqual([1, 2]);
  });
  it('il mese comincia di lunedì', () => {
    // novembre 2026 comincia di domenica: sei caselle vuote prima
    const c = monthCells('2026-11');
    expect(c.slice(0, 6).every((x) => x.date === null)).toBe(true);
    expect(c[6]).toEqual({ date: '2026-11-01', day: 1 });
    expect(c).toHaveLength(6 + 30);
  });
  it('mesi vicini e estremi', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('modulo della terapia', () => {
  it('da terapia a modulo e ritorno', () => {
    const p = plan({ weekdays: '1010100', end_date: '2026-12-31' });
    const back = planOf(draftOf(p));
    expect(back).toMatchObject({
      name: 'Vitamin D',
      freq_type: 'daily',
      weekdays: '1010100',
      times: '08:00x1,20:00x2',
      start_date: '2026-11-01',
      end_date: '2026-12-31',
      interval_days: 1,
      is_active: true,
    });
  });
  it('il modulo vuoto parte da oggi con una presa alle 8', () => {
    const d = emptyDraft('2026-11-05');
    expect(planOf(d)).toMatchObject({
      times: '08:00x1',
      start_date: '2026-11-05',
      end_date: null,
      weekdays: '1111111',
    });
  });
  it('ogni N giorni resta fra 1 e 365', () => {
    const d = { ...emptyDraft('2026-11-05'), interval: '' };
    expect(planOf(d).interval_days).toBe(1);
    expect(planOf({ ...d, interval: '9999' }).interval_days).toBe(365);
  });
  it('i colori a tre cifre diventano a sei', () => {
    expect(hex6('#abc')).toBe('#aabbcc');
    expect(hex6('#B7A6D6')).toBe('#B7A6D6');
  });
});
