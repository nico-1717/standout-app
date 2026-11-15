import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme, type Theme } from '@/core/theme/ThemeProvider';
import { haptic } from '@/ui/motion';

import { PjIcon } from './PjIcons';
import type { Project } from './logic';

/* I pezzi della pagina Progetti che stanno in più viste: intestazione con i progetti principali, interruttore a
   segmenti, titoletti e il riquadro bianco delle liste (progetti.css del sito). Misure prese dalla pagina vera. */

/** Il fondo del selettore a segmenti (.pr-seg: il colore del testo al 7%). */
export const segTrack = (th: Theme) =>
  th.scheme === 'dark' ? 'rgba(235,235,245,.10)' : 'rgba(28,28,30,.07)';

/** Il riquadro delle liste (.pr-list / .pr-ov): bianco, angoli 18, righe separate da una linea sottile. */
export function ListCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const th = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: th.surface,
          borderRadius: Math.min(th.radiusCard, 20),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: th.cardEdge,
          overflow: 'hidden',
          boxShadow: th.cardShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** La linea sottile fra due righe, che parte dopo il pallino come sul sito. */
export function RowLine({ inset }: { inset: number }) {
  const th = useTheme();
  return (
    <View
      style={{ height: StyleSheet.hairlineWidth, marginLeft: inset, backgroundColor: th.hairline }}
    />
  );
}

/** Il titoletto sopra un blocco (.pr-lab): maiuscolo, 12.5, con in fondo strumenti o un conto. */
export function Lab({ children, right }: { children: string; right?: ReactNode }) {
  const th = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 2,
        paddingHorizontal: 6,
        minHeight: 30,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: th.text2,
          fontSize: 12.5,
          fontWeight: '600',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
      {right}
    </View>
  );
}

/** Il selettore a segmenti (.pr-seg e .pp-views): due o tre voci, quella accesa è bianca. */
export function Seg<T extends string>({
  items,
  value,
  onChange,
  testID,
  compact,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID: string;
  compact?: boolean;
}) {
  const th = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 3,
        gap: 2,
        borderRadius: 11,
        backgroundColor: segTrack(th),
      }}
    >
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable
            key={it.id}
            testID={`${testID}-${it.id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              haptic.tap();
              onChange(it.id);
            }}
            style={{
              flex: 1,
              minHeight: compact ? 32 : 34,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? th.surface : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : undefined,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: on ? th.text : th.text2,
                fontSize: compact ? 13.5 : 14,
                fontWeight: '600',
              }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Il tondo senza bordo dei tasti in alto (.hdr-tool): 38 per 38, icona grigia. */
function HdrTool({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: 'calendar' | 'gear';
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? th.surface2 : 'transparent',
      })}
    >
      <PjIcon name={icon} color={th.text2} size={21} />
    </Pressable>
  );
}

/**
 * L'intestazione della pagina (.app-header): «Progetti», i tasti calendario (scadenze e obiettivi) e impostazioni, il
 * tondo con l'iniziale, e sotto «Tutti» e i progetti principali come schede da far scorrere.
 */
export function ProjectsHeader({
  roots,
  current,
  onPick,
  onDates,
  onOptions,
}: {
  roots: Project[];
  /** il progetto principale aperto, o null per «Tutti» */
  current: string | null;
  onPick: (uuid: string | null) => void;
  onDates: () => void;
  onOptions: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authState } = useApp();
  const name = authState.status === 'signedIn' ? authState.user.username : '';
  const initial = (name.trim().charAt(0) || '·').toUpperCase();
  return (
    <View
      style={{
        paddingTop: insets.top + 10,
        backgroundColor: th.headerGlass,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: th.hairline,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          minHeight: 38,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: th.text,
            fontSize: 21,
            fontWeight: th.display ? undefined : '800',
            fontFamily: th.display,
            letterSpacing: -0.5,
          }}
        >
          {t('progetti.titolo_pagina')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
          <HdrTool
            icon="calendar"
            testID="proj-dates"
            label={t('progetti.scadenze_e_obiettivi')}
            onPress={onDates}
          />
          <HdrTool
            icon="gear"
            testID="proj-options"
            label={t('progetti.impostazioni')}
            onPress={onOptions}
          />
          <Pressable
            testID="proj-avatar"
            accessibilityRole="button"
            accessibilityLabel={t('app.account')}
            onPress={() => router.push('/account')}
            style={{
              width: 34,
              height: 34,
              marginLeft: 4,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: th.brand,
              boxShadow: '0 3px 10px rgba(88,86,214,.35)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{initial}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 19, paddingBottom: 11, gap: 2 }}
      >
        <Chip
          testID="proj-chip-all"
          label={t('progetti.tutti')}
          on={current === null}
          onPress={() => onPick(null)}
        />
        {roots.map((p) => (
          <Chip
            key={p.uuid}
            testID={`proj-chip-${p.uuid}`}
            label={p.name}
            dot={p.color}
            on={current === p.uuid}
            onPress={() => onPick(p.uuid)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  dot,
  on,
  onPress,
  testID,
}: {
  label: string;
  dot?: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      onPress={() => {
        if (!on) haptic.tap();
        onPress();
      }}
      style={{
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: on ? th.surface : 'transparent',
        boxShadow: on ? '0 1px 4px rgba(0,0,0,.10)' : undefined,
      }}
    >
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
      <Text
        numberOfLines={1}
        style={{ color: on ? th.text : th.text2, fontSize: 14.5, fontWeight: on ? '700' : '500' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
