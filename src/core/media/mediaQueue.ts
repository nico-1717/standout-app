import type { SqlDb } from '../db/sqldb';
import { ApiError } from '../api/httpApi';
import type { SyncTable } from '../sync/manifest';
import { rowExists } from '../sync/rows';

/** I campi che portano un file, per tabella (stessi nomi del server: `lib/media_api.php`, MEDIA_CAMPI). */
export const MEDIA_SLOTS = {
  fc_study_cards: {
    question_image: 'image',
    answer_image: 'image',
    question_audio: 'audio',
    answer_audio: 'audio',
  },
  fc_study_subcards: {
    question_image: 'image',
    answer_image: 'image',
    question_audio: 'audio',
    answer_audio: 'audio',
  },
  fc_vocab_cards: { image: 'image' },
  fc_vocab_subcards: { image: 'image' },
  fc_vocab_examples: { example_image: 'image' },
  todos: { buy_image: 'image' },
} as const satisfies Record<string, Record<string, 'image' | 'audio'>>;

export type MediaTable = keyof typeof MEDIA_SLOTS;

export const isMediaSlot = (table: string, slot: string): boolean =>
  Object.prototype.hasOwnProperty.call(MEDIA_SLOTS, table) &&
  Object.prototype.hasOwnProperty.call(MEDIA_SLOTS[table as MediaTable], slot);

/** Il server visto dalla coda dei file. */
export interface MediaApi {
  put(
    table: MediaTable,
    uuid: string,
    slot: string,
    file: { uri: string; mime: string },
  ): Promise<{ name: string }>;
  remove(table: MediaTable, uuid: string, slot: string): Promise<void>;
}

/** Cosa fa la coda con i file sul telefono (separato per poter provare senza telefono). */
export interface MediaFiles {
  delete(uri: string): void;
}

interface QueueRow {
  id: number;
  tbl: MediaTable;
  row_uuid: string;
  slot: string;
  op: 'put' | 'delete';
  file: string | null;
  mime: string | null;
  attempts: number;
}

/** Quante volte si riprova quando il server dice che la riga non c'è ancora (non è arrivata): poi si lascia perdere. */
export const MAX_NOT_FOUND = 10;

export interface MediaReport {
  done: number;
  waiting: number;
  dropped: number;
}

/** Il codice con cui il sito rifiuta un file perché lo spazio dell'utente è finito. */
export const QUOTA_CODE = 'quota_exceeded';

/**
 * La coda dei file da mandare al sito. Un telefono non carica subito: scrive qui «metti questo file in questo campo»
 * (o «toglilo») e ci pensa `run()` quando c'è rete e la riga è già arrivata sul server. Per ogni campo c'è una sola
 * voce: l'ultima scelta vince, e il file scartato si cancella dal telefono. Se il server accetta, il nome che ha
 * scelto va nella riga locale (senza passare dalla coda delle modifiche: il campo è «solo lettura» per /sync/push).
 */
export class MediaQueue {
  private running: Promise<MediaReport> | null = null;
  private refused = 0;

