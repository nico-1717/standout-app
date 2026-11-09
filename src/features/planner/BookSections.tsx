import { useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { cleanEmail, type BookRepo, type Contact, type Place } from './book';
import {
  PlaceHits,
  PlaceMap,
  PlaceStatus,
  usePlacePick,
  usePlaceSearch,
  type PlacesApi,
} from './PlaceSearch';
import type { PlannerTheme } from './plannerTheme';

/* «Rubrica» e «Luoghi salvati» nella pagina Calendari e categorie: si leggono, si cambiano sul posto, si tolgono.
   Stessa forma delle altre sezioni della pagina (una scheda per riga, nome che si cambia scrivendo). */

interface Look {
  pt: PlannerTheme;
  card: ViewStyle;
  input: TextStyle;
  heading: TextStyle;
}

function Del({
  pt,
  id,
  label,
  onPress,
}: {
  pt: PlannerTheme;
  id: string;
  label: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={`${label} – ${t('planner.elimina')}`}
      onPress={onPress}
    >
      <Text style={{ color: '#B4645F', fontSize: 14 }}>{t('planner.elimina')}</Text>
    </Pressable>
  );
}

function ContactRow({
  c,
  book,
  look,
  changed,
}: {
  c: Contact;
  book: BookRepo;
  look: Look;
  changed: () => void;
}) {
  const { t } = useTranslation();
  const { pt, card, input } = look;
  const [error, setError] = useState<string | null>(null);
  const edit = (patch: { name?: string; email?: string }) => {
    const ok = book.updateContact(c.uuid, patch);
    if (!ok) {
      setError(
        patch.email !== undefined && cleanEmail(patch.email)
          ? t('planner.app_email_gia')
          : t('planner.app_email_non_valida'),
      );
      return;
    }
    setError(null);
    changed();
  };
  return (
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TextInput
          testID={`contact-name-${c.uuid}`}
          defaultValue={c.name}
          placeholder={t('planner.nome')}
          placeholderTextColor={pt.ink3}
          style={input}
          onEndEditing={(e) => {
            const n = e.nativeEvent.text.trim();
            if (n !== c.name) edit({ name: n });
          }}
        />
        <Del
          pt={pt}
          id={`contact-del-${c.uuid}`}
          label={c.name}
          onPress={() =>
            Alert.alert(t('planner.elimino_nome', { nome: c.name }), undefined, [
              { text: t('comune.annulla'), style: 'cancel' },
              {
                text: t('planner.elimina'),
                style: 'destructive',
                onPress: () => {
                  book.removeContact(c.uuid);
                  changed();
                },
              },
            ])
          }
        />
      </View>
      <TextInput
        testID={`contact-email-${c.uuid}`}
        defaultValue={c.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t('planner.ph_email_contatto')}
        placeholderTextColor={pt.ink3}
        style={{ ...input, color: pt.ink2, fontSize: 14 }}
        onEndEditing={(e) => {
          const v = e.nativeEvent.text.trim();
          if (v.toLowerCase() !== c.email) edit({ email: v });
        }}
      />
      {error ? (
        <Text
          testID={`contact-error-${c.uuid}`}
          accessibilityRole="alert"
          style={{ color: '#B4645F', fontSize: 12 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function PlaceRow({
  p,
  book,
  look,
  changed,
}: {
  p: Place;
  book: BookRepo;
  look: Look;
  changed: () => void;
}) {
  const { t } = useTranslation();
  const { pt, card, input } = look;
  const small = { ...input, color: pt.ink2, fontSize: 14 } as const;
  return (
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TextInput
          testID={`place-label-${p.uuid}`}
          defaultValue={p.label}
          placeholder={t('planner.nome')}
          placeholderTextColor={pt.ink3}
          style={input}
          onEndEditing={(e) => {
            const n = e.nativeEvent.text.trim();
            if (n && n !== p.label) {
              book.updatePlace(p.uuid, { label: n });
              changed();
            }
          }}
        />
        <Del
          pt={pt}
          id={`place-del-${p.uuid}`}
          label={p.label}
          onPress={() =>
            Alert.alert(t('planner.elimino_nome', { nome: p.label }), undefined, [
              { text: t('comune.annulla'), style: 'cancel' },
              {
                text: t('planner.elimina'),
                style: 'destructive',
                onPress: () => {
                  book.removePlace(p.uuid);
                  changed();
                },
              },
            ])
          }
        />
      </View>
      <TextInput
        testID={`place-address-${p.uuid}`}
        defaultValue={p.address}
        placeholder={t('planner.app_indirizzo')}
        placeholderTextColor={pt.ink3}
        style={small}
        onEndEditing={(e) => {
          const v = e.nativeEvent.text.trim();
          if (v !== p.address) {
            book.updatePlace(p.uuid, { address: v });
            changed();
          }
        }}
      />
      <TextInput
        testID={`place-words-${p.uuid}`}
        defaultValue={p.keywords}
        autoCapitalize="none"
        placeholder={t('planner.parole_che_lo_agganciano_separate')}
        placeholderTextColor={pt.ink3}
        style={small}
        onEndEditing={(e) => {
          book.updatePlace(p.uuid, { keywords: e.nativeEvent.text });
          changed();
        }}
      />
      {p.place_lat !== null && p.place_lon !== null ? (
        <View testID={`place-onmap-${p.uuid}`} style={{ marginTop: 6 }}>
          <PlaceMap pt={pt} lat={p.place_lat} lon={p.place_lon} name={p.place_name ?? p.label} />
        </View>
      ) : null}
    </View>
  );
}

/** La rubrica e i luoghi salvati, uno dopo l'altro. */
export function BookSections({
  book,
  contacts,
  places,
  search: searchApi,
  lang = 'en',
  look,
  changed,
}: {
  book: BookRepo;
  contacts: Contact[];
  places: Place[];
  /** la ricerca dei posti sul sito (solo online); senza, l'indirizzo resta un testo libero */
  search?: PlacesApi;
  lang?: string;
  look: Look;
  changed: () => void;
}) {
  const { t } = useTranslation();
  const { pt, card, input, heading } = look;
  const [mail, setMail] = useState('');
  const [name, setName] = useState('');
  const [mailError, setMailError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const search = usePlaceSearch(searchApi, lang);
  const chosen = usePlacePick(searchApi, lang);

  const addContact = () => {
    const clean = cleanEmail(mail);
    if (!clean) return setMailError(t('planner.app_email_non_valida'));
    if (!book.addContact(clean, name)) return setMailError(t('planner.app_email_gia'));
    setMail('');
    setName('');
    setMailError(null);
    changed();
  };
  const addPlace = () => {
    const pt = chosen.place;
    if (
      !book.addPlace({
        label,
        address,
        placeName: pt?.name ?? null,
        lat: pt?.lat ?? null,
        lon: pt?.lon ?? null,
        ref: pt?.ref ?? null,
      })
    )
      return;
    setLabel('');
    setAddress('');
    chosen.clear();
    search.close();
    changed();
  };

  return (
    <>
      <Text style={{ ...heading, marginTop: 10 }}>{t('planner.rubrica')}</Text>
      {contacts.length ? (
        contacts.map((c) => (
          <ContactRow key={c.uuid} c={c} book={book} look={look} changed={changed} />
        ))
      ) : (
        <Text testID="contacts-empty" style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
          {t('planner.la_rubrica_e_ancora_vuota')}
        </Text>
      )}
      <View style={card}>
        <TextInput
          testID="contact-new-name"
          value={name}
          onChangeText={setName}
          placeholder={t('planner.nome')}
          placeholderTextColor={pt.ink3}
          style={input}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            testID="contact-new-email"
            value={mail}
            onChangeText={(v) => {
              setMail(v);
              setMailError(null);
            }}
            onSubmitEditing={addContact}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('planner.ph_email_contatto')}
            placeholderTextColor={pt.ink3}
            style={input}
          />
          <Pressable
            testID="contact-add"
            accessibilityRole="button"
            accessibilityLabel={t('planner.nuovo_contatto')}
            onPress={addContact}
          >
            <Text style={{ color: pt.accentInk, fontSize: 22 }}>＋</Text>
          </Pressable>
        </View>
        {mailError ? (
          <Text
            testID="contact-new-error"
            accessibilityRole="alert"
            style={{ color: '#B4645F', fontSize: 12 }}
          >
            {mailError}
          </Text>
        ) : null}
      </View>

      <Text style={{ ...heading, marginTop: 10 }}>{t('planner.luoghi_salvati')}</Text>
      {places.length ? (
        places.map((p) => <PlaceRow key={p.uuid} p={p} book={book} look={look} changed={changed} />)
      ) : (
        <Text testID="places-empty" style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
          {t('planner.app_nessun_luogo')}
        </Text>
      )}
      <View style={card}>
        <TextInput
          testID="place-new-label"
          value={label}
          onChangeText={setLabel}
          placeholder={t('planner.nome')}
          placeholderTextColor={pt.ink3}
          style={input}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            testID="place-new-address"
            value={address}
            onChangeText={(v) => {
              setAddress(v);
              // scrivendo a mano l'aggancio cade
              chosen.clear();
              search.type(v);
            }}
            onBlur={() => setTimeout(search.close, 200)}
            onSubmitEditing={addPlace}
            placeholder={t('planner.app_indirizzo')}
            placeholderTextColor={pt.ink3}
            style={input}
          />
          <Pressable
            testID="place-add"
            accessibilityRole="button"
            accessibilityLabel={t('planner.luogo')}
            onPress={addPlace}
          >
            <Text style={{ color: pt.accentInk, fontSize: 22 }}>＋</Text>
          </Pressable>
        </View>
        <PlaceHits
          pt={pt}
          hits={search.hits}
          onPick={(h) => {
            search.close();
            setAddress(h.full || h.name);
            if (!label.trim()) setLabel(h.name.slice(0, 60));
            chosen.pick(h);
          }}
        />
        {chosen.place ? (
          <PlaceStatus
            pt={pt}
            place={chosen.place}
            waiting={chosen.waiting}
            onClear={chosen.clear}
          />
        ) : null}
        {chosen.notFound ? (
          <Text testID="place-not-found" style={{ color: pt.ink3, fontSize: 12 }}>
            {t('planner.posizione_non_trovata_resta_il')}
          </Text>
        ) : null}
      </View>
    </>
  );
}
