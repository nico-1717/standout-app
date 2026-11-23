import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { ROW_H, type LineSeg } from './calendarGrid';

/** Dove stanno le linee dentro una settimana: sotto il numero, sopra l'ora. */
const LINE_TOP = 27;
const LANE_GAP = 6;
const LINE_H = 4;
/** Lo spazio che lascia un estremo arrotondato: il margine della casella (2) più un respiro. */
const CAP_INSET = 6;

/**
 * Le linee dei progetti, al posto dei pallini: un progetto dal 24 al 28 è una linea sola che va da una casella
 * all'altra, e va a capo con la settimana. Sta sopra la griglia e non prende i tocchi (passano alle caselle).
 */
export function CalendarLines({ segs }: { segs: LineSeg[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {segs.map((s) => (
        <View
          key={`${s.id}-${s.soft ? 's' : 'p'}-${s.row}-${s.from}`}
          testID={`cal-line-${s.id}-${s.row}-${s.from}`}
          style={{
            position: 'absolute',
            top: s.row * ROW_H + LINE_TOP + s.lane * LANE_GAP,
            left: `${(s.from / 7) * 100}%`,
            width: `${((s.to - s.from + 1) / 7) * 100}%`,
            height: LINE_H,
            paddingLeft: s.capL ? CAP_INSET : 0,
            paddingRight: s.capR ? CAP_INSET : 0,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: s.color,
              opacity: s.soft ? 0.45 : 1,
              borderTopLeftRadius: s.capL ? 2 : 0,
              borderBottomLeftRadius: s.capL ? 2 : 0,
              borderTopRightRadius: s.capR ? 2 : 0,
              borderBottomRightRadius: s.capR ? 2 : 0,
            }}
          />
        </View>
      ))}
    </View>
  );
}

export interface LegendRow {
  id: string;
  name: string;
  color: string;
  days: number;
}

/** Sotto il calendario: ogni colore col nome del progetto e quanti giorni ha nel mese che si vede. */
export function CalendarLegend({ rows }: { rows: LegendRow[] }) {
  const th = useTheme();
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <View
      testID="cal-legend"
      style={{
        gap: 2,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: th.hairline2,
        paddingTop: 8,
      }}
    >
      {rows.map((r) => (
        <View
          key={r.id}
          testID={`cal-legend-${r.id}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 }}
        >
          <View
            style={{ width: 22, height: LINE_H + 1, borderRadius: 3, backgroundColor: r.color }}
          />
          <Text style={{ flex: 1, color: th.text, fontSize: 14 }} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={{ color: th.text2, fontSize: 13, fontVariant: ['tabular-nums'] }}>
            {r.days === 1 ? t('piano.n_giorno') : t('piano.n_giorni', { n: r.days })}
          </Text>
        </View>
      ))}
    </View>
  );
}