  constructor(
    private readonly db: SqlDb,
    private readonly api: MediaApi,
    private readonly files: MediaFiles,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  private check(table: string, slot: string): void {
    if (!isMediaSlot(table, slot)) throw new Error(`Campo non ammesso: ${table}.${slot}`);
  }

  private find(table: string, uuid: string, slot: string): QueueRow | null {
    return (
      this.db.all<QueueRow>(
        'SELECT * FROM media_queue WHERE tbl = ? AND row_uuid = ? AND slot = ?',
        [table, uuid, slot],
      )[0] ?? null
    );
  }

  private save(
    table: MediaTable,
    uuid: string,
    slot: string,
    op: 'put' | 'delete',
    file: string | null,
    mime: string | null,
  ): void {
    this.check(table, slot);
    const old = this.find(table, uuid, slot);
    this.db.transaction(() => {
      this.db.run('DELETE FROM media_queue WHERE tbl = ? AND row_uuid = ? AND slot = ?', [
        table,
        uuid,
        slot,
      ]);
      this.db.run(
        `INSERT INTO media_queue (tbl, row_uuid, slot, op, file, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [table, uuid, slot, op, file, mime, this.clock()],
      );
    });
    if (old?.file && old.file !== file) this.files.delete(old.file);
  }

  /** Metti questo file (già sul telefono, già ridotto) nel campo di una riga. */
  putFile(table: MediaTable, uuid: string, slot: string, uri: string, mime: string): void {
    this.save(table, uuid, slot, 'put', uri, mime);
  }

  /** Togli il file dal campo di una riga. */
  removeFile(table: MediaTable, uuid: string, slot: string): void {
    this.save(table, uuid, slot, 'delete', null, null);
  }

  /** Cosa aspetta di partire per questo campo: serve a mostrare subito la scelta fatta (il file locale, o «tolto»). */
  pending(
    table: string,
    uuid: string,
    slot: string,
  ): { op: 'put' | 'delete'; uri: string | null } | null {
    const r = this.find(table, uuid, slot);
    return r ? { op: r.op, uri: r.file } : null;
  }

  count(): number {
    return Number(this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM media_queue')[0]?.n ?? 0);
  }

  /** Dimentica le voci di una riga (la riga è stata cancellata) e i loro file. */
  dropRow(uuid: string): void {
    for (const r of this.db.all<QueueRow>('SELECT * FROM media_queue WHERE row_uuid = ?', [uuid])) {
      if (r.file) this.files.delete(r.file);
    }
    this.db.run('DELETE FROM media_queue WHERE row_uuid = ?', [uuid]);
  }

  /** Quanti file il sito ha rifiutato perché lo spazio è finito, da quando l'app è aperta (0 = nessuno). */
  spaceRefused(): number {
    return this.refused;
  }

  /** L'utente ha visto l'avviso (o ha liberato spazio): si riparte da zero. */
  clearSpaceRefused(): void {
    this.refused = 0;
  }

  run(): Promise<MediaReport> {
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain(): Promise<MediaReport> {
    const report: MediaReport = { done: 0, waiting: 0, dropped: 0 };
    const entries = this.db.all<QueueRow>('SELECT * FROM media_queue ORDER BY id');
    for (const e of entries) {
      const gone = (): void => {
        if (e.file) this.files.delete(e.file);
        this.db.run('DELETE FROM media_queue WHERE id = ?', [e.id]);
      };
      if (!rowExists(this.db, e.tbl, e.row_uuid)) {
        gone();
        report.dropped++;
        continue;
      }
      // la riga deve essere già sul server: finché ha modifiche da inviare si aspetta
      const unsent = this.db.all(`SELECT 1 FROM outbox WHERE tbl = ? AND uuid = ?`, [
        e.tbl,
        e.row_uuid,
      ]);
      if (unsent.length) {
        report.waiting++;
        continue;
      }
      try {
        let value: string | null = null;
        if (e.op === 'put') {
          if (!e.file || !e.mime) {
            gone();
            report.dropped++;
            continue;
          }
          value = (await this.api.put(e.tbl, e.row_uuid, e.slot, { uri: e.file, mime: e.mime }))
            .name;
        } else {
          await this.api.remove(e.tbl, e.row_uuid, e.slot);
        }
        this.db.transaction(() => {
          this.db.run(`UPDATE ${e.tbl} SET ${e.slot} = ? WHERE uuid = ?`, [value, e.row_uuid]);
          this.db.run('DELETE FROM media_queue WHERE id = ?', [e.id]);
        });
        if (e.file) this.files.delete(e.file);
        report.done++;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // la riga non è ancora (o non è più) sul server
          if (e.attempts + 1 >= MAX_NOT_FOUND) {
            gone();
            report.dropped++;
          } else {
            this.db.run(
              'UPDATE media_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
              [err.code, e.id],
            );
            report.waiting++;
          }
          continue;
        }
        if (err instanceof ApiError && (err.status === 422 || err.status === 413)) {
          // il server dice che il file non va bene: ripetere non serve. Se è lo spazio finito, lo si ricorda
          // per dirlo all'utente (il file locale si perde, ma la carta resta e l'utente sa cosa fare).
          if (err.code === QUOTA_CODE) this.refused++;
          gone();
          report.dropped++;
          continue;
        }
        // rete assente, sessione scaduta, troppe richieste, errore del server: si ferma e si riprova al prossimo giro
        this.db.run('UPDATE media_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?', [
          String((err as Error)?.message ?? err).slice(0, 200),
          e.id,
        ]);
        throw err;
      }
    }
    return report;
  }
}

export type { SyncTable };
