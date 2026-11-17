import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { mix } from '@/features/buy/buyTheme';
import type { DoseView } from '@/features/pills/repo';
import { SettleCard, TickButton, useSettling, type SettleRow } from '@/features/pills/settle';
import { haptic } from '@/ui/motion';

import { weekdayOf } from './dates';
import { longHex, type PlannerTheme } from './plannerTheme';

/** Il giorno a tre lettere («mar»), come sul sito: serve a capire di quale giorno si parla in una riga sola. */
function shortDay(t: (k: string) => string, iso: string): string {
  return t(`planner.gg_${weekdayOf(iso)}`)
    .slice(0, 3)
    .toLowerCase();
}

/** Da quanti avvisi in su se ne fa uno solo: sei schede una sull'altra coprivano metà giornata. */
const GROUP_FROM = 4;

/** Un solo avviso per tutte le pastiglie in sospeso: «6 da confermare — le hai prese?». */
function PillGroup({
  count,
  settled,
  pt,
  bottom,
  onAll,
  onReview,
  onClose,
}: {
  count: number;
  /** «tutte prese» già premuto: la scheda si tinge ed esce */
  settled: boolean;
  pt: PlannerTheme;
  bottom: number;
  onAll: () => void;
  onReview?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const color = longHex(pt.accent, pt.neutralEv);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 90, bottom }}>
      <SettleCard
        testID="pill-group"
        settled={settled}
        base={pt.card}
        tint={mix(color, pt.card, 0.16)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingLeft: 8,
          paddingRight: 10,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: color + '66',
          boxShadow: pt.dark ? 'none' : '0 6px 18px rgba(60,50,40,0.14)',
        }}
      >
        <TickButton
          testID="pill-all-taken"
          color={color}
          onColor="#FFFFFF"
          size={34}
          glyph={15}
          how={settled ? 'taken' : null}
          label={t('planner.pillole_tutte_prese')}
          onPress={() => {
            haptic.success();
            onAll();
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: pt.ink, fontSize: 13, fontWeight: '600', fontFamily: pt.sans }}>
            {t('planner.pillole_da_confermare', { n: count })}
          </Text>
          <Text style={{ color: pt.ink2, fontSize: 12, fontFamily: pt.sans }}>
            {t('planner.pillole_hai_preso')}
            {' · '}
            {t('planner.pillole_tutte_prese')}
          </Text>
        </View>
        {onReview && !settled ? (
          <Pressable testID="pill-review" accessibilityRole="button" hitSlop={8} onPress={onReview}>
            <Text
              style={{
                color: pt.ink3,
                fontSize: 11,
                textDecorationLine: 'underline',
                fontFamily: pt.sans,
              }}
            >
              {t('planner.pillole_rivedi')}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="pill-group-hide"
          accessibilityRole="button"
          accessibilityLabel={t('planner.chiudi_per_ora')}
          hitSlop={10}
          onPress={onClose}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 6l12 12M18 6L6 18"
              stroke={pt.ink3}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </SettleCard>
    </View>
  );
}

/**
 * Gli avvisi in basso nel planner (renderAvvisi): «Hai preso X alle 09:00?» per le pastiglie la cui ora è
 * passata. La spunta e «Saltato» scrivono la presa (risulta anche nella pagina pastiglie), la x chiude solo per ora.
 */
