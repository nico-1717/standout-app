import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Plugin = string | [string, Record<string, unknown>];

const config = JSON.parse(readFileSync(join(__dirname, '../../app.json'), 'utf8')) as {
  expo: { plugins: Plugin[] };
};

const options = (name: string): Record<string, unknown> => {
  const hit = config.expo.plugins.find((p) => Array.isArray(p) && p[0] === name);
  if (!Array.isArray(hit)) throw new Error(`plugin ${name} has no options in app.json`);
  return hit[1];
};

describe('app.json permission texts (Apple rejects a build without them)', () => {
  test('the photo picker never switches the microphone text off: it would delete the one the voice features need', () => {
    // «false» cancels NSMicrophoneUsageDescription for the whole app (build 2 was rejected for this, ITMS-90683)
    expect(typeof options('expo-image-picker').microphonePermission).toBe('string');
  });

  test('every plugin that touches the microphone gives a real sentence', () => {
    for (const name of ['expo-audio', 'expo-speech-recognition', 'expo-image-picker']) {
      const text = String(options(name).microphonePermission);
      expect(text.length).toBeGreaterThan(30);
    }
  });

  test('speech recognition, camera, photos and Face ID have their texts', () => {
    expect(
      String(options('expo-speech-recognition').speechRecognitionPermission).length,
    ).toBeGreaterThan(30);
    expect(String(options('expo-image-picker').cameraPermission).length).toBeGreaterThan(30);
    expect(String(options('expo-image-picker').photosPermission).length).toBeGreaterThan(30);
    expect(String(options('expo-local-authentication').faceIDPermission).length).toBeGreaterThan(
      30,
    );
  });
});
