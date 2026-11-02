import { memoryDb } from '@/core/db/__tests__/testDb';

import {
  BOTH_VERSIONS_LINE,
  mergeBoth,
  NOTE_MAX,
  QuickNoteStore,
  type PutNoteResult,
  type QuickNoteApi,
  type ServerNote,
} from '../quickNote';

/** Un server finto con la stessa regola di quello vero: si scrive solo sulla versione che si conosce. */
class FakeNoteServer implements QuickNoteApi {
  note: ServerNote = { body: '', updated_at: null };
  puts = 0;
  gets = 0;
  /** per simulare chi scrive mentre l'invio è in corso */
  beforePut?: () => void;
  private tick = 0;
  async getQuickNote() {
    this.gets++;
    return { ...this.note };
  }
  async putQuickNote(body: string, base: string | null): Promise<PutNoteResult> {
    this.puts++;
    this.beforePut?.();
    if (base !== this.note.updated_at) return { conflict: true, note: { ...this.note } };
    this.note = { body, updated_at: `2026-11-05 10:00:${String(++this.tick).padStart(2, '0')}` };
    return { conflict: false, note: { ...this.note } };
  }
  /** un altro dispositivo scrive la nota */
  elsewhere(body: string) {
    this.note = { body, updated_at: `2026-11-05 11:00:${String(++this.tick).padStart(2, '0')}` };
  }
}

describe('QuickNoteStore', () => {
  test('starts empty and writes locally with nothing sent', () => {
    const s = new QuickNoteStore(memoryDb());
    expect(s.read()).toBe('');
    expect(s.hasPending()).toBe(false);
    s.write('latte');
    expect(s.read()).toBe('latte');
    expect(s.hasPending()).toBe(true);
  });

  test('writing the same text again is not a change', async () => {
    const db = memoryDb();
    const s = new QuickNoteStore(db);
    const srv = new FakeNoteServer();
    s.write('a');
    await s.sync(srv);
    expect(s.hasPending()).toBe(false);
    s.write('a');
    expect(s.hasPending()).toBe(false);
  });

  test('is cut at the same limit as the server', () => {
    const s = new QuickNoteStore(memoryDb());
    s.write('x'.repeat(NOTE_MAX + 50));
    expect(s.read()).toHaveLength(NOTE_MAX);
  });

  test('with nothing to send it downloads the server note', async () => {
    const srv = new FakeNoteServer();
    srv.elsewhere('dal sito');
    const s = new QuickNoteStore(memoryDb());
    expect(await s.sync(srv)).toBe('dal sito');
    expect(s.read()).toBe('dal sito');
    expect(srv.puts).toBe(0);
  });

  test('a local change is sent on the version it was written on', async () => {
    const srv = new FakeNoteServer();
    srv.elsewhere('uno');
    const s = new QuickNoteStore(memoryDb());
    await s.sync(srv); // scarica «uno»
    s.write('uno due');
    await s.sync(srv);
    expect(srv.note.body).toBe('uno due');
    expect(s.hasPending()).toBe(false);
    // il giro dopo è un semplice download, senza altri invii
    await s.sync(srv);
    expect(srv.puts).toBe(1);
  });

  test('a first note written offline is created on the server', async () => {
    const srv = new FakeNoteServer();
    const s = new QuickNoteStore(memoryDb());
    s.write('prima nota');
    await s.sync(srv);
    expect(srv.note.body).toBe('prima nota');
  });

  test('written on two devices: BOTH versions are kept, server first', async () => {
    const srv = new FakeNoteServer();
    srv.elsewhere('base');
    const s = new QuickNoteStore(memoryDb());
    await s.sync(srv);
    s.write('base + dal telefono');
    srv.elsewhere('base + dal sito'); // intanto il sito la cambia
    const out = await s.sync(srv);
    expect(out).toBe('base + dal sito' + BOTH_VERSIONS_LINE + 'base + dal telefono');
    expect(srv.note.body).toBe(out);
    expect(s.read()).toBe(out);
    expect(s.hasPending()).toBe(false);
  });

  test('text typed while the request is in flight stays to be sent', async () => {
    const srv = new FakeNoteServer();
    const s = new QuickNoteStore(memoryDb());
    s.write('ciao');
    srv.beforePut = () => s.write('ciao mondo');
    await s.sync(srv);
    expect(srv.note.body).toBe('ciao');
    expect(s.read()).toBe('ciao mondo');
    expect(s.hasPending()).toBe(true);
    srv.beforePut = undefined;
    await s.sync(srv);
    expect(srv.note.body).toBe('ciao mondo');
    expect(s.hasPending()).toBe(false);
  });

  test('a network failure keeps the text and the pending flag', async () => {
    const s = new QuickNoteStore(memoryDb());
    s.write('importante');
    const down: QuickNoteApi = {
      getQuickNote: async () => {
        throw new TypeError('offline');
      },
      putQuickNote: async () => {
        throw new TypeError('offline');
      },
    };
    await expect(s.sync(down)).rejects.toBeInstanceOf(TypeError);
    expect(s.read()).toBe('importante');
    expect(s.hasPending()).toBe(true);
  });

  test('the note survives reopening the database store', async () => {
    const db = memoryDb();
    new QuickNoteStore(db).write('resta');
    expect(new QuickNoteStore(db).read()).toBe('resta');
  });
});

describe('mergeBoth', () => {
  test('same, empty or already included: no doubling', () => {
    expect(mergeBoth('a', 'a')).toBe('a');
    expect(mergeBoth('a', '  ')).toBe('a');
    expect(mergeBoth('  ', 'b')).toBe('b');
    expect(mergeBoth('a\nb\nc', 'b')).toBe('a\nb\nc');
  });
  test('different: server first, then mine', () => {
    expect(mergeBoth('S', 'M')).toBe('S' + BOTH_VERSIONS_LINE + 'M');
  });
});
