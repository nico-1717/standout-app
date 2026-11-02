import { Caveat_500Medium } from '@expo-google-fonts/caveat';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';
import { Jost_400Regular } from '@expo-google-fonts/jost';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/core/i18n';
import { AppProvider, useApp } from '@/core/app/AppProvider';
import { ThemeProvider, useTheme } from '@/core/theme/ThemeProvider';

/** Chi vede quale schermata: fuori → login; dentro ma senza testi accettati → terms; poi le schede. */
function Shell() {
  const theme = useTheme();
  const { authState } = useApp();
  const loading = authState.status === 'loading';
  const signedOut = authState.status === 'signedOut';
  const needTerms = authState.status === 'signedIn' && authState.termsRequired;
  const ready = authState.status === 'signedIn' && !authState.termsRequired;
  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Protected guard={!loading && signedOut}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={!loading && needTerms}>
          <Stack.Screen name="terms" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Il tema segue il colore scelto nelle impostazioni (lo stesso del sito). */
function Themed() {
  const { settings } = useApp();
  return (
    <ThemeProvider accent={settings.accent}>
      <Shell />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // I caratteri dello «Scontrino» (come sul sito). Se non si caricano si va avanti con quelli del telefono.
  const [loaded, fontError] = useFonts({
    Caveat_500Medium,
    CormorantGaramond_500Medium_Italic,
    Jost_400Regular,
  });
  if (!loaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <Themed />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
