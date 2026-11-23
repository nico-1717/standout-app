import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/features/habits/Sheet';
import { usePlanTheme } from '@/features/plan/ui';
import { haptic } from '@/ui/motion';

import { MAX_BLOCKS, type Block, type BlockKind } from './blocks';
import { ConnectionBlock, type AiTableFn } from './ConnectionBlock';
import { ReviewBlock } from './ReviewBlock';
import {
  ChecklistBlock,
  CounterBlock,
  NoteBlock,
  ProgressBlock,
  TableBlock,
  type BlockProps,
} from './SimpleBlocks';
import { Btn } from './parts';
import { templateBlock, type TemplateId } from './templates';
import type { TrackerRepo } from './repo';

type Page = 'root' | 'advanced' | 'programming';
const SIMPLE: BlockKind[] = ['table', 'counter', 'progress', 'checklist', 'note'];
const TITLES: Record<Page, string> = {
  root: 'tracker.pick_block',
  advanced: 'tracker.k_advanced',
  programming: 'tracker.k_programming',
};

const BODY: Partial<Record<BlockKind, (p: BlockProps) => React.ReactElement>> = {
  table: (p) => <TableBlock {...p} />,
  counter: (p) => <CounterBlock {...p} />,
  progress: (p) => <ProgressBlock {...p} />,
  checklist: (p) => <ChecklistBlock {...p} />,
  note: (p) => <NoteBlock {...p} />,
  review: (p) => <ReviewBlock {...p} />,
};

