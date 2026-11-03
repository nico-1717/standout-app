/**
 * UUIDv5 (RFC 4122): l'identità di una riga che ha una «chiave naturale» (decisione D4).
 * Un check-in è UNO per (abitudine, giorno): telefono e sito, anche offline, calcolano lo stesso uuid
 * e quindi parlano della stessa riga, invece di crearne due. Il server fa lo stesso calcolo
 * (lib/sync_manifest.php, sync_uuid5) e rifiuta un uuid diverso da quello atteso.
 * SHA-1 scritto qui (30 righe) per non aggiungere una libreria solo per questo; il test lo confronta
 * con i valori calcolati dal server.
 */
export const NS_UUID5 = '7d4f1b0e-3c52-4e8a-9a61-5b2c8d0f6e13';

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function sha1(bytes: number[]): number[] {
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const msg = bytes.slice();
  const bitLen = bytes.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  for (const w of [hi, lo]) msg.push((w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255);

  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);
  for (let i = 0; i < msg.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] =
        (msg[i + t * 4] << 24) |
        (msg[i + t * 4 + 1] << 16) |
        (msg[i + t * 4 + 2] << 8) |
        msg[i + t * 4 + 3];
    }
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let t = 0; t < 80; t++) {
      let f: number, k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (rotl(a, 5) + f + e + k + w[t]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = tmp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  const out: number[] = [];
  for (const h of [h0, h1, h2, h3, h4])
    out.push((h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255);
  return out;
}

export function uuid5(name: string, namespace: string = NS_UUID5): string {
  const ns = namespace
    .replace(/-/g, '')
    .match(/.{2}/g)!
    .map((x) => parseInt(x, 16));
  const d = sha1([...ns, ...utf8(name)]).slice(0, 16);
  d[6] = (d[6] & 0x0f) | 0x50;
  d[8] = (d[8] & 0x3f) | 0x80;
  const hex = d.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** L'uuid di un check-in: abitudine (uuid) + giorno (YYYY-MM-DD). */
export function checkInUuid(habitUuid: string, day: string): string {
  return uuid5(`habit_logs|${habitUuid}|${day}`);
}

/** L'uuid di una presa: terapia (uuid) + giorno + orario (HH:MM) + n. (lo stesso calcolo del server: sync_uuid_presa). */
export function doseUuid(planUuid: string, day: string, time: string, seq: number): string {
  return uuid5(`pill_doses|${planUuid}|${day}|${time.slice(0, 5)}|${seq}`);
}

/** Il giorno del diario di un utente: una riga sola per (utente, giorno), come sul server (sync_uuid_diario). */
export function diaryDayUuid(userId: number | string, day: string): string {
  return uuid5(`habit_daily_journal|${userId}|${day}`);
}

/** Una priorità del giorno: una riga per (utente, giorno, posto 1..6), come sul server (sync_uuid_priorita). */
export function plannerPriorityUuid(
  userId: number | string,
  day: string,
  position: number,
): string {
  return uuid5(`planner_priorities|${userId}|${day}|${position}`);
}

/** Una settimana del planner: una riga per (utente, lunedì), come sul server (sync_uuid_settimana). */
export function plannerWeekUuid(userId: number | string, monday: string): string {
  return uuid5(`planner_weeks|${userId}|${monday}`);
}

/** Una durata salvata del Pomodoro: una riga per (utente, tipo, minuti), come sul server (sync_uuid_preset). */
export function pomodoroPresetUuid(
  userId: number | string,
  type: 'pomodoro' | 'pausa',
  minutes: number,
): string {
  return uuid5(`pomodoro_custom_durations|${userId}|${type}|${minutes}`);
}

/** Una carta (o carta figlia) imparata: una riga per (utente, carta, flag figlia), come sul server (sync_uuid_imparata). */
export function learntUuid(userId: number | string, targetUuid: string, isChild: boolean): string {
  return uuid5(`fc_study_learnt|${userId}|${targetUuid}|${isChild ? 1 : 0}`);
}

/** Un record di studio: una riga per (utente, tipo), come sul server (sync_uuid_record). */
export function studyRecordUuid(userId: number | string, kind: string): string {
  return uuid5(`fc_study_records|${userId}|${kind}`);
}

/** Le impostazioni di studio o l'obiettivo: una riga per utente, come sul server (sync_uuid_per_utente). */
export function perUserUuid(table: 'fc_settings' | 'fc_goals', userId: number | string): string {
  return uuid5(`${table}|${userId}`);
}
