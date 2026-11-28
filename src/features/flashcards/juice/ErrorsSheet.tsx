import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

export interface ErrorRow {
  key: string;
  position: number;
  label: string;
  /** un sottoconcetto: il numero è viola */
  isChild?: boolean;
}

/**
 * L'elenco delle carte da rivedere di un tratto del tracciato (#erroriElenco del sito): una tendina sotto
 * l'intestazione, si apre toccando un disco e si chiude toccando fuori. Toccare una riga porta a quella carta.
 */
export function ErrorsSheet({
  visible,
  from,
  to,
  rows,
  top,
  accent,
  onPick,
  onClose,
}: {
  visible: boolean;
  from: number;
  to: number;
  rows: readonly ErrorRow[];
  /** dove finisce l'intestazione: la tendina parte poco sotto */
  top: number;
  accent: string;
  onPick: (position: number) => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        testID="fcg-errors-outside"
        accessibilityLabel={t('comune.chiudi')}
        onPress={onClose}
        style={{ flex: 1 }}
      >
        <Animated.View
          testID="fcg-errors"
          entering={FadeIn.duration(180)}
          onStartShouldSetResponder={() => true}
          style={{
            position: 'absolute',
            top: top + 6,
            alignSelf: 'center',
            width: '92%',
            maxWidth: 420,
            borderRadius: 18,
            backgroundColor: th.surface,
            borderWidth: 0.5,
            borderColor: th.hairline,
            boxShadow: '0 18px 44px -12px rgba(0,0,0,0.45)',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              paddingTop: 12,
              paddingHorizontal: 14,
              paddingBottom: 10,
              borderBottomWidth: 0.5,
              borderBottomColor: th.hairline,
            }}
          >
            <Text
              style={{
                color: accent,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.1,
                textTransform: 'uppercase',
              }}
            >
              {t('fc.gm_f2_elenco_tratto', { a: from, b: to })}
            </Text>
            <Pressable
              testID="fcg-errors-close"
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              hitSlop={10}
              onPress={onClose}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: th.surface2,
              }}
            >
              <Text style={{ color: th.text2, fontSize: 12, fontWeight: '800' }}>✕</Text>
            </Pressable>
          </View>
          {/* tre righe alla volta, con un accenno della quarta: si capisce che scorre */}
          <ScrollView style={{ maxHeight: 3 * 52 + 14 }} contentContainerStyle={{ padding: 6 }}>
            {rows.map((r, i) => (
              <Pressable
                key={r.key}
                testID="fcg-error-row"
                accessibilityRole="button"
                onPress={() => onPick(r.position)}
                style={({ pressed }) => ({
                  height: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  borderTopWidth: i ? 0.5 : 0,
                  borderTopColor: th.hairline,
                  backgroundColor: pressed ? th.surface2 : 'transparent',
                })}
              >
                <View
                  style={{
                    minWidth: 26,
                    height: 22,
                    paddingHorizontal: 6,
                    borderRadius: 99,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${r.isChild ? th.purple : accent}2E`,
                  }}
                >
                  <Text
                    style={{
                      color: r.isChild ? th.purple : accent,
                      fontSize: 11,
                      fontWeight: '800',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {r.position}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: th.text, fontSize: 14, fontWeight: '600' }}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
