import * as Speech from 'expo-speech';

/**
 * Pronuncia delle parole (fc_speak.js del sito), con la voce del telefono: costa zero e funziona senza rete.
 * La parola si dice due volte, la seconda più lenta (la prima per sentirla com'è, la seconda per coglierne i suoni);
 * le frasi e le traduzioni una volta sola. Mai le voci robotiche (Eloquence e simili).
 */

export interface VoiceInfo {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
}

const ROBOTIC = ['reed', 'shelley', 'sandy', 'rocko', 'flo', 'eddy', 'grandma', 'grandpa'];
const norm = (l: string): string => l.replace('_', '-').toLowerCase();

/** La voce migliore per una lingua («en-GB»): la lingua esatta, poi le voci di qualità; `null` se non ce ne sono. */
export function pickVoice(voices: readonly VoiceInfo[], lang: string): VoiceInfo | null {
  const exact = norm(lang);
  const prefix = exact.split('-')[0]!;
  const valid = voices.filter((v) => {
    if (!v.language) return false;
    const name = v.name.toLowerCase();
    const id = v.identifier.toLowerCase();
    if (!norm(v.language).startsWith(prefix)) return false;
    if (name.includes('eloquence') || id.includes('eloquence')) return false;
    return !ROBOTIC.includes(name);
  });
  const points = (v: VoiceInfo): number => {
    const n = v.name.toLowerCase();
    let p = 0;
    if (norm(v.language) === exact) p += 50;
    if (n.includes('google')) p += 40;
    if (/premium|enhanced|natural|online/.test(n) || /enhanced|premium/i.test(v.quality ?? ''))
      p += 30;
    return p;
  };
  return [...valid].sort((a, b) => points(b) - points(a))[0] ?? null;
}

let voicesCache: Promise<VoiceInfo[]> | null = null;
const loadVoices = (): Promise<VoiceInfo[]> => {
  voicesCache ??= Speech.getAvailableVoicesAsync()
    .then((v) => v as VoiceInfo[])
    .catch(() => []);
  return voicesCache;
};

/** La voce scelta per ogni lingua, calcolata una volta sola: la lettura parte subito. */
const picked = new Map<string, string | null>();
let voiceList: VoiceInfo[] | null = null;
const voiceFor = (lang: string): string | null => {
  if (!voiceList) return null;
  if (!picked.has(lang)) picked.set(lang, pickVoice(voiceList, lang)?.identifier ?? null);
  return picked.get(lang) ?? null;
};

/** Carica in anticipo l'elenco delle voci (all'apertura del gioco), così la prima lettura non aspetta. */
export function warmVoices(langs: readonly string[] = []): void {
  void loadVoices().then((v) => {
    voiceList = v;
    for (const l of langs) voiceFor(l);
  });
}

/** Si sta già parlando? Una lettura in catena non deve fermare quella prima. */
let busy = false;

/** Dice `text` nella lingua `lang` (es. «en-GB»). `once` = una volta sola. `done` si chiama alla fine (o se non si può parlare). */
export async function speak(
  text: string,
  lang: string,
  opts: { once?: boolean; done?: () => void; chain?: boolean } = {},
): Promise<void> {
  const t = text.trim();
  if (!t) {
    opts.done?.();
    return;
  }
  try {
    // fermare costa qualche decimo di secondo su iPhone: solo se c'è davvero qualcosa che sta parlando
    if (!opts.chain && busy) void Speech.stop();
    if (!voiceList) voiceList = await loadVoices();
    const voice = voiceFor(lang);
    const base = { language: lang, ...(voice ? { voice } : {}) };
    busy = true;
    const finish = () => {
      busy = false;
      opts.done?.();
    };
    if (opts.once) {
      Speech.speak(t, { ...base, rate: 1, onDone: finish, onStopped: finish, onError: finish });
      return;
    }
    Speech.speak(t, { ...base, rate: 1 });
    Speech.speak(t, { ...base, rate: 0.8, onDone: finish, onStopped: finish, onError: finish });
  } catch {
    opts.done?.();
  }
}

export const stopSpeaking = (): void => {
  busy = false;
  void Speech.stop();
};

let reading = 0;
/**
 * Legge dei pezzi uno dopo l'altro (la lettura automatica fuori dalla partita a voce). Una lettura nuova ferma quella
 * in corso.
 */
export function readAloud(parts: readonly { text: string; lang: string; once?: boolean }[]): void {
  const mine = ++reading;
  const list = parts.filter((p) => p.text.trim());
  stopSpeaking();
  let i = 0;
  const next = (): void => {
    if (mine !== reading) return;
    const p = list[i++];
    if (!p) return;
    void speak(p.text, p.lang, { once: p.once, chain: i > 1, done: next });
  };
  next();
}

/** Ferma la lettura automatica (si cambia schermata). */
export function stopReading(): void {
  reading++;
  stopSpeaking();
}
