import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { ProjectDeckCard } from '@/features/flashcards/ProjectDeckCard';
import { RichEditor } from '@/features/flashcards/RichEditor';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { ReorderList, reorderKeys } from '@/ui/ReorderList';
import { PrimaryButton, TextButton } from '@/ui/kit';
import { useAutosave } from '@/ui/useAutosave';

import { PjIcon, type PjIconName } from './PjIcons';
import { ProjectPicker } from './ProjectPicker';
import { childrenOf, type Project } from './logic';
import { isRichNote, noteText } from './notes';
import { shortDate } from './pjFormat';

/** Le dodici tinte del sito (progetti.php, $prColorPalette). */
export const SWATCHES = [
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#00C7BE',
  '#30B0C7',
  '#32ADE6',
  '#007AFF',
  '#5856D6',
  '#AF52DE',
  '#FF2D55',
  '#A2845E',
];

/** Quanti caratteri al massimo ha una nota (il sito e il server tagliano oltre). */
export const NOTE_MAX = 8000;

type Panel = 'color' | 'due' | 'target' | 'deck' | 'note' | 'parent' | 'order' | 'delete' | null;

/**
 * Il foglio dei tre puntini (.pr-altro): colore, preferito, scadenza, data obiettivo, flashcard, nota, attività,
 * «Sposta in…» e «Elimina progetto». Ogni voce con un valore si apre in una pagina del foglio, con «‹» per tornare.
 */
