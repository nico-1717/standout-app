import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import {
  LANGS,
  POPULAR_LANGS,
  isKnownLang,
  langBase,
  langFlag,
  langName,
  langNative,
  learnChoices,
} from '@/features/languages/langs';
import type { Course, CourseError } from '@/features/languages/repo';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

const ERROR_KEY: Record<CourseError, string> = {
  languages: 'fchub.err_lingua',
  same: 'fchub.err_stessa',
  exists: 'fchub.err_gia_corso',
  variant: 'fchub.err_lingua',
};

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Le lingue che impari (fc_languages.php): un corso per ogni coppia lingua che conosci → lingua che impari. */
export default function LanguagesScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, changed } = useApp();
  const ui: 'it' | 'en' = i18n.language === 'en' ? 'en' : 'it';

  const [adding, setAdding] = useState<boolean | null>(null);
  const [known, setKnown] = useState<string>(isKnownLang(ui) ? ui : 'it');
  const [pickKnown, setPickKnown] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<string | null>(null);
  const [variantFor, setVariantFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const data = useMemo(() => {
    void version;
    if (!services) return null;
    return { courses: services.languages.courses(), stats: services.languages.courseStats() };
  }, [services, version]);
  if (!services || !data) return null;
  const repo = services.languages;
  const { courses, stats } = data;
  // senza lingue il pannello per aggiungerne una è già aperto (fchub: vuoto_titolo)
  const panel = adding ?? courses.length === 0;

  const have = new Set(courses.filter((c) => c.known_lang === known).map((c) => c.learn_lang));
  const bases = [...new Set(LANGS.map((l) => langBase(l.code)))];
  const choices = learnChoices(known, ui);
  const needle = fold(query);
  const shown = needle
    ? choices.filter((l) =>
        [langName(l.code, 'it'), langName(l.code, 'en'), l.native].some((n) =>
          fold(n).includes(needle),
        ),
      )
    : choices;
  const popular = needle
    ? []
    : POPULAR_LANGS.map((c) => choices.find((l) => l.code === c)).filter(
        (l): l is NonNullable<typeof l> => !!l,
      );

  const start = (learn: string) => {
    const r = repo.addCourse(known, learn, ui);
    if (typeof r !== 'string') {
      setError(t(ERROR_KEY[r]));
      return;
    }
    setError(null);
    setAdding(false);
    setQuery('');
    changed();
    router.push({ pathname: '/lang-course', params: { id: r } });
  };

  const langRow = (code: string, tag = 'pick') => {
    const done = have.has(code);
    return (
      <Pressable
        key={code}
        testID={`lang-${tag}-${code}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: done }}
        disabled={done}
        onPress={() => start(code)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 11,
          paddingHorizontal: 14,
          opacity: done ? 0.4 : 1,
        }}
      >
        <Text style={{ fontSize: 24 }}>{langFlag(code)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 16, fontWeight: '600' }}>
            {langName(code, ui)}
          </Text>
          <Text style={{ color: th.text2, fontSize: 12 }}>{langNative(code)}</Text>
        </View>
        {done ? (
          <Text style={{ color: th.text2, fontSize: 12 }}>{t('fchub.gia_aggiunta')}</Text>
        ) : null}
      </Pressable>
    );
  };

  const courseCard = (c: Course, i: number) => {
    const st = stats.get(c.uuid) ?? { words: 0, learnt: 0 };
    const pct = st.words ? Math.round((st.learnt / st.words) * 100) : 0;
    const variants = LANGS.filter((l) => langBase(l.code) === langBase(c.learn_lang));
    return (
      <Card key={c.uuid} index={i} style={{ padding: 0 }}>
        <Pressable
          testID={`lang-course-${c.uuid}`}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/lang-course', params: { id: c.uuid } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}
        >
          <Text style={{ fontSize: 34 }}>{langFlag(c.learn_lang)}</Text>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: th.text, fontSize: 18, fontWeight: '700' }}>
              {langName(c.learn_lang, ui)}
            </Text>
            <Text style={{ color: th.text2, fontSize: 12 }}>
              {t('fchub.dalla_lingua', { lingua: langName(c.known_lang, ui, false) })}
            </Text>
            <Text testID={`lang-stats-${c.uuid}`} style={{ color: th.text2, fontSize: 13 }}>
              {st.words === 0
                ? t('fchub.nessuna_parola')
                : st.words === 1
                  ? t('fchub.una_parola_imparate', { imp: st.learnt })
                  : t('fchub.n_parole_imparate', { imp: st.learnt, n: st.words })}
            </Text>
            {st.words > 0 ? (
              <View style={{ height: 5, borderRadius: 3, backgroundColor: th.surface2 }}>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: pct === 100 ? th.green : th.brand,
                    width: `${pct}%`,
                  }}
                />
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          testID={`lang-options-${c.uuid}`}
          accessibilityRole="button"
          accessibilityLabel={t('fchub.opzioni')}
          onPress={() => {
            setOptions(options === c.uuid ? null : c.uuid);
            setVariantFor(null);
            setDeleting(null);
          }}
          style={{ paddingHorizontal: 14, paddingBottom: 10, alignItems: 'flex-end' }}
        >
          <Text style={{ color: th.brand, fontSize: 13 }}>{t('fchub.opzioni')} ▾</Text>
        </Pressable>
        {options === c.uuid ? (
          <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 4 }}>
            {variants.length > 1 ? (
              <TextButton
                testID={`lang-variant-${c.uuid}`}
                label={t('fchub.cambia_accento')}
                onPress={() => setVariantFor(variantFor === c.uuid ? null : c.uuid)}
              />
            ) : null}
            {variantFor === c.uuid ? (
              <View style={{ gap: 2 }}>
                <SectionLabel>{t('fchub.app_variante_titolo')}</SectionLabel>
                {variants.map((l) => (
                  <Pressable
                    key={l.code}
                    testID={`lang-variant-${c.uuid}-${l.code}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: l.code === c.learn_lang }}
                    onPress={() => {
                      const r = repo.changeVariant(c.uuid, l.code);
                      if (r === true) {
                        setVariantFor(null);
                        setError(null);
                        changed();
                      } else setError(t(ERROR_KEY[r]));
                    }}
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      paddingVertical: 9,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{langFlag(l.code)}</Text>
                    <Text
                      style={{
                        color: th.text,
                        fontSize: 15,
                        fontWeight: l.code === c.learn_lang ? '700' : '400',
                      }}
                    >
                      {langName(l.code, ui)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <TextButton
                testID={`lang-up-${c.uuid}`}
                label={`↑ ${t('fchub.app_sposta_su')}`}
                onPress={() => {
                  const prev = courses[i - 1];
                  if (!prev) return;
                  repo.reorderCourse(c.uuid, courses[i - 2]?.uuid ?? null, prev.uuid);
                  changed();
                }}
              />
              <TextButton
                testID={`lang-down-${c.uuid}`}
                label={`↓ ${t('fchub.app_sposta_giu')}`}
                onPress={() => {
                  const next = courses[i + 1];
                  if (!next) return;
                  repo.reorderCourse(c.uuid, next.uuid, courses[i + 2]?.uuid ?? null);
                  changed();
                }}
              />
            </View>
            {deleting === c.uuid ? (
              <View style={{ gap: 6, paddingTop: 6 }}>
                <Text style={{ color: th.text, fontWeight: '700' }}>
                  {t('fchub.elimina_titolo', { lingua: langName(c.learn_lang, ui) })}
                </Text>
                <Text style={{ color: th.text2, fontSize: 13 }}>
                  {st.words === 0
                    ? t('fchub.elimina_testo_vuoto')
                    : st.words === 1
                      ? t('fchub.elimina_testo_1')
                      : t('fchub.elimina_testo_n', { n: st.words })}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <TextButton
                      testID={`lang-delete-cancel-${c.uuid}`}
                      label={t('comune.annulla')}
                      onPress={() => setDeleting(null)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      danger
                      testID={`lang-delete-confirm-${c.uuid}`}
                      label={t('fchub.elimina')}
                      onPress={() => {
                        repo.removeCourse(c.uuid);
                        setDeleting(null);
                        setOptions(null);
                        changed();
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <TextButton
                danger
                testID={`lang-delete-${c.uuid}`}
                label={t('fchub.elimina_corso')}
                onPress={() => setDeleting(c.uuid)}
              />
            )}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fchub.lingue_titolo')}
        right={
          <Pressable testID="lang-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {courses.length ? (
          <Text testID="lang-summary" style={{ color: th.text2 }}>
            {t(courses.length === 1 ? 'fchub.n_lingua_parole' : 'fchub.n_lingue_parole', {
              n: courses.length,
              parole: [...stats.values()].reduce((a, s) => a + s.words, 0),
            })}
          </Text>
        ) : (
          <View style={{ gap: 4, paddingTop: 8 }}>
            <Text style={{ color: th.text, fontSize: 20, fontWeight: '700' }}>
              {t('fchub.vuoto_titolo')}
            </Text>
            <Text style={{ color: th.text2 }}>
              {t('fchub.vuoto_testo', { lingua: langName(known, ui, false) })}
            </Text>
          </View>
        )}

        {courses.map(courseCard)}

        {error ? (
          <Text testID="lang-error" style={{ color: th.red }}>
            {error}
          </Text>
        ) : null}

        {courses.length ? (
          <PrimaryButton
            testID="lang-add"
            label={t('fchub.aggiungi_lingua')}
            onPress={() => setAdding(!panel)}
          />
        ) : null}

        {panel ? (
          <Card style={{ paddingBottom: 6 }}>
            <Pressable
              testID="lang-known"
              accessibilityRole="button"
              onPress={() => setPickKnown(!pickKnown)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
            >
              <Text style={{ color: th.text2, flex: 1 }}>{t('fchub.parto_da')}</Text>
              <Text style={{ fontSize: 20 }}>{langFlag(known)}</Text>
              <Text style={{ color: th.brand, fontWeight: '600' }}>
                {langName(known, ui, false)} ▾
              </Text>
            </Pressable>
            {pickKnown ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
                <SectionLabel>{t('fchub.da_quale_lingua')}</SectionLabel>
                {bases.map((b) => (
                  <Pressable
                    key={b}
                    testID={`lang-known-${b}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: b === known }}
                    onPress={() => {
                      setKnown(b);
                      setPickKnown(false);
                      setError(null);
                    }}
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      paddingVertical: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{langFlag(b)}</Text>
                    <Text
                      style={{
                        color: th.text,
                        fontWeight: b === known ? '700' : '400',
                      }}
                    >
                      {langName(b, ui, false)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
              <TextInput
                testID="lang-search"
                value={query}
                onChangeText={setQuery}
                placeholder={t('fchub.cerca_lingua')}
                placeholderTextColor={th.text3}
                autoCorrect={false}
                style={{
                  backgroundColor: th.surface2,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: th.text,
                  fontSize: 16,
                }}
              />
            </View>
            {popular.length ? (
              <>
                <View style={{ paddingHorizontal: 14 }}>
                  <SectionLabel>{t('fchub.piu_studiate')}</SectionLabel>
                </View>
                {popular.map((l) => langRow(l.code, 'pop'))}
              </>
            ) : null}
            <View style={{ paddingHorizontal: 14, paddingTop: 6 }}>
              <SectionLabel>{t('fchub.altre_lingue')}</SectionLabel>
            </View>
            {shown.length ? (
              shown.map((l) => langRow(l.code))
            ) : (
              <Text style={{ color: th.text2, padding: 14 }}>
                {t('fchub.nessuna_lingua', { q: query.trim() })}
              </Text>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
