/**
 * Configurazione dinamica: parte da app.json e cambia UNA cosa solo per le build di prova.
 * Con STANDOUT_PHONE_ONLY=1 (profilo EAS «development-phone») l'app si dichiara solo-iPhone, così
 * un iPad la mostra in una finestra grande come un iPhone: serve a provare il layout da telefono.
 * Le build vere (production) NON hanno la variabile: l'app resta per iPhone e iPad.
 */
module.exports = ({ config }) => ({
  ...config,
  ios: { ...config.ios, supportsTablet: process.env.STANDOUT_PHONE_ONLY !== '1' },
});
