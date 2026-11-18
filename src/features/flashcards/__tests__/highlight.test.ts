import { normDoc } from '../doc';
import { codeGroups, codeSegments } from '../codeBlocks';
import { detectLang, highlightGroup } from '../highlight';

const kinds = (line: string, lang: string) =>
  highlightGroup([line], lang)[0]!.map((t) => `${t.t ?? '-'}:${t.s}`);

describe('code colouring (same rules as the website)', () => {
  test('python: keywords, functions, numbers, comments and strings', () => {
    expect(kinds('for x in range(3): # go', 'python')).toEqual([
      'k:for',
      '-: x ',
      'k:in',
      '-: ',
      'f:range',
      '-:(',
      'n:3',
      '-:): ',
      'c:# go',
    ]);
    expect(kinds('s = "a b"', 'python')).toEqual(['-:s = ', 's:"a b"']);
    // il testo rimesso insieme dà sempre la riga
    const line = 'seen = Counter({0: 1}) # "x"';
    expect(
      highlightGroup([line], 'python')[0]!
        .map((t) => t.s)
        .join(''),
    ).toBe(line);
  });

  test('types (Capitalised words) are blue, and a comment can span lines', () => {
    expect(kinds('seen = Counter(x)', 'python')[1]).toBe('f:Counter');
    expect(kinds('List y', 'java')[0]).toBe('t:List');
    const g = highlightGroup(['/* a', 'b */ int x;'], 'cpp');
    expect(g[0]).toEqual([{ t: 'c', s: '/* a' }]);
    expect(g[1]![0]).toEqual({ t: 'c', s: 'b */' });
    const py = highlightGroup(['"""doc', 'more"""', 'x = 1'], 'python');
    expect(py[0]).toEqual([{ t: 's', s: '"""doc' }]);
    expect(py[1]).toEqual([{ t: 's', s: 'more"""' }]);
  });

  test('the language is recognised from the code', () => {
    expect(detectLang('def f(x):\n    return x')).toBe('python');
    expect(detectLang('#include <iostream>\nint main() {}')).toBe('cpp');
    expect(detectLang('SELECT a FROM t WHERE a = 1')).toBe('sql');
    expect(detectLang('just words')).toBe('other');
  });

  test('groups: lines in a row share one box, language from the first line', () => {
    const d = normDoc({
      v: 2,
      blocks: [
        { t: 'p', runs: [{ s: 'text' }] },
        { t: 'p', code: 'auto', runs: [{ s: 'def f(x):' }] },
        { t: 'p', code: 'auto', runs: [{ s: '    return x' }] },
        { t: 'p', runs: [{ s: 'text' }] },
        { t: 'p', code: 'cpp', runs: [{ s: 'int a;' }] },
      ],
    });
    const g = codeGroups(d.blocks);
    expect([...g.byStart.keys()]).toEqual([1, 4]);
    expect(g.byStart.get(1)).toMatchObject({ start: 1, end: 2, lang: 'python', label: 'Python' });
    expect(g.byStart.get(4)).toMatchObject({ lang: 'cpp', label: 'C++' });
    expect(g.at(2)!.line).toBe(1);
    expect(g.at(0)).toBeNull();
  });

  test('marks inside code are kept on top of the colours', () => {
    const runs = [{ s: 'for ', m: undefined }, { s: 'x', m: { b: 1 } }, { s: ' in y' }];
    const toks = highlightGroup(['for x in y'], 'python')[0]!;
    const segs = codeSegments(runs, toks);
    expect(segs.map((s) => s.s).join('')).toBe('for x in y');
    expect(segs.find((s) => s.s === 'x')!.m).toEqual({ b: 1 });
    expect(segs[0]).toMatchObject({ s: 'for', tk: 'k' });
  });
});
