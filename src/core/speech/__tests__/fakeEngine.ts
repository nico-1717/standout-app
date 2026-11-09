import type { EngineError, EngineResult, EngineStart, SpeechEngine } from '../recognizer';

/** Un riconoscimento finto per i test: registra le richieste e lascia "dire" frasi a mano. */
export class FakeEngine implements SpeechEngine {
  granted = true;
  isAvailable = true;
  starts: EngineStart[] = [];
  aborts = 0;
  private cb = {
    result: new Set<(r: EngineResult) => void>(),
    error: new Set<(c: EngineError) => void>(),
    start: new Set<() => void>(),
    end: new Set<() => void>(),
  };
  requestPermission = async () => this.granted;
  available = () => this.isAvailable;
  start = (o: EngineStart) => {
    this.starts.push(o);
    this.cb.start.forEach((f) => f());
  };
  stop = () => undefined;
  abort = () => {
    this.aborts++;
    this.cb.end.forEach((f) => f());
  };
  onResult = (f: (r: EngineResult) => void) => (
    this.cb.result.add(f),
    () => this.cb.result.delete(f)
  );
  onError = (f: (c: EngineError) => void) => (this.cb.error.add(f), () => this.cb.error.delete(f));
  onStart = (f: () => void) => (this.cb.start.add(f), () => this.cb.start.delete(f));
  onEnd = (f: () => void) => (this.cb.end.add(f), () => this.cb.end.delete(f));
  say(alternatives: string[], isFinal = true) {
    this.cb.result.forEach((f) => f({ alternatives, isFinal }));
  }
  fail(code: EngineError) {
    this.cb.error.forEach((f) => f(code));
  }
  finish() {
    this.cb.end.forEach((f) => f());
  }
}
