import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import type { Zoom } from './layout';
import type { PlannerTheme } from './plannerTheme';

const STEPS: { key: Zoom; label: string }[] = [
  { key: 'agenda', label: '' },
  { key: 'h3', label: '3 h' },
  { key: 'h1', label: '1 h' },
  { key: 'm30', label: "30'" },
  { key: 'm15', label: "15'" },
  { key: 'm5', label: "5'" },
];

/**
 * La rotellina degli scatti (`#plZoom` / `.pl-zoom` del sito): una pillola verticale con «scatti», lista, 3 h,
 * 1 h, 30', 15', 5'. Su telefono compare mentre si pizzica e resta in vista lista; premendo uno scatto si torna
 * alla sua densità naturale.
 */
export function ZoomDial(p: {
  pt: PlannerTheme;
  step: Zoom;
  top: number;
  right: number;
  onPick: (z: Zoom) => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  return (
    <View
      testID="zoom-dial"
      style={{
        position: 'absolute',
        top: p.top,
        right: p.right,
        zIndex: 57,
        alignItems: 'center',
        gap: 2,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 999,
        backgroundColor:
          pt.style === 'standard'
            ? pt.dark
              ? 'rgba(28,28,30,.92)'
              : 'rgba(255,255,255,.92)'
            : pt.pill,
        borderWidth: 0.5,
        borderColor: pt.fieldRing,
        boxShadow: pt.dark
          ? '0 1px 1px rgba(0,0,0,.4), 0 6px 18px -8px rgba(0,0,0,.6)'
          : '0 1px 1px rgba(0,0,0,.04), 0 6px 18px -10px rgba(0,0,0,.14)',
      }}
    >
      <Text
        style={{
          fontSize: 7,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: pt.ink3,
          paddingBottom: 2,
          fontFamily: pt.sans,
        }}
      >
        {t('planner.scatti')}
      </Text>
      {STEPS.map((s) => {
        const on = s.key === p.step;
        return (
          <Pressable
            key={s.key}
            testID={`zoom-${s.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => p.onPick(s.key)}
            style={{
              width: 30,
              height: 22,
              borderRadius: 7,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? pt.accentSoft : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 8.5,
                letterSpacing: 0.3,
                color: on ? pt.accentInk : pt.ink3,
                fontWeight: on ? '600' : '400',
                fontFamily: pt.sans,
              }}
            >
              {s.key === 'agenda' ? t('planner.lista') : s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
