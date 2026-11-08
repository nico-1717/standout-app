import {
  cleanChoice,
  gapKeys,
  gapParts,
  gapSpans,
  keysFromSpans,
  piecesFromKeys,
  readChoice,
  writeChoice,
} from '../gap';

/* Casi presi dal codice del sito (fc_vocab_gap.js): lo stesso calcolo deve dare gli stessi pezzi. */
describe('gap: same result as the website', () => {
  const cases: [string, string, string, unknown][] = [
    ['I know the answer', 'know', '', [{ da: 2, a: 6, tipo: 'parola' }]],
    ['He knows it', 'know', '', [{ da: 3, a: 8, tipo: 'simile' }]],
    [
      'Please give it up',
      'give up',
      '',
      [
        { da: 7, a: 11, tipo: 'simile' },
        { da: 15, a: 17, tipo: 'simile' },
      ],
    ],
    ["I'm tired", 'I am', '', [{ da: 0, a: 3, tipo: 'simile' }]],
    ['They studied hard', 'study', '', [{ da: 5, a: 12, tipo: 'simile' }]],
    [
      'I want you to come',
      'know',
      '[[0,"I want"],[11,"to"]]',
      [
        { da: 0, a: 6, tipo: 'scelta' },
        { da: 11, a: 13, tipo: 'scelta' },
      ],
    ],
    [
      'I want to go to the park to play',
      'know',
      '[[20,"to"]]',
      [{ da: 25, a: 27, tipo: 'scelta' }],
    ],
    ['knowledge is power', 'know', '', []],
    ['___ is nice', 'house', '', [{ da: 0, a: 3, tipo: 'trattini' }]],
    ['Das Haus ist groß', 'Haus', '', [{ da: 4, a: 8, tipo: 'parola' }]],
    ['Nothing here', 'chat', '', []],
    ['I don’t know', "don't", '', [{ da: 2, a: 7, tipo: 'parola' }]],
  ];
  test.each(cases)('%s / %s / %s', (text, word, gap, expected) => {
    expect(gapSpans(text, word, gap)).toEqual(expected);
  });
});

describe('gap: choice format and parts', () => {
  test('reads old and new formats', () => {
    expect(readChoice('')).toBeNull();
    expect(readChoice(null)).toBeNull();
    expect(readChoice('I want')).toEqual([{ da: -1, t: 'I want' }]);
    expect(readChoice('[[0,"I want"],[11,"to"]]')).toEqual([
      { da: 0, t: 'I want' },
      { da: 11, t: 'to' },
    ]);
  });

  test('a lost piece falls back to the automatic choice', () => {
    expect(gapSpans('I know it', 'know', 'xyz')).toEqual([{ da: 2, a: 6, tipo: 'parola' }]);
  });

  test('writes one piece as plain text and several as JSON', () => {
    const t = 'I want you to come';
    expect(writeChoice(t, [{ da: 0, a: 6 }])).toBe('I want');
    expect(
      writeChoice(t, [
        { da: 0, a: 6 },
        { da: 11, a: 13 },
      ]),
    ).toBe('[[0,"I want"],[11,"to"]]');
    expect(writeChoice(t, [])).toBe('');
  });

  test('a second "to" is told apart by position', () => {
    const t = 'I want to go to the park';
    expect(writeChoice(t, [{ da: 13, a: 15 }])).toBe('[[13,"to"]]');
    expect(writeChoice(t, [{ da: 7, a: 9 }])).toBe('to');
    expect(gapSpans(t, 'x', '[[13,"to"]]')).toEqual([{ da: 13, a: 15, tipo: 'scelta' }]);
  });

  test('cleans a choice arriving from outside', () => {
    expect(cleanChoice('  ')).toBe('');
    expect(cleanChoice('x'.repeat(400))).toHaveLength(255);
    expect(cleanChoice('[[-3,"to"]]')).toBe('[[0,"to"]]');
  });

  test('parts: visible and hidden, dashes get the word', () => {
    expect(gapParts('The house is big', 'house')).toEqual([
      { text: 'The ', hidden: false },
      { text: 'house', hidden: true },
      { text: ' is big', hidden: false },
    ]);
    expect(gapParts('___ is nice', 'house')).toEqual([
      { text: 'house', hidden: true },
      { text: ' is nice', hidden: false },
    ]);
    expect(gapParts('Nothing here', 'chat')).toEqual([{ text: 'Nothing here', hidden: false }]);
  });
});

describe('gap: picking by hand', () => {
  test("an apostrophe is its own key (I ' m)", () => {
    const keys = gapKeys("I'm ok").filter((k) => k.tasto);
    expect(keys.map((k) => k.t)).toEqual(['I', "'", 'm', 'ok']);
    expect(keys[1]!.apostrofo).toBe(true);
  });

  test('keys next to each other make one piece, others make separate pieces', () => {
    const t = 'I want you to come';
    const on = new Set([0, 1, 3]); // I, want, to
    expect(piecesFromKeys(t, on)).toEqual([
      { da: 0, a: 6 },
      { da: 11, a: 13 },
    ]);
  });

  test('current hidden parts light the right keys', () => {
    const t = 'I want you to come';
    const spans = gapSpans(t, 'x', '[[0,"I want"],[11,"to"]]');
    expect([...keysFromSpans(t, spans)]).toEqual([0, 1, 3]);
  });
});
