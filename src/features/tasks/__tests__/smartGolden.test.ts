import { destinazione, readPhrase } from '../smart';
import golden from './fixtures/smartGolden.json';

/**
 * Test d'oro: ogni risultato è quello del VERO todo_smart.js del sito (eseguito con un orologio fisso, in tre
 * giorni diversi) sulle stesse frasi. Se la copia in TS si allontana dal sito, qui si vede.
 */
const projects = [
  { id: '1', name: 'Salute' },
  { id: '2', name: 'Università' },
];

describe('barra intelligente = todo_smart.js del sito', () => {
  test.each(golden.map((g, i) => [i, g.now.date, g.phrase, g] as const))(
    '#%i (%s) «%s»',
    (_i, _d, _p, g) => {
      const r = readPhrase(g.phrase, projects, g.now);
      expect({
        title: r.title,
        date: r.date,
        time: r.time,
        minutes: r.minutes,
        project: r.project ? r.project.name : null,
        projectNew: r.projectNew,
        used: r.used,
      }).toEqual(g.result);
      expect(destinazione(g.phrase, r)).toBe(g.dest);
    },
  );

  test('the fixture is big enough to mean something', () => {
    expect(golden.length).toBeGreaterThanOrEqual(150);
  });
});
