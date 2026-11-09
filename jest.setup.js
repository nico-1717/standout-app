/* global jest */
// expo-audio ha bisogno del modulo nativo, che nei test non c'è: un lettore finto che registra cosa gli si chiede.
jest.mock('expo-audio', () => {
  const player = { play: jest.fn(), pause: jest.fn(), remove: jest.fn() };
  const recorder = {
    uri: 'file:///cache/rec.m4a',
    prepareToRecordAsync: jest.fn(() => Promise.resolve()),
    record: jest.fn(),
    stop: jest.fn(() => Promise.resolve()),
  };
  return {
    __player: player,
    useAudioPlayer: jest.fn(() => player),
    useAudioPlayerStatus: jest.fn(() => ({ didJustFinish: false, playing: false })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
    __recorder: recorder,
    useAudioRecorder: jest.fn(() => recorder),
  };
});

// il selettore di foto e il ridimensionatore hanno bisogno del telefono: finti, con risposte che i test possono cambiare
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })),
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

// la mappa nativa non c'è nei test: una vista semplice che tiene i figli (il segnaposto)
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = (props) => React.createElement(View, { testID: 'native-map' }, props.children);
  const Marker = () => null;
  return { __esModule: true, default: MapView, Marker };
});
