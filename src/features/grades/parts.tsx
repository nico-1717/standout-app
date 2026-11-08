import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { Theme } from '@/core/theme/ThemeProvider';

import { effGrade, type Exam, type GradeData, type TrendPoint } from './logic';

export const fmt2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
export const trimNum = (x: number) => {
  const r = Math.round(x * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
};

/** L'anello «esami fatti su esami totali». */
export function Ring({
  done,
  total,
  color,
  track,
  size = 96,
}: {
  done: number;
  total: number;
  color: string;
  track: string;
  size?: number;
}) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={9} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circ}`}
        strokeDashoffset={circ * (1 - frac)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Il voto di un esame come lo mostra la lista: «28», «30L», «✓» per l'idoneità. */
export function gradeLabel(d: GradeData, e: Exam): string {
  if (e.status !== 'done') return '';
  if (e.is_pass_fail) return '✓';
  if (e.grade == null) return '–';
  return e.has_honors ? `${Math.round(effGrade(d, e) >= 30 ? 30 : e.grade)}L` : String(e.grade);
}

/** L'andamento della media: linea, obiettivo tratteggiato, proiezione tratteggiata e un punto per esame. */
export function TrendChart({
  real,
  proj,
  target,
  color,
  th,
  width,
  height = 150,
}: {
  real: TrendPoint[];
  proj: TrendPoint[];
  target: number | null;
  color: string;
  th: Theme;
  width: number;
  height?: number;
}) {
  const { t } = useTranslation();
  const padL = 26;
  const padR = 10;
  const padT = 8;
  const padB = 16;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxI = Math.max(real.length, proj.length ? proj[proj.length - 1]!.i : 0, 1);
  const X = (i: number) => padL + (maxI <= 1 ? innerW / 2 : ((i - 1) / (maxI - 1)) * innerW);
  const Y = (v: number) => padT + (1 - (Math.max(18, Math.min(30, v)) - 18) / 12) * innerH;
  const line = (pts: TrendPoint[]) => pts.map((p) => `${X(p.i)},${Y(p.avg)}`).join(' ');
  return (
    <Svg
      width={width}
      height={height}
      testID="grades-chart"
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('voti.app_grafico_alt', {
        n: real.length,
        da: fmt2(real[0]?.avg ?? 0),
        a: fmt2(real[real.length - 1]?.avg ?? 0),
      })}
    >
      {[18, 24, 30].map((v) => (
        <Line
          key={v}
          x1={padL}
          x2={width - padR}
          y1={Y(v)}
          y2={Y(v)}
          stroke={th.hairline}
          strokeWidth={1}
        />
      ))}
      {target != null ? (
        <Line
          x1={padL}
          x2={width - padR}
          y1={Y(target)}
          y2={Y(target)}
          stroke={th.orange}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      ) : null}
      {proj.length > 1 ? (
        <Polyline
          points={line(proj)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
      ) : null}
      {real.length > 1 ? (
        <Polyline
          points={line(real)}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ) : null}
      {real.map((p) => (
        <Circle
          key={p.i}
          cx={X(p.i)}
          cy={Y(p.grade ?? p.avg)}
          r={3}
          fill={p.lode ? th.orange : th.surface}
          stroke={color}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}

/** Un tasto -/+ con il valore in mezzo (per voto, obiettivo, previsione). */
export function Stepper({
  value,
  onMinus,
  onPlus,
  th,
  testID,
  big,
}: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  th: Theme;
  testID: string;
  big?: boolean;
}) {
  const { t } = useTranslation();
  const btn = {
    width: big ? 48 : 34,
    height: big ? 48 : 34,
    borderRadius: 999,
    backgroundColor: th.surface2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: big ? 18 : 8 }}>
      <Pressable
        testID={`${testID}-minus`}
        accessibilityRole="button"
        accessibilityLabel={t('fc.diminuisci')}
        onPress={onMinus}
        style={btn}
      >
        <Text style={{ color: th.brand, fontSize: big ? 26 : 20, fontWeight: '700' }}>−</Text>
      </Pressable>
      <Text
        testID={`${testID}-value`}
        style={{
          color: th.text,
          fontSize: big ? 44 : 18,
          fontWeight: '800',
          minWidth: big ? 90 : 36,
          textAlign: 'center',
        }}
      >
        {value}
      </Text>
      <Pressable
        testID={`${testID}-plus`}
        accessibilityRole="button"
        accessibilityLabel={t('fc.aumenta')}
        onPress={onPlus}
        style={btn}
      >
        <Text style={{ color: th.brand, fontSize: big ? 26 : 20, fontWeight: '700' }}>+</Text>
      </Pressable>
    </View>
  );
}

/** Un tasto a pillola, acceso o spento. */
export function Pill({
  label,
  on,
  onPress,
  th,
  testID,
  color,
}: {
  label: string;
  on?: boolean;
  onPress: () => void;
  th: Theme;
  testID?: string;
  color?: string;
}) {
  const c = color ?? th.brand;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: on ? c : th.surface2,
      }}
    >
      <Text style={{ color: on ? '#fff' : th.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Il colore della pagina: quello del corso, a meno che non sia mai stato scelto (allora segue l'app). */
export const accentOf = (accent: string, brand: string): string =>
  !accent || accent.toUpperCase() === '#0A84FF' ? brand : accent;
