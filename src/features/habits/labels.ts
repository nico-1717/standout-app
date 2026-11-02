import type { TFunction } from 'i18next';

import type { Habit } from './logic';
import { addDays } from './logic';

/** «Tutti i giorni», «5 giorni a settimana», «3 volte a settimana»… come freqLabel() del sito. */
export function freqLabel(h: Habit, t: TFunction): string {
  if (h.frequency_type === 'daily') {
    const n = h.weekdays.split('').filter((c) => c === '1').length;
    return n === 7 ? t('abitudini.tutti_i_giorni') : t('abitudini.n_giorni_a_settimana', { n });
  }
  if (h.frequency_type === 'weekly')
    return t('abitudini.n_volte_a_settimana', { n: h.times_per_week });
  if (h.frequency_type === 'monthly')
    return t('abitudini.n_volte_al_mese', { n: h.times_per_month });
  return t('abitudini.ogni_maiusc_n_giorni', { n: h.interval_days });
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** «🎯 8 bicchieri», «🚫 < 3 tazze», «✅ Da fare»… */
export function goalTag(h: Habit, t: TFunction): string {
  if (h.kind === 'quit')
    return h.goal_type === 'quantity'
      ? `🚫 < ${num(h.target_amount)} ${h.unit}`.trim()
      : t('abitudini.da_evitare');
  return h.goal_type === 'quantity'
    ? `🎯 ${num(h.target_amount)} ${h.unit}`.trim()
    : t('abitudini.da_fare_2');
}

/** «Oggi», «Ieri», «Lun 2 nov» (come labelDate del sito). */
export function labelDate(day: string, today: string, t: TFunction): string {
  if (day === today) return t('comune.oggi');
  if (day === addDays(today, -1)) return t('comune.ieri');
  const dow = ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return `${t(`abitudini.dow_${dow}`)} ${Number(day.slice(8))} ${t(`abitudini.mesb_${Number(day.slice(5, 7))}`).toLowerCase()}`;
}

export const monthTitle = (ym: string, t: TFunction) =>
  `${t(`abitudini.mese_${Number(ym.slice(5, 7))}`)} ${ym.slice(0, 4)}`;
