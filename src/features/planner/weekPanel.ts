const SYLLABLES = [
  'ra',
  'mo',
  'ten',
  'li',
  'sa',
  've',
  'no',
  'ri',
  'ta',
  'pe',
  'lu',
  'co',
  'mi',
  'den',
  'so',
  'fa',
  'gi',
  'ne',
  'tro',
  'bel',
];

/** Un piccolo generatore con seme: stesso giorno, stesso testo finto (così non cambia a ogni disegno). */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Il testo che sta sotto il velo del diario: parole che non esistono. Sfocare il testo vero non basta a
 * nasconderlo (la lunghezza delle righe, a volte le parole stesse si intuiscono), e chi guarda lo schermo da sopra
 * la spalla non deve poter ricavare niente: il diario vero si legge solo premendo «Mostra».
 */
export function diaryFakeText(seed: string): string {
  const r = rng(`diary|${seed}`);
  const word = () => {
    const n = 1 + Math.floor(r() * 3);
    let w = '';
    for (let i = 0; i < n; i++) w += SYLLABLES[Math.floor(r() * SYLLABLES.length)];
    return w;
  };
  const sentence = (min: number, max: number) => {
    const n = min + Math.floor(r() * (max - min + 1));
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(word());
    const s = out.join(' ');
    return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
  };
  return `${sentence(9, 14)} ${sentence(6, 11)} ${sentence(5, 9)}`;
}
