import { applyPreset, formFromHabit, newForm, toInput, toPatch, validate } from '../formModel';
import type { Habit } from '../logic';
import { dictKey, presets, units } from '../presets';

const t = ((k: string) => k) as never; // un «t» che non traduce: restano i testi del file

const habit: Habit = {
  uuid: 'h',
  category_uuid: null,
  preset_key: null,
  name: 'Acqua',
  icon: '💧',
  color: '#32ADE6',
  motivation: null,
  kind: 'build',
  goal_type: 'quantity',
  target_amount: 8,
  step_amount: 1,
  unit: 'bicchieri',
  frequency_type: 'daily',
  weekdays: '1111111',
  times_per_week: 4,
  times_per_month: 12,
  interval_days: 2,
  day_part: 'any',
  duration_type: 'forever',
  duration_days: null,
  start_date: '2026-11-01',
  end_date: null,
  planner_minutes: null,
  is_archived: 0,
  sort_key: 'a0',
};

describe('modulo abitudine', () => {
  it('un modulo nuovo senza nome non si salva; col nome sì', () => {
    const f = newForm('2026-11-02', '#7C5CFF');
    expect(validate(f)).toEqual(['name']);
    expect(validate({ ...f, name: 'Leggere' })).toEqual([]);
  });

  it("regole del server: almeno un giorno, quantità > 0, «fino al» dopo l'inizio, minuti interi", () => {
    const f = { ...newForm('2026-11-02', '#7C5CFF'), name: 'x' };
    expect(validate({ ...f, weekdays: '0000000' })).toEqual(['weekdays']);
    expect(validate({ ...f, weekdays: '0000000', frequency_type: 'weekly' })).toEqual([]); // i giorni contano solo per le giornaliere
    expect(validate({ ...f, goal_type: 'quantity', target: '0', step: 'abc' })).toEqual([
      'target',
      'step',
    ]);
    expect(validate({ ...f, goal_type: 'quantity', target: '2,5' })).toEqual([]);
    expect(validate({ ...f, duration_type: 'end_date' })).toEqual(['end_date']);
    expect(validate({ ...f, duration_type: 'end_date', end_date: '2026-11-01' })).toEqual([
      'end_date',
    ]);
    expect(validate({ ...f, duration_type: 'end_date', end_date: '2026-11-02' })).toEqual([]);
    expect(validate({ ...f, planner_minutes: '12.5' })).toEqual(['planner_minutes']);
    expect(validate({ ...f, planner_minutes: '45' })).toEqual([]);
  });

  it('toInput: la quantità solo se «a quantità»; la durata solo se serve', () => {
    const f = { ...newForm('2026-11-02', '#7C5CFF'), name: '  Leggere  ' };
    const a = toInput(f);
    expect(a).toMatchObject({ name: 'Leggere', goal_type: 'completion', planner_minutes: null });
    expect(a).not.toHaveProperty('target_amount');
    expect(a).not.toHaveProperty('duration_days');
    const b = toInput({
      ...f,
      goal_type: 'quantity',
      target: '2,5',
      step: '0.5',
      unit: 'km',
      duration_type: 'days',
      duration_days: 10,
      planner_minutes: '30',
    });
    expect(b).toMatchObject({
      target_amount: 2.5,
      step_amount: 0.5,
      unit: 'km',
      duration_days: 10,
      planner_minutes: 30,
    });
  });

  it('toPatch manda solo i campi cambiati', () => {
    const f = formFromHabit(habit);
    expect(toPatch(habit, f)).toEqual({});
    expect(toPatch(habit, { ...f, name: 'Bere', color: '#FF3B30' })).toEqual({
      name: 'Bere',
      color: '#FF3B30',
    });
    // da quantità a «completata»: i numeri non si mandano (il repo li rimette a 1)
    const p = toPatch(habit, { ...f, goal_type: 'completion' });
    expect(p).toEqual({ goal_type: 'completion' });
  });

  it('toPatch: la durata «N giorni» riporta anche i giorni; «per sempre» non manda duration_days', () => {
    const f = formFromHabit(habit);
    expect(toPatch(habit, { ...f, duration_type: 'days', duration_days: 21 })).toMatchObject({
      duration_type: 'days',
      duration_days: 21,
    });
    expect(toPatch(habit, { ...f, duration_type: 'forever' })).toEqual({});
  });

  it('un preset riempie il modulo e trova la categoria dallo slug', () => {
    const list = presets(t);
    expect(list.length).toBeGreaterThan(40);
    const water = list.find((p) => p.key === 'drink_water')!;
    const f = applyPreset(newForm('2026-11-02', '#7C5CFF'), water, [
      { uuid: 'cat-health', slug: 'health' },
    ]);
    expect(f).toMatchObject({
      preset_key: 'drink_water',
      category_uuid: 'cat-health',
      goal_type: 'quantity',
      target: '8',
      step: '1',
      kind: 'build',
    });
    const weekly = list.find((p) => p.frequency.type === 'weekly')!;
    expect(applyPreset(newForm('x', '#fff'), weekly, []).times_per_week).toBe(
      weekly.frequency.times_per_week,
    );
  });

  it('le chiavi del dizionario seguono la regola del sito', () => {
    expect(dictKey('Creatività')).toBe('creativita');
    expect(dictKey('Salute e corpo')).toBe('salute_e_corpo');
    expect(dictKey('€')).toBe('x');
    expect(units(t)).toContain('bicchieri');
  });
});
