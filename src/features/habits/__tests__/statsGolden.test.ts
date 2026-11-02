import golden from './fixtures/golden.json';
import type { Habit, HabitLog } from '../logic';
import { addDays, isDue } from '../logic';
import {
  bestStreakOf,
  heatmap,
  monthCalendar,
  stateAt,
  streakOf,
  successAt,
  totalCheckins,
  windowStats,
  type Ctx,
  type LogMap,
} from '../stats';

/**
 * Test d'oro: stesse abitudini e stessi check-in, i numeri che il SITO mostra nella scheda di dettaglio
 * (serie, record, totali, completamento, calendario del mese, heatmap) devono uscire uguali da stats.ts.
 * Il «record» del sito è il più alto fra quello che si ricalcola e quello salvato dal server (best_streak,
 * che il telefono non riceve): qui si controlla lo stesso confronto.
 */

type G = typeof golden;
const habitOf = (r: G['habits'][number]): Habit => ({
  uuid: String(r.id),
  category_uuid: null,
  preset_key: r.preset_key || null,
  name: r.name,
  icon: r.icon,
  color: r.color,
  motivation: r.motivation || null,
  kind: r.kind as Habit['kind'],
  goal_type: r.goal_type as Habit['goal_type'],
  target_amount: r.target_amount,
  step_amount: r.step_amount,
  unit: r.unit,
  frequency_type: r.frequency_type as Habit['frequency_type'],
  weekdays: r.weekdays,
  times_per_week: r.times_per_week,
  times_per_month: r.times_per_month,
  interval_days: r.interval_days,
  day_part: r.day_part as Habit['day_part'],
  duration_type: r.duration_type as Habit['duration_type'],
  duration_days: r.duration_days,
  start_date: r.start_date,
  end_date: r.end_date,
  planner_minutes: null,
  is_archived: 0,
  sort_key: 'a0',
});

const today = golden.today;
const logsOf = (id: number): LogMap => {
  const m: LogMap = new Map();
  for (const l of golden.logs)
    if (l.habit_id === id)
      m.set(l.date, {
        uuid: 'x',
        habit_uuid: String(id),
        log_date: l.date,
        status: l.status as HabitLog['status'],
        amount: l.amount,
        completions: 1,
        target_amount: 1,
        note: null,
        mood: null,
      });
  return m;
};

describe('statistiche: uguali al sito', () => {
  test('il fixture ha abitudini di ogni tipo', () => {
    const kinds = new Set(golden.habits.map((h) => `${h.kind}/${h.frequency_type}/${h.goal_type}`));
    expect(kinds.size).toBeGreaterThanOrEqual(6);
  });

  for (const hr of golden.habits) {
    const exp = (golden.expected as Record<string, G['expected']['12']>)[String(hr.id)];
    if (!exp) continue;
    describe(`${hr.name} (${hr.kind}, ${hr.frequency_type}, ${hr.goal_type})`, () => {
      const h = habitOf(hr);
      const c: Ctx = { today, logs: logsOf(hr.id) };

      test('serie, record, totale, completamento', () => {
        expect(streakOf(h, c)).toBe(exp.streak);
        expect(Math.max(bestStreakOf(h, c), hr.best_streak ?? 0)).toBe(exp.best);
        expect(totalCheckins(c)).toBe(exp.total);
        expect(Math.round(windowStats(h, h.start_date, today, c).rate * 100)).toBe(exp.rate);
      });

      test('calendario del mese: stato, «prevista», futuro; riga «n su n nel mese»', () => {
        const ym = today.slice(0, 7);
        const cells = monthCalendar(h, ym, c).filter((x) => x !== null);
        expect(cells.length).toBe(Object.keys(exp.cells).length);
        for (const cell of cells) {
          const e = exp.cells[cell!.day as keyof typeof exp.cells] as [string, boolean, boolean];
          expect([cell!.state, cell!.due, cell!.future]).toEqual(e);
        }
        const monthEnd = today; // il mese corrente arriva fino a oggi
        const w = windowStats(h, `${ym}-01`, monthEnd, c);
        expect([w.ok, w.due, Math.round(w.rate * 100)]).toEqual([
          exp.monthOk,
          exp.monthDue,
          exp.monthPct,
        ]);
      });

      test('heatmap annuale: stesso livello in ogni giorno', () => {
        const weeks = heatmap(
          (d) => (isDue(h, d) ? (successAt(h, d, c) ? 1 : stateAt(h, d, c).pct) : 0),
          today,
        );
        let start = addDays(today, -363);
        // la griglia parte dal lunedì: ricalcoliamo i giorni in ordine
        while (new Date(`${start}T00:00:00Z`).getUTCDay() !== 1) start = addDays(start, -1);
        let n = 0;
        weeks.forEach((w, wi) =>
          w.levels.forEach((lvl, di) => {
            const day = addDays(start, wi * 7 + di);
            const want = (exp.heat as Record<string, number>)[day];
            if (want === undefined) return;
            n++;
            expect([day, lvl < 0 ? 0 : lvl]).toEqual([day, want]);
          }),
        );
        expect(n).toBeGreaterThan(300);
      });
    });
  }
});
