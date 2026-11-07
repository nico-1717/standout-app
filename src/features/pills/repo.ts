import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireRow, WireValue } from '@/core/sync/types';
import { doseUuid } from '@/core/sync/uuid5';
import { addDaysIso as addDays } from '@/features/tasks/groups';

import {
  CATCH_UP_DAYS,
  LATE_DAYS,
  cleanPlan,
  daysBefore,
  dosesFor,
  historyOf,
  markAll,
  parseTimes,
  rhythmChanged,
  scheduleFromFor,
  setDayCount,
  type Dose,
  type DoseChange,
  type DoseSpec,
  type DoseStatus,
  type HistoryDay,
  type PillPlan,
  type PlanInput,
} from './logic';

/** Adesso sul telefono, «AAAA-MM-GG HH:MM:SS»: l'ora vera di una spunta (come la scrive il sito). */
export function localStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Una presa con i dati della sua terapia (quello che serve a disegnare la riga). */
export interface DoseView extends Dose {
  name: string;
  plan_dose: string;
  color: string;
  notes: string;
}

export interface DayView {
  date: string;
  doses: DoseView[];
  /** le prese rimaste in sospeso nei giorni scorsi */
  late: DoseView[];
  stats: { taken: number; skipped: number; missed: number };
}

/** Il numero massimo di terapie (lo stesso del server). */
export const MAX_PLANS = 100;

const PLAN_FIELDS = [
  'name',
  'dose',
  'notes',
  'color',
  'freq_type',
  'weekdays',
  'month_days',
  'interval_days',
  'times',
  'start_date',
  'end_date',
  'is_active',
] as const;

const DOSE_SELECT = `SELECT d.*, p.name AS name, p.dose AS plan_dose, p.color AS color, p.notes AS notes
  FROM pill_doses d JOIN pill_plans p ON p.uuid = d.plan_uuid`;

