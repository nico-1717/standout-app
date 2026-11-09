import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { BookSections } from '@/features/planner/BookSections';
import { plannerTheme } from '@/features/planner/plannerTheme';

/** Le stesse tinte che il sito offre per calendari e categorie. */
const SWATCHES = [
  '#E8B86B',
  '#A9C3AE',
  '#D9B7C0',
  '#C6B6A6',
  '#9DB4D0',
  '#C9A0DC',
  '#E39A8A',
  '#9A9A9A',
];

/** «Calendari e categorie» del planner: nomi, colori, visibilità e parole chiave. */
export default function PlannerManage() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed, uiStyle, plannerSettings } = useApp();
  const pt = plannerTheme(uiStyle, th, plannerSettings.palette, plannerSettings.contrast_level);
  const repo = services?.planner ?? null;
  const book = services?.book ?? null;
  const [newCal, setNewCal] = useState('');
  const [newCat, setNewCat] = useState('');
  const [words, setWords] = useState<Record<string, string>>({});

  const data = useMemo(() => {
    void version;
    return repo
      ? {
          cals: repo.calendars(),
          cats: repo.categories(),
          kws: repo.keywords(),
          contacts: book?.contacts() ?? [],
          places: book?.places() ?? [],
        }
      : { cals: [], cats: [], kws: [], contacts: [], places: [] };
  }, [repo, book, version]);
  if (!repo) return null;

  const swatches = (current: string | null, pick: (c: string) => void, id: string) => (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
      {SWATCHES.map((c) => (
        <Pressable
          hitSlop={8}
          key={c}
          testID={`${id}-${c}`}
          accessibilityRole="radio"
          accessibilityLabel={c}
          accessibilityState={{ selected: current === c }}
          onPress={() => {
            pick(c);
            changed();
          }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: c,
            borderWidth: current === c ? 3 : 0,
            borderColor: pt.ink,
          }}
        />
      ))}
    </View>
  );
  const input = {
    color: pt.ink,
    fontFamily: pt.sans,
    fontSize: 16,
    paddingVertical: 8,
    flex: 1,
  } as const;
  const card = {
    backgroundColor: pt.card,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: pt.hair,
    padding: 14,
    gap: 10,
  } as const;
  const heading = {
    color: pt.ink,
    fontSize: 22,
    fontFamily: pt.serif,
    fontWeight: pt.style === 'standard' ? '700' : '400',
  } as const;

  function addWord(catUuid: string) {
    const w = (words[catUuid] ?? '').trim();
    if (!w || !repo) return;
    const ok = repo.addKeyword(catUuid, w);
    if (!ok) {
      const owner = data.kws.find((k) => k.keyword === w.toLowerCase());
      const catName = data.cats.find((c) => c.uuid === owner?.category_uuid)?.name ?? '';
      Alert.alert(
        t('planner.parola_gia_usata'),
        t('planner.parola_gia_assegnata', { parola: w, categoria: catName }),
      );
      return;
    }
    setWords({ ...words, [catUuid]: '' });
    changed();
  }

  return (
    <View style={{ flex: 1, backgroundColor: pt.page }}>
      <View
        style={{
          paddingTop: Math.max(insets.top - 20, 12),
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ ...heading, flex: 1 }}>
          {t('planner.calendari')} · {t('planner.categorie')}
        </Text>
        <Pressable testID="manage-done" accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: pt.accentInk, fontSize: 16, fontFamily: pt.sans }}>
            {t('comune.fine')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={heading}>{t('planner.calendari')}</Text>
        {data.cals.map((c) => (
          <View key={c.uuid} style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                hitSlop={11}
                testID={`cal-vis-${c.uuid}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: !!c.is_visible }}
                onPress={() => {
                  repo.updateCalendar(c.uuid, { is_visible: !c.is_visible });
                  changed();
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: c.color ?? pt.accent,
                  backgroundColor: c.is_visible ? (c.color ?? pt.accent) : 'transparent',
                }}
              />
              <TextInput
                testID={`cal-name-${c.uuid}`}
                defaultValue={c.name}
                style={input}
                onEndEditing={(e) => {
                  const n = e.nativeEvent.text.trim();
                  if (n && n !== c.name) {
                    repo.updateCalendar(c.uuid, { name: n });
                    changed();
                  }
                }}
              />
              {c.is_default ? (
                <Text style={{ color: pt.ink3, fontSize: 12 }}>{t('planner.pre_principale')}</Text>
              ) : (
                <Pressable
                  testID={`cal-del-${c.uuid}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('planner.elimina')}
                  onPress={() =>
                    Alert.alert(t('planner.togliere_calendario', { nome: c.name }), undefined, [
                      { text: t('comune.annulla'), style: 'cancel' },
                      {
                        text: t('planner.elimina'),
                        style: 'destructive',
                        onPress: () => {
                          repo.removeCalendar(c.uuid);
                          changed();
                        },
                      },
                    ])
                  }
                >
                  <Text style={{ color: '#B4645F', fontSize: 14 }}>{t('planner.elimina')}</Text>
                </Pressable>
              )}
            </View>
            {swatches(
              c.color,
              (col) => repo.updateCalendar(c.uuid, { color: col }),
              `cal-color-${c.uuid}`,
            )}
          </View>
        ))}
        <View style={{ ...card, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            testID="cal-new"
            value={newCal}
            onChangeText={setNewCal}
            placeholder={t('planner.nuovo_calendario')}
            placeholderTextColor={pt.ink3}
            style={input}
          />
          <Pressable
            testID="cal-add"
            accessibilityRole="button"
            accessibilityLabel={t('comune.aggiungi')}
            onPress={() => {
              const n = newCal.trim();
              if (!n) return;
              repo.addCalendar(n, SWATCHES[data.cals.length % SWATCHES.length]!);
              setNewCal('');
              changed();
            }}
          >
            <Text style={{ color: pt.accentInk, fontSize: 22 }}>＋</Text>
          </Pressable>
        </View>

        <Text style={{ ...heading, marginTop: 10 }}>{t('planner.categorie')}</Text>
        <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>
          {t('planner.parole_che_assegnano_questa_categoria')}
        </Text>
        {data.cats.map((c) => {
          const mine = data.kws.filter((k) => k.category_uuid === c.uuid);
          return (
            <View key={c.uuid} style={card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  hitSlop={11}
                  testID={`cat-vis-${c.uuid}`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !c.is_hidden }}
                  onPress={() => {
                    repo.updateCategory(c.uuid, { is_hidden: !c.is_hidden });
                    changed();
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: c.color,
                    backgroundColor: c.is_hidden ? 'transparent' : c.color,
                  }}
                />
                <TextInput
                  testID={`cat-name-${c.uuid}`}
                  defaultValue={c.name}
                  style={input}
                  onEndEditing={(e) => {
                    const n = e.nativeEvent.text.trim();
                    if (n && n !== c.name) {
                      repo.updateCategory(c.uuid, { name: n });
                      changed();
                    }
                  }}
                />
                <Pressable
                  testID={`cat-del-${c.uuid}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('planner.elimina')}
                  onPress={() =>
                    Alert.alert(c.name, undefined, [
                      { text: t('comune.annulla'), style: 'cancel' },
                      {
                        text: t('planner.elimina'),
                        style: 'destructive',
                        onPress: () => {
                          repo.removeCategory(c.uuid);
                          changed();
                        },
                      },
                    ])
                  }
                >
                  <Text style={{ color: '#B4645F', fontSize: 14 }}>{t('planner.elimina')}</Text>
                </Pressable>
              </View>
              {swatches(
                c.color,
                (col) => repo.updateCategory(c.uuid, { color: col }),
                `cat-color-${c.uuid}`,
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {mine.length ? (
                  mine.map((k) => (
                    <Pressable
                      key={k.uuid}
                      testID={`kw-${k.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${k.keyword} – ${t('planner.elimina')}`}
                      onPress={() => {
                        repo.removeKeyword(k.uuid);
                        changed();
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: pt.accentSoft,
                      }}
                    >
                      <Text style={{ color: pt.accentInk, fontSize: 13 }}>{k.keyword} ×</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={{ color: pt.ink3, fontSize: 13 }}>
                    {t('planner.nessuna_parola_l')}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  testID={`kw-new-${c.uuid}`}
                  value={words[c.uuid] ?? ''}
                  onChangeText={(v) => setWords({ ...words, [c.uuid]: v })}
                  onSubmitEditing={() => addWord(c.uuid)}
                  placeholder={t('planner.parole_separate_da_virgola')}
                  placeholderTextColor={pt.ink3}
                  style={input}
                />
                <Pressable
                  testID={`kw-add-${c.uuid}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('comune.aggiungi')}
                  onPress={() => addWord(c.uuid)}
                >
                  <Text style={{ color: pt.accentInk, fontSize: 22 }}>＋</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <View style={{ ...card, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            testID="cat-new"
            value={newCat}
            onChangeText={setNewCat}
            placeholder={t('planner.nuova_categoria')}
            placeholderTextColor={pt.ink3}
            style={input}
          />
          <Pressable
            testID="cat-add"
            accessibilityRole="button"
            accessibilityLabel={t('comune.aggiungi')}
            onPress={() => {
              const n = newCat.trim();
              if (!n) return;
              repo.addCategory(n, SWATCHES[data.cats.length % SWATCHES.length]!);
              setNewCat('');
              changed();
            }}
          >
            <Text style={{ color: pt.accentInk, fontSize: 22 }}>＋</Text>
          </Pressable>
        </View>
        {book ? (
          <BookSections
            book={book}
            contacts={data.contacts}
            places={data.places}
            look={{ pt, card, input, heading }}
            changed={changed}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
