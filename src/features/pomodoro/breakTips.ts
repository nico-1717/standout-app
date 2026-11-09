/** Quanti consigli ci sono per la pausa (`pomodoro.pausa_consiglio_1` … `_N`). */
export const BREAK_TIPS = 6;

/** Il consiglio di questa pausa (da 1 a BREAK_TIPS): sempre lo stesso per la stessa pausa, cambia da una pausa all'altra. */
export function breakTipIndex(startTime: string): number {
  let h = 0;
  for (let i = 0; i < startTime.length; i++) h = (h * 31 + startTime.charCodeAt(i)) % 1000003;
  return (h % BREAK_TIPS) + 1;
}
