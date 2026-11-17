import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DEFAULT_CATEGORY_COLOR } from '@/features/buy/logic';
import { sansOf, TodoIcon } from '@/features/tasks/TodoParts';
import { todoTheme } from '@/features/tasks/todoTheme';

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

/** «Categorie» come il popup del sito (td-card): scheda su fondo velato, una riga per categoria, quella vuota in fondo, «Fine». */
export default function Categories() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { services, version, changed, uiStyle } = useApp();
  const td = todoTheme(uiStyle, th);
  const [name, setName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [openColor, setOpenColor] = useState<string | null>(null);
  const cats = useMemo(
    () => (services ? services.categories.list() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const serif = td.style === 'paper' ? { fontFamily: td.serif } : { fontWeight: '600' as const };

  function add() {
    const n = name.trim();
    if (!n || !services) return;
    services.categories.create(n, newColor);
    setName('');
    setNewColor(SWATCHES[(cats.length + 1) % SWATCHES.length]!);
    changed();
  }

  const swatches = (current: string, pick: (c: string) => void, testID: string) => (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', paddingVertical: 8 }}>
      {SWATCHES.map((s) => (
        <Pressable
          key={s}
          testID={`${testID}-${s}`}
          hitSlop={6}
          accessibilityRole="button"
          onPress={() => pick(s)}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: s,
            borderWidth: current.toLowerCase() === s.toLowerCase() ? 3 : 0,
            borderColor: td.ink,
          }}
        />
      ))}
    </View>
  );

  const row = (key: string, children: React.ReactNode, last = false) => (
    <View
      key={key}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 2,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: td.hair,
      }}
    >
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        testID="categories-backdrop"
        accessibilityRole="button"
        accessibilityLabel={t('comune.chiudi')}
        onPress={() => router.back()}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: td.dark ? 'rgba(0,0,0,.55)' : 'rgba(74,68,61,.28)',
        }}
      >
        {/* il tocco dentro la scheda non deve chiuderla */}
        <Pressable
          accessibilityRole="none"
          onPress={() => undefined}
          style={{
            width: '100%',
            maxWidth: 340,
            maxHeight: '82%',
            borderRadius: 22,
            paddingTop: 20,
            paddingHorizontal: 18,
            paddingBottom: 14,
            backgroundColor: td.card,
            boxShadow: '0 24px 54px -22px rgba(74,68,61,.5)',
          }}
        >
          <Text style={[{ color: td.ink, fontSize: 21, marginBottom: 4 }, serif]}>
            {t('todo.categorie')}
          </Text>
          <Text
            style={[
              { color: td.ink2, fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
              sansOf(td),
            ]}
          >
            {t('todo.categorie_nota')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
            {cats.map((c) =>
              row(
                c.uuid,
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <Pressable
                      testID={`category-color-${c.uuid}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setOpenColor(openColor === c.uuid ? null : c.uuid)}
                      style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.color }}
                    />
                    <TextInput
                      testID={`category-name-${c.uuid}`}
                      defaultValue={c.name}
                      maxLength={60}
                      onEndEditing={(e) => {
                        const v = e.nativeEvent.text.trim();
                        if (v && v !== c.name) {
                          services?.categories.update(c.uuid, { name: v });
                          changed();
                        }
                      }}
                      style={[
                        { flex: 1, minWidth: 0, color: td.ink, fontSize: 14, paddingVertical: 4 },
                        sansOf(td),
                      ]}
                    />
                    <Pressable
                      testID={`category-del-${c.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('comune.elimina')}
                      hitSlop={8}
                      style={{ padding: 4 }}
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
                      <TodoIcon name="trash" color="#B08A8A" size={15} />
                    </Pressable>
                  </View>
                  {openColor === c.uuid
                    ? swatches(
                        c.color,
                        (s) => {
                          services?.categories.update(c.uuid, { color: s });
                          changed();
                        },
                        `category-swatch-${c.uuid}`,
                      )
                    : null}
                </>,
              ),
            )}
            {row(
              'new',
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <Pressable
                    testID="category-new-color"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setOpenColor(openColor === 'new' ? null : 'new')}
                    style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: newColor }}
                  />
                  <TextInput
                    testID="category-new-name"
                    placeholder={t('todo.nuova_categoria')}
                    placeholderTextColor={td.ink3}
                    value={name}
                    onChangeText={setName}
                    onSubmitEditing={add}
                    returnKeyType="done"
                    maxLength={60}
                    style={[
                      { flex: 1, minWidth: 0, color: td.ink, fontSize: 14, paddingVertical: 4 },
                      sansOf(td),
                    ]}
                  />
                  <Pressable
                    testID="category-add"
                    accessibilityRole="button"
                    accessibilityLabel={t('comune.aggiungi')}
                    hitSlop={8}
                    disabled={!name.trim()}
                    onPress={add}
                    style={{ padding: 4, opacity: name.trim() ? 1 : 0.45 }}
                  >
                    <TodoIcon name="plus" color={td.accent} size={15} width={2.4} />
                  </Pressable>
                </View>
                {openColor === 'new'
                  ? swatches(newColor, setNewColor, 'category-new-swatch')
                  : null}
              </>,
              true,
            )}
          </ScrollView>
          <Pressable
            testID="categories-done"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{
              marginTop: 16,
              padding: 11,
              borderRadius: 13,
              alignItems: 'center',
              backgroundColor: td.accent,
            }}
          >
            <Text style={[{ color: td.onAccent, fontSize: 14 }, sansOf(td)]}>
              {t('comune.fine')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
