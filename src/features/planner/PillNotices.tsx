import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { DoseView } from '@/features/pills/repo';
import { haptic } from '@/ui/motion';

import { weekdayOf } from './dates';
import type { PlannerTheme } from './plannerTheme';

/** Il giorno a tre lettere («mar»), come sul sito: serve a capire di quale giorno si parla in una riga sola. */
function shortDay(t: (k: string) => string, iso: string): string {
  return t(`planner.gg_${weekdayOf(iso)}`)
    .slice(0, 3)
    .toLowerCase();
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
}: {
  doses: DoseView[];
  today: string;
  pt: PlannerTheme;
  /** distanza dal fondo: gli avvisi stanno all'altezza del tasto + */
  bottom: number;
  onAnswer: (uuid: string, status: 'taken' | 'skipped') => void;
}) {
  const { t } = useTranslation();
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const shown = doses.filter((d) => !closed.has(d.uuid));
  if (!shown.length) return null;
  const close = (ids: string[]) => setClosed((c) => new Set([...c, ...ids]));
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 14, right: 90, bottom, gap: 6 }}
    >
      {shown.length > 1 ? (
        <Pressable
          testID="pill-close-all"
          accessibilityRole="button"
          onPress={() => close(shown.map((d) => d.uuid))}
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
      {shown.map((d) => {
        const color = d.color || pt.accent;
        const when =
          d.due_date === today
            ? t('planner.alle_ora', { ora: d.due_time })
            : t('planner.giorno_alle_ora', { giorno: shortDay(t, d.due_date), ora: d.due_time });
        const lead = d.plan_dose
          ? t('planner.hai_preso_dose', { dose: d.plan_dose })
          : t('planner.hai_preso');
        return (
          <View
            key={d.uuid}
            testID={`pill-notice-${d.uuid}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 6,
              paddingLeft: 6,
              paddingRight: 8,
              borderRadius: 99,
              backgroundColor: pt.card,
              borderWidth: 1,
              borderColor: color + '66',
              boxShadow: pt.dark ? 'none' : '0 6px 18px rgba(60,50,40,0.14)',
            }}
          >
            <Pressable
              testID={`pill-taken-${d.uuid}`}
              accessibilityRole="button"
              accessibilityLabel={t('planner.presa')}
              hitSlop={8}
              onPress={() => {
                haptic.tap();
                onAnswer(d.uuid, 'taken');
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: color + '29',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 12.5l5.2 5.2L20 6.6"
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
            <Text
              style={{ flex: 1, color: pt.ink2, fontSize: 12, lineHeight: 16, fontFamily: pt.sans }}
            >
              {lead}
              <Text style={{ color: pt.ink, fontWeight: '600' }}>{d.name}</Text>
              {` ${when}?`}
            </Text>
            <Pressable
              testID={`pill-skip-${d.uuid}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onAnswer(d.uuid, 'skipped')}
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
              onPress={() => close([d.uuid])}
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
          </View>
        );
      })}
    </View>
  );
}
