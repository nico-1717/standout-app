import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { pomodoroPresetUuid } from '@/core/sync/uuid5';

import {
  abandonedPatch,
  clock,
  elapsedSeconds,
  human,
  remainingSeconds,
  stamp,
  stampMs,
  type Session,
} from '../logic';
import { PomodoroRepo } from '../repo';
import {
  DEFAULT_POMODORO_SETTINGS,
  PomodoroSettingsStore,
  cleanPomodoroSettings,
} from '../settings';

let t = new Date(2030, 2, 1, 10, 0, 0);
const at = (h: number, m: number, s = 0) => (t = new Date(2030, 2, 1, h, m, s));

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const repo = new PomodoroRepo(
    db,
    7,
    () => t,
    () => '2030-03-01T09:00:00Z',
    () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  );
  at(10, 0);
  return { db, repo };
}

describe('time helpers', () => {
  test('stamp and stampMs are inverse, in local time', () => {
    const d = new Date(2030, 2, 1, 9, 5, 7);
    expect(stamp(d)).toBe('2030-03-01 09:05:07');
    expect(stampMs('2030-03-01 09:05:07')).toBe(d.getTime());
    expect(stampMs('boh')).toBeNaN();
  });

  test('clock and human', () => {
    expect(clock(1500)).toBe('25:00');
    expect(clock(3725)).toBe('1:02:05');
    expect(clock(-3)).toBe('00:00');
    expect(human(40)).toBe('40 s');
    expect(human(1500)).toBe('25 min');
    expect(human(3900)).toBe('1 h 05 min');
    expect(human(7200)).toBe('2 h');
  });

  test('elapsed adds the running segment only when it is running', () => {
    const base: Session = {
      uuid: 'a',
      mode: 0,
      start_time: '2030-03-01 10:00:00',
      end_time: null,
      status: null,
      resume_time: null,
      duration_seconds: 0,
      planned_duration_min: 25,
      project_uuid: null,
      is_manual: 0,
    };
    const now = new Date(2030, 2, 1, 10, 10, 0).getTime();
    expect(elapsedSeconds(base, now)).toBe(600);
    expect(
      elapsedSeconds({ ...base, duration_seconds: 300, resume_time: '2030-03-01 10:05:00' }, now),
    ).toBe(600);
    expect(elapsedSeconds({ ...base, status: 'pausa', duration_seconds: 300 }, now)).toBe(300);
    expect(
      elapsedSeconds({ ...base, end_time: '2030-03-01 10:25:00', duration_seconds: 1500 }, now),
    ).toBe(1500);
    expect(remainingSeconds(base, now)).toBe(900);
    expect(remainingSeconds({ ...base, mode: 1, planned_duration_min: null }, now)).toBeNull();
  });

  test('a forgotten session is closed with the smaller of elapsed and planned', () => {
    const s: Session = {
      uuid: 'a',
      mode: 0,
      start_time: '2030-03-01 08:00:00',
      end_time: null,
      status: null,
      resume_time: null,
      duration_seconds: 0,
      planned_duration_min: 50,
      project_uuid: null,
      is_manual: 0,
    };
    const day2 = new Date(2030, 2, 3, 8, 0, 0).getTime();
    expect(abandonedPatch(s, new Date(2030, 2, 1, 12, 0, 0).getTime())).toBeNull(); // 4 ore: ancora valida
    expect(abandonedPatch(s, day2)).toEqual({
      duration_seconds: 3000,
      end_time: '2030-03-01 08:50:00',
      status: 'abbandonato',
      resume_time: null,
      is_manual: 2,
    });
    // in pausa il segmento non scorre: vale quanto era già accumulato
    expect(
      abandonedPatch({ ...s, status: 'pausa', duration_seconds: 720 }, day2)!.duration_seconds,
    ).toBe(720);
    // il cronometro non ha durata prevista: il tetto è il limite
    expect(
      abandonedPatch({ ...s, mode: 1, planned_duration_min: null }, day2)!.duration_seconds,
    ).toBe(36000);
    expect(abandonedPatch({ ...s, end_time: '2030-03-01 09:00:00' }, day2)).toBeNull();
  });
});

