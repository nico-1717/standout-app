import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import type { Project } from '@/features/projects/logic';
import { Card, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

import { AutoplanSheet } from './AutoplanSheet';
import { DailySheet } from './DailySheet';
import { GoalEditor, type EditorMode } from './GoalEditor';
import { dayLabel, hours } from './format';
import type { AutoplanSummary, PlanRepo } from './repo';
import { TemplatesSheet } from './TemplatesSheet';
import { TimeSheet } from './TimeSheet';

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

  const parts: string[] = [];
  if (goal?.active && goal.minutes > 0) {
    parts.push(hours(goal.minutes));
    parts.push(t(`piano.tipo_${goal.kind}`));
    parts.push(t(`piano.prio_${goal.priority}`));
    if (goal.deadline)
      parts.push(
        dayLabel(goal.deadline, p.lang, { day: 'numeric', month: 'short', year: 'numeric' }),
      );
  }

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <SectionLabel>{t('progetti.piano_titolo')}</SectionLabel>
      {isDaily ? (
        <Text testID="plan-card-daily" style={{ color: th.text, fontWeight: '700' }}>
          {t('progetti.daily_titolo', { m: goal.minutes })}
        </Text>
      ) : parts.length ? (
        <>
          <Text testID="plan-card-summary" style={{ color: th.text, fontWeight: '700' }}>
            {parts.join(' · ')}
          </Text>
          <Text style={{ color: th.text2 }}>
            {t('piano.fatto_di', { a: hours(done), b: hours(goal?.minutes ?? 0) })}
          </Text>
        </>
      ) : (
        <Text testID="plan-card-empty" style={{ color: th.text2 }}>
          {t('piano.senza_ore')}
        </Text>
      )}

      {isDaily ? (
        <PrimaryButton
          testID="plan-card-focus"
          label={t('progetti.daily_avvia', { m: goal.minutes })}
          onPress={() => setDaily(true)}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            testID="plan-card-edit"
            label={t('piano.modifica_ore')}
            onPress={() => setEditor({ mode: 'goal', project })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextButton
            testID="plan-card-calendar"
            label={`${t('piano.v_calendario')} ›`}
            onPress={p.onCalendar}
          />
        </View>
      </View>
      {hasKids && goal?.active && goal.minutes > 0 && !isDaily ? (
        <TextButton
          testID="plan-card-split"
          label={t('piano.dividi_titolo')}
          onPress={() => setEditor({ mode: 'split', project })}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        <TextButton
          testID="plan-card-time"
          label={t('piano.il_tuo_tempo')}
          onPress={() => setShowTime(true)}
        />
        <TextButton
          testID="plan-card-templates"
          label={t('piano.modelli')}
          onPress={() => {
            setNotice(null);
            setShowTpl(true);
          }}
        />
        <TextButton
          testID="plan-card-auto"
          label={t('piano.pianifica_per_me')}
          onPress={() => setAuto({ summary: repo.autoplan(project, false), done: false })}
        />
      </View>

      {old > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: th.text2, fontSize: 13 }}>
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
    </Card>
  );
}
