import {
  DEFAULT_TIMING,
  Listener,
  type EngineResult,
  type FatalReason,
  type ListenerState,
} from '../recognizer';
import { FakeEngine } from './fakeEngine';

// il riconoscimento del telefono non c'è nei test: il modulo nativo è finto
jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: {} }));

function setup() {
  const engine = new FakeEngine();
  const heard: EngineResult[] = [];
  const states: ListenerState[] = [];
  const fatals: FatalReason[] = [];
  const l = new Listener(engine, {
    onResult: (r) => heard.push(r),
    onState: (s) => states.push(s),
    onFatal: (w) => fatals.push(w),
  });
  return { engine, heard, states, fatals, l };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Listener', () => {
  test('asks for the permission, starts with the language, the hints and 5 alternatives', async () => {
    const { engine, l, states } = setup();
    expect(await l.begin('it-IT', ['ripeti'])).toBe(true);
    expect(engine.starts).toEqual([
      { lang: 'it-IT', hints: ['ripeti'], interim: true, alternatives: 5 },
    ]);
    expect(states).toEqual(['starting', 'listening']);
  });

  test('no permission or no recognition on the phone: it does not start and says why', async () => {
    const a = setup();
    a.engine.granted = false;
    expect(await a.l.begin('it-IT', [])).toBe(false);
    expect(a.fatals).toEqual(['permission']);
    expect(a.engine.starts).toHaveLength(0);
    const b = setup();
    b.engine.isAvailable = false;
    expect(await b.l.begin('it-IT', [])).toBe(false);
    expect(b.fatals).toEqual(['unsupported']);
  });

  test('passes on what it hears, and reopens by itself when the system closes the session', async () => {
    const { engine, l, heard, states } = setup();
    await l.begin('en-US', []);
    engine.say(['wrong', 'ron'], false);
    engine.say(['wrong', 'ron'], true);
    expect(heard.map((h) => [h.alternatives[0], h.isFinal])).toEqual([
      ['wrong', false],
      ['wrong', true],
    ]);
    expect(states).toContain('hearing');
    engine.finish();
    expect(engine.starts).toHaveLength(1);
    jest.advanceTimersByTime(DEFAULT_TIMING.restartMs + 1);
    expect(engine.starts).toHaveLength(2);
  });

  test('silence and aborts are normal; "busy" and "network" retry with more calm', async () => {
    const { engine, l, fatals } = setup();
    await l.begin('en-US', []);
    engine.fail('no-speech');
    engine.finish();
    jest.advanceTimersByTime(DEFAULT_TIMING.restartMs + 1);
    expect(engine.starts).toHaveLength(2);
    engine.fail('busy');
    engine.finish();
    jest.advanceTimersByTime(DEFAULT_TIMING.restartMs + 1);
    expect(engine.starts).toHaveLength(2); // il «busy» aspetta di più
    jest.advanceTimersByTime(DEFAULT_TIMING.retryMs);
    expect(engine.starts).toHaveLength(3);
    expect(fatals).toEqual([]);
  });

  test('permission taken away or language not supported: stops for good', async () => {
    const { engine, l, fatals, states } = setup();
    await l.begin('en-US', []);
    engine.fail('not-allowed');
    expect(fatals).toEqual(['permission']);
    expect(l.isOn).toBe(false);
    expect(states.at(-1)).toBe('off');
    engine.finish();
    jest.advanceTimersByTime(10_000);
    expect(engine.starts).toHaveLength(1); // niente riavvio
    const b = setup();
    await b.l.begin('xx-XX', []);
    b.engine.fail('language-not-supported');
    expect(b.fatals).toEqual(['unsupported']);
  });

  test('too many reopenings in a row: a long pause instead of a storm', async () => {
    const { engine, l } = setup();
    await l.begin('en-US', []);
    for (let i = 0; i < 12; i++) {
      engine.finish();
      jest.advanceTimersByTime(DEFAULT_TIMING.restartMs + 1);
    }
    expect(engine.starts.length).toBeLessThan(8);
    jest.advanceTimersByTime(DEFAULT_TIMING.stormPauseMs + 10);
    expect(engine.starts.length).toBeGreaterThan(6);
  });

  test('end() stops everything and ignores what comes later', async () => {
    const { engine, l, heard } = setup();
    await l.begin('en-US', []);
    l.end();
    expect(engine.aborts).toBe(1);
    engine.say(['right']);
    engine.finish();
    jest.advanceTimersByTime(5000);
    expect(heard).toEqual([]);
    expect(engine.starts).toHaveLength(1);
  });

  test('retune: a new language closes the session so the next one uses it', async () => {
    const { engine, l } = setup();
    await l.begin('it-IT', ['ripeti']);
    l.retune('en-US', ['repeat']);
    jest.advanceTimersByTime(DEFAULT_TIMING.restartMs + 1);
    expect(engine.starts.at(-1)).toMatchObject({ lang: 'en-US', hints: ['repeat'] });
  });
});
