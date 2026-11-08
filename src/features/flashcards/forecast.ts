export interface KnownDay {
  date: string;
  count: number;
}

const DAY = 86_400_000;
const time = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * «Di questo passo finisci tra N settimane» (la previsione di fc_stats.php): il ritmo è quante carte hai imparato fra il
 * primo e l'ultimo giorno con una carta nuova. Senza almeno due giorni, o con un ritmo quasi nullo, non c'è previsione.
 */
export function finishForecast(
  trend: KnownDay[],
  known: number,
  total: number,
  today: string,
): { weeks: number; date: string } | null {
  if (known <= 0 || trend.length < 2 || total <= known) return null;
  const span = Math.max(
    1,
    Math.round((time(trend[trend.length - 1]!.date) - time(trend[0]!.date)) / DAY),
  );
  const perWeek = (known / span) * 7;
  if (perWeek <= 0.05) return null;
  const weeksLeft = (total - known) / perWeek;
  const when = new Date(time(today) + Math.round(weeksLeft * 7) * DAY);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    weeks: Math.round(weeksLeft * 10) / 10,
    date: `${p(when.getUTCDate())}/${p(when.getUTCMonth() + 1)}/${when.getUTCFullYear()}`,
  };
}

/**
 * La curva dell'apprendimento: il totale cumulato giorno per giorno (storico) e, dall'ultimo giorno, un punto a settimana
 * fino al totale delle carte (proiezione), allo stesso ritmo di `finishForecast`. Meno di due giorni = nessuna curva.
 */
export function learningCurve(
  trend: KnownDay[],
  total: number,
): { hist: number[]; proj: number[]; labels: string[] } {
  let cum = 0;
  const hist: number[] = [];
  const labels: string[] = [];
  for (const d of trend) {
    cum += d.count;
    hist.push(cum);
    labels.push(d.date);
  }
  if (hist.length < 2) return { hist: [], proj: [], labels: [] };
  const proj: number[] = [];
  if (cum < total) {
    const first = time(trend[0]!.date);
    const last = time(trend[trend.length - 1]!.date);
    const perDay = cum / Math.max(1, (last - first) / DAY);
    if (perDay > 0.01) {
      let at = cum;
      let when = last;
      for (let guard = 0; at < total && guard < 300; guard++) {
        when += 7 * DAY;
        at = Math.min(total, at + perDay * 7);
        proj.push(Math.round(at));
        labels.push(iso(when));
      }
    }
  }
  return { hist, proj, labels };
}

export interface SpeedStats {
  /** quante partite */
  games: number;
  /** secondi per carta: la media delle più recenti */
  recent: number;
  /** quanto più veloce rispetto alle prime (in %): null con meno di 4 partite */
  improvement: number | null;
  trend: 'up' | 'down' | 'flat';
}

/**
 * La velocità di risposta e la sua tendenza (`computeCatSpeedStats` del sito): si confrontano la media delle partite più
 * vecchie con quella delle più recenti (un terzo ciascuna, almeno 2). Oltre il 4% è «su» o «giù», altrimenti stabile.
 * `spcs` è in ordine di giorno.
 */
export function speedStats(spcs: number[]): SpeedStats | null {
  if (!spcs.length) return null;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  if (spcs.length < 4) {
    return { games: spcs.length, recent: avg(spcs), improvement: null, trend: 'flat' };
  }
  const chunk = Math.max(2, Math.floor(spcs.length / 3));
  const old = avg(spcs.slice(0, chunk));
  const recent = avg(spcs.slice(-chunk));
  const improvement = old > 0 ? Math.round(((old - recent) / old) * 100) : 0;
  return {
    games: spcs.length,
    recent,
    improvement,
    trend: improvement > 4 ? 'up' : improvement < -4 ? 'down' : 'flat',
  };
}

/** I secondi per carta come li scrive il sito: un decimale sotto i 10, intero sopra. */
export function secPerCard(spc: number): string {
  return spc < 10 ? spc.toFixed(1) : String(Math.round(spc));
}
