import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, PrimaryButton, TextButton } from '@/ui/kit';

import { dayLabel, hours } from './format';
import type { TodayView } from './view';

/** «Oggi»: i blocchi del giorno (con quanto è già fatto e il tasto per avviare), cosa è stato saltato ieri, la settimana e il prossimo esame. */
export function PlanToday(p: {
  view: TodayView;
  lang: string;
  onStart: (project: string, minutes: number, daily: boolean) => void;
  onMove: (project: string, to: string) => void;
  onLeave: (project: string) => void;
  onAutoplan: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const v = p.view;
  let total = 0;
  let done = 0;
  for (const b of v.blocks)
    if (b.kind === 'study') {
      total += b.minutes;
      done += Math.min(b.done, b.minutes);
    }
  const pct =
    v.week.planned > 0 ? Math.min(100, Math.round((v.week.done * 100) / v.week.planned)) : 0;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <Text style={{ color: th.text2 }}>
          {dayLabel(v.today, p.lang, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Text
          testID="today-title"
          style={{ color: th.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}
        >
          {t('piano.oggi')}
        </Text>
        <Text testID="today-line" style={{ color: th.text2 }}>
          {v.blocks.length
            ? t('piano.oggi_riga', { n: v.blocks.length, p: hours(total), f: hours(done) })
            : t('piano.oggi_niente')}
        </Text>
      </View>

      {v.skipped.map((s) => (
        <Card key={s.project} style={{ padding: 16, gap: 10 }}>
          <Text
            testID={`skip-${s.project}`}
            style={{ color: th.text, fontWeight: '700', fontSize: 16 }}
          >
            {t('piano.saltato_t', { n: s.name, h: hours(s.missing) })}
          </Text>
          {s.moveTo ? (
            <Text style={{ color: th.text2 }}>
              {t('piano.saltato_sposta', {
                d:
                  s.moveTo === v.today
                    ? t('piano.oggi').toLowerCase()
                    : dayLabel(s.moveTo, p.lang, { weekday: 'long' }),
              })}
            </Text>
          ) : (
            <Text style={{ color: th.text2 }}>{t('piano.saltato_pieno')}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {s.moveTo ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  testID={`skip-move-${s.project}`}
                  label={t('piano.sposta')}
                  onPress={() => p.onMove(s.project, s.moveTo!)}
                />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <TextButton
                testID={`skip-leave-${s.project}`}
                label={t('piano.lascia')}
                onPress={() => p.onLeave(s.project)}
              />
            </View>
          </View>
        </Card>
      ))}

      {v.blocks.map((b) => {
        const finished = b.kind === 'study' && b.done >= b.minutes * 0.9;
        return (
          <Card
            key={`${b.project}-${b.kind}`}
            style={{ flexDirection: 'row', alignItems: 'center', opacity: finished ? 0.65 : 1 }}
          >
            <View
              style={{ width: 6, alignSelf: 'stretch', backgroundColor: b.rootColor || b.color }}
            />
            <View style={{ flex: 1, padding: 14, gap: 2 }}>
              <Text style={{ color: th.text2, fontSize: 12 }}>
                {b.rootName}
                {b.kind === 'review' ? ` · ${t('piano.ripasso')}` : ''}
              </Text>
              <Text
                testID={`block-${b.project}`}
                style={{ color: th.text, fontWeight: '700', fontSize: 16 }}
              >
                {b.name}
              </Text>
              <Text style={{ color: th.text2, fontSize: 13 }}>
                {hours(b.minutes)}
                {b.done ? ` · ${t('piano.fatti_n', { h: hours(b.done) })}` : ''}
              </Text>
            </View>
            <Pressable
              testID={`block-play-${b.project}`}
              accessibilityRole="button"
              accessibilityLabel={t('piano.avvia', { n: b.name })}
              onPress={() => p.onStart(b.project, Math.max(1, b.minutes - b.done), b.daily)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                margin: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: finished ? th.greenSoft : th.brandSoft,
              }}
            >
              <Text style={{ color: finished ? th.green : th.brand, fontSize: 20 }}>
                {finished ? '✓' : '▶'}
              </Text>
            </Pressable>
          </Card>
        );
      })}

      <Card style={{ padding: 16, gap: 10 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <Text style={{ color: th.text, fontWeight: '700', fontSize: 16 }}>
            {t('piano.questa_settimana')}
          </Text>
          <Text testID="week-line" style={{ color: th.text2 }}>
            {t('piano.x_di_y', { a: hours(v.week.done), b: hours(v.week.planned) })}
          </Text>
        </View>
        <View
          style={{ height: 10, borderRadius: 5, backgroundColor: th.surface2, overflow: 'hidden' }}
        >
          <View style={{ width: `${pct}%`, height: 10, backgroundColor: th.brand }} />
        </View>
        {v.nextExam ? (
          <Text testID="next-exam" style={{ color: th.text2 }}>
            {t('piano.esame_tra', { n: v.nextExam.name, d: v.nextExam.days })}
          </Text>
        ) : null}
      </Card>

      {!v.blocks.length ? (
        <PrimaryButton
          testID="today-autoplan"
          label={t('piano.riempi_calendario')}
          onPress={p.onAutoplan}
        />
      ) : null}
    </View>
  );
}
