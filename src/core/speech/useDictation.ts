import { useCallback, useEffect, useRef, useState } from 'react';

import { Listener, phoneEngine, type FatalReason, type SpeechEngine } from './recognizer';

export interface DictationOptions {
  /** lingua del riconoscimento («it-IT», «en-US») */
  lang: string;
  /** una frase sola (to buy): finita quella l'ascolto si chiude da solo. Senza, si detta finché non si ferma. */
  once?: boolean;
  /** quello che si sta dicendo adesso (provvisorio): si mostra, non si salva */
  onInterim?: (text: string) => void;
  /** una frase definitiva */
  onFinal: (text: string) => void;
  /** l'ascolto è finito (fermato, o con `once` terminato da solo) */
  onStop?: (heard: string) => void;
  engine?: SpeechEngine;
}

/**
 * Il microfono di dettatura: `start()` chiede il permesso e ascolta, `stop()` chiude. Il testo arriva a pezzi: un
 * pezzo provvisorio mentre si parla, uno definitivo a ogni frase. Se il permesso manca o il riconoscimento non c'è,
 * `error` lo dice (e l'ascolto non parte).
 */
export function useDictation(o: DictationOptions): {
  active: boolean;
  error: FatalReason | null;
  start: () => void;
  stop: () => void;
} {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<FatalReason | null>(null);
  const listener = useRef<Listener | null>(null);
  const heard = useRef('');
  // le funzioni più recenti, senza riaprire il microfono a ogni disegno
  const latest = useRef(o);
  useEffect(() => {
    latest.current = o;
  });

  const stop = useCallback(() => {
    const l = listener.current;
    if (!l) return;
    listener.current = null;
    l.end();
    setActive(false);
    latest.current.onStop?.(heard.current);
  }, []);

  const start = useCallback(() => {
    if (listener.current) return;
    heard.current = '';
    setError(null);
    const l = new Listener(latest.current.engine ?? phoneEngine, {
      onResult: (r) => {
        const text = (r.alternatives[0] ?? '').trim();
        if (!text) return;
        if (r.isFinal) {
          heard.current = latest.current.once ? text : `${heard.current} ${text}`.trim();
          latest.current.onFinal(text);
        } else {
          latest.current.onInterim?.(text);
        }
      },
      onFatal: (why) => {
        listener.current = null;
        setActive(false);
        setError(why);
      },
      onEnded: () => {
        listener.current = null;
        setActive(false);
        latest.current.onStop?.(heard.current);
      },
    });
    listener.current = l;
    setActive(true);
    void l.begin(latest.current.lang, [], !!latest.current.once).then((ok) => {
      if (!ok && listener.current === l) {
        listener.current = null;
        setActive(false);
      }
    });
  }, []);

  // al cambio di schermata il microfono si chiude
  useEffect(
    () => () => {
      listener.current?.end();
      listener.current = null;
    },
    [],
  );

  return { active, error, start, stop };
}
