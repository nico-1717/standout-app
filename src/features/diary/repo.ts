import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireValue } from '@/core/sync/types';
import { diaryDayUuid } from '@/core/sync/uuid5';
import { addDays } from '@/features/habits/logic';
import type { Habit, HabitLog } from '@/features/habits/logic';

import {
  diaryRings,
  habitsOfTheDay,
  ITEM_MAX,
  ITEMS_PER_LIST,
  NOTE_MAX,
  summariseMonth,
  weeklyOfTheDay,
  type DiaryDay,
  type DiaryItem,
  type ListType,
  type MonthSummary,
  type Ring,
} from './logic';

/** sha1 del testo vuoto: il telefono che non ha mai visto quel giorno dice «io avevo visto il vuoto». */
export const EMPTY_NOTE_REV = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';

interface JournalRow {
  uuid: string;
  entry_date: string;
  mood: number | null;
  energy: number | null;
  note: string | null;
  note_rev: string | null;
}

export interface DayExtras {
  rings: Ring[];
  habits: ReturnType<typeof habitsOfTheDay>;
  weekly: ReturnType<typeof weeklyOfTheDay>;
}

/**
 * Il diario sul telefono: un giorno è UNA riga (utente, giorno), con identità UUIDv5; i due elenchi
 * («cose belle», «cose imparate») sono righe a parte. Tutto si scrive subito in locale e si invia dopo.
 *
 * Il testo non si perde: ogni modifica porta `note_rev`, l'impronta del testo che il server aveva quando
 * il telefono l'ha visto l'ultima volta. Se nel frattempo il server è cambiato, il server tiene TUTTE E DUE
 * le versioni (vedi lib/sync_diario.php) e le rimanda al telefono.
 */
