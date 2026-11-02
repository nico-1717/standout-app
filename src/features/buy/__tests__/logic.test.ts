import type { Task } from '../../tasks/repo';
import {
  formatEuro,
  groupBuy,
  parseQuickAdd,
  priceInput,
  sumCents,
  toCents,
  type BuyCategory,
} from '../logic';

const cats: BuyCategory[] = [
  { uuid: 'c-spesa', name: 'spesa', color: '#E8B86B', sort_key: 'a0' },
  { uuid: 'c-casa', name: 'casa', color: '#A9C3AE', sort_key: 'a1' },
  { uuid: 'c-vest', name: 'vestiti', color: '#C6B6A6', sort_key: 'a2' },
];
const t = (title: string, o: Partial<Task> = {}): Task =>
  ({
    uuid: title,
    title,
    is_done: 0,
    buy_category_uuid: null,
    buy_priority: 3,
    buy_price_cents: null,
    ...o,
  }) as Task;

test('toCents accepts comma, dot, euro sign; rejects junk', () => {
  expect(toCents('12,90')).toBe(1290);
  expect(toCents('12.9')).toBe(1290);
  expect(toCents('€ 12')).toBe(1200);
  expect(toCents('abc')).toBeNull();
  expect(toCents('')).toBeNull();
  expect(toCents('1,234')).toBeNull();
});

test('formatEuro follows the language', () => {
  expect(formatEuro(559, 'en')).toBe('€5.59');
  expect(formatEuro(559, 'it').replace(/\s/g, ' ')).toBe('5,59 €');
  expect(priceInput(189)).toBe('1,89');
  expect(priceInput(null)).toBe('');
});

test('quick add: title, price, #category, !priority', () => {
  const r = parseQuickAdd('latte intero 1,20 #casa !2', cats);
  expect(r).toMatchObject({ title: 'latte intero', cents: 120, catUuid: 'c-casa', priority: 2 });
});

test('quick add: a bare integer stays in the title; "!" alone means priority 1', () => {
  const r = parseQuickAdd('2 avocado !', cats);
  expect(r.title).toBe('2 avocado');
  expect(r.cents).toBeNull();
  expect(r.priority).toBe(1);
});

test('quick add: unknown #category is reported, a link becomes url', () => {
  const r = parseQuickAdd('cuffie https://example.com/x #regali', cats);
  expect(r.newCategory).toBe('regali');
  expect(r.url).toBe('https://example.com/x');
  expect(r.title).toBe('cuffie');
});

test('quick add: category guessed from words only if the user has a matching category', () => {
  expect(parseQuickAdd('latte', cats).catUuid).toBe('c-spesa');
  expect(parseQuickAdd('shampoo', cats).catUuid).toBeNull(); // nessuna categoria «beauty»
  expect(parseQuickAdd('scarpe 89,90', cats)).toMatchObject({ catUuid: 'c-vest', cents: 8990 });
});

test('grouping: category order, priority first, uncategorised last, cart apart', () => {
  const items = [
    t('a', { buy_category_uuid: 'c-casa', buy_priority: 3 }),
    t('b', { buy_category_uuid: 'c-casa', buy_priority: 1 }),
    t('c', { buy_category_uuid: 'c-spesa' }),
    t('d'),
    t('e', { is_done: 1, buy_price_cents: 500 }),
    t('f', { buy_category_uuid: 'gone' }),
  ];
  const g = groupBuy(items, cats);
  expect(g.groups.map((x) => [x.cat?.name ?? null, x.items.map((i) => i.title)])).toEqual([
    ['spesa', ['c']],
    ['casa', ['b', 'a']],
    [null, ['d', 'f']],
  ]);
  expect(g.cart.map((i) => i.title)).toEqual(['e']);
  expect(sumCents(g.cart)).toBe(500);
});
