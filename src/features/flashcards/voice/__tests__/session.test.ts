import en from '@/core/i18n/lang/en.json';
import it from '@/core/i18n/lang/it.json';
import { FakeEngine } from '@/core/speech/__tests__/fakeEngine';

import type { VoiceAction } from '../brain';
import { answerVariants, buildCommands, type Phase } from '../commands';
import type { Segment } from '../reading';
import { AUTO_GRADE_MS, VoiceSession, type SessionView } from '../session';

const dicts = { it: it.fc as Record<string, string>, en: en.fc as Record<string, string> };

function setup(over: Partial<SessionView> = {}) {
  jest.useFakeTimers();
  let t = 1000;
  const engine = new FakeEngine();
  const view: SessionView = { phase: 'question', vocab: false, expected: [], card: 'c1', ...over };
  const actions: VoiceAction[] = [];
  const spoken: { text: string; lang: string; once?: boolean; done?: () => void }[] = [];
  const states: boolean[] = [];
  const fatals: string[] = [];
  const session = new VoiceSession({
    engine,
    speak: async (text, lang, o) => {
      spoken.push({ text, lang, ...o });
    },
    stopSpeaking: jest.fn(),
    commands: buildCommands(dicts, 'en', view.vocab),
    lang: 'en-US',
    getView: () => view,
    onAction: (a) => actions.push(a),
    onSpeaking: (on) => states.push(on),
    onFatal: (w) => fatals.push(w),
    now: () => t,
  });
  const clock = (ms: number) => {
    t += ms;
    jest.advanceTimersByTime(ms);
  };
  return { engine, view, actions, spoken, states, fatals, session, clock };
}

const seg = (text: string, lang = 'en-GB', once = true): Segment => ({ text, lang, once });
afterEach(() => jest.useRealTimers());

describe('voice session', () => {
  test('starts the microphone with the command phrases as hints', async () => {
    const s = setup();
    expect(await s.session.start()).toBe(true);
    expect(s.engine.starts[0]?.lang).toBe('en-US');
    expect(s.engine.starts[0]?.hints?.length).toBeGreaterThan(5);
    s.session.stop();
  });

  test('no permission → onFatal, nothing runs', async () => {
    const s = setup();
    s.engine.granted = false;
    expect(await s.session.start()).toBe(false);
    expect(s.fatals).toEqual(['permission']);
  });

  test('what you say becomes an action; the card voice is not you', async () => {
    const s = setup({ phase: 'answer' });
    await s.session.start();
    s.session.read([seg('Is it right or wrong')]);
    s.engine.say(['right']);
    expect(s.actions).toEqual([]); // eco
    s.spoken[0]!.done!();
    s.clock(2000);
    s.engine.say(['correct']);
    expect(s.actions).toEqual([{ kind: 'grade', correct: true }]);
    s.session.stop();
  });

  test('readings go one after the other, and a new reading stops the old one', async () => {
    const s = setup();
    await s.session.start();
    s.session.read([seg('one'), seg('two')]);
    expect(s.spoken.map((x) => x.text)).toEqual(['one']);
    s.spoken[0]!.done!();
    expect(s.spoken.map((x) => x.text)).toEqual(['one', 'two']);
    s.session.read([seg('three')]);
    s.spoken[1]!.done!(); // la vecchia finisce dopo: non deve far partire altro
    expect(s.spoken.map((x) => x.text)).toEqual(['one', 'two', 'three']);
    s.session.stop();
  });

  test('"repeat" reads the last thing again from the start', async () => {
    const s = setup();
    await s.session.start();
    s.session.read([seg('hello there')]);
    s.spoken[0]!.done!();
    s.clock(3000);
    s.engine.say(['repeat']);
    expect(s.spoken.map((x) => x.text)).toEqual(['hello there', 'hello there']);
    expect(s.actions).toEqual([]); // ripetere non è un'azione dello schermo
    s.session.stop();
  });

  test('words: the right answer shows the card, and 3 seconds later it is graded correct', async () => {
    const s = setup({ vocab: true, expected: answerVariants('to give up') });
    await s.session.start();
    s.engine.say(['give up']);
    expect(s.actions).toEqual([{ kind: 'reveal' }]);
    // lo schermo ha cambiato fase e chiede la lettura della risposta
    s.view.phase = 'answer';
    s.session.read([seg('to give up')]);
    s.spoken[0]!.done!();
    s.clock(AUTO_GRADE_MS - 100);
    expect(s.actions).toHaveLength(1);
    s.clock(200);
    expect(s.actions).toEqual([{ kind: 'reveal' }, { kind: 'grade', correct: true }]);
    s.session.stop();
  });

  test('words: a long reading delays the grade until it is over', async () => {
    const s = setup({ vocab: true, expected: answerVariants('to give up') });
    await s.session.start();
    s.engine.say(['give up']);
    s.view.phase = 'answer';
    s.session.read([seg('to give up')]);
    s.clock(5000); // la voce sta ancora leggendo
    expect(s.actions).toEqual([{ kind: 'reveal' }]);
    s.spoken[0]!.done!();
    s.clock(1);
    expect(s.actions).toEqual([{ kind: 'reveal' }, { kind: 'grade', correct: true }]);
    s.session.stop();
  });

  test('words: saying "wrong" while the correct mark is on its way changes the grade', async () => {
    const s = setup({ vocab: true, expected: answerVariants('to give up') });
    await s.session.start();
    s.engine.say(['give up']);
    s.view.phase = 'answer';
    s.session.read([seg('to give up')]);
    s.spoken[0]!.done!();
    s.clock(500);
    s.engine.say(['wrong']);
    expect(s.actions).toEqual([{ kind: 'reveal' }, { kind: 'grade', correct: false }]);
    s.clock(10000);
    expect(s.actions).toHaveLength(2); // il «corretto» automatico non parte più
    s.session.stop();
  });

  test('words: if the card changes (you tapped), the automatic grade is dropped', async () => {
    const s = setup({ vocab: true, expected: answerVariants('to give up') });
    await s.session.start();
    s.engine.say(['give up']);
    s.view.phase = 'answer';
    s.session.read([seg('to give up')]);
    s.spoken[0]!.done!();
    s.view.card = 'c2';
    s.clock(AUTO_GRADE_MS + 100);
    expect(s.actions).toEqual([{ kind: 'reveal' }]);
    s.session.stop();
  });

  test('an answer with nothing to read is graded after the pause', async () => {
    const s = setup({ vocab: true, expected: answerVariants('to give up') });
    await s.session.start();
    s.engine.say(['give up']);
    s.view.phase = 'answer';
    s.session.read([]);
    await Promise.resolve();
    s.clock(AUTO_GRADE_MS + 10);
    expect(s.actions).toEqual([{ kind: 'reveal' }, { kind: 'grade', correct: true }]);
    s.session.stop();
  });

  test('after stop nothing more happens', async () => {
    const s = setup({ phase: 'answer' });
    await s.session.start();
    s.session.stop();
    s.session.read([seg('late')]);
    expect(s.spoken).toEqual([]);
    s.engine.say(['correct']);
    expect(s.actions).toEqual([]);
  });

  test('phases are respected', async () => {
    const s = setup({ phase: 'grading' as Phase });
    await s.session.start();
    s.engine.say(['correct']);
    expect(s.actions).toEqual([]);
    s.session.stop();
  });
});
