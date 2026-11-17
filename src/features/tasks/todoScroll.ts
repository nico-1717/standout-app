import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * To do, To buy e Pills cominciano tutte con lo stesso capo (titolo, frase, nota veloce, linguette). Quando si
 * arriva da una linguetta o dalla barra in basso, la schermata non deve ripartire dalla nota: scende subito alle
 * linguette, così si vede la lista. Chi naviga manda `focus` (un numero nuovo a ogni tocco) e qui si scorre.
 */
export function useTodoScroll() {
  const ref = useRef<ScrollViewInstance>(null);
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const insets = useSafeAreaInsets();
  const sheetY = useRef<number | null>(null);
  const tabsY = useRef<number | null>(null);
  const pending = useRef<string | null>(null);

  const go = useCallback(() => {
    if (sheetY.current === null || tabsY.current === null) return;
    pending.current = null;
    const y = Math.max(0, sheetY.current + tabsY.current - insets.top - 12);
    ref.current?.scrollTo({ y, animated: false });
  }, [insets.top]);

  useEffect(() => {
    if (!focus) return;
    pending.current = focus;
    go();
  }, [focus, go]);

  const onSheetLayout = useCallback(
    (e: LayoutChangeEvent) => {
      sheetY.current = e.nativeEvent.layout.y;
      if (pending.current) go();
    },
    [go],
  );
  const onTabsLayout = useCallback(
    (y: number) => {
      tabsY.current = y;
      if (pending.current) go();
    },
    [go],
  );
  return { ref, onSheetLayout, onTabsLayout };
}

/** I parametri con cui ci si sposta fra le tre liste: `focus` fa scendere la pagina alle linguette. */
export const focusParams = () => ({ focus: String(Date.now()) });
