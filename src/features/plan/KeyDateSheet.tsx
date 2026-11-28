import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateField } from '@/features/habits/formParts';
import { Sheet } from '@/features/habits/Sheet';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { Choices, usePlanTheme } from './ui';

export type KeyLevel = 'high' | 'highest';

/** Una data importante già salvata, da cambiare o togliere (si apre toccandola nella lista). */
export interface KeyDateValue {
  title: string;
  date: string;
  level: KeyLevel;
  /** si ripete: il giorno non si cambia da qui */
  repeats?: boolean;
}

/**
 * «Aggiungi una data importante» (la barra del calendario): un evento di tutto il giorno nel planner, importante o
 * importantissimo, legato al progetto scelto. Toccando una riga della lista lo stesso foglio la cambia o la toglie.
 */
export function KeyDateSheet(p: {
  visible: boolean;
  /** il giorno proposto (di base oggi) */
  today: string;
  /** c'è: si sta cambiando questa data */
  initial?: KeyDateValue | null;
  onSave: (v: { title: string; date: string; level: KeyLevel }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(p.today);
  const [level, setLevel] = useState<KeyLevel>('high');
  const [armed, setArmed] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (p.visible !== wasOpen) {
    setWasOpen(p.visible);
    if (p.visible) {
      setTitle(p.initial?.title ?? '');
      setDate(p.initial?.date ?? p.today);
      setLevel(p.initial?.level ?? 'high');
      setArmed(false);
    }
  }
  const edit = !!p.initial;
  const ready = title.trim().length > 0 && date.length === 10;
  const save = () => {
    if (!ready) return;
    Keyboard.dismiss();
    p.onSave({ title: title.trim(), date, level });
  };
  const label = (k: string) => (
    <Text
      style={{
        color: ht.text2,
        fontSize: 12.5,
        fontWeight: '800',
        letterSpacing: 1.3,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {t(k)}
    </Text>
  );
  return (
    <Sheet
      visible={p.visible}
      title={t(edit ? 'piano.data_imp_modifica' : 'piano.data_imp_titolo')}
      th={ht}
      onClose={p.onClose}
      testID="keydate-sheet"
      footer={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            {edit && p.onDelete ? (
              <TextButton
                testID="keydate-delete"
                label={armed ? t('piano.data_imp_sicuro') : t('piano.elimina')}
                danger
                onPress={() => (armed ? p.onDelete!() : setArmed(true))}
              />
            ) : (
              <TextButton testID="keydate-cancel" label={t('piano.chiudi')} onPress={p.onClose} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              testID="keydate-save"
              label={t('piano.salva')}
              disabled={!ready}
              onPress={save}
            />
          </View>
        </View>
      }
    >
      <ScrollView
        testID="keydate-scroll"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* un tocco in un punto vuoto del foglio chiude la tastiera */}
        <Pressable
          testID="keydate-blank"
          accessible={false}
          onPress={Keyboard.dismiss}
          style={{ flexGrow: 1, padding: 20, gap: 20, minHeight: 360 }}
        >
          <View>
            {label('piano.data_imp_nome')}
            <TextInput
              testID="keydate-title"
              value={title}
              onChangeText={setTitle}
              maxLength={180}
              returnKeyType="done"
              onSubmitEditing={save}
              placeholder={t('piano.data_imp_nome')}
              placeholderTextColor={ht.text2}
              style={{
                minHeight: 46,
                borderRadius: 12,
                paddingHorizontal: 14,
                fontSize: 16,
                color: ht.text,
                backgroundColor: ht.surface2,
              }}
            />
          </View>
          {p.initial?.repeats ? null : (
            <View>
              {label('piano.data_imp_giorno')}
              <DateField
                testID="keydate-date"
                th={ht}
                value={date}
                placeholder={t('piano.data_imp_giorno')}
                onChange={setDate}
              />
            </View>
          )}
          <View>
            {label('piano.data_imp_livello')}
            <Choices<KeyLevel>
              testID="keydate-level"
              value={level}
              onChange={setLevel}
              options={[
                { value: 'high', label: t('piano.imp_high') },
                { value: 'highest', label: t('piano.imp_highest') },
              ]}
              tone={(v) => (v === 'highest' ? '#FF3B30' : '#FF9F0A')}
            />
          </View>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}
