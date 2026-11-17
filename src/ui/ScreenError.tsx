import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';

/**
 * Quello che si vede al posto di una schermata che si è rotta: invece di far chiudere l'app, dice cosa è successo (il
 * messaggio vero) e lascia riprovare. Non usa il tema né l'app: deve reggere anche se è proprio quello a essersi rotto.
 */
export function ScreenError(p: { error: Error; retry: () => unknown }) {
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#000000' : '#F2F2F7';
  const ink = dark ? '#FFFFFF' : '#1C1C1E';
  const soft = dark ? '#AEAEB2' : '#6C6C70';
  return (
    <View
      testID="screen-error"
      style={{ flex: 1, backgroundColor: bg, paddingTop: 72, paddingHorizontal: 24, gap: 14 }}
    >
      <Text style={{ color: ink, fontSize: 22, fontWeight: '700' }}>Something went wrong</Text>
      <Text style={{ color: soft, fontSize: 15 }}>
        This page hit an error, but the app is still running. Send this message to Claude so it can
        be fixed.
      </Text>
      <ScrollView style={{ flexShrink: 1 }}>
        <Text selectable testID="screen-error-text" style={{ color: ink, fontSize: 13 }}>
          {String(p.error?.message ?? p.error)}
          {'\n\n'}
          {String(p.error?.stack ?? '').slice(0, 1200)}
        </Text>
      </ScrollView>
      <Pressable
        testID="screen-error-retry"
        accessibilityRole="button"
        onPress={() => void p.retry()}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#0A84FF',
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 999,
          marginBottom: 40,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}
