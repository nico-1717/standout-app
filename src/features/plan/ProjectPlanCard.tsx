import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import type { Project } from '@/features/projects/logic';
import { Card, PrimaryButton, TextButton } from '@/ui/kit';

import { AutoplanSheet } from './AutoplanSheet';
import { inherit } from './engine';
import { PlanGoalCard } from './PlanGoalCard';
import { DailySheet } from './DailySheet';
import { GoalEditor, type EditorMode } from './GoalEditor';
import { hours } from './format';
import type { AutoplanSummary, GoalInput, PlanRepo } from './repo';
import { TemplatesSheet } from './TemplatesSheet';
import { TimeSheet } from './TimeSheet';

const GEAR =
  'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM19.4 13a7.5 7.5 0 000-2l2-1.5-2-3.5-2.3.9a7.4 7.4 0 00-1.7-1L15 3.5h-4l-.4 2.4a7.4 7.4 0 00-1.7 1l-2.3-.9-2 3.5 2 1.5a7.5 7.5 0 000 2l-2 1.5 2 3.5 2.3-.9c.5.4 1.1.7 1.7 1l.4 2.4h4l.4-2.4c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.5z';
const SPARK =
  'M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z';

/**
 * La scheda «Piano» dentro un progetto: quanto tempo ha, di che tipo, per quando, a che punto è; e i tasti per cambiarlo,
 * dividerlo fra i sotto-progetti, aprire il calendario, usare i modelli e chiedere «Pianifica per me».
 */
