import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

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
  stroke = 9,
}: {
  done: number;
  total: number;
  color: string;
  track: string;
  size?: number;
  stroke?: number;
}) {
  const r = size / 2 - stroke / 2 - 2;
  const circ = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
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

/** L'andamento della media come nel sito: linea, obiettivo e proiezione tratteggiati, un punto per esame (oro se con lode). */
export function TrendChart({
  real,
  proj,
  target,
  color,
  gold,
  th,
  width,
}: {
  real: TrendPoint[];
  proj: TrendPoint[];
  target: number | null;
  color: string;
  gold: string;
  th: Theme;
  width: number;
}) {
  const { t } = useTranslation();
  const height = Math.round((width * 196) / 340);
  const sx = width / 340;
  const sy = height / 196;
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const innerW = 340 - padL - padR;
  const innerH = 196 - padT - padB;
  const maxI = Math.max(
    real.length ? real[real.length - 1]!.i : 1,
    proj.length ? proj[proj.length - 1]!.i : 1,
    1,
  );
  const X = (i: number) => (padL + (maxI <= 1 ? innerW / 2 : ((i - 1) / (maxI - 1)) * innerW)) * sx;
  const Y = (v: number) => (padT + (1 - (Math.max(18, Math.min(30, v)) - 18) / 12) * innerH) * sy;
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
          x1={padL * sx}
          x2={(340 - padR) * sx}
          y1={Y(v)}
          y2={Y(v)}
          stroke={th.hairline}
          strokeWidth={1}
        />
      ))}
      {[18, 24, 30].map((v) => (
        <SvgText
          key={`l${v}`}
          x={(padL - 6) * sx}
          y={Y(v) + 3}
          textAnchor="end"
          fontSize={9}
          fill={th.text3}
        >
          {String(v)}
        </SvgText>
      ))}
      {target != null ? (
        <Line
          x1={padL * sx}
          x2={(340 - padR) * sx}
          y1={Y(target)}
          y2={Y(target)}
          stroke={th.text3}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      ) : null}
      {real.length > 1 ? (
        <Polyline
          points={line(real)}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {proj.length > 1 ? (
        <Polyline
          points={line(proj)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          opacity={0.55}
        />
      ) : null}
      {real.map((p) => (
        <Circle
          key={p.i}
          cx={X(p.i)}
          cy={Y(p.grade ?? p.avg)}
          r={3.5}
          fill={p.lode ? gold : color}
          stroke={p.lode ? gold : color}
          strokeWidth={2}
        />
      ))}
      {proj
        .slice(1)
        .map((p) =>
          p.grade != null ? (
            <Circle
              key={`p${p.i}`}
              cx={X(p.i)}
              cy={Y(p.grade)}
              r={3.5}
              fill={th.surface}
              stroke={color}
              strokeWidth={2}
            />
          ) : null,
        )}
    </Svg>
  );
}

/** Un tasto -/+ con il valore in mezzo (per voto, obiettivo, previsione), come `.stepper` del sito. */
export function Stepper({
  value,
  onMinus,
  onPlus,
  th,
  testID,
  accent,
  gold,
  lode,
  hideValue,
  big,
}: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  th: Theme;
  testID: string;
  accent?: string;
  gold?: string;
  lode?: boolean;
  /** il valore sta altrove (per esempio in grande sopra): qui restano solo − e + */
  hideValue?: boolean;
  /** la versione grande, coi tasti tondi (voto di un esame) */
  big?: boolean;
}) {
  const { t } = useTranslation();
  const c = accent ?? th.brand;
  if (big)
    return <BigStepper value={value} onMinus={onMinus} onPlus={onPlus} th={th} testID={testID} />;
  const btn = {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: th.surface2,
        borderRadius: 11,
        overflow: 'hidden',
      }}
    >
      <Pressable
        testID={`${testID}-minus`}
        accessibilityRole="button"
        accessibilityLabel={t('fc.diminuisci')}
        onPress={onMinus}
        style={({ pressed }) => [btn, pressed ? { backgroundColor: th.hairline } : null]}
      >
        <Text style={{ color: c, fontSize: 20.8, fontWeight: '700' }}>−</Text>
      </Pressable>
      {hideValue ? null : (
        <Text
          testID={`${testID}-value`}
          style={{
            color: lode ? (gold ?? th.orange) : th.text,
            fontSize: 16,
            fontWeight: '800',
            minWidth: 52,
            textAlign: 'center',
          }}
        >
          {value}
        </Text>
      )}
      <Pressable
        testID={`${testID}-plus`}
        accessibilityRole="button"
        accessibilityLabel={t('fc.aumenta')}
        onPress={onPlus}
        style={({ pressed }) => [btn, pressed ? { backgroundColor: th.hairline } : null]}
      >
        <Text style={{ color: c, fontSize: 20.8, fontWeight: '700' }}>+</Text>
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

/** Il -/+ grande della scheda di un esame: tasti tondi e voto in grande. */
function BigStepper({
  value,
  onMinus,
  onPlus,
  th,
  testID,
}: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  th: Theme;
  testID: string;
}) {
  const { t } = useTranslation();
  const btn = {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: th.surface2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
      <Pressable
        testID={`${testID}-minus`}
        accessibilityRole="button"
        accessibilityLabel={t('fc.diminuisci')}
        onPress={onMinus}
        style={btn}
      >
        <Text style={{ color: th.brand, fontSize: 26, fontWeight: '700' }}>−</Text>
      </Pressable>
      <Text
        testID={`${testID}-value`}
        style={{
          color: th.text,
          fontSize: 44,
          fontWeight: '800',
          minWidth: 90,
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
        <Text style={{ color: th.brand, fontSize: 26, fontWeight: '700' }}>+</Text>
      </Pressable>
    </View>
  );
}

/** Il cestino bianco del tasto che compare scorrendo una riga. */
export function TrashIcon({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"
        stroke="#fff"
        strokeWidth={2.1}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
