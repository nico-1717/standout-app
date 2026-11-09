import { appendDictated, dictationLang, isNewLine, lonelyMark, punctuate } from '../dictation';
import golden from './golden_punct.json';

describe('dictation: same punctuation as the website', () => {
  test('a finished phrase is closed like the site does it', () => {
    for (const g of golden.punct) {
      expect([g.lang, g.say, punctuate(g.say, g.lang)]).toEqual([g.lang, g.say, g.out]);
    }
  });

  test('a lonely spoken mark / "new line" is recognised like the site does it', () => {
    for (const g of golden.marks) {
      expect([g.lang, g.say, lonelyMark(g.say, g.lang)]).toEqual([g.lang, g.say, g.mark]);
      expect([g.lang, g.say, isNewLine(g.say, g.lang)]).toEqual([g.lang, g.say, g.nl]);
    }
  });
});

describe('dictation: joining the phrases', () => {
  test('phrases are joined with a space and closed', () => {
    let t = '';
    t = appendDictated(t, 'oggi sono andato al mare', 'it');
    t = appendDictated(t, 'abbiamo fatto il bagno con', 'it');
    expect(t).toBe('oggi sono andato al mare. abbiamo fatto il bagno con,');
  });

  test('"virgola" said alone sticks to the word before; "a capo" starts a new line without a stray space', () => {
    let t = 'ciao';
    t = appendDictated(t, 'virgola', 'it');
    expect(t).toBe('ciao,');
    t = appendDictated(t, 'a capo', 'it');
    expect(t).toBe('ciao,\n');
    t = appendDictated(t, 'oggi fa molto caldo', 'it');
    expect(t).toBe('ciao,\noggi fa molto caldo.');
  });

  test('a spoken mark replaces the guessed one instead of doubling it', () => {
    expect(appendDictated('Went to the park.', 'virgola', 'it')).toBe('Went to the park,');
    expect(appendDictated('Hello (', 'punto', 'it')).toBe('Hello (.');
    expect(appendDictated('Ciao', 'aperta parentesi', 'it')).toBe('Ciao(');
  });

  test('an empty phrase changes nothing; a phrase already closed is left alone', () => {
    expect(appendDictated('ciao', '  ', 'it')).toBe('ciao');
    expect(appendDictated('', 'Done.', 'en')).toBe('Done.');
  });

  test('English app → en-US, everything else → it-IT', () => {
    expect(dictationLang('en')).toBe('en-US');
    expect(dictationLang('en-GB')).toBe('en-US');
    expect(dictationLang('it')).toBe('it-IT');
    expect(dictationLang('fr')).toBe('it-IT');
  });
});
