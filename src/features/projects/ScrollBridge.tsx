import { createContext, useContext } from 'react';

/**
 * Quello che la riga in mano ha bisogno di sapere della pagina che la contiene: a che punto è lo scorrimento, come
 * farla scorrere ai bordi, e come tenerla ferma mentre si trascina (lo fa la pagina, qui si chiede soltanto).
 */
export interface ScrollBridge {
  /** di quanto ha scorso la pagina adesso */
  offset: () => number;
  /** scorri fino a questo punto */
  scrollTo: (y: number) => void;
  /** la pagina non deve scorrere (c'è una riga in mano) o può di nuovo */
  lock: (on: boolean) => void;
}

const STILL: ScrollBridge = { offset: () => 0, scrollTo: () => undefined, lock: () => undefined };

export const ScrollBridgeContext = createContext<ScrollBridge>(STILL);

export const useScrollBridge = () => useContext(ScrollBridgeContext);
