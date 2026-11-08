import { writeFileSync } from 'node:fs';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { crc32, zipStore } from '@/core/files/zipStore';

import {
  buildCsv,
  buildXlsx,
  exportSheets,
  exportStem,
  sheetNames,
  type Sheet,
} from '../exportFile';
import { HabitCategoriesRepo, HabitsRepo } from '../repo';

/** Legge uno ZIP «stored» come farebbe Excel: elenco finale, poi ogni file con il suo CRC. */
function readZip(bytes: Uint8Array): Record<string, string> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
  expect(end).toBeGreaterThanOrEqual(0);
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const crc = v.getUint32(at + 16, true);
    const size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.slice(at + 46, at + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = bytes.slice(start, start + size);
    expect(crc32(data)).toBe(crc);
    out[name] = new TextDecoder().decode(data);
    at += 46 + nameLen;
  }
  return out;
}

describe('zip (stored)', () => {
  test('crc32 matches the known value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  test('files come back with their names, texts (UTF-8) and checksums', () => {
    const zip = zipStore([
      { name: 'a.txt', data: 'ciao è così' },
      { name: 'dir/b.xml', data: new Uint8Array([1, 2, 3]) },
    ]);
    const back = readZip(zip);
    expect(Object.keys(back)).toEqual(['a.txt', 'dir/b.xml']);
    expect(back['a.txt']).toBe('ciao è così');
  });
});

describe('habit export', () => {
  function setup() {
    const db = memoryDb();
    migrate(db);
    const cats = new HabitCategoriesRepo(db);
    const habits = new HabitsRepo(db, undefined, undefined, () => '2026-11-08');
    const health = cats.create('Health');
    const water = habits.create({
      name: 'Drink <water> & "more"',
      goal_type: 'quantity',
      target_amount: 2,
      step_amount: 1,
      unit: 'glasses',
      category_uuid: health,
    });
    const read = habits.create({ name: 'Read', motivation: 'Books!' });
    habits.create({ name: 'Never done' });
    habits.checkIn(water, '2026-11-01', 'increment');
    habits.checkIn(water, '2026-11-01', 'increment'); // 2 di 2: fatto
    habits.checkIn(water, '2026-11-02', 'increment'); // 1 di 2: parziale, non si esporta
    habits.checkIn(read, '2026-11-03', 'toggle');
    habits.setNote(read, '2026-11-03', { note: 'Chapter "1", good', mood: 4 });
    return { db, habits, water, read };
  }

  test('only done days, one sheet per habit, in the website format', () => {
    const { db } = setup();
    const sheets = exportSheets(db);
    expect(sheets.map((s) => s.name)).toEqual(['Drink <water> & "more"', 'Read']);
    const [w, r] = sheets as [Sheet, Sheet];
    expect(w.range).toBe('Date:2026-11-01~2026-11-01');
    expect(w.rows).toHaveLength(1);
    expect(w.rows[0]!.slice(0, 1).concat(w.rows[0]!.slice(2))).toEqual([
      '2026-11-01',
      'Completed',
      '2',
      '',
      '',
    ]);
    expect(w.title).toContain('Habit Name: Drink <water> & "more"');
    expect(w.title).toContain('Goal: 2 glasses/day');
    expect(w.title).toContain('Section: Health');
    expect(w.title).toContain('Frequency: every day');
    expect(r.title).toContain('Quote: Books!');
    expect(r.title).toContain('Section: Others');
    expect(r.rows[0]!.slice(2)).toEqual(['Completed', '1', '4', 'Chapter "1", good']);
    expect(r.rows[0]![1]).toMatch(/^\d\d:\d\d$/); // l'ora del primo check-in
  });

  test('the .xlsx is a valid zip with a workbook, styles and one sheet per habit', () => {
    const { db } = setup();
    const files = readZip(buildXlsx(exportSheets(db)));
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    // il nome del foglio e il testo sono scritti in XML (niente < & " sciolti)
    expect(files['xl/workbook.xml']).toContain('name="Drink &lt;water&gt; &amp; &quot;more&quot;"');
    expect(files['xl/worksheets/sheet2.xml']).toContain('Chapter &quot;1&quot;, good');
    expect(files['xl/worksheets/sheet1.xml']).toContain('<c r="A4" t="inlineStr">');
    expect(files['xl/worksheets/sheet1.xml']).toContain('>Total check-ins<');
    if (process.env.EXPORT_SAMPLE)
      writeFileSync(process.env.EXPORT_SAMPLE, buildXlsx(exportSheets(db)));
  });

  test('csv: one line per done day, quoted when needed, with the BOM', () => {
    const { db } = setup();
    const csv = buildCsv(exportSheets(db));
    expect(csv.startsWith('\uFEFFHabit,Date,Time,Status,Total check-ins,Mood,Habit Log\r\n')).toBe(
      true,
    );
    expect(csv).toContain('"Drink <water> & ""more""",2026-11-01,');
    expect(csv).toContain('Read,2026-11-03,');
    expect(csv).toContain('"Chapter ""1"", good"');
  });

  test('sheet names are cleaned, cut at 31 characters and never repeated', () => {
    expect(sheetNames(['a/b:c?', '  ', 'x'.repeat(40), 'x'.repeat(40), 'Read', 'Read'])).toEqual([
      'a-b-c-',
      'Habit',
      'x'.repeat(31),
      'x'.repeat(27) + ' (2)',
      'Read',
      'Read (2)',
    ]);
  });

  test('no done day, no sheet; the file name follows the website', () => {
    const db = memoryDb();
    migrate(db);
    expect(exportSheets(db)).toEqual([]);
    expect(exportStem(new Date(2026, 10, 8))).toBe('Habits_20261108');
  });
});
