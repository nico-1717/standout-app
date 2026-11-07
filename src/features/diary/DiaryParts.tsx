import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { alpha } from '@/features/buy/buyTheme';

import type { DiaryTheme } from './diaryTheme';
import { Face } from './Face';
import type { Ring } from './logic';
import type { DiaryFont } from './settings';
import { effectiveFont } from './diaryTheme';

/** Gli anelli concentrici (un cerchio per famiglia di frequenza, il giornaliero più dentro): stesso disegno del sito. */
const WIDTH = 3.6;
const GAP = 1;
const OUTER = 24;

export function Rings({ rings, size, d }: { rings: Ring[]; size: number; d: DiaryTheme }) {
  const colors: Record<Ring['key'], string> =
    d.style === 'standard'
      ? { daily: d.accent, weekly: '#30D158', monthly: '#FF9F0A', interval: '#BF5AF2' }
      : { daily: d.accent, weekly: '#6E8C74', monthly: '#8A9E7E', interval: '#AFB79A' };
  const track = alpha(d.style === 'paper' ? '#4A443D' : d.dark ? '#FFFFFF' : '#000000', 0.08);
  const lanes: Ring[] =
    rings.length || d.style !== 'standard' ? rings : [{ key: 'daily', done: 0, total: 0 }];
  return (
    <Svg width={size} height={size} viewBox="0 0 54 54" testID="diary-rings">
      {lanes.map((r, i) => {
        const radius = OUTER - (lanes.length - 1 - i) * (WIDTH + GAP);
        if (radius < 3.5) return null;
        const c = 2 * Math.PI * radius;
        const frac = r.total > 0 ? Math.min(1, r.done / r.total) : 0;
        return (
          <RingLane
            key={r.key}
            radius={radius}
            c={c}
            frac={frac}
            color={colors[r.key]}
            track={track}
            round={d.style === 'standard'}
          />
        );
      })}
    </Svg>
  );
}

function RingLane(p: {
  radius: number;
  c: number;
  frac: number;
  color: string;
  track: string;
  round: boolean;
}) {
  return (
    <>
      <Circle cx={27} cy={27} r={p.radius} stroke={p.track} strokeWidth={WIDTH} fill="none" />
      {p.frac > 0 && (
        <Circle
          cx={27}
          cy={27}
          r={p.radius}
          stroke={p.color}
          strokeWidth={WIDTH}
          fill="none"
          strokeLinecap={p.round ? 'round' : 'butt'}
          strokeDasharray={`${p.c} ${p.c}`}
          strokeDashoffset={p.c * (1 - p.frac)}
          transform="rotate(-90 27 27)"
        />
      )}
    </>
  );
}

