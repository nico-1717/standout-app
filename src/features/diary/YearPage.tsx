import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DiaryTheme } from './diaryTheme';
import { Face } from './Face';
import {
  dayOf,
  LAYER_COLORS,
  levelOf,
  monthRows,
  summarise,
  weekRows,
  written,
  yearRows,
  type Insights,
  type Layer,
  type Row,
} from './insights';
import { Text } from '@/ui/CappedText';

const fmtNum = (v: number | null, dec = 1) =>
  v === null ? '–' : v.toLocaleString(undefined, { maximumFractionDigits: dec });

function Seg<T extends string>({
  value,
  options,
  onChange,
  d,
  testID,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  d: DiaryTheme;
  testID: string;
}) {
  return (
    <View style={[styles.seg, { backgroundColor: d.paper2 }]} testID={testID}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          testID={`${testID}-${o.key}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.key }}
          onPress={() => onChange(o.key)}
          style={[styles.segBtn, value === o.key && { backgroundColor: d.card }]}
        >
          <Text
            style={{ color: value === o.key ? d.ink : d.ink2, fontFamily: d.sans, fontSize: 12 }}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Tile({
  icon,
  value,
  label,
  d,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  d: DiaryTheme;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: d.card, borderColor: d.hair }]}>
      <View style={{ height: 28, justifyContent: 'center' }}>{icon}</View>
      <Text style={{ color: d.ink, fontFamily: d.serif, fontSize: 24 }}>{value}</Text>
      <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 10.5 }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Bar({
  v,
  max,
  colors,
  text,
  d,
}: {
  v: number | null;
  max: number;
  colors: string[];
  text: string;
  d: DiaryTheme;
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={[styles.barTrack, { backgroundColor: d.hair }]}>
        {v !== null && (
          <View
            style={{
              height: '100%',
              borderRadius: 3,
              width: `${Math.max(4, Math.min(100, (v / max) * 100))}%`,
              backgroundColor: colors[Math.max(0, Math.min(4, Math.round(v) - 1))],
            }}
          />
        )}
      </View>
      <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 11, marginTop: 2 }}>{text}</Text>
    </View>
  );
}

function RowView({
  row,
  label,
  sub,
  d,
  onPress,
}: {
  row: Row;
  label: string;
  sub?: string;
  d: DiaryTheme;
  onPress: () => void;
}) {
  const s = row.summary;
  return (
    <Pressable
      accessibilityRole="button"
      testID={`row-${row.key}`}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: d.hair }]}
    >
      <View style={{ flex: 1.5 }}>
        <Text style={{ color: d.ink, fontFamily: d.sans, fontSize: 13, fontWeight: '600' }}>
          {label}
        </Text>
        {sub ? (
          <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 10.5 }}>{sub}</Text>
        ) : null}
      </View>
      <Bar v={s.umore} max={5} colors={LAYER_COLORS.m} text={fmtNum(s.umore)} d={d} />
      <Bar v={s.energia} max={5} colors={LAYER_COLORS.e} text={fmtNum(s.energia)} d={d} />
      <Bar
        v={s.pct === null ? null : 1 + s.pct / 25}
        max={5}
        colors={LAYER_COLORS.h}
        text={s.pct === null ? '–' : `${s.pct}%`}
        d={d}
      />
      <Text style={[styles.rowN, { color: d.ink2 }]}>
        {s.scritti}/{s.giorni}
      </Text>
      <Text style={[styles.rowN, { color: d.ink2, flex: 0.5 }]}>{s.pomodori}</Text>
    </Pressable>
  );
}

/** Il diario in numeri: le tessere, il calendario dell'anno a colori, e settimane/mesi/anni a confronto. */
export function YearPage({
  d,
  data,
  months,
  onOpenDay,
  onYear,
}: {
  d: DiaryTheme;
  data: Insights;
  months: string[];
  onOpenDay: (date: string) => void;
  onYear: (year: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [layer, setLayer] = useState<Layer>('m');
  const [period, setPeriod] = useState<'w' | 'm' | 'y'>('w');
  const all = summarise(Object.keys(data.days).map((k) => dayOf(data, k)));
  const colors = LAYER_COLORS[layer];
  const words =
    layer === 'm'
      ? [1, 2, 3, 4, 5].map((i) => t(`diario.umore_${i}`))
      : layer === 'e'
        ? [1, 2, 3, 4, 5].map((i) => t(`diario.energia_${i}`))
        : ['0%', '25%', '50%', '75%', '100%'];
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });
  const at = (iso: string) => dayFmt.format(new Date(`${iso}T12:00:00`));

  const rows = period === 'w' ? weekRows(data) : period === 'm' ? monthRows(data) : yearRows(data);

  return (
    <View testID="year-page">
      <View style={styles.tiles}>
        <Tile
          d={d}
          icon={<Text style={{ fontSize: 22 }}>📖</Text>}
          value={String(all.scritti)}
          label={t('diario.dn_giorni_scritti')}
        />
        <Tile
          d={d}
          icon={
            <Face
              kind="mood"
              level={all.umore ? Math.round(all.umore) : null}
              size={26}
              style={d.style}
              color={d.ink2}
            />
          }
          value={fmtNum(all.umore)}
          label={t('diario.dn_umore_medio')}
        />
        <Tile
          d={d}
          icon={
            <Face
              kind="energy"
              level={all.energia ? Math.round(all.energia) : null}
              size={26}
              style={d.style}
              color={d.ink2}
            />
          }
          value={fmtNum(all.energia)}
          label={t('diario.dn_energia_media')}
        />
        <Tile
          d={d}
          icon={<Text style={{ fontSize: 22 }}>✅</Text>}
          value={all.pct === null ? '–' : `${all.pct}%`}
          label={t('diario.dn_abitudini_fatte')}
        />
        <Tile
          d={d}
          icon={<Text style={{ fontSize: 22 }}>🍅</Text>}
          value={`${fmtNum(all.minuti / 60, 0)} h`}
          label={t('diario.dn_concentrazione', { n: all.pomodori })}
        />
      </View>

      <View style={[styles.card, { backgroundColor: d.card, borderColor: d.hair }]}>
        <View style={styles.cardHead}>
          <Text style={[styles.h2, { color: d.ink, fontFamily: d.serif }]}>
            {t('diario.dn_calendario')}
          </Text>
          <Seg
            d={d}
            testID="layer"
            value={layer}
            onChange={setLayer}
            options={[
              { key: 'm', label: t('diario.dn_umore') },
              { key: 'e', label: t('diario.dn_energia') },
              { key: 'h', label: t('diario.dn_abitudini') },
            ]}
          />
        </View>
        <View style={styles.months}>
          {months.map((name, mi) => {
            const first = `${data.year}-${String(mi + 1).padStart(2, '0')}-01`;
            const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
            const n = new Date(Date.UTC(data.year, mi + 1, 0)).getUTCDate();
            return (
              <View key={name} style={styles.month}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenDay(first)}
                  testID={`month-${mi + 1}`}
                >
                  <Text
                    style={{ color: d.ink2, fontFamily: d.serif, fontSize: 14, marginBottom: 3 }}
                  >
                    {name}
                  </Text>
                </Pressable>
                <View style={styles.mgrid}>
                  {Array.from({ length: lead }, (_, i) => (
                    <View key={`v${i}`} style={styles.dcell} />
                  ))}
                  {Array.from({ length: n }, (_, i) => {
                    const date = `${data.year}-${String(mi + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                    const x = dayOf(data, date);
                    const future = date > data.today;
                    const lv = future ? null : levelOf(x, layer);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={date}
                        testID={`day-${date}`}
                        disabled={future}
                        onPress={() => onOpenDay(date)}
                        style={styles.dcell}
                      >
                        <View
                          style={[
                            styles.dot,
                            {
                              backgroundColor: lv ? colors[lv - 1] : d.hair,
                              opacity: future ? 0.35 : 1,
                            },
                            !lv &&
                              !future &&
                              written(x) && {
                                borderWidth: 1.5,
                                borderColor: d.ink3,
                                backgroundColor: 'transparent',
                              },
                            date === data.today && { borderWidth: 1.5, borderColor: d.accent },
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          {colors.map((c, i) => (
            <View key={c} style={styles.leg}>
              <View style={[styles.legDot, { backgroundColor: c }]} />
              <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 10 }}>{words[i]}</Text>
            </View>
          ))}
          <View style={styles.leg}>
            <View style={[styles.legDot, { borderWidth: 1.5, borderColor: d.ink3 }]} />
            <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 10 }}>
              {t('diario.dn_solo_scritto')}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: d.card, borderColor: d.hair }]}>
        <View style={styles.cardHead}>
          <Text style={[styles.h2, { color: d.ink, fontFamily: d.serif }]}>
            {t('diario.dn_andamento')}
          </Text>
          <Seg
            d={d}
            testID="period"
            value={period}
            onChange={setPeriod}
            options={[
              { key: 'w', label: t('diario.dn_settimane') },
              { key: 'm', label: t('diario.dn_mesi') },
              { key: 'y', label: t('diario.dn_anni') },
            ]}
          />
        </View>
        <View style={[styles.row, styles.rowHead, { borderBottomColor: d.hair }]}>
          <Text style={[styles.rowHeadT, { color: d.ink3, flex: 1.5 }]}>
            {t(
              period === 'w'
                ? 'diario.dn_settimana'
                : period === 'm'
                  ? 'diario.dn_mese'
                  : 'diario.dn_anno',
            )}
          </Text>
          {[t('diario.dn_umore'), t('diario.dn_energia'), t('diario.dn_abitudini')].map((h) => (
            <Text key={h} numberOfLines={1} style={[styles.rowHeadT, { color: d.ink3, flex: 1 }]}>
              {h}
            </Text>
          ))}
          <Text style={[styles.rowHeadT, { color: d.ink3, flex: 0.8 }]}>
            {t('diario.dn_scritti')}
          </Text>
          <Text style={[styles.rowHeadT, { color: d.ink3, flex: 0.5 }]}>🍅</Text>
        </View>
        {rows.length === 0 && (
          <Text
            testID="rows-empty"
            style={{ color: d.ink3, fontFamily: d.sans, paddingVertical: 14 }}
          >
            {t('diario.dn_niente')}
          </Text>
        )}
        {rows.map((r) => {
          const label =
            period === 'y'
              ? String(r.year)
              : period === 'm'
                ? months[Number(r.from.slice(5, 7)) - 1]
                : at(r.from);
          const sub =
            period === 'w'
              ? `→ ${at(r.to)}`
              : period === 'y'
                ? t('diario.dn_parole_n', { n: fmtNum(r.summary.parole, 0) })
                : undefined;
          return (
            <RowView
              key={r.key}
              row={r}
              label={label}
              sub={sub}
              d={d}
              onPress={() => (r.year !== null ? onYear(r.year) : onOpenDay(r.date!))}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  card: { marginTop: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  h2: { fontSize: 20 },
  seg: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  month: { width: '31.5%' },
  mgrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dcell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: '78%', height: '78%', borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowHead: { paddingVertical: 6 },
  rowHeadT: { fontSize: 9.5, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowN: { flex: 0.8, fontSize: 11.5 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