export function ProjectMenu(p: {
  me: Project;
  all: Project[];
  /** quanti Pomodori ha il progetto (con i figli), per la domanda prima di eliminare */
  sessions: number;
  crumbs: Project[];
  initial?: Panel;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { services, version, changed } = useApp();
  const [panel, setPanel] = useState<Panel>(p.initial ?? null);
  const [moving, setMoving] = useState(false);
  if (!services) return null;
  const repo = services.projects;
  const { me } = p;
  const today = localToday();
  const kids = childrenOf(p.all, me.uuid);
  const siblings = childrenOf(p.all, me.parent_uuid);
  const patch = (x: Parameters<typeof repo.update>[1]) => {
    repo.update(me.uuid, x);
    changed();
  };
  const parentName = p.crumbs.length
    ? p.crumbs[p.crumbs.length - 1]!.name
    : t('progetti.livello_principale');
  const moveCandidates = p.all.filter(
    (x) => x.uuid !== me.uuid && !subtreeOf(p.all, me.uuid).includes(x.uuid),
  );
  const hasDecks = !!services.flashcards;

  const title: Record<Exclude<Panel, null>, string> = {
    color: t('progetti.colore'),
    due: t('progetti.scadenza'),
    target: t('progetti.data_obiettivo'),
    deck: t('progetti.flashcard'),
    note: t('progetti.nota'),
    parent: t('progetti.sposta_in'),
    order: t('progetti.trascina_riordinare'),
    delete: t('progetti.elimina_progetto'),
  };

  const rows: {
    key: string;
    icon: PjIconName;
    label: string;
    value?: string;
    on?: Panel;
    toggle?: { value: boolean; set: (v: boolean) => void };
    dot?: string;
    show?: boolean;
  }[] = [
    { key: 'color', icon: 'palette', label: t('progetti.colore'), dot: me.color, on: 'color' },
    {
      key: 'fav',
      icon: 'star-line',
      label: t('progetti.preferito'),
      toggle: { value: !!me.is_favorite, set: (v) => patch({ is_favorite: v }) },
    },
    {
      key: 'due',
      icon: 'calendar',
      label: t('progetti.scadenza'),
      value: me.due_date ? shortDate(me.due_date, t, today) : t('progetti.aggiungi_valore'),
      on: 'due',
    },
    {
      key: 'target',
      icon: 'target',
      label: t('progetti.data_obiettivo'),
      value: me.target_date ? shortDate(me.target_date, t, today) : t('progetti.aggiungi_valore'),
      on: 'target',
    },
    {
      key: 'deck',
      icon: 'folder',
      label: t('progetti.flashcard'),
      value: t('progetti.collega'),
      on: 'deck',
      show: hasDecks,
    },
    {
      key: 'note',
      icon: 'note',
      label: t('progetti.nota'),
      value: me.notes ? t('comune.modifica') : t('progetti.aggiungi_valore'),
      on: 'note',
    },
    {
      key: 'todo',
      icon: 'checks',
      label: t('progetti.attivita'),
      toggle: { value: !!me.todo_enabled, set: (v) => patch({ todo_enabled: v }) },
    },
    {
      key: 'parent',
      icon: 'move',
      label: t('progetti.sposta_in'),
      value: parentName,
      on: 'parent',
    },
    {
      key: 'order',
      icon: 'list',
      label: t('progetti.trascina_riordinare'),
      on: 'order',
      show: siblings.length > 1,
    },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={p.onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.42)' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comune.chiudi')}
          style={StyleSheet.absoluteFill}
          onPress={p.onClose}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            testID="proj-menu-sheet"
            style={{
              backgroundColor: th.surface,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              maxHeight: height * 0.9,
              paddingBottom: Math.max(insets.bottom, 14),
            }}
          >
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View
                style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: th.hairline2 }}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 34,
                paddingHorizontal: 16,
              }}
            >
              {panel ? (
                <Pressable
                  testID="proj-menu-back"
                  accessibilityRole="button"
                  accessibilityLabel={t('comune.indietro')}
                  onPress={() => {
                    setPanel(null);
                    setMoving(false);
                  }}
                  hitSlop={10}
                  style={{ position: 'absolute', left: 14 }}
                >
                  <PjIcon name="back" color={th.brand} size={22} width={2.2} />
                </Pressable>
              ) : null}
              <Text
                numberOfLines={1}
                style={{ color: th.text2, fontSize: 13.5, fontWeight: '600' }}
              >
                {panel ? title[panel] : me.name}
              </Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 12 }}
            >
              {panel === null ? (
                <>
                  <View
                    style={{ backgroundColor: th.surface2, borderRadius: 14, overflow: 'hidden' }}
                  >
                    {rows
                      .filter((r) => r.show !== false)
                      .map((r, i) => (
                        <Pressable
                          key={r.key}
                          testID={`proj-menu-${r.key}`}
                          accessibilityRole={r.toggle ? 'switch' : 'button'}
                          accessibilityState={r.toggle ? { checked: r.toggle.value } : undefined}
                          onPress={() =>
                            r.toggle ? r.toggle.set(!r.toggle.value) : setPanel(r.on ?? null)
                          }
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            minHeight: 48,
                            paddingHorizontal: 14,
                          }}
                        >
                          {i ? (
                            <View
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 48,
                                right: 0,
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: th.hairline,
                              }}
                            />
                          ) : null}
                          <View style={{ width: 22, alignItems: 'center' }}>
                            <PjIcon name={r.icon} color={th.text2} size={19} />
                          </View>
                          <Text style={{ color: th.text, fontSize: 16, flex: 1 }}>{r.label}</Text>
                          {r.dot ? (
                            <View
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                backgroundColor: r.dot,
                              }}
                            />
                          ) : null}
                          {r.value ? (
                            <Text
                              numberOfLines={1}
                              style={{ color: th.text2, fontSize: 15, maxWidth: 150 }}
                            >
                              {r.value}
                            </Text>
                          ) : null}
                          {r.toggle ? (
                            <Switch
                              testID={`proj-menu-${r.key}-switch`}
                              value={r.toggle.value}
                              onValueChange={r.toggle.set}
                              trackColor={{ true: th.green }}
                            />
                          ) : null}
                        </Pressable>
                      ))}
                  </View>
                  <Pressable
                    testID="proj-menu-delete"
                    accessibilityRole="button"
                    onPress={() => setPanel('delete')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 48,
                      paddingHorizontal: 14,
                      backgroundColor: th.surface2,
                      borderRadius: 14,
                    }}
                  >
                    <View style={{ width: 22, alignItems: 'center' }}>
                      <PjIcon name="trash" color={th.red} size={19} />
                    </View>
                    <Text style={{ color: th.red, fontSize: 16 }}>
                      {t('progetti.elimina_progetto')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {panel === 'color' ? (
                <View style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ color: th.text, flex: 1 }}>
                      {me.color_edited
                        ? t('progetti.colore_personalizzato')
                        : p.crumbs.length
                          ? t('progetti.colore_auto_padre')
                          : t('progetti.colore_automatico')}
                    </Text>
                    <Switch
                      testID="proj-color-auto"
                      value={!me.color_edited}
                      onValueChange={(auto) => patch({ color: auto ? null : me.color })}
                      trackColor={{ true: th.brand }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {SWATCHES.map((c) => (
                      <Pressable
                        hitSlop={5}
                        key={c}
                        testID={`swatch-${c.slice(1)}`}
                        accessibilityRole="button"
                        onPress={() => patch({ color: c })}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: c,
                          borderWidth: me.color_edited && me.color.toUpperCase() === c ? 3 : 0,
                          borderColor: th.text,
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {panel === 'due' || panel === 'target' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: th.text2 }}>
                    {panel === 'due' ? t('progetti.data_scadenza') : t('progetti.data_obiettivo')}
                  </Text>
                  <DateTimeField
                    kind="date"
                    testID={panel === 'due' ? 'proj-due' : 'proj-target'}
                    value={(panel === 'due' ? me.due_date : me.target_date) ?? ''}
                    fallback={today}
                    placeholder="—"
                    clearable
                    onChange={(v) =>
                      patch(panel === 'due' ? { due_date: v || null } : { target_date: v || null })
                    }
                  />
                </View>
              ) : null}

              {panel === 'deck' && services.flashcards ? (
                <View style={{ marginHorizontal: -16 }}>
                  <ProjectDeckCard
                    repo={services.flashcards}
                    projects={p.all}
                    project={me.uuid}
                    version={version}
                    changed={changed}
                  />
                </View>
              ) : null}

              {panel === 'note' ? <NoteEditor me={me} onDone={changed} /> : null}

              {panel === 'parent' ? (
                <View style={{ gap: 10 }}>
                  <Pressable
                    testID="proj-move"
                    accessibilityRole="button"
                    onPress={() => setMoving(!moving)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                  >
                    <Text style={{ color: th.text2 }}>{t('progetti.progetto_padre')}</Text>
                    <Text style={{ color: th.brand }}>{parentName} ›</Text>
                  </Pressable>
                  <ProjectPicker
                    projects={moveCandidates}
                    value={me.parent_uuid ?? 'root'}
                    hideNone
                    extras={[{ id: 'root', label: t('progetti.livello_principale') }]}
                    onPick={(target) => {
                      repo.move(me.uuid, target === 'root' || !target ? null : target);
                      changed();
                      p.onClose();
                    }}
                  />
                </View>
              ) : null}

              {panel === 'order' ? (
                <ReorderList
                  items={siblings.map((s) => ({ key: s.uuid, s }))}
                  rowHeight={48}
                  gap={6}
                  gripColor={th.text2}
                  onReorder={(from, to) => {
                    const next = reorderKeys(
                      siblings.map((s) => s.uuid),
                      from,
                      to,
                    );
                    repo.reorder(next[to]!, next[to - 1] ?? null, next[to + 1] ?? null);
                    changed();
                  }}
                  renderRow={({ s }, grip) => (
                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingLeft: 12,
                        borderRadius: 12,
                        backgroundColor: th.bg,
                        borderWidth: s.uuid === me.uuid ? 1.5 : 0,
                        borderColor: th.brand,
                      }}
                    >
                      <View
                        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }}
                      />
                      <Text style={{ color: th.text, flex: 1 }} numberOfLines={1}>
                        {s.name}
                      </Text>
                      {grip}
                    </View>
                  )}
                />
              ) : null}

              {panel === 'delete' ? (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
                    {t('progetti.eliminare_questo_progetto')}
                  </Text>
                  {kids.length ? (
                    <Text style={{ color: th.text2 }}>{t('progetti.progetto_ha_sotto')}</Text>
                  ) : null}
                  <Text style={{ color: th.text2 }}>
                    {t('progetti.questa_azione_non_puo_essere')}
                  </Text>
                  {p.sessions ? (
                    <>
                      <Text style={{ color: th.text2 }}>
                        {kids.length
                          ? t('progetti.eliminare_pomodori_con_sotto')
                          : t('progetti.eliminare_anche_pomodori')}
                      </Text>
                      <PrimaryButton
                        testID="proj-del-all"
                        danger
                        label={t('progetti.elimina_anche_pomodori')}
                        onPress={() => {
                          repo.remove(me.uuid, true);
                          changed();
                          p.onDeleted();
                        }}
                      />
                      <PrimaryButton
                        testID="proj-del-keep"
                        danger
                        label={t('progetti.mantieni_pomodori')}
                        onPress={() => {
                          repo.remove(me.uuid, false);
                          changed();
                          p.onDeleted();
                        }}
                      />
                    </>
                  ) : (
                    <PrimaryButton
                      testID="proj-del-yes"
                      danger
                      label={t('progetti.elimina_progetto')}
                      onPress={() => {
                        repo.remove(me.uuid, false);
                        changed();
                        p.onDeleted();
                      }}
                    />
                  )}
                  <TextButton label={t('comune.annulla')} onPress={() => setPanel(null)} />
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** I discendenti di un progetto, per non poterlo spostare dentro se stesso. */
function subtreeOf(all: Project[], uuid: string): string[] {
  const out: string[] = [];
  const stack = [uuid];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const x of all) if (x.parent_uuid === id) stack.push(x.uuid);
  }
  return out;
}

