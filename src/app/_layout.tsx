import { Caveat_500Medium } from '@expo-google-fonts/caveat';
import {
  CormorantGaramond_300Light,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import { Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Jost_400Regular } from '@expo-google-fonts/jost';
import { Kalam_400Regular } from '@expo-google-fonts/kalam';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/core/i18n';
import { AppProvider, useApp } from '@/core/app/AppProvider';
import { AppLock } from '@/core/lock/AppLock';
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
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot" />
        </Stack.Protected>
        <Stack.Protected guard={!loading && needTerms}>
          <Stack.Screen name="terms" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
          <Stack.Screen name="sync" options={{ presentation: 'modal' }} />
          <Stack.Screen name="planner-manage" options={{ presentation: 'modal' }} />
          <Stack.Screen name="planner-routines" options={{ presentation: 'modal' }} />
          <Stack.Screen name="planner-settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="planner-week" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pomodoro" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pomodoro-history" options={{ presentation: 'modal' }} />
          <Stack.Screen name="projects" options={{ presentation: 'modal' }} />
          <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="project" options={{ presentation: 'modal' }} />
          <Stack.Screen name="grades" options={{ presentation: 'modal' }} />
          <Stack.Screen name="grade-exam" options={{ presentation: 'modal' }} />
          <Stack.Screen name="grade-group" options={{ presentation: 'modal' }} />
          <Stack.Screen name="grade-bonus" options={{ presentation: 'modal' }} />
          <Stack.Screen name="grade-settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="flashcards" options={{ presentation: 'modal' }} />
          <Stack.Screen name="fc-deck" options={{ presentation: 'modal' }} />
          <Stack.Screen name="fc-card" options={{ presentation: 'modal' }} />
          <Stack.Screen name="fc-setup" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="fc-game"
            options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          <Stack.Screen name="fc-result" options={{ presentation: 'modal' }} />
          <Stack.Screen name="fc-history" options={{ presentation: 'modal' }} />
          <Stack.Screen name="fc-stats" options={{ presentation: 'modal' }} />
          <Stack.Screen name="fc-insert" options={{ presentation: 'modal' }} />
          <Stack.Screen name="habit-import" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pomodoro-import" options={{ presentation: 'modal' }} />
          <Stack.Screen name="languages" options={{ presentation: 'modal' }} />
          <Stack.Screen name="lang-course" options={{ presentation: 'modal' }} />
          <Stack.Screen name="lang-deck" options={{ presentation: 'modal' }} />
          <Stack.Screen name="lang-word" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account" options={{ presentation: 'modal' }} />
          <Stack.Screen name="diary" />
          <Stack.Screen name="diary-year" />
          <Stack.Screen name="diary-read" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Il tema segue il colore scelto nelle impostazioni (lo stesso del sito). */
function Themed() {
  const { settings } = useApp();
  return (
    <ThemeProvider accent={settings.accent} uiStyle={settings.ui_style}>
      <Shell />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // I caratteri dello «Scontrino» (come sul sito). Se non si caricano si va avanti con quelli del telefono.
  const [loaded, fontError] = useFonts({
    Caveat_500Medium,
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium_Italic,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Jost_400Regular,
    Kalam_400Regular,
    PatrickHand_400Regular,
  });
  if (!loaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppLock>
          <AppProvider>
            <Themed />
          </AppProvider>
        </AppLock>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
