/**
 * Le impostazioni della pagina Abitudini (tabella `habit_settings` del sito). Qui ci sono i valori di partenza:
 * l'archiviazione e la sincronizzazione con il sito arrivano con la schermata «Impostazioni».
 */
export interface HabitSettings {
  week_start: number;
  default_view: 'list' | 'table';
  visible_days: number;
  accent_color: string;
  theme_mode: 'auto' | 'light' | 'dark';
  show_archived: boolean;
  group_by_day_part: boolean;
  haptics_enabled: boolean;
  sound_enabled: boolean;
  confetti_enabled: boolean;
  carousel_autoplay: boolean;
  carousel_interval_s: number;
  chart_range_days: number;
  streak_freezes: number;
}

export const DEFAULT_HABIT_SETTINGS: HabitSettings = {
  week_start: 1,
  default_view: 'list',
  visible_days: 11,
  accent_color: '#7C5CFF',
  theme_mode: 'auto',
  show_archived: false,
  group_by_day_part: true,
  haptics_enabled: true,
  sound_enabled: true,
  confetti_enabled: true,
  carousel_autoplay: true,
  carousel_interval_s: 6,
  chart_range_days: 30,
  streak_freezes: 3,
};
