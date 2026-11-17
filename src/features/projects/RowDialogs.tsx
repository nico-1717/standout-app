import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { subtreeIds, type Project } from './logic';
import { ProjectSheet } from './ProjectSheet';
import type { ProjectsRepo } from './repo';

/** Cosa si sta facendo con la riga scorsa: spostarla o eliminarla (l'aggiunta di un sotto-progetto sta nella lista). */
export type RowAction = { kind: 'move' | 'delete'; id: string } | null;

/**
 * I due fogli dei tasti della riga, come sul sito: «Sposta in…» (il selettore con «Livello principale», senza il
 * progetto stesso e i suoi figli) ed «Elimina» in due passi: prima il progetto, poi cosa fare dei pomodori collegati.
 */
export function RowDialogs(p: {
  repo: ProjectsRepo;
  all: Project[];
  action: RowAction;
  onClose: () => void;
  /** è cambiato qualcosa: la pagina rilegge i dati */
  changed: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [keeping, setKeeping] = useState(false);
  const target = p.action ? p.all.find((x) => x.uuid === p.action!.id) : undefined;
  const ids = target ? subtreeIds(p.all, target.uuid) : [];
  const hasChildren = ids.length > 1;
  const sessions = p.action?.kind === 'delete' ? p.repo.sessionCount(ids) : 0;

  const close = () => {
    setKeeping(false);
    p.onClose();
  };
  const remove = (withSessions: boolean) => {
    if (target) p.repo.remove(target.uuid, withSessions);
    close();
    p.changed();
  };

  if (p.action?.kind === 'move' && target) {
    return (
      <ProjectSheet
        visible
        title={t('progetti.sposta_in')}
        projects={p.all.filter((x) => !ids.includes(x.uuid))}
        value={target.parent_uuid ?? 'root'}
        noneLabel={false}
        extras={[{ id: 'root', label: t('progetti.livello_principale') }]}
        onPick={(to) => {
          if (!p.repo.move(target.uuid, to === 'root' || !to ? null : to)) return;
          close();
          p.changed();
        }}
        onClose={close}
      />
    );
  }

  if (p.action?.kind !== 'delete' || !target) return null;

  const plain = `${hasChildren ? t('progetti.progetto_ha_sotto') : ''}${t('progetti.questa_azione_non_puo_essere')}`;
  const asking = `${hasChildren ? t('progetti.progetto_ha_sotto') : ''}${t(
    hasChildren ? 'progetti.eliminare_pomodori_con_sotto' : 'progetti.eliminare_anche_pomodori',
  )}`;
  const orphans = `${t('progetti.avviso_pomodori_orfani', { progetto: target.name })} ${t(
    hasChildren ? 'progetti.pomodori_orfani_con_sotto' : 'progetti.pomodori_orfani',
  )}`;
  const title = keeping
    ? t('progetti.pomodori_senza_progetto')
    : t('progetti.eliminare_questo_progetto');
  const message = keeping ? orphans : sessions ? asking : plain;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comune.annulla')}
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
        <View
          testID="row-delete-confirm"
          style={[styles.card, { backgroundColor: th.surface, gap: 12 }]}
        >
          <Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
          <Text testID="row-delete-message" style={{ color: th.text2, fontSize: 14.5 }}>
            {message}
          </Text>
          {keeping || !sessions ? (
            <PrimaryButton
              testID="row-delete-yes"
              danger
              label={t('comune.elimina')}
              onPress={() => remove(false)}
            />
          ) : (
            <>
              <PrimaryButton
                testID="row-delete-all"
                danger
                label={t('progetti.elimina_anche_pomodori')}
                onPress={() => remove(true)}
              />
              <PrimaryButton
                testID="row-delete-keep"
                label={t('progetti.mantieni_pomodori')}
                onPress={() => setKeeping(true)}
              />
            </>
          )}
          <TextButton testID="row-delete-cancel" label={t('comune.annulla')} onPress={close} />
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
});
