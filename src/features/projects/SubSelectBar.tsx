import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { haptic } from '@/ui/motion';

import type { BulkAction } from './BulkDialogs';

/**
 * La barra delle azioni della selezione (.pr-sub-bulkbar del sito): ferma in basso mentre si scorre, entra dal basso.
 * ✕ chiude, poi il conto, «Seleziona tutti», Colore, Progetto padre ed Elimina. Si scorre di lato se non ci stanno.
 */
export function SubSelectBar(p: {
  count: number;
  /** un avviso al posto del conto (es. «Seleziona almeno un sotto-progetto») */
  hint: string | null;
  onClose: () => void;
  onAll: () => void;
  onAction: (a: Exclude<BulkAction, null>) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const pill = (bg: string, fg: string) => ({
    backgroundColor: bg,
    paddingHorizontal: 13,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center' as const,
    flexShrink: 0,
  });
  const btn = (id: string, label: string, bg: string, fg: string, run: () => void) => (
    <Pressable
      key={id}
      testID={id}
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        run();
      }}
      style={({ pressed }) => ({ ...pill(bg, fg), transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Text style={{ color: fg, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  const text =
    p.hint ??
    (p.count === 0
      ? t('progetti.0_selezionati')
      : t(p.count === 1 ? 'progetti.n_selezionato' : 'progetti.n_selezionati', { n: p.count }));
  return (
    <Animated.View
      entering={SlideInDown.duration(280)}
      style={{
        alignSelf: 'stretch',
        borderRadius: 16,
        backgroundColor: th.surface,
        paddingVertical: 10,
        paddingHorizontal: 12,
        boxShadow: th.cardShadow,
        borderWidth: 0.5,
        borderColor: th.hairline,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ alignItems: 'center', gap: 8 }}
      >
        <Pressable
          testID="sub-select-close"
          accessibilityRole="button"
          accessibilityLabel={t('comune.annulla')}
          onPress={p.onClose}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: th.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: th.text2, fontSize: 15, fontWeight: '800' }}>✕</Text>
        </Pressable>
        <View style={{ flexShrink: 0, paddingHorizontal: 4 }}>
          <Text testID="sub-count" style={{ color: th.text2, fontSize: 12.5, fontWeight: '700' }}>
            {text}
          </Text>
        </View>
        {btn(
          'sub-all',
          p.count > 0 ? t('progetti.deseleziona_tutti') : t('progetti.seleziona_tutti'),
          th.surface2,
          th.text,
          p.onAll,
        )}
        {btn('sub-bulk-color', t('progetti.colore'), th.blueSoft, th.blue, () =>
          p.onAction('color'),
        )}
        {btn('sub-bulk-parent', t('progetti.progetto_padre'), th.blueSoft, th.blue, () =>
          p.onAction('parent'),
        )}
        {btn('sub-bulk-delete', t('comune.elimina'), th.redSoft, th.red, () =>
          p.onAction('delete'),
        )}
      </ScrollView>
    </Animated.View>
  );
}
