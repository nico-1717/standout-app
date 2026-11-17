import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { askPermission } from '@/features/reminders/notifier';
import { cancelAlarm, scheduleAlarm } from '@/features/pomodoro/alarm';
import {
  clock,
  elapsedSeconds,
  human,
  remainingSeconds,
  stampMs,
  type Session,
} from '@/features/pomodoro/logic';
import type { PresetKind } from '@/features/pomodoro/repo';
import { BreakScene } from '@/features/pomodoro/BreakScene';
import { Hourglass } from '@/features/pomodoro/Hourglass';
import { Dial } from '@/features/pomodoro/Dial';
import { DurationSheet } from '@/features/pomodoro/DurationSheet';
import { RoundButton } from '@/features/pomodoro/RoundButton';
import { NEUTRAL_ACCENT, withAlpha } from '@/features/pomodoro/colors';
import { breakTipIndex } from '@/features/pomodoro/breakTips';
import { TasksNote } from '@/features/pomodoro/TasksNote';
import { useTicker } from '@/features/pomodoro/useTicker';
import { ProjectSheet } from '@/features/projects/ProjectSheet';
import { Avatar } from '@/ui/Avatar';
import { Card, PrimaryButton, TextButton, titleStyle } from '@/ui/kit';

/** Parte da solo una volta (dal Piano: «ogni giorno» → Avvia il timer). */
function AutoStart({ go }: { go: () => void }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    go();
  }, [go]);
  return null;
}

