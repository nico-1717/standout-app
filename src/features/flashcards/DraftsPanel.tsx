import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { PrimaryButton, TextButton } from '@/ui/kit';

import { DeckPicker } from './DeckPicker';
import type { Draft, FlashcardsRepo } from './repo';

/**
 * «Carta veloce» (Home › Bozze): scrivi solo il fronte e salva per dopo; più tardi la completi con il retro e il mazzo e
 * diventa una carta vera. Le bozze si sincronizzano come tutto il resto, anche senza rete.
 */
export function DraftsPanel(p: { repo: FlashcardsRepo; version: number; changed: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const ht = useMemo(() => habitsTheme(th.scheme, undefined, th.style), [th.scheme, th.style]);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState(false);
  const [open, setOpen] = useState<Draft | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [deck, setDeck] = useState<string | null>(null);
  const [error, setError] = useState<'back' | 'deck' | null>(null);
  const [all, setAll] = useState(false);

  const data = useMemo(() => {
    void p.version;
    return { drafts: p.repo.drafts(), decks: p.repo.decks() };
  }, [p.repo, p.version]);
  const shown = all ? data.drafts : data.drafts.slice(0, 3);

  const add = () => {
    if (!p.repo.addDraft(text)) return;
    setText('');
    setNotice(true);
    p.changed();
  };
  const start = (d: Draft) => {
    setOpen(d);
    setFront(d.front);
    setBack(d.back);
    setDeck(d.deck_uuid && data.decks.some((x) => x.uuid === d.deck_uuid) ? d.deck_uuid : null);
    setError(null);
  };
  const finish = () => {
    if (!open) return;
    if (!back.trim()) return setError('back');
    if (!deck) return setError('deck');
    if (p.repo.finishDraft(open.uuid, { front, back, deck })) {
      setOpen(null);
      p.changed();
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: th.text2, fontSize: 12 }}>{t('home.carta_veloce_aiuto')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          testID="draft-input"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setNotice(false);
          }}
          placeholder={t('home.carta_veloce_ph')}
          placeholderTextColor={th.text3}
          maxLength={500}
          returnKeyType="done"
          onSubmitEditing={add}
          style={{
            flex: 1,
            backgroundColor: th.surface2,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: th.text,
            fontSize: 16,
          }}
        />
        <View style={{ width: 120 }}>
          <PrimaryButton
            testID="draft-add"
            label={t('home.salva_per_dopo')}
            disabled={!text.trim()}
            onPress={add}
          />
        </View>
      </View>
      {notice ? (
        <Text testID="draft-saved" style={{ color: th.green, fontSize: 13 }}>
          {t('home.bozza_salvata')}
        </Text>
      ) : null}

      {data.drafts.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: th.text2, fontSize: 12, fontWeight: '700' }}>
            {t('home.da_completare')} · {data.drafts.length}
          </Text>
          {shown.map((d) => (
            <View
              key={d.uuid}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: th.surface2,
                borderRadius: 12,
                paddingLeft: 12,
              }}
            >
              <Text numberOfLines={2} style={{ flex: 1, color: th.text, paddingVertical: 10 }}>
                {d.front}
              </Text>
              <TextButton
                testID={`draft-finish-${d.uuid}`}
                label={t('home.completa')}
                onPress={() => start(d)}
              />
            </View>
          ))}
          {data.drafts.length > 3 ? (
            <TextButton
              testID="draft-more"
              label={
                all ? t('home.nascondi_passati') : t('home.altre_n', { n: data.drafts.length - 3 })
              }
              onPress={() => setAll(!all)}
            />
          ) : null}
        </View>
      ) : null}

      {open ? (
        <Sheet
          visible
          title={t('home.completa_carta')}
          th={ht}
          onClose={() => setOpen(null)}
          testID="draft-sheet"
        >
          <View style={{ padding: 20, gap: 12 }}>
            <Text style={{ color: ht.text2, fontWeight: '700' }}>{t('home.fronte')}</Text>
            <TextInput
              testID="draft-front"
              value={front}
              onChangeText={setFront}
              maxLength={500}
              multiline
              style={{
                backgroundColor: ht.surface2,
                borderRadius: 12,
                padding: 12,
                color: ht.text,
                fontSize: 16,
                minHeight: 48,
              }}
            />
            <Text style={{ color: ht.text2, fontWeight: '700' }}>{t('home.retro')}</Text>
            <TextInput
              testID="draft-back"
              value={back}
              onChangeText={(v) => {
                setBack(v);
                setError(null);
              }}
              placeholder={t('home.retro_ph')}
              placeholderTextColor={ht.text3}
              multiline
              style={{
                backgroundColor: ht.surface2,
                borderRadius: 12,
                padding: 12,
                color: ht.text,
                fontSize: 16,
                minHeight: 90,
              }}
            />
            <Text style={{ color: ht.text2, fontWeight: '700' }}>{t('home.mazzo')}</Text>
            {data.decks.length ? (
              <DeckPicker
                decks={data.decks}
                value={deck}
                onPick={(u) => {
                  setDeck(u);
                  setError(null);
                }}
              />
            ) : (
              <Text style={{ color: ht.text2 }}>{t('home.crea_mazzo')}</Text>
            )}
            {error ? (
              <Text testID="draft-error" style={{ color: '#FF3B30' }}>
                {error === 'back' ? t('home.scrivi_retro') : t('home.api_scegli_mazzo')}
              </Text>
            ) : null}
            <PrimaryButton testID="draft-save" label={t('home.salva_carta')} onPress={finish} />
            <Pressable
              testID="draft-delete"
              accessibilityRole="button"
              onPress={() => {
                p.repo.removeDraft(open.uuid);
                setOpen(null);
                p.changed();
              }}
              style={{ alignItems: 'center', padding: 10 }}
            >
              <Text style={{ color: '#FF3B30', fontWeight: '600' }}>{t('home.elimina')}</Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}
