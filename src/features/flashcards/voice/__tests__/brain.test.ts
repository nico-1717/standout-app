import en from '@/core/i18n/lang/en.json';
import it from '@/core/i18n/lang/it.json';

import { VoiceBrain, allowedIntents, type VoiceView } from '../brain';
import { EchoFilter, buildCommands, answerVariants } from '../commands';

const dicts = { it: it.fc as Record<string, string>, en: en.fc as Record<string, string> };

function setup(view: Partial<VoiceView> = {}) {
  let t = 1000;
  const state: VoiceView = { phase: 'question', vocab: false, expected: [], ...view };
  const echo = new EchoFilter(() => t);
  const brain = new VoiceBrain(
    buildCommands(dicts, 'en', state.vocab),
    echo,
    () => state,
    () => t,
  );
  return {
    state,
    echo,
    brain,
    wait: (ms: number) => (t += ms),
    say: (...alts: string[]) => brain.hear({ alternatives: alts, isFinal: true }),
    part: (...alts: string[]) => brain.hear({ alternatives: alts, isFinal: false }),
  };
}

describe('voice game brain', () => {
  test('a card: "answer" reveals, "correct" grades, "wrong" grades the other way', () => {
    const s = setup();
    expect(s.say('show the answer')).toEqual({ kind: 'reveal' });
    s.state.phase = 'answer';
    expect(s.say('correct')).toEqual({ kind: 'grade', correct: true });
    s.wait(3000);
    expect(s.say('wrong')).toEqual({ kind: 'grade', correct: false });
  });

  test('works in Italian too, whatever the app language', () => {
    const s = setup({ phase: 'answer' });
    expect(s.say('corretto')).toEqual({ kind: 'grade', correct: true });
  });

  test('"repeat" works in every phase that is waiting for you', () => {
    for (const phase of ['question', 'answer', 'auto-ok', 'ck', 'boss-q', 'boss-a'] as const) {
      const s = setup({ phase });
      expect([phase, s.say('repeat')]).toEqual([phase, { kind: 'repeat' }]);
    }
  });

  test('while the game is busy nothing is accepted', () => {
    for (const phase of ['idle', 'grading', 'ck-wait'] as const) {
      const s = setup({ phase });
      expect(allowedIntents(phase, false)).toEqual([]);
      expect([phase, s.say('correct')]).toEqual([phase, null]);
    }
  });

  test('"continue" and "boss" only at the checkpoint', () => {
    const s = setup({ phase: 'ck' });
    expect(s.say('continue')).toEqual({ kind: 'continue' });
    s.wait(3000);
    expect(s.say('boss round')).toEqual({ kind: 'boss' });
    const q = setup({ phase: 'question' });
    expect(q.say('continue')).toBeNull();
    expect(q.say('boss')).toBeNull();
  });

  test('the same command twice in a row is one command, then it works again', () => {
    const s = setup({ phase: 'answer' });
    expect(s.say('correct')).not.toBeNull();
    s.wait(500);
    expect(s.say('correct')).toBeNull();
    s.wait(2000);
    expect(s.say('correct')).not.toBeNull();
  });

  test('different commands are not blocked by the previous one', () => {
    const s = setup({ phase: 'answer' });
    expect(s.say('wrong')).toEqual({ kind: 'grade', correct: false });
    expect(s.say('repeat')).toEqual({ kind: 'repeat' });
  });

  test('the best alternative wins, not the first one', () => {
    const s = setup({ phase: 'answer' });
    expect(s.say('blah blah blah', 'correct')).toEqual({ kind: 'grade', correct: true });
  });

  test('a very long sentence that only contains a word is not a command', () => {
    const s = setup({ phase: 'answer' });
    const long =
      'this is honestly not what I would call a correct description of the thing that we were talking about earlier this morning at all';
    expect(s.say(long)).toBeNull();
  });

  test('the voice reading the card is not the user (echo)', () => {
    const s = setup({ phase: 'question' });
    s.echo.start('Is this statement right or wrong?');
    expect(s.say('right')).toBeNull();
    expect(s.say('wrong')).toBeNull();
    s.echo.end();
    s.wait(1000);
    expect(s.say('wrong')).toBeNull(); // ancora dentro la coda dell'eco
    s.wait(1000);
    expect(s.say('wrong')).toEqual({ kind: 'grade', correct: false });
  });

  test('loose sounds count only where they are allowed, and not as echo', () => {
    const s = setup({ phase: 'answer' });
    expect(s.say('write')).toEqual({ kind: 'grade', correct: true }); // «right»
    // a carta chiusa (frasi) il «largo» vale solo per «risposta»
    const q = setup({ phase: 'question' });
    expect(q.say('sir')).toEqual({ kind: 'reveal' });
    expect(setup({ phase: 'question' }).say('write')).toBeNull();
    const e = setup({ phase: 'answer' });
    e.echo.start('Please write the word right here');
    expect(e.say('write')).toBeNull();
  });

  test('a command that is still being spoken (interim) goes only if it is clear and short', () => {
    const s = setup({ phase: 'answer' });
    expect(s.part('correct')).toEqual({ kind: 'grade', correct: true });
    const long = setup({ phase: 'answer' });
    expect(long.part('hmm well I think that it was correct really')).toBeNull();
    const vague = setup({ phase: 'answer' });
    expect(vague.part('corr')).toBeNull();
  });

  test('interim then final of the same word makes one grade', () => {
    const s = setup({ phase: 'answer' });
    expect(s.part('correct')).not.toBeNull();
    s.state.phase = 'answer'; // la schermata non ha ancora cambiato fase
    expect(s.say('correct')).toBeNull();
  });
});

describe('voice game brain: words (vocabulary)', () => {
  const expected = answerVariants('to give up / give in');

  test('saying the answer is its own action', () => {
    const s = setup({ vocab: true, expected });
    expect(s.say('give up')).toEqual({ kind: 'said-answer' });
  });

  test('a near answer from the recogniser still counts', () => {
    const s = setup({ vocab: true, expected });
    expect(s.say('give op')).toEqual({ kind: 'said-answer' });
  });

  test('a wrong word does nothing', () => {
    const s = setup({ vocab: true, expected });
    expect(s.say('take off')).toBeNull();
  });

  test('"correct" before seeing the answer only reveals it', () => {
    const s = setup({ vocab: true, expected });
    expect(s.say('correct')).toEqual({ kind: 'reveal-read' });
    const w = setup({ vocab: true, expected });
    expect(w.say('wrong')).toEqual({ kind: 'reveal-read' });
  });

  test('once the answer is on screen the grade is a real grade', () => {
    const s = setup({ vocab: true, expected, phase: 'answer' });
    expect(s.say('wrong')).toEqual({ kind: 'grade', correct: false });
  });

  test('the answer is not taken from the voice reading the question', () => {
    const s = setup({ vocab: true, expected });
    s.echo.start('Which phrasal verb means to give up?');
    expect(s.say('give up')).toBeNull();
  });

  test('the answer said in other phases is ignored', () => {
    const s = setup({ vocab: true, expected, phase: 'answer' });
    expect(s.say('give up')).toBeNull();
  });
});
