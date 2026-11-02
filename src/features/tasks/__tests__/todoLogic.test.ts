import {
  cleanMinutes,
  cleanTime,
  humanDay,
  metaLine,
  nextSaturday,
  quickDates,
} from '../todoLogic';

const W = { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' };
const MON = '2026-11-02'; // lunedì

test('humanDay speaks like a person, like the website', () => {
  expect(humanDay(MON, MON, 'en', W)).toBe('Today');
  expect(humanDay('2026-11-03', MON, 'en', W)).toBe('Tomorrow');
  expect(humanDay('2026-11-01', MON, 'en', W)).toBe('Yesterday');
  expect(humanDay('2026-11-05', MON, 'en', W)).toBe('Thursday'); // 2..6 giorni: il nome del giorno
  expect(humanDay('2026-11-09', MON, 'en', W)).toMatch(/9/); // oltre: giorno e mese
  expect(humanDay('2026-10-20', MON, 'en', W)).toMatch(/20/);
  expect(humanDay('2026-11-05', MON, 'it', W)).toBe('Giovedì');
  expect(humanDay('', MON, 'en', W)).toBe('');
});

test('the weekend shortcut is the next Saturday, never today', () => {
  expect(nextSaturday(MON)).toBe('2026-11-07');
  expect(nextSaturday('2026-11-06')).toBe('2026-11-07'); // venerdì
  expect(nextSaturday('2026-11-07')).toBe('2026-11-14'); // sabato: quello dopo
  expect(nextSaturday('2026-11-08')).toBe('2026-11-14'); // domenica
});

test('five quick dates in the website order', () => {
  expect(quickDates(MON)).toEqual([
    { key: 'oggi', date: MON },
    { key: 'domani', date: '2026-11-03' },
    { key: 'weekend', date: '2026-11-07' },
    { key: 'settimana', date: '2026-11-09' },
    { key: 'senza', date: '' },
  ]);
});

test('the resting line: day, time, and the duration only when it is not 30', () => {
  const t = (due_date: string | null, due_time: string | null, duration_minutes = 30) => ({
    due_date,
    due_time,
    duration_minutes,
  });
  expect(metaLine(t(null, null), MON, 'en', W)).toBe('');
  expect(metaLine(t('2026-11-03', null), MON, 'en', W)).toBe('Tomorrow');
  expect(metaLine(t('2026-11-03', '15:00:00'), MON, 'en', W)).toBe('Tomorrow · 15:00');
  expect(metaLine(t('2026-11-03', '15:00', 45), MON, 'en', W)).toBe('Tomorrow · 15:00 · 45 min');
  // senza ora la durata non si mostra
  expect(metaLine(t('2026-11-03', null, 45), MON, 'en', W)).toBe('Tomorrow');
});

test('cleanMinutes keeps whole minutes between 1 and 1440, otherwise 30', () => {
  expect(cleanMinutes('45')).toBe(45);
  expect(cleanMinutes('')).toBe(30);
  expect(cleanMinutes('0')).toBe(30);
  expect(cleanMinutes('abc')).toBe(30);
  expect(cleanMinutes('99999')).toBe(1440);
  expect(cleanMinutes(7.6)).toBe(8);
});

test('cleanTime accepts HH:MM and rejects the rest', () => {
  expect(cleanTime('9:05')).toBe('09:05');
  expect(cleanTime('23.59')).toBe('23:59');
  expect(cleanTime('24:00')).toBeNull();
  expect(cleanTime('12:60')).toBeNull();
  expect(cleanTime('noon')).toBeNull();
});
