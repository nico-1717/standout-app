/* global jest */
// expo-audio ha bisogno del modulo nativo, che nei test non c'è: un lettore finto che registra cosa gli si chiede.
jest.mock('expo-audio', () => {
  const player = { play: jest.fn(), pause: jest.fn(), remove: jest.fn() };
  return {
    __player: player,
    useAudioPlayer: jest.fn(() => player),
    useAudioPlayerStatus: jest.fn(() => ({ didJustFinish: false, playing: false })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  };
});

// il selettore di foto e il ridimensionatore hanno bisogno del telefono: finti, con risposte che i test possono cambiare
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })),
}));
jest.mock('expo-image-manipulator', () => {
  const ctx = {
    resize: jest.fn(),
    renderAsync: jest.fn(() =>
      Promise.resolve({
        saveAsync: jest.fn(() =>
          Promise.resolve({ uri: 'file:///cache/resized.jpg', width: 1600, height: 1200 }),
        ),
      }),
    ),
  };
  return {
    __ctx: ctx,
    ImageManipulator: { manipulate: jest.fn(() => ctx) },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  };
});
