import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Avatar } from '@/ui/Avatar';
import { Text } from '@/ui/CappedText';

/**
 * La riga in alto delle pagine del sito (.tp-top): «‹ Planner» a sinistra e il pallino del profilo a destra.
 * Nell'app la barra in basso sostituisce il menu laterale, il resto è lo stesso.
 */
export function PageTop({
  back = 'planner.titolo',
  href = '/planner',
  color,
  testID = 'page-top',
}: {
  /** chiave di traduzione del nome della pagina a cui si torna */
  back?: string;
  href?: '/planner' | '/todo' | '/home';
  color?: string;
  testID?: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authState } = useApp();
  const name = authState?.status === 'signedIn' ? authState.user.username : '';
  const ink = color ?? th.text2;
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 18,
        paddingBottom: 16,
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        testID={`${testID}-back`}
        accessibilityRole="button"
        onPress={() => router.navigate(href)}
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Svg width={15} height={15} viewBox="0 0 24 24">
          <Path
            d="M14.5 5L8 12l6.5 7"
            stroke={ink}
            strokeWidth={1.7}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        <Text style={{ color: ink, fontSize: 13 }}>{t(back)}</Text>
      </Pressable>
      <Avatar
        letter={(name || '?').slice(0, 1).toUpperCase()}
        label={t('app.account')}
        onPress={() => router.push('/account')}
        testID={`${testID}-avatar`}
      />
    </View>
  );
}
