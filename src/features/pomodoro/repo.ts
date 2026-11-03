import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import { pomodoroPresetUuid } from '@/core/sync/uuid5';
import type { WireValue } from '@/core/sync/types';

import {
  PRESETS_DEFAULT,
  abandonedPatch,
  elapsedSeconds,
  stamp,
  stampMs,
  type Session,
} from './logic';

const COLS =
  'uuid, mode, start_time, end_time, status, resume_time, duration_seconds, planned_duration_min, project_uuid, is_manual';

export type PresetKind = 'pomodoro' | 'pausa';

/**
 * Le sessioni del Pomodoro sul telefono. Ogni azione fa quello che fa la stessa azione di pomodoro.php (avvia, pausa, riprendi,
 * interrompi, segna completato, estendi, archivia): le durate sono sempre al netto delle pause, e si scrive subito in locale e
 * in coda. Una sola sessione può essere aperta: il server rifiuta la seconda (e il motore ritira la riga).
 */
export class PomodoroRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly userId: number | string,
    private readonly now: () => Date = () => new Date(),
    private readonly clockIso: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  /* ---------------- lettura ---------------- */

  get(uuid: string): Session | null {
    return (
      this.db.all<Session>(`SELECT ${COLS} FROM pomodoro_sessions WHERE uuid = ?`, [uuid])[0] ??
      null
    );
  }

  /** La sessione aperta (la più recente se per errore ce ne fossero due). */
  active(): Session | null {
    return (
      this.db.all<Session>(
        `SELECT ${COLS} FROM pomodoro_sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1`,
      )[0] ?? null
    );
  }

  /** L'ultima sessione, se è finita da sola («completato»): è quella che si può estendere o archiviare. */
  lastCompleted(): Session | null {
    const last = this.db.all<Session>(
      `SELECT ${COLS} FROM pomodoro_sessions ORDER BY start_time DESC, uuid DESC LIMIT 1`,
    )[0];
    return last && last.status === 'completato' ? last : null;
  }

  /** La più recente chiusa d'ufficio e non ancora segnalata: di lei parla l'avviso. */
  abandonedNotice(): Session | null {
    return (
      this.db.all<Session>(
        `SELECT ${COLS} FROM pomodoro_sessions WHERE status = 'abbandonato' ORDER BY start_time DESC LIMIT 1`,
      )[0] ?? null
    );
  }

  /** Le sessioni che cominciano in un periodo di giorni (AAAA-MM-GG, estremi inclusi), dalla più recente. */
  between(fromDay: string, toDay: string): Session[] {
    return this.db.all<Session>(
      `SELECT ${COLS} FROM pomodoro_sessions WHERE substr(start_time,1,10) BETWEEN ? AND ? ORDER BY start_time DESC`,
      [fromDay, toDay],
    );
  }

  /** I secondi di lavoro dei progetti nominati (sessioni chiuse + il pezzo già fatto di quella aperta). */
  secondsFor(projectUuids: string[]): number {
    if (!projectUuids.length) return 0;
    const ph = projectUuids.map(() => '?').join(',');
    const rows = this.db.all<Session>(
      `SELECT ${COLS} FROM pomodoro_sessions WHERE project_uuid IN (${ph})`,
      projectUuids,
    );
    const nowMs = this.now().getTime();
    return rows.reduce(
      (n, s) => n + (s.end_time === null ? elapsedSeconds(s, nowMs) : s.duration_seconds),
      0,
    );
  }

  /* ---------------- azioni ---------------- */

  private patch(uuid: string, patch: Record<string, WireValue>): void {
    const now = this.clockIso();
    patchRow(this.db, 'pomodoro_sessions', uuid, { ...patch, updated_at: now });
    enqueue(this.db, { table: 'pomodoro_sessions', uuid, op: 'upsert', patch }, now);
  }

  /** Avvia. `plannedMin` solo per il Pomodoro a tempo (1..600). Ritorna l'uuid, o null se ce n'è già una aperta. */
  start(input: { mode: 0 | 1; plannedMin?: number; projectUuid?: string | null }): string | null {
    if (this.active()) return null;
    const mode = input.mode;
    const planned =
      mode === 0 ? Math.min(600, Math.max(1, Math.round(input.plannedMin ?? 25) || 25)) : null;
    const uuid = this.newId();
    const startTime = stamp(this.now());
    const project = input.projectUuid ?? null;
    this.db.transaction(() => {
      upsertRow(this.db, 'pomodoro_sessions', {
        uuid,
        mode,
        start_time: startTime,
        end_time: null,
        status: null,
        resume_time: null,
        duration_seconds: 0,
        planned_duration_min: planned,
        project_uuid: project,
        is_manual: 0,
        updated_at: this.clockIso(),
      });
      enqueue(
        this.db,
        {
          table: 'pomodoro_sessions',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: {
            mode,
            start_time: startTime,
            duration_seconds: 0,
            planned_duration_min: planned,
            project_uuid: project,
          },
        },
        this.clockIso(),
      );
    });
    return uuid;
  }

  /** Pausa: congela i secondi fatti. `resume_time` diventa il momento della pausa (serve a «interrompi»). */
  pause(uuid: string): boolean {
    const s = this.get(uuid);
    if (!s || s.end_time !== null || s.status === 'pausa') return false;
    const seconds = elapsedSeconds(s, this.now().getTime());
    this.patch(uuid, {
      status: 'pausa',
      duration_seconds: seconds,
      resume_time: stamp(this.now()),
    });
    return true;
  }

  resume(uuid: string): boolean {
    const s = this.get(uuid);
    if (!s || s.end_time !== null || s.status !== 'pausa') return false;
    this.patch(uuid, { status: null, resume_time: stamp(this.now()) });
    return true;
  }

  /**
   * Ferma a mano. `discard` = la butta via (non resta niente). Altrimenti la chiude come «interrotto»: se era in pausa finisce
   * quando è stata messa in pausa, non adesso.
   */
  stop(uuid: string, discard = false): boolean {
    const s = this.get(uuid);
    if (!s) return false;
    if (discard) {
      this.db.transaction(() => {
        deleteRow(this.db, 'pomodoro_sessions', uuid);
        enqueue(this.db, { table: 'pomodoro_sessions', uuid, op: 'delete' }, this.clockIso());
      });
      return true;
    }
    if (s.end_time !== null) return false; // già chiusa: non si richiude
    const nowMs = this.now().getTime();
    const duration = elapsedSeconds(s, nowMs);
    const end =
      s.status === 'pausa'
        ? (s.resume_time ??
          stamp(new Date(stampMs(s.start_time) + (s.duration_seconds ?? 0) * 1000)))
        : stamp(this.now());
    this.patch(uuid, {
      duration_seconds: duration,
      end_time: end,
      status: 'interrotto',
      resume_time: null,
    });
    return true;
  }

  /** Il tempo previsto è finito: la sessione risulta completata esattamente per la durata prevista. */
  complete(uuid: string): boolean {
    const s = this.get(uuid);
    if (!s || s.end_time !== null || s.planned_duration_min === null) return false;
    const base = stampMs(s.resume_time ?? s.start_time);
    const left = s.planned_duration_min * 60 - (s.duration_seconds ?? 0);
    this.patch(uuid, {
      end_time: stamp(new Date(base + left * 1000)),
      status: 'completato',
      duration_seconds: s.planned_duration_min * 60,
      resume_time: null,
    });
    return true;
  }

  /** «Continua»: una sessione completata si allunga fino ad adesso. */
  extend(uuid: string): boolean {
    const s = this.get(uuid);
    if (!s || s.status !== 'completato' || s.end_time === null) return false;
    const nowMs = this.now().getTime();
    const extra = Math.max(0, Math.floor((nowMs - stampMs(s.end_time)) / 1000));
    const end = stampMs(s.end_time) > nowMs ? s.end_time : stamp(this.now());
    this.patch(uuid, { duration_seconds: s.duration_seconds + extra, end_time: end });
    return true;
  }

  /** «Fatto»: la sessione completata non compare più come ultima. */
  archive(uuid: string): boolean {
    const s = this.get(uuid);
    if (!s || s.status !== 'completato') return false;
    this.patch(uuid, { status: 'archiviato' });
    return true;
  }

  /** Cambia (o toglie) il progetto di una sessione aperta. */
  setProject(uuid: string, projectUuid: string | null): boolean {
    const s = this.get(uuid);
    if (!s || s.end_time !== null) return false;
    this.patch(uuid, { project_uuid: projectUuid });
    return true;
  }

  /** L'avviso «non è stato terminato correttamente» è stato letto: da qui è una normale sessione interrotta. */
  dismissNotice(uuid: string): boolean {
    const s = this.get(uuid);
    if (!s || s.status !== 'abbandonato') return false;
    this.patch(uuid, { status: 'interrotto' });
    return true;
  }

  /** Chiude d'ufficio la sessione dimenticata aperta oltre le dieci ore. Ritorna se ha chiuso qualcosa. */
  closeStale(): boolean {
    const s = this.active();
    if (!s) return false;
    const p = abandonedPatch(s, this.now().getTime());
    if (!p) return false;
    this.patch(s.uuid, p);
    return true;
  }

  /* ---------------- durate salvate ---------------- */

  /** Le durate che si vedono: quelle di fabbrica + le salvate, in ordine. */
  presets(kind: PresetKind): number[] {
    const own = this.db
      .all<{ minutes: number }>('SELECT minutes FROM pomodoro_custom_durations WHERE type = ?', [
        kind,
      ])
      .map((r) => r.minutes);
    return [...new Set<number>([...PRESETS_DEFAULT[kind], ...own])].sort((a, b) => a - b);
  }

  savePreset(kind: PresetKind, minutes: number): void {
    const m = Math.round(minutes);
    if (!(m >= 1 && m <= 600)) return;
    if ((PRESETS_DEFAULT[kind] as readonly number[]).includes(m)) return;
    if (
      this.db.all('SELECT 1 FROM pomodoro_custom_durations WHERE type = ? AND minutes = ?', [
        kind,
        m,
      ]).length
    )
      return;
    const uuid = pomodoroPresetUuid(this.userId, kind, m);
    this.db.transaction(() => {
      const now = this.clockIso();
      upsertRow(this.db, 'pomodoro_custom_durations', {
        uuid,
        type: kind,
        minutes: m,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'pomodoro_custom_durations',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { type: kind, minutes: m },
        },
        now,
      );
    });
  }

  removePreset(kind: PresetKind, minutes: number): void {
    const row = this.db.all<{ uuid: string }>(
      'SELECT uuid FROM pomodoro_custom_durations WHERE type = ? AND minutes = ?',
      [kind, minutes],
    )[0];
    if (!row) return;
    this.db.transaction(() => {
      deleteRow(this.db, 'pomodoro_custom_durations', row.uuid);
      enqueue(
        this.db,
        { table: 'pomodoro_custom_durations', uuid: row.uuid, op: 'delete' },
        this.clockIso(),
      );
    });
  }
}
