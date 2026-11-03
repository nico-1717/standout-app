// Esegue il VERO codice di calcolo della pagina Voti (public/exams/voti.php) su tanti casi inventati
// e scrive i risultati: il test d'oro dell'app confronta la sua copia (src/features/grades/logic.ts) con questi.
//   node scripts/gen-voti-golden.mjs ../standout > src/features/grades/__tests__/fixtures/voti.json
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const site = process.argv[2] ?? '../standout';
const src = readFileSync(join(site, 'public/exams/voti.php'), 'utf8');
const from = src.indexOf('function findExam');
const to = src.indexOf('/* ---- Animazioni ---- */');
const body = src.slice(from, to);
const helpers = `
function toBool(v){ return v===true||v===1||v==='1'||v==='true'; }
function clampG(v){ v=Math.round(v); if(v<18)v=18; if(v>30)v=30; return v; }
var STATE = { settings: {}, exams: [], bonuses: [], groups: [], showProjection: true };
`;
const ctx = vm.createContext({
  Math,
  parseInt,
  parseFloat,
  Object,
  String,
  Number,
  isNaN,
  fetch: () => {},
});
vm.runInContext(helpers + body, ctx);

// numeri a caso, ma sempre gli stessi (generatore con seme)
let seed = 20261103;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

function scenario(n) {
  const settings = {
    total_cfu: pick([120, 180, 300]),
    grade_base: pick([110, 110, 100, 30]),
    honors_value: pick([30, 30, 31, 33]),
    thesis_min_points: pick([0, 0, 1, 2]),
    thesis_max_points: 0,
    round_half_up: pick([0, 1]),
  };
  settings.thesis_max_points = settings.thesis_min_points + pick([0, 2, 4]);
  const groups = [];
  const nGroups = int(0, 3);
  for (let g = 0; g < nGroups; g++)
    groups.push({
      uuid: `g${n}_${g}`,
      group_type: pick(['choice', 'split']),
      cfu: pick([6, 9, 12]),
      overall_grade: null,
    });
  const exams = [];
  const nEx = int(0, 14);
  for (let i = 0; i < nEx; i++) {
    const pf = rnd() < 0.12;
    const done = rnd() < 0.55;
    const hon = !pf && done && rnd() < 0.15;
    const phon = !pf && !done && rnd() < 0.15;
    exams.push({
      uuid: `e${n}_${i}`,
      name: `Esame ${i}`,
      cfu: pick([3, 6, 6, 9, 12, 7.5, 4.5]),
      status: done ? 'done' : 'todo',
      grade: pf || !done ? null : hon ? 30 : int(18, 30),
      has_honors: hon ? 1 : 0,
      is_pass_fail: pf ? 1 : 0,
      counts_for_graduation: rnd() < 0.9 ? 1 : 0,
      exam_date: done
        ? `202${int(4, 6)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`
        : null,
      predicted_grade: pf || done || rnd() < 0.4 ? null : phon ? 30 : int(18, 30),
      predicted_honors: phon ? 1 : 0,
      study_year: rnd() < 0.7 ? int(1, 3) : null,
      group_uuid: groups.length && rnd() < 0.4 ? pick(groups).uuid : null,
      sort_order: i + 1,
      sort_key: String(i).padStart(3, '0'),
    });
  }
  for (const x of exams)
    if (x.predicted_honors && x.predicted_grade == null) x.predicted_grade = 30;
  const bonuses = [];
  const nB = int(0, 3);
  for (let b = 0; b < nB; b++)
    bonuses.push({
      uuid: `b${n}_${b}`,
      bonus_type: pick(['fixed', 'on_time', 'honors_each', 'honors_threshold', 'custom']),
      points: pick([0.5, 1, 2, -1, 0.33]),
      threshold_value: pick([null, 1, 2, 3]),
      cap_points: pick([0, 0, 2, 3]),
      is_enabled: rnd() < 0.8 ? 1 : 0,
    });
  return { settings, groups, exams, bonuses };
}

