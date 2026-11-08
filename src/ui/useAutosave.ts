import { useEffect, useRef } from 'react';

/**
 * Salva da solo mentre si scrive (nota_auto.js del sito): `delay` ms dopo l'ultimo tasto, e subito se la
 * schermata si chiude con del testo non ancora salvato. `value` = null vuol dire «niente da salvare».
 * Chi chiama può salvare anche a mano (al toccare fuori) e rimettere `value` a null: il salvataggio
 * programmato non parte più.
 */
export function useAutosave(value: string | null, save: (text: string) => void, delay = 600): void {
  const saveRef = useRef(save);
  const pending = useRef<string | null>(null);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    pending.current = value;
    if (value === null) return;
    const id = setTimeout(() => {
      pending.current = null;
      saveRef.current(value);
    }, delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  useEffect(
    () => () => {
      if (pending.current !== null) {
        saveRef.current(pending.current);
        pending.current = null;
      }
    },
    [],
  );
}
