import type { SqlDb } from '@/core/db/sqldb';
import { getState, setState } from '@/core/sync/engine';

/** La nota veloce del To do (public/planner/todo_nota.js): un testo solo, che si salva da solo. */

export const NOTE_MAX = 20000;
/** Fra le due versioni, quando la nota è stata scritta su due dispositivi: nessuna delle due si butta. */
export const BOTH_VERSIONS_LINE = '\n\n———\n\n';

export interface ServerNote {
  body: string;
  /** null = sul server la nota non è mai stata scritta */
  updated_at: string | null;
}

export type PutNoteResult = { conflict: boolean; note: ServerNote };

export interface QuickNoteApi {
  getQuickNote(): Promise<ServerNote>;
  putQuickNote(body: string, base: string | null): Promise<PutNoteResult>;
}

interface Local {
  body: string;
  /** la versione del server su cui si è scritto (null = non ne conosciamo nessuna) */
  base: string | null;
  /** c'è testo che il server non ha ancora */
  dirty: boolean;
}

const KEY = 'quick_note';
const EMPTY: Local = { body: '', base: null, dirty: false };

/**
 * La nota sul telefono. Si scrive subito, anche senza rete; ogni cambio resta «da inviare» finché il server non
 * l'ha preso. Il PUT porta la versione su cui si è scritto: se il server nel frattempo è cambiato (altro telefono,
 * sito) risponde 409 e QUI si tengono tutte e due le versioni, una dopo l'altra. Mai sovrascrivere a cieco.
 */
export class QuickNoteStore {
  constructor(private readonly db: SqlDb) {}

  private load(): Local {
    try {
      const raw = getState(this.db, KEY);
      if (!raw) return EMPTY;
      const j = JSON.parse(raw) as Partial<Local>;
      return {
        body: typeof j.body === 'string' ? j.body : '',
        base: typeof j.base === 'string' ? j.base : null,
        dirty: j.dirty === true,
      };
    } catch {
      return EMPTY;
    }
  }

  private save(l: Local): void {
    setState(this.db, KEY, JSON.stringify(l));
  }

  read(): string {
    return this.load().body;
  }

  hasPending(): boolean {
    return this.load().dirty;
  }

  /** Scrive la nota (dal riquadro). Se il testo è lo stesso non fa niente. */
  write(body: string): void {
    const l = this.load();
    const text = body.slice(0, NOTE_MAX);
    if (text === l.body) return;
    this.save({ ...l, body: text, dirty: true });
  }

  /** Invia quello che manca, oppure scarica la nota del server. Ritorna il testo di adesso. */
  async sync(api: QuickNoteApi): Promise<string> {
    let l = this.load();
    if (!l.dirty) {
      const server = await api.getQuickNote();
      l = { body: server.body, base: server.updated_at, dirty: false };
      this.save(l);
      return l.body;
    }
    // Al massimo due giri: il secondo serve solo dopo un conflitto (si manda la somma delle due versioni).
    for (let round = 0; round < 2; round++) {
      const sent = l.body;
      const r = await api.putQuickNote(sent, l.base);
      if (!r.conflict) {
        // se l'utente ha scritto ancora mentre si inviava, quel testo resta da inviare
        const now = this.load();
        this.save({ body: now.body, base: r.note.updated_at, dirty: now.body !== sent });
        return now.body;
      }
      // si parte dal testo di ADESSO (non da quello inviato): l'utente può aver scritto ancora nel frattempo
      const merged = mergeBoth(r.note.body, this.load().body);
      l = { body: merged, base: r.note.updated_at, dirty: merged !== r.note.body };
      this.save(l);
      if (!l.dirty) return l.body;
    }
    return this.load().body;
  }
}

/** Le due versioni una dopo l'altra: quella del server prima, la mia dopo. Uguali o vuote: una sola. */
export function mergeBoth(server: string, mine: string): string {
  if (server === mine || mine.trim() === '') return server;
  if (server.trim() === '') return mine;
  if (server.includes(mine)) return server; // la mia è già dentro: non si raddoppia
  return (server + BOTH_VERSIONS_LINE + mine).slice(0, NOTE_MAX);
}
