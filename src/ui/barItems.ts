import type { BarId } from '@/core/settings/bar';

import type { TabIconKind } from './TabIcon';

/** Ogni scheda della barra in basso: la rotta (nome del file in `(tabs)`), il testo e l'icona. */
export const BAR_ITEMS: Record<BarId, { route: string; label: string; kind: TabIconKind }> = {
  home: { route: 'home', label: 'sidebar.home', kind: 'home' },
  planner: { route: 'planner', label: 'sidebar.planner', kind: 'planner' },
  todo: { route: 'index', label: 'planner.to_do', kind: 'todo' },
  buy: { route: 'buy', label: 'planner.to_buy', kind: 'buy' },
  pills: { route: 'pills', label: 'todo.tipo_pills', kind: 'pills' },
  habits: { route: 'habits', label: 'abitudini.titolo', kind: 'habits' },
  pomodoro: { route: 'pomodoro', label: 'pomodoro.tipo_pomodoro', kind: 'pomodoro' },
  diary: { route: 'diary', label: 'diario.titolo', kind: 'diary' },
  grades: { route: 'grades', label: 'voti.voti', kind: 'grades' },
  flashcards: { route: 'fc-hub', label: 'fc.flashcard', kind: 'flashcards' },
  languages: { route: 'languages', label: 'fchub.lingue_titolo', kind: 'languages' },
  projects: { route: 'projects', label: 'progetti.progetti', kind: 'projects' },
  settings: { route: 'settings', label: 'progetti.altro', kind: 'more' },
};

/** Le tre liste che si aprono già scese alle linguette (lontano dalla nota veloce). */
export const SCROLL_TO_TABS: readonly BarId[] = ['todo', 'buy', 'pills'];
