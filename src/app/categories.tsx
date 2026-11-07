import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DEFAULT_CATEGORY_COLOR } from '@/features/buy/logic';
import { Card, Field, Header, PrimaryButton, TextButton } from '@/ui/kit';

/** Gli stessi colori che il sito dà alle categorie nuove (più il grigio di partenza). */
const SWATCHES = [
  '#E8B86B',
  '#A9C3AE',
  '#D9B7C0',
  '#C6B6A6',
  '#9DB4D0',
  '#C9A0DC',
  '#E39A8A',
  DEFAULT_CATEGORY_COLOR,
];

export default function Categories() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();
  const [name, setName] = useState('');
  const cats = useMemo(
    () => (services ? services.categories.list() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );

  function add() {
    const n = name.trim();
    if (!n || !services) return;
    services.categories.create(n, SWATCHES[cats.length % SWATCHES.length]);
    setName('');
    changed();
  }

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={t('todo.categorie')}
        top={Math.max(insets.top - 20, 8)}
        right={<TextButton label={t('comune.fine')} onPress={() => router.back()} />}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: th.text2, fontSize: 13 }}>{t('todo.categorie_nota')}</Text>
        {cats.map((c) => (
          <Card key={c.uuid} style={{ padding: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.color }} />
              <TextInput
                defaultValue={c.name}
                maxLength={60}
                onEndEditing={(e) => {
                  const v = e.nativeEvent.text.trim();
                  if (v && v !== c.name) {
                    services?.categories.update(c.uuid, { name: v });
                    changed();
                  }
                }}
                style={{ flex: 1, color: th.text, fontSize: 16, paddingVertical: 4 }}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() =>
                  Alert.alert(t('comune.elimina'), c.name, [
                    { text: t('comune.annulla'), style: 'cancel' },
                    {
                      text: t('comune.elimina'),
                      style: 'destructive',
                      onPress: () => {
                        services?.categories.remove(c.uuid);
                        changed();
                      },
                    },
                  ])
                }
              >
                <Text style={{ color: th.red }}>{t('comune.elimina')}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {SWATCHES.map((s) => (
                <Pressable
                  accessibilityRole="button"
                  key={s}
                  onPress={() => {
                    services?.categories.update(c.uuid, { color: s });
                    changed();
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: s,
                    borderWidth: c.color.toLowerCase() === s.toLowerCase() ? 3 : 0,
                    borderColor: th.text,
                  }}
                />
              ))}
            </View>
          </Card>
        ))}
        <Field
          placeholder={t('todo.nuova_categoria')}
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
          maxLength={60}
        />
        <PrimaryButton label={t('comune.aggiungi')} onPress={add} disabled={!name.trim()} />
      </ScrollView>
    </View>
  );
}
