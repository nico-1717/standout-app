import { Pressable, ScrollView, Text, View } from 'react-native';
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
}: {
  decks: Deck[];
  value: string | null;
  onPick: (uuid: string | null) => void;
  exclude?: ReadonlySet<string>;
  allowRoot?: boolean;
  rootLabel?: string;
}) {
  const { t } = useTranslation();
  const th = useTheme();
  const rows = flattenDecks(decks, 'active');
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
    <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      {allowRoot ? row(null, rootLabel ?? t('fc.cfc_tutte'), null, 0) : null}
      {rows.map((r) => row(r.deck.uuid, r.deck.name, r.deck.color, r.depth))}
    </ScrollView>
  );
}
