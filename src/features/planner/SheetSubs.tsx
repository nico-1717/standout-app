/**
 * I fogli che si aprono da dentro il foglio dell'evento, come sul sito: il selettore dei progetti, i luoghi salvati
 * (`apriRubrica`) e la rubrica dei contatti (`openRubrica`).
 */
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProjectPicker } from '@/features/projects/ProjectPicker';
import type { Project } from '@/features/projects/logic';
import { Text } from '@/ui/CappedText';

import type { BookRepo, Contact, Place } from './book';
import type { PlannerTheme } from './plannerTheme';
import { fieldBox, FieldLabel, IconBtn, SheetGlyph, SheetPanel, TxtBtn } from './sheetUi';

const inputStyle = (pt: PlannerTheme) =>
  ({
    ...fieldBox(pt),
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: pt.ink,
    fontSize: 15,
    fontFamily: pt.sans,
  }) as const;

function SubHead({
  pt,
  title,
  onClose,
  testID,
}: {
  pt: PlannerTheme;
  title: string;
  onClose: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={{ color: pt.ink, fontSize: 20, fontFamily: pt.serif }}>{title}</Text>
      <TxtBtn pt={pt} testID={testID} label={t('comune.chiudi')} onPress={onClose} />
    </>
  );
}

/** Il selettore dei progetti (`ps-modal-plev`): l'albero dei progetti, «nessun progetto» in cima. */
export function ProjectSheet({
  pt,
  projects,
  value,
  onPick,
  onClose,
  onCreate,
}: {
  pt: PlannerTheme;
  projects: Project[];
  value: string | null;
  onPick: (uuid: string | null) => void;
  onClose: () => void;
  /** crea un progetto al volo (il «Nuovo progetto» del selettore del sito) */
  onCreate?: (name: string) => string | null;
}) {
  const { t } = useTranslation();
  return (
    <SheetPanel
      pt={pt}
      onBackdrop={onClose}
      onClose={onClose}
      head={
        <SubHead
          pt={pt}
          title={t('todo.collega_progetto')}
          onClose={onClose}
          testID="project-sheet-close"
        />
      }
    >
      <View style={{ paddingHorizontal: 14, paddingBottom: 20 }}>
        <ProjectPicker projects={projects} value={value} onPick={onPick} onCreate={onCreate} />
      </View>
    </SheetPanel>
  );
}

/** I luoghi salvati: si sceglie uno (riempie il luogo), si toglie, e si salva il posto agganciato adesso. */
export function SavedPlacesSheet({
  pt,
  book,
  places,
  onPlaces,
  canSave,
  placeName,
  address,
  lat,
  lon,
  placeRef,
  onPick,
  onClose,
}: {
  pt: PlannerTheme;
  book: BookRepo;
  places: Place[];
  onPlaces: (next: Place[]) => void;
  /** c'è un posto agganciato a una posizione vera: solo allora si può salvare */
  canSave: boolean;
  placeName: string | null;
  address: string;
  lat: number | null;
  lon: number | null;
  placeRef: string | null;
  onPick: (p: Place) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(placeName ?? '');
  const [words, setWords] = useState('');
  const [error, setError] = useState(false);
  const save = () => {
    if (!label.trim()) return;
    const id = book.addPlace({
      label,
      keywords: words,
      placeName,
      address,
      lat,
      lon,
      ref: placeRef,
    });
    if (!id) return setError(true);
    setError(false);
    setWords('');
    onPlaces(book.places());
  };
  return (
    <SheetPanel
      pt={pt}
      tall
      onBackdrop={onClose}
      onClose={onClose}
      head={
        <SubHead
          pt={pt}
          title={t('planner.luoghi_salvati')}
          onClose={onClose}
          testID="places-sheet-close"
        />
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30, gap: 8 }}
      >
        {places.length === 0 ? (
          <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>
            {t('planner.ancora_nessun_posto_scegline_uno')}
          </Text>
        ) : null}
        {places.map((p) => {
          const sub = [p.address || p.place_name || '', p.keywords].filter(Boolean).join('  ·  ');
          return (
            <View key={p.uuid} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                testID={`place-pick-${p.uuid}`}
                accessibilityRole="button"
                onPress={() => onPick(p)}
                style={[fieldBox(pt), { flex: 1, paddingVertical: 10, paddingHorizontal: 12 }]}
              >
                <Text style={{ color: pt.ink, fontSize: 14.5, fontFamily: pt.sans }}>
                  {p.label}
                </Text>
                {sub ? (
                  <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>{sub}</Text>
                ) : null}
              </Pressable>
              <IconBtn
                pt={pt}
                testID={`place-remove-${p.uuid}`}
                label={t('planner.togli_dalla_rubrica')}
                onPress={() => {
                  book.removePlace(p.uuid);
                  onPlaces(book.places());
                }}
              >
                <SheetGlyph name="close" color={pt.ink2} stroke={2.2} />
              </IconBtn>
            </View>
          );
        })}
        {canSave ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <FieldLabel pt={pt}>{t('planner.salva_questo_posto')}</FieldLabel>
            <TextInput
              testID="place-label"
              value={label}
              onChangeText={setLabel}
              maxLength={60}
              placeholder={t('planner.come_lo_chiami_casa_lavoro')}
              placeholderTextColor={pt.ink3}
              style={inputStyle(pt)}
            />
            <TextInput
              testID="place-words"
              value={words}
              onChangeText={setWords}
              maxLength={255}
              placeholder={t('planner.parole_che_lo_agganciano_separate')}
              placeholderTextColor={pt.ink3}
              style={inputStyle(pt)}
            />
            <Pressable
              testID="place-save"
              accessibilityRole="button"
              onPress={save}
              style={{
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: pt.accent,
              }}
            >
              <Text style={{ color: pt.onAccent, fontSize: 14.5, fontFamily: pt.sans }}>
                {t('planner.salva_nella_rubrica')}
              </Text>
            </Pressable>
            {error ? (
              <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>
                {t('planner.non_sono_riuscito_a_salvarlo')}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: pt.ink3, fontSize: 11.5, marginTop: 8, fontFamily: pt.sans }}>
            {t('planner.per_salvarne_uno_nuovo_scegli')}
          </Text>
        )}
      </ScrollView>
    </SheetPanel>
  );
}