/** La nota: testo semplice (si scrive da qui) o documento con formato (editor ricco). Si salva da sola mentre si scrive. */
function NoteEditor({ me, onDone }: { me: Project; onDone: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const { services } = useApp();
  const [note, setNote] = useState<string | null>(null);
  const rich = isRichNote(me.notes);
  useAutosave(note, (text) => {
    // una nota con formato è un documento: tagliata a metà si romperebbe, quindi oltre il limite non si salva
    if (services && text.length <= NOTE_MAX) services.projects.update(me.uuid, { notes: text });
  });
  const save = () => {
    if (note !== null && !rich && services) services.projects.update(me.uuid, { notes: note });
    setNote(null);
    onDone();
  };
  return rich ? (
    <View style={{ gap: 8 }}>
      <RichEditor
        testID="proj-note-rich"
        value={me.notes}
        placeholder={t('progetti.note_placeholder')}
        onChange={(field) => setNote(field ?? '')}
      />
      {note !== null && note.length > NOTE_MAX ? (
        <Text testID="proj-note-long" style={{ color: th.red, fontSize: 12 }}>
          {t('progetti.app_nota_troppo_lunga')}
        </Text>
      ) : null}
      <Text style={{ color: th.text3, fontSize: 12 }}>
        {noteText(me.notes).length} / {NOTE_MAX}
      </Text>
    </View>
  ) : (
    <TextInput
      testID="proj-note"
      value={note ?? me.notes}
      onChangeText={setNote}
      onBlur={save}
      multiline
      placeholder={t('progetti.note_placeholder')}
      placeholderTextColor={th.text3}
      style={{
        color: th.text,
        fontSize: 15,
        minHeight: 140,
        textAlignVertical: 'top',
        backgroundColor: th.bg,
        borderRadius: 12,
        padding: 12,
      }}
    />
  );
}
