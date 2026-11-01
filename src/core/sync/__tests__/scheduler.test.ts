import { ApiError } from '../../api/httpApi';
import { DEBOUNCE_MS, POLL_MS, SyncScheduler } from '../scheduler';

const report = { applied: 0, rejected: 0, retry: 0, pulled: 0, snapshotDone: false };

function make(syncOnce: jest.Mock, pending = 0) {
  const refreshToken = jest.fn().mockResolvedValue('t');
  const s = new SyncScheduler({
    syncOnce,
    pendingCount: () => pending,
    refreshToken,
    random: () => 0,
  });
  return { s, refreshToken };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('several quick changes → one sync after 2 seconds', async () => {
  const f = jest.fn().mockResolvedValue(report);
  const { s } = make(f);
  s.start();
  await jest.advanceTimersByTimeAsync(0);
  f.mockClear();
  s.trigger();
  s.trigger();
  s.trigger();
  await jest.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
  expect(f).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(f).toHaveBeenCalledTimes(1);
  s.stop();
});

test('polls every 60 seconds while open', async () => {
  const f = jest.fn().mockResolvedValue(report);
  const { s } = make(f);
  s.start();
  await jest.advanceTimersByTimeAsync(0);
  f.mockClear();
  await jest.advanceTimersByTimeAsync(POLL_MS * 2 + 1);
  expect(f).toHaveBeenCalledTimes(2);
  s.stop();
});

test('failure → backoff 5 s then 10 s, then success resets', async () => {
  const f = jest
    .fn()
    .mockRejectedValueOnce(new ApiError(500, 'server_error', 'x'))
    .mockRejectedValueOnce(new ApiError(500, 'server_error', 'x'))
    .mockResolvedValue(report);
  const { s } = make(f);
  s.start();
  await jest.advanceTimersByTimeAsync(0);
  expect(f).toHaveBeenCalledTimes(1);
  expect(s.getInfo().status).toBe('error');
  await jest.advanceTimersByTimeAsync(4_999);
  expect(f).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(f).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(10_000);
  expect(f).toHaveBeenCalledTimes(3);
  expect(s.getInfo().status).toBe('idle');
  expect(s.getInfo().lastSyncAt).not.toBeNull();
  s.stop();
});

test('offline: no attempts until the network comes back', async () => {
  const f = jest.fn().mockResolvedValue(report);
  const { s } = make(f);
  s.setOnline(false);
  s.start();
  await jest.advanceTimersByTimeAsync(POLL_MS * 3);
  expect(f).not.toHaveBeenCalled();
  expect(s.getInfo().status).toBe('offline');
  s.setOnline(true);
  await jest.advanceTimersByTimeAsync(0);
  expect(f).toHaveBeenCalledTimes(1);
  s.stop();
});

test('fetch TypeError (no network) shows offline, not error', async () => {
  const f = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
  const { s } = make(f);
  s.start();
  await jest.advanceTimersByTimeAsync(0);
  expect(s.getInfo().status).toBe('offline');
  s.stop();
});

test('token_expired → refresh once and retry in the same attempt', async () => {
  const f = jest
    .fn()
    .mockRejectedValueOnce(new ApiError(401, 'token_expired', 'x'))
    .mockResolvedValue(report);
  const { s, refreshToken } = make(f);
  s.start();
  await jest.advanceTimersByTimeAsync(0);
  expect(refreshToken).toHaveBeenCalledTimes(1);
  expect(f).toHaveBeenCalledTimes(2);
  expect(s.getInfo().status).toBe('idle');
  s.stop();
});

test('closed session → scheduler stops by itself, no retries', async () => {
  const f = jest.fn().mockRejectedValue(new ApiError(401, 'token_reused', 'x'));
  const { s } = make(f);
  s.start();
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(POLL_MS * 5);
  expect(f).toHaveBeenCalledTimes(1);
});
