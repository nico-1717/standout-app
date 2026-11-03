import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import type { SyncTable } from '@/core/sync/manifest';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireRow, WireValue } from '@/core/sync/types';

import {
  type Bonus,
  type BonusType,
  BONUS_TYPES,
  type Exam,
  type ExamGroup,
  type GradeData,
  type GradeSettings,
} from './logic';

const EXAM_COLS = `uuid, name, cfu, status, grade, has_honors, is_pass_fail, counts_for_graduation, exam_date, predicted_grade,
  predicted_honors, catalog_code, ssd, study_year, national_avg, group_uuid, sort_key`;
const GROUP_COLS = `uuid, name, group_type, cfu, overall_grade, overall_honors, overall_predicted_grade, overall_predicted_honors, sort_key`;
const BONUS_COLS = `uuid, name, bonus_type, points, threshold_value, cap_points, is_enabled, sort_key`;

/** Cosa si può scrivere di un esame (booleani veri, come sul filo). */
export interface ExamInput {
  name?: string;
  cfu?: number;
  status?: 'todo' | 'done';
  grade?: number | null;
  has_honors?: boolean;
  is_pass_fail?: boolean;
  counts_for_graduation?: boolean;
  exam_date?: string | null;
  predicted_grade?: number | null;
  predicted_honors?: boolean;
  catalog_code?: string | null;
  ssd?: string | null;
  study_year?: number | null;
  national_avg?: number | null;
  group_uuid?: string | null;
}

const inRange = (v: number | null | undefined, lo: number, hi: number): number | null =>
  v == null || !Number.isFinite(v) || v < lo || v > hi ? null : Math.round(v);
const text = (v: string | null | undefined, max: number): string | null => {
  const s = (v ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max);
  return s === '' ? null : s;
};
const round = (v: number, dec: number) => Math.round(v * 10 ** dec) / 10 ** dec;

/** Le regole del sito su un esame: idoneità senza voto, lode = 30, data solo se superato, voti 18..30. */
export function normalizeExam(e: Exam): Exam {
  const pf = !!e.is_pass_fail;
  let grade = pf ? null : inRange(e.grade, 18, 30);
  let predicted = pf ? null : inRange(e.predicted_grade, 18, 30);
  const honors = !!e.has_honors;
  const phonors = !!e.predicted_honors;
  if (honors && !pf) grade = 30;
  if (phonors && !pf) predicted = 30;
  return {
    ...e,
    cfu: Math.min(90, Math.max(0, round(Number(e.cfu) || 0, 1))),
    grade,
    predicted_grade: predicted,
    has_honors: honors ? 1 : 0,
    predicted_honors: phonors ? 1 : 0,
    is_pass_fail: pf ? 1 : 0,
    counts_for_graduation: e.counts_for_graduation ? 1 : 0,
    exam_date: e.status === 'done' ? e.exam_date : null,
    study_year: inRange(e.study_year, 1, 9),
    national_avg:
      e.national_avg == null || !(e.national_avg >= 18 && e.national_avg <= 30)
        ? null
        : round(e.national_avg, 2),
  };
}

export interface GroupInput {
  name?: string;
  group_type?: 'choice' | 'split';
  cfu?: number;
  overall_grade?: number | null;
  overall_honors?: boolean;
  overall_predicted_grade?: number | null;
  overall_predicted_honors?: boolean;
}
export interface BonusInput {
  name?: string;
  bonus_type?: BonusType;
  points?: number;
  threshold_value?: number | null;
  cap_points?: number;
  is_enabled?: boolean;
}

const BOOLS = new Set([
  'has_honors',
  'is_pass_fail',
  'counts_for_graduation',
  'predicted_honors',
  'overall_honors',
  'overall_predicted_honors',
  'is_enabled',
]);
const wire = (k: string, v: unknown): WireValue =>
  BOOLS.has(k) ? !!v : ((v ?? null) as WireValue);

/**
 * I voti sul telefono: esami, gruppi (esami a scelta / esame diviso) e bonus di laurea. Le regole sono quelle del sito
 * (voti.php); il server le rifà e, se rifiuta, il motore rimette la riga com'era.
 */
