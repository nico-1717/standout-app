import type { DiaryAiReply } from '@/core/account/accountApi';

import { failure, makeBook, makeReport, quarters, reportOf } from '../aiMake';
import type { CompactDay, Insights } from '../insights';

const day = (w: number): CompactDay => [3, 3, w, 0, 0, 0, 0, 0];

function year(days: Record<string, CompactDay>): Insights {
  return { year: 2026, today: '2026-11-09', days, anni: [] };
}

describe('quarters', () => {
  test('days need 10+ words; a quarter is ready with 15 days and 1500 words', () => {
    const days: Record<string, CompactDay> = {};
    for (let d = 1; d <= 15; d++) days[`2026-01-${String(d).padStart(2, '0')}`] = day(100);
    days['2026-02-01'] = day(5); // troppo corto: non è un giorno scritto, ma le parole contano
    const q = quarters(year(days), '2026-11-09');
    expect(q[0]).toMatchObject({ quarter: 1, days: 15, words: 1505, enough: true, started: true });
    expect(q[1]).toMatchObject({ days: 0, words: 0, enough: false });
  });

  test('not enough days or not enough words', () => {
    const days: Record<string, CompactDay> = {};
    for (let d = 1; d <= 14; d++) days[`2026-04-${String(d).padStart(2, '0')}`] = day(500);
    expect(quarters(year(days), '2026-11-09')[1]!.enough).toBe(false); // 14 giorni
    const few: Record<string, CompactDay> = {};
    for (let d = 1; d <= 20; d++) few[`2026-04-${String(d).padStart(2, '0')}`] = day(50);
    expect(quarters(year(few), '2026-11-09')[1]!.enough).toBe(false); // 1000 parole
  });

  test('a quarter that has not started is flagged', () => {
    const q = quarters(year({}), '2026-08-01');
    expect(q.map((x) => x.started)).toEqual([true, true, true, false]);
  });
});

describe('failure messages', () => {
  test.each([
    [
      { ok: false, error: 'limite_piano', stima: 50, disponibili: 3 },
      'diario.dn_err_crediti',
      false,
    ],
    [{ ok: false, error: 'niente_pensieri' }, 'diario.dn_err_pensieri', false],
    [{ ok: false, error: 'troppo_poco' }, 'diario.dn_scrivi_ancora', false],
    [{ ok: false, error: 'ia_timeout', riprovabile: true }, 'diario.dn_err_ia', true],
    [{ ok: false, error: 'boh' }, 'diario.dn_ops', true],
  ] as [DiaryAiReply, string, boolean][])('%j', (r, key, retry) => {
    expect(failure(r)).toMatchObject({ key, retry });
  });

  test('the credit message carries the numbers', () => {
    expect(failure({ ok: false, error: 'limite_piano', stima: 50, disponibili: 3 }).vars).toEqual({
      stima: 50,
      disp: 3,
    });
  });
});

describe('writing', () => {
  test('a report: the id comes back; a refusal comes back as is; no network is null', async () => {
    expect(await makeReport({ run: async () => ({ ok: true, id: 7 }) }, 2026, 1)).toEqual({
      ok: true,
      kind: 'report',
      id: 7,
    });
    const refused = { ok: false, error: 'limite_piano' };
    expect(await makeReport({ run: async () => refused }, 2026, 1)).toEqual({
      ok: false,
      reply: refused,
    });
    expect(
      await makeReport(
        {
          run: async () => {
            throw new Error('offline');
          },
        },
        2026,
        1,
      ),
    ).toEqual({ ok: false, reply: null });
  });

  test('a book: plan, then one piece at a time until "done"; progress is reported', async () => {
    const sent: Record<string, unknown>[] = [];
    let n = 0;
    const api = {
      run: async (b: Record<string, unknown>): Promise<DiaryAiReply> => {
        sent.push(b);
        if (b.azione === 'libro_piano') return { ok: true, id: 9, titolo: 'My book', pezzi: 3 };
        n++;
        return { ok: true, fatto: n === 3, fatti: n, totale: 3, capitolo: `Ch ${n}` };
      },
    };
    const seen: unknown[] = [];
    const r = await makeBook(api, { year: 2026, q: 2, join: 4 }, (p) => seen.push(p));
    expect(r).toEqual({ ok: true, kind: 'book', id: 9 });
    expect(sent[0]).toEqual({ azione: 'libro_piano', anno: 2026, q: 2, unisci: 4 });
    expect(sent.slice(1)).toEqual([
      { azione: 'libro_avanti', id: 9 },
      { azione: 'libro_avanti', id: 9 },
      { azione: 'libro_avanti', id: 9 },
    ]);
    expect(seen[0]).toEqual({ title: 'My book', done: 0, total: 3 });
    expect(seen[3]).toEqual({ done: 3, total: 3, chapter: 'Ch 3' });
  });

  test('a book that stops halfway can be resumed with its id (no new plan, no new charge)', async () => {
    const sent: Record<string, unknown>[] = [];
    let fail = true;
    const api = {
      run: async (b: Record<string, unknown>): Promise<DiaryAiReply> => {
        sent.push(b);
        if (b.azione === 'libro_piano') return { ok: true, id: 5, pezzi: 2 };
        if (fail) {
          fail = false;
          return { ok: false, error: 'ia_timeout', riprovabile: true };
        }
        return { ok: true, fatto: true, fatti: 2, totale: 2 };
      },
    };
    const first = await makeBook(api, { year: 2026, q: 1 }, () => undefined);
    expect(first).toMatchObject({ ok: false, bookId: 5 });
    const again = await makeBook(api, { year: 2026, q: 1, bookId: 5 }, () => undefined);
    expect(again).toEqual({ ok: true, kind: 'book', id: 5 });
    expect(sent.filter((s) => s.azione === 'libro_piano')).toHaveLength(1);
  });

  test('"stop" ends the loop between pieces and keeps the book id', async () => {
    let calls = 0;
    const api = {
      run: async (b: Record<string, unknown>): Promise<DiaryAiReply> => {
        calls++;
        return b.azione === 'libro_piano'
          ? { ok: true, id: 3, pezzi: 5 }
          : { ok: true, fatto: false, fatti: 1, totale: 5 };
      },
    };
    let stop = false;
    const r = await makeBook(
      api,
      { year: 2026, q: 1 },
      (p) => {
        if (p.done >= 1) stop = true;
      },
      () => stop,
    );
    expect(r).toEqual({ ok: false, reply: null, bookId: 3 });
    expect(calls).toBe(2);
  });

  test('a plan refusal (no credits) has no book id', async () => {
    const r = await makeBook(
      { run: async () => ({ ok: false, error: 'limite_piano', stima: 9, disponibili: 1 }) },
      { year: 2026, q: 1 },
      () => undefined,
    );
    expect(r).toMatchObject({ ok: false, reply: { error: 'limite_piano' } });
    expect((r as { bookId?: number }).bookId).toBeUndefined();
  });
});

test('reportOf finds the report of a quarter', () => {
  const list = {
    reports: [{ id: 1, year: 2026, quarter: 2, from: '', to: '', title: '' }],
    books: [],
  };
  expect(reportOf(list, 2026, 2)?.id).toBe(1);
  expect(reportOf(list, 2026, 3)).toBeNull();
  expect(reportOf(null, 2026, 2)).toBeNull();
});
