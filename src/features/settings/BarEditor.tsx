import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_BAR,
  NEVER_HIDDEN,
  barSections,
  moveBar,
  type BarId,
  type BarMove,
  type BarPrefs,
} from '@/core/settings/bar';
import { useTheme } from '@/core/theme/ThemeProvider';
import { BAR_ITEMS } from '@/ui/barItems';
import { TAB_COLOR, TabIcon } from '@/ui/TabIcon';

/**
 * Altro › Barra in basso: cosa mostrare, in che ordine e cosa tenere fisso a sinistra (con la linea), cosa nascondere.
 * Le tre liste sono quelle della barra: fissate, scorrevoli, nascoste.
 */
export function BarEditor({ bar, onChange }: { bar: BarPrefs; onChange: (b: BarPrefs) => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const sec = barSections(bar);
  const act = (m: BarMove) => onChange(moveBar(bar, m));

  const small = (
    testID: string,
    label: string,
    glyph: string,
    onPress: () => void,
    off = false,
  ) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: th.surface2,
        opacity: off ? 0.35 : 1,
      }}
    >
      <Text style={{ color: th.text, fontSize: 15 }}>{glyph}</Text>
    </Pressable>
  );

  const row = (id: BarId, group: 'pinned' | 'scroll' | 'hidden', at: number, n: number) => {
    const it = BAR_ITEMS[id];
    return (
      <View
        key={id}
        testID={`bar-row-${id}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
      >
        <TabIcon kind={it.kind} color={TAB_COLOR[it.kind] ?? th.brand} size={22} />
        <Text
          style={{ flex: 1, color: th.text, fontSize: 15, fontWeight: '600' }}
          numberOfLines={1}
        >
          {t(it.label)}
        </Text>
        {small(
          `bar-up-${id}`,
          t('app.barra_su'),
          '↑',
          () => act({ kind: 'shift', id, by: -1 }),
          at === 0,
        )}
        {small(
          `bar-down-${id}`,
          t('app.barra_giu'),
          '↓',
          () => act({ kind: 'shift', id, by: 1 }),
          at === n - 1,
        )}
        {group !== 'hidden'
          ? small(
              `bar-pin-${id}`,
              t(group === 'pinned' ? 'app.barra_togli_fissa' : 'app.barra_fissa'),
              '📌',
              () => act({ kind: 'pin', id, on: group !== 'pinned' }),
              group !== 'pinned',
            )
          : null}
        {id !== NEVER_HIDDEN
          ? small(
              `bar-hide-${id}`,
              t(group === 'hidden' ? 'app.barra_mostra' : 'app.barra_nascondi'),
              group === 'hidden' ? '+' : '✕',
              () => act({ kind: 'hide', id, on: group !== 'hidden' }),
            )
          : null}
      </View>
    );
  };

  const block = (key: 'pinned' | 'scroll' | 'hidden', title: string) => (
    <View key={key} style={{ gap: 2 }}>
      <Text
        style={{
          color: th.text3,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 6,
        }}
      >
        {title}
      </Text>
      {sec[key].length ? (
        sec[key].map((id, i) => row(id, key, i, sec[key].length))
      ) : (
        <Text testID={`bar-empty-${key}`} style={{ color: th.text3, fontSize: 13 }}>
          {t('app.barra_vuota')}
        </Text>
      )}
    </View>
  );

  return (
    <View testID="bar-editor" style={{ gap: 6 }}>
      <Text style={{ color: th.text, fontWeight: '700' }}>{t('app.barra_titolo')}</Text>
      <Text style={{ color: th.text2, fontSize: 13 }}>{t('app.barra_nota')}</Text>
      {block('pinned', t('app.barra_fissate'))}
      {block('scroll', t('app.barra_scorrono'))}
      {block('hidden', t('app.barra_nascoste'))}
      <Pressable
        testID="bar-reset"
        accessibilityRole="button"
        onPress={() => onChange(DEFAULT_BAR)}
        style={{ paddingVertical: 10, alignItems: 'center' }}
      >
        <Text style={{ color: th.brand, fontWeight: '600' }}>{t('app.barra_ripristina')}</Text>
      </Pressable>
    </View>
  );
}
