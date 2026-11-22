import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { WxDay, WxHour } from '@/core/account/accountApi';
import { Text } from '@/ui/CappedText';

import type { PlannerTheme } from './plannerTheme';
import { wxHourIconName } from './weather';
import { WxIcon, wxToneColors } from './WeatherUi';

/** Le misure del grafico: larghezza di una cella (un'ora), altezza della curva, margine alto e basso (WXC del sito). */
const CELL = 54;
const HEIGHT = 84;
const PAD = 13;
const CURVE = '#C4703F';

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Fra il tramonto e l'alba il sole diventa luna, ora per ora (come wxIconaNome del sito, con l'ora di quella cella). */
export function hourIcon(day: WxDay, hour: WxHour): string {
  return wxHourIconName(hour.i, day, toMin(hour.h), hour.t);
}

/**
 * Il grafico ora per ora di un giorno (`wxGrafico` del sito): sopra le ore, poi le icone su una fascia di giorno e di
 * notte (i gradini cadono su alba e tramonto), la curva dei gradi con le righe di alba, tramonto e «adesso», sotto i
 * gradi e la probabilità di pioggia. Si scorre di lato; su oggi parte dall'ora corrente.
 */
export function WxChart(p: { pt: PlannerTheme; day: WxDay; isToday: boolean; now?: Date }) {
  const { t } = useTranslation();
  const { pt, day } = p;
  const ore = day.ore;
  const now = p.now ?? new Date();
  const geo = useMemo(() => {
    if (!ore.length) return null;
    const width = ore.length * CELL;
    const base = parseInt(ore[0]!.h, 10) || 0;
    const temps = ore.map((o) => o.t).filter((v): v is number => v !== null);
    let lo = temps.length ? Math.min(...temps) : 0;
    let hi = temps.length ? Math.max(...temps) : 1;
    // giornate senza sbalzi: un minimo di respiro, e la scala segue la giornata
    if (hi - lo < 3) hi = lo + 3;
    if (!temps.length) lo = 0;
    const x = (i: number) => i * CELL + CELL / 2;
    const y = (v: number) => HEIGHT - PAD - ((v - lo) / (hi - lo)) * (HEIGHT - PAD * 2);
    const xAt = (hhmm: string | null) =>
      hhmm ? (toMin(hhmm) / 60 - base) * CELL + CELL / 2 : null;
    const points = ore.flatMap((o, i) => (o.t === null ? [] : [{ x: x(i), y: y(o.t), i }]));
    let d = '';
    points.forEach((pt2, k) => {
      if (k === 0) d = `M${pt2.x},${pt2.y.toFixed(1)}`;
      else {
        const a = points[k - 1]!;
        const mx = (a.x + pt2.x) / 2;
        d += ` C${mx},${a.y.toFixed(1)} ${mx},${pt2.y.toFixed(1)} ${pt2.x},${pt2.y.toFixed(1)}`;
      }
    });
    return { width, base, points, d, xUp: xAt(day.alba), xDown: xAt(day.tramonto) };
  }, [ore, day.alba, day.tramonto]);
  if (!geo) return null;

  const nowHour = p.isToday ? now.getHours() : -1;
  const xNow = p.isToday
    ? (now.getHours() + now.getMinutes() / 60 - geo.base) * CELL + CELL / 2
    : null;
  const dayTone = wxToneColors(pt, 'sun');
  const nightTone = wxToneColors(pt, 'moon');
  const clamp = (v: number) => Math.max(0, Math.min(geo.width, v));
  const dA = geo.xUp === null ? 0 : clamp(geo.xUp);
  let dT = geo.xDown === null ? geo.width : clamp(geo.xDown);
  if (dT < dA) dT = dA;
  const small = { fontSize: 9.5, letterSpacing: 0.8, fontFamily: pt.sans } as const;

  return (
    <ScrollView
      testID="wx-chart"
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      // su oggi si parte da adesso (un'ora di margine a sinistra); le ore passate restano lì, a un passo indietro
      contentOffset={{
        x: nowHour >= 0 ? Math.max(0, (nowHour - geo.base) * CELL - CELL) : 0,
        y: 0,
      }}
    >
      <View style={{ width: geo.width }}>
        <View style={{ flexDirection: 'row' }}>
          {ore.map((o, i) => {
            const cur = parseInt(o.h, 10) === nowHour;
            return (
              <View key={i} style={{ width: CELL, alignItems: 'center' }}>
                <Text
                  style={{
                    ...small,
                    color: cur ? pt.accentInk : pt.ink3,
                    fontWeight: cur ? '600' : '400',
                  }}
                >
                  {parseInt(o.h, 10)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ paddingTop: 3, paddingBottom: 2, marginTop: 2 }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              flexDirection: 'row',
            }}
          >
            <View style={{ width: dA, backgroundColor: nightTone.bg }} />
            <View style={{ width: dT - dA, backgroundColor: dayTone.bg }} />
            <View style={{ flex: 1, backgroundColor: nightTone.bg }} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            {ore.map((o, i) => {
              const icon = hourIcon(day, o);
              return (
                <View
                  key={i}
                  style={{ width: CELL, height: 22, marginVertical: 4, alignItems: 'center' }}
                >
                  <WxIcon name={icon} size={20} dark={pt.dark} />
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: HEIGHT }}>
          <Svg width={geo.width} height={HEIGHT} viewBox={`0 0 ${geo.width} ${HEIGHT}`}>
            {ore.map((_, i) => (
              <Line
                key={i}
                x1={i * CELL + CELL / 2}
                y1={0}
                x2={i * CELL + CELL / 2}
                y2={HEIGHT}
                stroke={pt.hair}
                strokeWidth={1}
              />
            ))}
            {geo.xUp !== null && geo.xUp >= 0 && geo.xUp <= geo.width ? (
              <Line
                x1={geo.xUp}
                y1={0}
                x2={geo.xUp}
                y2={HEIGHT}
                stroke="#D9A441"
                strokeWidth={1.4}
                strokeDasharray="3 3"
              />
            ) : null}
            {geo.xDown !== null && geo.xDown >= 0 && geo.xDown <= geo.width ? (
              <Line
                x1={geo.xDown}
                y1={0}
                x2={geo.xDown}
                y2={HEIGHT}
                stroke="#8A7BA8"
                strokeWidth={1.4}
                strokeDasharray="3 3"
              />
            ) : null}
            {xNow !== null && xNow >= 0 && xNow <= geo.width ? (
              <Line
                testID="wx-chart-now"
                x1={xNow}
                y1={0}
                x2={xNow}
                y2={HEIGHT}
                stroke={CURVE}
                strokeWidth={1.6}
              />
            ) : null}
            {geo.points.length > 1 ? (
              <Path d={geo.d} fill="none" stroke={CURVE} strokeWidth={2} strokeLinecap="round" />
            ) : null}
            {geo.points.map((q) => (
              <Circle
                key={q.i}
                cx={q.x}
                cy={q.y}
                r={parseInt(ore[q.i]!.h, 10) === nowHour ? 5 : 3.6}
                fill={CURVE}
              />
            ))}
          </Svg>
          {geo.xUp !== null && geo.xUp >= 0 && geo.xUp <= geo.width ? (
            <Text
              testID="wx-chart-sunrise"
              style={{
                position: 'absolute',
                top: 1,
                left: geo.xUp - 24,
                width: 48,
                textAlign: 'center',
                fontSize: 9,
                color: '#9A7C3E',
                fontFamily: pt.sans,
              }}
            >
              {`↑ ${day.alba}`}
            </Text>
          ) : null}
          {geo.xDown !== null && geo.xDown >= 0 && geo.xDown <= geo.width ? (
            <Text
              testID="wx-chart-sunset"
              style={{
                position: 'absolute',
                top: 1,
                left: geo.xDown - 24,
                width: 48,
                textAlign: 'center',
                fontSize: 9,
                color: '#7A6C97',
                fontFamily: pt.sans,
              }}
            >
              {`↓ ${day.tramonto}`}
            </Text>
          ) : null}
          {xNow !== null && xNow >= 0 && xNow <= geo.width ? (
            <Text
              style={{
                position: 'absolute',
                bottom: 1,
                left: xNow - 24,
                width: 48,
                textAlign: 'center',
                fontSize: 9,
                fontWeight: '500',
                color: '#B4652F',
                fontFamily: pt.sans,
              }}
            >
              {t('planner.adesso')}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row' }}>
          {ore.map((o, i) => {
            const cur = parseInt(o.h, 10) === nowHour;
            return (
              <View key={i} style={{ width: CELL, alignItems: 'center' }}>
                <Text
                  testID={`wx-chart-t-${i}`}
                  style={{
                    fontSize: 13.5,
                    color: pt.ink,
                    fontWeight: cur ? '600' : '400',
                    fontFamily: pt.sans,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {o.t !== null ? `${o.t}°` : '—'}
                </Text>
                <Text
                  style={{ fontSize: 9.5, color: '#3E6B86', minHeight: 12, fontFamily: pt.sans }}
                >
                  {o.p ? `${o.p}%` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
