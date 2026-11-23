import {
  BASEW,
  INT,
  PROBLEMS,
  CATEGORIES,
  addDays,
  bulkRecord,
  diffDays,
  dueLabel,
  exportBackup,
  importBackup,
  learnPattern,
  newCandidates,
  nextRecord,
  pickNew,
  pickReview,
  swapNew,
  weightOf,
  type Items,
  type ReviewRecord,
} from '../neetcode';

/** Un caso ripetibile: stesso seme, stesse estrazioni. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const TODAY = '2026-11-22';

const rec = (n: number, over: Partial<ReviewRecord> = {}): ReviewRecord => ({
  n,
  rating: 3,
  pattern: PROBLEMS[n]?.cat ?? 'Other',
  hist: [['2026-11-01', 3]],
  solvedOn: '2026-11-01',
  lastReviewed: '2026-11-01',
  nextDue: '2026-11-06',
  reviews: 0,
  ...over,
});

describe('la lista', () => {
  it('ha 150 problemi in 18 categorie, nell’ordine della roadmap', () => {
    expect(PROBLEMS).toHaveLength(150);
    expect(CATEGORIES).toHaveLength(18);
    expect(PROBLEMS[0]?.name).toBe('Contains Duplicate');
    expect(PROBLEMS[3]?.name).toBe('Group Anagrams');
    expect(PROBLEMS[149]?.name).toBe('Reverse Integer');
  });
});

describe('date', () => {
  it('somma e confronta i giorni senza fuso', () => {
    expect(addDays('2026-11-30', 5)).toBe('2026-12-05');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-22', '2026-11-17')).toBe(5);
  });
});

describe('salvare un voto', () => {
  it('nuovo, risolto oggi', () => {
    expect(
      nextRecord(null, 3, { rating: 3, pattern: 'Arrays & Hashing', when: 'today' }, TODAY),
    ).toEqual({
      n: 3,
      rating: 3,
      pattern: 'Arrays & Hashing',
      hist: [[TODAY, 3]],
      solvedOn: TODAY,
      lastReviewed: TODAY,
      nextDue: addDays(TODAY, INT[3]),
      reviews: 0,
    });
  });
  it('nuovo, risolto prima di oggi: data vuota e dovuto oggi', () => {
    const r = nextRecord(null, 3, { rating: 2, pattern: 'Stack', when: 'earlier' }, TODAY);
    expect(r).toMatchObject({
      solvedOn: null,
      lastReviewed: null,
      nextDue: TODAY,
      reviews: 0,
      hist: [['earlier', 2]],
    });
  });
  it('un ripasso: conta, cambia lo schema, tiene solvedOn e le ultime 40 voci', () => {
    const hist = Array.from(
      { length: 40 },
      (_, i) => ['2026-10-01', 1 + (i % 4)] as [string, number],
    );
    const r = nextRecord(
      rec(5, { hist }),
      5,
      { rating: 4, pattern: 'Other', when: 'today' },
      TODAY,
    );
    expect(r.reviews).toBe(1);
    expect(r.solvedOn).toBe('2026-11-01');
    expect(r.nextDue).toBe(addDays(TODAY, INT[4]));
    expect(r.hist).toHaveLength(40);
    expect(r.hist[39]).toEqual([TODAY, 4]);
  });
  it('«aggiungi come risolti prima»: voto 3, schema ufficiale, dovuto oggi', () => {
    expect(bulkRecord(3, TODAY)).toMatchObject({
      rating: 3,
      pattern: 'Arrays & Hashing',
      solvedOn: null,
      nextDue: TODAY,
    });
  });
});

describe('il peso del ripasso', () => {
  it('in ritardo pesa di più; in anticipo quasi niente', () => {
    expect(weightOf(rec(0, { rating: 4, nextDue: '2026-11-22' }), TODAY)).toBe(BASEW[4]);
    expect(weightOf(rec(0, { rating: 4, nextDue: '2026-11-20' }), TODAY)).toBeCloseTo(
      8 * (1 + 2 / 2),
    );
    expect(weightOf(rec(0, { rating: 1, nextDue: '2026-12-22' }), TODAY)).toBeCloseTo(0.04);
  });
  it('non propone quelli già ripassati oggi, e non ripete', () => {
    const items: Items = {
      0: rec(0, { lastReviewed: TODAY }),
      1: rec(1),
      2: rec(2),
      3: rec(3),
      4: rec(4),
    };
    for (let s = 1; s < 40; s++) {
      const p = pickReview(items, TODAY, seeded(s));
      expect(p).toHaveLength(3);
      expect(p).not.toContain(0);
      expect(new Set(p).size).toBe(3);
    }
  });
  it('vuota senza risolti', () => {
    expect(pickReview({}, TODAY, seeded(1))).toEqual([]);
  });
});

describe('problemi nuovi', () => {
  const started: Items = {};
  for (const n of [0, 1, 2, 9, 10, 11]) started[n] = rec(n);

  it('con Medium non compare mai un Easy o un Hard, e le due categorie sono diverse (300 prove)', () => {
    const { list } = newCandidates(started, 'M', true);
    for (let s = 1; s <= 300; s++) {
      const picks = pickNew(started, list, seeded(s));
      expect(picks).toHaveLength(2);
      for (const p of picks) expect(p.diff).toBe('M');
      expect(picks[0]?.cat).not.toBe(picks[1]?.cat);
      for (const p of picks) expect(started[p.id]).toBeUndefined();
    }
  });
  it('solo gli schemi iniziati; se nessuno lo è, tutto il gruppo con una nota', () => {
    const { list, note } = newCandidates(started, 'M', true);
    expect(note).toBe('');
    expect(new Set(list.map((p) => p.cat))).toEqual(new Set(['Arrays & Hashing', 'Two Pointers']));
    expect(newCandidates({}, 'M', true).note).toBe('none_started');
    expect(newCandidates({}, 'M', false).list.every((p) => p.diff === 'M')).toBe(true);
  });
  it('se tutti i Medium degli schemi iniziati sono fatti, allarga con una nota', () => {
    const all: Items = {};
    for (const p of PROBLEMS.filter(
      (q) => q.cat === 'Two Pointers' || q.cat === 'Arrays & Hashing',
    ))
      all[p.id] = rec(p.id);
    expect(newCandidates(all, 'M', true).note).toBe('finished_started');
  });
  it('con una sola categoria disponibile riempie il resto (due problemi, stessa categoria)', () => {
    const one = PROBLEMS.filter((p) => p.cat === 'Tries' && p.diff === 'M');
    const picks = pickNew({}, one, seeded(3));
    expect(picks).toHaveLength(2);
    expect(picks[0]?.id).not.toBe(picks[1]?.id);
  });
  it('scambiare non ripete le proposte di adesso', () => {
    const { list } = newCandidates({}, 'M', false);
    const current = pickNew({}, list, seeded(5)).map((p) => p.id);
    for (let s = 1; s <= 100; s++) {
      const id = swapNew({}, list, current, 0, seeded(s));
      expect(id).not.toBeNull();
      expect(current).not.toContain(id);
      expect(PROBLEMS[id as number]?.diff).toBe('M');
    }
  });
  it('«impara un nuovo schema»: il primo Medium della prima categoria con meno di 3 risolti', () => {
    expect(learnPattern({})).toEqual({ id: 3, cat: 'Arrays & Hashing' });
    const items: Items = { 3: rec(3) };
    expect(learnPattern(items)).toEqual({ id: 4, cat: 'Arrays & Hashing' });
    const three: Items = { 0: rec(0), 1: rec(1), 2: rec(2) };
    expect(learnPattern(three)).toEqual({ id: 10, cat: 'Two Pointers' });
  });
  it('«impara un nuovo schema» salta lo schema già proposto', () => {
    const three: Items = { 0: rec(0), 1: rec(1), 2: rec(2) };
    const next = learnPattern(three, ['Two Pointers']);
    expect(next?.cat).toBe('Sliding Window');
    expect(learnPattern({}, ['Arrays & Hashing'])?.cat).toBe('Two Pointers');
  });
});

describe('etichette', () => {
  it('in ritardo, oggi, fra N giorni', () => {
    expect(dueLabel(rec(0, { nextDue: '2026-11-19' }), TODAY)).toEqual({ kind: 'overdue', n: 3 });
    expect(dueLabel(rec(0, { nextDue: TODAY }), TODAY)).toEqual({ kind: 'today', n: 0 });
    expect(dueLabel(rec(0, { nextDue: '2026-11-27' }), TODAY)).toEqual({ kind: 'in', n: 5 });
  });
});

describe('esporta e importa', () => {
  const items: Items = {
    3: rec(3),
    8: rec(8, {
      hist: [
        ['2026-11-01', 3],
        ['2026-11-10', 2],
      ],
    }),
  };

  it('l’esportazione ha il formato del documento e rientra intera', () => {
    const text = exportBackup(items, TODAY);
    const b = JSON.parse(text);
    expect(b).toMatchObject({ app: 'neetcode-tracker', version: 1, exportedOn: TODAY });
    expect(b.items[0]).toMatchObject({ n: 3, name: 'Group Anagrams' });
    const r = importBackup({}, text);
    expect(r).toMatchObject({ added: 2, updated: 0, skipped: 0, error: false });
    expect(r.items).toEqual(items);
  });
  it('importare due volte lo stesso file non cambia niente', () => {
    const text = exportBackup(items, TODAY);
    const once = importBackup({}, text);
    const twice = importBackup(once.items, text);
    expect(twice.items).toEqual(once.items);
    expect(twice).toMatchObject({ added: 0, updated: 0, skipped: 2 });
  });
  it('un export del vecchio prototipo (senza name) funziona', () => {
    const old = JSON.stringify({ app: 'neetcode-tracker', version: 1, items: [{ ...rec(3) }] });
    expect(importBackup({}, old).added).toBe(1);
  });
  it('sostituisce solo con storia più lunga, o uguale e ripasso più recente', () => {
    const older = { 3: rec(3) };
    const longer = JSON.stringify({
      items: [
        rec(3, {
          hist: [
            ['2026-11-01', 3],
            ['2026-11-10', 3],
          ],
        }),
      ],
    });
    expect(importBackup(older, longer).updated).toBe(1);
    const sameLater = JSON.stringify({ items: [rec(3, { lastReviewed: '2026-11-05' })] });
    expect(importBackup(older, sameLater).updated).toBe(1);
    const shorter = JSON.stringify({ items: [rec(3, { hist: [] })] });
    expect(importBackup(older, shorter).updated).toBe(0);
  });
  it('salta le righe sbagliate e non cancella mai', () => {
    const bad = JSON.stringify({
      items: [
        rec(999),
        rec(2, { rating: 7 as never }),
        rec(2, { nextDue: '2026-13-40' }),
        rec(2, { pattern: 'Nope' }),
        rec(4),
      ],
    });
    const r = importBackup(items, bad);
    expect(r).toMatchObject({ added: 1, skipped: 4 });
    expect(Object.keys(r.items).sort()).toEqual(['3', '4', '8']);
  });
  it('con un nome che corrisponde, ci si fida del nome', () => {
    const r = importBackup({}, JSON.stringify({ items: [{ ...rec(5), name: 'Two Sum' }] }));
    expect(r.items[2]?.n).toBe(2);
  });
  it('un testo che non è un backup dà errore', () => {
    expect(importBackup(items, 'ciao').error).toBe(true);
    expect(importBackup(items, '{"items":3}').error).toBe(true);
  });
});
