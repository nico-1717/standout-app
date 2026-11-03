import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { human } from '@/features/pomodoro/logic';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { ancestors, byId, childrenOf, subtreeIds, type Project } from '@/features/projects/logic';
import { isRichNote, noteText } from '@/features/projects/notes';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { ReorderList, reorderKeys } from '@/ui/ReorderList';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

/** Le dodici tinte del sito (progetti.php, $prColorPalette). */
const SWATCHES = [
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
const STATUS_KEY = {
  in_progress: 'progetti.in_corso',
  completed: 'progetti.fatto',
  planned: 'progetti.future',
} as const;

/** La scheda di un progetto: nome, stato, colore, date, nota, sotto-progetti, spostamento, Pomodoro, eliminazione. */
export default function ProjectScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, version, changed } = useApp();

  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sub, setSub] = useState('');
  const [moving, setMoving] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const data = useMemo(() => {
    void version;
    if (!services || typeof id !== 'string') return null;
    const all = services.projects.all();
    const me = all.find((p) => p.uuid === id);
    if (!me) return null;
    const ids = subtreeIds(all, id);
    return {
      all,
      me,
      ids,
      kids: childrenOf(all, id),
      siblings: childrenOf(all, me.parent_uuid),
      crumbs: ancestors(byId(all), id),
      secs: services.projects.totals().get(id) ?? 0,
      sessions: services.projects.sessionCount(ids),
    };
  }, [services, version, id]);

  if (!services || typeof id !== 'string') return null;
  if (!data) {
    // il progetto non c'è (più): si torna all'elenco
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 40, padding: 24 }}>
        <TextButton
          testID="proj-gone-back"
          label={t('comune.indietro')}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  const { me, all, kids } = data;
  const repo = services.projects;
  const open = (p: Project) => router.push({ pathname: '/project', params: { id: p.uuid } });
  const rich = isRichNote(me.notes);

  const saveName = () => {
    if (name !== null) repo.update(id, { name });
    setName(null);
    changed();
  };
  const saveNote = () => {
    if (note !== null && !rich) repo.update(id, { notes: note });
    setNote(null);
    changed();
  };
  const patch = (p: Parameters<typeof repo.update>[1]) => {
    repo.update(id, p);
    changed();
  };
  const remove = (withSessions: boolean) => {
    repo.remove(id, withSessions);
    changed();
    router.back();
  };

  const moveCandidates = all.filter((p) => !data.ids.includes(p.uuid));

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={me.name}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="proj-fav"
              accessibilityRole="button"
              accessibilityLabel={
                me.is_favorite
                  ? t('progetti.togli_dai_preferiti')
                  : t('progetti.metti_tra_i_preferiti')
              }
              onPress={() => patch({ is_favorite: !me.is_favorite })}
            >
              <Text style={{ color: me.is_favorite ? th.orange : th.text3, fontSize: 20 }}>
                {me.is_favorite ? '★' : '☆'}
              </Text>
            </Pressable>
            <Pressable testID="proj-back" accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {data.crumbs.length ? (
          <Text style={{ color: th.text2 }} numberOfLines={2}>
            {data.crumbs.map((c, i) => (
              <Text key={c.uuid} testID={`crumb-${c.uuid}`} onPress={() => open(c)}>
                {i ? ' › ' : ''}
                {c.name}
              </Text>
            ))}
          </Text>
        ) : null}

        <Card style={{ padding: 16, gap: 12 }}>
          <TextInput
            testID="proj-name"
            value={name ?? me.name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            placeholder={t('progetti.nome')}
            placeholderTextColor={th.text3}
            style={{ color: th.text, fontSize: 22, fontWeight: '700' }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              testID="proj-status"
              accessibilityRole="button"
              accessibilityLabel={t('progetti.cambia_stato')}
              onPress={() => {
                repo.cycleStatus(id);
                changed();
              }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: me.color,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t(STATUS_KEY[me.status])}</Text>
            </Pressable>
            {data.secs ? (
              <Text testID="proj-time" style={{ color: th.text2 }}>
                {t('progetti.durata_totale', { durata: human(data.secs) })}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="proj-start"
                label={t('progetti.avvia_pomodoro')}
                onPress={() => router.push({ pathname: '/pomodoro', params: { project: id } })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextButton
                testID="proj-sessions"
                label={`${t('progetti.pomodori')} ›`}
                onPress={() =>
                  router.push({ pathname: '/pomodoro-history', params: { project: id } })
                }
              />
            </View>
          </View>
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <SectionLabel>{t('progetti.nota')}</SectionLabel>
          {rich ? (
            <>
              <Text testID="proj-note-rich" style={{ color: th.text }}>
                {noteText(me.notes) || t('progetti.nota_vuota')}
              </Text>
              <Text style={{ color: th.text2, fontSize: 12 }}>{t('progetti.nota_formattata')}</Text>
            </>
          ) : (
            <TextInput
              testID="proj-note"
              value={note ?? me.notes}
              onChangeText={setNote}
              onBlur={saveNote}
              multiline
              placeholder={t('progetti.note_placeholder')}
              placeholderTextColor={th.text3}
              style={{ color: th.text, fontSize: 15, minHeight: 80, textAlignVertical: 'top' }}
            />
          )}
        </Card>

        <Card style={{ padding: 16, gap: 12 }}>
          <SectionLabel>{t('progetti.scadenze_e_obiettivi')}</SectionLabel>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: th.text2 }}>{t('progetti.data_obiettivo')}</Text>
            <DateTimeField
              kind="date"
              testID="proj-target"
              value={me.target_date ?? ''}
              fallback={localToday()}
              placeholder="—"
              clearable
              onChange={(v) => patch({ target_date: v || null })}
            />
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: th.text2 }}>{t('progetti.data_scadenza')}</Text>
            <DateTimeField
              kind="date"
              testID="proj-due"
              value={me.due_date ?? ''}
              fallback={localToday()}
              placeholder="—"
              clearable
              onChange={(v) => patch({ due_date: v || null })}
            />
          </View>
        </Card>

        <Card style={{ padding: 16, gap: 12 }}>
          <SectionLabel>{t('progetti.colore')}</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: th.text, flex: 1 }}>
              {me.color_edited
                ? t('progetti.colore_personalizzato')
                : data.crumbs.length
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {SWATCHES.map((c) => (
              <Pressable
                key={c}
                testID={`swatch-${c.slice(1)}`}
                accessibilityRole="button"
                onPress={() => patch({ color: c })}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: c,
                  borderWidth: me.color_edited && me.color.toUpperCase() === c ? 3 : 0,
                  borderColor: th.text,
                }}
              />
            ))}
          </View>
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <SectionLabel>{t('progetti.sotto_progetti')}</SectionLabel>
          {kids.length === 0 ? (
            <Text style={{ color: th.text2 }}>
              {t('progetti.nessun_sotto_progetto_aggiungine_uno')}
            </Text>
          ) : (
            kids.map((k) => (
              <Pressable
                key={k.uuid}
                testID={`kid-${k.uuid}`}
                accessibilityRole="button"
                onPress={() => open(k)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
              >
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.color }}
                />
                <Text style={{ color: th.text, flex: 1 }}>{k.name}</Text>
                <Text style={{ color: th.text3 }}>›</Text>
              </Pressable>
            ))
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              testID="proj-sub"
              value={sub}
              onChangeText={setSub}
              placeholder={t('progetti.nome_nuovo_sotto')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (repo.create({ name: sub, parent: id })) {
                  setSub('');
                  changed();
                }
              }}
              style={{
                flex: 1,
                backgroundColor: th.surface2,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 9,
                color: th.text,
              }}
            />
          </View>
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <Pressable
            testID="proj-move"
            accessibilityRole="button"
            onPress={() => setMoving(!moving)}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text style={{ color: th.text2 }}>{t('progetti.progetto_padre')}</Text>
            <Text style={{ color: th.brand }}>
              {data.crumbs.length
                ? data.crumbs[data.crumbs.length - 1]!.name
                : t('progetti.livello_principale')}{' '}
              ›
            </Text>
          </Pressable>
          {moving ? (
            <ProjectPicker
              projects={moveCandidates}
              value={me.parent_uuid ?? 'root'}
              hideNone
              extras={[{ id: 'root', label: t('progetti.livello_principale') }]}
              onPick={(target) => {
                repo.move(id, target === 'root' || !target ? null : target);
                setMoving(false);
                changed();
              }}
            />
          ) : null}
          {data.siblings.length > 1 ? (
            <>
              <Pressable
                testID="proj-order"
                accessibilityRole="button"
                onPress={() => setOrdering(!ordering)}
              >
                <Text style={{ color: th.brand }}>{t('progetti.trascina_riordinare')}</Text>
              </Pressable>
              {ordering ? (
                <ReorderList
                  items={data.siblings.map((s) => ({ key: s.uuid, s }))}
                  rowHeight={48}
                  gap={6}
                  gripColor={th.text2}
                  onReorder={(from, to) => {
                    const next = reorderKeys(
                      data.siblings.map((s) => s.uuid),
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
                        backgroundColor: th.surface2,
                        borderWidth: s.uuid === id ? 1.5 : 0,
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
            </>
          ) : null}
        </Card>

        {deleting ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
              {t('progetti.eliminare_questo_progetto')}
            </Text>
            {kids.length ? (
              <Text style={{ color: th.text2 }}>{t('progetti.progetto_ha_sotto')}</Text>
            ) : null}
            <Text style={{ color: th.text2 }}>{t('progetti.questa_azione_non_puo_essere')}</Text>
            {data.sessions ? (
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
                  onPress={() => remove(true)}
                />
                <PrimaryButton
                  testID="proj-del-keep"
                  danger
                  label={t('progetti.mantieni_pomodori')}
                  onPress={() => remove(false)}
                />
              </>
            ) : (
              <PrimaryButton
                testID="proj-del-yes"
                danger
                label={t('progetti.elimina_progetto')}
                onPress={() => remove(false)}
              />
            )}
            <TextButton label={t('comune.annulla')} onPress={() => setDeleting(false)} />
          </Card>
        ) : (
          <TextButton
            testID="proj-delete"
            danger
            label={t('progetti.elimina_progetto')}
            onPress={() => setDeleting(true)}
          />
        )}
      </ScrollView>
    </View>
  );
}
