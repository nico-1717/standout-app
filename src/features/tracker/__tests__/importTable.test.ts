import { cleanUrl, hostOf, parseTable } from '../importTable';

describe('parseTable', () => {
  it('reads a copied spreadsheet (tabs) with a header row', () => {
    const t = parseTable('Name\tDone\nTwo Sum\t1\nLRU Cache\t0');
    expect(t).toMatchObject({ cols: 2, rows: 3 });
    expect(t?.cells).toMatchObject({ A1: 'Name', B1: 'Done', A2: 'Two Sum', B3: '0' });
  });

  it('reads CSV with quotes, and semicolons', () => {
    expect(parseTable('a,b\n"x, y",2')?.cells).toMatchObject({ A2: 'x, y', B2: '2' });
    expect(parseTable('a;b\n1;2')?.cells).toMatchObject({ B2: '2' });
  });

  it('reads a JSON list of objects, using the keys as the header row', () => {
    const t = parseTable('[{"day":"Mon","min":30},{"day":"Tue","min":45}]');
    expect(t?.cells).toMatchObject({ A1: 'day', B1: 'min', A2: 'Mon', B3: '45' });
  });

  it('keeps only what fits (12 columns, 200 rows)', () => {
    const row = Array.from({ length: 20 }, (_, i) => i).join(',');
    const t = parseTable(Array.from({ length: 300 }, () => row).join('\n'));
    expect(t).toMatchObject({ cols: 12, rows: 200 });
  });

  it('says no for text that is not a table', () => {
    expect(parseTable('')).toBeNull();
    expect(parseTable('just one word')).toBeNull();
  });
});

describe('addresses', () => {
  it('accepts only https with a site name', () => {
    expect(cleanUrl(' https://leetcode.com/u/nico ')).toBe('https://leetcode.com/u/nico');
    expect(cleanUrl('http://leetcode.com')).toBeNull();
    expect(cleanUrl('javascript:alert(1)')).toBeNull();
    expect(cleanUrl('https://localhost')).toBeNull();
  });
  it('shows just the host as a title', () => {
    expect(hostOf('https://neetcode.io/practice?x=1')).toBe('neetcode.io');
  });
});
