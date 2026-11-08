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
