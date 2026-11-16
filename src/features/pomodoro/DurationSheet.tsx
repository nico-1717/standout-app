import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { withAlpha } from './colors';
import type { PresetKind } from './repo';

const BUILTIN: Record<PresetKind, readonly number[]> = { pomodoro: [25, 50], pausa: [5, 10] };

function CloseX({ onPress, label }: { onPress: () => void; label: string }) {
  const th = useTheme();
  return (
    <Pressable
      testID="dur-close"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: th.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path d="M6 6l12 12M18 6 6 18" stroke={th.text2} strokeWidth={2.8} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

/**
 * «Durata» (il popup .dur-sheet di pomodoro.php): le durate del pomodoro e della pausa, «+ personalizza» per aggiungerne o
 * toglierne, «Conferma». Si sceglie sulla bozza e si applica solo con «Conferma», come sul sito.
 */
export function DurationSheet(p: {
  visible: boolean;
  accent: string;
  teal: string;
  pomos: number[];
  breaks: number[];
  pomoValue: number;
  breakValue: number;
  /** mostra anche la parte «pausa» (a cronometro non serve) */
  showPomodoro: boolean;
  onConfirm: (pomo: number, pausa: number) => void;
  onSave: (kind: PresetKind, minutes: number) => void;
  onRemove: (kind: PresetKind, minutes: number) => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [dPomo, setDPomo] = useState(p.pomoValue);
  const [dBreak, setDBreak] = useState(p.breakValue);
  const [custom, setCustom] = useState<PresetKind | null>(null);
  const [text, setText] = useState('');

  const add = () => {
    const m = parseInt(text, 10);
    if (custom && Number.isFinite(m) && m >= 1 && m <= 600) {
      p.onSave(custom, m);
      if (custom === 'pomodoro') setDPomo(m);
      else setDBreak(m);
    }
    setText('');
  };

  const half = (kind: PresetKind, color: string, list: number[], value: number) => (
    <View style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 11 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            boxShadow: `0 0 0 3px ${withAlpha(color, 0.18)}`,
          }}
        />
        <Text
          style={{
            color: th.text2,
            fontSize: 11.5,
            fontWeight: '700',
            letterSpacing: 0.7,
            textTransform: 'uppercase',
          }}
        >
          {kind === 'pomodoro' ? 'Pomodoro' : t('pomodoro.pausa')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map((m) => {
          const on = value === m;
          return (
            <Pressable
              key={m}
              testID={`dur-${kind}-${m}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => (kind === 'pomodoro' ? setDPomo(m) : setDBreak(m))}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 18,
                borderRadius: 14,
                backgroundColor: on ? color : th.surface2,
                boxShadow: on
                  ? `inset 0 1px 0 rgba(255,255,255,.25), inset 0 -1px 0 rgba(0,0,0,.16), 0 7px 18px -8px ${withAlpha(color, 0.85)}`
                  : `inset 0 0 0 0.5px ${th.hairline}`,
              }}
            >
              <Text
                style={{
                  color: on ? '#fff' : th.text,
                  fontWeight: on ? '700' : '600',
                  fontSize: 14.5,
                  letterSpacing: -0.2,
                }}
              >
                {m} min
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          testID={`dur-add-${kind}`}
          accessibilityRole="button"
          onPress={() => {
            setCustom(kind);
            setText('');
          }}
          style={{
            paddingVertical: 11,
            paddingHorizontal: 18,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: th.hairline2,
          }}
        >
          <Text style={{ color: th.text2, fontWeight: '600', fontSize: 14.5, letterSpacing: -0.2 }}>
            + {t('pomodoro.personalizza')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const customKind = custom;
  const mine = (customKind === 'pomodoro' ? p.pomos : p.breaks).filter(
    (m) => customKind && !BUILTIN[customKind].includes(m),
  );
  const markColor = customKind === 'pausa' ? p.teal : p.accent;
  const value = customKind === 'pausa' ? dBreak : dPomo;

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      {p.visible ? (
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('comune.chiudi')}
            style={StyleSheet.absoluteFill}
            onPress={p.onClose}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            testID="dur-sheet"
            style={{
              backgroundColor: th.surface,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              overflow: 'hidden',
              paddingBottom: insets.bottom,
              width: '100%',
              maxWidth: 520,
              alignSelf: 'center',
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 38,
                height: 5,
                borderRadius: 3,
                backgroundColor: th.hairline2,
                marginTop: 8,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingTop: 12,
                paddingBottom: 6,
              }}
            >
              <Text
                style={{ color: th.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}
              >
                {customKind
                  ? `${t('pomodoro.gestisci')} ${customKind === 'pomodoro' ? 'Pomodoro' : t('pomodoro.pausa')}`
                  : t('pomodoro.durata')}
              </Text>
              <CloseX
                label={t('comune.chiudi')}
                onPress={customKind ? () => setCustom(null) : p.onClose}
              />
            </View>
            {customKind ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 22 }}
              >
                <Text
                  style={{
                    color: th.text2,
                    fontSize: 11.5,
                    fontWeight: '700',
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    marginBottom: 11,
                  }}
                >
                  {t('pomodoro.aggiungi_durata')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <TextInput
                    testID="dur-input"
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={add}
                    keyboardType="number-pad"
                    placeholder="min"
                    placeholderTextColor={th.text3}
                    style={{
                      flex: 1,
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      backgroundColor: th.surface2,
                      color: th.text,
                      fontSize: 18,
                      fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                      boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
                    }}
                  />
                  <Pressable
                    testID="dur-save"
                    accessibilityRole="button"
                    onPress={add}
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: 20,
                      borderRadius: 14,
                      backgroundColor: markColor,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 -1px 0 rgba(0,0,0,.16), 0 8px 20px -10px ${withAlpha(markColor, 0.9)}`,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                      {t('comune.aggiungi')}
                    </Text>
                  </Pressable>
                </View>
                <Text
                  style={{
                    color: th.text2,
                    fontSize: 11.5,
                    fontWeight: '700',
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    marginTop: 24,
                    marginBottom: 11,
                  }}
                >
                  {t('pomodoro.create_da_te')}
                </Text>
                {mine.length === 0 ? (
                  <Text
                    style={{
                      color: th.text2,
                      fontSize: 14,
                      textAlign: 'center',
                      paddingVertical: 18,
                    }}
                  >
                    {t('pomodoro.nessuna_durata')}
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {mine.map((m) => {
                      const on = value === m;
                      return (
                        <View
                          key={m}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: 11,
                            paddingLeft: 15,
                            paddingRight: 8,
                            borderRadius: 14,
                            backgroundColor: on ? withAlpha(markColor, 0.14) : th.surface2,
                            boxShadow: on
                              ? `inset 0 0 0 1.5px ${withAlpha(markColor, 0.42)}`
                              : `inset 0 0 0 0.5px ${th.hairline}`,
                          }}
                        >
                          <Text
                            style={{
                              color: th.text,
                              fontWeight: '700',
                              fontSize: 15.5,
                              letterSpacing: -0.2,
                            }}
                          >
                            {m} min {on ? '✓' : ''}
                          </Text>
                          <Pressable
                            testID={`dur-del-${customKind}-${m}`}
                            accessibilityRole="button"
                            accessibilityLabel={t('comune.elimina')}
                            hitSlop={6}
                            onPress={() => {
                              p.onRemove(customKind, m);
                              if (customKind === 'pomodoro' && dPomo === m) setDPomo(25);
                              if (customKind === 'pausa' && dBreak === m) setDBreak(5);
                            }}
                            style={{ padding: 7, borderRadius: 10 }}
                          >
                            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                              <Path
                                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                                stroke={th.red}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            ) : (
              <>
                {p.showPomodoro ? (
                  <>
                    {half('pomodoro', p.accent, p.pomos, dPomo)}
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: th.hairline,
                        marginVertical: 2,
                        marginHorizontal: 18,
                      }}
                    />
                  </>
                ) : null}
                {half('pausa', p.teal, p.breaks, dBreak)}
                <Pressable
                  testID="dur-confirm"
                  accessibilityRole="button"
                  onPress={() => p.onConfirm(dPomo, dBreak)}
                  style={({ pressed }) => ({
                    marginHorizontal: 18,
                    marginTop: 16,
                    marginBottom: 12,
                    paddingVertical: 16,
                    borderRadius: 16,
                    alignItems: 'center',
                    backgroundColor: p.accent,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 -1px 0 rgba(0,0,0,.16), 0 12px 26px -12px ${withAlpha(p.accent, 0.9)}`,
                    transform: [{ scale: pressed ? 0.975 : 1 }],
                  })}
                >
                  <Text
                    style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: -0.2 }}
                  >
                    {t('comune.conferma')}
                  </Text>
                </Pressable>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
});
