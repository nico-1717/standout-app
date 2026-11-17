import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import { cleanEmail, GUESTS_MAX, type GuestInput } from './book';
import type { PlannerTheme } from './plannerTheme';
import { fieldBox, IconBtn, SheetGlyph, Tag } from './sheetUi';

/* I pezzi della scheda evento che usano la rubrica. Non scrivono niente: cambiano la lista in mano alla scheda,
   che la salva insieme all'evento. */

export interface PickedPlace {
  name: string | null;
  lat: number | null;
  lon: number | null;
  ref: string | null;
}

/** Il celeste degli invitati (`#CFDDEA`, come sul sito). */
const GUEST_TINT = '#CFDDEA';
/** Le code degli indirizzi più comuni, come sul sito: compaiono mentre si scrive e completano l'indirizzo. */
export const MAIL_DOMAINS = [
  '@gmail.com',
  '@icloud.com',
  '@outlook.it',
  '@libero.it',
  '@hotmail.it',
  '@yahoo.it',
  '@virgilio.it',
];

/**
 * Gli invitati, come sul sito: le pillole di chi è invitato (si tolgono toccando), un campo per scrivere un indirizzo
 * (Invio lo aggiunge), il pulsante della rubrica e, mentre si scrive, le code degli indirizzi più comuni.
 */
export function GuestsField({
  pt,
  nameOf,
  guests,
  onChange,
  onOpenBook,
}: {
  pt: PlannerTheme;
  /** il nome da mostrare per un invitato (quello scelto dalla rubrica, o l'indirizzo) */
  nameOf: (g: GuestInput) => string;
  guests: GuestInput[];
  onChange: (next: GuestInput[]) => void;
  onOpenBook: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const mail = cleanEmail(text);
    if (!mail) return setError(t('planner.app_email_non_valida'));
    if (guests.some((g) => g.email === mail)) return setText('');
    if (guests.length >= GUESTS_MAX) return setError(t('planner.app_max_invitati'));
    onChange([...guests, { email: mail }]);
    setText('');
    setError(null);
  };

  return (
    <View testID="guests-field">
      {guests.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {guests.map((g) => (
            <Tag
              key={g.email}
              pt={pt}
              on
              dot={false}
              color={GUEST_TINT}
              testID={`guest-${g.email}`}
              label={nameOf(g)}
              trailing={<SheetGlyph name="close" color={pt.ink2} size={11} stroke={2.4} />}
              onPress={() => onChange(guests.filter((x) => x.email !== g.email))}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 8 }}>
        <TextInput
          testID="guest-input"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          onSubmitEditing={add}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('planner.ph_email')}
          placeholderTextColor={pt.ink3}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          style={[
            fieldBox(pt),
            {
              flex: 1,
              paddingHorizontal: 13,
              paddingVertical: 12,
              color: pt.ink,
              fontSize: 15,
              fontFamily: pt.sans,
            },
          ]}
        />
        <IconBtn
          pt={pt}
          testID="guest-book"
          label={t('planner.apri_la_rubrica')}
          onPress={onOpenBook}
        >
          <SheetGlyph name="book" color={pt.ink2} />
        </IconBtn>
      </View>
      {error ? (
        <Text
          testID="guest-error"
          accessibilityRole="alert"
          style={{ color: '#B4645F', fontSize: 12, marginTop: 6, fontFamily: pt.sans }}
        >
          {error}
        </Text>
      ) : null}
      {focused ? (
        <View
          testID="guest-domains"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }}
        >
          {MAIL_DOMAINS.map((d) => (
            <Tag
              key={d}
              pt={pt}
              on={false}
              dot={false}
              testID={`guest-domain-${d}`}
              label={d}
              onPress={() => setText((cur) => `${cur.split('@')[0] ?? ''}${d}`)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
