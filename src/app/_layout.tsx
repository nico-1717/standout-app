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
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            <Shell />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