export function ProjectPlanCard(p: {
  repo: PlanRepo;
  projects: Project[];
  project: string;
  lang: string;
  /** durata del pomodoro di solito: serve a trasformare le vecchie stime in minuti */
  pomodoroMinutes: number;
  changed: () => void;
  onCalendar: () => void;
  onPomodoro: (minutes: number, auto: boolean) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const { repo, project } = p;
  const [editor, setEditor] = useState<{ mode: EditorMode | null; project: string | null }>({
    mode: null,
    project: null,
  });
  const [showTime, setShowTime] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [auto, setAuto] = useState<{ summary: AutoplanSummary; done: boolean } | null>(null);
  const [daily, setDaily] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const node = repo.nodes().find((n) => n.id === project);
  const goal = repo.goals().get(project) ?? null;
  const proj = p.projects.find((x) => x.uuid === project);
  if (!proj) return null;
  const hasKids = (node?.kids.length ?? 0) > 0;
  const isDaily = goal?.active && goal.kind === 'daily';
  const done = repo.doneInBranch(project, goal?.since ?? null);
  const old = repo.oldEstimateCount();

  const nodes = new Map(repo.nodes().map((n) => [n.id, n]));
  const goals = repo.goals();
  const kids = (node?.kids ?? [])
    .map((id) => ({ id, p: p.projects.find((x) => x.uuid === id) }))
    .filter((k) => k.p && k.p.status !== 'completed');
  const total = goal?.minutes ?? 0;

  const saveGoal = (input: GoalInput) => {
    const before = goal?.minutes ?? 0;
    const minutes = repo.saveGoal(project, input);
    const kind = input.kind ?? goal?.kind ?? 'plain';
    if (hasKids && kind !== 'daily' && minutes > 0 && minutes !== before)
      repo.resplit(project, minutes);
    p.changed();
  };

  const icon = (d: string, color: string, size = 16) => (
    <SvgXml
      xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`}
      width={size}
      height={size}
    />
  );
  const act = (
    label: string,
    onPress: () => void,
    testID: string,
    opts: { quiet?: boolean; icon?: string } = {},
  ) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: opts.quiet ? undefined : 1,
        minWidth: 0,
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: opts.quiet ? th.surface2 : th.brand,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {opts.icon ? icon(opts.icon, opts.quiet ? th.text : '#FFFFFF') : null}
      <Text
        numberOfLines={1}
        style={{ color: opts.quiet ? th.text : '#FFFFFF', fontSize: 13.5, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        testID="plan-card-calendar"
        accessibilityRole="button"
        onPress={p.onCalendar}
        style={{
          alignSelf: 'flex-start',
          minHeight: 36,
          paddingLeft: 6,
          paddingRight: 10,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          backgroundColor: th.surface2,
        }}
      >
        {icon('M14.5 5L8 12l6.5 7', th.text2, 14)}
        <Text style={{ color: th.text2, fontSize: 13.5, fontWeight: '600' }}>
          {t('piano.v_calendario')}
        </Text>
      </Pressable>

      {isDaily ? (
        <Card style={{ padding: 14, gap: 10 }}>
          <Text testID="plan-card-daily" style={{ color: th.text, fontWeight: '700' }}>
            {t('progetti.daily_titolo', { m: goal.minutes })}
          </Text>
          <PrimaryButton
            testID="plan-card-focus"
            label={t('progetti.daily_avvia', { m: goal.minutes })}
            onPress={() => setDaily(true)}
          />
        </Card>
      ) : null}

      <PlanGoalCard
        key={project}
        goal={goal}
        hasKids={hasKids}
        inheritedDeadline={node?.parent ? inherit(nodes, goals, node.parent, 'deadline') : null}
        today={repo.today()}
        dayLen={repo.settings().weekdayEff}
        doneMin={done}
        color={proj.color}
        onSave={saveGoal}
      />

      {kids.length ? (
        <Pressable
          testID="plan-card-split"
          accessibilityRole="button"
          onPress={() => setEditor({ mode: 'split', project })}
        >
          <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text
              style={{
                color: th.text2,
                fontSize: 12.5,
                fontWeight: '600',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {t('piano.dividi_titolo')}
            </Text>
            {total <= 0 ? (
              <Text style={{ color: th.text2, fontSize: 12.5 }}>{t('piano.dividi_senza_ore')}</Text>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 2,
                    height: 10,
                    borderRadius: 999,
                    overflow: 'hidden',
                    marginBottom: 6,
                  }}
                >
                  {kids.map((k) => (
                    <View
                      key={k.id}
                      style={{
                        flexGrow: Math.max(0.0001, goals.get(k.id)?.minutes ?? 0),
                        flexBasis: 0,
                        minWidth: 3,
                        backgroundColor: k.p!.color,
                      }}
                    />
                  ))}
                </View>
                {kids.map((k, i) => (
                  <View
                    key={k.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      minHeight: 32,
                      borderTopWidth: i ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: th.hairline,
                    }}
                  >
                    <View
                      style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: k.p!.color }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, color: th.text, fontSize: 14.5, fontWeight: '500' }}
                    >
                      {k.p!.name}
                    </Text>
                    <Text
                      style={{
                        color: th.text,
                        fontSize: 14.5,
                        fontWeight: '600',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {hours(goals.get(k.id)?.minutes ?? 0)}
                    </Text>
                  </View>
                ))}
                <Text style={{ color: th.text2, fontSize: 12.5, lineHeight: 17, marginTop: 6 }}>
                  {t('piano.dividi_aiuto', { t: hours(total) })}
                </Text>
              </>
            )}
          </Card>
        </Pressable>
      ) : null}

      {old > 0 ? (
        <View style={{ backgroundColor: th.surface2, borderRadius: 14, padding: 12, gap: 6 }}>
          <Text style={{ color: th.text, fontSize: 15, fontWeight: '600' }}>
            {t('piano.vecchio_titolo')}
          </Text>
          <Text style={{ color: th.text2, fontSize: 12.5, lineHeight: 17 }}>
            {t('piano.vecchio_testo', { n: old })}
          </Text>
          {imported !== null ? (
            <Text testID="plan-card-imported" style={{ color: th.green }}>
              {t('piano.vecchio_fatto', { n: imported })}
            </Text>
          ) : (
            <TextButton
              testID="plan-card-import"
              label={t('piano.vecchio_importa')}
              onPress={() => {
                const n = repo.importOld(p.pomodoroMinutes);
                setImported(n);
                p.changed();
              }}
            />
          )}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {act(t('piano.il_tuo_tempo'), () => setShowTime(true), 'plan-card-time', {
          quiet: true,
          icon: GEAR,
        })}
        {act(
          t('piano.modelli'),
          () => {
            setNotice(null);
            setShowTpl(true);
          },
          'plan-card-templates',
          { quiet: true },
        )}
        {act(
          t('piano.pianifica_per_me'),
          () => setAuto({ summary: repo.autoplan(project, false), done: false }),
          'plan-card-auto',
          { icon: SPARK },
        )}
      </View>

      <GoalEditor
        repo={repo}
        projects={p.projects}
        project={editor.project}
        mode={editor.mode}
        changed={p.changed}
        onMode={(mode, id) => setEditor({ mode, project: id })}
      />
      <TimeSheet
        visible={showTime}
        settings={repo.settings()}
        lang={p.lang}
        onSave={(s) => {
          repo.saveSettings(s);
          p.changed();
          setShowTime(false);
        }}
        onClose={() => setShowTime(false)}
      />
      <TemplatesSheet
        visible={showTpl}
        templates={repo.templates()}
        notice={notice}
        onSave={(name) => {
          const n = repo.saveTemplate(project, name);
          setNotice(n >= 0 ? t('piano.modello_salvato', { n }) : t('piano.errore'));
          p.changed();
        }}
        onApply={(uuid) => {
          const n = repo.applyTemplate(uuid, project);
          setNotice(n >= 0 ? t('piano.modello_applicato', { n }) : t('piano.errore'));
          p.changed();
        }}
        onRemove={(uuid) => {
          repo.removeTemplate(uuid);
          p.changed();
        }}
        onClose={() => setShowTpl(false)}
      />
      <AutoplanSheet
        visible={auto !== null}
        summary={auto?.summary ?? null}
        names={new Map(p.projects.map((x) => [x.uuid, x.name]))}
        lang={p.lang}
        done={auto?.done ?? false}
        onApply={() => {
          const summary = repo.autoplan(project, true);
          p.changed();
          setAuto({ summary, done: true });
        }}
        onClose={() => setAuto(null)}
      />
      {daily && isDaily ? (
        <DailySheet
          visible
          name={proj.name}
          minutes={goal.minutes}
          now={new Date()}
          onStart={() => {
            setDaily(false);
            p.onPomodoro(goal.minutes, true);
          }}
          onLog={(start) => {
            repo.dailyLog(project, start);
            p.changed();
            setDaily(false);
          }}
          onClose={() => setDaily(false)}
        />
      ) : null}
    </View>
  );
}
