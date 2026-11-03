import {
  bulletFor,
  docToPlain,
  normDoc,
  parseDoc,
  plainToDoc,
  plainToField,
  stringifyDoc,
  trimDocText,
} from '../doc';
import cases from './fixtures/doc.json';

interface Case {
  input: string;
  parse: unknown;
  trimmed: string;
  plain: string;
}

describe('card document: same results as the website parser', () => {
  test.each((cases as Case[]).map((c, i) => [i, c.input.slice(0, 40), c] as const))(
    'case %i: %j',
    (_i, _name, c) => {
      expect(parseDoc(c.input)).toEqual(c.parse);
      expect(trimDocText(c.input)).toBe(c.trimmed);
      expect(docToPlain(parseDoc(c.input))).toBe(c.plain);
    },
  );
});

describe('card document helpers', () => {
  test('plain text round trip', () => {
    const doc = plainToDoc('uno\n\ndue');
    expect(doc.blocks.map((b) => b.t)).toEqual(['p', 'p', 'p']);
    expect(docToPlain(doc)).toBe('uno\n\ndue');
  });
  test('the field keeps the new JSON format and drops outer blank lines', () => {
    const f = plainToField('\n  ciao  \n')!;
    expect(JSON.parse(f)).toEqual({ v: 2, blocks: [{ t: 'p', runs: [{ s: 'ciao' }] }] });
    expect(plainToField('   ')).toBeNull();
  });
  test('stringify is stable: parse then stringify twice gives the same text', () => {
    const once = stringifyDoc(parseDoc('/bold{a} /red{b}'));
    expect(stringifyDoc(parseDoc(once))).toBe(once);
  });
  test('garbage is not a document', () => {
    expect(normDoc(null).blocks).toHaveLength(1);
    expect(normDoc({ blocks: 5 }).blocks).toHaveLength(1);
  });
  test('bullets change shape with depth and start again after six', () => {
    expect(bulletFor(1)).toBe('•');
    expect(bulletFor(2)).toBe('◦');
    expect(bulletFor(7)).toBe('•');
    expect(bulletFor(0)).toBe('•');
  });
});
