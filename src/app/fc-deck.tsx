import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { docToPlain, parseDoc } from '@/features/flashcards/doc';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import { DeckPicker } from '@/features/flashcards/DeckPicker';
import {
  DECK_ICON_KEYS,
  compareDecks,
  daysToExam,
  deckBranch,
  deckIcon,
  deckMap,
  deckPath,
  examUrgency,
  iconFromName,
  type Deck,
} from '@/features/flashcards/logic';
import { isRichNote, noteText } from '@/features/projects/notes';
import { localToday } from '@/features/tasks/groups';
import { DateTimeField } from '@/ui/DateTimeField';
import { Card, Header, PrimaryButton, SectionLabel, TextButton } from '@/ui/kit';

/** Le dodici tinte del sito (fc_decks.php, $colorPalette). */
const SWATCHES = [
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#00C7BE',
  '#30B0C7',
  '#32ADE6',
  '#007AFF',
  '#5856D6',
  '#AF52DE',
  '#FF2D55',
  '#A2845E',
];

const preview = (raw: string | null): string => {
  const t = docToPlain(parseDoc(raw)).replace(/\s+/g, ' ').trim();
  return t.length > 110 ? t.slice(0, 110) + '…' : t;
};

/** La scheda di una categoria: nome, padre, colore, icona, esame, fissata/archiviata, note; sottocategorie e carte. */
export default function DeckScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { services, version, changed } = useApp();

  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sub, setSub] = useState('');
  const [moving, setMoving] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const data = useMemo(() => {
    void version;
    if (!services || typeof id !== 'string') return null;
    const repo = services.flashcards;
    const deck = repo.deck(id);
    if (!deck) return null;
    const decks = repo.decks();
    return {
      deck,
      decks,
      kids: decks.filter((d) => d.parent_uuid === id).sort(compareDecks),
      cards: repo.cards(id),
      counts: repo.cardCounts(),
      canDelete: repo.canDeleteDeck(id),
    };
  }, [services, version, id]);

  if (!services || typeof id !== 'string') return null;
  if (!data) {
    // la categoria non c'è (più): si torna indietro
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top + 40, padding: 24 }}>
        <TextButton
          testID="fcd-gone-back"
          label={t('comune.indietro')}
          onPress={() => router.back()}
        />
      </View>
    );
  }
  const { deck, decks, kids, cards, counts } = data;
  const repo = services.flashcards;
  const map = deckMap(decks);
  const crumbs = deckPath(map, id);
  const rich = !!deck.notes && isRichNote(deck.notes);
  const today = localToday();
  const exam = daysToExam(deck.exam_date, today);

  const patch = (p: Parameters<typeof repo.updateDeck>[1]) => {
    repo.updateDeck(id, p);
    changed();
  };
  const saveName = () => {
    if (name !== null) repo.updateDeck(id, { name });
    setName(null);
    changed();
  };
  const saveNote = () => {
    if (note !== null && !rich) repo.updateDeck(id, { notes: note });
    setNote(null);
    changed();
  };
  const open = (d: Deck) => router.push({ pathname: '/fc-deck', params: { id: d.uuid } });
  const autoIcon = iconFromName(deck.name);

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={deck.name}
        right={
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <Pressable
              testID="fcd-pin"
              accessibilityRole="button"
              accessibilityLabel={t('fc.dk_fissa')}
              onPress={() => {
                repo.setPinned(id, !deck.pinned);
                changed();
              }}
            >
              <Text style={{ fontSize: 18, opacity: deck.pinned ? 1 : 0.35 }}>📌</Text>
            </Pressable>
            <Pressable testID="fcd-close" accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {crumbs.length ? (
          <Text style={{ color: th.text2 }} numberOfLines={2}>
            {crumbs.map((c, i) => (
              <Text key={c.uuid} testID={`fcd-crumb-${c.uuid}`} onPress={() => open(c)}>
                {i ? ' › ' : ''}
                {c.name}
              </Text>
            ))}
          </Text>
        ) : null}

        <Card style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: deck.color + '26',
              }}
            >
              <DeckIcon name={deckIcon(deck)} color={deck.color} size={26} />
            </View>
            <TextInput
              testID="fcd-name"
              value={name ?? deck.name}
              onChangeText={setName}
              onBlur={saveName}
              onSubmitEditing={saveName}
              placeholder={t('fc.app_nome_mazzo')}
              placeholderTextColor={th.text3}
              style={{ flex: 1, color: th.text, fontSize: 22, fontWeight: '700' }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="fcd-play"
                label={t('fc.cg_gioca')}
                onPress={() => router.push({ pathname: '/fc-setup', params: { preselect: id } })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="fcd-add-card"
                label={t('fc.app_aggiungi_carta')}
                onPress={() => router.push({ pathname: '/fc-card', params: { deck: id } })}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.dk_data_esame')}</SectionLabel>
            <DateTimeField
              kind="date"
              testID="fcd-exam"
              value={deck.exam_date ?? ''}
              fallback={today}
              placeholder={t('fc.dk_data_esame')}
              clearable
              onChange={(v) => patch({ exam_date: v || null })}
            />
            {exam !== null ? (
              <Text
                style={{
                  color:
                    examUrgency(exam) === 'urgent'
                      ? th.red
                      : examUrgency(exam) === 'near'
                        ? th.orange
                        : th.text2,
                  fontWeight: '600',
                }}
              >
                {exam === 0
                  ? t('fc.dk_esame_oggi')
                  : exam === 1
                    ? t('fc.dk_esame_domani')
                    : t('fc.dk_esame_tra', { n: exam })}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <SectionLabel>{t('fc.cfc_colore_cartella')}</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pressable
                testID="fcd-color-auto"
                accessibilityRole="radio"
                accessibilityLabel={t('fc.app_colore_auto')}
                accessibilityState={{ selected: !deck.color_edited }}
                onPress={() => patch({ color: null })}
                style={{
                  paddingHorizontal: 12,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: !deck.color_edited ? th.brand : th.hairline2,
                }}
              >
                <Text style={{ color: th.text, fontSize: 13 }}>{t('comune.automatico')}</Text>
              </Pressable>
              {SWATCHES.map((c) => {
                const on = !!deck.color_edited && deck.color.toUpperCase() === c;
                return (
                  <Pressable
                    key={c}
                    testID={`fcd-color-${c.slice(1)}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => patch({ color: c })}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: c,
                      borderWidth: on ? 3 : 0,
                      borderColor: th.text,
                    }}
                  />
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Pressable
              testID="fcd-icon-toggle"
              accessibilityRole="button"
              onPress={() => setIconsOpen(!iconsOpen)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <SectionLabel>{t('fc.dk_icona')}</SectionLabel>
              <Text style={{ color: th.brand }}>{iconsOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {iconsOpen ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[null, ...DECK_ICON_KEYS].map((k) => {
                  const on = (deck.icon ?? null) === k;
                  return (
                    <Pressable
                      key={k ?? '__auto'}
                      testID={`fcd-icon-${k ?? '_auto'}`}
                      accessibilityRole="radio"
                      accessibilityLabel={k ? t(`fc.ico_${k}`) : t('fc.dk_icona_auto')}
                      accessibilityState={{ selected: on }}
                      onPress={() => patch({ icon: k })}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? deck.color + '33' : th.surface2,
                        borderWidth: on ? 2 : 0,
                        borderColor: deck.color,
                      }}
                    >
                      {k ? (
                        <DeckIcon name={k} color={on ? deck.color : th.text2} size={24} />
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <DeckIcon name={autoIcon} color={on ? deck.color : th.text2} size={20} />
                          <Text style={{ color: th.text2, fontSize: 9 }}>A</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>{t('fc.dk_fissa')}</Text>
            <Switch
              testID="fcd-pin-switch"
              value={!!deck.pinned}
              onValueChange={(v) => {
                repo.setPinned(id, v);
                changed();
              }}
              trackColor={{ true: th.brand }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, color: th.text, fontWeight: '600' }}>
              {t('fc.cfc_archivia_questa')}
            </Text>
            <Switch
              testID="fcd-archive-switch"
              value={!!deck.archived}
              onValueChange={(v) => {
                repo.setArchived(id, v);
                changed();
              }}
              trackColor={{ true: th.brand }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.cfc_padre_titolo')}</SectionLabel>
            <Pressable
              testID="fcd-parent"
              accessibilityRole="button"
              onPress={() => setMoving(!moving)}
            >
              <Text style={{ color: th.brand, fontSize: 16 }}>
                {deck.parent_uuid ? (map.get(deck.parent_uuid)?.name ?? '—') : t('fc.cfc_tutte')} ›
              </Text>
            </Pressable>
            {moving ? (
              <Card style={{ backgroundColor: th.surface2 }}>
                <DeckPicker
                  decks={decks}
                  value={deck.parent_uuid}
                  allowRoot
                  rootLabel={t('fc.cfc_tutte')}
                  exclude={new Set(deckBranch(decks, id))}
                  onPick={(p) => {
                    repo.moveDeck(id, p);
                    setMoving(false);
                    changed();
                  }}
                />
              </Card>
            ) : null}
          </View>
        </Card>

        <Card style={{ padding: 16, gap: 8 }}>
          <SectionLabel>{t('fc.app_note_mazzo')}</SectionLabel>
          {rich ? (
            <>
              <Text testID="fcd-note-rich" style={{ color: th.text2, fontSize: 13 }}>
                {t('fc.app_note_ricche')}
              </Text>
              <Text style={{ color: th.text }}>{noteText(deck.notes ?? '')}</Text>
            </>
          ) : (
            <TextInput
              testID="fcd-note"
              value={note ?? deck.notes ?? ''}
              onChangeText={setNote}
              onBlur={saveNote}
              multiline
              placeholder={t('comune.note')}
              placeholderTextColor={th.text3}
              style={{ color: th.text, fontSize: 16, minHeight: 60, textAlignVertical: 'top' }}
            />
          )}
        </Card>

        <View style={{ gap: 8 }}>
          <SectionLabel>{t('fc.cfc_f_sottocategorie')}</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              testID="fcd-sub-input"
              value={sub}
              onChangeText={setSub}
              placeholder={t('fc.cfc_aggiungi_sottocategoria')}
              placeholderTextColor={th.text3}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (repo.createDeck({ name: sub, parent: id })) {
                  setSub('');
                  changed();
                }
              }}
              style={{
                flex: 1,
                backgroundColor: th.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: th.hairline,
                paddingHorizontal: 14,
                paddingVertical: 11,
                color: th.text,
                fontSize: 16,
              }}
            />
            <View style={{ width: 96 }}>
              <PrimaryButton
                testID="fcd-sub-add"
                label={t('vocab.cat_aggiungi')}
                disabled={!sub.trim()}
                onPress={() => {
                  if (repo.createDeck({ name: sub, parent: id })) {
                    setSub('');
                    changed();
                  }
                }}
              />
            </View>
          </View>
          {kids.length ? (
            <Card>
              {kids.map((k, i) => (
                <Pressable
                  key={k.uuid}
                  testID={`fcd-kid-${k.uuid}`}
                  accessibilityRole="button"
                  onPress={() => open(k)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderTopWidth: i ? 0.5 : 0,
                    borderTopColor: th.hairline,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: k.color + '26',
                    }}
                  >
                    <DeckIcon name={deckIcon(k)} color={k.color} size={20} />
                  </View>
                  <Text style={{ flex: 1, color: th.text, fontSize: 16 }} numberOfLines={1}>
                    {k.name}
                  </Text>
                  <Text style={{ color: th.text2 }}>{counts.get(k.uuid) ?? 0}</Text>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>{t('fc.cfc_carte')}</SectionLabel>
          {cards.length ? (
            <Card>
              {cards.map((c, i) => (
                <Pressable
                  key={c.uuid}
                  testID={`fcd-card-${c.uuid}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/fc-card', params: { id: c.uuid } })}
                  style={{
                    padding: 12,
                    gap: 4,
                    borderTopWidth: i ? 0.5 : 0,
                    borderTopColor: th.hairline,
                  }}
                >
                  <Text
                    style={{ color: th.text, fontSize: 16, fontWeight: '600' }}
                    numberOfLines={2}
                  >
                    {preview(c.question_desc) || '—'}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 14 }} numberOfLines={2}>
                    {preview(c.answer_desc)}
                  </Text>
                  {c.is_father ? (
                    <Text style={{ color: th.text3, fontSize: 12 }}>
                      {t('fc.app_carte_figlie')}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </Card>
          ) : (
            <Text style={{ color: th.text2, paddingVertical: 8 }}>{t('fc.app_nessuna_carta')}</Text>
          )}
        </View>

        <Card style={{ padding: 16, gap: 10 }}>
          {data.canDelete ? (
            deleting ? (
              <>
                <Text style={{ color: th.text, fontWeight: '700' }}>
                  {t('fc.app_elimina_mazzo')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <TextButton
                      testID="fcd-delete-cancel"
                      label={t('comune.annulla')}
                      onPress={() => setDeleting(false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      testID="fcd-delete-confirm"
                      danger
                      label={t('comune.elimina')}
                      onPress={() => {
                        repo.removeDeck(id);
                        changed();
                        router.back();
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <TextButton
                testID="fcd-delete"
                danger
                label={t('comune.elimina')}
                onPress={() => setDeleting(true)}
              />
            )
          ) : (
            <Text testID="fcd-delete-hint" style={{ color: th.text2, fontSize: 13 }}>
              {t('fc.app_elimina_solo_vuota')}
            </Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
