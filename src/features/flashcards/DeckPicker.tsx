import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { flattenDecks, type Deck } from './logic';

/**
 * La scelta di un mazzo: l'albero dei mazzi attivi con rientri, un pallino del loro colore, e (se `allowRoot`) la riga
 * «nessun padre» in cima. `exclude`: mazzi che non si possono scegliere (il mazzo stesso e il suo ramo), mostrati spenti.
 */
export function DeckPicker({
  decks,
  value,
  onPick,
  exclude,
  allowRoot,
  rootLabel,
  onCreate,
}: {
  decks: Deck[];
  value: string | null;
  onPick: (uuid: string | null) => void;
  exclude?: ReadonlySet<string>;
  allowRoot?: boolean;
  rootLabel?: string;
  /** Se c'è, si può creare un mazzo al volo (come il «+» del selettore del sito): ritorna l'id del nuovo mazzo, che viene scelto. */
  onCreate?: (name: string, parent: string | null) => string | null;
}) {
  const { t } = useTranslation();
  const th = useTheme();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [under, setUnder] = useState(false);
  const [error, setError] = useState(false);
  const all = flattenDecks(decks, 'active');
  const needle = q.trim().toLowerCase();
  // con una ricerca l'albero diventa un elenco piatto dei mazzi che combaciano
  const rows = needle
    ? all.filter((r) => r.deck.name.toLowerCase().includes(needle)).map((r) => ({ ...r, depth: 0 }))
    : all;
  const current = value ? decks.find((d) => d.uuid === value) : undefined;
  const create = () => {
    const n = name.trim();
    if (!n || !onCreate) {
      setError(true);
      return;
    }
    const id = onCreate(n, under && current ? current.uuid : null);
    if (id) {
      setName('');
      setCreating(false);
      setError(false);
      onPick(id);
    }
  };
  const row = (id: string | null, label: string, color: string | null, depth: number) => {
    const off = id !== null && !!exclude?.has(id);
    const on = value === id;
    return (
      <Pressable
        key={id ?? 'root'}
        testID={`deck-pick-${id ?? 'root'}`}
        accessibilityRole="button"
        accessibilityState={{ selected: on, disabled: off }}
        disabled={off}
        onPress={() => onPick(id)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 11,
          paddingLeft: 14 + depth * 18,
          paddingRight: 14,
          opacity: off ? 0.35 : 1,
          backgroundColor: on ? th.brandSoft : 'transparent',
        }}
      >
        <View
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color ?? th.text3 }}
        />
        <Text style={{ color: th.text, fontSize: 15, flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        {on ? <Text style={{ color: th.brand, fontWeight: '700' }}>✓</Text> : null}
      </Pressable>
    );
  };
  return (
    <View>
      {all.length > 6 ? (
        <TextInput
          testID="deck-pick-search"
          value={q}
          onChangeText={setQ}
          placeholder={t('fc.cs_cerca_materia')}
          placeholderTextColor={th.text3}
          accessibilityLabel={t('fc.cs_cerca_materia')}
          style={{
            color: th.text,
            backgroundColor: th.surface,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 9,
            marginBottom: 6,
          }}
        />
      ) : null}
      <ScrollView
        style={{ maxHeight: 280 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {allowRoot && !needle ? row(null, rootLabel ?? t('fc.cfc_tutte'), null, 0) : null}
        {rows.map((r) => row(r.deck.uuid, r.deck.name, r.deck.color, r.depth))}
        {needle && rows.length === 0 ? (
          <Text testID="deck-pick-none" style={{ color: th.text2, padding: 14 }}>
            {t('fc.cs_nessuna_trovata')}
          </Text>
        ) : null}
      </ScrollView>
      {onCreate ? (
        creating ? (
          <View style={{ gap: 8, paddingTop: 8 }}>
            <TextInput
              testID="deck-pick-new-name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(false);
              }}
              placeholder={t('fc.cs_es_nome')}
              placeholderTextColor={th.text3}
              accessibilityLabel={t('fc.cs_nome_materia')}
              style={{
                color: th.text,
                backgroundColor: th.surface,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            />
            {current ? (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { on: !under, label: t('fc.cs_nessuna_padre'), v: false },
                  { on: under, label: current.name, v: true },
                ].map((o) => (
                  <Pressable
                    key={String(o.v)}
                    testID={`deck-pick-new-parent-${o.v ? 'under' : 'top'}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: o.on }}
                    onPress={() => setUnder(o.v)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      backgroundColor: o.on ? th.brand : th.surface,
                    }}
                  >
                    <Text style={{ color: o.on ? '#fff' : th.text }}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {error ? (
              <Text testID="deck-pick-new-error" style={{ color: th.red }}>
                {t('fc.cs_serve_nome')}
              </Text>
            ) : null}
            <Pressable testID="deck-pick-new-save" accessibilityRole="button" onPress={create}>
              <Text style={{ color: th.brand, fontWeight: '700' }}>
                {t('fc.cs_crea_seleziona')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            testID="deck-pick-new"
            accessibilityRole="button"
            onPress={() => setCreating(true)}
            style={{ paddingVertical: 10, paddingHorizontal: 14 }}
          >
            <Text style={{ color: th.brand, fontWeight: '600' }}>
              + {t('fc.cs_aggiungi_materia')}
            </Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}
