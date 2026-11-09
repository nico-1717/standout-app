/**
 * Configurazione dinamica: parte da app.json e cambia due cose.
 * 1. Con STANDOUT_PHONE_ONLY=1 (profilo EAS «development-phone») l'app si dichiara solo-iPhone, così
 *    un iPad la mostra in una finestra grande come un iPhone: serve a provare il layout da telefono.
 *    Le build vere (production) NON hanno la variabile: l'app resta per iPhone e iPad.
 * 2. Su Android la mappa è Google Maps e vuole una chiave: arriva da GOOGLE_MAPS_ANDROID_KEY (un segreto di EAS,
 *    mai nel codice). Senza chiave la build parte lo stesso, ma la mappa resta grigia. Su iPhone è Apple Mappe:
 *    nessuna chiave.
 */
module.exports = ({ config }) => ({
  ...config,
  ios: { ...config.ios, supportsTablet: process.env.STANDOUT_PHONE_ONLY !== '1' },
  android: {
    ...config.android,
    config: {
      ...(config.android && config.android.config),
      ...(process.env.GOOGLE_MAPS_ANDROID_KEY
        ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } }
        : {}),
    },
  },
});
