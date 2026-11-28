import { Keyboard } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { KeyDateSheet } from '../KeyDateSheet';
import { PlanDock } from '../PlanDock';

const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <ThemeProvider>{node}</ThemeProvider>
  </SafeAreaProvider>
);

describe('the important date button of the calendar bar', () => {
  it('the bar has a button that asks to add an important date', async () => {
    const onAddDate = jest.fn();
    await render(
      wrap(
        <PlanDock
          tool="paint"
          onTool={() => undefined}
          showEvents
          onEvents={() => undefined}
          onAddDate={onAddDate}
          canUndo={false}
          onUndo={() => undefined}
          onAutoplan={() => undefined}
        />,
      ),
    );
    await fireEvent.press(screen.getByTestId('cal-add-date'));
    expect(onAddDate).toHaveBeenCalledTimes(1);
  });

  it('saves the title, the day and the level, and not before there is a title', async () => {
    const onSave = jest.fn();
    await render(
      wrap(<KeyDateSheet visible today="2026-11-28" onSave={onSave} onClose={() => undefined} />),
    );
    await fireEvent.press(screen.getByTestId('keydate-save'));
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('keydate-title'), '  Maths exam ');
    await fireEvent.press(screen.getByTestId('keydate-level-highest'));
    await fireEvent.press(screen.getByTestId('keydate-save'));
    expect(onSave).toHaveBeenCalledWith({
      title: 'Maths exam',
      date: '2026-11-28',
      level: 'highest',
    });
  });

  it('closes the keyboard when you tap an empty place or scroll', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    await render(
      wrap(
        <KeyDateSheet
          visible
          today="2026-11-28"
          onSave={() => undefined}
          onClose={() => undefined}
        />,
      ),
    );
    expect(screen.getByTestId('keydate-scroll').props.keyboardDismissMode).toBe('on-drag');
    await fireEvent.press(screen.getByTestId('keydate-blank'));
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('edits a saved date and deletes it only after a second tap', async () => {
    const onSave = jest.fn();
    const onDelete = jest.fn();
    await render(
      wrap(
        <KeyDateSheet
          visible
          today="2026-11-28"
          initial={{ title: 'Exam', date: '2026-12-02', level: 'highest' }}
          onSave={onSave}
          onDelete={onDelete}
          onClose={() => undefined}
        />,
      ),
    );
    expect(screen.getByTestId('keydate-title').props.value).toBe('Exam');
    await fireEvent.press(screen.getByTestId('keydate-delete'));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('keydate-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('keydate-save'));
    expect(onSave).toHaveBeenCalledWith({ title: 'Exam', date: '2026-12-02', level: 'highest' });
  });
});