/** Il Pomodoro: timer a tempo o cronometro, pausa, progetto, e la pausa dopo lo studio (pomodoro.php). */
export default function PomodoroScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { services, version, changed, pomodoroSettings, updatePomodoroSettings, authState } =
    useApp();
  const userName = authState.status === 'signedIn' ? authState.user.username : '';

  const {
    project: projectParam,
    min: minParam,
    auto: autoParam,
  } = useLocalSearchParams<{
    project?: string;
    min?: string;
    auto?: string;
  }>();
  const minFromPlan = typeof minParam === 'string' ? parseInt(minParam, 10) : NaN;
  const fromPlan = Number.isFinite(minFromPlan) && minFromPlan >= 1 && minFromPlan <= 600;
  const [mode, setMode] = useState<0 | 1>(fromPlan ? 0 : pomodoroSettings.last_mode);
  const [minutes, setMinutes] = useState(
    fromPlan ? minFromPlan : pomodoroSettings.last_pomodoro_duration_min,
  );
  const [breakMin, setBreakMin] = useState(pomodoroSettings.last_break_duration_min);
  const [project, setProject] = useState<string | null>(
    typeof projectParam === 'string' ? projectParam : null,
  );
  const [picking, setPicking] = useState(false);
  const [durOpen, setDurOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [short, setShort] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [noteTasks, setNoteTasks] = useState<string[]>([]);

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    const p = services.pomodoro;
    return {
      active: p.active(),
      done: p.lastCompleted(),
      notice: p.abandonedNotice(),
      pomos: p.presets('pomodoro'),
      breaks: p.presets('pausa'),
      projects: services.projects.all(),
    };
  }, [services, version]);

  const brk = pomodoroSettings.current_break;
  /* anche a pomodoro finito il tempo scorre: è il «tempo in più» che il sito conta sotto il quadrante */
  const live = !!data?.active || !!brk || !!data?.done;

  const onTick = useCallback(
    (nowMs: number) => {
      if (!services) return;
      const p = services.pomodoro;
      if (p.closeStale()) {
        changed();
        return;
      }
      const s = p.active();
      if (s && s.status !== 'pausa') {
        const left = remainingSeconds(s, nowMs);
        if (left !== null && left <= 0 && p.complete(s.uuid)) {
          void cancelAlarm();
          changed();
        }
      }
    },
    [services, changed],
  );
  const nowMs = useTicker(live, onTick);

  if (!services || !data) return null;
  const { active, done, notice } = data;
  const brkLeft = brk
    ? brk.planned_duration_min * 60 - Math.floor((nowMs - stampMs(brk.start_time)) / 1000)
    : 0;
  const brkOver = !!brk && brkLeft <= 0;
  const nameOf = (id: string | null) => data.projects.find((p) => p.uuid === id)?.name ?? null;
  const colorOf = (id: string | null) => data.projects.find((p) => p.uuid === id)?.color ?? null;

  const alarmText = (title: string) => ({
    channel: t('pomodoro.timer'),
    title,
    body: t('pomodoro.torna_al_lavoro'),
  });
  const armAlarm = (s: Session | null) => {
    if (!s || s.mode !== 0 || s.status === 'pausa') return;
    const left = remainingSeconds(s, Date.now());
    if (left !== null && left > 0)
      void scheduleAlarm(new Date(Date.now() + left * 1000), alarmText(t('pomodoro.concluso')));
  };

  const start = async () => {
    void askPermission();
    const id = services.pomodoro.start({
      mode,
      plannedMin: mode === 0 ? minutes : undefined,
      projectUuid: project,
    });
    if (!id) return;
    updatePomodoroSettings(
      mode === 0 ? { last_mode: 0, last_pomodoro_duration_min: minutes } : { last_mode: 1 },
    );
    armAlarm(services.pomodoro.get(id));
    changed();
  };
  const pause = (s: Session) => {
    services.pomodoro.pause(s.uuid);
    void cancelAlarm();
    changed();
  };
  const resume = (s: Session) => {
    services.pomodoro.resume(s.uuid);
    armAlarm(services.pomodoro.get(s.uuid));
    changed();
  };
  const startBreak = (min: number) => {
    void askPermission();
    updatePomodoroSettings({
      last_break_duration_min: min,
      current_break: {
        start_time: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' '),
        planned_duration_min: min,
        project_uuid: null,
      },
    });
    void scheduleAlarm(new Date(Date.now() + min * 60000), {
      channel: t('pomodoro.timer'),
      title: t('pomodoro.pausa_finita'),
      body: t('pomodoro.torna_al_lavoro'),
    });
  };
  const endBreak = () => {
    updatePomodoroSettings({ current_break: null });
    void cancelAlarm();
  };
  const closeStop = () => {
    setStopping(false);
    setShort(false);
    setDiscarding(false);
  };
  /** Ferma il timer a mano; `thenBreak` = subito dopo parte la pausa. Sotto i 5 minuti si chiede se tenere la sessione. */
  const stopNow = (s: Session, thenBreak: boolean, skipShortCheck = false) => {
    if (!skipShortCheck && elapsedSeconds(s, Date.now()) < 300) {
      setShort(true);
      return;
    }
    services.pomodoro.stop(s.uuid);
    void cancelAlarm();
    closeStop();
    changed();
    if (thenBreak) startBreak(breakMin);
  };
  const discard = (s: Session) => {
    services.pomodoro.stop(s.uuid, true);
    void cancelAlarm();
    closeStop();
    changed();
  };

  const removePreset = (kind: PresetKind, m: number) => {
    services.pomodoro.removePreset(kind, m);
    if (kind === 'pomodoro' && minutes === m) {
      setMinutes(25);
      updatePomodoroSettings({ last_pomodoro_duration_min: 25 });
    }
    if (kind === 'pausa' && breakMin === m) {
      setBreakMin(5);
      updatePomodoroSettings({ last_break_duration_min: 5 });
    }
    changed();
  };

  /* ---------------- pezzi ---------------- */

  const dark = th.scheme === 'dark';
  const glassView = pomodoroSettings.last_display_style === 'clessidra';
  const toggleView = () =>
    updatePomodoroSettings({ last_display_style: glassView ? 'cerchio' : 'clessidra' });

  const state: 'idle' | 'run' | 'pause' | 'break' | 'done' = active
    ? active.status === 'pausa'
      ? 'pause'
      : 'run'
    : brk
      ? 'break'
      : done
        ? 'done'
        : 'idle';
  const shownProject = active ? active.project_uuid : done && !brk ? done.project_uuid : project;
  const projectColor = colorOf(shownProject);
  const accent = state === 'break' ? th.teal : (projectColor ?? NEUTRAL_ACCENT[th.scheme]);
  const lineage = (() => {
    const own = data.projects.find((p) => p.uuid === shownProject);
    if (!own) return '';
    const names: string[] = [];
    let cur = data.projects.find((p) => p.uuid === own.parent_uuid);
    let guard = 0;
    while (cur && guard++ < 12) {
      names.unshift(cur.name);
      const up: string | null = cur.parent_uuid;
      cur = data.projects.find((p) => p.uuid === up);
    }
    return names.join(' › ');
  })();

  const dial = Math.min(Math.round(width * 0.78), 300);

  /** il quadrante: cerchio o clessidra, con il tempo e (se c'è) la pastiglia sotto */
  const face = (o: {
    time: string;
    fraction: number;
    timeColor?: string;
    sub?: string;
    glow: boolean;
    spark: boolean;
    flip?: boolean;
    onPress?: () => void;
  }) =>
    glassView ? (
      <Pressable
        testID="pomodoro-dial"
        disabled={!o.onPress}
        onPress={o.onPress}
        style={{ alignItems: 'center', gap: 10, marginVertical: 6 }}
      >
        <Hourglass
          fraction={o.fraction}
          running={state === 'run' || state === 'break'}
          flip={!!o.flip}
          color={accent}
          glass={th.text3}
        />
        <Text
          testID="pomodoro-clock"
          style={{
            color: o.timeColor ?? th.text,
            fontSize: th.display ? 60 : 54,
            lineHeight: 58,
            fontWeight: th.display ? undefined : '700',
            fontFamily: th.display,
            letterSpacing: -1.6,
            fontVariant: ['tabular-nums'],
          }}
        >
          {o.time}
        </Text>
        {o.sub ? (
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 11,
              borderRadius: 999,
              backgroundColor: th.surface2,
              boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
            }}
          >
            <Text style={{ color: th.text2, fontSize: 11, fontWeight: '700' }}>{o.sub}</Text>
          </View>
        ) : null}
      </Pressable>
    ) : (
      <Dial
        size={dial}
        fraction={o.fraction}
        accent={accent}
        time={o.time}
        timeColor={o.timeColor}
        sub={o.sub}
        glow={o.glow}
        spark={o.spark}
        onPress={o.onPress}
      />
    );

  const statusLabel =
    state === 'run'
      ? active?.mode === 1
        ? t('pomodoro.cronometro_in_corso')
        : t('pomodoro.concentrazione')
      : state === 'pause'
        ? t('pomodoro.sessione_in_pausa')
        : state === 'break'
          ? brkOver
            ? t('pomodoro.pausa_finita')
            : t('pomodoro.pausa_in_corso')
          : state === 'done'
            ? t('pomodoro.completato')
            : t('pomodoro.pronto');

  /* ---------------- le viste ---------------- */

  let clockText = clock(minutes * 60);
  let fraction = 0;
  let timeColor: string | undefined;
  let sub: string | undefined;
  let glow = false;
  let spark = false;
  let flip = false;

  if (active) {
    const secs = elapsedSeconds(active, nowMs);
    const left = remainingSeconds(active, nowMs);
    clockText = left !== null ? clock(left) : clock(secs);
    fraction =
      left !== null && active.planned_duration_min
        ? 1 - Math.max(0, left) / (active.planned_duration_min * 60)
        : (secs % 3600) / 3600;
    glow = true;
    spark = state === 'run';
    flip = secs < 3;
  } else if (brk) {
    clockText = clock(Math.max(0, brkLeft));
    fraction = brkOver ? 1 : 1 - brkLeft / (brk.planned_duration_min * 60);
    timeColor = th.teal;
    glow = true;
    spark = !brkOver;
  } else if (done) {
    clockText = clock(done.duration_seconds ?? 0);
    fraction = 1;
    timeColor = th.text3;
    glow = true;
    spark = true;
  } else {
    clockText = mode === 0 ? clock(minutes * 60) : '00:00';
    sub = mode === 0 ? t('pomodoro.pausa_di', { minuti: breakMin }) : undefined;
  }

  const dialPress = state === 'idle' && mode === 0 ? () => setDurOpen(true) : undefined;
  const tasksTime = clockText;

  const stopCard =
    active && stopping ? (
      <Card style={{ padding: 16, gap: 10 }}>
        {short ? (
          <>
            <Text style={[{ color: th.text }, titleStyle(th, 17, '700')]}>
              {t('pomodoro.molto_breve')}
            </Text>
            <Text style={{ color: th.text2 }}>{t('pomodoro.molto_breve_testo')}</Text>
            <PrimaryButton
              testID="short-save"
              label={t('pomodoro.si_salva')}
              onPress={() => stopNow(active, false, true)}
            />
            <TextButton
              testID="short-discard"
              danger
              label={t('pomodoro.scarta')}
              onPress={() => discard(active)}
            />
            <TextButton label={t('pomodoro.scelta_continua')} onPress={closeStop} />
          </>
        ) : discarding ? (
          <>
            <Text style={[{ color: th.text }, titleStyle(th, 17, '700')]}>
              {t('pomodoro.scarta_titolo')}
            </Text>
            <Text style={{ color: th.text2 }}>{t('pomodoro.scarta_testo')}</Text>
            <PrimaryButton
              testID="discard-yes"
              danger
              label={t('pomodoro.scarta_si')}
              onPress={() => discard(active)}
            />
            <TextButton label={t('pomodoro.scelta_continua')} onPress={closeStop} />
          </>
        ) : (
          <>
            <Text style={[{ color: th.text }, titleStyle(th, 17, '700')]}>
              {t('pomodoro.scelta_stop_titolo')}
            </Text>
            <Text style={{ color: th.text2 }}>{t('pomodoro.scelta_stop_testo')}</Text>
            <PrimaryButton
              testID="stop-break"
              label={`${t('pomodoro.scelta_pausa')} · ${breakMin} min`}
              onPress={() => stopNow(active, true)}
            />
            <TextButton
              testID="stop-end"
              label={t('pomodoro.scelta_chiudi')}
              onPress={() => stopNow(active, false)}
            />
            <TextButton
              testID="stop-keep"
              label={t('pomodoro.scelta_continua')}
              onPress={closeStop}
            />
            <TextButton
              testID="stop-discard"
              danger
              label={t('pomodoro.scelta_scarta')}
              onPress={() => setDiscarding(true)}
            />
          </>
        )}
      </Card>
    ) : null;

  const buttons = active ? (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
      {state === 'pause' ? (
        <RoundButton
          kind="play"
          testID="pomodoro-resume"
          label={t('pomodoro.riprendi')}
          onPress={() => resume(active)}
          accent={accent}
        />
      ) : (
        <RoundButton
          kind="pause"
          testID="pomodoro-pause"
          label={t('pomodoro.pausa')}
          onPress={() => pause(active)}
        />
      )}
      <RoundButton
        kind="stop"
        testID="pomodoro-stop"
        label={t('pomodoro.stop')}
        onPress={() => setStopping(true)}
      />
    </View>
  ) : brk ? (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
      <RoundButton
        kind="stop"
        testID="break-end"
        label={brkOver ? t('pomodoro.pronto_altro') : t('pomodoro.interrompi')}
        onPress={endBreak}
      />
      <RoundButton
        kind="play"
        testID="break-new"
        label={t('pomodoro.start')}
        onPress={() => {
          endBreak();
          void start();
        }}
        accent={NEUTRAL_ACCENT[th.scheme]}
      />
    </View>
  ) : done ? (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
      <RoundButton
        kind="check"
        testID="done-close"
        label={t('pomodoro.scelta_chiudi')}
        onPress={() => {
          services.pomodoro.archive(done.uuid);
          changed();
        }}
      />
      <RoundButton
        kind="cup"
        testID="done-break"
        label={`${t('pomodoro.scelta_pausa')} · ${breakMin} min`}
        accent={th.teal}
        onPress={() => {
          services.pomodoro.archive(done.uuid);
          changed();
          startBreak(breakMin);
        }}
      />
    </View>
  ) : (
    <View style={{ alignItems: 'center' }}>
      <RoundButton
        kind="play"
        testID="pomodoro-start"
        label={t('pomodoro.start')}
        onPress={start}
        large
        accent={accent}
      />
    </View>
  );

  const idle = state === 'idle';
  const modeShown = active ? active.mode : mode;
  const wash = dark ? 0.16 : 0.22;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      {autoParam === '1' && fromPlan && !active && !brk ? (
        <AutoStart go={() => void start()} />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(accent, wash), withAlpha(accent, 0)]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '60%' }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(accent, 0), withAlpha(accent, wash / 2)]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' }}
      />
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          testID="pomodoro-close"
          accessibilityRole="button"
          accessibilityLabel={t('comune.chiudi')}
          onPress={() => router.back()}
          hitSlop={6}
          style={[
            styles.pill,
            { width: 34, height: 34, paddingHorizontal: 0, backgroundColor: th.surface2 },
          ]}
        >
          <Text style={{ color: th.text, fontSize: 20, lineHeight: 22, fontWeight: '600' }}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[{ flex: 1, color: th.text }, titleStyle(th, 21)]}>
          Pomodoro
        </Text>
        <Pressable
          testID="pomodoro-history"
          accessibilityRole="button"
          onPress={() => router.push('/pomodoro-history')}
          style={[
            styles.pill,
            {
              flexDirection: 'row',
              gap: 7,
              backgroundColor: th.surface2,
              boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
            },
          ]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={8} stroke={th.text} strokeWidth={2} />
            <Path d="M12 8v4.4l3 1.8" stroke={th.text} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <Text style={{ color: th.text, fontWeight: '700', fontSize: 15 }}>
            {t('pomodoro.storico')}
          </Text>
        </Pressable>
        <Avatar
          letter={(userName[0] ?? '?').toUpperCase()}
          label={t('app.account')}
          onPress={() => router.push('/account')}
          testID="pomodoro-avatar"
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: insets.bottom + 90,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start' }}>
          <Pressable
            testID="pomodoro-view"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('pomodoro.cambia_vista')}
            accessibilityState={{ selected: glassView }}
            onPress={toggleView}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: th.surface2,
              boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
            }}
          >
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 2h12M6 22h12M6 2v3.3c0 .6.24 1.2.66 1.6L12 12l5.34-5.1c.42-.4.66-1 .66-1.6V2M18 22v-3.3c0-.6-.24-1.2-.66-1.6L12 12l-5.34 5.1c-.42.4-.66 1-.66 1.6V22"
                stroke={glassView ? accent : th.text2}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', gap: 12, marginRight: 38 }}>
            <View
              style={{
                flexDirection: 'row',
                gap: 2,
                padding: 3,
                borderRadius: 15,
                backgroundColor: th.surface2,
                boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
                opacity: idle ? 1 : 0.4,
              }}
            >
              {([0, 1] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`mode-${m}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: modeShown === m, disabled: !idle }}
                  disabled={!idle}
                  onPress={() => setMode(m)}
                  style={{
                    minWidth: 104,
                    alignItems: 'center',
                    paddingVertical: 9,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: modeShown === m ? accent : 'transparent',
                    boxShadow:
                      modeShown === m ? `0 4px 12px -4px ${withAlpha(accent, 0.7)}` : undefined,
                  }}
                >
                  <Text
                    style={{
                      color: modeShown === m ? '#fff' : th.text2,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    {m === 0 ? t('pomodoro.timer') : t('pomodoro.cronometro')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              testID={active ? 'change-project' : 'pick-project'}
              onPress={() => setPicking(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                maxWidth: '100%',
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: projectColor ?? th.surface2,
                boxShadow: projectColor
                  ? `0 6px 16px -8px ${withAlpha(projectColor, 0.9)}`
                  : `inset 0 0 0 0.5px ${th.hairline}`,
              }}
            >
              {projectColor ? null : (
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: th.text3,
                  }}
                />
              )}
              <View style={{ flexShrink: 1, alignItems: projectColor ? 'center' : 'flex-start' }}>
                <Text
                  numberOfLines={1}
                  testID="pomodoro-project-name"
                  style={{
                    color: projectColor ? '#fff' : th.text2,
                    fontWeight: projectColor ? '800' : '600',
                    fontSize: 14.5,
                  }}
                >
                  {nameOf(shownProject) ?? t('pomodoro.nessun_progetto_collegato')}
                </Text>
                {projectColor && lineage ? (
                  <Text
                    numberOfLines={1}
                    style={{ color: 'rgba(255,255,255,.78)', fontSize: 10.5, fontWeight: '600' }}
                  >
                    {lineage}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </View>
        </View>

        {notice && !active ? (
          <Pressable
            testID="pomodoro-notice"
            accessibilityRole="button"
            style={{ alignSelf: 'stretch' }}
            onPress={() => {
              services.pomodoro.dismissNotice(notice.uuid);
              changed();
            }}
          >
            <Card style={{ padding: 14, backgroundColor: th.orangeSoft }}>
              <Text style={{ color: th.text }}>
                {t('pomodoro.avviso_non_terminato', {
                  quando: notice.start_time.slice(0, 16),
                  durata: human(notice.duration_seconds ?? 0),
                })}
              </Text>
            </Card>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {idle ? null : (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
          )}
          <Text
            testID="pomodoro-status"
            style={{
              color: th.text2,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.3,
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </Text>
        </View>

        {face({
          time: clockText,
          fraction,
          timeColor,
          sub,
          glow,
          spark,
          flip,
          onPress: dialPress,
        })}

        {done && !active && !brk ? (
          <Pressable
            testID="done-overtime"
            accessibilityRole="button"
            onPress={() => {
              services.pomodoro.extend(done.uuid);
              changed();
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: th.surface2,
              boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
            }}
          >
            <Text
              style={{
                color: th.text2,
                fontSize: 14,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {`+ ${clock(done.end_time ? Math.max(0, (nowMs - stampMs(done.end_time)) / 1000) : 0)}`}
            </Text>
          </Pressable>
        ) : null}

        {brk ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <BreakScene color={th.text} accent={th.teal} />
            {!brkOver ? (
              <Text testID="break-tip" style={{ color: th.text2, textAlign: 'center' }}>
                {t(`pomodoro.pausa_consiglio_${breakTipIndex(brk.start_time)}`)}
              </Text>
            ) : (
              <Text style={{ color: th.text2, textAlign: 'center' }}>
                {t('pomodoro.torna_al_lavoro')}
              </Text>
            )}
          </View>
        ) : null}

        {stopCard ?? buttons}
      </ScrollView>

      {services.tasks ? (
        <TasksNote
          repo={services.tasks}
          project={shownProject}
          created={noteTasks}
          onCreated={(uuid) => setNoteTasks((cur) => [...cur, uuid])}
          onReset={() => setNoteTasks([])}
          version={version}
          changed={changed}
          finished={!active && done ? done.uuid : null}
          time={tasksTime}
          fraction={fraction}
          accent={accent}
          bottom={insets.bottom + 16}
        />
      ) : null}

      <ProjectSheet
        visible={picking}
        projects={data.projects}
        value={shownProject}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          if (active) services.pomodoro.setProject(active.uuid, id);
          else setProject(id);
          setPicking(false);
          changed();
        }}
        onCreate={(name) => {
          const id = services.projects.create({ name });
          if (id) changed();
          return id;
        }}
      />

      {durOpen ? (
        <DurationSheet
          visible
          accent={accent}
          teal={th.teal}
          pomos={data.pomos}
          breaks={data.breaks}
          pomoValue={minutes}
          breakValue={breakMin}
          showPomodoro={mode === 0}
          onClose={() => setDurOpen(false)}
          onConfirm={(pomo, pausa) => {
            setMinutes(pomo);
            setBreakMin(pausa);
            updatePomodoroSettings({
              last_pomodoro_duration_min: pomo,
              last_break_duration_min: pausa,
            });
            setDurOpen(false);
          }}
          onSave={(kind, m) => {
            services.pomodoro.savePreset(kind, m);
            changed();
          }}
          onRemove={removePreset}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
