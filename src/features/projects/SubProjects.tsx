import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { ProjectPicker } from './ProjectPicker';
import { subtreeIds, type Project } from './logic';
import type { ProjectsRepo } from './repo';

type Panel = 'color' | 'parent' | 'delete' | null;

/**
 * L'elenco dei sotto-progetti nella scheda di un progetto, con la selezione multipla del sito: si scelgono più
 * sotto-progetti e si cambia il colore, si spostano sotto un altro progetto o si eliminano tutti insieme.
 */
export function SubProjects(p: {
  repo: ProjectsRepo;
  all: Project[];
  kids: Project[];
  swatches: string[];
  onOpen: (project: Project) => void;
  changed: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>(null);

  const stop = () => {
    setSelecting(false);
    setPicked([]);
    setPanel(null);
  };
  const toggle = (uuid: string) =>
    setPicked((cur) => (cur.includes(uuid) ? cur.filter((x) => x !== uuid) : [...cur, uuid]));
  const allOn = picked.length === p.kids.length && p.kids.length > 0;
  const done = () => {
    stop();
    p.changed();
  };
  const open = (which: Panel) => {
    if (!picked.length) return;
    setPanel(panel === which ? null : which);
  };

  if (!p.kids.length) return null;

  const subtree = picked.flatMap((id) => subtreeIds(p.all, id));
  const sessions = panel === 'delete' ? p.repo.sessionCount(subtree) : 0;
  const hasChildren = picked.some((id) => p.all.some((x) => x.parent_uuid === id));
  const targets = p.all.filter((x) => !subtree.includes(x.uuid));
  const remove = (withSessions: boolean) => {
    for (const id of picked) p.repo.remove(id, withSessions);
    done();
  };

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        testID="sub-select-toggle"
        accessibilityRole="button"
        onPress={() => (selecting ? stop() : setSelecting(true))}
      >
        <Text style={{ color: th.brand }}>
          {selecting ? t('comune.annulla') : t('progetti.seleziona_sotto_progetti')}
        </Text>
      </Pressable>

      {p.kids.map((k) => {
        const on = picked.includes(k.uuid);
        return (
          <Pressable
            key={k.uuid}
            testID={`kid-${k.uuid}`}
            accessibilityRole={selecting ? 'checkbox' : 'button'}
            accessibilityState={selecting ? { checked: on } : undefined}
            onPress={() => (selecting ? toggle(k.uuid) : p.onOpen(k))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
          >
            {selecting ? (
              <Text style={{ color: on ? th.brand : th.text2, fontSize: 20 }}>
                {on ? '☑' : '☐'}
              </Text>
            ) : null}
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.color }} />
            <Text style={{ color: th.text, flex: 1 }}>{k.name}</Text>
            {selecting ? null : <Text style={{ color: th.text3 }}>›</Text>}
          </Pressable>
        );
      })}

      {selecting ? (
        <View style={{ gap: 10 }}>
          <Text testID="sub-count" style={{ color: th.text2 }}>
            {picked.length === 0
              ? t('progetti.0_selezionati')
              : t(picked.length === 1 ? 'progetti.n_selezionato' : 'progetti.n_selezionati', {
                  n: picked.length,
                })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <TextButton
              testID="sub-all"
              label={allOn ? t('progetti.deseleziona_tutti') : t('progetti.seleziona_tutti')}
              onPress={() => setPicked(allOn ? [] : p.kids.map((k) => k.uuid))}
            />
            <TextButton
              testID="sub-bulk-color"
              label={t('progetti.colore')}
              onPress={() => open('color')}
            />
            <TextButton
              testID="sub-bulk-parent"
              label={t('progetti.progetto_padre')}
              onPress={() => open('parent')}
            />
            <TextButton
              testID="sub-bulk-delete"
              danger
              label={t('comune.elimina')}
              onPress={() => open('delete')}
            />
          </View>

          {panel === 'color' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pressable
                testID="sub-color-auto"
                accessibilityRole="button"
                accessibilityLabel={t('progetti.colore_auto_padre')}
                onPress={() => {
                  for (const id of picked) p.repo.update(id, { color: null });
                  done();
                }}
                style={{
                  height: 34,
                  borderRadius: 17,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  backgroundColor: th.surface2,
                }}
              >
                <Text style={{ color: th.text }}>{t('progetti.colore_auto_padre')}</Text>
              </Pressable>
              {p.swatches.map((c) => (
                <Pressable
                  key={c}
                  testID={`sub-color-${c.slice(1)}`}
                  accessibilityRole="button"
                  onPress={() => {
                    for (const id of picked) p.repo.update(id, { color: c });
                    done();
                  }}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c }}
                />
              ))}
            </View>
          ) : null}

          {panel === 'parent' ? (
            <ProjectPicker
              projects={targets}
              value="none"
              hideNone
              extras={[{ id: 'root', label: t('progetti.livello_principale') }]}
              onPick={(target) => {
                const to = target === 'root' || !target ? null : target;
                for (const id of picked) p.repo.move(id, to);
                done();
              }}
            />
          ) : null}

          {panel === 'delete' ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: th.text, fontWeight: '700', fontSize: 17 }}>
                {picked.length === 1
                  ? t('progetti.eliminare_n_sotto_1')
                  : t('progetti.eliminare_n_sotto', { n: picked.length })}
              </Text>
              <Text style={{ color: th.text2 }}>
                {hasChildren ? t('progetti.alcuni_hanno_sotto') : ''}
                {sessions ? t('progetti.eliminare_anche_pomodori') : ''}
                {!sessions ? t('progetti.questa_azione_non_puo_essere') : ''}
              </Text>
              {sessions ? (
                <>
                  <PrimaryButton
                    testID="sub-del-all"
                    danger
                    label={t('progetti.elimina_anche_pomodori')}
                    onPress={() => remove(true)}
                  />
                  <PrimaryButton
                    testID="sub-del-keep"
                    danger
                    label={t('progetti.mantieni_pomodori')}
                    onPress={() => remove(false)}
                  />
                </>
              ) : (
                <PrimaryButton
                  testID="sub-del-yes"
                  danger
                  label={t('comune.elimina')}
                  onPress={() => remove(false)}
                />
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
