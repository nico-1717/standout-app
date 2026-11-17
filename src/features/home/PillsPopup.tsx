import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { mix } from '@/features/buy/buyTheme';
import type { DoseView } from '@/features/pills/repo';
import { SettleCard, TickButton, useSettling } from '@/features/pills/settle';
import { HoIcon, type Ho } from './HomeKit';

const system = ReduceMotion.System;

/**
 * Il popup delle pillole della Home (home_w_plan.js, `openPills`): solo le prese in ritardo, una riga ciascuna con
 * «Salta» a sinistra e la spunta a destra, «Tutte prese» quando sono più di una e «Apri pillole» in fondo.
 * La presa segnata resta un attimo «fatta» e poi esce piano (come nella pagina Pillole).
 */
export function PillsPopup({
  ho,
  doses,
  today,
  weekday,
  onPill,
  onTakeAll,
  onOpenPills,
  onClose,
}: {
  ho: Ho;
  doses: DoseView[];
  /** oggi (AAAA-MM-GG): una presa di un giorno scorso è «arretrata» e si dice il giorno oltre all'ora */
  today: string;
  /** il giorno della settimana in breve per una presa arretrata (data → «lun») */
  weekday: (date: string) => string;
  onPill: (d: DoseView, how: 'taken' | 'skipped') => void;
  onTakeAll: (uuids: string[]) => void;
  onOpenPills: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { rows, settle } = useSettling(doses);
  const open = rows.filter((r) => r.how === null);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(180).reduceMotion(system)}
        exiting={FadeOut.duration(140).reduceMotion(system)}
        style={[
          styles.veil,
          { backgroundColor: ho.dark ? 'rgba(0,0,0,.55)' : 'rgba(30,28,24,.32)' },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comune.chiudi')}
          testID="home-pills-veil"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <Animated.View
          testID="home-pills-popup"
          entering={SlideInDown.duration(260).reduceMotion(system)}
          style={[styles.sheet, { backgroundColor: ho.surface, borderColor: ho.hair }]}
        >
          <View style={styles.head}>
            <Text style={{ flex: 1, color: ho.text, fontSize: 18, fontWeight: '700' }}>
              {t('home.tab_pillole')}
              {open.length ? `: ${open.length}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              testID="home-pills-close"
              hitSlop={10}
              onPress={onClose}
              style={[styles.x, { backgroundColor: ho.surface2 }]}
            >
              <Text style={{ color: ho.text2, fontSize: 16, fontWeight: '700' }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
            showsVerticalScrollIndicator={false}
          >
            {open.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                testID="home-pills-all"
                onPress={() => {
                  const list = open.map((r) => r.dose);
                  list.forEach((d) => settle(d, 'taken'));
                  onTakeAll(list.map((d) => d.uuid));
                }}
                style={[styles.all, { backgroundColor: ho.purpleSoft }]}
              >
                <Text style={{ color: ho.purple, fontSize: 14, fontWeight: '700' }}>
                  {t('home.tutte_prese')}
                </Text>
              </Pressable>
            ) : null}

            {rows.length === 0 ? (
              <Text
                testID="home-pills-empty"
                style={{ color: ho.text2, fontSize: 14, paddingVertical: 14, textAlign: 'center' }}
              >
                {t('home.nessuna_pillola')}
              </Text>
            ) : null}

            {rows.map(({ dose: d, how }) => {
              const at =
                d.due_date !== today
                  ? t('home.hp_giorno_alle', { giorno: weekday(d.due_date), ora: d.due_time })
                  : t('home.hp_alle', { ora: d.due_time });
              return (
                <SettleCard
                  key={d.uuid}
                  testID={`home-pill-${d.uuid}`}
                  settled={how !== null}
                  base={ho.surface2}
                  tint={mix(d.color || ho.purple, ho.surface, how === 'skipped' ? 0.08 : 0.2)}
                  style={[styles.row, { boxShadow: `inset 0 0 0 1px ${d.color || ho.purple}66` }]}
                >
                  {how ? null : (
                    <Pressable
                      accessibilityRole="button"
                      testID={`home-pill-skip-${d.uuid}`}
                      onPress={() => {
                        settle(d, 'skipped');
                        onPill(d, 'skipped');
                      }}
                      style={[styles.skip, { backgroundColor: ho.surface }]}
                    >
                      <Text style={{ color: ho.text2, fontSize: 12, fontWeight: '600' }}>
                        {t('home.hp_saltato')}
                      </Text>
                    </Pressable>
                  )}
                  {how ? (
                    <Animated.Text
                      key="done"
                      testID={`home-pill-done-${d.uuid}`}
                      entering={FadeIn.duration(160).reduceMotion(system)}
                      style={{ flex: 1, color: ho.text, fontSize: 14, fontWeight: '700' }}
                    >
                      {how === 'taken' ? t('home.presa') : t('home.salta')}
                      {' · '}
                      {d.name}
                    </Animated.Text>
                  ) : (
                    <Text
                      key="ask"
                      style={{ flex: 1, color: ho.text2, fontSize: 14, lineHeight: 19 }}
                    >
                      {d.plan_dose
                        ? t('home.hp_hai_preso_dose', { dose: d.plan_dose })
                        : t('home.hp_hai_preso')}
                      <Text style={{ color: ho.text, fontWeight: '700' }}>{d.name}</Text> {at}?
                    </Text>
                  )}
                  <TickButton
                    testID={`home-pill-take-${d.uuid}`}
                    color={d.color || ho.purple}
                    onColor="#FFFFFF"
                    size={34}
                    glyph={16}
                    how={how}
                    label={t('home.presa')}
                    onPress={() => {
                      settle(d, 'taken');
                      onPill(d, 'taken');
                    }}
                  />
                </SettleCard>
              );
            })}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            testID="home-pills-open"
            onPress={() => {
              onClose();
              onOpenPills();
            }}
            style={[styles.open, { backgroundColor: ho.purpleSoft }]}
          >
            <Text style={{ color: ho.purple, fontSize: 14, fontWeight: '700' }}>
              {t('home.apri_pillole')}
            </Text>
            <HoIcon name="right" size={14} color={ho.purple} sw={2.8} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veil: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
    maxHeight: '80%',
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  x: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  all: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 9,
    borderRadius: 22,
  },
  skip: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  open: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
});
