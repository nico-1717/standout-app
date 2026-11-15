import { pickBaseUrl } from '../baseUrl';

const SITE = 'https://nisama.altervista.org';

describe('pickBaseUrl', () => {
  test('no override: the real site', () => {
    expect(pickBaseUrl(undefined, false)).toBe(SITE);
    expect(pickBaseUrl('  ', true)).toBe(SITE);
  });

  test('https override is accepted, trailing slash removed', () => {
    expect(pickBaseUrl('https://test.example.com/', false)).toBe('https://test.example.com');
  });

  test('plain http is refused in a real build', () => {
    expect(pickBaseUrl('http://192.168.1.5:8099', false)).toBe(SITE);
  });

  test('plain http is allowed only while developing', () => {
    expect(pickBaseUrl('http://192.168.1.5:8099', true)).toBe('http://192.168.1.5:8099');
  });

  test('other schemes are never accepted', () => {
    expect(pickBaseUrl('javascript:alert(1)', true)).toBe(SITE);
    expect(pickBaseUrl('ftp://x.example.com', true)).toBe(SITE);
    expect(pickBaseUrl('http://', true)).toBe(SITE);
  });
});
