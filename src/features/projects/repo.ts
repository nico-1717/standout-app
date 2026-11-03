import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireValue } from '@/core/sync/types';

import {
  byId,
  childrenOf,
  inheritedColor,
  nextStatus,
  subtreeIds,
  wouldCycle,
  type Project,
  type ProjectStatus,
} from './logic';

const COLS = `uuid, parent_uuid, name, notes, status, color, color_edited, target_date, due_date, todo_enabled,
  is_favorite, sort_key, study_event_uuid, study_start, study_end, study_pomodori_stimati, study_ripasso_di_uuid,
  study_ripasso_n, created_at`;

/** Cosa si può cambiare di un progetto. `color: null` = automatico (segue il padre). */
export interface ProjectPatch {
  name?: string;
  notes?: string;
  color?: string | null;
  target_date?: string | null;
  due_date?: string | null;
  todo_enabled?: boolean;
  is_favorite?: boolean;
  study_pomodori_stimati?: number | null;
}

/** Quello che serve per tornare indietro dopo «completato a cascata». */
export interface StatusSnapshot {
  uuid: string;
  status: ProjectStatus;
}

/**
 * I progetti sul telefono. Come sul sito (progetti.php): il colore si eredita dal padre finché non lo scegli tu e passa ai figli
 * «automatici»; nessun progetto va dentro se stesso; il nome non è mai vuoto. Il server rifà gli stessi controlli: se rifiuta,
 * il motore rimette la riga com'era.
 */