/** Il lavoro dell'utente sulle pastiglie. Come per le altre aree: la riga e la coda dell'invio nella stessa transazione. */
export class PillsRepo {
  constructor(
    private readonly db: SqlDb,
    /** oggi sul telefono, «AAAA-MM-GG» */
    private readonly today: () => string,
    /** adesso sul telefono, «AAAA-MM-GG HH:MM:SS» (l'ora vera di una spunta) */
    private readonly nowLocal: () => string,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  /* ---------------- terapie ---------------- */

  /** Prima le attive, poi nell'ordine in cui sono state fatte (come il sito). */
  plans(): PillPlan[] {
    return this.db.all<PillPlan>(
      'SELECT * FROM pill_plans ORDER BY is_active DESC, created_at, uuid',
    );
  }

  plan(uuid: string): PillPlan | null {
    return this.db.all<PillPlan>('SELECT * FROM pill_plans WHERE uuid = ?', [uuid])[0] ?? null;
  }

  private toRow(p: PlanInput): Record<string, WireValue> {
    return { ...p };
  }

  /** Crea una terapia. Lancia `Error('invalid:<campo>')` se un campo non va (gli stessi controlli del server). */
  createPlan(input: PlanInput): string {
    const c = cleanPlan(input);
    if (!c.ok) throw new Error(`invalid:${c.error.field}`);
    if (this.plans().length >= MAX_PLANS) throw new Error('invalid:name');
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      const row: WireRow = {
        uuid,
        ...this.toRow(c.plan),
        schedule_from: c.plan.start_date,
        created_at: now,
        updated_at: now,
      } as WireRow;
      upsertRow(this.db, 'pill_plans', row);
      enqueue(
        this.db,
        { table: 'pill_plans', uuid, op: 'upsert', patch: this.toRow(c.plan), isCreate: true },
        now,
      );
      this.ensureDays([this.today()]);
    });
    return uuid;
  }

  /**
   * Cambia una terapia. Il ritmo cambiato (orari, giorni) vale da oggi, o da domani se oggi una presa è già
   * stata segnata; le prese in sospeso da quel giorno in poi si rifanno, quelle già segnate non si toccano mai.
   */
  updatePlan(uuid: string, input: PlanInput): void {
    const c = cleanPlan(input);
    if (!c.ok) throw new Error(`invalid:${c.error.field}`);
    this.db.transaction(() => {
      const before = this.plan(uuid);
      if (!before) return;
      const today = this.today();
      const after = c.plan;
      const changed = rhythmChanged(before, after);
      const signedToday =
        this.db.all<{ n: number }>(
          `SELECT COUNT(*) AS n FROM pill_doses WHERE plan_uuid = ? AND due_date = ? AND status <> 'pending'`,
          [uuid, today],
        )[0]!.n > 0;
      const validFrom = scheduleFromFor({
        before,
        changed,
        startDate: after.start_date,
        today,
        signedToday,
      });
      const now = this.clock();
      const patch: Record<string, WireValue> = {};
      const local = this.toRow(after);
      for (const f of PLAN_FIELDS) {
        const was = f === 'is_active' ? !!before.is_active : before[f];
        if (local[f] !== was) patch[f] = local[f] as WireValue;
      }
      patchRow(this.db, 'pill_plans', uuid, {
        ...local,
        schedule_from: validFrom,
        updated_at: now,
      });
      if (Object.keys(patch).length) {
        enqueue(this.db, { table: 'pill_plans', uuid, op: 'upsert', patch }, now);
      }
      // le prese ancora da prendere si rifanno solo DA QUANDO vale il ritmo nuovo
      const stale = this.db
        .all<{ uuid: string }>(
          `SELECT uuid FROM pill_doses WHERE plan_uuid = ? AND due_date >= ? AND status = 'pending'`,
          [uuid, validFrom],
        )
        .map((r) => r.uuid);
      this.db.run(
        `DELETE FROM pill_doses WHERE plan_uuid = ? AND due_date >= ? AND status = 'pending'`,
        [uuid, validFrom],
      );
      this.dropQueued(stale);
      this.ensureDays([today]);
    });
  }

  /** Toglie la terapia e le sue prese (senza la terapia non vogliono dire più niente). */
  removePlan(uuid: string): void {
    this.db.transaction(() => {
      const ids = this.db
        .all<{ uuid: string }>('SELECT uuid FROM pill_doses WHERE plan_uuid = ?', [uuid])
        .map((r) => r.uuid);
      this.db.run('DELETE FROM pill_doses WHERE plan_uuid = ?', [uuid]);
      this.dropQueued(ids);
      deleteRow(this.db, 'pill_plans', uuid);
      enqueue(this.db, { table: 'pill_plans', uuid, op: 'delete' }, this.clock());
    });
  }

  /** Le modifiche in coda di prese che non esistono più: il server direbbe «terapia non trovata». */
  private dropQueued(doseUuids: string[]): void {
    for (const u of doseUuids)
      this.db.run(
        `DELETE FROM outbox WHERE tbl = 'pill_doses' AND uuid = ? AND state = 'pending'`,
        [u],
      );
  }

  /* ---------------- prese ---------------- */

  /**
   * Scrive le prese che mancano nei giorni dati. Ripetibile senza danni. NON si mette in coda: le prese nascono
   * da una regola, il server (e gli altri telefoni) le fanno uguali; si manda solo quello che l'utente tocca.
   */
  ensureDays(dates: string[]): void {
    const specs = dosesFor(this.plans(), dates);
    for (const s of specs) this.insertSpec(s);
  }

  private insertSpec(s: DoseSpec): string {
    const uuid = doseUuid(s.plan_uuid, s.due_date, s.due_time, s.seq);
    this.db.run(
      `INSERT OR IGNORE INTO pill_doses (uuid, plan_uuid, due_date, due_time, seq, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
      [uuid, s.plan_uuid, s.due_date, s.due_time, s.seq],
    );
    return uuid;
  }

  /**
   * Le prese ancora da fare nei prossimi `days` giorni (da oggi), per i promemoria. NON scrive niente: le prese
   * future si calcolano dalla regola e si tolgono quelle già prese o saltate.
   */
  upcoming(
    days: number,
  ): { due_date: string; due_time: string; name: string; plan_dose: string }[] {
    const today = this.today();
    const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
    const plans = new Map(this.plans().map((p) => [p.uuid, p]));
    const done = new Set(
      this.db
        .all<{ plan_uuid: string; due_date: string; due_time: string; seq: number }>(
          `SELECT plan_uuid, due_date, due_time, seq FROM pill_doses
           WHERE status != 'pending' AND due_date >= ? AND due_date <= ?`,
          [dates[0]!, dates[dates.length - 1]!],
        )
        .map((d) => `${d.plan_uuid}|${d.due_date}|${d.due_time}|${d.seq}`),
    );
    return dosesFor([...plans.values()], dates)
      .filter((s) => !done.has(`${s.plan_uuid}|${s.due_date}|${s.due_time}|${s.seq}`))
      .map((s) => ({
        due_date: s.due_date,
        due_time: s.due_time,
        name: plans.get(s.plan_uuid)!.name,
        plan_dose: plans.get(s.plan_uuid)!.dose,
      }));
  }

  dose(uuid: string): Dose | null {
    return this.db.all<Dose>('SELECT * FROM pill_doses WHERE uuid = ?', [uuid])[0] ?? null;
  }

  /** Il giorno: le prese, le arretrate e i numeri dell'ultimo mese (td_pill_giorno). */
  day(date: string): DayView {
    this.db.transaction(() => this.ensureDays([date]));
    const doses = this.db.all<DoseView>(
      `${DOSE_SELECT} WHERE d.due_date = ? ORDER BY d.due_time, d.seq`,
      [date],
    );
    const today = this.today();
    const from30 = addDays(today, -30);
    const st = this.db.all<{ t: number | null; s: number | null; m: number | null }>(
      `SELECT SUM(status = 'taken') AS t, SUM(status = 'skipped') AS s,
              SUM(status = 'pending' AND due_date < ?) AS m
       FROM pill_doses WHERE due_date > ?`,
      [today, from30],
    )[0]!;
    return {
      date,
      doses,
      late: this.late(),
      stats: { taken: st.t ?? 0, skipped: st.s ?? 0, missed: st.m ?? 0 },
    };
  }

  /**
   * Le prese rimaste in sospeso nei giorni scorsi (td_pills_arretrate): una pastiglia dimenticata è la cosa che
   * deve tornare a galla, non sparire. Quattordici giorni indietro e non di più. Si generano anche le prese dei
   * giorni scorsi che nessuno ha ancora scritto, per chi non ha aperto l'app per una settimana.
   */
  late(): DoseView[] {
    const today = this.today();
    this.db.transaction(() => this.ensureDays(daysBefore(today, CATCH_UP_DAYS)));
    return this.db.all<DoseView>(
      `${DOSE_SELECT} WHERE d.status = 'pending' AND d.due_date < ? AND d.due_date >= ?
       ORDER BY d.due_date DESC, d.due_time`,
      [today, addDays(today, -LATE_DAYS)],
    );
  }

  /**
   * Le prese da chiedere nel planner (pl_pills_due): in sospeso, con l'ora già passata (oggi) o di uno dei sette
   * giorni scorsi. Al massimo sei, le più vecchie per prime. Come per `late()`, si scrivono prima le prese mancanti.
   */
  due(): DoseView[] {
    const today = this.today();
    const time = this.nowLocal().slice(11, 16);
    this.db.transaction(() => this.ensureDays([...daysBefore(today, CATCH_UP_DAYS), today]));
    return this.db.all<DoseView>(
      `${DOSE_SELECT} WHERE d.status = 'pending'
         AND (d.due_date < ? OR (d.due_date = ? AND d.due_time <= ?)) AND d.due_date >= ?
       ORDER BY d.due_date, d.due_time LIMIT 6`,
      [today, today, time, addDays(today, -CATCH_UP_DAYS)],
    );
  }

  /** Segna una presa (presa / saltata / di nuovo da prendere). L'ora vera della spunta non è mai nel futuro. */
  setStatus(uuid: string, status: DoseStatus, takenAt?: string): void {
    this.db.transaction(() => this.apply([this.change(uuid, status, takenAt)]));
  }

  private change(uuid: string, status: DoseStatus, takenAt?: string): DoseChange {
    const now = this.nowLocal();
    let when: string | null = null;
    if (status === 'taken') {
      when = takenAt ?? now;
      if (when > now) when = now;
    }
    return { uuid, status, taken_at: when };
  }

  /** Scrive i cambi di stato e li mette in coda: al server va lo stato e l'ora vera, più la chiave se la presa è nuova per lui. */
  private apply(changes: DoseChange[]): void {
    const now = this.clock();
    for (const c of changes) {
      const d = this.dose(c.uuid);
      if (!d) continue;
      patchRow(this.db, 'pill_doses', c.uuid, {
        status: c.status,
        taken_at: c.taken_at,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'pill_doses',
          uuid: c.uuid,
          op: 'upsert',
          patch: {
            plan_uuid: d.plan_uuid,
            due_date: d.due_date,
            due_time: d.due_time,
            seq: d.seq,
            status: c.status,
            taken_at: c.taken_at,
          },
        },
        now,
      );
    }
  }

  /** «Prese tutte»: ognuna all'orario previsto (`on_time`) o tutte adesso (`now`). Solo le non ancora spuntate. */
  markAll(uuids: string[], mode: 'on_time' | 'now'): number {
    return this.db.transaction(() => {
      const rows = uuids.map((u) => this.dose(u)).filter((d): d is Dose => d !== null);
      const changes = markAll(rows, mode, this.nowLocal());
      this.apply(changes);
      return changes.length;
    });
  }

  /** Il calendario: «quante prese quel giorno» (0 = nessuna). Un giorno futuro non si tocca. */
  setDayCount(planUuid: string, day: string, n: number): { taken: number; tot: number } {
    if (day > this.today()) throw new Error('future_day');
    return this.db.transaction(() => {
      const plan = this.plan(planUuid);
      if (!plan) return { taken: 0, tot: 0 };
      let doses = this.dosesOf(planUuid, day);
      if (!doses.length && n > 0) {
        // un giorno prima dell'inizio, o prima dell'ultima volta che si sono cambiati gli orari: non ha prese, ma
        // se l'utente dice «ne ho prese due» è un fatto e va scritto, con gli orari della terapia
        for (const t of parseTimes(plan.times))
          for (let seq = 1; seq <= t.n; seq++)
            this.insertSpec({ plan_uuid: planUuid, due_date: day, due_time: t.time, seq });
        doses = this.dosesOf(planUuid, day);
      }
      const r = setDayCount(doses, n, day, this.today(), this.nowLocal());
      this.apply(r.changes);
      return { taken: r.taken, tot: r.tot };
    });
  }

  private dosesOf(planUuid: string, day: string): Dose[] {
    return this.db.all<Dose>(
      'SELECT * FROM pill_doses WHERE plan_uuid = ? AND due_date = ? ORDER BY due_time, seq',
      [planUuid, day],
    );
  }

  /** Come è andata, giorno per giorno, fra due date (estremi inclusi). I giorni senza prese non compaiono. */
  history(planUuid: string, from: string, to: string): HistoryDay[] {
    const rows = this.db.all<Pick<Dose, 'due_date' | 'status'>>(
      'SELECT due_date, status FROM pill_doses WHERE plan_uuid = ? AND due_date BETWEEN ? AND ?',
      [planUuid, from, to],
    );
    return historyOf(rows, from, to);
  }
}
