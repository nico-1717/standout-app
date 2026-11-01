import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { typography } from '@/core/theme/tokens';

/** Schermata provvisoria della Fase 1: sarà sostituita da login e lista attività. */
export default function Home() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
      <Text style={[typography.pageTitle, { color: theme.text }]}>Standout</Text>
      <Text style={{ color: theme.text2, marginTop: 8 }}>{t('comune.carica')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, paddingHorizontal: 16 } });
