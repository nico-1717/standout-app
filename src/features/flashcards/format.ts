// Durate come le mostra il sito.
/** 125 → «2:05», 3725 → «1:02:05». */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** «oggi», «ieri», «3d fa», «2w fa», «5 mesi fa»: quando, in breve (`fcm_quando` del sito). Le date sono «AAAA-MM-GG…». */
export function whenShort(
  date: string | null,
  today: string,
  t: (key: string, o?: Record<string, unknown>) => string,
): string {
  if (!date) return '';
  const day = (s: string): number => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  const days = Math.floor((day(today) - day(date)) / 86_400_000);
  if (days <= 0) return t('fc.dk_oggi');
  if (days === 1) return t('fc.dk_ieri');
  if (days < 14) return t('fc.dk_giorni_fa', { n: days });
  if (days < 60) return t('fc.dk_sett_fa', { n: Math.floor(days / 7) });
  return t('fc.dk_mesi_fa', { n: Math.floor(days / 30) });
}
