import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ColorPicker, { HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { PrimaryButton, TextButton } from '@/ui/kit';

/** Il colore come lo vuole il sito: «#RRGGBB» maiuscolo, senza trasparenza. */
export const toHex6 = (hex: string): string => `#${hex.replace('#', '').slice(0, 6).toUpperCase()}`;

/**
 * «Colore personalizzato» (come l'`<input type="color">` del sito): un tondo arcobaleno che apre un foglio con il
 * selettore (quadro + tinta) e un'anteprima. Si salva solo con «Fatto», così trascinando non si cambia il progetto
 * a ogni passo. Il selettore è tutto JavaScript (Reanimated + Gesture Handler), quindi arriva col telefono già com'è.
 */
export function CustomColor(p: {
  /** il colore con cui il selettore si apre */
  value: string;
  /** quello scelto, «#RRGGBB» */
  onPick: (hex: string) => void;
  /** il tondo arcobaleno è già selezionato (il colore non è uno dei dodici) */
  active?: boolean;
  testID?: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toHex6(p.value));
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        testID={p.testID ?? 'custom-color'}
        accessibilityRole="button"
        accessibilityLabel={t('progetti.colore_personalizzato')}
        onPress={() => {
          setDraft(toHex6(p.value));
          setOpen(true);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            overflow: 'hidden',
            borderWidth: p.active ? 3 : 0,
            borderColor: th.text,
            backgroundColor: p.active ? p.value : '#8E8E93',
          }}
        >
          {/* sei fasce di colore: un tondo arcobaleno senza bisogno di immagini */}
          {p.active
            ? null
            : ['#FF3B30', '#FFCC00', '#34C759', '#32ADE6', '#5856D6', '#FF2D55'].map((c) => (
                <View key={c} style={{ flex: 1, backgroundColor: c }} />
              ))}
        </View>
        <Text style={{ color: th.text, fontSize: 15 }}>{t('progetti.colore_personalizzato')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        {/* dentro un Modal i gesti hanno bisogno della loro radice */}
        <GestureHandlerRootView style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('comune.annulla')}
            style={StyleSheet.absoluteFill}
            onPress={close}
          />
          <View testID="custom-color-sheet" style={[styles.card, { backgroundColor: th.surface }]}>
            <Text style={{ color: th.text, fontSize: 18, fontWeight: '800' }}>
              {t('progetti.colore_personalizzato')}
            </Text>
            <ColorPicker
              value={draft}
              onCompleteJS={(c) => setDraft(toHex6(c.hex))}
              style={{ gap: 16 }}
            >
              <Preview hideInitialColor hideText style={{ height: 44, borderRadius: 12 }} />
              <Panel1 style={{ height: 180, borderRadius: 14 }} />
              <HueSlider style={{ borderRadius: 14 }} />
            </ColorPicker>
            <PrimaryButton
              testID="custom-color-done"
              label={t('comune.applica')}
              onPress={() => {
                p.onPick(draft);
                close();
              }}
            />
            <TextButton label={t('comune.annulla')} onPress={close} />
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,.4)',
  },
  card: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 20, gap: 16 },
});