// dall'aspetto dell'app (uuid, group_uuid, 0/1) a quello del sito (id, group_id, true/false)
function siteShape(s) {
  return {
    settings: { ...s.settings, round_half_up: !!s.settings.round_half_up },
    groups: s.groups.map((g) => ({ ...g, id: g.uuid })),
    exams: s.exams.map((e) => ({
      ...e,
      id: e.uuid,
      group_id: e.group_uuid,
      has_honors: !!e.has_honors,
      is_pass_fail: !!e.is_pass_fail,
      counts_for_graduation: !!e.counts_for_graduation,
      predicted_honors: !!e.predicted_honors,
    })),
    bonuses: s.bonuses.map((b) => ({ ...b, id: b.uuid, is_enabled: !!b.is_enabled })),
  };
}

const out = [];
for (let n = 0; n < 150; n++) {
  const sc = scenario(n);
  vm.runInContext('STATE.showProjection = true;', ctx);
  ctx.__s = siteShape(sc);
  vm.runInContext(
    'STATE.settings = __s.settings; STATE.exams = __s.exams; STATE.groups = __s.groups; STATE.bonuses = __s.bonuses;',
    ctx,
  );
  const run = (code) => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, ctx) ?? 'null');
  const w = run('weighted(STATE.exams)');
  const target = [24, 27.5, 29, 30][n % 4];
  out.push({
    ...sc,
    expect: {
      weighted: w,
      cfuStats: run('cfuStats()'),
      simulated: run('simulated()'),
      totalExamsCount: run('totalExamsCount()'),
      lodi: [run('lodiCount(false)'), run('lodiCount(true)')],
      bonusTotal: [run('bonusTotal(false)'), run('bonusTotal(true)')],
      base110: run(`base110(${w.avg})`),
      finalRange: [run(`finalRange(${w.avg}, false)`), run(`finalRange(simulated().avg, true)`)],
      requiredFuture: { target, value: run(`requiredFuture(${target})`) },
      todoForCalc: run('todoForCalc()').map((e) => ({
        uuid: e.uuid,
        cfu: e.cfu,
        predicted_grade: e.predicted_grade,
      })),
      trend: [
        run('(STATE.showProjection=true, trendData())'),
        run('(STATE.showProjection=false, trendData())'),
      ].map((t) => ({
        real: t.real.map((p) => ({ ...p, name: undefined })),
        proj: t.proj.map((p) => ({ ...p, name: undefined })),
      })),
      groups: sc.groups.map((g) => ({
        uuid: g.uuid,
        total: run(`groupTotalCfu(${JSON.stringify(g.uuid)})`),
        done: run(`groupDoneCfu(${JSON.stringify(g.uuid)})`),
        predicted: run(`groupPredictedCfu(${JSON.stringify(g.uuid)}, null)`),
        complete: run(`groupIsComplete(${JSON.stringify(g.uuid)})`),
        allPredicted: run(`groupAllPredicted(${JSON.stringify(g.uuid)})`),
        proposed: [
          run(`proposedOverallGrade(groupExams(${JSON.stringify(g.uuid)}), false)`),
          run(`proposedOverallGrade(groupExams(${JSON.stringify(g.uuid)}), true)`),
        ],
      })),
    },
  });
}
// qualche caso fisso per le funzioni pure
const pure = {
  maxCount: [
    [[6, 6, 9, 3], 12],
    [[6, 9], 7],
    [[3, 3, 3, 6], 9],
    [[], 6],
  ].map(([cfus, target]) => ({
    cfus,
    target,
    value: vm.runInContext(`maxCountForExactSum(${JSON.stringify(cfus)}, ${target})`, ctx),
  })),
  sums: [
    [6, 9, 12],
    [3, 3],
    [7.5, 4.5, 6],
  ].map((cfus) => ({
    cfus,
    value: vm.runInContext(`possibleCfuSums(${JSON.stringify(cfus)})`, ctx),
  })),
};
process.stdout.write(JSON.stringify({ scenarios: out, pure }, null, 0));
