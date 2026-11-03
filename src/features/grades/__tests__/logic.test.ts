import golden from './fixtures/voti.json';

import {
  bonusTotal,
  base110,
  cfuStats,
  finalRange,
  groupAllPredicted,
  groupDoneCfu,
  groupIsComplete,
  groupPredictedCfu,
  groupTotalCfu,
  lodiCount,
  maxCountForExactSum,
  possibleCfuSums,
  proposedOverallGrade,
  groupExams,
  requiredFuture,
  simulated,
  todoForCalc,
  totalExamsCount,
  trendData,
  weighted,
  type GradeData,
} from '../logic';

type Scenario = (typeof golden.scenarios)[number];

const dataOf = (s: Scenario): GradeData => s.settings && (s as unknown as GradeData);

// toEqual su numeri: tolleranza minima per le divisioni
const close = (a: unknown, b: unknown) => {
  if (typeof a === 'number' && typeof b === 'number') expect(a).toBeCloseTo(b, 9);
  else expect(a).toEqual(b);
};

describe('Voti: stessi numeri della pagina del sito (150 casi)', () => {
  test.each(golden.scenarios.map((s, i) => [i, s] as const))('caso %i', (_i, s) => {
    const d = dataOf(s as Scenario);
    const e = s.expect;
    const w = weighted(d);
    expect(w.n).toBe(e.weighted.n);
    close(w.avg, e.weighted.avg);
    close(w.cfu, e.weighted.cfu);
    expect(cfuStats(d)).toEqual(e.cfuStats);
    const sim = simulated(d);
    expect(sim.used).toBe(e.simulated.used);
    close(sim.avg, e.simulated.avg);
    close(sim.cfu, e.simulated.cfu);
    expect(totalExamsCount(d)).toBe(e.totalExamsCount);
    expect([lodiCount(d, false), lodiCount(d, true)]).toEqual(e.lodi);
    expect([bonusTotal(d, false), bonusTotal(d, true)]).toEqual(e.bonusTotal);
    expect(base110(d, w.avg)).toBe(e.base110);
    expect(finalRange(d, w.avg, false)).toEqual(e.finalRange[0]);
    expect(finalRange(d, sim.avg, true)).toEqual(e.finalRange[1]);
    const rf = requiredFuture(d, e.requiredFuture.target);
    if (e.requiredFuture.value === null) expect(rf).toBeNull();
    else {
      close(rf!.req, e.requiredFuture.value.req);
      close(rf!.remainingCfu, e.requiredFuture.value.remainingCfu);
      expect(rf!.feasible).toBe(e.requiredFuture.value.feasible);
    }
    expect(
      todoForCalc(d).map((x) => ({ uuid: x.uuid, cfu: x.cfu, predicted_grade: x.predicted_grade })),
    ).toEqual(e.todoForCalc);
    [true, false].forEach((withProj, k) => {
      const t = trendData(d, withProj);
      const want = e.trend[k]!;
      expect(t.real.map((p) => p.i)).toEqual(want.real.map((p) => p.i));
      t.real.forEach((p, j) => {
        close(p.avg, want.real[j]!.avg);
        close(p.grade, want.real[j]!.grade);
        expect(p.lode).toBe(want.real[j]!.lode);
      });
      expect(t.proj.map((p) => p.i)).toEqual(want.proj.map((p) => p.i));
      t.proj.forEach((p, j) => close(p.avg, want.proj[j]!.avg));
    });
    s.expect.groups.forEach((g) => {
      expect(groupTotalCfu(d, g.uuid)).toBe(g.total);
      expect(groupDoneCfu(d, g.uuid)).toBe(g.done);
      expect(groupPredictedCfu(d, g.uuid, null)).toBe(g.predicted);
      expect(groupIsComplete(d, g.uuid)).toBe(g.complete);
      expect(groupAllPredicted(d, g.uuid)).toBe(g.allPredicted);
      const m = groupExams(d, g.uuid);
      expect([proposedOverallGrade(d, m, false), proposedOverallGrade(d, m, true)]).toEqual(
        g.proposed,
      );
    });
  });

  test('funzioni pure sui CFU', () => {
    for (const c of golden.pure.maxCount)
      expect(maxCountForExactSum(c.cfus, c.target)).toBe(c.value);
    for (const c of golden.pure.sums) expect(possibleCfuSums(c.cfus)).toEqual(c.value);
  });

  test('i casi inventati toccano davvero le situazioni difficili', () => {
    const has = (f: (s: Scenario) => boolean) => golden.scenarios.some((s) => f(s as Scenario));
    expect(
      has(
        (s) => s.groups.some((g) => g.group_type === 'choice') && s.exams.some((e) => e.group_uuid),
      ),
    ).toBe(true);
    expect(has((s) => s.exams.some((e) => e.has_honors))).toBe(true);
    expect(has((s) => s.exams.some((e) => e.is_pass_fail))).toBe(true);
    expect(has((s) => s.bonuses.some((b) => b.bonus_type === 'honors_threshold'))).toBe(true);
    expect(has((s) => s.expect.requiredFuture.value?.feasible === false)).toBe(true);
  });
});
