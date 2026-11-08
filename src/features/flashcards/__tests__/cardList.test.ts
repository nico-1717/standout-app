import { stringifyDoc, plainToDoc } from '../doc';
import { filterCards, levelCounts } from '../cardList';
import type { Level } from '../levels';
import type { Card } from '../logic';

const card = (uuid: string, q: string, a: string, rid: number): Card => ({
  uuid,
  category_uuid: 'd',
  question_desc: stringifyDoc(plainToDoc(q)),
  answer_desc: stringifyDoc(plainToDoc(a)),
  question_image: null,
  answer_image: null,
  question_audio: null,
  answer_audio: null,
  is_father: 0,
  custom_order: rid,
  rid,
});

describe('card list', () => {
  const cards = [
    card('a', 'Capital of France', 'Paris', 1),
    card('b', 'Derivata di sin x', 'cos x', 2),
    card('c', 'Qué es la fotosíntesis', 'Un proceso de las plantas', 3),
  ];
  const levels = new Map<string, Level>([
    ['a', 'la_sai'],
    ['b', 'difficile'],
    ['c', 'nuova'],
  ]);
  const base = { text: '', level: '' as const, sort: 'position' as const };
  const ids = (l: Card[]) => l.map((c) => c.uuid);

  test('search looks in question and answer, ignoring case and accents, all words must match', () => {
    expect(ids(filterCards(cards, levels, { ...base, text: 'paris' }))).toEqual(['a']);
    expect(ids(filterCards(cards, levels, { ...base, text: 'QUE fotosintesis' }))).toEqual(['c']);
    expect(ids(filterCards(cards, levels, { ...base, text: 'cos derivata' }))).toEqual(['b']);
    expect(ids(filterCards(cards, levels, { ...base, text: 'france cos' }))).toEqual([]);
    expect(ids(filterCards(cards, levels, base))).toEqual(['a', 'b', 'c']);
  });

  test('level filter and counts', () => {
    expect(ids(filterCards(cards, levels, { ...base, level: 'difficile' }))).toEqual(['b']);
    expect([...levelCounts(cards, levels)]).toEqual([
      ['la_sai', 1],
      ['difficile', 1],
      ['nuova', 1],
    ]);
  });

  test('orders: newest, oldest, question A-Z, hardest first', () => {
    expect(ids(filterCards(cards, levels, { ...base, sort: 'newest' }))).toEqual(['c', 'b', 'a']);
    expect(ids(filterCards(cards, levels, { ...base, sort: 'oldest' }))).toEqual(['a', 'b', 'c']);
    expect(ids(filterCards(cards, levels, { ...base, sort: 'question' }))).toEqual(['a', 'b', 'c']);
    expect(ids(filterCards(cards, levels, { ...base, sort: 'hardest' }))).toEqual(['b', 'c', 'a']);
  });
});
