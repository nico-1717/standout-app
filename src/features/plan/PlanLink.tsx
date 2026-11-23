import { Pressable, Text } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

const SPARK =
  'M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z';
const RIGHT = 'M9.5 5L16 12l-6.5 7';

/** Il tasto «Piano» dentro il Calendario del progetto (`.pp-planlink` sul sito): il Piano non è più una scheda, si apre da qui. */
export function PlanLink(p: { onPress: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const svg = (d: string, w: number) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${th.brand}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  return (
    <Pressable
      testID="plan-link"
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-end',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 32,
        paddingLeft: 11,
        paddingRight: 8,
        borderRadius: 999,
        backgroundColor: th.blueSoft,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <SvgXml xml={svg(SPARK, 1.9)} width={15} height={15} />
      <Text style={{ color: th.brand, fontSize: 13.5, fontWeight: '700' }}>
        {t('piano.v_piano')}
      </Text>
      <SvgXml xml={svg(RIGHT, 2.4)} width={13} height={13} />
    </Pressable>
  );
}
