import { colLetter, columnsOf } from '../columns';

test('colLetter counts like a spreadsheet', () => {
  expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(colLetter)).toEqual([
    'A',
    'B',
    'Z',
    'AA',
    'AB',
    'AZ',
    'BA',
    'ZZ',
    'AAA',
  ]);
});

test('columnsOf gives the names, letters and the first values below the header', () => {
  const sheet = {
    name: 's',
    rows: [
      ['Date', '', 'Note'],
      ['2026-11-01', '', 'a'],
      ['', '', ''],
      ['2026-11-02', 'x', 'b'],
      ['2026-11-03', 'y', 'c'],
      ['2026-11-04', 'z', 'd'],
    ],
  };
  const cols = columnsOf(sheet, 0);
  expect(cols.map((c) => [c.letter, c.name])).toEqual([
    ['A', 'Date'],
    ['B', ''],
    ['C', 'Note'],
  ]);
  expect(cols[0]!.samples).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  expect(cols[1]!.samples).toEqual(['x', 'y', 'z']);
  // senza intestazione si guarda dalla prima riga
  expect(columnsOf(sheet, -1)[0]!.samples[0]).toBe('Date');
});