export class DiaryRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly userId: number | string,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  private journal(date: string): JournalRow | null {
    return (
      this.db.all<JournalRow>(
        'SELECT uuid, entry_date, mood, energy, note, note_rev FROM habit_daily_journal WHERE entry_date = ?',
        [date],
      )[0] ?? null
    );
  }

  private items(date: string, type: ListType): DiaryItem[] {
    return this.db.all<DiaryItem>(
      `SELECT uuid, content, sort_order FROM diary_list_items
       WHERE entry_date = ? AND list_type = ? ORDER BY sort_order, uuid`,
      [date, type],
    );
  }

  /** Il giorno: umore, energia, testo e i due elenchi. */
  day(date: string): DiaryDay {
    const j = this.journal(date);
    return {
      date,
      mood: j?.mood ?? null,
      energy: j?.energy ?? null,
      note: j?.note ?? '',
      good: this.items(date, 'good'),
      learned: this.items(date, 'learned'),
    };
  }

  /** Gli anelli, le abitudini del giorno e quelle della settimana: dai dati delle abitudini sul telefono. */
  extras(date: string, habits: Habit[], logsAround: HabitLog[]): DayExtras {
    return {
      rings: diaryRings(habits, logsAround, date),
      habits: habitsOfTheDay(habits, logsAround, date),
      weekly: weeklyOfTheDay(habits, logsAround, date),
    };
  }

  /** Scrive i campi nominati di un giorno (null toglie). Crea la riga se serve. */
  private write(date: string, fields: Record<string, WireValue>): void {
    this.db.transaction(() => {
      const now = this.clock();
      const cur = this.journal(date);
      const uuid = cur?.uuid ?? diaryDayUuid(this.userId, date);
      const patch: Record<string, WireValue> = { ...fields };
      if ('note' in fields) {
        // la base del confronto: quello che il server aveva l'ultima volta; mai visto = il vuoto
        patch.note_rev = cur ? (cur.note_rev ?? EMPTY_NOTE_REV) : EMPTY_NOTE_REV;
      }
      if (cur) {
        patchRow(this.db, 'habit_daily_journal', uuid, { ...fields, updated_at: now });
      } else {
        upsertRow(this.db, 'habit_daily_journal', {
          uuid,
          entry_date: date,
          mood: null,
          energy: null,
          note: '',
          note_rev: patch.note_rev ?? null,
          created_at: now,
          updated_at: now,
          ...fields,
        });
        patch.entry_date = date;
      }
      enqueue(
        this.db,
        { table: 'habit_daily_journal', uuid, op: 'upsert', patch, isCreate: !cur },
        now,
      );
    });
  }

  setMood(date: string, mood: number | null): void {
    this.write(date, { mood: clampFace(mood) });
  }

  setEnergy(date: string, energy: number | null): void {
    this.write(date, { energy: clampFace(energy) });
  }

  setNote(date: string, note: string): void {
    const text = note.slice(0, NOTE_MAX);
    if (text === (this.journal(date)?.note ?? '')) return; // niente da inviare
    this.write(date, { note: text });
  }

  /** Aggiunge una voce in fondo all'elenco. Un testo vuoto o un elenco pieno non fa nulla. */
  addItem(date: string, type: ListType, content: string): string | null {
    const text = content.trim().slice(0, ITEM_MAX);
    if (!text) return null;
    const existing = this.items(date, type);
    if (existing.length >= ITEMS_PER_LIST) return null;
    const uuid = this.newId();
    const order = (existing.at(-1)?.sort_order ?? 0) + 1;
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'diary_list_items', {
        uuid,
        entry_date: date,
        list_type: type,
        content: text,
        sort_order: order,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'diary_list_items',
          uuid,
          op: 'upsert',
          patch: { entry_date: date, list_type: type, content: text },
          isCreate: true,
        },
        now,
      );
    });
    return uuid;
  }

  /** Cambia il testo di una voce; svuotarla la toglie (come sul sito). */
  editItem(uuid: string, content: string): void {
    const text = content.trim().slice(0, ITEM_MAX);
    if (!text) return this.removeItem(uuid);
    this.db.transaction(() => {
      const now = this.clock();
      if (!patchRow(this.db, 'diary_list_items', uuid, { content: text, updated_at: now })) return;
      enqueue(
        this.db,
        { table: 'diary_list_items', uuid, op: 'upsert', patch: { content: text } },
        now,
      );
    });
  }

  removeItem(uuid: string): void {
    this.db.transaction(() => {
      deleteRow(this.db, 'diary_list_items', uuid);
      enqueue(this.db, { table: 'diary_list_items', uuid, op: 'delete' }, this.clock());
    });
  }

  /** Un mese («AAAA-MM»): i giorni scritti, le medie, le cose imparate. */
  month(month: string): MonthSummary {
    const from = `${month}-01`;
    const to = `${month}-31`;
    return summariseMonth(
      month,
      this.db.all(
        `SELECT entry_date, mood, energy, note FROM habit_daily_journal WHERE entry_date BETWEEN ? AND ?`,
        [from, to],
      ),
      this.db.all(
        `SELECT entry_date, list_type, content FROM diary_list_items
         WHERE entry_date BETWEEN ? AND ? AND content <> '' ORDER BY entry_date, sort_order, uuid`,
        [from, to],
      ),
    );
  }

  /** Tutti i giorni con qualcosa di scritto, dal più recente (per sfogliare e per la lettura). */
  writtenDays(): string[] {
    return this.db
      .all<{ d: string }>(
        `SELECT entry_date AS d FROM habit_daily_journal WHERE trim(coalesce(note,'')) <> '' OR mood IS NOT NULL OR energy IS NOT NULL
         UNION SELECT entry_date FROM diary_list_items WHERE content <> '' ORDER BY d DESC`,
      )
      .map((r) => r.d);
  }

  /** Il giorno prima/dopo (il quaderno si sfoglia). */
  static step(date: string, n: number): string {
    return addDays(date, n);
  }
}

function clampFace(v: number | null): number | null {
  if (v === null || !Number.isFinite(v) || v === 0) return null;
  return Math.min(5, Math.max(1, Math.round(v)));
}
