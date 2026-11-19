import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';

import { syncLiveActivity } from './liveActivity';
import { activityFor } from './liveActivityState';

/**
 * Non disegna niente: tiene il Live Activity (il timer sulla schermata di blocco e nella Dynamic Island) allineato al Pomodoro,
 * al cronometro e alla pausa. Sta nella radice dell'app così funziona da qualsiasi pagina.
 */
export function PomodoroLiveActivity() {
  const { services, version, pomodoroSettings } = useApp();
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const brk = pomodoroSettings.current_break;
  useEffect(() => {
    void version;
    if (!services) {
      void syncLiveActivity(null);
      return;
    }
    const active = services.pomodoro.active();
    const project = active?.project_uuid ? services.projects.get(active.project_uuid) : null;
    const desired = activityFor({
      active,
      brk,
      nowMs: Date.now(),
      projectName: project?.name ?? null,
      color: project?.color ?? null,
      brandColor: th.brand,
      breakColor: th.teal,
      lang: i18n.language,
      texts: {
        focus: t('pomodoro.concentrazione'),
        focusPaused: t('pomodoro.sessione_in_pausa'),
        stopwatch: t('pomodoro.cronometro_in_corso'),
        stopwatchPaused: t('pomodoro.sessione_in_pausa'),
        breakTitle: t('pomodoro.pausa_in_corso'),
        focusDone: t('pomodoro.concluso'),
        breakDone: t('pomodoro.pausa_finita'),
        fallbackSubtitle: 'Standout',
      },
    });
    void syncLiveActivity(desired);
  }, [services, version, brk, th.brand, th.teal, i18n.language, t]);
  return null;
}
