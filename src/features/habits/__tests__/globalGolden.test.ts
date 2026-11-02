import golden from './fixtures/golden.json';
import global from './fixtures/goldenGlobal.json';
import {
  allLogsOf,
  categoryRows,
  ctxFor,
  ranking,
  statCards,
  tableRow,
  weekGrid,
} from '../globalStats';
import { addDays, dayProgress, type Habit, type HabitLog } from '../logic';

/**
 * Test d'oro (parte 2): carosello, Statistiche e Vista tabella calcolati da globalStats.ts devono dare
 * gli stessi numeri che il sito mostra sugli stessi dati. Il «record» del sito include anche il valore
 * salvato dal server (best_streak), come nella parte 1.
 */

const today = golden.today;
const habits: Habit[] = golden.habits.map((r) => ({
  uuid: String(r.id),
  category_uuid: r.category_id ? String(r.category_id) : null,
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
}));
const logs: HabitLog[] = golden.logs.map((l) => ({
  uuid: 'x',
  habit_uuid: String(l.habit_id),
  log_date: l.date,
  status: l.status as HabitLog['status'],
  amount: l.amount,
  completions: 1,
  target_amount: 1,
  note: null,
  mood: null,
}));
const all = allLogsOf(logs);
const ctxOf = ctxFor(all, today);
const bestFromServer = Math.max(...golden.habits.map((h) => h.best_streak ?? 0));

describe('statistiche generali: uguali al sito', () => {
  test('le sette carte del carosello', () => {
    const cards = statCards(habits, all, today, today, 'novembre');
    expect(cards.map((c) => c.key)).toEqual(global.cards.map((c) => c.key));
    for (const exp of global.cards) {
      const c = cards.find((x) => x.key === exp.key)!;
      const value = exp.key === 'best' ? Math.max(c.value, bestFromServer) : c.value;
      expect([exp.key, value, c.suffix]).toEqual([exp.key, exp.value, exp.suffix]);
    }
  });

  test('gli indicatori della scheda Statistiche', () => {
    const cards = statCards(habits, all, today, today, 'novembre');
    const by = Object.fromEntries(cards.map((c) => [c.key, c]));
    const p = dayProgress(habits, today, all, today);
    const [streak, oggi, mese, sempre] = global.kpis.map((k) => k[0]);
    expect(`${by.streak!.value}gg`).toBe(streak);
    expect(`${p.done}/${p.total}`).toBe(oggi);
    expect(String(by.month!.value)).toBe(mese);
    expect(String(by.total!.value)).toBe(sempre);
  });

  test('«Settimana per abitudine»', () => {
    const rows = weekGrid(habits, today, ctxOf);
    expect(rows.length).toBe(global.weekGrid.length);
    rows.forEach((r, i) => {
      const exp = global.weekGrid[i]!;
      expect(`${r.habit.icon} ${r.habit.name}`).toBe(exp[0]);
      expect(r.cells).toEqual(exp[1]);
    });
  });

  for (const n of [7, 14, 30] as const) {
    const exp = global.table[String(n) as '7'];
    test(`Vista tabella, ${n} giorni: celle, percentuali, riga «Giornata»`, () => {
      const dates = Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
      habits.forEach((h, i) => {
        const r = tableRow(h, dates, ctxOf);
        expect(r.cells).toEqual(exp.rows[i]![1]);
        expect(`${r.pct}%`).toBe(exp.rows[i]![2]);
      });
      const foot = dates.map((d) => {
        const p = dayProgress(habits, d, all, today);
        return p.total ? String(Math.round(p.pct * 100)) : '–';
      });
      expect(foot).toEqual(exp.foot.slice(1, 1 + n));
    });

    test(`Classifica, ${n} giorni`, () => {
      const rows = ranking(habits, n, ctxOf, today).map((r) => [
        `${r.habit.icon} ${r.habit.name}`,
        `${Math.round(r.rate * 100)}%`,
      ]);
      expect(rows).toEqual(exp.rank);
    });
  }

  test('«Per categoria»: completate/previste', () => {
    const cats = new Map(
      global.categories.categories.map((c) => [String(c.id), { name: c.name, color: c.color }]),
    );
    const rows = categoryRows(habits, 30, ctxOf, today, cats, 'Senza categoria');
    expect(rows.map((r) => `${r.ok}/${r.due}`).sort()).toEqual(
      global.categoryRows
        .map((r) => r[1])
        .filter((v) => v.includes('/')) // le righe con «%» sono la classifica, che sta sotto
        .sort(),
    );
  });
});
