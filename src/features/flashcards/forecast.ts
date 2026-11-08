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
