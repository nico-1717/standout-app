import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { alpha } from '@/features/buy/buyTheme';

import { Field } from './formParts';
import type { HabitsTheme } from './habitsTheme';
import { labelDate } from './labels';
import type { Habit } from './logic';
import { Sheet } from './Sheet';

export const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
export const NOTE_MAX = 500; // lo stesso limite del server (lib/sync_abitudini.php)

export interface NoteSheetProps {
  /** null = chiuso */
  target: { habit: Habit; day: string; note: string; mood: number | null } | null;
  today: string;
  th: HabitsTheme;
  onClose: () => void;
  /** note vuota e mood null = «svuota» */
  onSave: (habit: Habit, day: string, note: string, mood: number | null) => void;
}

/** La nota di un check-in (#hbSheetNote del sito): com'è andata (5 faccine), il pensiero, «Cancella» e «Salva nota». */
export function NoteSheet(p: NoteSheetProps) {
  const { th } = p;
  const { t } = useTranslation();
  const target = p.target;
  return (
    <Sheet
      visible={target !== null}
      title={t('abitudini.nota_del_checkin')}
      th={th}
      onClose={p.onClose}
      testID="note-sheet"
    >
      {target && (
        <NoteBody key={`${target.habit.uuid}|${target.day}`} {...p} target={target} t={t} />
      )}
    </Sheet>
  );
}

function NoteBody(
  p: NoteSheetProps & {
    target: NonNullable<NoteSheetProps['target']>;
    t: ReturnType<typeof useTranslation>['t'];
  },
) {
  const { th, t, target } = p;
  const [text, setText] = useState(target.note);
  const [mood, setMood] = useState<number | null>(target.mood);
  const h = target.habit;
  return (
    <View style={{ flexShrink: 1 }}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.dayRow}>
          <View style={[styles.dayIcon, { backgroundColor: alpha(h.color, 0.18) }]}>
            <Text style={{ fontSize: 22 }}>{h.icon}</Text>
          </View>
          <View>
            <Text style={{ color: th.text, fontWeight: '800', fontSize: 17 }}>{h.name}</Text>
            <Text style={{ color: th.text2, fontSize: 13 }}>
              {labelDate(target.day, p.today, t)}
            </Text>
          </View>
        </View>
        <Field label={t('abitudini.com_e_andata')} th={th}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MOODS.map((m, i) => {
              const on = mood === i + 1;
              return (
                <Pressable
                  key={m}
                  testID={`mood-${i + 1}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('abitudini.livello_su_5', { n: i + 1 })}
                  accessibilityState={{ selected: on }}
                  onPress={() => setMood(on ? null : i + 1)}
                  style={[
                    styles.mood,
                    { backgroundColor: on ? th.surface : th.surface2 },
                    on && { borderWidth: 2, borderColor: th.accent },
                  ]}
                >
                  <Text style={{ fontSize: 24, opacity: on ? 1 : 0.45 }}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <Field label={t('abitudini.il_tuo_pensiero')} th={th}>
          <TextInput
            testID="note-text"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={NOTE_MAX}
            placeholder={t('abitudini.com_e_andata_questa_abitudine')}
            placeholderTextColor={th.text3}
            style={[styles.input, { backgroundColor: th.surface2, color: th.text }]}
          />
          <Text testID="note-count" style={{ color: th.text2, fontSize: 13, marginTop: 8 }}>
            {t(text.length === 1 ? 'abitudini.n_carattere' : 'abitudini.n_caratteri', {
              n: text.length,
            })}
          </Text>
        </Field>
      </ScrollView>
      <View style={[styles.foot, { borderTopColor: th.hairline, backgroundColor: th.surface }]}>
        <Pressable
          testID="note-clear"
          accessibilityRole="button"
          onPress={() => {
            setText('');
            setMood(null);
          }}
          style={[styles.btn, { backgroundColor: th.surface3 }]}
        >
          <Text style={{ color: th.text, fontWeight: '800', fontSize: 16 }}>
            {t('abitudini.cancella')}
          </Text>
        </Pressable>
        <Pressable
          testID="note-save"
          accessibilityRole="button"
          onPress={() => p.onSave(h, target.day, text.trim(), mood)}
          style={[styles.btn, { backgroundColor: th.accent }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
            {t('abitudini.salva_nota')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 20 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dayIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mood: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { borderRadius: 16, padding: 16, fontSize: 16, minHeight: 130, textAlignVertical: 'top' },
  foot: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: { flex: 1, borderRadius: 20, paddingVertical: 16, alignItems: 'center' },
});
