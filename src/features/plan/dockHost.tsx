import { useEffect, useId, type ReactNode } from 'react';
import { View } from 'react-native';
import { create } from 'zustand';

/**
 * La barra degli strumenti del calendario sta ferma in basso mentre la pagina scorre (come `.pp-dock` del sito, che è
 * `position: fixed`). Il calendario vive dentro uno ScrollView, quindi la barra si «appende» da lontano: il calendario
 * la consegna a questo scaffale e la schermata la mostra sopra tutto, sopra la barra delle schede.
 */
const useDock = create<{
  owner: string | null;
  node: ReactNode;
  show: (owner: string, node: ReactNode) => void;
  hide: (owner: string) => void;
}>((set, get) => ({
  owner: null,
  node: null,
  show: (owner, node) => set({ owner, node }),
  hide: (owner) => {
    if (get().owner === owner) set({ owner: null, node: null });
  },
}));

/** Chi disegna la barra la offre qui; sparisce da sola quando chi l'ha offerta se ne va. */
export function useFloatingDock(node: ReactNode) {
  const id = useId();
  // ogni disegno porta la barra aggiornata (i suoi tasti leggono lo stato di adesso)
  useEffect(() => {
    useDock.getState().show(id, node);
  });
  useEffect(() => () => useDock.getState().hide(id), [id]);
}

/** Lo scaffale: va messo UNA volta in una schermata che mostra il calendario. */
export function DockHost({ bottom }: { bottom: number }) {
  const node = useDock((s) => s.node);
  if (!node) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom, alignItems: 'center' }}
    >
      {node}
    </View>
  );
}
