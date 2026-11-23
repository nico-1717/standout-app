import { useState } from 'react';
import { Linking, Pressable, Share, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/features/habits/Sheet';
import { usePlanTheme } from '@/features/plan/ui';
import { localToday } from '@/features/tasks/groups';
import { haptic } from '@/ui/motion';

import { reviewData, type Picks } from './blocks';
import {
  CATEGORIES,
  INT,
  PATTERNS,
  PROBLEMS,
  STARTED_AT,
  TOTAL,
  bulkRecord,
  diffDays,
  dueLabel,
  exportBackup,
  importBackup,
  learnPattern,
  newCandidates,
  nextRecord,
  pickNew,
  pickReview,
  seenLabel,
  solvedCountByCat,
  solvedList,
  startedCats,
  swapNew,
  type Diff,
  type DueLabel,
  type Items,
  type LogChoice,
  type Rating,
  type ReviewRecord,
  type SeenLabel,
} from './neetcode';
import { Btn, Check, Hint, Pill, Segment } from './parts';
import type { BlockProps } from './SimpleBlocks';

type Tab = 'today' | 'solved' | 'todo' | 'backup';
const RATINGS: Rating[] = [1, 2, 3, 4];

/**
 * Il ripasso a intervalli di NeetCode 150 (il «NeetCode Tracker» di Claude): Oggi, Risolti, Da fare e Backup, con il
 * foglio per registrare un risultato. La logica sta in neetcode.ts; qui c'è solo l'interfaccia.
 */
export function ReviewBlock({ block, onSave }: BlockProps) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const today = localToday();
  const data = reviewData(block.data);
  const items = data.items;
  const picks: Picks =
    data.picks && data.picks.date === today ? data.picks : { date: today, review: [], news: [] };

  const [tab, setTab] = useState<Tab>('today');
  const [diff, setDiff] = useState<Diff>('M');
  const [onlyStarted, setOnlyStarted] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const [todoDiff, setTodoDiff] = useState<Diff | 'ALL'>('ALL');
  const [todoQuery, setTodoQuery] = useState('');
  const [solvedQuery, setSolvedQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [importText, setImportText] = useState('');

  const write = (next: Items, nextPicks: Picks = picks, lastExport = data.lastExport) =>
    onSave({ data: { items: next, lastExport, picks: nextPicks } });

  const dueText = (d: DueLabel) =>
    d.kind === 'overdue'
      ? t('tracker.r_over', { n: d.n })
      : d.kind === 'today'
        ? t('tracker.r_due_today')
        : t('tracker.r_due_in', { n: d.n });
  const seenText = (s: SeenLabel) =>
    s.kind === 'today'
      ? t('tracker.r_seen_today')
      : s.kind === 'earlier'
        ? t('tracker.r_seen_earlier')
        : t('tracker.r_seen_ago', { n: s.n });
  const diffName = (d: Diff) =>
    t(d === 'E' ? 'tracker.r_easy' : d === 'M' ? 'tracker.r_medium' : 'tracker.r_hard');
  const diffColor = (d: Diff) => (d === 'E' ? ht.green : d === 'M' ? '#E0A64A' : ht.red);
  const ratingColor = (r: number) =>
    r === 1 ? ht.green : r === 2 ? '#4C8DDB' : r === 3 ? '#E0A64A' : ht.red;
  const ratingName = (r: number) => t(`tracker.s_r${r}`);
  const noteText = (code: string) =>
    code === 'none_started'
      ? t('tracker.r_note_none_started', { n: STARTED_AT })
      : code === 'finished_started'
        ? t('tracker.r_note_finished')
        : code.startsWith('learn:')
          ? t('tracker.r_note_learn', { c: code.slice(6) })
          : '';

  /* ---------------- azioni ---------------- */

  const doPickReview = () => {
    const ids = pickReview(items, today, Math.random);
    if (!ids.length) {
      setMsg(Object.keys(items).length ? t('tracker.r_all_reviewed') : t('tracker.r_none_review'));
      return;
    }
    setMsg(null);
    write(items, { ...picks, review: ids });
  };
  const doPickNew = () => {
    const { list, note } = newCandidates(items, diff, onlyStarted);
    if (!list.length) {
      setMsg(t('tracker.r_none_left', { d: diffName(diff).toLowerCase() }));
      return;
    }
    setMsg(null);
    const chosen = pickNew(items, list, Math.random);
    write(items, {
      ...picks,
      news: chosen.map((p, i) => ({ id: p.id, note: i === 0 ? note : '' })),
    });
  };
  const doSwap = (index: number) => {
    const { list } = newCandidates(items, diff, onlyStarted);
    const id = swapNew(
      items,
      list,
      picks.news.map((e) => e.id),
      index,
      Math.random,
    );
    if (id === null) {
      setMsg(t('tracker.r_no_other'));
      return;
    }
    setMsg(null);
    write(items, {
      ...picks,
      news: picks.news.map((e, i) => (i === index ? { id, note: '' } : e)),
    });
  };
  const doLearn = () => {
    // a pattern already on screen is skipped, so pressing again (or Swap) gives a different one
    const shown = picks.news.flatMap((e) => (e.note.startsWith('learn:') ? [e.note.slice(6)] : []));
    const l = learnPattern(items, shown);
    if (!l) {
      setMsg(shown.length ? t('tracker.r_no_other') : t('tracker.r_all_patterns'));
      return;
    }
    setMsg(null);
    write(items, { ...picks, news: [{ id: l.id, note: `learn:${l.cat}` }] });
  };
  const doLog = (id: number, choice: LogChoice) => {
    const rec = nextRecord(items[id] ?? null, id, choice, today);
    const match =
      choice.pattern === PROBLEMS[id]?.cat
        ? t('tracker.s_match')
        : t('tracker.s_other', { c: PROBLEMS[id]?.cat ?? '' });
    setMsg(t('tracker.s_saved', { due: dueText(dueLabel(rec, today)), match }));
    setSheet(null);
    write({ ...items, [id]: rec });
  };
  const doRemove = (id: number) => {
    const next = { ...items };
    delete next[id];
    setMsg(t('tracker.s_removed'));
    setSheet(null);
    write(next);
  };
  const doBulk = () => {
    const next = { ...items };
    for (const id of selected) if (!next[id]) next[id] = bulkRecord(id, today);
    setMsg(t('tracker.r_added_n', { n: selected.length }));
    setSelected([]);
    setSelecting(false);
    write(next);
  };

  /* ---------------- pezzi di schermo ---------------- */

  const problemCard = (id: number, body: React.ReactNode) => (
    <View
      key={`${id}`}
      testID={`nc-card-${id}`}
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: ht.hairline2,
        padding: 12,
        gap: 8,
        backgroundColor: ht.bg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <Text style={{ color: ht.text, fontWeight: '600', fontSize: 15, flex: 1 }}>
          {PROBLEMS[id]?.name}
        </Text>
        <Pill
          label={diffName(PROBLEMS[id]?.diff ?? 'M')}
          color={diffColor(PROBLEMS[id]?.diff ?? 'M')}
        />
      </View>
      {body}
    </View>
  );
  const reviewCard = (id: number) => {
    const it = items[id];
    if (!it) return null;
    const done = it.lastReviewed === today;
    return problemCard(
      id,
      <>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill label={`${it.rating} ${ratingName(it.rating)}`} color={ratingColor(it.rating)} />
          <Text style={{ color: ht.text2, fontSize: 13 }}>{seenText(seenLabel(it, today))}</Text>
          {done ? null : (
            <Text style={{ color: ht.text2, fontSize: 13 }}>{dueText(dueLabel(it, today))}</Text>
          )}
        </View>
        {done ? (
          <Text style={{ color: ht.green, fontWeight: '600' }}>
            {t('tracker.r_reviewed_today', { n: it.rating })}
          </Text>
        ) : (
          <Btn
            small
            label={t('tracker.r_log_result')}
            onPress={() => setSheet(id)}
            testID={`nc-log-${id}`}
          />
        )}
      </>,
    );
  };
  const newCard = (e: { id: number; note: string }, index: number) => {
    const it = items[e.id];
    return problemCard(
      e.id,
      <>
        {e.note ? (
          <Text style={{ color: ht.accent, fontWeight: '600', fontSize: 13 }}>
            {noteText(e.note)}
          </Text>
        ) : null}
        {it ? (
          <Text style={{ color: ht.green, fontWeight: '600' }}>
            {t('tracker.r_solved_rated', { n: it.rating })}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn
              small
              tone="primary"
              label={t('tracker.r_log_solved')}
              onPress={() => setSheet(e.id)}
              testID={`nc-solve-${e.id}`}
            />
            <Btn
              small
              label={t('tracker.r_swap')}
              onPress={() => (e.note.startsWith('learn:') ? doLearn() : doSwap(index))}
              testID={`nc-swap-${index}`}
            />
          </View>
        )}
      </>,
    );
  };
  const card = (children: React.ReactNode) => (
    <View
      style={{ gap: 12, borderRadius: 16, borderWidth: 1, borderColor: ht.hairline2, padding: 14 }}
    >
      {children}
    </View>
  );

  /* ---------------- le quattro schede ---------------- */

  const viewToday = () => {
    const all = Object.values(items);
    const due = all.filter((it) => diffDays(today, it.nextDue) >= 0).length;
    const doneToday = all.filter((it) => it.lastReviewed === today).length;
    const cand = newCandidates(items, diff, onlyStarted);
    const tile = (n: string | number, label: string, id: string) => (
      <View
        style={{
          flex: 1,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: ht.hairline2,
          padding: 10,
        }}
      >
        <Text
          testID={id}
          style={{ color: ht.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] }}
        >
          {n}
        </Text>
        <Text style={{ color: ht.text2, fontSize: 12 }}>{label}</Text>
      </View>
    );
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {tile(`${all.length}/${TOTAL}`, t('tracker.r_tile_solved'), 'nc-tile-solved')}
          {tile(due, t('tracker.r_tile_due'), 'nc-tile-due')}
          {tile(doneToday, t('tracker.r_tile_done'), 'nc-tile-done')}
        </View>
        {card(
          <>
            <View style={{ gap: 4 }}>
              <Text style={{ color: ht.text, fontSize: 17, fontWeight: '700' }}>
                {t('tracker.r_hour')}
              </Text>
              <Hint>{t('tracker.r_hour_hint')}</Hint>
            </View>
            <Btn
              tone="primary"
              label={picks.review.length ? t('tracker.r_pick3_again') : t('tracker.r_pick3')}
              onPress={doPickReview}
              testID="nc-pick-review"
            />
            {picks.review.length ? (
              <View style={{ gap: 8 }}>{picks.review.map(reviewCard)}</View>
            ) : null}
          </>,
        )}
        {card(
          <>
            <View style={{ gap: 4 }}>
              <Text style={{ color: ht.text, fontSize: 17, fontWeight: '700' }}>
                {t('tracker.r_new')}
              </Text>
              <Hint>{t('tracker.r_new_hint')}</Hint>
            </View>
            <Segment
              testID="nc-diff"
              value={diff}
              onChange={setDiff}
              items={[
                { id: 'M', label: t('tracker.r_medium') },
                { id: 'E', label: t('tracker.r_easy') },
                { id: 'H', label: t('tracker.r_hard') },
              ]}
            />
            <Check
              testID="nc-only-started"
              on={onlyStarted}
              onChange={setOnlyStarted}
              label={t('tracker.r_only_started', { n: STARTED_AT })}
            />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Btn
                tone="primary"
                label={picks.news.length ? t('tracker.r_pick2_again') : t('tracker.r_pick2')}
                onPress={doPickNew}
                testID="nc-pick-new"
              />
              <Btn label={t('tracker.r_learn')} onPress={doLearn} testID="nc-learn" />
            </View>
            {picks.news.length ? (
              <View style={{ gap: 8 }}>{picks.news.map(newCard)}</View>
            ) : (
              <Hint>
                {t('tracker.r_pool', { n: cand.list.length, d: diffName(diff).toLowerCase() })}
              </Hint>
            )}
          </>,
        )}
      </View>
    );
  };

  const viewSolved = () => {
    const counts = solvedCountByCat(items);
    const started = startedCats(items);
    const rows = solvedList(items, solvedQuery);
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => {
            const total = PROBLEMS.filter((p) => p.cat === c).length;
            const n = counts[c] ?? 0;
            return (
              <View
                key={c}
                testID={`nc-cat-${c}`}
                style={{
                  width: '48.5%',
                  borderRadius: 12,
                  borderWidth: started.has(c) ? 2 : 1,
                  borderColor: started.has(c) ? ht.accent : ht.hairline2,
                  padding: 8,
                  gap: 4,
                }}
              >
                <Text style={{ color: ht.text, fontSize: 13 }} numberOfLines={1}>
                  {c}
                </Text>
                <Text style={{ color: ht.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {n}/{total}
                </Text>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: ht.surface3,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${(100 * n) / total}%`,
                      height: '100%',
                      backgroundColor: ht.accent,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
        <TextInput
          testID="nc-search-solved"
          value={solvedQuery}
          onChangeText={setSolvedQuery}
          placeholder={t('tracker.r_search_solved')}
          placeholderTextColor={ht.text3}
          style={{
            minHeight: 44,
            color: ht.text,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ht.hairline2,
            paddingHorizontal: 12,
          }}
        />
        {rows.length ? (
          rows.map((it) => (
            <Pressable
              key={it.n}
              testID={`nc-solved-${it.n}`}
              accessibilityRole="button"
              onPress={() => setSheet(it.n)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                minHeight: 56,
                padding: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ht.hairline2,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: ht.text, fontWeight: '600' }}>{PROBLEMS[it.n]?.name}</Text>
                <Text style={{ color: ht.text2, fontSize: 13 }}>{it.pattern}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Pill
                  label={`${it.rating} ${ratingName(it.rating)}`}
                  color={ratingColor(it.rating)}
                />
                <Text style={{ color: ht.text2, fontSize: 12 }}>
                  {dueText(dueLabel(it, today))}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={{ color: ht.text2, textAlign: 'center', padding: 20 }}>
            {Object.keys(items).length ? t('tracker.r_no_match') : t('tracker.r_no_solved')}
          </Text>
        )}
      </View>
    );
  };

  const viewTodo = () => {
    const q = todoQuery.trim().toLowerCase();
    const rows = PROBLEMS.filter(
      (p) =>
        !items[p.id] &&
        (todoDiff === 'ALL' || p.diff === todoDiff) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
    return (
      <View style={{ gap: 12 }}>
        <Hint>{t('tracker.r_todo_hint')}</Hint>
        <TextInput
          testID="nc-search-todo"
          value={todoQuery}
          onChangeText={setTodoQuery}
          placeholder={t('tracker.r_search_todo')}
          placeholderTextColor={ht.text3}
          style={{
            minHeight: 44,
            color: ht.text,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ht.hairline2,
            paddingHorizontal: 12,
          }}
        />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segment
            testID="nc-todo-diff"
            value={todoDiff}
            onChange={setTodoDiff}
            items={[
              { id: 'ALL', label: t('tracker.r_all') },
              { id: 'E', label: t('tracker.r_easy') },
              { id: 'M', label: t('tracker.r_medium') },
              { id: 'H', label: t('tracker.r_hard') },
            ]}
          />
          <Btn
            small
            tone={selecting ? 'primary' : 'plain'}
            label={selecting ? t('tracker.r_select_off') : t('tracker.r_select')}
            onPress={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
            testID="nc-select"
          />
        </View>
        {selecting ? (
          <Btn
            full
            tone="primary"
            label={t('tracker.r_add_n', { n: selected.length })}
            disabled={!selected.length}
            onPress={doBulk}
            testID="nc-add-selected"
          />
        ) : null}
        {rows.length ? (
          rows.map((p) =>
            selecting ? (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  minHeight: 52,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: ht.hairline2,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: ht.text, fontWeight: '600' }}>{p.name}</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <Pill label={diffName(p.diff)} color={diffColor(p.diff)} />
                  </View>
                </View>
                <Check
                  testID={`nc-pick-${p.id}`}
                  on={selected.includes(p.id)}
                  onChange={(v) =>
                    setSelected(v ? [...selected, p.id] : selected.filter((x) => x !== p.id))
                  }
                />
              </View>
            ) : (
              <Pressable
                key={p.id}
                testID={`nc-todo-${p.id}`}
                accessibilityRole="button"
                onPress={() => setSheet(p.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  minHeight: 52,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: ht.hairline2,
                }}
              >
                <Text style={{ color: ht.text, fontWeight: '600', flex: 1 }}>{p.name}</Text>
                <Pill label={diffName(p.diff)} color={diffColor(p.diff)} />
              </Pressable>
            ),
          )
        ) : (
          <Text style={{ color: ht.text2, textAlign: 'center', padding: 20 }}>
            {t('tracker.r_nothing_left')}
          </Text>
        )}
      </View>
    );
  };

  const viewBackup = () => {
    const text = exportBackup(items, today);
    return (
      <View style={{ gap: 12 }}>
        <Hint>{t('tracker.b_hint')}</Hint>
        <TextInput
          testID="nc-export"
          value={text}
          editable={false}
          multiline
          style={{
            maxHeight: 140,
            color: ht.text,
            fontSize: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ht.hairline2,
            padding: 10,
          }}
        />
        <Text style={{ color: ht.text2, fontSize: 13 }}>
          {t('tracker.b_last', { d: data.lastExport ?? t('tracker.b_never') })}
        </Text>
        <Btn
          label={t('tracker.b_copy')}
          testID="nc-copy"
          onPress={() => {
            void Share.share({ message: text }).then((r) => {
              if (r.action === Share.sharedAction) write(items, picks, today);
            });
          }}
        />
        <TextInput
          testID="nc-import-text"
          value={importText}
          onChangeText={setImportText}
          multiline
          placeholder={t('tracker.b_import_ph')}
          placeholderTextColor={ht.text3}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            minHeight: 100,
            maxHeight: 160,
            color: ht.text,
            fontSize: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ht.hairline2,
            padding: 10,
            textAlignVertical: 'top',
          }}
        />
        <Btn
          tone="primary"
          label={t('tracker.b_import')}
          disabled={!importText.trim()}
          testID="nc-import"
          onPress={() => {
            const r = importBackup(items, importText);
            if (r.error) {
              setMsg(t('tracker.b_bad'));
              return;
            }
            setMsg(t('tracker.b_result', { a: r.added, u: r.updated, s: r.skipped }));
            setImportText('');
            write(r.items);
          }}
        />
      </View>
    );
  };

  const solvedCount = Object.keys(items).length;
  const lastAge = data.lastExport ? diffDays(today, data.lastExport) : null;
  const needBackup = solvedCount >= 5 && (lastAge === null || lastAge > 7);
  const TABS: { id: Tab; label: string }[] = [
    { id: 'today', label: t('tracker.r_tab_today') },
    { id: 'solved', label: t('tracker.r_tab_solved') },
    { id: 'todo', label: t('tracker.r_tab_todo') },
    { id: 'backup', label: t('tracker.r_tab_backup') },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text testID="nc-sub" style={{ color: ht.text2 }}>
          {t('tracker.r_solved_of', { n: solvedCount, m: TOTAL })}
        </Text>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => void Linking.openURL('https://neetcode.io/practice')}
        >
          <Text style={{ color: ht.accent, fontWeight: '600' }}>{t('tracker.r_open')}</Text>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 12,
          backgroundColor: ht.surface2,
          padding: 3,
          gap: 2,
        }}
      >
        {TABS.map((x) => (
          <Pressable
            key={x.id}
            testID={`nc-tab-${x.id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === x.id }}
            onPress={() => {
              haptic.tap();
              setTab(x.id);
              setSelecting(false);
              setSelected([]);
            }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tab === x.id ? ht.surface : 'transparent',
            }}
          >
            <Text
              style={{
                color: tab === x.id ? ht.text : ht.text2,
                fontWeight: tab === x.id ? '700' : '500',
                fontSize: 13,
              }}
            >
              {x.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {needBackup && tab !== 'backup' ? (
        <Pressable
          testID="nc-banner"
          onPress={() => setTab('backup')}
          style={{ borderRadius: 12, padding: 10, backgroundColor: ht.surface2 }}
        >
          <Text style={{ color: ht.text, fontSize: 13 }}>
            {t('tracker.b_banner', { n: solvedCount })}
          </Text>
        </Pressable>
      ) : null}
      {msg ? (
        <Pressable
          testID="nc-msg"
          onPress={() => setMsg(null)}
          style={{ borderRadius: 12, padding: 10, backgroundColor: ht.surface2 }}
        >
          <Text style={{ color: ht.text, fontSize: 14 }}>{msg}</Text>
        </Pressable>
      ) : null}
      {tab === 'today'
        ? viewToday()
        : tab === 'solved'
          ? viewSolved()
          : tab === 'todo'
            ? viewTodo()
            : viewBackup()}

      <Sheet
        visible={sheet !== null}
        title={sheet !== null ? (PROBLEMS[sheet]?.name ?? '') : ''}
        th={ht}
        onClose={() => setSheet(null)}
        testID="nc-sheet"
      >
        {sheet !== null ? (
          <LogForm
            key={sheet}
            id={sheet}
            prev={items[sheet] ?? null}
            today={today}
            diffName={diffName}
            diffColor={diffColor}
            ratingColor={ratingColor}
            seenText={seenText}
            onSave={doLog}
            onRemove={doRemove}
            onCancel={() => setSheet(null)}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

/** Il foglio per registrare un risultato: quando, che schema, quanto è stato difficile. Salva solo con schema e voto. */
function LogForm(p: {
  id: number;
  prev: ReviewRecord | null;
  today: string;
  diffName: (d: Diff) => string;
  diffColor: (d: Diff) => string;
  ratingColor: (r: number) => string;
  seenText: (s: SeenLabel) => string;
  onSave: (id: number, c: LogChoice) => void;
  onRemove: (id: number) => void;
  onCancel: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const prob = PROBLEMS[p.id];
  const [rating, setRating] = useState<Rating | null>(null);
  const [pattern, setPattern] = useState<string | null>(p.prev?.pattern ?? null);
  const [when, setWhen] = useState<'today' | 'earlier'>('today');
  const ok = rating !== null && pattern !== null;
  return (
    <View style={{ padding: 20, gap: 16 }} testID="nc-form">
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {prob ? <Pill label={p.diffName(prob.diff)} color={p.diffColor(prob.diff)} /> : null}
        {p.prev ? (
          <Text style={{ color: ht.text2, fontSize: 13 }}>
            {t('tracker.s_last', { r: p.prev.rating, s: p.seenText(seenLabel(p.prev, p.today)) })}
          </Text>
        ) : null}
      </View>
      {!p.prev ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: ht.text2, fontWeight: '700', fontSize: 13 }}>
            {t('tracker.s_when')}
          </Text>
          <Segment
            testID="nc-when"
            value={when}
            onChange={setWhen}
            items={[
              { id: 'today', label: t('tracker.s_today') },
              { id: 'earlier', label: t('tracker.s_earlier') },
            ]}
          />
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text style={{ color: ht.text2, fontWeight: '700', fontSize: 13 }}>
          {t('tracker.s_pattern')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PATTERNS.map((c) => (
            <Pressable
              key={c}
              testID={`nc-pattern-${c}`}
              accessibilityRole="button"
              accessibilityState={{ selected: pattern === c }}
              onPress={() => setPattern(c)}
              style={{
                minHeight: 40,
                paddingHorizontal: 12,
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: 1,
                borderColor: pattern === c ? ht.accent : ht.hairline2,
                backgroundColor: pattern === c ? ht.accent : 'transparent',
              }}
            >
              <Text
                style={{
                  color: pattern === c ? ht.inkText : ht.text,
                  fontSize: 14,
                  fontWeight: pattern === c ? '700' : '400',
                }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: ht.text2, fontWeight: '700', fontSize: 13 }}>
          {t('tracker.s_hard')}
        </Text>
        {RATINGS.map((r) => (
          <Pressable
            key={r}
            testID={`nc-rating-${r}`}
            accessibilityRole="button"
            accessibilityState={{ selected: rating === r }}
            onPress={() => setRating(r)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 54,
              padding: 10,
              borderRadius: 12,
              borderWidth: rating === r ? 2 : 1,
              borderColor: rating === r ? ht.accent : ht.hairline2,
            }}
          >
            <Text style={{ color: p.ratingColor(r), fontSize: 20, fontWeight: '700', width: 22 }}>
              {r}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: ht.text, fontWeight: '600' }}>{t(`tracker.s_r${r}`)}</Text>
              <Text style={{ color: ht.text2, fontSize: 13 }}>
                {t(`tracker.s_r${r}d`)} · {t('tracker.s_next', { n: INT[r] })}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Btn
          full
          tone="primary"
          disabled={!ok}
          label={p.prev ? t('tracker.s_save_review') : t('tracker.s_save')}
          testID="nc-save"
          onPress={() =>
            rating !== null && pattern !== null && p.onSave(p.id, { rating, pattern, when })
          }
        />
        <Btn full label={t('tracker.cancel')} onPress={p.onCancel} />
        {p.prev ? (
          <Btn
            full
            tone="danger"
            label={t('tracker.s_remove')}
            onPress={() => p.onRemove(p.id)}
            testID="nc-remove"
          />
        ) : null}
      </View>
    </View>
  );
}