export class ProjectsRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  all(): Project[] {
    return this.db.all<Project>(`SELECT ${COLS} FROM projects ORDER BY sort_key, uuid`);
  }

  get(uuid: string): Project | null {
    return this.db.all<Project>(`SELECT ${COLS} FROM projects WHERE uuid = ?`, [uuid])[0] ?? null;
  }

  private siblingKeys(parent: string | null): string[] {
    return childrenOf(this.all(), parent).map((p) => p.sort_key);
  }

  /** Il colore passa ai discendenti che non l'hanno scelto a mano (il server fa lo stesso: qui serve per vederlo subito). */
  private cascadeColor(all: Project[], uuid: string, color: string): void {
    for (const c of childrenOf(all, uuid)) {
      if (c.color_edited) continue;
      patchRow(this.db, 'projects', c.uuid, { color });
      c.color = color;
      this.cascadeColor(all, c.uuid, color);
    }
  }

  /**
   * Crea un progetto. `position`: «first» come il sito (il nuovo nasce primo), «last» quando lo scrivi dalla riga «Aggiungi»
   * in fondo. Ritorna l'uuid, o null se manca il nome.
   */
  create(input: {
    name: string;
    parent?: string | null;
    color?: string | null;
    notes?: string;
    target_date?: string | null;
    due_date?: string | null;
    position?: 'first' | 'last';
  }): string | null {
    const name = input.name.trim().slice(0, 200);
    if (!name) return null;
    const parent = input.parent ?? null;
    const all = this.all();
    if (parent && !all.some((p) => p.uuid === parent)) return null;
    const uuid = this.newId();
    this.db.transaction(() => {
      const keys = this.siblingKeys(parent);
      const key =
        input.position === 'last'
          ? generateKeyBetween(keys[keys.length - 1] ?? null, null)
          : generateKeyBetween(null, keys[0] ?? null);
      const edited = !!input.color;
      const color = input.color ?? inheritedColor(byId(all), parent);
      const now = this.clock();
      const patch: Record<string, WireValue> = {
        name,
        parent_uuid: parent,
        color,
        color_edited: edited,
        sort_key: key,
      };
      if (input.notes) patch.notes = input.notes;
      if (input.target_date) patch.target_date = input.target_date;
      if (input.due_date) patch.due_date = input.due_date;
      upsertRow(this.db, 'projects', {
        uuid,
        parent_uuid: parent,
        name,
        notes: input.notes ?? '',
        status: 'in_progress',
        color,
        color_edited: edited ? 1 : 0,
        target_date: input.target_date ?? null,
        due_date: input.due_date ?? null,
        todo_enabled: 0,
        is_favorite: 0,
        sort_key: key,
        study_event_uuid: null,
        study_start: null,
        study_end: null,
        study_pomodori_stimati: null,
        study_ripasso_di_uuid: null,
        study_ripasso_n: null,
        created_at: now,
        updated_at: now,
      });
      enqueue(this.db, { table: 'projects', uuid, op: 'upsert', isCreate: true, patch }, now);
    });
    return uuid;
  }

  /** Cambia dei campi. Il nome vuoto non si salva. */
  update(uuid: string, p: ProjectPatch): boolean {
    const cur = this.get(uuid);
    if (!cur) return false;
    const patch: Record<string, WireValue> = {};
    if (p.name !== undefined) {
      const name = p.name.trim().slice(0, 200);
      if (!name) return false;
      if (name !== cur.name) patch.name = name;
    }
    if (p.notes !== undefined && p.notes !== cur.notes) patch.notes = p.notes.slice(0, 8000);
    if (p.target_date !== undefined && p.target_date !== cur.target_date)
      patch.target_date = p.target_date;
    if (p.due_date !== undefined && p.due_date !== cur.due_date) patch.due_date = p.due_date;
    if (p.todo_enabled !== undefined && p.todo_enabled !== !!cur.todo_enabled)
      patch.todo_enabled = p.todo_enabled;
    if (p.is_favorite !== undefined && p.is_favorite !== !!cur.is_favorite)
      patch.is_favorite = p.is_favorite;
    if (
      p.study_pomodori_stimati !== undefined &&
      p.study_pomodori_stimati !== cur.study_pomodori_stimati
    )
      patch.study_pomodori_stimati = p.study_pomodori_stimati;
    let newColor: string | null = null;
    if (p.color !== undefined) {
      if (p.color === null) {
        // automatico: segue il padre ATTUALE
        if (cur.color_edited) {
          newColor = inheritedColor(byId(this.all()), cur.parent_uuid);
          patch.color_edited = false;
          patch.color = newColor;
        }
      } else if (p.color !== cur.color || !cur.color_edited) {
        newColor = p.color;
        patch.color = p.color;
        patch.color_edited = true;
      }
    }
    if (!Object.keys(patch).length) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'projects', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'projects', uuid, op: 'upsert', patch }, now);
      if (newColor) this.cascadeColor(this.all(), uuid, newColor);
    });
    return true;
  }

  /** Mette un progetto in un altro (o alla radice), in fondo ai suoi nuovi fratelli. Ritorna false se farebbe un ciclo. */
  move(uuid: string, newParent: string | null): boolean {
    const all = this.all();
    const cur = all.find((p) => p.uuid === uuid);
    if (!cur) return false;
    if (newParent && !all.some((p) => p.uuid === newParent)) return false;
    if (wouldCycle(all, uuid, newParent)) return false;
    if (cur.parent_uuid === newParent) return true;
    this.db.transaction(() => {
      const keys = childrenOf(all, newParent).map((p) => p.sort_key);
      const key = generateKeyBetween(keys[keys.length - 1] ?? null, null);
      const patch: Record<string, WireValue> = { parent_uuid: newParent, sort_key: key };
      const local: Record<string, WireValue> = { ...patch };
      // un colore automatico segue il padre nuovo
      let color: string | null = null;
      if (!cur.color_edited) {
        color = inheritedColor(byId(all), newParent);
        local.color = color;
      }
      const now = this.clock();
      patchRow(this.db, 'projects', uuid, { ...local, updated_at: now });
      enqueue(this.db, { table: 'projects', uuid, op: 'upsert', patch }, now);
      if (color) this.cascadeColor(this.all(), uuid, color);
    });
    return true;
  }

  /** Mette `uuid` tra `before` e `after` (fratelli dello stesso padre; null = in cima / in fondo). */
  reorder(uuid: string, before: string | null, after: string | null): void {
    const all = this.all();
    const key = (id: string | null) =>
      id ? (all.find((p) => p.uuid === id)?.sort_key ?? null) : null;
    const k = generateKeyBetween(key(before), key(after));
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'projects', uuid, { sort_key: k, updated_at: now });
      enqueue(this.db, { table: 'projects', uuid, op: 'upsert', patch: { sort_key: k } }, now);
    });
  }

  /**
   * Il giro dello stato (in corso → completato → pianificato). Se si diventa «completato» tutti i discendenti diventano
   * completati e si ritorna il loro stato di prima (`snapshot`); uscendo da «completato», se ne passi uno, tornano com'erano.
   */
  cycleStatus(
    uuid: string,
    restore?: StatusSnapshot[],
  ): { status: ProjectStatus; snapshot: StatusSnapshot[] } | null {
    const all = this.all();
    const cur = all.find((p) => p.uuid === uuid);
    if (!cur) return null;
    const next = nextStatus(cur.status);
    const snapshot: StatusSnapshot[] = [];
    this.db.transaction(() => {
      const now = this.clock();
      const set = (id: string, status: ProjectStatus) => {
        patchRow(this.db, 'projects', id, { status, updated_at: now });
        enqueue(this.db, { table: 'projects', uuid: id, op: 'upsert', patch: { status } }, now);
      };
      set(uuid, next);
      if (next === 'completed') {
        for (const id of subtreeIds(all, uuid)) {
          if (id === uuid) continue;
          const c = all.find((p) => p.uuid === id)!;
          snapshot.push({ uuid: id, status: c.status });
          if (c.status !== 'completed') set(id, 'completed');
        }
      } else if (cur.status === 'completed' && restore) {
        const mine = new Set(subtreeIds(all, uuid));
        for (const r of restore) if (mine.has(r.uuid)) set(r.uuid, r.status);
      }
    });
    return { status: next, snapshot };
  }

  /**
   * Toglie un progetto e i suoi discendenti (il server li toglie a cascata). Le sessioni restano, senza progetto, a meno che
   * `deleteSessions`: allora si tolgono anche quelle del ramo.
   */
  remove(uuid: string, deleteSessions = false): void {
    const all = this.all();
    if (!all.some((p) => p.uuid === uuid)) return;
    const ids = subtreeIds(all, uuid);
    this.db.transaction(() => {
      const now = this.clock();
      const ph = ids.map(() => '?').join(',');
      const sessions = this.db.all<{ uuid: string }>(
        `SELECT uuid FROM pomodoro_sessions WHERE project_uuid IN (${ph})`,
        ids,
      );
      if (deleteSessions) {
        for (const s of sessions) {
          deleteRow(this.db, 'pomodoro_sessions', s.uuid);
          enqueue(this.db, { table: 'pomodoro_sessions', uuid: s.uuid, op: 'delete' }, now);
        }
      } else {
        this.db.run(
          `UPDATE pomodoro_sessions SET project_uuid = NULL WHERE project_uuid IN (${ph})`,
          ids,
        );
      }
      for (const id of ids) deleteRow(this.db, 'projects', id);
      enqueue(this.db, { table: 'projects', uuid, op: 'delete' }, now);
    });
  }
}
