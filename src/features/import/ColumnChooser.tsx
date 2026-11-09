import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ColumnInfo } from '@/core/files/columns';
import { useTheme } from '@/core/theme/ThemeProvider';

export interface ChooserField {
  key: string;
  label: string;
}

/**
 * «Controlla le colonne»: per ogni cosa che l'importazione cerca (la data, la durata, …) la colonna che l'app ha scelto,
 * con la possibilità di cambiarla o di dire «nessuna». Sotto la scelta si vede un esempio dei valori di quella colonna,
 * così si capisce subito se è quella giusta.
 */
export function ColumnChooser({
  idPrefix,
  fields,
  columns,
  value,
  onChange,
}: {
  idPrefix: string;
  fields: readonly ChooserField[];
  columns: readonly ColumnInfo[];
  /** per ogni campo, l'indice della colonna scelta (-1 = nessuna) */
  value: Readonly<Record<string, number>>;
  onChange: (key: string, index: number) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();

  const chip = (testID: string, label: string, on: boolean, onPress: () => void, sub?: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: on ? th.brand : th.surface2,
        maxWidth: 180,
      }}
    >
      <Text
        style={{ color: on ? '#fff' : th.text, fontWeight: '600', fontSize: 14 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {sub ? (
        <Text style={{ color: on ? '#fff' : th.text2, fontSize: 11 }} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <View testID={`${idPrefix}-chooser`} style={{ gap: 14 }}>
      <Text style={{ color: th.text2, fontSize: 14, lineHeight: 20 }}>
        {t('import.colonne_aiuto')}
      </Text>
      {fields.map((f) => {
        const at = value[f.key] ?? -1;
        const col = columns.find((c) => c.index === at);
        return (
          <View key={f.key} style={{ gap: 6 }}>
            <Text style={{ color: th.text, fontWeight: '700', fontSize: 14 }}>{f.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                {chip(`${idPrefix}-${f.key}-none`, t('import.colonne_nessuna'), at < 0, () =>
                  onChange(f.key, -1),
                )}
                {columns.map((c) =>
                  chip(
                    `${idPrefix}-${f.key}-${c.index}`,
                    c.name || t('import.colonne_lettera', { l: c.letter }),
                    at === c.index,
                    () => onChange(f.key, c.index),
                    c.name ? c.letter : undefined,
                  ),
                )}
              </View>
            </ScrollView>
            {col && col.samples.length > 0 ? (
              <Text
                testID={`${idPrefix}-${f.key}-example`}
                style={{ color: th.text3, fontSize: 12 }}
                numberOfLines={1}
              >
                {t('import.colonne_esempio', { v: col.samples.join(' · ') })}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
