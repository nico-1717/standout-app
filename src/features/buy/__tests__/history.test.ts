import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import {
  type History,
  BuyHistoryStore,
  MAX_CHIPS_EMPTY,
  MAX_CHIPS_TYPED,
  MAX_ENTRIES,
  forget,
  parseHistory,
  remember,
  suggest,
} from '../history';

describe('buy history', () => {
  test('remember counts uses and keeps the latest category and price', () => {
    let h = remember({}, { title: 'Oat milk', cat: 'c1', cents: 189 }, 10);
    h = remember(h, { title: ' oat  MILK! ', cents: 199 }, 20);
    expect(Object.keys(h)).toEqual(['oat milk']);
    expect(h['oat milk']).toMatchObject({ uses: 2, last: 20, cat: 'c1', cents: 199 });
  });

  test('an empty title is ignored', () => {
    expect(remember({}, { title: '  !! ' }, 1)).toEqual({});
  });

  test('forget removes one article only', () => {
    let h = remember({}, { title: 'Bread' }, 1);
    h = remember(h, { title: 'Eggs' }, 2);
    expect(Object.keys(forget(h, 'bread'))).toEqual(['eggs']);
    expect(forget(h, 'nothing')).toBe(h);
  });

  test('empty query: most bought first, never what is already in the list, at most 8', () => {
    let h: History = {};
    for (let i = 0; i < 12; i++) h = remember(h, { title: `Item ${i}` }, i);
    h = remember(h, { title: 'Item 3' }, 50);
    h = remember(h, { title: 'Item 3' }, 51);
    const out = suggest(h, '', ['item 5']);
    expect(out).toHaveLength(MAX_CHIPS_EMPTY);
    expect(out[0]?.title).toBe('Item 3');
    expect(out.map((e) => e.title)).not.toContain('Item 5');
  });

  test('typed query: prefix first, then word start, never the identical phrase', () => {
    let h = remember({}, { title: 'Milk' }, 1);
    h = remember(h, { title: 'Oat milk' }, 2);
    h = remember(h, { title: 'Milkshake' }, 3);
    h = remember(h, { title: 'Bread' }, 4);
    const out = suggest(h, 'mil', []).map((e) => e.title);
    expect(out.slice(0, 2).sort()).toEqual(['Milk', 'Milkshake']);
    expect(out[2]).toBe('Oat milk');
    expect(out).not.toContain('Bread');
    expect(suggest(h, 'milk', []).map((e) => e.title)).not.toContain('Milk');
  });

  test('typed query returns at most 6', () => {
    let h: History = {};
    for (let i = 0; i < 10; i++) h = remember(h, { title: `Pasta ${i}` }, i);
    expect(suggest(h, 'pas', [])).toHaveLength(MAX_CHIPS_TYPED);
  });

  test('accents do not matter', () => {
    const h = remember({}, { title: 'Caffè' }, 1);
    expect(suggest(h, 'caff', []).map((e) => e.title)).toEqual(['Caffè']);
  });

  test('memory is capped to the most recent entries', () => {
    let h: History = {};
    for (let i = 0; i < MAX_ENTRIES + 25; i++) h = remember(h, { title: `Thing ${i}` }, i);
    expect(Object.keys(h)).toHaveLength(MAX_ENTRIES);
    expect(h['thing 0']).toBeUndefined();
    expect(h[`thing ${MAX_ENTRIES + 24}`]).toBeDefined();
  });

  test('parseHistory survives garbage', () => {
    expect(parseHistory(null)).toEqual({});
    expect(parseHistory('not json')).toEqual({});
    expect(parseHistory('[1,2]')).toEqual({});
    expect(parseHistory('{"a":{"title":5},"b":null}')).toEqual({});
    const ok = parseHistory('{"x":{"title":"Rice","uses":-3,"last":"no","cents":-1}}');
    expect(ok['rice']).toMatchObject({ uses: 1, last: 0, cat: null, cents: null });
  });

  test('the store saves and reads back', () => {
    const db = memoryDb();
    migrate(db);
    const store = new BuyHistoryStore(db);
    expect(store.read()).toEqual({});
    store.remember([{ title: 'Rice', cents: 250 }, { title: 'Beans' }], 5);
    expect(new BuyHistoryStore(db).read()['rice']).toMatchObject({ uses: 1, cents: 250 });
    store.forget('Rice');
    expect(Object.keys(store.read())).toEqual(['beans']);
  });
});
