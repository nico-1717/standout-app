import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HabitsTheme } from './habitsTheme';

export interface SheetAction {
  key: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

/** Il foglio che sale dal basso (come il menu «Cosa vuoi fare?» del sito). Alert nativo di Android arriva a 3 pulsanti: qui non c'è limite. */
export function ActionSheet(p: {
  visible: boolean;
  title: string;
  subtitle?: string;
  cancelLabel: string;
  actions: SheetAction[];
  th: HabitsTheme;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { th } = p;
  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose}>
      <Pressable
        accessibilityRole="button"
        style={styles.backdrop}
        onPress={p.onClose}
        testID="sheet-backdrop"
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: th.surface, paddingBottom: insets.bottom + 12 }]}
        >
          <View style={[styles.grab, { backgroundColor: th.hairline2 }]} />
          <Text style={[styles.title, { color: th.text }]} numberOfLines={1}>
            {p.title}
          </Text>
          {!!p.subtitle && <Text style={[styles.sub, { color: th.text2 }]}>{p.subtitle}</Text>}
          {p.actions.map((a) => (
            <Pressable
              key={a.key}
              testID={`sheet-${a.key}`}
              accessibilityRole="button"
              onPress={() => {
                p.onClose();
                a.onPress();
              }}
              style={[styles.btn, { backgroundColor: th.surface2 }]}
            >
              <Text style={[styles.btnText, { color: a.destructive ? th.red : th.text }]}>
                {a.label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={p.onClose} style={styles.cancel} accessibilityRole="button">
            <Text style={{ color: th.text2, fontWeight: '700', fontSize: 16 }}>
              {p.cancelLabel}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, gap: 8 },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 13, textAlign: 'center', marginBottom: 6 },
  btn: { borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
});
