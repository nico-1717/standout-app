import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { PjIcon } from './PjIcons';

/** La riga «nome del nuovo sotto-progetto» con il tasto Aggiungi (la stessa sotto «Aggiungi un sotto-progetto» e dopo lo scorrimento «Aggiungi dentro»). */
export function AddInput(p: {
  draft: string;
  onDraft: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  accent: string;
  inCard?: boolean;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        flexBasis: '100%',
        backgroundColor: p.inCard ? undefined : th.surface,
        borderRadius: 14,
      }}
    >
      <PjIcon name="plus" color={p.accent} size={20} width={2} />
      <TextInput
        testID="proj-sub-input"
        autoFocus
        value={p.draft}
        onChangeText={p.onDraft}
        onSubmitEditing={p.onSubmit}
        onBlur={() => !p.draft.trim() && p.onCancel()}
        returnKeyType="done"
        placeholder={t('progetti.nome_nuovo_sotto')}
        placeholderTextColor={th.text3}
        style={{ flex: 1, color: th.text, fontSize: 16, paddingVertical: 8 }}
      />
      <Pressable
        testID="proj-sub-add"
        accessibilityRole="button"
        accessibilityLabel={t('progetti.aggiungi')}
        disabled={!p.draft.trim()}
        onPress={p.onSubmit}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: p.draft.trim() ? p.accent : th.surface2,
        }}
      >
        <Text style={{ color: p.draft.trim() ? '#fff' : th.text3, fontWeight: '700' }}>
          {t('progetti.aggiungi')}
        </Text>
      </Pressable>
    </View>
  );
}
