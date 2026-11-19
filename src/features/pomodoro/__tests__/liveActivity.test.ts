import { Platform } from 'react-native';

import PomodoroActivity from '../PomodoroActivity';
import { syncLiveActivity } from '../liveActivity';
import { activityFor, type ActivityTexts } from '../liveActivityState';
import { stamp, type Session } from '../logic';

const texts: ActivityTexts = {
  focus: 'Focusing',
  focusPaused: 'Session paused',
  stopwatch: 'Stopwatch running',
  stopwatchPaused: 'Session paused',
  breakTitle: 'On a break',
  focusDone: 'Pomodoro finished',
  breakDone: 'Break over',
  fallbackSubtitle: 'Standout',
};
const NOW = new Date(2030, 2, 1, 10, 10, 0).getTime();
const colors = { brandColor: '#8A6B3F', breakColor: '#30B0C7', lang: 'en', texts };

const session = (over: Partial<Session> = {}): Session => ({
  uuid: 's1',
  mode: 0,
  start_time: stamp(new Date(2030, 2, 1, 10, 0, 0)),
  end_time: null,
  status: null,
  resume_time: null,
  duration_seconds: 0,
  planned_duration_min: 25,
  project_uuid: null,
  is_manual: 0,
  ...over,
});
const args = (over: Partial<Parameters<typeof activityFor>[0]> = {}) => ({
  active: null,
  brk: null,
  nowMs: NOW,
  projectName: null,
  color: null,
  ...colors,
  ...over,
});

describe('activityFor', () => {
  test('nothing running: nothing to show', () => {
    expect(activityFor(args())).toBeNull();
  });

  test('a running pomodoro counts down to its end and turns stale at the end', () => {
    const d = activityFor(args({ active: session(), projectName: 'Thesis', color: '#112233' }))!;
    // 10 minutes already worked out of 25: 15 left
    expect(d.props).toMatchObject({
      kind: 'focus',
      paused: false,
      at: NOW,
      from: NOW,
      to: NOW + 15 * 60000,
      title: 'Focusing',
      subtitle: 'Thesis',
      color: '#112233',
      doneText: 'Pomodoro finished',
    });
    expect(d.staleAt).toBe(NOW + 15 * 60000);
  });

  test('a paused pomodoro freezes the remaining time and never turns stale', () => {
    const d = activityFor(
      args({ active: session({ status: 'pausa', duration_seconds: 600, resume_time: null }) }),
    )!;
    expect(d.props).toMatchObject({ paused: true, title: 'Session paused', to: NOW + 15 * 60000 });
    expect(d.staleAt).toBeNull();
    expect(d.props.subtitle).toBe('Standout');
    expect(d.props.color).toBe('#8A6B3F');
  });

  test('a pomodoro whose time is up is already stale', () => {
    const d = activityFor(args({ active: session({ planned_duration_min: 5 }) }))!;
    expect(d.staleAt).toBe(NOW);
    expect(d.props.to).toBe(NOW);
    expect(d.props.from).toBeLessThan(d.props.to);
  });

  test('a stopwatch counts up from its start, and a pause freezes it', () => {
    const running = activityFor(
      args({ active: session({ mode: 1, planned_duration_min: null }) }),
    )!;
    expect(running.props).toMatchObject({
      kind: 'stopwatch',
      paused: false,
      from: NOW - 10 * 60000,
      title: 'Stopwatch running',
    });
    expect(running.staleAt).toBeNull();
    const paused = activityFor(
      args({
        active: session({
          mode: 1,
          planned_duration_min: null,
          status: 'pausa',
          duration_seconds: 90,
        }),
      }),
    )!;
    expect(paused.props).toMatchObject({
      paused: true,
      from: NOW - 90000,
      title: 'Session paused',
    });
  });

  test('a break counts down to its end; a session wins over a break', () => {
    const brk = { start_time: stamp(new Date(2030, 2, 1, 10, 8, 0)), planned_duration_min: 5 };
    const b = activityFor(args({ brk }))!;
    expect(b.props).toMatchObject({ kind: 'break', title: 'On a break', to: NOW + 3 * 60000 });
    expect(b.staleAt).toBe(NOW + 3 * 60000);
    expect(activityFor(args({ brk, active: session() }))!.props.kind).toBe('focus');
  });

  test('the key changes on pause and resume, not with the passing time', () => {
    const run = activityFor(args({ active: session() }))!;
    const later = activityFor(args({ active: session(), nowMs: NOW + 5000 }))!;
    const paused = activityFor(
      args({ active: session({ status: 'pausa', duration_seconds: 600 }) }),
    )!;
    const resumed = activityFor(
      args({
        active: session({
          duration_seconds: 600,
          resume_time: stamp(new Date(NOW + 20000)),
        }),
      }),
    )!;
    expect(later.key).toBe(run.key);
    expect(paused.key).not.toBe(run.key);
    expect(resumed.key).not.toBe(paused.key);
  });
});

describe('syncLiveActivity', () => {
  const factory = PomodoroActivity as unknown as {
    start: jest.Mock;
    getInstances: jest.Mock;
    __instance: { update: jest.Mock; end: jest.Mock; getId: jest.Mock };
  };
  const desired = (key: string) => ({ ...activityFor(args({ active: session() }))!, key });

  beforeEach(async () => {
    await syncLiveActivity(null);
    jest.clearAllMocks();
    factory.getInstances.mockReturnValue([]);
  });

  test('starts one activity, updates it only when the key changes, ends it when nothing runs', async () => {
    await syncLiveActivity(desired('a'));
    expect(factory.start).toHaveBeenCalledTimes(1);
    expect(factory.start.mock.calls[0][1]).toBe('standout://pomodoro');
    await syncLiveActivity(desired('a'));
    expect(factory.__instance.update).not.toHaveBeenCalled();
    await syncLiveActivity(desired('b'));
    expect(factory.start).toHaveBeenCalledTimes(1);
    expect(factory.__instance.update).toHaveBeenCalledTimes(1);
    await syncLiveActivity(null);
    expect(factory.__instance.end).toHaveBeenCalledWith('immediate');
  });

  test('after an app restart it takes the activity that is still there and closes duplicates', async () => {
    const dup = {
      getId: jest.fn(() => 'activity-2'),
      update: jest.fn(),
      end: jest.fn(() => Promise.resolve()),
    };
    factory.getInstances.mockReturnValue([factory.__instance, dup]);
    await syncLiveActivity(desired('a'));
    expect(factory.start).not.toHaveBeenCalled();
    expect(factory.__instance.update).toHaveBeenCalledTimes(1);
    expect(dup.end).toHaveBeenCalledWith('immediate');
  });

  test('when the activity was swiped away the next change starts a new one', async () => {
    await syncLiveActivity(desired('a'));
    factory.__instance.update.mockRejectedValueOnce(new Error('ended'));
    await syncLiveActivity(desired('b'));
    expect(factory.start).toHaveBeenCalledTimes(2);
  });

  test('a failure never reaches the app', async () => {
    factory.start.mockImplementationOnce(() => {
      throw new Error('activities are turned off');
    });
    await expect(syncLiveActivity(desired('a'))).resolves.toBeUndefined();
  });

  test('on Android nothing happens', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    await syncLiveActivity(desired('a'));
    Platform.OS = original;
    expect(factory.start).not.toHaveBeenCalled();
  });
});
