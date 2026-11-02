import type { BuyCategory } from '@/features/buy/logic';

import { inputOf, itemError, itemFromLine, noteAfter, toSave, type SortItem } from '../sort';

const NOW = { date: '2026-11-05', time: '10:00' };
const cats: BuyCategory[] = [
  { uuid: 'c-food', name: 'Spesa', color: '#000', sort_key: 'a' },
] as never;
const line = (text: string, orig = 0) => itemFromLine({ orig, text }, NOW, cats);

describe('itemFromLine', () => {
  test('a plain line is a to do', () => {
    expect(line('pulire il garage')).toMatchObject({
      dest: 'todo',
      title: 'Pulire il garage',
      date: '',
      time: '',
      keep: true,
    });
  });

  test('a date and an hour are read like in the to do bar', () => {
    const it = line('chiamare Anna domani alle 15');
    expect(it).toMatchObject({ dest: 'todo', date: '2026-11-06', time: '15:00' });
  });

  test('a line that starts with a buying verb is a to buy, without the verb', () => {
    const it = line('compra latte 1,20');
    expect(it).toMatchObject({ dest: 'buy', title: 'Latte', price: '1,20', date: '' });
  });

  test('a euro sign makes it a to buy, and a known word finds the category', () => {
    expect(line('pane 2,50 €')).toMatchObject({ dest: 'buy', price: '2,50' });
  });

  test("an appointment-like line becomes a to do with its date (events aren't in the app yet)", () => {
    expect(line('dentista domani alle 9')).toMatchObject({
      dest: 'todo',
      date: '2026-11-06',
      time: '09:00',
    });
  });

  test('keeps the line it came from', () => {
    expect(line('uova', 3)).toMatchObject({ orig: 3, from: 'uova' });
  });
});

const todo = (o: Partial<SortItem> = {}): SortItem => ({
  ...line('x'),
  title: 'Telefonare',
  ...o,
});

describe('itemError', () => {
  test('knows what is wrong', () => {
    expect(itemError(todo({ title: '  ' }))).toBe('title');
    expect(itemError(todo({ date: '2026-13-40' }))).toBe('date');
    expect(itemError(todo({ date: '05/11/2026' }))).toBe('date');
    expect(itemError(todo({ time: '10:00', date: '' }))).toBe('time'); // un'ora senza giorno
    expect(itemError(todo({ date: '2026-11-05', time: '25:00' }))).toBe('time');
    expect(itemError(todo({ dest: 'buy', price: 'tanto' }))).toBe('price');
    expect(itemError(todo({ date: '2026-11-05', time: '09:30' }))).toBeNull();
    expect(itemError(todo({ dest: 'buy', price: '' }))).toBeNull();
  });
  test('toSave leaves out removed and wrong items', () => {
    const a = todo();
    const b = todo({ keep: false });
    const c = todo({ title: '' });
    expect(toSave([a, b, c])).toEqual([a]);
  });
});

describe('inputOf', () => {
  test('a to do with a date and an hour', () => {
    expect(inputOf(todo({ date: '2026-11-06', time: '15:00', minutes: 45 }))).toEqual({
      listType: 'todo',
      input: {
        title: 'Telefonare',
        due_date: '2026-11-06',
        due_time: '15:00',
        duration_minutes: 45,
      },
    });
  });
  test('a to do without a date has no hour and the usual 30 minutes', () => {
    expect(inputOf(todo({ time: '15:00' })).input).toEqual({
      title: 'Telefonare',
      due_date: null,
      due_time: null,
      duration_minutes: 30,
    });
  });
  test('a to buy keeps the price in cents', () => {
    expect(inputOf(todo({ dest: 'buy', price: '12,90', title: ' Latte ' }))).toEqual({
      listType: 'buy',
      input: { title: 'Latte', buy_price_cents: 1290 },
    });
    expect(inputOf(todo({ dest: 'buy', price: '' })).input.buy_price_cents).toBeNull();
  });
});

describe('noteAfter', () => {
  const text = 'latte\n\npane\ntelefonare\nuova';
  const items = [line('latte', 0), line('pane', 2), line('telefonare', 3)];

  test('only saved lines leave the note', () => {
    const out = noteAfter(text, items, new Set([items[0]!, items[2]!]));
    expect(out).toBe('pane\nuova');
  });
  test('a removed (not kept) item stays in the note even if it was "saved"', () => {
    items[1]!.keep = false;
    expect(noteAfter(text, items, new Set(items))).toBe('pane\nuova');
    items[1]!.keep = true;
  });
  test('nothing saved: the note does not change', () => {
    expect(noteAfter(text, items, new Set())).toBe(text);
  });
  test('blank lines left by the cuts do not pile up', () => {
    const t = 'a\n\n\nb\n\n\nc';
    const b = line('b', 3);
    expect(noteAfter(t, [b], new Set([b]))).toBe('a\n\nc');
  });
});
