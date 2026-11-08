import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { Rise } from '@/ui/motion';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DEFAULT_HOME_LAYOUT, type HomeWidget } from '@/features/home/layout';
import { buildToday } from '@/features/home/today';
import { pickTrivia } from '@/features/home/trivia';
import {
  CardsTracks,
  GradesWidget,
  NumbersWidget,
  ProjectsWidget,
  Shortcuts,
  TodayWidget,
  TriviaWidget,
  WidgetBox,
  type Shortcut,
} from '@/features/home/widgets';
import { base110, cfuStats, weighted } from '@/features/grades/logic';
import { localToday } from '@/features/tasks/groups';
import { homeCards } from '@/features/flashcards/homeCards';
import { homeNumbers } from '@/features/flashcards/numbers';
import { InsertSheet } from '@/features/flashcards/InsertSheet';
import { DraftsPanel } from '@/features/flashcards/DraftsPanel';
import { QuickNoteCard } from '@/features/notes/QuickNoteCard';
import { todoTheme } from '@/features/tasks/todoTheme';

/** I tasti rapidi che esistono già nell'app: href del sito → schermata e nome. Gli altri (carte, voti) arrivano con le loro pagine. */
const SHORTCUTS: { href: string; route: string; key: string }[] = [
  { href: 'planner/planner.php', route: '/(tabs)/planner', key: 'sidebar.planner' },
  { href: 'planner/todo.php', route: '/(tabs)', key: 'sidebar.todo' },
  { href: 'projects/progetti.php', route: '/projects', key: 'sidebar.progetti' },
  { href: 'projects/pomodoro.php', route: '/pomodoro', key: 'sidebar.pomodoro' },
  { href: 'planner/habits.php', route: '/(tabs)/habits', key: 'sidebar.abitudini' },
  { href: 'planner/diario.php', route: '/diary', key: 'sidebar.diario' },
  { href: 'exams/voti.php', route: '/grades', key: 'sidebar.voti' },
];

const WIDGET_TITLE: Record<HomeWidget['id'], string> = {
  shortcuts: 'home.w_accesso',
  agenda: 'home.w_oggi',
  note: 'home.w_nota',
  cards: 'home.w_flashcard',
  projects: 'home.w_progetti',
  grades: 'home.w_voti',
  trivia: 'home.w_curiosita',
  stats: 'home.w_numeri',
};

export function greetingKey(hour: number): string {
  return hour < 5
    ? 'home.saluto_notte'
    : hour < 12
      ? 'home.saluto_mattina'
      : hour < 18
        ? 'home.saluto_pomeriggio'
        : 'home.saluto_sera';
}