describe('sessions', () => {
  test('start writes the session and queues it; a second one is refused', () => {
    const { db, repo } = setup();
    const id = repo.start({ mode: 0, plannedMin: 25, projectUuid: 'p1' })!;
    expect(repo.get(id)).toMatchObject({
      mode: 0,
      start_time: '2030-03-01 10:00:00',
      end_time: null,
      duration_seconds: 0,
      planned_duration_min: 25,
      project_uuid: 'p1',
    });
    const [m] = nextBatch(db, 10);
    expect(m).toMatchObject({ table: 'pomodoro_sessions', uuid: id, op: 'upsert' });
    expect(m!.patch).toEqual({
      mode: 0,
      start_time: '2030-03-01 10:00:00',
      duration_seconds: 0,
      planned_duration_min: 25,
      project_uuid: 'p1',
    });
    expect(repo.start({ mode: 1 })).toBeNull();
    expect(repo.active()!.uuid).toBe(id);
  });

  test('the planned time is kept between 1 and 600 minutes; the stopwatch has none', () => {
    const { repo } = setup();
    const a = repo.start({ mode: 0, plannedMin: 99999 })!;
    expect(repo.get(a)!.planned_duration_min).toBe(600);
    repo.stop(a, true);
    const b = repo.start({ mode: 1, plannedMin: 25 })!;
    expect(repo.get(b)!.planned_duration_min).toBeNull();
  });

  test('pause freezes the seconds, resume starts a new segment, the total ignores the pause', () => {
    const { repo } = setup();
    const id = repo.start({ mode: 0, plannedMin: 25 })!;
    at(10, 10);
    expect(repo.pause(id)).toBe(true);
    expect(repo.get(id)).toMatchObject({
      status: 'pausa',
      duration_seconds: 600,
      resume_time: '2030-03-01 10:10:00',
    });
    expect(repo.pause(id)).toBe(false);
    at(10, 40); // mezz'ora di pausa
    expect(elapsedSeconds(repo.get(id)!, t.getTime())).toBe(600);
    expect(repo.resume(id)).toBe(true);
    expect(repo.get(id)).toMatchObject({
      status: null,
      resume_time: '2030-03-01 10:40:00',
      duration_seconds: 600,
    });
    at(10, 45);
    expect(elapsedSeconds(repo.get(id)!, t.getTime())).toBe(900);
    expect(repo.resume(id)).toBe(false);
  });

  test('stop closes as interrupted at now; stopped from a pause it ends when the pause began', () => {
    const { repo } = setup();
    const a = repo.start({ mode: 1 })!;
    at(10, 20);
    repo.stop(a);
    expect(repo.get(a)).toMatchObject({
      status: 'interrotto',
      end_time: '2030-03-01 10:20:00',
      duration_seconds: 1200,
      resume_time: null,
    });
    expect(repo.stop(a)).toBe(false); // già chiusa: non si richiude
    expect(repo.active()).toBeNull();

    at(11, 0);
    const b = repo.start({ mode: 0, plannedMin: 25 })!;
    at(11, 12);
    repo.pause(b);
    at(12, 0);
    repo.stop(b);
    expect(repo.get(b)).toMatchObject({
      end_time: '2030-03-01 11:12:00',
      duration_seconds: 720,
      status: 'interrotto',
    });
  });

  test('stop with discard removes the session everywhere', () => {
    const { db, repo } = setup();
    const a = repo.start({ mode: 1 })!;
    db.run('DELETE FROM outbox');
    repo.stop(a, true);
    expect(repo.get(a)).toBeNull();
    expect(nextBatch(db, 10)[0]).toMatchObject({
      table: 'pomodoro_sessions',
      op: 'delete',
      uuid: a,
    });
  });

  test('complete ends exactly at the planned time, extend adds the time after it, archive hides it', () => {
    const { repo } = setup();
    const id = repo.start({ mode: 0, plannedMin: 25 })!;
    at(10, 27); // il telefono se n'è accorto con due minuti di ritardo
    expect(repo.complete(id)).toBe(true);
    expect(repo.get(id)).toMatchObject({
      status: 'completato',
      end_time: '2030-03-01 10:25:00',
      duration_seconds: 1500,
      resume_time: null,
    });
    expect(repo.lastCompleted()!.uuid).toBe(id);
    expect(repo.extend(id)).toBe(true);
    expect(repo.get(id)).toMatchObject({ end_time: '2030-03-01 10:27:00', duration_seconds: 1620 });
    expect(repo.archive(id)).toBe(true);
    expect(repo.lastCompleted()).toBeNull();
    expect(repo.complete(id)).toBe(false);
  });

  test('complete after a pause uses the time already done', () => {
    const { repo } = setup();
    const id = repo.start({ mode: 0, plannedMin: 25 })!;
    at(10, 10);
    repo.pause(id);
    at(10, 30);
    repo.resume(id);
    at(10, 45); // ha lavorato 10 + 15 = 25 minuti
    repo.complete(id);
    expect(repo.get(id)).toMatchObject({ end_time: '2030-03-01 10:45:00', duration_seconds: 1500 });
  });

  test('project can change only while open; stale sessions are closed; the notice is dismissed', () => {
    const { repo } = setup();
    const id = repo.start({ mode: 0, plannedMin: 50 })!;
    expect(repo.setProject(id, 'p9')).toBe(true);
    expect(repo.get(id)!.project_uuid).toBe('p9');
    expect(repo.closeStale()).toBe(false);
    t = new Date(2030, 2, 3, 10, 0, 0);
    expect(repo.closeStale()).toBe(true);
    expect(repo.get(id)).toMatchObject({
      status: 'abbandonato',
      is_manual: 2,
      duration_seconds: 3000,
    });
    expect(repo.setProject(id, null)).toBe(false);
    expect(repo.abandonedNotice()!.uuid).toBe(id);
    expect(repo.dismissNotice(id)).toBe(true);
    expect(repo.get(id)!.status).toBe('interrotto');
    expect(repo.abandonedNotice()).toBeNull();
  });

  test('totals per project count closed sessions and the part already done of the open one', () => {
    const { repo } = setup();
    const a = repo.start({ mode: 1, projectUuid: 'p1' })!;
    at(10, 30);
    repo.stop(a);
    repo.start({ mode: 1, projectUuid: 'p1' });
    at(10, 40);
    expect(repo.secondsFor(['p1'])).toBe(1800 + 600);
    expect(repo.secondsFor(['other'])).toBe(0);
    expect(repo.secondsFor([])).toBe(0);
    expect(repo.between('2030-03-01', '2030-03-01')).toHaveLength(2);
    expect(repo.between('2030-03-02', '2030-03-05')).toHaveLength(0);
  });
});

