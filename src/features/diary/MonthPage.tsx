import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DiaryTheme } from './diaryTheme';
import { addDays, dateParts } from './DayPage';
import { Face } from './Face';
import { LEVEL_TEXT } from './faces';
import type { MonthSummary } from './logic';
import { monthEnd, weekStart } from './logic';

const num = (v: number | null) => (v === null ? '–' : String(v).replace('.', ','));

function Stat({
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
    <View
      style={[styles.stat, d.style === 'standard' && { backgroundColor: d.card, borderRadius: 18 }]}
    >
      <View style={{ width: 34, height: 34 }}>{icon}</View>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ color: d.ink, fontFamily: d.serif, fontSize: 18 }} numberOfLines={1}>
          {value}
        </Text>
        <Text
          style={{ color: d.ink3, fontFamily: d.sans, fontSize: 10, letterSpacing: 0.2 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Un mese: il calendario con le faccine, le medie, e tutto quello che ho imparato. */
export function MonthPage(p: {
  d: DiaryTheme;
  month: string;
  data: MonthSummary;
  today: string;
  months: string[];
  weekdaysShort: string[];
  onBack: () => void;
  onPickDay: (day: string) => void;
}) {
  const { d, data } = p;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const std = d.style === 'standard';
  const first = `${p.month}-01`;
  const start = weekStart(first);
  const dim = Number(monthEnd(first).slice(8));
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weeks = Math.ceil((lead + dim) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const parts = dateParts(first);
  const st = data.stats;
  const moodAvg = st.mood_avg ? Math.round(st.mood_avg) : null;
  const enAvg = st.energy_avg ? Math.round(st.energy_avg) : null;
  const ink = (lv: number | null) => (std ? (lv ? LEVEL_TEXT[lv] : d.ink3) : lv ? d.ink : d.pencil);

  return (
    <View testID="diary-month">
      <View style={styles.head}>
        <Pressable
          testID="month-back"
          accessibilityRole="button"
          accessibilityLabel={t('diario.torna_al_giorno')}
          onPress={p.onBack}
          style={styles.back}
        >
          <Text style={{ color: d.pencil, fontSize: 26 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            testID="month-title"
            style={{
              color: d.ink,
              fontFamily: d.serifLight,
              fontSize: 38,
              fontWeight: std ? '700' : '300',
            }}
          >
            {p.months[parts.m - 1]}
          </Text>
          <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 11, letterSpacing: 2.4 }}>
            {parts.y}
          </Text>
        </View>
        <View style={styles.back} />
      </View>

      <View style={[styles.wdRow, { marginTop: 16 }]}>
        {p.weekdaysShort.map((g, i) => (
          <Text key={i} style={[styles.wd, { color: d.ink3, fontFamily: d.sans }]}>
            {g}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((ds) => {
          const dd = Number(ds.slice(8));
          const inMonth = ds.slice(0, 7) === p.month;
          const info = data.days[ds];
          const written = !!info && (info.has_text || info.has_lists);
          return (
            <Pressable
              key={ds}
              testID={`cal-${ds}`}
              accessibilityRole="button"
              onPress={() => p.onPickDay(ds)}
              style={[
                styles.cell,
                written && { backgroundColor: d.accent2 },
                ds === p.today && { borderWidth: 1.5, borderColor: d.accent },
              ]}
            >
              <Text
                style={{
                  color: inMonth ? d.ink : d.ink3,
                  fontFamily: d.sans,
                  fontSize: 14,
                  opacity: inMonth ? 1 : 0.5,
                }}
              >
                {dd}
              </Text>
              {info?.mood ? (
                <Face kind="mood" level={info.mood} size={17} style={d.style} color={d.ink2} />
              ) : (
                <View style={{ height: 17 }} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.stats} testID="month-stats">
        <Stat
          d={d}
          icon={
            <Face
              kind="mood"
              level={st.mood_mode}
              size={34}
              style={d.style}
              color={ink(st.mood_mode)}
            />
          }
          value={st.mood_mode ? t(`diario.umore_${st.mood_mode}`) : '–'}
          label={t('diario.piu_frequente')}
        />
        <Stat
          d={d}
          icon={<Face kind="mood" level={moodAvg} size={34} style={d.style} color={ink(moodAvg)} />}
          value={num(st.mood_avg)}
          label={t('diario.media_come_andata')}
        />
        <Stat
          d={d}
          icon={<Face kind="energy" level={enAvg} size={34} style={d.style} color={ink(enAvg)} />}
          value={num(st.energy_avg)}
          label={t('diario.energia_media')}
        />
        <Stat
          d={d}
          icon={<Text style={{ fontSize: 26, textAlign: 'center' }}>📖</Text>}
          value={`${st.filled} / ${st.total}`}
          label={t('diario.pagine_scritte')}
        />
      </View>

      <View
        style={[
          styles.taped,
          { backgroundColor: std ? d.card : d.paper2, borderRadius: std ? 20 : 6 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          testID="taped-head"
          onPress={() => setOpen(!open)}
          style={styles.tapedHead}
        >
          <Text
            style={{
              flex: 1,
              color: d.ink3,
              fontFamily: d.sans,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
            }}
          >
            {t('diario.cose_imparate_questo_mese')}
          </Text>
          <Text testID="taped-n" style={{ color: d.ink2, fontFamily: d.serif, fontSize: 16 }}>
            {data.learned.length}
          </Text>
        </Pressable>
        {open && (
          <View testID="taped-body" style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            {data.learned.length === 0 ? (
              <Text style={{ color: d.ink3, fontFamily: d.sans }}>
                {t('diario.ancora_niente_scritto')}
              </Text>
            ) : (
              data.learned.map((l, i) => {
                const lp = dateParts(l.date);
                const name = p.months[lp.m - 1];
                return (
                  <View key={i} style={{ paddingVertical: 6 }}>
                    <Text style={{ color: d.ink, fontFamily: d.hand, fontSize: d.size * 0.95 }}>
                      {l.content}
                    </Text>
                    <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 10.5 }}>
                      {lp.d} {name.toLowerCase()}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  wdRow: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontSize: 10, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  stat: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  taped: { marginTop: 18, overflow: 'hidden' },
  tapedHead: { flexDirection: 'row', alignItems: 'center', padding: 14 },
});
