import golden from './fixtures/golden.json';
import { measuredPace, plan, type Goal, type PlanInput, type PlanSettings } from '../engine';

/**
 * Test d'oro: il SITO (pn_pianifica) ha calcolato questi scenari (scripts/gen-plan-golden.php); il telefono deve dare gli
 * stessi minuti, giorno per giorno, progetto per progetto. Se un conto cambia, uno dei due è sbagliato.
 */
interface Scenario {
  name: string;
  input: {
    today: string;
    nodes: { id: string; parent: string | null; status: string; kids: string[] }[];
    goals: Record<string, Goal>;
    done: Record<string, Record<string, number>>;
    manual: Record<string, Record<string, number>>;
    painted: Record<string, string[]>;
    busy: Record<string, number>;
    settings: PlanSettings;
    root: string | null;
  };
  pace: {
    perDay: Record<string, number>;
    measured: { weekday: number; weekend: number; days: number; enough: boolean };
  };
  expected: {
    rows: Record<string, Record<string, { study?: number; review?: number }>>;
    deficit: Record<string, number>;
    info: Record<
      string,
      { resta: number; tot: number; fine: string; fineStudio: string; utili: string[] }
    >;
    days: number;
    end: string;
    dailyCount: number;
  };
}

function toInput(s: Scenario['input']): PlanInput {
  const nested = (o: Record<string, Record<string, number>>) =>
    new Map(Object.entries(o).map(([k, v]) => [k, new Map(Object.entries(v))]));
  return {
    today: s.today,
    nodes: s.nodes,
    goals: new Map(Object.entries(s.goals)),
    done: nested(s.done),
    manual: nested(s.manual),
    painted: new Map(Object.entries(s.painted).map(([k, v]) => [k, new Set(v)])),
    busy: new Map(Object.entries(s.busy)),
    settings: s.settings,
    root: s.root,
  };
}

const scenarios = golden.scenarios as unknown as Scenario[];

describe('pianificatore: stessi minuti del sito', () => {
  it('ci sono scenari', () => {
    expect(scenarios.length).toBeGreaterThan(40);
  });

  it.each(scenarios.map((s) => [s.name, s] as const))('%s', (_name, sc) => {
    const r = plan(toInput(sc.input));
    const rows: Record<string, Record<string, { study?: number; review?: number }>> = {};
    for (const [d, per] of r.rows) {
      rows[d] = {};
      for (const [id, k] of per) rows[d][id] = { ...k };
    }
    expect(rows).toEqual(sc.expected.rows);
    expect(Object.fromEntries(r.deficit)).toEqual(sc.expected.deficit);
    expect(r.days.length).toBe(sc.expected.days);
    expect(r.end).toBe(sc.expected.end);
    expect(r.dailyCount).toBe(sc.expected.dailyCount);
    const info: Record<string, unknown> = {};
    for (const [id, u] of r.info)
      info[id] = {
        resta: u.resta,
        tot: u.tot,
        fine: u.fine,
        fineStudio: u.fineStudio,
        utili: u.utili,
      };
    const want: Record<string, unknown> = {};
    for (const [id, u] of Object.entries(sc.expected.info))
      want[id] = {
        resta: u.resta,
        tot: u.tot,
        fine: u.fine,
        fineStudio: u.fineStudio,
        utili: u.utili,
      };
    expect(info).toEqual(want);
  });
});

describe('ritmo misurato: stesso conto del sito', () => {
  it.each(
    scenarios.filter((s) => Object.keys(s.pace.perDay).length).map((s) => [s.name, s] as const),
  )('%s', (_name, sc) => {
    const got = measuredPace(sc.input.today, new Map(Object.entries(sc.pace.perDay)));
    expect(got).toEqual(sc.pace.measured);
  });
});
