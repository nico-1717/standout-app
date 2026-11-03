import { analyze, toCards, type Table } from '../smartImport';
import golden from './smartImport.golden.json';

// I casi e i risultati vengono dal codice vero del sito (fc_smart_import.js, eseguito con Node).
// Il nome delle colonne senza intestazione, lì, è il testo con i parametri attaccati: qui si fa lo stesso.
const colName = (n: number): string => `fc.smi_colonna_n${JSON.stringify({ n })}`;

interface Case {
  in: string;
  out: null | {
    errore?: boolean;
    formato?: string;
    intestazione?: boolean;
    colonne?: string[];
    campi?: string[];
    righe?: string[][];
    carte?: { q: string; a: string; imgLink: string }[];
  };
}

describe('smart import against the website', () => {
  for (const [i, c] of (golden as Case[]).entries()) {
    test(`case ${i}: ${JSON.stringify(c.in).slice(0, 40)}`, () => {
      const got = analyze(c.in, colName);
      if (c.out === null) {
        expect(got).toBeNull();
        return;
      }
      if (c.out.errore) {
        expect(got).toHaveProperty('errore');
        return;
      }
      const tab = got as Table;
      expect(tab.formato).toBe(c.out.formato);
      expect(tab.intestazione).toBe(c.out.intestazione);
      expect(tab.colonne).toEqual(c.out.colonne);
      // nello studio i campi del sito che qui non ci sono (significato, esempio, note) diventano «ignora»
      expect(tab.campi).toEqual(c.out.campi!.map((f) => (['q', 'a', 'img'].includes(f) ? f : '')));
      expect(tab.righe).toEqual(c.out.righe);
      expect(toCards(tab)).toEqual(
        c.out.carte!.map((x) => ({ q: x.q, a: x.a, imgLink: x.imgLink })),
      );
    });
  }

  test('changing a column by hand changes the cards', () => {
    const tab = analyze('uno\tdue\ntre\tquattro', colName) as Table;
    expect(toCards(tab)).toEqual([
      { q: 'uno', a: 'due', imgLink: '' },
      { q: 'tre', a: 'quattro', imgLink: '' },
    ]);
    tab.campi = ['a', 'q'];
    expect(toCards(tab)[0]).toEqual({ q: 'due', a: 'uno', imgLink: '' });
  });
});