export class GradesRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  /* ---------------- lettura ---------------- */

  exams(): Exam[] {
    return this.db.all<Exam>(`SELECT ${EXAM_COLS} FROM university_exams ORDER BY sort_key, uuid`);
  }
  exam(uuid: string): Exam | null {
    return (
      this.db.all<Exam>(`SELECT ${EXAM_COLS} FROM university_exams WHERE uuid = ?`, [uuid])[0] ??
      null
    );
  }
  groups(): ExamGroup[] {
    return this.db.all<ExamGroup>(
      `SELECT ${GROUP_COLS} FROM university_exam_groups ORDER BY sort_key, uuid`,
    );
  }
  group(uuid: string): ExamGroup | null {
    return (
      this.db.all<ExamGroup>(`SELECT ${GROUP_COLS} FROM university_exam_groups WHERE uuid = ?`, [
        uuid,
      ])[0] ?? null
    );
  }
  bonuses(): Bonus[] {
    return this.db.all<Bonus>(
      `SELECT ${BONUS_COLS} FROM university_bonuses ORDER BY sort_key, uuid`,
    );
  }

  /** Tutto insieme, nella forma dei calcoli. */
  data(settings: GradeSettings): GradeData {
    return { exams: this.exams(), groups: this.groups(), bonuses: this.bonuses(), settings };
  }

  /* ---------------- scrittura di base ---------------- */

  private lastKey(table: SyncTable): string | null {
    return (
      this.db.all<{ k: string }>(
        `SELECT sort_key AS k FROM ${table} ORDER BY sort_key DESC LIMIT 1`,
      )[0]?.k ?? null
    );
  }

  private change(table: SyncTable, uuid: string, patch: Record<string, unknown>): void {
    const keys = Object.keys(patch);
    if (!keys.length) return;
    const now = this.clock();
    const w: Record<string, WireValue> = {};
    for (const k of keys) w[k] = wire(k, patch[k]);
    patchRow(this.db, table, uuid, { ...w, updated_at: now });
    enqueue(this.db, { table, uuid, op: 'upsert', patch: w }, now);
  }

  private create(table: SyncTable, row: Record<string, unknown>): string {
    const uuid = this.newId();
    const now = this.clock();
    const local: WireRow = { uuid, created_at: now, updated_at: now };
    const patch: Record<string, WireValue> = {};
    for (const [k, v] of Object.entries(row)) {
      local[k] = wire(k, v);
      patch[k] = wire(k, v);
    }
    upsertRow(this.db, table, local);
    enqueue(this.db, { table, uuid, op: 'upsert', isCreate: true, patch }, now);
    return uuid;
  }

  private remove(table: SyncTable, uuid: string): void {
    deleteRow(this.db, table, uuid);
    enqueue(this.db, { table, uuid, op: 'delete' }, this.clock());
  }

  /* ---------------- esami ---------------- */

  /** Aggiunge un esame in fondo alla lista. Ritorna l'uuid. */
  addExam(input: ExamInput & { name: string }): string {
    const base: Exam = {
      uuid: '',
      name: text(input.name, 200) ?? 'Exam',
      cfu: input.cfu ?? 0,
      status: input.status ?? 'todo',
      grade: input.grade ?? null,
      has_honors: input.has_honors ? 1 : 0,
      is_pass_fail: input.is_pass_fail ? 1 : 0,
      counts_for_graduation: input.counts_for_graduation === false ? 0 : 1,
      exam_date: input.exam_date ?? null,
      predicted_grade: input.predicted_grade ?? null,
      predicted_honors: input.predicted_honors ? 1 : 0,
      catalog_code: text(input.catalog_code, 60),
      ssd: text(input.ssd, 20),
      study_year: input.study_year ?? null,
      national_avg: input.national_avg ?? null,
      group_uuid: input.group_uuid ?? null,
      sort_key: generateKeyBetween(this.lastKey('university_exams'), null),
    };
    const e = normalizeExam(base);
    let uuid = '';
    this.db.transaction(() => {
      const { uuid: _u, ...row } = e;
      void _u;
      uuid = this.create('university_exams', row);
    });
    return uuid;
  }

  /** Cambia un esame: si rimette in regola (lode, idoneità, data) e si manda solo ciò che è cambiato. Ritorna false se non c'è o il nome è vuoto. */
  updateExam(uuid: string, input: ExamInput): boolean {
    const cur = this.exam(uuid);
    if (!cur) return false;
    const merged: Exam = { ...cur };
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      (merged as unknown as Record<string, unknown>)[k] = BOOLS.has(k) ? (v ? 1 : 0) : v;
    }
    if (input.name !== undefined) {
      const n = text(input.name, 200);
      if (!n) return false;
      merged.name = n;
    }
    if (input.catalog_code !== undefined) merged.catalog_code = text(input.catalog_code, 60);
    if (input.ssd !== undefined) merged.ssd = text(input.ssd, 20);
    const next = normalizeExam(merged);
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(next) as (keyof Exam)[]) {
      if (k === 'uuid' || k === 'sort_key') continue;
      if (next[k] !== cur[k]) patch[k] = next[k];
    }
    this.db.transaction(() => this.change('university_exams', uuid, patch));
    return true;
  }

  /** Il voto previsto (o la lode prevista) per il simulatore. */
  setPrediction(uuid: string, grade: number | null, honors = false): void {
    this.updateExam(uuid, { predicted_grade: honors ? 30 : grade, predicted_honors: honors });
  }

  removeExams(uuids: string[]): void {
    this.db.transaction(() => {
      for (const id of uuids) if (this.exam(id)) this.remove('university_exams', id);
    });
  }

  /** Mette l'esame tra `before` e `after` (null = in cima / in fondo). */
  reorderExam(uuid: string, before: string | null, after: string | null): void {
    const all = this.exams();
    const key = (id: string | null) =>
      id ? (all.find((x) => x.uuid === id)?.sort_key ?? null) : null;
    const k = generateKeyBetween(key(before), key(after));
    this.db.transaction(() => this.change('university_exams', uuid, { sort_key: k }));
  }

  /* ---------------- gruppi ---------------- */

  /**
   * Fa un gruppo con almeno due esami. «split»: i CFU sono la somma delle parti. «choice»: la quota la scegli tu (non oltre la
   * somma), altrimenti il CFU più grande. Ritorna l'uuid, o null se gli esami sono meno di due.
   */
  createGroup(input: {
    name?: string;
    type?: 'choice' | 'split';
    exams: string[];
    cfu?: number | null;
  }): string | null {
    const members = this.exams().filter((e) => input.exams.includes(e.uuid));
    if (members.length < 2) return null;
    const type = input.type === 'split' ? 'split' : 'choice';
    const sum = members.reduce((s, e) => s + e.cfu, 0);
    const max = Math.max(...members.map((e) => e.cfu));
    const cfu =
      type === 'split'
        ? sum
        : input.cfu != null && input.cfu >= 0
          ? Math.min(round(input.cfu, 1), sum)
          : max;
    let uuid = '';
    this.db.transaction(() => {
      uuid = this.create('university_exam_groups', {
        name: text(input.name, 120) ?? 'Gruppo',
        group_type: type,
        cfu,
        overall_grade: null,
        overall_honors: false,
        overall_predicted_grade: null,
        overall_predicted_honors: false,
        sort_key: generateKeyBetween(this.lastKey('university_exam_groups'), null),
      });
      for (const e of members) this.change('university_exams', e.uuid, { group_uuid: uuid });
    });
    return uuid;
  }

  /** Cambia un gruppo: nome, tipo, quota, voto complessivo e (se passi `exams`) chi ne fa parte. */
  updateGroup(uuid: string, input: GroupInput & { exams?: string[] }): boolean {
    const cur = this.group(uuid);
    if (!cur) return false;
    if (input.exams && input.exams.length < 2) return false;
    this.db.transaction(() => {
      if (input.exams) {
        const want = new Set(input.exams);
        for (const e of this.exams()) {
          if (e.group_uuid === uuid && !want.has(e.uuid))
            this.change('university_exams', e.uuid, { group_uuid: null });
          else if (want.has(e.uuid) && e.group_uuid !== uuid)
            this.change('university_exams', e.uuid, { group_uuid: uuid });
        }
      }
      const members = this.exams().filter((e) => e.group_uuid === uuid);
      const type = input.group_type ?? cur.group_type;
      const sum = members.reduce((s, e) => s + e.cfu, 0);
      let cfu = cur.cfu;
      if (type === 'split') cfu = sum;
      else if (input.cfu !== undefined) cfu = Math.min(Math.max(0, round(input.cfu, 1)), sum);
      const next: Record<string, unknown> = {
        group_type: type,
        cfu,
      };
      if (input.name !== undefined) next.name = text(input.name, 120) ?? 'Gruppo';
      for (const k of [
        'overall_grade',
        'overall_honors',
        'overall_predicted_grade',
        'overall_predicted_honors',
      ] as const) {
        if (input[k] !== undefined) next[k] = input[k];
      }
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(next)) {
        const old = (cur as unknown as Record<string, unknown>)[k];
        if ((BOOLS.has(k) ? (v ? 1 : 0) : v) !== old) patch[k] = v;
      }
      this.change('university_exam_groups', uuid, patch);
    });
    return true;
  }

  /** Scioglie il gruppo: gli esami restano, ognuno per conto suo. */
  dissolveGroup(uuid: string): void {
    if (!this.group(uuid)) return;
    this.db.transaction(() => {
      for (const e of this.exams())
        if (e.group_uuid === uuid) this.change('university_exams', e.uuid, { group_uuid: null });
      this.remove('university_exam_groups', uuid);
    });
  }

  /** Toglie il gruppo con tutti gli esami che lo compongono. */
  deleteGroup(uuid: string): void {
    if (!this.group(uuid)) return;
    this.db.transaction(() => {
      for (const e of this.exams())
        if (e.group_uuid === uuid) this.remove('university_exams', e.uuid);
      this.remove('university_exam_groups', uuid);
    });
  }

  /** Dopo averne superato uno: toglie gli altri ancora da sostenere e scioglie il gruppo. */
  clearGroupTodo(uuid: string, keep: string): void {
    if (!this.group(uuid)) return;
    this.db.transaction(() => {
      for (const e of this.exams()) {
        if (e.group_uuid !== uuid) continue;
        if (e.status === 'todo' && e.uuid !== keep) this.remove('university_exams', e.uuid);
        else this.change('university_exams', e.uuid, { group_uuid: null });
      }
      this.remove('university_exam_groups', uuid);
    });
  }

  /* ---------------- bonus ---------------- */

  addBonus(input: BonusInput): string {
    let uuid = '';
    this.db.transaction(() => {
      uuid = this.create('university_bonuses', {
        name: text(input.name, 120) ?? 'Bonus',
        bonus_type: BONUS_TYPES.includes(input.bonus_type as BonusType)
          ? input.bonus_type
          : 'fixed',
        points: Math.min(20, Math.max(-20, round(input.points ?? 0, 2))),
        threshold_value: inRange(input.threshold_value, 0, 100),
        cap_points: Math.min(40, Math.max(0, round(input.cap_points ?? 0, 2))),
        is_enabled: input.is_enabled !== false,
        sort_key: generateKeyBetween(this.lastKey('university_bonuses'), null),
      });
    });
    return uuid;
  }

  updateBonus(uuid: string, input: BonusInput): boolean {
    const cur = this.bonuses().find((b) => b.uuid === uuid);
    if (!cur) return false;
    const next: Record<string, unknown> = {};
    if (input.name !== undefined) next.name = text(input.name, 120) ?? 'Bonus';
    if (input.bonus_type !== undefined && BONUS_TYPES.includes(input.bonus_type))
      next.bonus_type = input.bonus_type;
    if (input.points !== undefined)
      next.points = Math.min(20, Math.max(-20, round(input.points, 2)));
    if (input.cap_points !== undefined)
      next.cap_points = Math.min(40, Math.max(0, round(input.cap_points, 2)));
    if (input.threshold_value !== undefined)
      next.threshold_value = inRange(input.threshold_value, 0, 100);
    if (input.is_enabled !== undefined) next.is_enabled = input.is_enabled;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next)) {
      const old = (cur as unknown as Record<string, unknown>)[k];
      if ((BOOLS.has(k) ? (v ? 1 : 0) : v) !== old) patch[k] = v;
    }
    this.db.transaction(() => this.change('university_bonuses', uuid, patch));
    return true;
  }

  removeBonus(uuid: string): void {
    if (!this.bonuses().some((b) => b.uuid === uuid)) return;
    this.db.transaction(() => this.remove('university_bonuses', uuid));
  }

  /* ---------------- catalogo ---------------- */

  /**
   * Mette gli esami di un corso del catalogo. `replace` toglie prima tutti gli esami e i gruppi che ci sono (come il sito),
   * `append` aggiunge in fondo.
   */
  importProgram(
    list: {
      name: string;
      cfu: number;
      pass_fail?: boolean;
      ssd?: string | null;
      year?: number | null;
      code?: string | null;
      national_avg?: number | null;
    }[],
    mode: 'replace' | 'append' = 'replace',
  ): number {
    let n = 0;
    this.db.transaction(() => {
      if (mode === 'replace') {
        for (const e of this.exams()) this.remove('university_exams', e.uuid);
        for (const g of this.groups()) this.remove('university_exam_groups', g.uuid);
      }
      for (const x of list) {
        this.addExam({
          name: x.name || 'Exam',
          cfu: x.cfu,
          is_pass_fail: !!x.pass_fail,
          ssd: x.ssd ?? null,
          study_year: x.year ?? null,
          catalog_code: x.code ?? null,
          national_avg: x.national_avg ?? null,
        });
        n++;
      }
    });
    return n;
  }
}
