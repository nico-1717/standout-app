import { useFocusEffect } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';

import {
  attachLog,
  buildReport,
  clearLog,
  installCrashLog,
  logStep,
  readFlags,
  readLog,
  writeFlags,
  type DebugFlags,
} from './debugLog';

function updateInfo(): Record<string, unknown> {
  try {
    return {
      updateId: Updates.updateId ?? null,
      runtimeVersion: Updates.runtimeVersion ?? null,
      channel: Updates.channel ?? null,
      embedded: Updates.isEmbeddedLaunch ?? null,
      createdAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
    };
  } catch (e) {
    return { error: String(e) };
  }
}

/**
 * Prima di aprire il Pomodoro: una schermata con tutto lo stato (sessione, pausa, impostazioni, versione dell'app) e il
 * registro degli ultimi passi, da mandare a Claude se la pagina si chiude. Gli interruttori servono a provare, sul
 * telefono, quale parte della pagina la fa chiudere. Torna da sola ogni volta che si lascia il Pomodoro.
 */
export function DebugGate(p: { children: ReactNode }) {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const { services, version, pomodoroSettings } = useApp();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [flags, setFlags] = useState<DebugFlags>(() =>
    services ? readFlags(services.db) : { noScene: false, noFx: false },
  );

  useMemo(() => {
    if (services) {
      attachLog(services.db);
      installCrashLog();
    }
  }, [services]);

  // lasciando la pagina si torna a questa schermata
  useFocusEffect(
    useCallback(() => {
      logStep('Pomodoro route focused');
      setTick((n) => n + 1);
      return () => {
        logStep('Pomodoro route left');
        setOpen(false);
      };
    }, []),
  );

  const report = useMemo(() => {
    void version;
    void tick;
    if (!services) return 'Not ready yet (no services).';
    let active: unknown = null;
    let done: unknown = null;
    let notice: unknown = null;
    try {
      active = services.pomodoro.active();
      done = services.pomodoro.lastCompleted();
      notice = services.pomodoro.abandonedNotice();
    } catch (e) {
      active = `ERROR reading sessions: ${String(e)}`;
    }
    return buildReport({
      now: new Date(),
      update: updateInfo(),
      settings: pomodoroSettings,
      active,
      done,
      notice,
      flags,
      log: readLog(),
    });
  }, [services, version, pomodoroSettings, flags, tick]);

  if (open) return <>{p.children}</>;

  const flip = (k: keyof DebugFlags) => {
    const next = { ...flags, [k]: !flags[k] };
    setFlags(next);
    if (services) writeFlags(services.db, next);
    logStep(`flag ${k}=${next[k]}`);
  };
  const chip = (k: keyof DebugFlags, label: string) => (
    <Pressable
      key={k}
      testID={`gate-flag-${k}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: flags[k] }}
      onPress={() => flip(k)}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: flags[k] ? th.brand : th.surface2,
      }}
    >
      <Text style={{ color: flags[k] ? '#fff' : th.text, fontWeight: '700', fontSize: 13 }}>
        {label}: {flags[k] ? 'ON' : 'off'}
      </Text>
    </Pressable>
  );
  const button = (id: string, label: string, onPress: () => void, primary = false) => (
    <Pressable
      key={id}
      testID={id}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 13,
        borderRadius: 16,
        backgroundColor: primary ? th.brand : th.surface2,
      }}
    >
      <Text style={{ color: primary ? '#fff' : th.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View
      testID="pomodoro-gate"
      style={{
        flex: 1,
        backgroundColor: th.bg,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 12,
        paddingHorizontal: 16,
        gap: 10,
      }}
    >
      <Text style={{ color: th.text, fontSize: 20, fontWeight: '800' }}>Pomodoro diagnostics</Text>
      <Text style={{ color: th.text2, fontSize: 13 }}>
        If the page closes the app, reopen the app, come back here and tap Share: the last steps
        before the crash are saved below.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {chip('noScene', 'Hide break drawing')}
        {chip('noFx', 'Hide glow and sparks')}
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: th.surface, borderRadius: 14 }}
        contentContainerStyle={{ padding: 12 }}
      >
        <Text
          selectable
          testID="gate-report"
          style={{ color: th.text, fontSize: 11, fontFamily: 'Menlo', lineHeight: 15 }}
        >
          {report}
        </Text>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {button('gate-share', 'Share report', () => {
          void Share.share({ message: report }).catch(() => undefined);
        })}
        {button('gate-clear', 'Clear log', () => {
          clearLog();
          setTick((n) => n + 1);
        })}
      </View>
      {button(
        'gate-open',
        'Open Pomodoro',
        () => {
          logStep('gate: Open pressed');
          setOpen(true);
        },
        true,
      )}
    </View>
  );
}
