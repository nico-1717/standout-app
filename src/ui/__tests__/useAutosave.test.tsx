import { act, render } from '@testing-library/react-native';

import { useAutosave } from '../useAutosave';

function Probe({ value, save }: { value: string | null; save: (t: string) => void }) {
  useAutosave(value, save, 600);
  return null;
}

describe('useAutosave', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('saves 600 ms after the last change, once', async () => {
    const save = jest.fn();
    const view = await render(<Probe value={null} save={save} />);
    await view.rerender(<Probe value="a" save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await view.rerender(<Probe value="ab" save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('ab');
  });

  test('does nothing when there is nothing to save', async () => {
    const save = jest.fn();
    await render(<Probe value={null} save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
  });

  test('saves at once when the screen closes with unsaved text', async () => {
    const save = jest.fn();
    const view = await render(<Probe value="draft" save={save} />);
    await view.unmount();
    expect(save).toHaveBeenCalledWith('draft');
  });

  test('a manual save that clears the value cancels the scheduled one', async () => {
    const save = jest.fn();
    const view = await render(<Probe value="x" save={save} />);
    await view.rerender(<Probe value={null} save={save} />);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await view.unmount();
    expect(save).not.toHaveBeenCalled();
  });
});
