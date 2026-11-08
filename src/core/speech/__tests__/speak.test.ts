import { pickVoice, type VoiceInfo } from '../speak';

jest.mock('expo-speech', () => ({}));

const v = (name: string, language: string, quality = 'Default'): VoiceInfo => ({
  identifier: name,
  name,
  language,
  quality,
});

describe('pickVoice', () => {
  test('prefers the exact language, then quality voices, never robotic ones', () => {
    const voices = [
      v('Eloquence Eddy', 'en-GB'),
      v('Reed', 'en-GB'),
      v('Plain US', 'en-US'),
      v('Plain GB', 'en-GB'),
      v('Fancy GB Enhanced', 'en-GB', 'Enhanced'),
    ];
    expect(pickVoice(voices, 'en-GB')?.name).toBe('Fancy GB Enhanced');
    expect(
      pickVoice(
        voices.filter((x) => x.name !== 'Fancy GB Enhanced'),
        'en_GB',
      )?.name,
    ).toBe('Plain GB');
  });

  test('falls back to another variant of the same language, and null when none', () => {
    expect(pickVoice([v('Plain US', 'en-US')], 'en-GB')?.name).toBe('Plain US');
    expect(pickVoice([v('Eloquence X', 'fr-FR')], 'fr-FR')).toBeNull();
    expect(pickVoice([], 'de-DE')).toBeNull();
    expect(pickVoice([v('Google Deutsch', 'de-DE'), v('Anna', 'de-DE')], 'de-DE')?.name).toBe(
      'Google Deutsch',
    );
  });
});
