import { blockText, normDoc, parseDoc, stringifyDoc, type Doc } from '../doc';
import {
  editBlockText,
  indent,
  kindOf,
  marksAt,
  mergeWithPrevious,
  setColor,
  setKind,
  splitBlock,
  splitRuns,
  textOf,
  toggleChecked,
  toggleMark,
} from '../docEdit';

const doc = (blocks: unknown[]): Doc => normDoc({ v: 2, blocks });
const p = (...runs: unknown[]) => ({ t: 'p', runs });
const texts = (d: Doc): string[] => d.blocks.map((b) => textOf(b));

describe('splitting runs', () => {
  test('splits a run in the middle and keeps marks', () => {
    const [a, b] = splitRuns([{ s: 'hello', m: { b: 1 } }], 2);
    expect(a).toEqual([{ s: 'he', m: { b: 1 } }]);
    expect(b).toEqual([{ s: 'llo', m: { b: 1 } }]);
  });
  test('a formula straddling the point goes whole to the second half', () => {
    const [a, b] = splitRuns([{ s: 'ab' }, { x: 'x^2' }, { s: 'cd' }], 3);
    expect(a).toEqual([{ s: 'ab' }]);
    expect(b).toEqual([{ x: 'x^2' }, { s: 'cd' }]);
  });
});

describe('editing the text of a block', () => {
  test('typing in the middle of a bold word stays bold; the rest keeps its marks', () => {
    const d = doc([p({ s: 'plain ' }, { s: 'bold', m: { b: 1 } }, { s: ' end' })]);
    const e = editBlockText(d, 0, 'plain boXld end');
    const b = e.blocks[0] as { runs: { s: string; m?: object }[] };
    expect(b.runs).toEqual([{ s: 'plain ' }, { s: 'boXld', m: { b: 1 } }, { s: ' end' }]);
  });
  test('deleting across runs', () => {
    const d = doc([p({ s: 'ab', m: { i: 1 } }, { s: 'cd' })]);
    const e = editBlockText(d, 0, 'ad');
    expect(textOf(e.blocks[0])).toBe('ad');
    expect((e.blocks[0] as { runs: unknown[] }).runs).toEqual([
      { s: 'a', m: { i: 1 } },
      { s: 'd' },
    ]);
  });
  test('typing at the very start takes the marks of the next character', () => {
    const d = doc([p({ s: 'xy', m: { u: 1 } })]);
    const e = editBlockText(d, 0, 'Axy');
    expect((e.blocks[0] as { runs: unknown[] }).runs).toEqual([{ s: 'Axy', m: { u: 1 } }]);
  });
  test('typing into an empty block, and into a formula block', () => {
    expect(texts(editBlockText(doc([p()]), 0, 'new'))).toEqual(['new']);
    const f = doc([{ t: 'fx', tex: 'x' }]);
    expect(editBlockText(f, 0, 'x^2').blocks[0]).toMatchObject({ t: 'fx', tex: 'x^2' });
  });
  test('editing text that touches an inline formula turns it into text', () => {
    const d = doc([p({ s: 'a ' }, { x: 'x^2' }, { s: ' b' })]);
    const e = editBlockText(d, 0, 'a x^3 b');
    expect(textOf(e.blocks[0])).toBe('a x^3 b');
    expect((e.blocks[0] as { runs: object[] }).runs.every((r) => 's' in r)).toBe(true);
  });
  test('same text changes nothing', () => {
    const d = doc([p({ s: 'same' })]);
    expect(editBlockText(d, 0, 'same')).toBe(d);
  });
});

describe('marks', () => {
  const base = () => doc([p({ s: 'one two three' })]);
  test('bold on a piece, then off again', () => {
    const on = toggleMark(base(), 0, 4, 7, 'b');
    expect((on.blocks[0] as { runs: unknown[] }).runs).toEqual([
      { s: 'one ' },
      { s: 'two', m: { b: 1 } },
      { s: ' three' },
    ]);
    expect(marksAt(on, 0, 4, 7).b).toBe(true);
    expect(marksAt(on, 0, 0, 7).b).toBe(false);
    const off = toggleMark(on, 0, 4, 7, 'b');
    expect((off.blocks[0] as { runs: unknown[] }).runs).toEqual([{ s: 'one two three' }]);
  });
  test('a half-marked range gets the mark on all of it', () => {
    const half = toggleMark(base(), 0, 0, 3, 'i');
    const all = toggleMark(half, 0, 0, 7, 'i');
    expect(marksAt(all, 0, 0, 7).i).toBe(true);
  });
  test('colour and highlight; the cursor reads the character before it', () => {
    let d = setColor(base(), 0, 0, 3, 'red');
    d = toggleMark(d, 0, 0, 3, 'h');
    expect(marksAt(d, 0, 0, 3)).toMatchObject({ c: 'red', h: true });
    expect(marksAt(d, 0, 2, 2).c).toBe('red');
    expect(marksAt(d, 0, 0, 0).c).toBeNull();
    d = setColor(d, 0, 0, 3, null);
    expect(marksAt(d, 0, 0, 3).c).toBeNull();
  });
  test('an empty range changes nothing', () => {
    const d = base();
    expect(toggleMark(d, 0, 3, 3, 'b')).toBe(d);
  });
});

