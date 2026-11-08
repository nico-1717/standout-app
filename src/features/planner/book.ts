import { generateKeyBetween } from 'fractional-indexing';
import { uuidv7 } from 'uuidv7';

import type { SqlDb } from '@/core/db/sqldb';
import { enqueue } from '@/core/sync/outbox';
import { deleteRow, patchRow, upsertRow } from '@/core/sync/rows';
import type { WireValue } from '@/core/sync/types';

/* La rubrica (contatti), gli invitati degli eventi e i luoghi salvati. Le regole sono quelle del sito (e del server):
   - un contatto ha un'e-mail valida (una sola per utente, in minuscolo) e un nome fino a 80 caratteri;
     senza nome, il nome è la parte prima della chiocciola
   - un evento ha al massimo 30 invitati, uno per indirizzo; il nome si copia dalla rubrica, così un evento passato
     ricorda come si chiamava quel contatto allora
   - un luogo ha un nome (fino a 60), parole d'aggancio in minuscolo, un indirizzo e, se ci sono, le coordinate (in coppia) */

export const GUESTS_MAX = 30;

export interface Contact {
  uuid: string;
  name: string;
  email: string;
}

export interface Guest {
  uuid: string;
  event_uuid: string;
  contact_uuid: string | null;
  email: string;
  name: string | null;
}

export interface Place {
  uuid: string;
  label: string;
  keywords: string;
  place_name: string | null;
  address: string;
  place_lat: number | null;
  place_lon: number | null;
  place_ref: string | null;
  sort_key: string;
}

export interface GuestInput {
  email: string;
  name?: string | null;
  contactUuid?: string | null;
}

export interface PlaceInput {
  label: string;
  keywords?: string;
  address?: string;
  placeName?: string | null;
  lat?: number | null;
  lon?: number | null;
  ref?: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** L'indirizzo ripulito (minuscolo), o null se non è un'e-mail. */
export function cleanEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.length <= 255 && EMAIL.test(e) ? e : null;
}

const PLACE_COLS =
  'uuid, label, keywords, place_name, address, place_lat, place_lon, place_ref, sort_key';

const validPoint = (lat: number | null | undefined, lon: number | null | undefined) =>
  lat != null &&
  lon != null &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

export class BookRepo {
  constructor(
    private readonly db: SqlDb,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = uuidv7,
  ) {}

  /* ---------------- rubrica ---------------- */

  contacts(): Contact[] {
    return this.db.all<Contact>(
      'SELECT uuid, name, email FROM contacts ORDER BY lower(name), email',
    );
  }

  /** Aggiunge un contatto. Ritorna null se l'e-mail non è valida o c'è già. */
  addContact(email: string, name = ''): string | null {
    const mail = cleanEmail(email);
    if (!mail) return null;
    if (this.db.all('SELECT 1 FROM contacts WHERE email = ?', [mail]).length) return null;
    const nome = name.trim().slice(0, 80) || mail.split('@')[0]!;
    const uuid = this.newId();
    this.db.transaction(() => {
      const now = this.clock();
      upsertRow(this.db, 'contacts', {
        uuid,
        name: nome,
        email: mail,
        created_at: now,
        updated_at: now,
      });
      enqueue(
        this.db,
        {
          table: 'contacts',
          uuid,
          op: 'upsert',
          isCreate: true,
          patch: { email: mail, name: nome },
        },
        now,
      );
    });
    return uuid;
  }

