import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';

import { clock, elapsedSeconds, remainingSeconds, stampMs } from './logic';
import { useTicker } from './useTicker';

/**
 * La barretta sopra le schede mentre un Pomodoro, un cronometro o una pausa sono in corso (pomodoro_barra del sito):
 * mostra il tempo, e toccandola si apre la schermata del Pomodoro. Non c'è niente da mostrare = non occupa spazio.
 */
export function PomodoroBar() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { services, version, pomodoroSettings } = useApp();
  const active = useMemo(() => {
    void version;
    return services?.pomodoro.active() ?? null;
  }, [services, version]);
  const brk = pomodoroSettings.current_break;
  const color = useMemo(() => {
    void version;
    if (!active?.project_uuid || !services) return null;
    return services.projects.get(active.project_uuid)?.color ?? null;
  }, [active, services, version]);
  const now = useTicker(!!active || !!brk, () => {});
  if (!active && !brk) return null;

  let text = '';
  let label = '';
  let dot = th.brand;
  if (active) {
    const left = remainingSeconds(active, now);
    text = clock(left !== null ? left : elapsedSeconds(active, now));
    label =
      active.status === 'pausa'
        ? t('pomodoro.sessione_in_pausa')
        : active.mode === 1
          ? t('pomodoro.cronometro_in_corso')
          : t('pomodoro.concentrazione');
    dot = color ?? '#8E8E93';
  } else if (brk) {
    const left = brk.planned_duration_min * 60 - Math.floor((now - stampMs(brk.start_time)) / 1000);
    text = clock(Math.max(0, left));
    label = left <= 0 ? t('pomodoro.pausa_finita') : t('pomodoro.pausa_in_corso');
    dot = th.teal;
  }
  return (
    <Pressable
      testID="pomodoro-bar"
      accessibilityRole="button"
      accessibilityLabel={t('pomodoro.apri_comandi')}
      onPress={() => router.push('/pomodoro')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 9,
        backgroundColor: th.headerGlass,
        borderTopWidth: 0.5,
        borderTopColor: th.hairline,
      }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
      <Text style={{ color: th.text2, flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text
        testID="pomodoro-bar-clock"
        style={{ color: th.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}
      >
        {text}
      </Text>
    </Pressable>
  );
}
