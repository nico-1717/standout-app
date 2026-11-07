import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { alpha, mix } from '@/features/buy/buyTheme';

import {
  applyPreset,
  formFromHabit,
  newForm,
  validate,
  type FormError,
  type HabitFormState,
} from './formModel';
import { DateField, Field, Hint, Pill, Segmented, Stepper, Swatches } from './formParts';
import type { HabitsTheme } from './habitsTheme';
import type { Habit } from './logic';
import { DEFAULT_COLOR, dayParts, iconGroups, palette, presets, units } from './presets';
import type { HabitCategory } from './repo';

type Page = 'form' | 'icons' | 'presets';

export interface HabitFormProps {
  visible: boolean;
  /** null = nuova abitudine */
  habit: Habit | null;
  categories: HabitCategory[];
  today: string;
  th: HabitsTheme;
  onClose: () => void;
  onSave: (form: HabitFormState, habit: Habit | null) => void;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const parse = (s: string) => Number(s.replace(',', '.'));

/**
 * Il foglio «Nuova abitudine / Modifica abitudine», come #hbSheetEditor del sito: un foglio che sale dal basso
 * (su iPad una carta al centro), un tasto grande sempre visibile in fondo. Icone e abitudini pronte sono
 * due «pagine» dentro lo stesso foglio, così non si impilano finestre.
 */
function HabitFormBody(p: HabitFormProps) {
  const { th } = p;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;

  const [page, setPage] = useState<Page>('form');
  const [f, setF] = useState<HabitFormState>(() =>
    p.habit ? formFromHabit(p.habit) : newForm(p.today, DEFAULT_COLOR),
  );
  const [errors, setErrors] = useState<FormError[]>([]);
  const [query, setQuery] = useState('');

  const colors = useMemo(() => palette(t), [t]);
  const parts = useMemo(() => dayParts(t), [t]);
  const unitList = useMemo(() => units(t), [t]);
  const icons = useMemo(() => iconGroups(t), [t]);
  const ready = useMemo(() => presets(t), [t]);

  const set = <K extends keyof HabitFormState>(k: K, v: HabitFormState[K]) => {
    setF((o) => ({ ...o, [k]: v }));
    if (errors.length) setErrors([]);
  };
  const isQuit = f.kind === 'quit';
  const quantity = f.goal_type === 'quantity';
  const editing = p.habit !== null;
  const accent = th.accent;

  function submit() {
    const e = validate(f);
    setErrors(e);
    if (e.length) return;
    p.onSave(f, p.habit);
  }

  const catName = (c: HabitCategory) =>
    c.is_system && c.slug ? t(`abitudini.cat_${c.slug}`, { defaultValue: c.name }) : c.name;

  const input = (extra?: object) => [
    styles.input,
    { backgroundColor: th.surface2, color: th.text },
    extra,
  ];
  const errBorder = (k: FormError) =>
    errors.includes(k) ? { borderWidth: 1.5, borderColor: th.red } : {};

  /* ---------------- pagina: icone ---------------- */
  const iconsPage = (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {icons.map((g) => (
        <Field key={g.title} label={g.title} th={th}>
          <View style={styles.iconGrid}>
            {g.icons.map((ic) => (
              <Pressable
                accessibilityRole="button"
                key={ic}
                testID={`icon-${ic}`}
                onPress={() => {
                  set('icon', ic);
                  setPage('form');
                }}
                style={[
                  styles.iconCell,
                  { backgroundColor: ic === f.icon ? alpha(f.color, 0.2) : th.surface2 },
                ]}
              >
                <Text style={{ fontSize: 24 }}>{ic}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      ))}
    </ScrollView>
  );

  /* ---------------- pagina: abitudini pronte ---------------- */
  const q = query.toLowerCase().trim();
  const shown = q
    ? ready.filter((x) => (x.name + ' ' + x.motivation).toLowerCase().includes(q))
    : ready;
  const presetsPage = (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <TextInput
          testID="preset-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('abitudini.cerca_fra_n', { n: ready.length })}
          placeholderTextColor={th.text3}
          style={input()}
        />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {shown.map((x) => (
          <Pressable
            accessibilityRole="button"
            key={x.key}
            testID={`preset-${x.key}`}
            onPress={() => {
              setF((o) => applyPreset(o, x, p_categories(p.categories)));
              setPage('form');
            }}
            style={[styles.presetRow, { backgroundColor: th.surface2 }]}
          >
            <View style={[styles.presetIcon, { backgroundColor: alpha(x.color, 0.18) }]}>
              <Text style={{ fontSize: 22 }}>{x.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>{x.name}</Text>
              <Text numberOfLines={2} style={{ color: th.text2, fontSize: 13 }}>
                {x.motivation}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  /* ---------------- pagina: modulo ---------------- */
  const formPage = (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      testID="habit-form-scroll"
    >
      <Field label={t('abitudini.nome_e_icona')} th={th}>
        <View style={styles.nameRow}>
          <Pressable
            testID="pick-icon"
            accessibilityRole="button"
            onPress={() => setPage('icons')}
            style={[
              styles.iconBig,
              { backgroundColor: alpha(f.color, 0.18), borderColor: alpha(f.color, 0.4) },
            ]}
          >
            <Text style={{ fontSize: 32 }}>{f.icon}</Text>
          </Pressable>
          <TextInput
            testID="habit-name"
            value={f.name}
            onChangeText={(v) => set('name', v)}
            placeholder={t('abitudini.ph_nome')}
            placeholderTextColor={th.text3}
            maxLength={120}
            style={input({ flex: 1, ...errBorder('name') })}
          />
        </View>
        {errors.includes('name') && (
          <Text style={{ color: th.red, marginTop: 8, fontWeight: '600' }}>
            {t('abitudini.manca_il_nome')}
          </Text>
        )}
        {!editing && (
          <Pressable
            testID="from-preset"
            accessibilityRole="button"
            onPress={() => setPage('presets')}
            style={[styles.quiet, { backgroundColor: th.surface2 }]}
          >
            <Text style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>
              {t('abitudini.parti_da_un_abitudine_pronta')}
            </Text>
          </Pressable>
        )}
      </Field>

      <Field label={t('abitudini.colore')} th={th}>
        <Swatches colors={colors} value={f.color} th={th} onChange={(v) => set('color', v)} />
      </Field>

      <Field label={t('abitudini.categoria')} th={th}>
        <View style={styles.wrap}>
          {p.categories.map((c) => (
            <Pill
              key={c.uuid}
              testID={`cat-${c.slug || c.uuid}`}
              label={`${c.icon} ${catName(c)}`}
              on={f.category_uuid === c.uuid}
              color={c.color}
              th={th}
              onPress={() => set('category_uuid', f.category_uuid === c.uuid ? null : c.uuid)}
            />
          ))}
        </View>
      </Field>

      <Field label={t('abitudini.tipo_di_abitudine')} th={th}>
        <Segmented
          testPrefix="kind"
          th={th}
          value={f.kind}
          onChange={(k) => set('kind', k)}
          items={[
            { key: 'build', label: t('abitudini.da_fare_2') },
            { key: 'quit', label: t('abitudini.da_evitare') },
          ]}
        />
        <Hint th={th}>
          {isQuit
            ? t('abitudini.parte_gia_riuscita_la_spunti')
            : t('abitudini.parte_non_fatta_ogni_spunta')}
        </Hint>
      </Field>

      <Field label={t('abitudini.obiettivo')} th={th}>
        <Segmented
          testPrefix="goal"
          th={th}
          value={f.goal_type}
          onChange={(k) => set('goal_type', k)}
          items={[
            { key: 'completion', label: t('abitudini.completata') },
            { key: 'quantity', label: t('abitudini.quantita') },
          ]}
        />
        {quantity ? (
          <View style={{ marginTop: 14, gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sub, { color: th.text2 }]}>
                  {t('abitudini.obiettivo') + (isQuit ? t('abitudini.resta_sotto') : '')}
                </Text>
                <Stepper
                  testID="target"
                  th={th}
                  min={0.5}
                  max={100000}
                  step={0.5}
                  prefix={isQuit ? '< ' : ''}
                  value={parse(f.target) || 0.5}
                  onChange={(n) => set('target', fmt(n))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sub, { color: th.text2 }]}>{t('abitudini.per_spunta')}</Text>
                <Stepper
                  testID="step"
                  th={th}
                  min={0.5}
                  max={100000}
                  step={0.5}
                  value={parse(f.step) || 0.5}
                  onChange={(n) => set('step', fmt(n))}
                />
              </View>
            </View>
            <View>
              <Text style={[styles.sub, { color: th.text2 }]}>
                {t('abitudini.unita_di_misura')}
              </Text>
              <TextInput
                testID="habit-unit"
                value={f.unit}
                onChangeText={(v) => set('unit', v)}
                placeholder={t('abitudini.ph_unita')}
                placeholderTextColor={th.text3}
                maxLength={24}
                style={input()}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingTop: 10 }}
                keyboardShouldPersistTaps="handled"
              >
                {unitList.map((u) => (
                  <Pill
                    key={u}
                    label={u}
                    on={f.unit === u}
                    color={f.color}
                    th={th}
                    onPress={() => set('unit', u)}
                  />
                ))}
              </ScrollView>
              <Hint th={th}>
                {isQuit
                  ? t('abitudini.suggerimento_quit', {
                      passo: fmt(parse(f.step) || 0),
                      unita: f.unit || t('abitudini.unita'),
                      soglia: fmt(parse(f.target) || 0),
                    })
                  : t('abitudini.suggerimento_build', {
                      passo: fmt(parse(f.step) || 0),
                      unita: f.unit || t('abitudini.unita'),
                      n: Math.ceil((parse(f.target) || 0) / Math.max(0.5, parse(f.step) || 0.5)),
                    })}
              </Hint>
            </View>
          </View>
        ) : (
          <Hint th={th}>
            {isQuit ? t('abitudini.una_sola_spunta_e_la') : t('abitudini.una_sola_spunta_e_l')}
          </Hint>
        )}
      </Field>

      <Field label={t('abitudini.frequenza')} th={th}>
        <Segmented
          testPrefix="freq"
          th={th}
          value={f.frequency_type}
          onChange={(k) => set('frequency_type', k)}
          items={[
            { key: 'daily', label: t('abitudini.freq_giornaliera') },
            { key: 'weekly', label: t('abitudini.freq_settimanale') },
            { key: 'monthly', label: t('abitudini.freq_mensile') },
            { key: 'interval', label: t('abitudini.freq_intervallo') },
          ]}
        />
        <View style={{ marginTop: 14 }}>
          {f.frequency_type === 'daily' && (
            <>
              <Hint th={th}>{t('abitudini.scegli_in_quali_giorni_della')}</Hint>
              <View style={[styles.wrap, { marginTop: 10 }]}>
                {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
                  <Pill
                    key={n}
                    testID={`wd-${i}`}
                    label={t(`abitudini.dow_${n}`)}
                    on={f.weekdays[i] === '1'}
                    color={f.color}
                    th={th}
                    onPress={() =>
                      set(
                        'weekdays',
                        f.weekdays.slice(0, i) +
                          (f.weekdays[i] === '1' ? '0' : '1') +
                          f.weekdays.slice(i + 1),
                      )
                    }
                  />
                ))}
              </View>
              {errors.includes('weekdays') && (
                <Text style={{ color: th.red, marginTop: 8, fontWeight: '600' }}>
                  {t('abitudini.scegli_in_quali_giorni_della')}
                </Text>
              )}
            </>
          )}
          {f.frequency_type === 'weekly' && (
            <Stepper
              testID="per-week"
              th={th}
              min={1}
              max={7}
              step={1}
              value={f.times_per_week}
              label={t('abitudini.volte_a_settimana')}
              onChange={(n) => set('times_per_week', n)}
            />
          )}
          {f.frequency_type === 'monthly' && (
            <Stepper
              testID="per-month"
              th={th}
              min={1}
              max={31}
              step={1}
              value={f.times_per_month}
              label={t('abitudini.volte_al_mese')}
              onChange={(n) => set('times_per_month', n)}
            />
          )}
          {f.frequency_type === 'interval' && (
            <Stepper
              testID="interval"
              th={th}
              min={1}
              max={365}
              step={1}
              value={f.interval_days}
              label={t('abitudini.ogni_quanti_giorni')}
              onChange={(n) => set('interval_days', n)}
            />
          )}
        </View>
      </Field>

      <Field label={t('abitudini.parte_della_giornata')} th={th}>
        <View style={styles.wrap}>
          {parts.map((d) => (
            <Pill
              key={d.key}
              testID={`part-${d.key}`}
              label={`${d.icon} ${d.name}`}
              on={f.day_part === d.key}
              color={accent}
              th={th}
              onPress={() => set('day_part', d.key)}
            />
          ))}
        </View>
      </Field>

      <Field label={t('abitudini.per_quanto')} th={th}>
        <Segmented
          testPrefix="dur"
          th={th}
          value={f.duration_type}
          onChange={(k) => set('duration_type', k)}
          items={[
            { key: 'forever', label: t('abitudini.dur_per_sempre') },
            { key: 'days', label: t('abitudini.dur_n_giorni') },
            { key: 'end_date', label: t('abitudini.dur_fino_al') },
          ]}
        />
        <View style={{ marginTop: 12 }}>
          {f.duration_type === 'days' && (
            <Stepper
              testID="dur-days"
              th={th}
              min={1}
              max={3650}
              step={1}
              value={f.duration_days}
              label={t('abitudini.giorni_totali')}
              onChange={(n) => set('duration_days', n)}
            />
          )}
          {f.duration_type === 'end_date' && (
            <DateField
              testID="end-date"
              th={th}
              value={f.end_date}
              min={f.start_date}
              placeholder={t('abitudini.dur_fino_al')}
              onChange={(d) => set('end_date', d)}
            />
          )}
          {f.duration_type === 'forever' && (
            <Hint th={th}>{t('abitudini.l_abitudine_resta_attiva_finche')}</Hint>
          )}
          {errors.includes('end_date') && (
            <Text style={{ color: th.red, marginTop: 8, fontWeight: '600' }}>
              {t('abitudini.dur_fino_al')}
            </Text>
          )}
        </View>
      </Field>

      <Field label={t('abitudini.durata_stimata_per_il_planner')} th={th}>
        <TextInput
          testID="planner-minutes"
          value={f.planner_minutes}
          onChangeText={(v) => set('planner_minutes', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder={t('abitudini.unit_min')}
          placeholderTextColor={th.text3}
          maxLength={4}
          style={input(errBorder('planner_minutes'))}
        />
        <Hint th={th}>{t('abitudini.hint_minuti_planner')}</Hint>
      </Field>

      <Field label={t('abitudini.frase_motivazionale')} th={th}>
        <TextInput
          testID="habit-motivation"
          value={f.motivation}
          onChangeText={(v) => set('motivation', v)}
          placeholder={t('abitudini.ph_motivazione')}
          placeholderTextColor={th.text3}
          maxLength={255}
          style={input()}
        />
      </Field>

      <Field label={t('abitudini.inizio')} th={th}>
        <DateField
          testID="start-date"
          th={th}
          value={f.start_date}
          placeholder={t('abitudini.inizio')}
          onChange={(d) => set('start_date', d)}
        />
      </Field>
    </ScrollView>
  );

  const title =
    page === 'icons'
      ? t('abitudini.scegli_un_icona')
      : page === 'presets'
        ? t('abitudini.abitudini_pronte')
        : editing
          ? t('abitudini.modifica_abitudine')
          : t('abitudini.nuova_abitudine');

  return (
    <>
      <View style={[styles.backdrop, wide && { justifyContent: 'center', alignItems: 'center' }]}>
        <Pressable
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={p.onClose}
          testID="habit-form-backdrop"
          accessibilityLabel={t('comune.annulla')}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.sheet,
            { backgroundColor: th.surface, maxHeight: Math.min(height - insets.top - 12, 900) },
            wide
              ? { width: 560, borderRadius: 30 }
              : { borderTopLeftRadius: 30, borderTopRightRadius: 30 },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: th.hairline2 }]} />
          <View style={styles.head}>
            <Text style={[styles.title, { color: th.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              testID="habit-form-close"
              accessibilityRole="button"
              accessibilityLabel={page === 'form' ? t('comune.annulla') : '‹'}
              onPress={() => (page === 'form' ? p.onClose() : setPage('form'))}
              style={[styles.close, { backgroundColor: th.surface2 }]}
            >
              <Text style={{ color: th.text2, fontSize: 18, fontWeight: '700' }}>
                {page === 'form' ? '✕' : '‹'}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.sep, { backgroundColor: th.hairline }]} />
          <View style={{ flexShrink: 1, minHeight: 200 }}>
            {page === 'form' ? formPage : page === 'icons' ? iconsPage : presetsPage}
          </View>
          {page === 'form' && (
            <View
              style={[
                styles.foot,
                { borderTopColor: th.hairline, paddingBottom: Math.max(insets.bottom, 14) },
              ]}
            >
              <Pressable testID="habit-save" accessibilityRole="button" onPress={submit}>
                <LinearGradient
                  colors={[mix(accent, '#FFFFFF', 0.82), accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.save}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>
                    {editing ? t('comune.salva') : t('abitudini.crea_abitudine')}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

/**
 * Il foglio vero e proprio vive dentro la finestra solo mentre è aperto: così ogni apertura riparte da zero
 * (o dai dati dell'abitudine da modificare) senza dover «resettare» uno stato rimasto da prima.
 */
export function HabitForm(p: HabitFormProps) {
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      {p.visible && <HabitFormBody key={p.habit?.uuid ?? 'new'} {...p} />}
    </Modal>
  );
}

/** Solo ciò che serve a trovare una categoria dallo slug. */
const p_categories = (c: HabitCategory[]) => c.map((x) => ({ uuid: x.uuid, slug: x.slug ?? '' }));

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.42)', justifyContent: 'flex-end' },
  sheet: { overflow: 'hidden' },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  title: { flex: 1, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sep: { height: StyleSheet.hairlineWidth },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  foot: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  save: { borderRadius: 22, paddingVertical: 18, alignItems: 'center' },
  nameRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBig: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  input: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17 },
  quiet: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sub: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
  },
  presetIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
