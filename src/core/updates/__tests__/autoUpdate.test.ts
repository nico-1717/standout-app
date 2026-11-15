import { downloadUpdate, updateAtLaunch, type UpdatesApi } from '../autoUpdate';

const fake = (o: Partial<UpdatesApi> = {}): jest.Mocked<UpdatesApi> =>
  Object.assign(
    {
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
      fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
      reloadAsync: jest.fn(async () => undefined),
    },
    o,
  ) as jest.Mocked<UpdatesApi>;

describe('over-the-air updates', () => {
  test('does nothing when updates are off (Expo Go, development)', async () => {
    const api = fake({ isEnabled: false });
    expect(await downloadUpdate(api)).toBe(false);
    expect(api.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  test('nothing new: nothing is downloaded and the app is not restarted', async () => {
    const api = fake({ checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })) });
    await updateAtLaunch(api);
    expect(api.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  test('a new update is downloaded, and at launch the app restarts into it', async () => {
    const api = fake();
    await updateAtLaunch(api);
    expect(api.fetchUpdateAsync).toHaveBeenCalled();
    expect(api.reloadAsync).toHaveBeenCalled();
  });

  test('coming back to the app only downloads: no restart', async () => {
    const api = fake();
    expect(await downloadUpdate(api)).toBe(true);
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  test('an update that is not new does not restart', async () => {
    const api = fake({ fetchUpdateAsync: jest.fn(async () => ({ isNew: false })) });
    await updateAtLaunch(api);
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  test('no network or a server error never throws', async () => {
    const down = fake({
      checkForUpdateAsync: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    await expect(updateAtLaunch(down)).resolves.toBeUndefined();
    const half = fake({
      reloadAsync: jest.fn(async () => {
        throw new Error('cannot reload');
      }),
    });
    await expect(updateAtLaunch(half)).resolves.toBeUndefined();
  });
});