export function PillNotices({
  doses,
  today,
  pt,
  bottom,
  onAnswer,
  onAnswerAll,
  onReview,
}: {
  doses: DoseView[];
  today: string;
  pt: PlannerTheme;
  /** distanza dal fondo: gli avvisi stanno all'altezza del tasto + */
  bottom: number;
  onAnswer: (uuid: string, status: 'taken' | 'skipped') => void;
  /** «Tutte prese»: scrive le prese all'ora prevista. Senza, gli avvisi restano sempre uno per uno. */
  onAnswerAll?: (uuids: string[]) => void;
  /** «Rivedi»: apre la pagina delle pastiglie, dove si risponde dose per dose. */
  onReview?: () => void;
}) {
  const { t } = useTranslation();
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const visible = useMemo(() => doses.filter((d) => !closed.has(d.uuid)), [doses, closed]);
  // la risposta si scrive subito; la scheda resta un attimo «fatta» e poi esce piano
  const { rows, settle } = useSettling(visible);
  if (!rows.length) return null;
  const close = (ids: string[]) => setClosed((c) => new Set([...c, ...ids]));
  const answer = (d: DoseView, how: 'taken' | 'skipped') => {
    settle(d, how);
    onAnswer(d.uuid, how);
  };
  if (onAnswerAll && rows.length >= GROUP_FROM) {
    const pending = rows.filter((r) => !r.how);
    return (
      <PillGroup
        count={rows.length}
        settled={pending.length === 0}
        pt={pt}
        bottom={bottom}
        onAll={() => {
          for (const r of pending) settle(r.dose, 'taken');
          onAnswerAll(pending.map((r) => r.dose.uuid));
        }}
        onReview={onReview}
        onClose={() => close(rows.map((r) => r.dose.uuid))}
      />
    );
  }
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 14, right: 90, bottom, gap: 6 }}
    >
      {rows.length > 1 ? (
        <Pressable
          testID="pill-close-all"
          accessibilityRole="button"
          onPress={() => close(rows.map((r) => r.dose.uuid))}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: pt.ink,
            borderRadius: 99,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: pt.card, fontSize: 11, fontFamily: pt.sans }}>
            {t('planner.chiudi_tutti')}
          </Text>
        </Pressable>
      ) : null}
      {rows.map((r) => (
        <PillNotice
          key={r.dose.uuid}
          row={r}
          today={today}
          pt={pt}
          onAnswer={(how) => answer(r.dose, how)}
          onHide={() => close([r.dose.uuid])}
        />
      ))}
    </View>
  );
}

/** Un avviso: «Hai preso X alle 09:00?» con la spunta, «Saltato» e la x; da risposto mostra l'esito. */
function PillNotice({
  row,
  today,
  pt,
  onAnswer,
  onHide,
}: {
  row: SettleRow;
  today: string;
  pt: PlannerTheme;
  onAnswer: (how: 'taken' | 'skipped') => void;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const { dose: d, how } = row;
  const color = longHex(d.color, pt.accent);
  const when =
    d.due_date === today
      ? t('planner.alle_ora', { ora: d.due_time })
      : t('planner.giorno_alle_ora', { giorno: shortDay(t, d.due_date), ora: d.due_time });
  const lead = d.plan_dose
    ? t('planner.hai_preso_dose', { dose: d.plan_dose })
    : t('planner.hai_preso');
  return (
    <SettleCard
      testID={`pill-notice-${d.uuid}`}
      settled={how !== null}
      base={pt.card}
      tint={mix(color, pt.card, how === 'skipped' ? 0.06 : 0.16)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingLeft: 6,
        paddingRight: 8,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: color + '66',
        boxShadow: pt.dark ? 'none' : '0 6px 18px rgba(60,50,40,0.14)',
      }}
    >
      <TickButton
        testID={`pill-taken-${d.uuid}`}
        color={color}
        onColor="#FFFFFF"
        how={how}
        label={t('planner.presa')}
        onPress={() => {
          haptic.success();
          onAnswer('taken');
        }}
      />
      {how ? (
        <Animated.Text
          key="done"
          testID={`pill-done-${d.uuid}`}
          entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
          style={{
            flex: 1,
            color: pt.ink,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: '600',
            fontFamily: pt.sans,
          }}
        >
          {how === 'taken' ? t('planner.presa') : t('planner.saltato')}
          {' · '}
          {d.name}
        </Animated.Text>
      ) : (
        <Text
          key="ask"
          style={{ flex: 1, color: pt.ink2, fontSize: 12, lineHeight: 16, fontFamily: pt.sans }}
        >
          {lead}
          <Text style={{ color: pt.ink, fontWeight: '600' }}>{d.name}</Text>
          {` ${when}?`}
        </Text>
      )}
      {how ? null : (
        <>
          <Pressable
            testID={`pill-skip-${d.uuid}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              haptic.tap();
              onAnswer('skipped');
            }}
          >
            <Text
              style={{
                color: pt.ink3,
                fontSize: 11,
                textDecorationLine: 'underline',
                fontFamily: pt.sans,
              }}
            >
              {t('planner.saltato')}
            </Text>
          </Pressable>
          <Pressable
            testID={`pill-hide-${d.uuid}`}
            accessibilityRole="button"
            accessibilityLabel={t('planner.chiudi_per_ora')}
            hitSlop={10}
            onPress={onHide}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6l12 12M18 6L6 18"
                stroke={pt.ink3}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </>
      )}
    </SettleCard>
  );
}
