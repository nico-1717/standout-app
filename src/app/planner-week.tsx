import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { addDaysIso, mondayOf, weekdayOf, dayOfMonth, monthOf } from '@/features/planner/dates';
import { CheckBox } from '@/features/planner/PlannerParts';
import { plannerTheme, type PlannerTheme } from '@/features/planner/plannerTheme';
import type { DoseView } from '@/features/pills/repo';
import { localToday } from '@/features/tasks/groups';
import type { Task } from '@/features/tasks/repo';
import { diaryFakeText } from '@/features/planner/weekPanel';
import { studyToday, type StudyBlock } from '@/features/plan/studyToday';
import { Text } from '@/ui/CappedText';

type Tab = 'todo' | 'buy' | 'study' | 'pills';
const TABS: Tab[] = ['todo', 'buy', 'study', 'pills'];

/** La settimana: il numero, gli elenchi di questa settimana (to do, to buy, pastiglie) e il diario del giorno, coperto. */
export default function PlannerWeek() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const focus =
    typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : localToday();
  const today = localToday();
  const { services, version, changed, uiStyle, plannerSettings } = useApp();
  const pt = plannerTheme(uiStyle, th, plannerSettings.palette, plannerSettings.contrast_level);
  const [tab, setTab] = useState<Tab>('todo');
  const [others, setOthers] = useState(false);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const monday = mondayOf(focus);
  const sunday = addDaysIso(monday, 6);
  const [numberText, setNumberText] = useState<string | null>(null);

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    return {
      number: services.planner.weekNumber(monday, plannerSettings),
      todo: services.tasks.list('todo'),
      buy: services.tasks.list('buy'),
      pills: services.pills.day(focus),
      study: studyToday(services.db, focus),
      diary: services.diary.day(focus),
    };
  }, [services, version, monday, focus, plannerSettings]);
  if (!services || !data) return null;

  const gg = (d: string) => t(`planner.gg_${weekdayOf(d)}`);
  const longDay = (d: string) => `${gg(d)} ${dayOfMonth(d)} ${t(`planner.mese_${monthOf(d)}`)}`;
  const rangeText = `${dayOfMonth(monday)} ${t(`planner.mese_${monthOf(monday)}`).toLowerCase()} – ${dayOfMonth(sunday)} ${t(`planner.mese_${monthOf(sunday)}`).toLowerCase()}`;

  const saveNumber = () => {
    if (numberText === null) return;
    const n = parseInt(numberText, 10);
    services.planner.setWeekNumber(monday, Number.isFinite(n) ? n : 1);
    setNumberText(null);
    changed();
  };

  const list = tab === 'pills' || tab === 'study' ? [] : data[tab];
  const roots = list as Task[];
  const inside = roots
    .filter((x) => x.due_date && x.due_date >= monday && x.due_date <= sunday)
    .sort((a, b) => {
      // nel «to buy» comanda la priorità; negli altri la data è una scadenza
      if (tab === 'buy' && a.buy_priority !== b.buy_priority)
        return a.buy_priority - b.buy_priority;
      if (a.due_date !== b.due_date) return a.due_date! < b.due_date! ? -1 : 1;
      return (a.due_time ?? '99:99') < (b.due_time ?? '99:99') ? -1 : 1;
    });
  const before = roots
    .filter((x) => x.due_date && x.due_date < monday && !x.is_done)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const noDate = roots.filter((x) => !x.due_date);
  const after = roots
    .filter((x) => x.due_date && x.due_date > sunday)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const taskRow = (x: Task) => (
    <View
      key={x.uuid}
      testID={`wk-task-${x.uuid}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 }}
    >
      <CheckBox
        color={pt.accent}
        done={!!x.is_done}
        pt={pt}
        testID={`wk-task-check-${x.uuid}`}
        onPress={() => {
          services.tasks.update(x.uuid, { is_done: !x.is_done });
          changed();
        }}
      />
      <Text
        style={{
          flex: 1,
          color: x.is_done ? pt.ink3 : pt.ink,
          fontSize: 14,
          fontFamily: pt.sans,
          textDecorationLine: x.is_done ? 'line-through' : 'none',
        }}
      >
        {x.title || t('planner.senza_titolo_l')}
      </Text>
      {x.due_date ? (
        <Text style={{ color: pt.ink3, fontSize: 11, fontFamily: pt.sans }}>
          {`${gg(x.due_date).slice(0, 3)} ${dayOfMonth(x.due_date)}`}
          {x.due_time ? ` · ${x.due_time}` : ''}
        </Text>
      ) : null}
    </View>
  );

  const label = (text: string) => (
    <Text
      style={{
        color: pt.ink3,
        fontSize: 11,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginTop: 10,
        fontFamily: pt.sans,
      }}
    >
      {text}
    </Text>
  );

  const addTask = () => {
    const title = draft.trim();
    if (!title || tab === 'pills' || tab === 'study') return;
    services.tasks.create({ title, due_date: focus }, { listType: tab });
    setDraft('');
    changed();
  };

  const doseRow = (d: DoseView, late: boolean) => {
    const future = !late && focus > today;
    return (
      <View
        key={d.uuid}
        testID={`wk-dose-${d.uuid}`}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 }}
      >
        <CheckBox
          color={d.color}
          done={d.status === 'taken'}
          pt={pt}
          testID={`wk-dose-check-${d.uuid}`}
          onPress={() => {
            if (future) return;
            services.pills.setStatus(d.uuid, d.status === 'taken' ? 'pending' : 'taken');
            changed();
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans }}>
            {d.plan_dose ? `${d.name}  ·  ${d.plan_dose}` : d.name}
          </Text>
          {late ? (
            <Text style={{ color: pt.ink3, fontSize: 11, fontFamily: pt.sans }}>
              {t('planner.arretrata')} · {longDay(d.due_date)}
            </Text>
          ) : future ? (
            <Text style={{ color: pt.ink3, fontSize: 11, fontFamily: pt.sans }}>
              {t('planner.futura')}
            </Text>
          ) : null}
        </View>
        {d.due_time ? (
          <Text style={{ color: pt.ink3, fontSize: 11, fontFamily: pt.sans }}>{d.due_time}</Text>
        ) : null}
      </View>
    );
  };

  const dayWord = focus === today ? t('comune.oggi').toLowerCase() : gg(focus).toLowerCase();
  const diary = data.diary;
  const hasDiary = !!diary.note.trim() || diary.good.length > 0 || diary.learned.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: pt.page }}>
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 18,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 0.5,
          borderBottomColor: pt.hair,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: pt.ink,
            fontSize: 24,
            fontFamily: pt.serif,
            fontWeight: pt.style === 'standard' ? '700' : '400',
          }}
        >
          {t('planner.la_settimana')}
        </Text>
        <Pressable
          testID="wk-close"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ padding: 8 }}
        >
          <Text style={{ color: pt.accentInk, fontSize: 15, fontFamily: pt.sans }}>
            {t('comune.chiudi')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: pt.card,
            borderRadius: 18,
            borderWidth: 0.5,
            borderColor: pt.hair,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans }}>
              {t('planner.settimana_numero')}
            </Text>
            <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>
              {t('planner.cambiandolo_le_successive_si_rinumerano')}
            </Text>
          </View>
          <TextInput
            testID="wk-number"
            keyboardType="number-pad"
            value={numberText ?? String(data.number)}
            onChangeText={setNumberText}
            onEndEditing={saveNumber}
            onSubmitEditing={saveNumber}
            maxLength={4}
            style={{
              width: 76,
              textAlign: 'center',
              color: pt.ink,
              fontSize: 18,
              fontFamily: pt.sans,
              borderWidth: 0.5,
              borderColor: pt.hair2,
              borderRadius: 12,
              paddingVertical: 8,
              backgroundColor: pt.page,
            }}
          />
        </View>

        <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>{rangeText}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {TABS.map((k) => (
            <Pressable
              key={k}
              testID={`wk-tab-${k}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
              onPress={() => {
                setTab(k);
                setOthers(false);
                setDraft('');
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: tab === k ? pt.accent : pt.accentSoft,
              }}
            >
              <Text
                style={{
                  color: tab === k ? pt.onAccent : pt.accentInk,
                  fontSize: 13,
                  fontFamily: pt.sans,
                }}
              >
                {t(
                  k === 'todo'
                    ? 'planner.to_do'
                    : k === 'buy'
                      ? 'planner.to_buy'
                      : k === 'study'
                        ? 'planner.to_study'
                        : 'planner.pastiglie',
                )}
              </Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            backgroundColor: pt.card,
            borderRadius: 18,
            borderWidth: 0.5,
            borderColor: pt.hair,
            padding: 14,
          }}
        >
          {tab === 'study' ? (
            <StudyCard
              pt={pt}
              blocks={data.study}
              empty={t('planner.study_niente_oggi')}
              untitled={t('planner.senza_titolo_l')}
              openLabel={t('planner.apri_2')}
              onOpen={() => router.push('/projects')}
              onDone={(uuid) => {
                services.projects.setStatus(uuid, 'completed');
                changed();
              }}
            />
          ) : tab === 'pills' ? (
            <PillsCard
              pt={pt}
              title={t('planner.prese_di', {
                quando: dayWord,
                mese: t(`planner.mese_${monthOf(focus)}`).toLowerCase(),
                giorno: dayOfMonth(focus),
              })}
              doses={data.pills.doses}
              late={data.pills.late}
              empty={t('planner.nessuna_presa_prevista')}
              future={focus > today ? t('planner.si_spuntano_il_giorno_stesso') : null}
              row={doseRow}
              lateLabel={(n) =>
                t(n === 1 ? 'planner.rimasta_indietro' : 'planner.rimaste_indietro')
              }
            />
          ) : (
            <View>
              {inside.length === 0 ? (
                <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
                  {t('planner.niente_in_questa_settimana')}
                </Text>
              ) : (
                inside.map(taskRow)
              )}
              {before.length > 0 ? (
                <View>
                  {label(
                    t(
                      before.length === 1 ? 'planner.rimasta_indietro' : 'planner.rimaste_indietro',
                    ),
                  )}
                  {before.map(taskRow)}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <TextInput
                  testID="wk-add-input"
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={addTask}
                  returnKeyType="done"
                  placeholder={t('planner.aggiungi_al', {
                    giorno: dayOfMonth(focus),
                    mese: t(`planner.mese_${monthOf(focus)}`).toLowerCase(),
                  })}
                  placeholderTextColor={pt.ink3}
                  style={{
                    flex: 1,
                    color: pt.ink,
                    fontSize: 14,
                    fontFamily: pt.sans,
                    borderBottomWidth: 0.5,
                    borderBottomColor: pt.hair2,
                    paddingVertical: 6,
                  }}
                />
                <Pressable
                  testID="wk-add"
                  accessibilityRole="button"
                  accessibilityLabel={t('planner.aggiungi_al', {
                    giorno: dayOfMonth(focus),
                    mese: t(`planner.mese_${monthOf(focus)}`).toLowerCase(),
                  })}
                  onPress={addTask}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: pt.accentInk, fontSize: 22 }}>+</Text>
                </Pressable>
              </View>
              {noDate.length > 0 || after.length > 0 ? (
                <Pressable
                  testID="wk-others"
                  accessibilityRole="button"
                  onPress={() => setOthers(!others)}
                  style={{ paddingVertical: 10 }}
                >
                  <Text style={{ color: pt.accentInk, fontSize: 13, fontFamily: pt.sans }}>
                    {others ? t('planner.nascondi_altri') : t('planner.mostra_anche_gli_altri')}
                  </Text>
                </Pressable>
              ) : null}
              {others ? (
                <View>
                  {noDate.length > 0 ? label(t('planner.senza_data')) : null}
                  {noDate.map(taskRow)}
                  {after.length > 0 ? label(t('planner.piu_avanti')) : null}
                  {after.map(taskRow)}
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View
          style={{
            backgroundColor: pt.card,
            borderRadius: 18,
            borderWidth: 0.5,
            borderColor: pt.hair,
            padding: 14,
            gap: 8,
          }}
        >
          <Text
            style={{ color: pt.ink3, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' }}
          >
            {`${t('planner.dp_titolo')} · ${gg(focus).toLowerCase()} ${dayOfMonth(focus)} ${t(`planner.mese_${monthOf(focus)}`).toLowerCase()}`}
          </Text>
          {!revealed ? (
            <View>
              <Text
                testID="wk-diary-fake"
                style={{ color: pt.ink3, fontSize: 14, lineHeight: 20, opacity: 0.35 }}
              >
                {diaryFakeText(focus)}
              </Text>
              <Pressable
                testID="wk-diary-show"
                accessibilityRole="button"
                onPress={() => setRevealed(true)}
                style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 }}
              >
                <Text style={{ color: pt.accentInk, fontSize: 14, fontFamily: pt.sans }}>
                  {t('planner.dp_mostra')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Pressable
                testID="wk-diary-hide"
                accessibilityRole="button"
                onPress={() => setRevealed(false)}
              >
                <Text style={{ color: pt.accentInk, fontSize: 12, fontFamily: pt.sans }}>
                  {t('planner.dp_nascondi')}
                </Text>
              </Pressable>
              {!hasDiary ? (
                <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
                  {t('planner.dp_vuoto')}
                </Text>
              ) : (
                <>
                  {diary.note.trim() ? (
                    <Text style={{ color: pt.ink, fontSize: 14, lineHeight: 20 }}>
                      {diary.note.trim()}
                    </Text>
                  ) : null}
                  {(
                    [
                      [t('planner.dp_belle'), diary.good],
                      [t('planner.dp_imparato'), diary.learned],
                    ] as const
                  ).map(([name, items]) =>
                    items.length ? (
                      <View key={name}>
                        {label(name)}
                        {items.map((it) => (
                          <Text
                            key={it.uuid}
                            style={{ color: pt.ink, fontSize: 14, paddingVertical: 2 }}
                          >
                            {`• ${it.content}`}
                          </Text>
                        ))}
                      </View>
                    ) : null,
                  )}
                </>
              )}
              <Pressable
                testID="wk-diary-open"
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/diary', params: { data: focus } })}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ color: pt.accentInk, fontSize: 14, fontFamily: pt.sans }}>
                  {hasDiary ? t('planner.dp_apri') : t('planner.dp_scrivi')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function PillsCard(p: {
  pt: PlannerTheme;
  title: string;
  doses: DoseView[];
  late: DoseView[];
  empty: string;
  future: string | null;
  row: (d: DoseView, late: boolean) => React.ReactNode;
  lateLabel: (n: number) => string;
}) {
  const { pt } = p;
  return (
    <View>
      <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>{p.title}</Text>
      {p.late.length > 0 ? (
        <View>
          <Text
            style={{
              color: pt.ink3,
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginTop: 8,
            }}
          >
            {p.lateLabel(p.late.length)}
          </Text>
          {p.late.map((d) => p.row(d, true))}
        </View>
      ) : null}
      {p.doses.length === 0 ? (
        <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans, marginTop: 8 }}>
          {p.empty}
        </Text>
      ) : (
        p.doses.map((d) => p.row(d, false))
      )}
      {p.future ? (
        <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans, marginTop: 6 }}>
          {p.future}
        </Text>
      ) : null}
    </View>
  );
}

/** «To study» di un giorno: i blocchi di studio che lo coprono e sotto ciascuno gli argomenti da fare (con pomodori fatti/stimati). */
function StudyCard(p: {
  pt: PlannerTheme;
  blocks: StudyBlock[];
  empty: string;
  untitled: string;
  openLabel: string;
  onOpen: () => void;
  onDone: (topicUuid: string) => void;
}) {
  const { pt } = p;
  return (
    <View testID="wk-study">
      <Pressable
        testID="wk-study-open"
        accessibilityRole="link"
        onPress={p.onOpen}
        style={{ alignSelf: 'flex-end', paddingBottom: 4 }}
      >
        <Text style={{ color: pt.accentInk, fontSize: 13, fontFamily: pt.sans }}>
          {p.openLabel} ›
        </Text>
      </Pressable>
      {p.blocks.length === 0 ? (
        <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>{p.empty}</Text>
      ) : (
        p.blocks.map((b) => (
          <View key={b.uuid} testID={`wk-study-block-${b.uuid}`} style={{ marginBottom: 8 }}>
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: b.color ?? pt.hair2,
                paddingLeft: 8,
                paddingVertical: 2,
                opacity: b.completed ? 0.55 : 1,
              }}
            >
              <Text
                style={{
                  color: pt.ink,
                  fontSize: 14,
                  fontFamily: pt.sans,
                  textDecorationLine: b.completed ? 'line-through' : 'none',
                }}
              >
                {b.title || p.untitled}
              </Text>
              {b.subject && b.subject !== b.title ? (
                <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>
                  {b.subject}
                </Text>
              ) : null}
            </View>
            {b.topics.map((x) => (
              <View
                key={x.uuid}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 7,
                  paddingLeft: 12,
                }}
              >
                <CheckBox
                  testID={`wk-study-done-${x.uuid}`}
                  color={x.color}
                  done={false}
                  pt={pt}
                  onPress={() => p.onDone(x.uuid)}
                />
                <Text
                  testID={`wk-study-topic-${x.uuid}`}
                  style={{ flex: 1, color: pt.ink, fontSize: 14, fontFamily: pt.sans }}
                >
                  {x.name || p.untitled}
                </Text>
                {x.done || x.estimated ? (
                  <Text
                    testID={`wk-study-pomo-${x.uuid}`}
                    style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}
                  >
                    {x.done}
                    {x.estimated ? `/${x.estimated}` : ''}🍅
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}
