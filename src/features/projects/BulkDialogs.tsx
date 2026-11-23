import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { CustomColor } from './CustomColor';
import { subtreeIds, type Project } from './logic';
import { ProjectSheet } from './ProjectSheet';
import type { ProjectsRepo } from './repo';

export type BulkAction = 'color' | 'parent' | 'delete' | null;

/**
 * I tre fogli della barra della selezione, come sul sito: «Cambia colore» (la griglia dei colori), «Progetto padre» (il
 * selettore) ed «Elimina» in due passi (prima i progetti, poi cosa fare dei pomodori collegati).
 */
export function BulkDialogs(p: {
  repo: ProjectsRepo;
  all: Project[];
  picked: string[];
  action: BulkAction;
  swatches: string[];
  onClose: () => void;
  /** finito: la selezione si chiude e la pagina rilegge i dati */
  onDone: () => void;
  /** «Vai ai pomodori» del secondo passo dell'eliminazione */
  onGoPomodoros: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [keeping, setKeeping] = useState(false);
  const subtree = p.picked.flatMap((id) => subtreeIds(p.all, id));
  const close = () => {
    setKeeping(false);
    p.onClose();
  };

  if (p.action === 'parent') {
    return (
      <ProjectSheet
        visible
        title={t('progetti.progetto_padre')}
        projects={p.all.filter((x) => !subtree.includes(x.uuid))}
        value="root"
        noneLabel={false}
        extras={[{ id: 'root', label: t('progetti.livello_principale') }]}
        onPick={(to) => {
          for (const id of p.picked) p.repo.move(id, to === 'root' || !to ? null : to);
          close();
          p.onDone();
        }}
        onClose={close}
      />
    );
  }

  if (p.action !== 'color' && p.action !== 'delete') return null;

  const hasChildren = p.picked.some((id) => p.all.some((x) => x.parent_uuid === id));
  const sessions = p.action === 'delete' ? p.repo.sessionCount(subtree) : 0;
  const remove = (withSessions: boolean) => {
    for (const id of p.picked) p.repo.remove(id, withSessions);
    close();
    p.onDone();
  };
  const paint = (color: string | null) => {
    for (const id of p.picked) p.repo.update(id, { color });
    close();
    p.onDone();
  };

  const n = p.picked.length;
  const lead = hasChildren ? t('progetti.alcuni_hanno_sotto') : '';
  const title =
    p.action === 'color'
      ? t('progetti.cambia_colore')
      : keeping
        ? t('progetti.pomodori_senza_progetto')
        : n === 1
          ? t('progetti.eliminare_n_sotto_1')
          : t('progetti.eliminare_n_sotto', { n });
  const message =
    p.action === 'color'
      ? t('progetti.si_applica_a_tutti_i')
      : keeping
        ? t('progetti.sotto_bulk_orfani')
        : `${lead}${t(sessions ? 'progetti.eliminare_anche_pomodori' : 'progetti.questa_azione_non_puo_essere')}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comune.annulla')}
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
        <View testID="bulk-dialog" style={[styles.card, { backgroundColor: th.surface, gap: 12 }]}>
          <Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
          <Text testID="bulk-message" style={{ color: th.text2, fontSize: 14.5 }}>
            {message}
          </Text>

          {p.action === 'color' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Pressable
                  testID="sub-color-auto"
                  accessibilityRole="button"
                  accessibilityLabel={t('progetti.automatico_dal_padre_2')}
                  hitSlop={5}
                  onPress={() => paint(null)}
                  style={[styles.swatch, { backgroundColor: th.surface2 }]}
                >
                  <Text style={{ color: th.text2, fontWeight: '800' }}>A</Text>
                </Pressable>
                {p.swatches.map((c) => (
                  <Pressable
                    key={c}
                    testID={`sub-color-${c.slice(1)}`}
                    accessibilityRole="button"
                    hitSlop={5}
                    onPress={() => paint(c)}
                    style={[styles.swatch, { backgroundColor: c }]}
                  />
                ))}
              </View>
              <CustomColor value={p.swatches[0] ?? '#8E8E93'} onPick={(hex) => paint(hex)} />
            </>
          ) : keeping || !sessions ? (
            <>
              {keeping ? (
                <PrimaryButton
                  testID="sub-del-go"
                  label={t('progetti.vai_ai_pomodori')}
                  onPress={() => {
                    close();
                    p.onGoPomodoros();
                  }}
                />
              ) : null}
              <PrimaryButton
                testID="sub-del-yes"
                danger
                label={keeping ? t('progetti.elimina_comunque') : t('comune.elimina')}
                onPress={() => remove(false)}
              />
            </>
          ) : (
            <>
              <PrimaryButton
                testID="sub-del-all"
                danger
                label={t('progetti.elimina_anche_pomodori')}
                onPress={() => remove(true)}
              />
              <PrimaryButton
                testID="sub-del-keep"
                label={t('progetti.mantieni_pomodori')}
                onPress={() => setKeeping(true)}
              />
            </>
          )}
          <TextButton testID="sub-dialog-cancel" label={t('comune.annulla')} onPress={close} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,.4)',
  },
  card: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 20 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
