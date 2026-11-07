import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import type { HabitsTheme } from './habitsTheme';

/**
 * Il foglio che sale dal basso (su iPad una carta al centro), con titolo, tasto «✕» e un piede facoltativo:
 * lo stesso aspetto di .hb-sheet del sito. Il contenuto vive solo mentre il foglio è aperto.
 */
export function Sheet(p: {
  visible: boolean;
  title: string;
  th: HabitsTheme;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const { th } = p;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      {p.visible && (
        <View style={[styles.backdrop, wide && { justifyContent: 'center', alignItems: 'center' }]}>
          <Pressable
            accessibilityRole="button"
            style={StyleSheet.absoluteFill}
            onPress={p.onClose}
            accessibilityLabel={t('comune.annulla')}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            testID={p.testID}
            style={[
              styles.sheet,
              { backgroundColor: th.bg, maxHeight: Math.min(height - insets.top - 12, 900) },
              wide
                ? { width: 600, borderRadius: 30 }
                : { borderTopLeftRadius: 30, borderTopRightRadius: 30 },
            ]}
          >
            <View style={[styles.grab, { backgroundColor: th.hairline2 }]} />
            <View style={styles.head}>
              <Text style={[styles.title, { color: th.text }]} numberOfLines={1}>
                {p.title}
              </Text>
              <Pressable
                testID="sheet-close"
                accessibilityRole="button"
                accessibilityLabel={t('comune.chiudi')}
                onPress={p.onClose}
                style={[styles.close, { backgroundColor: th.surface2 }]}
              >
                <Text style={{ color: th.text2, fontSize: 18, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
            <View style={{ flexShrink: 1, minHeight: 200 }}>{p.children}</View>
            {p.footer && (
              <View
                style={[
                  styles.foot,
                  {
                    borderTopColor: th.hairline,
                    paddingBottom: Math.max(insets.bottom, 14),
                    backgroundColor: th.surface,
                  },
                ]}
              >
                {p.footer}
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.42)', justifyContent: 'flex-end' },
  sheet: { overflow: 'hidden' },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { flex: 1, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foot: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
  },
});
