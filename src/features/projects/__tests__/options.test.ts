import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';

import { isRichNote, noteText } from '../notes';
import { DEFAULT_PROJECT_OPTIONS, ProjectOptionsStore, cleanProjectOptions } from '../options';

describe('project options', () => {
  test('start like the website, and bad values are put right', () => {
    const db = memoryDb();
    migrate(db);
    const store = new ProjectOptionsStore(db);
    expect(store.read()).toEqual(DEFAULT_PROJECT_OPTIONS);
    expect(store.write({ ordine: 'scadenza', completati: false })).toMatchObject({
      ordine: 'scadenza',
      completati: false,
      mostra_tag: true,
    });
    expect(store.read().ordine).toBe('scadenza');
    expect(cleanProjectOptions({ ordine: 'boh', completati: 0, solo_attivi: 1 })).toMatchObject({
      ordine: 'manuale',
      completati: false,
      solo_attivi: true,
    });
  });

  test('closed branches are remembered; nothing saved = null', () => {
    const db = memoryDb();
    migrate(db);
    const store = new ProjectOptionsStore(db);
    expect(store.collapsed()).toBeNull();
    store.saveCollapsed(['a', 'b']);
    expect([...store.collapsed()!]).toEqual(['a', 'b']);
  });
});

describe('notes', () => {
  const rich = JSON.stringify({
    v: 2,
    blocks: [
      { t: 'p', runs: [{ s: 'Hello ' }, { s: 'world' }] },
      { t: 'fx', tex: 'x^2' },
      { t: 'p', runs: [] },
      { t: 'p', runs: [{ s: 'End' }] },
    ],
  });
  test('a rich note is read as text, formulas included; plain text stays as it is', () => {
    expect(isRichNote(rich)).toBe(true);
    expect(noteText(rich)).toBe('Hello world\nx^2\n\nEnd');
    expect(isRichNote('just text')).toBe(false);
    expect(noteText('just text')).toBe('just text');
    expect(isRichNote('{not json')).toBe(false);
    expect(noteText('')).toBe('');
  });
});