/** Il Tracker di un progetto: vuoto all'inizio, lo costruisci aggiungendo blocchi (tabella, contatore, barra, lista, nota, NeetCode). */
export function TrackerTab({
  repo,
  project,
  changed,
  aiTable,
}: {
  repo: TrackerRepo;
  project: string;
  changed: () => void;
  /** «Crea con l'IA» del Collegamento: senza questa funzione il pulsante non c'è. */
  aiTable?: AiTableFn;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  // il foglio «Aggiungi un blocco» ha tre pagine: i blocchi semplici, «Avanzate» e dentro «Programmazione»
  const [page, setPage] = useState<Page>('root');
  const [msg, setMsg] = useState<string | null>(null);
  const blocks = repo.blocks(project);

  const save = (b: Block, change: { title?: string; config?: object; data?: object }) => {
    if (!repo.update(b.uuid, change)) setMsg(t('tracker.full', { n: MAX_BLOCKS }));
    changed();
  };
  const closePicker = () => {
    setPicking(false);
    setPage('root');
  };
  const add = (kind: BlockKind) => {
    closePicker();
    const id = repo.add(
      project,
      kind,
      kind === 'review' || kind === 'connection' ? t(`tracker.k_${kind}`) : '',
    );
    setMsg(id ? null : t('tracker.full', { n: MAX_BLOCKS }));
    changed();
  };
  // un modello già riempito (Blind 75, sfida giornaliera): un blocco normale, che poi si cambia come gli altri
  const addTemplate = (id: TemplateId) => {
    closePicker();
    const tpl = templateBlock(id);
    const made = repo.add(project, tpl.kind, t(`tracker.k_${id}`), {
      config: tpl.config,
      data: tpl.data,
    });
    setMsg(made ? null : t('tracker.full', { n: MAX_BLOCKS }));
    changed();
  };
  const ask = (b: Block) =>
    Alert.alert(t('tracker.remove'), t('tracker.remove_ask'), [
      { text: t('tracker.cancel'), style: 'cancel' },
      {
        text: t('tracker.remove'),
        style: 'destructive',
        onPress: () => {
          repo.remove(b.uuid);
          changed();
        },
      },
    ]);
  const arrow = (label: string, glyph: string, on: boolean, run: () => void, id: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!on}
      hitSlop={6}
      onPress={() => {
        haptic.tap();
        run();
      }}
      style={{
        width: 40,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: on ? 1 : 0.25,
      }}
    >
      <Text style={{ color: ht.text2, fontSize: 18 }}>{glyph}</Text>
    </Pressable>
  );

  const choice = (id: string, name: string, text: string, run: () => void, more = false) => (
    <Pressable
      key={id}
      testID={`tr-pick-${id}`}
      accessibilityRole="button"
      onPress={run}
      style={({ pressed }) => ({
        minHeight: 60,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: ht.hairline2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: ht.text, fontWeight: '700', fontSize: 16 }}>{name}</Text>
        <Text style={{ color: ht.text2, fontSize: 13 }}>{text}</Text>
      </View>
      {more ? <Text style={{ color: ht.text3, fontSize: 22 }}>›</Text> : null}
    </Pressable>
  );

  return (
    <View style={{ gap: 14 }} testID="tracker-tab">
      {blocks.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 16 }}>
          <Text style={{ color: ht.text, fontSize: 18, fontWeight: '700' }}>
            {t('tracker.empty_title')}
          </Text>
          <Text style={{ color: ht.text2, textAlign: 'center', lineHeight: 21 }}>
            {t('tracker.empty_text')}
          </Text>
        </View>
      ) : null}
      {blocks.map((b, i) => {
        const body = BODY[b.kind];
        return (
          <View
            key={b.uuid}
            testID={`tr-block-${b.kind}`}
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: ht.hairline2,
              backgroundColor: ht.surface,
              padding: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                key={`t:${b.uuid}:${b.title}`}
                testID={`tr-title-${i}`}
                defaultValue={b.title}
                placeholder={t(`tracker.k_${b.kind}`)}
                placeholderTextColor={ht.text3}
                maxLength={120}
                onEndEditing={(e) => {
                  if (e.nativeEvent.text.trim() !== b.title) save(b, { title: e.nativeEvent.text });
                }}
                style={{ flex: 1, minHeight: 44, color: ht.text, fontSize: 17, fontWeight: '700' }}
              />
              {arrow(
                t('tracker.move_up'),
                '↑',
                i > 0,
                () => {
                  repo.move(b.uuid, -1);
                  changed();
                },
                `tr-up-${i}`,
              )}
              {arrow(
                t('tracker.move_down'),
                '↓',
                i < blocks.length - 1,
                () => {
                  repo.move(b.uuid, 1);
                  changed();
                },
                `tr-down-${i}`,
              )}
              <Pressable
                testID={`tr-remove-${i}`}
                accessibilityRole="button"
                accessibilityLabel={t('tracker.remove')}
                hitSlop={6}
                onPress={() => ask(b)}
                style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: ht.text3, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            {b.kind === 'connection' ? (
              <ConnectionBlock
                block={b}
                repo={repo}
                project={project}
                changed={changed}
                onSave={(c) => save(b, c)}
                aiTable={aiTable}
              />
            ) : body ? (
              body({ block: b, all: blocks, onSave: (c) => save(b, c) })
            ) : null}
          </View>
        );
      })}
      {msg ? <Text style={{ color: ht.red, textAlign: 'center' }}>{msg}</Text> : null}
      <Btn
        full
        tone={blocks.length ? 'plain' : 'primary'}
        label={t('tracker.add_block')}
        disabled={blocks.length >= MAX_BLOCKS}
        onPress={() => {
          setPage('root');
          setPicking(true);
        }}
        testID="tr-add-block"
      />
      <Sheet
        visible={picking}
        title={t(TITLES[page])}
        th={ht}
        onClose={closePicker}
        testID="tr-pick-sheet"
      >
        <View style={{ padding: 20, gap: 10 }}>
          {page !== 'root' ? (
            <Btn
              small
              label={`‹ ${t('tracker.back')}`}
              onPress={() => setPage(page === 'programming' ? 'advanced' : 'root')}
              testID="tr-pick-back"
            />
          ) : null}
          {page === 'root'
            ? SIMPLE.map((k) => choice(k, t(`tracker.k_${k}`), t(`tracker.d_${k}`), () => add(k)))
            : null}
          {page === 'root'
            ? choice(
                'advanced',
                t('tracker.k_advanced'),
                t('tracker.d_advanced'),
                () => setPage('advanced'),
                true,
              )
            : null}
          {page === 'advanced'
            ? choice('connection', t('tracker.k_connection'), t('tracker.d_connection'), () =>
                add('connection'),
              )
            : null}
          {page === 'advanced'
            ? choice(
                'programming',
                t('tracker.k_programming'),
                t('tracker.d_programming'),
                () => setPage('programming'),
                true,
              )
            : null}
          {page === 'programming'
            ? choice('review', t('tracker.k_review'), t('tracker.d_review'), () => add('review'))
            : null}
          {page === 'programming'
            ? choice('blind75', t('tracker.k_blind75'), t('tracker.d_blind75'), () =>
                addTemplate('blind75'),
              )
            : null}
          {page === 'programming'
            ? choice('streak', t('tracker.k_streak'), t('tracker.d_streak'), () =>
                addTemplate('streak'),
              )
            : null}
        </View>
      </Sheet>
    </View>
  );
}