/** La rubrica dei contatti: ricerca per nome o indirizzo, si tocca per invitare, si toglie, si aggiunge un contatto. */
export function ContactsSheet({
  pt,
  book,
  contacts,
  onContacts,
  onInvite,
  onClose,
}: {
  pt: PlannerTheme;
  book: BookRepo;
  contacts: Contact[];
  onContacts: (next: Contact[]) => void;
  onInvite: (c: Contact) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [error, setError] = useState(false);
  const needle = q.trim().toLowerCase();
  const shown = contacts
    .filter((c) => !needle || `${c.name} ${c.email}`.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const add = () => {
    if (!book.addContact(mail, name)) return setError(true);
    setError(false);
    setName('');
    setMail('');
    onContacts(book.contacts());
  };
  return (
    <SheetPanel
      pt={pt}
      tall
      onBackdrop={onClose}
      onClose={onClose}
      head={
        <SubHead
          pt={pt}
          title={t('planner.rubrica')}
          onClose={onClose}
          testID="contacts-sheet-close"
        />
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}
      >
        <TextInput
          testID="contacts-search"
          value={q}
          onChangeText={setQ}
          placeholder={t('planner.cerca_per_nome_o_indirizzo')}
          placeholderTextColor={pt.ink3}
          autoCapitalize="none"
          style={inputStyle(pt)}
        />
        <View style={{ marginTop: 12, gap: 8 }}>
          {shown.length === 0 ? (
            <Text
              style={{ color: pt.ink3, fontSize: 15, fontFamily: pt.serif, paddingVertical: 8 }}
            >
              {needle ? t('planner.nessun_contatto') : t('planner.la_rubrica_e_ancora_vuota')}
            </Text>
          ) : null}
          {shown.map((c) => (
            <View key={c.uuid} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                testID={`guest-pick-${c.uuid}`}
                accessibilityRole="button"
                onPress={() => onInvite(c)}
                style={[fieldBox(pt), { flex: 1, paddingVertical: 10, paddingHorizontal: 12 }]}
              >
                <Text style={{ color: pt.ink, fontSize: 14.5, fontFamily: pt.sans }}>{c.name}</Text>
                <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>
                  {c.email}
                </Text>
              </Pressable>
              <IconBtn
                pt={pt}
                testID={`contact-remove-${c.uuid}`}
                label={t('comune.elimina')}
                onPress={() => {
                  book.removeContact(c.uuid);
                  onContacts(book.contacts());
                }}
              >
                <SheetGlyph name="trash" color={pt.ink2} />
              </IconBtn>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18, gap: 8 }}>
          <FieldLabel pt={pt}>{t('planner.nuovo_contatto')}</FieldLabel>
          <TextInput
            testID="contact-name"
            value={name}
            onChangeText={setName}
            maxLength={80}
            placeholder={t('planner.come_lo_chiami_luchino')}
            placeholderTextColor={pt.ink3}
            style={inputStyle(pt)}
          />
          <TextInput
            testID="contact-email"
            value={mail}
            onChangeText={(v) => {
              setMail(v);
              setError(false);
            }}
            placeholder={t('planner.ph_email_contatto')}
            placeholderTextColor={pt.ink3}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle(pt)}
          />
          <Pressable
            testID="contact-save"
            accessibilityRole="button"
            onPress={add}
            style={{
              paddingVertical: 12,
              borderRadius: 14,
              alignItems: 'center',
              backgroundColor: pt.accent,
            }}
          >
            <Text style={{ color: pt.onAccent, fontSize: 14.5, fontFamily: pt.sans }}>
              {t('planner.salva_in_rubrica')}
            </Text>
          </Pressable>
          {error ? (
            <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>
              {t('planner.indirizzo_non_valido')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SheetPanel>
  );
}
