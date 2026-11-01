import i18n, { pickLanguage } from '../index';

describe('i18n', () => {
  it('sceglie italiano o inglese', () => {
    expect(pickLanguage('en')).toBe('en');
    expect(pickLanguage('fr')).toBe('it');
    expect(pickLanguage(null)).toBe('it');
  });

  it('traduce con chiavi a punti e segnaposto {nome}', () => {
    expect(i18n.t('comune.salva', { lng: 'en' })).toBe('Save');
    expect(i18n.t('comune.salva', { lng: 'it' })).toBe('Salva');
  });

  it('una chiave mancante si vede: <<chiave>>', () => {
    expect(i18n.t('non.esiste')).toBe('<<non.esiste>>');
  });
});
