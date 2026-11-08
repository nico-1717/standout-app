import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { MAX_SIDE, fitSize, pickImage } from '../pickImage';

jest.mock('../phoneFiles', () => ({ keepFile: jest.fn((uri: string) => `kept:${uri}`) }));

const picker = ImagePicker as unknown as {
  requestCameraPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
  launchCameraAsync: jest.Mock;
};
const ctx = (ImageManipulator as unknown as { __ctx: { resize: jest.Mock } }).__ctx;

beforeEach(() => {
  ctx.resize.mockClear();
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
});

describe('fitSize', () => {
  test('shrinks the long side to 1600 and keeps the shape', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  test('never enlarges', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitSize(MAX_SIDE, 10)).toEqual({ width: MAX_SIDE, height: 10 });
  });
  test('bad sizes do not crash', () => {
    expect(fitSize(0, 0).width).toBe(MAX_SIDE);
  });
});

describe('pickImage', () => {
  test('a cancelled pick gives null', async () => {
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await pickImage('library')).toBeNull();
  });

  test('a big photo is resized and kept as a jpeg', async () => {
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///big.heic', width: 4000, height: 3000 }],
    });
    const r = await pickImage('library');
    expect(ctx.resize).toHaveBeenCalledWith({ width: 1600, height: 1200 });
    expect(r).toEqual({ uri: 'kept:file:///cache/resized.jpg', mime: 'image/jpeg' });
  });

  test('a small photo is only converted, not resized', async () => {
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///small.png', width: 800, height: 600 }],
    });
    await pickImage('library');
    expect(ctx.resize).not.toHaveBeenCalled();
  });

  test('the camera needs permission; without it nothing opens', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
    picker.launchCameraAsync.mockClear();
    expect(await pickImage('camera')).toBeNull();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });
});
