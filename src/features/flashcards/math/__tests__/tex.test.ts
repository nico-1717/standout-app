import { heightOf, parseTex, type Node } from '../tex';

const ch = (s: string, v: 'it' | 'rm' | 'b' | 'tt' = 'it'): Node => ({ k: 'ch', s, v });

describe('parseTex', () => {
  test('letters are italic, digits and signs upright, minus is a real minus', () => {
    expect(parseTex('a+1')).toEqual({ k: 'row', c: [ch('a'), ch('+', 'rm'), ch('1', 'rm')] });
    expect(parseTex('-')).toEqual(ch('−', 'rm'));
  });

  test('fractions, with groups or single characters', () => {
    expect(parseTex('\\frac{a}{b}')).toEqual({ k: 'frac', n: ch('a'), d: ch('b'), bar: true });
    expect(parseTex('\\frac12')).toEqual({
      k: 'frac',
      n: ch('1', 'rm'),
      d: ch('2', 'rm'),
      bar: true,
    });
  });

  test('powers and indexes, also together', () => {
    expect(parseTex('x^2')).toEqual({ k: 'sup', b: ch('x'), s: ch('2', 'rm') });
    expect(parseTex('x_{i}')).toEqual({ k: 'sub', b: ch('x'), s: ch('i') });
    expect(parseTex('x_i^2')).toMatchObject({ k: 'subsup', lo: ch('i'), hi: ch('2', 'rm') });
    expect(parseTex('x^2_i')).toMatchObject({ k: 'subsup', lo: ch('i'), hi: ch('2', 'rm') });
  });

  test('roots with and without an index', () => {
    expect(parseTex('\\sqrt{x}')).toEqual({ k: 'sqrt', c: ch('x') });
    expect(parseTex('\\sqrt[3]{x}')).toEqual({ k: 'sqrt', c: ch('x'), n: ch('3', 'rm') });
  });

  test('sums and integrals take their limits', () => {
    expect(parseTex('\\sum_{i=1}^{n}')).toMatchObject({
      k: 'op',
      s: '∑',
      limits: true,
      lo: { k: 'row' },
      hi: ch('n'),
    });
    expect(parseTex('\\int_0^1')).toMatchObject({
      k: 'op',
      s: '∫',
      limits: false,
      lo: ch('0', 'rm'),
      hi: ch('1', 'rm'),
    });
    expect(parseTex('\\lim_{x\\to 0}')).toMatchObject({ k: 'op', s: 'lim', limits: true });
  });

  test('greek letters, symbols and function names', () => {
    expect(parseTex('\\alpha')).toEqual(ch('α'));
    expect(parseTex('\\Omega')).toEqual(ch('Ω', 'rm'));
    expect(parseTex('\\le')).toEqual(ch('≤', 'rm'));
    expect(parseTex('\\sin')).toEqual({ k: 'row', c: [ch('sin', 'rm'), { k: 'sp', w: 0.17 }] });
    expect(parseTex('\\infty')).toEqual(ch('∞', 'rm'));
  });

  test('\\left … \\right keeps both brackets and what is inside', () => {
    expect(parseTex('\\left(x\\right)')).toEqual({ k: 'delim', l: '(', r: ')', c: ch('x') });
    expect(parseTex('\\left.x\\right|')).toEqual({ k: 'delim', l: '', r: '|', c: ch('x') });
  });

  test('text stays as written, with spaces', () => {
    expect(parseTex('\\text{se } x')).toEqual({
      k: 'row',
      c: [ch('se ', 'rm'), ch('x')],
    });
  });

  test('matrices and cases', () => {
    const m = parseTex('\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}');
    expect(m).toMatchObject({ k: 'mat', l: '(', r: ')' });
    expect((m as Extract<Node, { k: 'mat' }>).rows.map((r) => r.length)).toEqual([2, 2]);
    const c = parseTex('\\begin{cases}1&x>0\\\\0&x\\le0\\end{cases}');
    expect(c).toMatchObject({ k: 'mat', l: '{', r: '', left: true });
  });

  test('accents and binomials', () => {
    expect(parseTex('\\vec{v}')).toEqual({ k: 'acc', c: ch('v'), a: 'vec' });
    expect(parseTex('\\overline{AB}')).toMatchObject({ k: 'acc', a: 'bar' });
    expect(parseTex('\\binom{n}{k}')).toMatchObject({
      k: 'delim',
      l: '(',
      r: ')',
      c: { k: 'frac', bar: false },
    });
  });

  test('prime marks and unknown commands do not break it', () => {
    expect(parseTex("f'")).toEqual({
      k: 'row',
      c: [ch('f'), { k: 'sup', b: { k: 'row', c: [] }, s: ch('′', 'rm') }],
    });
    expect(parseTex('\\foo')).toEqual(ch('\\foo', 'tt'));
  });

  test('broken input never throws', () => {
    for (const bad of [
      '',
      '{',
      '}',
      '\\frac{a',
      '\\left(',
      '^',
      '_{',
      '\\begin{pmatrix}a&',
      '\\',
      'x^^2',
      '}{',
    ]) {
      expect(() => parseTex(bad)).not.toThrow();
    }
  });
});

describe('heightOf', () => {
  test('a letter is 1, a fraction is taller, brackets follow what is inside', () => {
    expect(heightOf(parseTex('x'))).toBe(1);
    expect(heightOf(parseTex('\\frac{a}{b}'))).toBeGreaterThanOrEqual(2.2);
    expect(heightOf(parseTex('\\left(\\frac{a}{\\frac{b}{c}}\\right)'))).toBeGreaterThan(
      heightOf(parseTex('\\frac{a}{b}')),
    );
    expect(heightOf(parseTex('\\sum_{i=1}^{n}'))).toBeGreaterThan(2.5);
  });
});
