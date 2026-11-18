import { AccountApi } from '@/core/account/accountApi';

import { parseGcCalendars, parseGcStatus } from '../gcal';

describe('Google Calendar answers', () => {
  test('a status is read with safe defaults', () => {
    expect(parseGcStatus({})).toMatchObject({
      configured: false,
      connected: false,
      email: null,
      modes: { dedicated: 'all', primary: 'none' },
      window: { back: 30, forward: 180 },
    });
    const s = parseGcStatus({
      configured: true,
      connected: true,
      email: 'a@b.c',
      modes: { dedicated: 'highest', primary: 'nonsense' },
    });
    expect(s.modes).toEqual({ dedicated: 'highest', primary: 'none' });
  });
  test('the calendar lists keep what the screen needs', () => {
    const c = parseGcCalendars({
      google: [{ ref: 'g1', name: 'Birthdays', can_write: false, entrati: 3, calendar_id: 7 }],
      mine: [
        { id: 7, name: 'Work', color: '#fff', push_ref: 'g2' },
        { id: 8, name: 'Me' },
      ],
    });
    expect(c.google[0]).toMatchObject({ ref: 'g1', canWrite: false, entered: 3, calendarId: 7 });
    expect(c.mine.map((m) => m.pushRef)).toEqual(['g2', '']);
    expect(parseGcCalendars(null)).toEqual({ google: [], mine: [] });
  });
});

describe('AccountApi → Google Calendar', () => {
  const make = (body: unknown) => {
    const fetchFn = jest.fn(
      async () => new Response(JSON.stringify(body), { status: 200 }),
    ) as unknown as typeof fetch;
    return {
      api: new AccountApi('https://site.test/', async () => 'tok', '1', 'ios', fetchFn),
      fetchFn,
    };
  };
  test('it talks to the website file with the app token, and settings go by PATCH', async () => {
    const { api, fetchFn } = make({ ok: true, removed: 4 });
    expect(await api.gcRepair()).toBe(4);
    await api.gcSetModes({ gc_primary: 'high' });
    const calls = (fetchFn as unknown as jest.Mock).mock.calls as [string, RequestInit][];
    expect(calls[0]![0]).toBe('https://site.test/planner/google_calendar.php?ajax=repair');
    expect(calls[0]![1].method).toBe('POST');
    expect((calls[0]![1].headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(calls[1]![0]).toBe('https://site.test/api/v1/planner/settings');
    expect(calls[1]![1].method).toBe('PATCH');
    expect(calls[1]![1].body).toBe('{"gc_primary":"high"}');
    expect(api.gcConnectUrl()).toBe('https://site.test/planner/google_calendar.php?action=connect');
  });
  test('an error answer becomes an error with the server message', async () => {
    const { api } = make({ ok: false, message: 'Not connected', code: 'not_connected' });
    await expect(api.gcSync()).rejects.toThrow('Not connected');
  });
});