  /** Cambia nome e/o e-mail. Ritorna false se l'e-mail non è valida o è di un altro contatto. */
  updateContact(uuid: string, c: { name?: string; email?: string }): boolean {
    const old = this.db.all<Contact>('SELECT uuid, name, email FROM contacts WHERE uuid = ?', [
      uuid,
    ])[0];
    if (!old) return false;
    const patch: Record<string, WireValue> = {};
    if (c.email !== undefined) {
      const mail = cleanEmail(c.email);
      if (!mail) return false;
      if (mail !== old.email) {
        if (
          this.db.all('SELECT 1 FROM contacts WHERE email = ? AND uuid != ?', [mail, uuid]).length
        )
          return false;
        patch.email = mail;
      }
    }
    if (c.name !== undefined) {
      const nome = c.name.trim().slice(0, 80) || String(patch.email ?? old.email).split('@')[0]!;
      if (nome !== old.name) patch.name = nome;
    }
    if (!Object.keys(patch).length) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'contacts', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'contacts', uuid, op: 'upsert', patch }, now);
    });
    return true;
  }

  /** Toglie un contatto. Gli invitati che lo ricordavano restano, scritti a mano. */
  removeContact(uuid: string): void {
    this.db.transaction(() => {
      this.db.run('UPDATE event_guests SET contact_uuid = NULL WHERE contact_uuid = ?', [uuid]);
      deleteRow(this.db, 'contacts', uuid);
      enqueue(this.db, { table: 'contacts', uuid, op: 'delete' }, this.clock());
    });
  }

  /* ---------------- invitati ---------------- */

  guests(eventUuid: string): Guest[] {
    return this.db.all<Guest>(
      `SELECT uuid, event_uuid, contact_uuid, email, name FROM event_guests
        WHERE event_uuid = ? ORDER BY created_at, email`,
      [eventUuid],
    );
  }

  /**
   * Fa diventare gli invitati di un evento quelli della lista: toglie chi non c'è più, aggiunge chi è nuovo,
   * cambia il nome a chi l'ha cambiato. Un indirizzo vale una volta sola; i primi 30 restano.
   */
  setGuests(eventUuid: string, list: GuestInput[]): void {
    const want = new Map<string, GuestInput & { email: string }>();
    for (const g of list) {
      const mail = cleanEmail(g.email);
      if (mail && !want.has(mail) && want.size < GUESTS_MAX) want.set(mail, { ...g, email: mail });
    }
    const have = this.guests(eventUuid);
    this.db.transaction(() => {
      const now = this.clock();
      for (const h of have) {
        if (want.has(h.email)) continue;
        deleteRow(this.db, 'event_guests', h.uuid);
        enqueue(this.db, { table: 'event_guests', uuid: h.uuid, op: 'delete' }, now);
      }
      const byMail = new Map(have.map((h) => [h.email, h]));
      for (const [mail, g] of want) {
        const contact = g.contactUuid
          ? (this.db.all<Contact>('SELECT uuid, name, email FROM contacts WHERE uuid = ?', [
              g.contactUuid,
            ])[0] ?? null)
          : null;
        const name =
          (g.name ?? '').trim().slice(0, 80) ||
          (contact ? contact.name : '') ||
          (this.db.all<Contact>('SELECT name FROM contacts WHERE email = ?', [mail])[0]?.name ??
            '');
        const cur = byMail.get(mail);
        if (!cur) {
          const uuid = this.newId();
          upsertRow(this.db, 'event_guests', {
            uuid,
            event_uuid: eventUuid,
            contact_uuid: contact?.uuid ?? null,
            email: mail,
            name: name || null,
            created_at: now,
            updated_at: now,
          });
          const patch: Record<string, WireValue> = { event_uuid: eventUuid, email: mail };
          if (contact) patch.contact_uuid = contact.uuid;
          if (name) patch.name = name;
          enqueue(
            this.db,
            { table: 'event_guests', uuid, op: 'upsert', isCreate: true, patch },
            now,
          );
          continue;
        }
        const patch: Record<string, WireValue> = {};
        if ((name || null) !== cur.name) patch.name = name || null;
        if (g.contactUuid !== undefined && (contact?.uuid ?? null) !== cur.contact_uuid)
          patch.contact_uuid = contact?.uuid ?? null;
        if (!Object.keys(patch).length) continue;
        patchRow(this.db, 'event_guests', cur.uuid, { ...patch, updated_at: now });
        enqueue(this.db, { table: 'event_guests', uuid: cur.uuid, op: 'upsert', patch }, now);
      }
    });
  }

  /* ---------------- luoghi ---------------- */

  places(): Place[] {
    return this.db.all<Place>(`SELECT ${PLACE_COLS} FROM planner_places ORDER BY sort_key, uuid`);
  }

  /** Un luogo nuovo in fondo alla lista. Ritorna null se manca il nome. */
  addPlace(input: PlaceInput): string | null {
    const label = input.label.trim().slice(0, 60);
    if (!label) return null;
    const uuid = this.newId();
    const point = validPoint(input.lat, input.lon);
    this.db.transaction(() => {
      const now = this.clock();
      const last = this.db.all<{ sort_key: string }>(
        'SELECT sort_key FROM planner_places ORDER BY sort_key DESC LIMIT 1',
      )[0]?.sort_key;
      const row = {
        uuid,
        label,
        keywords: words(input.keywords ?? ''),
        place_name: (input.placeName ?? '').trim().slice(0, 255) || null,
        address: (input.address ?? '').trim().slice(0, 255),
        place_lat: point ? input.lat! : null,
        place_lon: point ? input.lon! : null,
        place_ref: (input.ref ?? '').trim().slice(0, 255) || null,
        sort_key: generateKeyBetween(last || null, null),
        created_at: now,
        updated_at: now,
      };
      upsertRow(this.db, 'planner_places', row);
      const { uuid: _u, created_at: _c, updated_at: _m, ...patch } = row;
      void _u;
      void _c;
      void _m;
      enqueue(this.db, { table: 'planner_places', uuid, op: 'upsert', isCreate: true, patch }, now);
    });
    return uuid;
  }

  /** Cambia un luogo. Il nome non può restare vuoto; le coordinate si cambiano o si tolgono insieme. */
  updatePlace(uuid: string, c: Partial<PlaceInput>): boolean {
    const old = this.db.all<Place>(`SELECT ${PLACE_COLS} FROM planner_places WHERE uuid = ?`, [
      uuid,
    ])[0];
    if (!old) return false;
    const next: Record<string, WireValue> = {};
    if (c.label !== undefined) {
      const label = c.label.trim().slice(0, 60);
      if (!label) return false;
      next.label = label;
    }
    if (c.keywords !== undefined) next.keywords = words(c.keywords);
    if (c.address !== undefined) next.address = c.address.trim().slice(0, 255);
    if (c.placeName !== undefined)
      next.place_name = (c.placeName ?? '').trim().slice(0, 255) || null;
    if (c.ref !== undefined) next.place_ref = (c.ref ?? '').trim().slice(0, 255) || null;
    if (c.lat !== undefined || c.lon !== undefined) {
      const lat = c.lat !== undefined ? c.lat : old.place_lat;
      const lon = c.lon !== undefined ? c.lon : old.place_lon;
      const point = validPoint(lat, lon);
      next.place_lat = point ? lat! : null;
      next.place_lon = point ? lon! : null;
    }
    const patch: Record<string, WireValue> = {};
    for (const [k, v] of Object.entries(next))
      if (v !== (old as unknown as Record<string, unknown>)[k]) patch[k] = v;
    if (!Object.keys(patch).length) return true;
    this.db.transaction(() => {
      const now = this.clock();
      patchRow(this.db, 'planner_places', uuid, { ...patch, updated_at: now });
      enqueue(this.db, { table: 'planner_places', uuid, op: 'upsert', patch }, now);
    });
    return true;
  }

  removePlace(uuid: string): void {
    this.db.transaction(() => {
      deleteRow(this.db, 'planner_places', uuid);
      enqueue(this.db, { table: 'planner_places', uuid, op: 'delete' }, this.clock());
    });
  }

  /** Il luogo salvato che il titolo di un evento nomina («palestra» → «Gym»): il primo con una parola d'aggancio nel titolo. */
  suggestPlace(title: string): Place | null {
    const t = title.toLowerCase();
    if (!t.trim()) return null;
    for (const p of this.places())
      for (const w of p.keywords.split(',')) {
        const k = w.trim();
        if (k && t.includes(k)) return p;
      }
    return null;
  }
}

/** Gli invitati vanno via con i loro eventi: niente da avvisare al server (cancella lui), e le loro modifiche in coda non servono più. */
export function dropGuestsOf(db: SqlDb, eventUuids: string[]): void {
  if (!eventUuids.length) return;
  const marks = eventUuids.map(() => '?').join(',');
  db.run(
    `DELETE FROM outbox WHERE tbl = 'event_guests' AND state = 'pending' AND uuid IN
       (SELECT uuid FROM event_guests WHERE event_uuid IN (${marks}))`,
    eventUuids,
  );
  db.run(`DELETE FROM event_guests WHERE event_uuid IN (${marks})`, eventUuids);
}

/** Le parole d'aggancio: in minuscolo, ripulite, senza doppioni, al massimo 255 caratteri. */
function words(raw: string): string {
  const seen = new Set<string>();
  for (const w of raw.toLowerCase().split(',')) {
    const k = w.trim();
    if (k) seen.add(k);
  }
  return [...seen].join(', ').slice(0, 255);
}