/** Un foglietto al centro dello schermo (il sito lo attacca al tasto; su telefono il centro è più comodo). */
export function Pop({
  visible,
  d,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  d: DiaryTheme;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.center}>
        <Pressable
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          testID="diary-pop-backdrop"
        />
        <View
          testID={testID}
          style={[
            styles.pop,
            {
              backgroundColor: d.page,
              borderColor: d.hair,
              borderRadius: d.style === 'paper' ? 16 : 22,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const Label = ({ d, children }: { d: DiaryTheme; children: ReactNode }) => (
  <Text
    style={{
      color: d.ink3,
      fontFamily: d.sans,
      fontSize: d.style === 'standard' ? 10.5 : 9,
      fontWeight: '500',
      letterSpacing: d.style === 'standard' ? 0.1 : 1.6,
      textTransform: 'uppercase',
      marginBottom: 10,
    }}
  >
    {children}
  </Text>
);

/** Il fogliettino con le cinque scelte (com'è andata / energia). Toccare quella già scelta la toglie. */
export function FacePop({
  kind,
  value,
  d,
  onPick,
  onClose,
}: {
  kind: 'mood' | 'energy' | null;
  value: number | null;
  d: DiaryTheme;
  onPick: (level: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pop visible={kind !== null} d={d} onClose={onClose} testID="face-pop">
      {kind && (
        <>
          <Label d={d}>{t(kind === 'mood' ? 'diario.com_e_andata' : 'diario.energia')}</Label>
          <View style={styles.faceRow}>
            {[1, 2, 3, 4, 5].map((lv) => (
              <Pressable
                key={lv}
                testID={`face-${lv}`}
                accessibilityRole="button"
                accessibilityState={{ selected: value === lv }}
                onPress={() => onPick(value === lv ? null : lv)}
                style={[styles.faceOpt, value === lv && { backgroundColor: d.accent2 }]}
              >
                <Face
                  kind={kind}
                  level={lv}
                  size={44}
                  style={d.style}
                  color={value === lv ? d.ink : d.pencil}
                />
                <Text
                  numberOfLines={1}
                  style={{ color: d.ink2, fontFamily: d.sans, fontSize: 10, marginTop: 4 }}
                >
                  {t(`diario.${kind === 'mood' ? 'umore' : 'energia'}_${lv}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Pop>
  );
}

const FONT_LABEL: Record<string, string> = {
  caveat: 'Caveat',
  kalam: 'Kalam',
  patrick: 'Patrick',
  cormorant: 'Garamond',
  jost: 'Jost',
};
const FONT_FAMILY: Record<string, string | undefined> = {
  caveat: 'Caveat_500Medium',
  kalam: 'Kalam_400Regular',
  patrick: 'PatrickHand_400Regular',
  cormorant: 'CormorantGaramond_400Regular',
  jost: 'Jost_400Regular',
  sistema: undefined,
};

/** La scelta della scrittura e del corpo del testo. Nello stile standard la prima scelta è il carattere del telefono. */
export function FontPop({
  visible,
  d,
  font,
  size,
  onFont,
  onSize,
  onClose,
}: {
  visible: boolean;
  d: DiaryTheme;
  font: DiaryFont;
  size: number;
  onFont: (key: DiaryFont) => void;
  onSize: (size: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const std = d.style === 'standard';
  const current = effectiveFont(d.style, font);
  const options = std
    ? ['sistema', 'caveat', 'kalam', 'patrick', 'cormorant', 'jost']
    : ['caveat', 'kalam', 'patrick', 'cormorant', 'jost'];
  return (
    <Pop visible={visible} d={d} onClose={onClose} testID="font-pop">
      <Label d={d}>{t('diario.la_tua_scrittura')}</Label>
      <ScrollView style={{ maxHeight: 320 }}>
        {options.map((k) => (
          <Pressable
            key={k}
            testID={`font-${k}`}
            accessibilityRole="button"
            accessibilityState={{ selected: current === k }}
            onPress={() =>
              onFont((std ? (k === 'sistema' ? 'sistema' : `std-${k}`) : k) as DiaryFont)
            }
            style={[
              styles.fontOpt,
              { borderColor: d.hair },
              current === k && { backgroundColor: d.accent2 },
            ]}
          >
            <Text
              style={{ color: d.ink, fontFamily: FONT_FAMILY[k], fontSize: 19, flex: 1 }}
              numberOfLines={1}
            >
              {t('diario.esempio_scrittura')}
            </Text>
            <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 11 }}>
              {k === 'sistema' ? t('diario.font_sistema') : FONT_LABEL[k]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.sizeRow}>
        <Pressable
          accessibilityRole="button"
          testID="font-smaller"
          accessibilityLabel={t('diario.piu_piccolo')}
          onPress={() => onSize(Math.max(14, size - 1))}
          style={[styles.sizeBtn, { backgroundColor: d.paper2 }]}
        >
          <Text style={{ color: d.ink2, fontSize: 14 }}>A−</Text>
        </Pressable>
        <Text
          testID="font-size"
          style={{
            color: d.ink,
            fontFamily: d.serif,
            fontSize: 20,
            minWidth: 36,
            textAlign: 'center',
          }}
        >
          {size}
        </Text>
        <Pressable
          accessibilityRole="button"
          testID="font-bigger"
          accessibilityLabel={t('diario.piu_grande')}
          onPress={() => onSize(Math.min(26, size + 1))}
          style={[styles.sizeBtn, { backgroundColor: d.paper2 }]}
        >
          <Text style={{ color: d.ink2, fontSize: 18 }}>A+</Text>
        </Pressable>
      </View>
    </Pop>
  );
}

export interface HabitSummaryData {
  habits: { uuid: string; name: string; icon: string; color: string; done: boolean }[];
  weekly: {
    uuid: string;
    name: string;
    icon: string;
    color: string;
    done: number;
    target: number;
  }[];
}

/** «Abitudini»: cosa c'era quel giorno e cosa è stato fatto, con il tasto per andare alla pagina delle abitudini. */
export function HabitsSummary({
  visible,
  d,
  title,
  sub,
  data,
  onClose,
  onGo,
}: {
  visible: boolean;
  d: DiaryTheme;
  title: string;
  sub: string;
  data: HabitSummaryData;
  onClose: () => void;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const doneN = data.habits.filter((h) => h.done).length;
  return (
    <Pop visible={visible} d={d} onClose={onClose} testID="habits-summary">
      <Text
        style={{
          color: d.ink,
          fontFamily: d.serif,
          fontSize: 22,
          fontWeight: d.style === 'standard' ? '700' : '400',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: d.ink3,
          fontFamily: d.sans,
          fontSize: 10.5,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {sub}
      </Text>
      <ScrollView style={{ maxHeight: 340 }}>
        {data.habits.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Label d={d}>
              {t('diario.di_oggi_su', { fatte: doneN, totale: data.habits.length })}
            </Label>
            {data.habits.map((h) => (
              <View key={h.uuid} style={[styles.hbRow, { borderBottomColor: d.hair }]}>
                <View style={[styles.dot, { backgroundColor: h.color || '#B7AEA3' }]} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: h.done ? d.ink3 : d.ink,
                    fontFamily: d.sans,
                    fontSize: 14.5,
                    textDecorationLine: h.done ? 'line-through' : 'none',
                  }}
                >
                  {h.icon ? `${h.icon} ` : ''}
                  {h.name}
                </Text>
                {h.done && <Text style={{ color: d.accent, fontWeight: '800' }}>✓</Text>}
              </View>
            ))}
          </View>
        )}
        {data.weekly.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Label d={d}>{t('diario.questa_settimana')}</Label>
            {data.weekly.map((h) => (
              <View key={h.uuid} style={[styles.hbRow, { borderBottomColor: d.hair }]}>
                <View style={[styles.dot, { backgroundColor: h.color || '#B7AEA3' }]} />
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: d.ink, fontFamily: d.sans, fontSize: 14.5 }}
                >
                  {h.icon ? `${h.icon} ` : ''}
                  {h.name}
                </Text>
                <Text style={{ color: d.ink2, fontFamily: d.serif, fontSize: 15 }}>
                  {h.done}/{h.target}
                </Text>
              </View>
            ))}
          </View>
        )}
        {data.habits.length === 0 && data.weekly.length === 0 && (
          <Text style={{ color: d.ink2, fontFamily: d.sans, marginTop: 14 }}>
            {t('diario.nessuna_abitudine')}
          </Text>
        )}
      </ScrollView>
      <View style={styles.acts}>
        <Pressable
          accessibilityRole="button"
          testID="summary-close"
          onPress={onClose}
          style={[styles.actBtn, { backgroundColor: d.paper2 }]}
        >
          <Text style={{ color: d.ink2, fontSize: 14 }}>{t('comune.chiudi')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="summary-go"
          onPress={onGo}
          style={[styles.actBtn, { backgroundColor: d.accent }]}
        >
          <Text style={{ color: d.onAccent, fontSize: 14 }}>{t('diario.vai_alle_abitudini')}</Text>
        </Pressable>
      </View>
    </Pop>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pop: { width: '100%', maxWidth: 360, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  faceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  faceOpt: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12 },
  fontOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 10,
  },
  sizeBtn: {
    width: 48,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 18 },
  actBtn: { flex: 1, padding: 11, borderRadius: 13, alignItems: 'center' },
});