describe('blocks', () => {
  test('split in the middle: two blocks, same kind', () => {
    const d = doc([p({ s: 'hello ' }, { s: 'world', m: { b: 1 } })]);
    const e = splitBlock(d, 0, 8);
    expect(texts(e)).toEqual(['hello wo', 'rld']);
    expect((e.blocks[1] as { runs: unknown[] }).runs).toEqual([{ s: 'rld', m: { b: 1 } }]);
  });
  test('splitting a checkbox gives an unchecked one; a list item stays a list item', () => {
    const d = doc([{ t: 'li', lvl: 2, ck: 1, runs: [{ s: 'done' }] }]);
    const e = splitBlock(d, 0, 4);
    expect(e.blocks[1]).toMatchObject({ t: 'li', lvl: 2, ck: 0 });
    expect(e.blocks[0]).toMatchObject({ ck: 1 });
  });
  test('backspace at the start merges into the previous block', () => {
    const d = doc([p({ s: 'ab' }), p({ s: 'cd', m: { i: 1 } })]);
    const r = mergeWithPrevious(d, 1);
    expect(texts(r.doc)).toEqual(['abcd']);
    expect(r).toMatchObject({ at: 2, block: 0 });
  });
  test('backspace at the start of a special block first makes it a plain paragraph', () => {
    const d = doc([p({ s: 'ab' }), { t: 'li', lvl: 1, runs: [{ s: 'cd' }] }]);
    const r = mergeWithPrevious(d, 1);
    expect(r.doc.blocks.map(kindOf)).toEqual(['p', 'p']);
    expect(texts(r.doc)).toEqual(['ab', 'cd']);
    expect(mergeWithPrevious(r.doc, 0).doc).toEqual(r.doc);
  });
  test('kinds: list, checkbox, quote, code, formula and back', () => {
    let d = doc([p({ s: 'text', m: { b: 1 } })]);
    d = setKind(d, 0, 'li');
    expect(d.blocks[0]).toMatchObject({ t: 'li', lvl: 1 });
    d = setKind(d, 0, 'ck');
    expect(kindOf(d.blocks[0])).toBe('ck');
    d = toggleChecked(d, 0);
    expect(d.blocks[0]).toMatchObject({ ck: 1 });
    d = setKind(d, 0, 'q');
    expect(d.blocks[0]).toMatchObject({ t: 'p', q: 1 });
    d = setKind(d, 0, 'code', 'python');
    expect(d.blocks[0]).toMatchObject({ t: 'p', code: 'python' });
    d = setKind(d, 0, 'fx');
    expect(d.blocks[0]).toEqual({ t: 'fx', tex: 'text' });
    d = setKind(d, 0, 'p');
    expect(blockText(d.blocks[0])).toBe('text');
    expect(setKind(d, 0, 'p')).toBe(d);
  });
  test('indent keeps the limits', () => {
    let d = doc([{ t: 'li', lvl: 1, runs: [{ s: 'a' }] }]);
    d = indent(d, 0, -1);
    expect(d.blocks[0]).toMatchObject({ lvl: 1 });
    d = indent(d, 0, 1);
    expect(d.blocks[0]).toMatchObject({ lvl: 2 });
    let q = doc([p({ s: 'a' })]);
    q = indent(q, 0, 1);
    expect(q.blocks[0]).toMatchObject({ lvl: 1 });
    q = indent(q, 0, -1);
    expect((q.blocks[0] as { lvl?: number }).lvl).toBeUndefined();
  });
  test('toggleChecked ignores non-checkbox blocks', () => {
    const d = doc([p({ s: 'a' })]);
    expect(toggleChecked(d, 0)).toBe(d);
  });
});

test('the result still round-trips through the field format', () => {
  let d = parseDoc(null);
  d = editBlockText(d, 0, 'Hello world');
  d = toggleMark(d, 0, 0, 5, 'b');
  d = splitBlock(d, 0, 5);
  d = setKind(d, 1, 'li');
  const raw = stringifyDoc(d);
  expect(texts(parseDoc(raw))).toEqual(['Hello', ' world']);
  expect(parseDoc(raw).blocks[1]).toMatchObject({ t: 'li' });
});
