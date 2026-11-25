import { createContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Keyboard, Platform, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

/**
 * Dove si «attacca» la barra del formato: un editor pubblica qui la sua barra mentre si scrive, e la pagina la mostra ferma
 * sopra la tastiera, sempre in vista (non scorre via con il testo). Senza una pagina che la accolga, l'editor la tiene
 * dentro di sé, come prima.
 */
export class BarDockStore {
  private renders = new Map<string, () => ReactNode>();
  private listeners = new Set<() => void>();
  private version = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  /** Mette la barra di un editor (o la toglie con null). Non fa niente se non cambia nulla. */
  publish(id: string, render: (() => ReactNode) | null): void {
    if (!render && !this.renders.has(id)) return;
    if (render) this.renders.set(id, render);
    else this.renders.delete(id);
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  current(): ReactNode {
    const last = [...this.renders.values()].at(-1);
    return last ? last() : null;
  }
}

export const BarDockContext = createContext<BarDockStore | null>(null);

/** L'altezza della tastiera quando è su (0 quando è giù). */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** La pagina che accoglie la barra: la mostra attaccata al bordo basso, sopra la tastiera. */
export function BarDockProvider({ children }: { children: ReactNode }) {
  const th = useTheme();
  const [store] = useState(() => new BarDockStore());
  useSyncExternalStore(store.subscribe, store.getVersion);
  const keyboard = useKeyboardHeight();
  const bar = store.current();
  return (
    <BarDockContext.Provider value={store}>
      <View style={{ flex: 1 }}>
        {children}
        {bar ? (
          <View
            testID="bar-dock"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: keyboard,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: th.headerGlass,
              borderTopWidth: 0.5,
              borderTopColor: th.hairline,
            }}
          >
            {bar}
          </View>
        ) : null}
      </View>
    </BarDockContext.Provider>
  );
}
