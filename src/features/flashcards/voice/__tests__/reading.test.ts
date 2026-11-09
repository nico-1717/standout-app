import {
  answerSegments,
  formatReading,
  parseReading,
  plainSpeech,
  questionSegments,
  type ReadableCard,
} from '../reading';

const card: ReadableCard = {
  question: 'rinunciare',
  answer: 'to give up',
  meaning: 'to stop trying',
  examples: [
    { text: 'Never ____ on your dreams.', gap: '' },
    { text: 'I will not ____ now.', gap: '' },
  ],
  word: 'give up',
  questionVoice: { lang: 'it-IT', once: true },
  answerVoice: { lang: 'en-GB', once: false },
  exampleVoice: 'en-GB',
};

describe('what the voice reads', () => {
  test('the four digits are read like the website, and a bad value means the default', () => {
    expect(parseReading('1100')).toEqual({
      question: true,
      answerTimes: 1,
      meaning: false,
      examples: 0,
    });
    expect(parseReading('0211')).toEqual({
      question: false,
      answerTimes: 2,
      meaning: true,
      examples: 1,
    });
    for (const bad of ['', null, undefined, '1300', '12', 'abcd', '1130']) {
      expect(formatReading(parseReading(bad))).toBe('1100');
    }
    expect(formatReading(parseReading('1112'))).toBe('1112');
  });

  test('question: read or not, in the language of the question', () => {
    expect(questionSegments(card, parseReading('1100'))).toEqual([
      { text: 'rinunciare', lang: 'it-IT', once: true },
    ]);
    expect(questionSegments(card, parseReading('0100'))).toEqual([]);
    expect(questionSegments({ ...card, questionVoice: null }, parseReading('1100'))).toEqual([]);
  });

  test('answer once or twice (the second time is slower), then meaning, then examples', () => {
    expect(answerSegments(card, parseReading('1100'))).toEqual([
      { text: 'to give up', lang: 'en-GB', once: true },
    ]);
    expect(answerSegments(card, parseReading('1200'))[0]).toMatchObject({ once: false });
    const all = answerSegments(card, parseReading('1112'));
    expect(all.map((s) => s.text)).toEqual([
      'to give up',
      'to stop trying',
      'Never give up on your dreams.',
      'I will not give up now.',
    ]);
    expect(answerSegments(card, parseReading('1111')).map((s) => s.text)).toEqual([
      'to give up',
      'to stop trying',
      'Never give up on your dreams.',
    ]);
  });

  test('nothing to say, nothing said', () => {
    const empty = { ...card, answer: ' ', answerVoice: null, exampleVoice: null, meaning: null };
    expect(answerSegments(empty, parseReading('1112'))).toEqual([]);
  });

  test('markup and formulas are not spoken', () => {
    expect(plainSpeech('<b>Hello</b>   $x^2$ {world}')).toBe('Hello x 2 world');
    expect(plainSpeech(null)).toBe('');
  });
});
