import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { parseDoc } from '../doc';
import { RichEditor } from '../RichEditor';

const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;
const select = (id: string, start: number, end: number) =>
  fireEvent(screen.getByTestId(id), 'selectionChange', {
    nativeEvent: { selection: { start, end } },
  });

describe('RichEditor', () => {
  test('typing reports the field; empty reports null', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value={null} onChange={onChange} testID="e" />));
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'Hello');
    const field = onChange.mock.calls.at(-1)![0] as string;
    expect(parseDoc(field).blocks[0]).toMatchObject({ t: 'p', runs: [{ s: 'Hello' }] });
    await fireEvent.changeText(screen.getByTestId('e-block-0'), '');
    expect(onChange.mock.calls.at(-1)![0]).toBeNull();
  });

  test('bold on a selection, and the button shows it is on', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="one two" onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-0'), 'focus');
    await select('e-block-0', 4, 7);
    await fireEvent.press(screen.getByTestId('e-b'));
    const runs = (
      parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0] as { runs: unknown[] }
    ).runs;
    expect(runs).toEqual([{ s: 'one ' }, { s: 'two', m: { b: 1 } }]);
    expect(screen.getByTestId('e-b').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('e-i').props.accessibilityState.selected).toBe(false);
  });

  test('without a selection, a colour applies to the whole block', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="all of it" onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-0'), 'focus');
    await fireEvent.press(screen.getByTestId('e-c-red'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({
      runs: [{ s: 'all of it', m: { c: 'red' } }],
    });
  });

  test('the colour toggle makes the dots colour the highlighter instead of the text', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="all of it" onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-0'), 'focus');
    await fireEvent.press(screen.getByTestId('e-target'));
    await fireEvent.press(screen.getByTestId('e-c-green'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({
      runs: [{ s: 'all of it', m: { h: 'green' } }],
    });
    expect(screen.getByTestId('e-c-green').props.accessibilityState.selected).toBe(true);
    // lo stesso pallino di nuovo: torna il giallo
    await fireEvent.press(screen.getByTestId('e-c-green'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({
      runs: [{ s: 'all of it', m: { h: 1 } }],
    });
  });

  test('on a list line the toggle also reaches the bullet colour', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="item" onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-0'), 'focus');
    // fuori da un elenco il secondo tocco torna al testo
    await fireEvent.press(screen.getByTestId('e-target'));
    await fireEvent.press(screen.getByTestId('e-target'));
    await fireEvent.press(screen.getByTestId('e-li'));
    await fireEvent.press(screen.getByTestId('e-target'));
    await fireEvent.press(screen.getByTestId('e-target'));
    await fireEvent.press(screen.getByTestId('e-c-purple'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({
      t: 'li',
      c: 'purple',
    });
    await fireEvent.press(screen.getByTestId('e-c-purple'));
    expect(
      (parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0] as { c?: string }).c,
    ).toBeUndefined();
  });

  test('clear formatting removes the marks of the selection', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="one two" onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-0'), 'focus');
    await select('e-block-0', 0, 7);
    await fireEvent.press(screen.getByTestId('e-b'));
    await fireEvent.press(screen.getByTestId('e-clear'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({
      runs: [{ s: 'one two' }],
    });
  });

  test('a code block shows the language chips and changes the language', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="x = 1" onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-0'), 'focus');
    expect(screen.queryByTestId('e-lang-python')).toBeNull();
    await fireEvent.press(screen.getByTestId('e-code'));
    expect(screen.getByTestId('e-lang-python').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('e-lang-sql'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({
      code: 'sql',
    });
    expect(screen.getByTestId('e-lang-sql').props.accessibilityState.selected).toBe(true);
  });

  test('a new line splits the block; the list button makes it a list; the checkbox toggles', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value={null} onChange={onChange} testID="e" />));
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'first\nsecond');
    const d = parseDoc(onChange.mock.calls.at(-1)![0] as string);
    expect(d.blocks).toHaveLength(2);
    expect(screen.getByTestId('e-block-1')).toBeTruthy();
    await fireEvent(screen.getByTestId('e-block-1'), 'focus');
    await fireEvent.press(screen.getByTestId('e-ck'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[1]).toMatchObject({
      t: 'li',
      ck: 0,
    });
    await fireEvent.press(screen.getByTestId('e-check-1'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[1]).toMatchObject({ ck: 1 });
    // premendo di nuovo il tasto, torna un paragrafo
    await fireEvent.press(screen.getByTestId('e-ck'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[1]).toMatchObject({ t: 'p' });
  });

  test('backspace at the start of the second block merges it into the first', async () => {
    const onChange = jest.fn();
    const two = JSON.stringify({
      v: 2,
      blocks: [
        { t: 'p', runs: [{ s: 'ab' }] },
        { t: 'p', runs: [{ s: 'cd' }] },
      ],
    });
    await render(wrap(<RichEditor value={two} onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-1'), 'focus');
    await select('e-block-1', 0, 0);
    await fireEvent(screen.getByTestId('e-block-1'), 'keyPress', {
      nativeEvent: { key: 'Backspace' },
    });
    const d = parseDoc(onChange.mock.calls.at(-1)![0] as string);
    expect(d.blocks).toHaveLength(1);
    expect(d.blocks[0]).toMatchObject({ runs: [{ s: 'abcd' }] });
  });

  test('indent buttons change the list level', async () => {
    const onChange = jest.fn();
    const li = JSON.stringify({ v: 2, blocks: [{ t: 'li', lvl: 1, runs: [{ s: 'x' }] }] });
    await render(wrap(<RichEditor value={li} onChange={onChange} testID="e" />));
    await fireEvent(screen.getByTestId('e-block-0'), 'focus');
    await fireEvent.press(screen.getByTestId('e-in'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({ lvl: 2 });
  });
});