export default function HomeScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [inserting, setInserting] = useState(false);
  const insets = useSafeAreaInsets();
  const {
    services,
    version,
    changed,
    uiStyle,
    authState,
    homeLayout,
    updateHomeLayout,
    gradeSettings,
  } = useApp();
  const td = todoTheme(uiStyle, th);
  const [editing, setEditing] = useState(false);
  const [trivia] = useState(() => pickTrivia(i18n.language));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const name = authState.status === 'signedIn' ? authState.user.username : '';

  const today = useMemo(
    () => (services ? buildToday(services, new Date()) : null),
    // `version` cambia a ogni modifica, locale o dal server
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const projectRows = useMemo(() => {
    if (!services) return [];
    const all = services.projects.all().filter((p) => p.status !== 'completed');
    const totals = services.projects.totals();
    const fav = all.filter((p) => p.is_favorite);
    const pick = (fav.length ? fav : all.filter((p) => p.status === 'in_progress')).slice(0, 6);
    return pick.map((p) => ({ project: p, seconds: totals.get(p.uuid) ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, version]);

  const go = (route: string) => router.push(route as never);

  function shortcutList(w: HomeWidget): Shortcut[] {
    const known = new Map(SHORTCUTS.map((s) => [s.href, s]));
    const order = [...(w.order ?? []), ...SHORTCUTS.map((s) => s.href)];
    const seen = new Set<string>();
    const out: Shortcut[] = [];
    for (const h of order) {
      const s = known.get(h);
      if (!s || seen.has(h)) continue;
      seen.add(h);
      out.push({ href: h, route: s.route, label: t(s.key) });
    }
    return out;
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= homeLayout.length) return;
    const next = [...homeLayout];
    [next[i], next[j]] = [next[j]!, next[i]!];
    updateHomeLayout(next);
  }
  function toggle(i: number) {
    updateHomeLayout(homeLayout.map((w, k) => (k === i ? { ...w, on: !w.on } : w)));
  }
  function moveShortcut(href: string, d: -1 | 1) {
    updateHomeLayout(
      homeLayout.map((w) => {
        if (w.id !== 'shortcuts') return w;
        const hrefs = shortcutList(w).map((s) => s.href);
        const i = hrefs.indexOf(href);
        const j = i + d;
        if (i < 0 || j < 0 || j >= hrefs.length) return w;
        [hrefs[i], hrefs[j]] = [hrefs[j]!, hrefs[i]!];
        return { ...w, order: hrefs };
      }),
    );
  }

  const dateText = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  function body(w: HomeWidget) {
    if (w.id === 'shortcuts')
      return (
        <WidgetBox td={td} id="shortcuts" title={t(WIDGET_TITLE.shortcuts)}>
          <Shortcuts td={td} items={shortcutList(w)} onGo={(s) => go(s.route)} />
        </WidgetBox>
      );
    if (w.id === 'agenda')
      return (
        <WidgetBox
          td={td}
          id="agenda"
          title={t(WIDGET_TITLE.agenda)}
          action={t('home.apri')}
          onAction={() => go('/(tabs)/planner')}
        >
          {today ? (
            <TodayWidget
              td={td}
              data={today}
              nowMin={nowMin}
              onToggleTodo={(x) => {
                services?.tasks.update(x.uuid, { is_done: true });
                changed();
              }}
              onPill={(d, how) => {
                services?.pills.setStatus(d.uuid, how);
                changed();
              }}
              onOpenEvent={() => go('/(tabs)/planner')}
            />
          ) : null}
        </WidgetBox>
      );
    if (w.id === 'note')
      return (
        <View testID="home-w-note">
          <QuickNoteCard td={td} paper={td.style === 'paper'} />
        </View>
      );
    if (w.id === 'projects')
      return (
        <WidgetBox
          td={td}
          id="projects"
          title={t(WIDGET_TITLE.projects)}
          action={t('home.apri')}
          onAction={() => go('/projects')}
        >
          <ProjectsWidget
            td={td}
            rows={projectRows}
            onOpen={(uuid) => router.push({ pathname: '/project', params: { id: uuid } })}
          />
        </WidgetBox>
      );
    if (w.id === 'cards' && services)
      return (
        <WidgetBox
          td={td}
          id="cards"
          title={t(WIDGET_TITLE.cards)}
          action={t('home.apri')}
          onAction={() => go('/flashcards')}
        >
          <CardsTracks
            td={td}
            data={homeCards(services, localToday(), i18n.language === 'en' ? 'en' : 'it')}
            onInsert={() => setInserting(true)}
            go={(route, params) =>
              router.push(params ? { pathname: route, params } : route) as never
            }
          />
          {inserting && services ? (
            <InsertSheet
              decks={services.flashcards.decks().filter((d) => !d.archived)}
              courses={services.languages.courses()}
              onClose={() => setInserting(false)}
              go={(route, params) =>
                router.push(params ? { pathname: route, params } : route) as never
              }
            />
          ) : null}
          <DraftsPanel repo={services.flashcards} version={version} changed={changed} />
        </WidgetBox>
      );
    if (w.id === 'grades' && services) {
      const gd = services.grades.data(gradeSettings);
      const gw = weighted(gd);
      const gc = cfuStats(gd);
      return (
        <WidgetBox
          td={td}
          id="grades"
          title={t(WIDGET_TITLE.grades)}
          action={t('home.apri')}
          onAction={() => go('/grades')}
        >
          <GradesWidget
            td={td}
            empty={gd.exams.length === 0}
            avg={gw.n ? (Math.round(gw.avg * 100) / 100).toFixed(2) : '–'}
            base={String(gd.settings.grade_base)}
            baseValue={gw.n ? String(base110(gd, gw.avg)) : '–'}
            cfuDone={String(Math.round(gc.done * 10) / 10)}
            cfuTotal={String(Math.round(gc.total * 10) / 10)}
            onOpen={() => go('/grades')}
          />
        </WidgetBox>
      );
    }
    if (w.id === 'stats' && services)
      return (
        <WidgetBox
          td={td}
          id="stats"
          title={t(WIDGET_TITLE.stats)}
          action={t('home.apri')}
          onAction={() => go('/fc-stats')}
        >
          <NumbersWidget
            td={td}
            n={homeNumbers(services, localToday())}
            today={localToday()}
            onOpen={() => go('/fc-stats')}
          />
        </WidgetBox>
      );
    if (w.id === 'trivia')
      return (
        <WidgetBox td={td} id="trivia" title={t(WIDGET_TITLE.trivia)}>
          <TriviaWidget td={td} item={trivia} />
        </WidgetBox>
      );
    return null;
  }

  return (
    <ScrollView
      testID="home-screen"
      style={{ flex: 1, backgroundColor: td.page }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 32,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: th.text2,
              fontSize: 13,
              fontWeight: '600',
              letterSpacing: th.display ? 1.2 : 0.2,
              textTransform: th.display ? 'uppercase' : 'capitalize',
            }}
          >
            {dateText}
          </Text>
          <Text
            testID="home-greeting"
            accessibilityRole="header"
            style={[
              styles.hello,
              { color: td.ink },
              th.display
                ? { fontFamily: th.display, fontWeight: undefined, fontSize: 36, lineHeight: 40 }
                : null,
            ]}
          >
            {t(greetingKey(now.getHours()), { nome: name })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          testID={editing ? 'home-done' : 'home-customise'}
          onPress={() => setEditing((v) => !v)}
          hitSlop={8}
        >
          <Text style={{ color: td.accent, fontWeight: '600' }}>
            {editing ? t('home.fine') : t('home.personalizza')}
          </Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: td.ink2 }}>{t('home.personalizza_aiuto')}</Text>
          {homeLayout.map((w, i) => (
            <View
              key={w.id}
              testID={`home-edit-${w.id}`}
              style={[styles.edit, { backgroundColor: td.panel, borderColor: td.hair }]}
            >
              <View style={styles.editRow}>
                <Text
                  style={{
                    color: w.on ? td.ink : td.ink3,
                    flex: 1,
                    fontWeight: '600',
                  }}
                >
                  {t(WIDGET_TITLE[w.id])}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  testID={`home-up-${w.id}`}
                  onPress={() => move(i, -1)}
                  hitSlop={8}
                >
                  <Text style={{ color: td.accent, fontSize: 18 }}>↑</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID={`home-down-${w.id}`}
                  onPress={() => move(i, 1)}
                  hitSlop={8}
                >
                  <Text style={{ color: td.accent, fontSize: 18 }}>↓</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID={`home-toggle-${w.id}`}
                  onPress={() => toggle(i)}
                  hitSlop={8}
                >
                  <Text style={{ color: td.accent, fontWeight: '600' }}>
                    {w.on ? t('home.nascondi') : t('home.mostra')}
                  </Text>
                </Pressable>
              </View>
              {w.id === 'shortcuts' && w.on ? (
                <View style={styles.editShort}>
                  {shortcutList(w).map((s) => (
                    <View key={s.href} style={styles.editRow}>
                      <Pressable
                        accessibilityRole="button"
                        testID={`home-sc-left-${s.route.replace(/[^a-z]/gi, '')}`}
                        onPress={() => moveShortcut(s.href, -1)}
                        accessibilityLabel={t('home.sposta_sinistra')}
                        hitSlop={8}
                      >
                        <Text style={{ color: td.accent }}>◀</Text>
                      </Pressable>
                      <Text style={{ color: td.ink2 }}>{s.label}</Text>
                      <Pressable
                        accessibilityRole="button"
                        testID={`home-sc-right-${s.route.replace(/[^a-z]/gi, '')}`}
                        onPress={() => moveShortcut(s.href, 1)}
                        accessibilityLabel={t('home.sposta_destra')}
                        hitSlop={8}
                      >
                        <Text style={{ color: td.accent }}>▶</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            testID="home-reset"
            onPress={() => updateHomeLayout(DEFAULT_HOME_LAYOUT)}
            style={{ alignSelf: 'flex-start' }}
          >
            <Text style={{ color: td.accent, fontWeight: '600' }}>{t('home.ripristina')}</Text>
          </Pressable>
        </View>
      ) : (
        homeLayout
          .filter((w) => w.on)
          .map((w, i) => (
            <Rise key={w.id} index={i + 1}>
              {body(w)}
            </Rise>
          ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hello: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  edit: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  editShort: { gap: 6, paddingLeft: 8 },
});