describe('saved durations', () => {
  test('ids match the server and defaults are always there', () => {
    // valori calcolati dal PHP del sito: sync_uuid_preset(7, ...)
    expect(pomodoroPresetUuid(7, 'pomodoro', 25)).toBe('ab56df38-4644-5ee8-8e2c-cc3069f87439');
    expect(pomodoroPresetUuid(7, 'pausa', 5)).toBe('25658723-1f02-5ebe-842b-cc4c46921312');
    const { db, repo } = setup();
    expect(repo.presets('pomodoro')).toEqual([25, 50]);
    expect(repo.presets('pausa')).toEqual([5, 10]);
    repo.savePreset('pomodoro', 90);
    repo.savePreset('pomodoro', 90); // due volte: una riga sola
    repo.savePreset('pomodoro', 25); // di fabbrica: niente da salvare
    repo.savePreset('pausa', 0);
    expect(repo.presets('pomodoro')).toEqual([25, 50, 90]);
    const batch = nextBatch(db, 10);
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      table: 'pomodoro_custom_durations',
      uuid: pomodoroPresetUuid(7, 'pomodoro', 90),
    });
    expect(batch[0]!.patch).toEqual({ type: 'pomodoro', minutes: 90 });
    repo.removePreset('pomodoro', 90);
    expect(repo.presets('pomodoro')).toEqual([25, 50]);
  });
});

describe('settings store', () => {
  test('cleans anything that arrives', () => {
    const c = cleanPomodoroSettings({
      last_mode: 9,
      last_pomodoro_duration_min: 0,
      last_display_style: 'x',
      current_break: { start_time: 'ieri', planned_duration_min: 5 },
    });
    // un numero fuori misura si porta dentro i limiti (il server li rifiuta, il telefono non li manda mai)
    expect(c).toEqual({ ...DEFAULT_POMODORO_SETTINGS, last_pomodoro_duration_min: 1 });
    expect(
      cleanPomodoroSettings({
        current_break: {
          start_time: '2030-03-01 10:00:00',
          planned_duration_min: 7,
          project_uuid: 'p',
        },
      }).current_break,
    ).toEqual({ start_time: '2030-03-01 10:00:00', planned_duration_min: 7, project_uuid: 'p' });
  });

  test('a change is sent once; the server value wins for the rest; a pause can be ended', async () => {
    const { db } = setup();
    const store = new PomodoroSettingsStore(db);
    store.update({ last_pomodoro_duration_min: 50 });
    store.update({
      current_break: {
        start_time: '2030-03-01 11:00:00',
        planned_duration_min: 5,
        project_uuid: null,
      },
    });
    expect(store.hasPending()).toBe(true);
    const sent: unknown[] = [];
    const api = {
      getPomodoroSettings: async () => DEFAULT_POMODORO_SETTINGS,
      patchPomodoroSettings: async (p: object) => {
        sent.push(p);
        return {
          ...DEFAULT_POMODORO_SETTINGS,
          last_pomodoro_duration_min: 50,
          last_break_duration_min: 10,
        };
      },
    };
    const out = await store.sync(api);
    expect(sent).toEqual([
      {
        last_pomodoro_duration_min: 50,
        current_break: {
          start_time: '2030-03-01 11:00:00',
          planned_duration_min: 5,
          project_uuid: null,
        },
      },
    ]);
    expect(out.last_break_duration_min).toBe(10);
    expect(store.hasPending()).toBe(false);
    store.update({ current_break: null });
    await store.sync(api);
    expect(sent[1]).toEqual({ current_break: null });
  });
});
