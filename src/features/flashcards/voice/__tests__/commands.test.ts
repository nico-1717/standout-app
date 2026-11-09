import it from '@/core/i18n/lang/it.json';
import en from '@/core/i18n/lang/en.json';

import {
  EchoFilter,
  answerVariants,
  buildCommands,
  normalize,
  saidTheAnswer,
  similarity,
  type Intent,
  type Phase,
} from '../commands';
import golden from './golden.json';

const dicts = { it: it.fc as Record<string, string>, en: en.fc as Record<string, string> };
const commandsFor = (site: string) => buildCommands(dicts, site, true);

describe('voice commands: same answers as the website code', () => {
  test('every phrase in every language and phase gives the same command and the same scores', () => {
    const sets = { it: commandsFor('it'), en: commandsFor('en') };
    expect(golden.out.length).toBeGreaterThan(100);
    for (const g of golden.out) {
      const m = sets[g.site as 'it' | 'en'].match(g.say, g.phase as Phase);
      const label = `${g.site}/${g.phase}: "${g.say}"`;
      expect([label, m?.intent ?? null]).toEqual([label, g.intent]);
      if (m) {
        expect(Number(m.score.toFixed(4))).toBe(g.score);
        expect(Number(m.weighted.toFixed(4))).toBe(g.weighted);
      }
    }
  });

  test('"near" sounds (loose recognition) give the same result', () => {
    const sets = { it: commandsFor('it'), en: commandsFor('en') };
    expect(golden.loose.length).toBeGreaterThan(30);
    for (const g of golden.loose) {
      const allowed = g.set.split('+') as Intent[];
      const m = sets[g.site as 'it' | 'en'].matchLoose(g.say, allowed);
      const label = `${g.site}/${g.set}: "${g.say}"`;
      expect([label, m?.intent ?? null]).toEqual([label, g.intent]);
      if (m) expect(Number(m.score.toFixed(4))).toBe(g.score);
    }
  });

  test('answers said out loud: variants and tolerance match the website', () => {
    for (const g of golden.ans) {
      const v = answerVariants(g.raw);
      expect([g.raw, v]).toEqual([g.raw, g.variants]);
      expect([g.said, saidTheAnswer(g.said, v)]).toEqual([g.said, g.ok]);
    }
  });
});

describe('voice commands: rules of the app', () => {
  const c = commandsFor('en');

  test('"continue" and "boss" only exist in front of the checkpoint', () => {
    expect(c.match('continue', 'question')).toBeNull();
    expect(c.match('continue', 'ck')?.intent).toBe('continua');
    expect(c.match('boss round', 'boss-q')?.intent).toBe('boss');
  });

  test('politeness words are dropped; a long sentence is not a command', () => {
    expect(c.match('please show the answer', 'question')?.intent).toBe('risposta');
    expect(c.match('the capital of France is Paris', 'question')).toBeNull();
    expect(c.matchLoose('this is far too long to be a command', ['corretto', 'errato'])).toBeNull();
  });

  test('which commands are accepted loosely depends on the phase and on words', () => {
    const cards = buildCommands(dicts, 'en', false);
    const words = buildCommands(dicts, 'en', true);
    expect(cards.looseIntents('question')).toEqual(['risposta']);
    expect(words.looseIntents('question')).toEqual([]); // nelle parole si dice la parola da indovinare
    expect(cards.looseIntents('answer')).toEqual(['corretto', 'errato']);
    expect(cards.looseIntents('ck')).toEqual([]);
  });

  test('two opposite commands with the same score vote for nobody', () => {
    // «rong» e «ron» sono vicini di «errato» soltanto: vince lui, ma una parola vicina a entrambi non vota
    expect(c.matchLoose('wrong', ['corretto', 'errato'])?.intent).toBe('errato');
    expect(c.matchLoose('right', ['corretto', 'errato'])?.intent).toBe('corretto');
  });

  test('hints are the short phrases of the chosen language only', () => {
    const h = c.hints('it-IT');
    expect(h).toContain('ripeti');
    expect(h).not.toContain('repeat');
    expect(h.every((x) => x.split(' ').length <= 3)).toBe(true);
    expect(h.length).toBeLessThanOrEqual(80);
  });

  test('normalize and similarity', () => {
    expect(normalize("  Così, è l'ORA! ")).toBe('cosi e l ora');
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('', '')).toBe(1);
    expect(similarity('abc', 'xyz')).toBe(0);
  });
});

describe('echo filter', () => {
  test('what the voice is reading is not the user; it stops counting 1.5 s after the reading ends', () => {
    let now = 1000;
    const e = new EchoFilter(() => now);
    expect(e.isEcho('right')).toBe(false); // niente in lettura
    e.start('<b>This is right</b> and that is wrong');
    expect(e.isEcho('right')).toBe(true);
    expect(e.isEcho('That is wrong')).toBe(true);
    expect(e.isEcho('correct')).toBe(false);
    expect(e.isWideEcho('this wrong')).toBe(true); // tutte parole della lettura
    expect(e.isWideEcho('this is correct')).toBe(false);
    e.end();
    now += 1000;
    expect(e.isEcho('right')).toBe(true);
    now += 600;
    expect(e.isEcho('right')).toBe(false);
  });
});
