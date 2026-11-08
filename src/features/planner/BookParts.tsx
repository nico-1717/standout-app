import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { cleanEmail, GUESTS_MAX, type Contact, type GuestInput, type Place } from './book';
import type { PlannerTheme } from './plannerTheme';

/* I pezzi della scheda evento che usano la rubrica e i luoghi salvati. Non scrivono niente: cambiano la lista in
   mano alla scheda, che la salva insieme all'evento. */

export interface PickedPlace {
  name: string | null;
  lat: number | null;
  lon: number | null;
  ref: string | null;
}

function Chip({
  pt,
  label,
  onPress,
  active,
  testID,
  hint,
}: {
  pt: PlannerTheme;
  label: string;
  onPress: () => void;
  active?: boolean;
  testID: string;
  hint?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? pt.accent : pt.paper2,
        borderWidth: 0.5,
        borderColor: pt.hair2,
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      <Text style={{ color: active ? pt.onAccent : pt.ink, fontSize: 13, fontFamily: pt.sans }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Gli invitati: quelli scelti (si tolgono toccando), un campo per scrivere un indirizzo, la rubrica per sceglierne. */
export function GuestsField({
  pt,
  contacts,
  guests,
  onChange,
}: {
  pt: PlannerTheme;
  contacts: Contact[];
  guests: GuestInput[];
  onChange: (next: GuestInput[]) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const has = (email: string) => guests.some((g) => g.email === email);
  const full = guests.length >= GUESTS_MAX;

  const add = (g: GuestInput) => {
    const mail = cleanEmail(g.email);
    if (!mail) return setError(t('planner.app_email_non_valida'));
    if (has(mail)) return setText('');
    if (full) return setError(t('planner.app_max_invitati'));
    onChange([...guests, { ...g, email: mail }]);
    setText('');
    setError(null);
  };
  const nameOf = (g: GuestInput) =>
    g.name || contacts.find((c) => c.email === g.email)?.name || g.email;
  const pickable = contacts.filter((c) => !has(c.email));

  return (
    <View testID="guests-field">
      {guests.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {guests.map((g) => (
            <Chip
              key={g.email}
              pt={pt}
              active
              testID={`guest-${g.email}`}
              label={`${nameOf(g)}  ×`}
              hint={t('planner.togli_2')}
              onPress={() => onChange(guests.filter((x) => x.email !== g.email))}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          testID="guest-input"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          onSubmitEditing={() => add({ email: text })}
          placeholder={t('planner.ph_email')}
          placeholderTextColor={pt.ink3}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          style={{
            flex: 1,
            backgroundColor: pt.paper2,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: pt.ink,
            fontSize: 15,
            fontFamily: pt.sans,
          }}
        />
        <Pressable
          testID="guest-add"
          accessibilityRole="button"
          onPress={() => add({ email: text })}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 12,
            backgroundColor: pt.paper2,
          }}
        >
          <Text style={{ color: pt.accentInk, fontFamily: pt.sans, fontSize: 14 }}>
            {t('planner.aggiungi_2')}
          </Text>
        </Pressable>
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
      {pickable.length ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: pt.ink3, fontSize: 11, marginBottom: 6, fontFamily: pt.sans }}>
            {t('planner.rubrica')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {pickable.map((c) => (
              <Chip
                key={c.uuid}
                pt={pt}
                testID={`guest-pick-${c.uuid}`}
                label={c.name}
                onPress={() => add({ email: c.email, name: c.name, contactUuid: c.uuid })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** I luoghi salvati come scelte rapide: si tocca per riempire il luogo. Quello che il titolo nomina è evidenziato. */
export function PlacesField({
  pt,
  places,
  suggested,
  chosenName,
  onPick,
}: {
  pt: PlannerTheme;
  places: Place[];
  suggested: string | null;
  chosenName: string | null;
  onPick: (p: Place) => void;
}) {
  if (!places.length) return null;
  return (
    <View testID="places-field" style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
      {places.map((p) => (
        <Chip
          key={p.uuid}
          pt={pt}
          testID={`place-pick-${p.uuid}`}
          label={p.label}
          active={p.uuid === suggested || (chosenName !== null && p.label === chosenName)}
          onPress={() => onPick(p)}
        />
      ))}
    </View>
  );
}
