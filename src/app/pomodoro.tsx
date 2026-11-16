import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { RoundButton } from '@/features/pomodoro/RoundButton';
import { breakTipIndex } from '@/features/pomodoro/breakTips';
import { TasksNote } from '@/features/pomodoro/TasksNote';
import { useTicker } from '@/features/pomodoro/useTicker';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { Avatar } from '@/ui/Avatar';
import { Card, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

const GREY = '#8E8E93';

function Ring({
  size,
  pct,
  color,
  track,
  stroke = 11,
}: {
  size: number;
  pct: number;
  color: string;
  track: string;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {p > 0 && (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </Svg>
  );
}

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
  const [adding, setAdding] = useState<PresetKind | null>(null);
  const [addText, setAddText] = useState('');
  const [managing, setManaging] = useState(false);
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
  const nameOf = (id: string | null) => data.projects.find((p) => p.uuid === id)?.name ?? null;
  const colorOf = (id: string | null) => data.projects.find((p) => p.uuid === id)?.color ?? GREY;

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

  const addPreset = () => {
    if (!adding) return;
    const m = parseInt(addText, 10);
    if (Number.isFinite(m) && m >= 1 && m <= 600) {
      services.pomodoro.savePreset(adding, m);
      if (adding === 'pomodoro') setMinutes(m);
      else setBreakMin(m);
      changed();
    }
    setAdding(null);
    setAddText('');
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

  const Pill = ({
    label,
    on,
    onPress,
    testID,
    onLong,
  }: {
    label: string;
    on: boolean;
    onPress: () => void;
    testID?: string;
    onLong?: () => void;
  }) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      onLongPress={onLong}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: on ? th.brand : th.surface2,
        boxShadow: on ? undefined : `inset 0 0 0 0.5px ${th.hairline}`,
      }}
    >
      <Text style={{ color: on ? '#fff' : th.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  const durations = (kind: PresetKind, list: number[], value: number, set: (m: number) => void) => {
    const builtin: readonly number[] = kind === 'pomodoro' ? [25, 50] : [5, 10];
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {list.map((m) => (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pill
                testID={`dur-${kind}-${m}`}
                label={`${m} min`}
                on={value === m}
                onPress={() => set(m)}
              />
              {managing && !builtin.includes(m) ? (
                <Pressable
                  testID={`dur-del-${kind}-${m}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('comune.chiudi')}
                  onPress={() => removePreset(kind, m)}
                  hitSlop={8}
                >
                  <Text style={{ color: th.red, fontSize: 18 }}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pill
            testID={`dur-add-${kind}`}
            label="+"
            on={false}
            onPress={() => {
              setAdding(kind);
              setAddText('');
            }}
          />
        </View>
        {adding === kind ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              testID="dur-input"
              value={addText}
              onChangeText={setAddText}
              keyboardType="number-pad"
              placeholder="min"
              placeholderTextColor={th.text3}
              autoFocus
              style={{
                flex: 1,
                backgroundColor: th.surface,
                borderColor: th.hairline2,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: th.text,
              }}
            />
            <TextButton
              testID="dur-save"
              label={t('pomodoro.aggiungi_durata')}
              onPress={addPreset}
            />
          </View>
        ) : null}
      </View>
    );
  };

  const projectLine = (id: string | null) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorOf(id) }} />
      <Text style={{ color: th.text2 }}>
        {nameOf(id) ?? t('pomodoro.nessun_progetto_collegato')}
      </Text>
    </View>
  );

  const glassView = pomodoroSettings.last_display_style === 'clessidra';
  const toggleView = () =>
    updatePomodoroSettings({ last_display_style: glassView ? 'cerchio' : 'clessidra' });

  const big = (
    text: string,
    pct: number,
    color: string,
    sub?: string,
    opts: {
      running?: boolean;
      flip?: boolean;
      rest?: boolean;
      chip?: string;
      onChip?: () => void;
      chipTestID?: string;
    } = {},
  ) => {
    const label = (
      <>
        <Text
          testID="pomodoro-clock"
          style={{
            color: th.text,
            fontSize: 64,
            lineHeight: 70,
            fontWeight: '800',
            letterSpacing: -2.5,
            fontVariant: ['tabular-nums'],
          }}
        >
          {text}
        </Text>
        {opts.chip ? (
          <Pressable
            testID={opts.chipTestID}
            accessibilityRole={opts.onChip ? 'button' : undefined}
            disabled={!opts.onChip}
            onPress={opts.onChip}
            style={{
              marginTop: 6,
              paddingHorizontal: 11,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: th.surface2,
              boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
            }}
          >
            <Text
              style={{
                color: th.text2,
                fontSize: 13,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {opts.chip}
            </Text>
          </Pressable>
        ) : null}
      </>
    );
    const kicker = sub ? (
      <Text
        style={{
          color: th.text2,
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 1.3,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        {sub}
      </Text>
    ) : null;
    if (glassView) {
      return (
        <View style={{ alignItems: 'center', marginVertical: 8, gap: 10 }}>
          {kicker}
          <Hourglass
            fraction={opts.rest ? 1 : pct}
            running={!!opts.running}
            flip={!!opts.flip}
            color={color}
            glass={th.text3}
          />
          <View style={{ alignItems: 'center' }}>{label}</View>
        </View>
      );
    }
    return (
      <View style={{ alignItems: 'center', marginVertical: 8, gap: 18 }}>
        {kicker}
        <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              width: 244,
              height: 244,
              borderRadius: 122,
              backgroundColor: th.surface,
              boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
            }}
          />
          <Ring size={280} stroke={10} pct={pct} color={color} track={th.hairline} />
          <View style={{ position: 'absolute', alignItems: 'center' }}>{label}</View>
        </View>
      </View>
    );
  };

  /* ---------------- le viste ---------------- */

  let body: React.ReactNode;

  if (active) {
    const s = active;
    const paused = s.status === 'pausa';
    const secs = elapsedSeconds(s, nowMs);
    const left = remainingSeconds(s, nowMs);
    const accent = nameOf(s.project_uuid) ? colorOf(s.project_uuid) : GREY;
    body = (
      <View style={{ gap: 14 }}>
        {big(
          left !== null ? clock(left) : clock(secs),
          left !== null && s.planned_duration_min
            ? 1 - Math.max(0, left) / (s.planned_duration_min * 60)
            : (secs % 3600) / 3600,
          accent,
          paused
            ? t('pomodoro.sessione_in_pausa')
            : s.mode === 1
              ? t('pomodoro.cronometro_in_corso')
              : t('pomodoro.concentrazione'),
          { running: !paused, flip: secs < 3 },
        )}
        <View style={{ alignItems: 'center' }}>{projectLine(s.project_uuid)}</View>
        {stopping ? (
          <Card style={{ padding: 16, gap: 10 }}>
            {short ? (
              <>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
                  {t('pomodoro.molto_breve')}
                </Text>
                <Text style={{ color: th.text2 }}>{t('pomodoro.molto_breve_testo')}</Text>
                <PrimaryButton
                  testID="short-save"
                  label={t('pomodoro.si_salva')}
                  onPress={() => stopNow(s, false, true)}
                />
                <TextButton
                  testID="short-discard"
                  danger
                  label={t('pomodoro.scarta')}
                  onPress={() => discard(s)}
                />
                <TextButton label={t('pomodoro.scelta_continua')} onPress={closeStop} />
              </>
            ) : discarding ? (
              <>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
                  {t('pomodoro.scarta_titolo')}
                </Text>
                <Text style={{ color: th.text2 }}>{t('pomodoro.scarta_testo')}</Text>
                <PrimaryButton
                  testID="discard-yes"
                  danger
                  label={t('pomodoro.scarta_si')}
                  onPress={() => discard(s)}
                />
                <TextButton label={t('pomodoro.scelta_continua')} onPress={closeStop} />
              </>
            ) : (
              <>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
                  {t('pomodoro.scelta_stop_titolo')}
                </Text>
                <Text style={{ color: th.text2 }}>{t('pomodoro.scelta_stop_testo')}</Text>
                <PrimaryButton
                  testID="stop-break"
                  label={`${t('pomodoro.scelta_pausa')} · ${breakMin} min`}
                  onPress={() => stopNow(s, true)}
                />
                <TextButton
                  testID="stop-end"
                  label={t('pomodoro.scelta_chiudi')}
                  onPress={() => stopNow(s, false)}
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
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22 }}>
            {paused ? (
              <RoundButton
                kind="play"
                testID="pomodoro-resume"
                label={t('pomodoro.riprendi')}
                onPress={() => resume(s)}
                large
              />
            ) : (
              <RoundButton
                kind="pause"
                testID="pomodoro-pause"
                label={t('pomodoro.pausa')}
                onPress={() => pause(s)}
                large
              />
            )}
            <RoundButton
              kind="stop"
              testID="pomodoro-stop"
              label={t('pomodoro.stop')}
              onPress={() => setStopping(true)}
              large
            />
          </View>
        )}
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            testID="change-project"
            onPress={() => setPicking(!picking)}
            style={[
              styles.pill,
              { backgroundColor: th.surface2, boxShadow: `inset 0 0 0 0.5px ${th.hairline}` },
            ]}
          >
            <Text style={{ color: th.brand, fontWeight: '700' }}>
              {t('pomodoro.collega_progetto')} ›
            </Text>
          </Pressable>
          {picking ? (
            <View style={{ alignSelf: 'stretch' }}>
              <ProjectPicker
                projects={data.projects}
                value={s.project_uuid}
                onPick={(id) => {
                  services.pomodoro.setProject(s.uuid, id);
                  setPicking(false);
                  changed();
                }}
              />
            </View>
          ) : null}
        </View>
      </View>
    );
  } else if (brk) {
    const total = brk.planned_duration_min * 60;
    const left = total - Math.floor((nowMs - stampMs(brk.start_time)) / 1000);
    const over = left <= 0;
    const tip = t(`pomodoro.pausa_consiglio_${breakTipIndex(brk.start_time)}`);
    body = (
      <View style={{ gap: 14 }}>
        <View style={{ alignItems: 'center' }}>
          <BreakScene color={th.text} accent={th.teal} />
        </View>
        {big(
          clock(Math.max(0, left)),
          over ? 1 : 1 - left / total,
          th.teal,
          over ? t('pomodoro.pausa_finita') : t('pomodoro.pausa_in_corso'),
          { running: !over },
        )}
        {!over ? (
          <Text testID="break-tip" style={{ color: th.text2, textAlign: 'center' }}>
            {tip}
          </Text>
        ) : null}
        {over ? (
          <Text style={{ color: th.text2, textAlign: 'center' }}>
            {t('pomodoro.torna_al_lavoro')}
          </Text>
        ) : null}
        <PrimaryButton
          testID="break-end"
          label={over ? t('pomodoro.pronto_altro') : t('pomodoro.interrompi')}
          onPress={endBreak}
        />
      </View>
    );
  } else if (done) {
    body = (
      <View style={{ gap: 14 }}>
        {big(
          clock(done.duration_seconds ?? 0),
          1,
          colorOf(done.project_uuid),
          t('pomodoro.concluso'),
          {
            rest: true,
            // il tempo in più, come sul sito: conta da quando il pomodoro è finito; toccarlo lo aggiunge alla sessione
            chip: `+ ${clock(done.end_time ? Math.max(0, (nowMs - stampMs(done.end_time)) / 1000) : 0)}`,
            chipTestID: 'done-overtime',
            onChip: () => {
              services.pomodoro.extend(done.uuid);
              changed();
            },
          },
        )}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ color: th.text, fontWeight: '700' }}>{t('pomodoro.ottimo_lavoro')}</Text>
          {nameOf(done.project_uuid) ? (
            <Text style={{ color: th.text2 }}>
              {t('pomodoro.hai_completato', { progetto: nameOf(done.project_uuid) })}
            </Text>
          ) : null}
        </View>
        <Card style={{ padding: 16, gap: 10 }}>
          <SectionLabel>{t('pomodoro.pausa')}</SectionLabel>
          {durations('pausa', data.breaks, breakMin, setBreakMin)}
          <PrimaryButton
            testID="done-break"
            label={`${t('pomodoro.scelta_pausa')} · ${breakMin} min`}
            onPress={() => {
              services.pomodoro.archive(done.uuid);
              changed();
              startBreak(breakMin);
            }}
          />
        </Card>
        <TextButton
          testID="done-extend"
          label={t('pomodoro.scelta_continua')}
          onPress={() => {
            services.pomodoro.extend(done.uuid);
            changed();
          }}
        />
        <TextButton
          testID="done-close"
          label={t('pomodoro.scelta_chiudi')}
          onPress={() => {
            services.pomodoro.archive(done.uuid);
            changed();
          }}
        />
      </View>
    );
  } else {
    body = (
      <View style={{ gap: 14 }}>
        <View
          style={{
            flexDirection: 'row',
            alignSelf: 'center',
            gap: 4,
            padding: 3,
            borderRadius: 14,
            backgroundColor: th.surface2,
            boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
          }}
        >
          {([0, 1] as const).map((m) => (
            <Pressable
              key={m}
              testID={`mode-${m}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === m }}
              onPress={() => setMode(m)}
              style={{
                minWidth: 112,
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 11,
                backgroundColor: mode === m ? th.surface : 'transparent',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.18)' : undefined,
              }}
            >
              <Text
                style={{ color: mode === m ? th.text : th.text2, fontWeight: '700', fontSize: 15 }}
              >
                {m === 0 ? t('pomodoro.timer') : t('pomodoro.cronometro')}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            testID="pick-project"
            onPress={() => setPicking(!picking)}
            style={[
              styles.pill,
              { backgroundColor: th.surface2, boxShadow: `inset 0 0 0 0.5px ${th.hairline}` },
            ]}
          >
            {projectLine(project)}
          </Pressable>
          {picking ? (
            <View style={{ alignSelf: 'stretch' }}>
              <ProjectPicker
                projects={data.projects}
                value={project}
                onPick={(id) => {
                  setProject(id);
                  setPicking(false);
                }}
              />
            </View>
          ) : null}
        </View>
        {big(mode === 0 ? clock(minutes * 60) : '00:00', 0, th.brand, t('pomodoro.pronto'), {
          rest: true,
          chip: mode === 0 ? t('pomodoro.pausa_di', { minuti: breakMin }) : undefined,
        })}
        {mode === 0 ? (
          <View style={{ gap: 8, alignItems: 'center' }}>
            {durations('pomodoro', data.pomos, minutes, setMinutes)}
            <Pressable
              testID="dur-manage"
              accessibilityRole="button"
              onPress={() => setManaging(!managing)}
              hitSlop={8}
            >
              <Text style={{ color: th.brand, fontWeight: '600', fontSize: 13.5 }}>
                {t('pomodoro.gestisci')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <RoundButton
            kind="play"
            testID="pomodoro-start"
            label={t('pomodoro.start')}
            onPress={start}
            large
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      {autoParam === '1' && fromPlan && !active && !brk ? (
        <AutoStart go={() => void start()} />
      ) : null}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: th.hairline,
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
        <Text
          accessibilityRole="header"
          style={{ flex: 1, color: th.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.7 }}
        >
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
      <Pressable
        testID="pomodoro-view"
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('pomodoro.cambia_vista')}
        accessibilityState={{ selected: glassView }}
        onPress={toggleView}
        style={{
          position: 'absolute',
          left: 16,
          top: insets.top + 62,
          zIndex: 5,
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
            stroke={glassView ? th.brand : th.text2}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {notice && !active ? (
          <Pressable
            testID="pomodoro-notice"
            accessibilityRole="button"
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
        {body}
        {services.tasks ? (
          <TasksNote
            repo={services.tasks}
            project={active ? active.project_uuid : done ? done.project_uuid : project}
            created={noteTasks}
            onCreated={(uuid) => setNoteTasks((cur) => [...cur, uuid])}
            onReset={() => setNoteTasks([])}
            version={version}
            changed={changed}
            finished={!active && done ? done.uuid : null}
          />
        ) : null}
      </ScrollView>
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
