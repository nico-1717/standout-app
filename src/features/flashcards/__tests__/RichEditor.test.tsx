import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { parseDoc } from '../doc';
import { RichEditor } from '../RichEditor';

const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;
const select = (id: string, start: number, end: number) =>
  fireEvent(screen.getByTestId(id), 'selectionChange', {
    nativeEvent: { selection: { start, end } },
  });

const focusBlock = async (i = 0, id = 'e') => {
  await fireEvent(screen.getByTestId(`${id}-block-${i}`), 'focus');
};
const tab = async (name: string, id = 'e') => {
  await fireEvent.press(screen.getByTestId(`${id}-tab-${name}`));
};
const last = (fn: jest.Mock) => parseDoc(fn.mock.calls.at(-1)![0] as string);

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
    await focusBlock();
    await tab('font');
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
    await focusBlock();
    await tab('font');
    await fireEvent.press(screen.getByTestId('e-c-red'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({
      runs: [{ s: 'all of it', m: { c: 'red' } }],
    });
  });

  test('the colour toggle makes the dots colour the highlighter instead of the text', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="all of it" onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('font');
    await fireEvent.press(screen.getByTestId('e-target-h'));
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

  test('the highlighter dots: yellow, a colour, and the default dot removes it', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="all of it" onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('font');
    // il giallo c'è solo a evidenziatore acceso
    expect(screen.queryByTestId('e-c-yellow')).toBeNull();
    await fireEvent.press(screen.getByTestId('e-target-h'));
    await fireEvent.press(screen.getByTestId('e-c-yellow'));
    expect(last(onChange).blocks[0]).toMatchObject({ runs: [{ s: 'all of it', m: { h: 1 } }] });
    expect(screen.getByTestId('e-c-yellow').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('e-c-default'));
    expect(last(onChange).blocks[0]).toMatchObject({ runs: [{ s: 'all of it' }] });
  });

  test('every colour of the website is there, and gold / teal / pink colour the text', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="word" onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('font');
    for (const c of [
      'red',
      'orange',
      'gold',
      'green',
      'teal',
      'blue',
      'indigo',
      'purple',
      'pink',
      'brown',
      'gray',
    ])
      expect(screen.getByTestId(`e-c-${c}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('e-c-teal'));
    expect(last(onChange).blocks[0]).toMatchObject({ runs: [{ s: 'word', m: { c: 'teal' } }] });
    // il pallino «predefinito» toglie il colore
    await fireEvent.press(screen.getByTestId('e-c-default'));
    expect(last(onChange).blocks[0]).toMatchObject({ runs: [{ s: 'word' }] });
  });

  test('the list tab works in two taps, like the website; the bullet colours live in its own panel', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="item" onChange={onChange} testID="e" />));
    await focusBlock();
    // senza pallino: un tocco lo crea e apre il pannello
    await tab('list');
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'li' });
    expect(screen.getByTestId('e-panel-list')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('e-lc-purple'));
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'li', c: 'purple' });
    await fireEvent.press(screen.getByTestId('e-lc-purple'));
    expect((last(onChange).blocks[0] as { c?: string }).c).toBeUndefined();
    // a pannello aperto, un altro tocco toglie il pallino e chiude
    await tab('list');
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'p' });
    expect(screen.queryByTestId('e-panel-list')).toBeNull();
    // con il pallino già messo e il pannello chiuso, il primo tocco apre solo il pannello
    await tab('list');
    await tab('list');
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'p' });
    await tab('list');
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'li' });
    await tab('font');
    await tab('list');
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'li' });
    expect(screen.getByTestId('e-panel-list')).toBeTruthy();
  });

  test('the toolbar shows only while writing in the field, and the switch folds it to a single button', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="x" onChange={onChange} testID="e" />));
    expect(screen.queryByTestId('e-bar')).toBeNull();
    await focusBlock();
    expect(screen.getByTestId('e-bar')).toBeTruthy();
    expect(screen.getByTestId('e-tab-font')).toBeTruthy();
    expect(screen.getByTestId('e-tab-list')).toBeTruthy();
    expect(screen.getByTestId('e-tab-math')).toBeTruthy();
    expect(screen.getByTestId('e-tab-code')).toBeTruthy();
    expect(screen.getByTestId('e-undo')).toBeTruthy();
    await tab('font');
    expect(screen.getByTestId('e-panel-font')).toBeTruthy();
    // lo stesso tasto richiude il pannello
    await tab('font');
    expect(screen.queryByTestId('e-panel-font')).toBeNull();
    // il tastino: chiusa resta solo lui, con il pallino che dice che sotto c'è altro
    expect(screen.queryByTestId('e-switch-dot')).toBeNull();
    await fireEvent.press(screen.getByTestId('e-switch'));
    expect(screen.queryByTestId('e-tab-font')).toBeNull();
    expect(screen.getByTestId('e-switch-dot')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('e-switch'));
    expect(screen.getByTestId('e-tab-font')).toBeTruthy();
  });

  test('the bar goes away when the field loses focus for real, but not when the bar is touched', async () => {
    jest.useFakeTimers();
    try {
      const onChange = jest.fn();
      await render(wrap(<RichEditor value="x" onChange={onChange} testID="e" />));
      await focusBlock();
      await fireEvent(screen.getByTestId('e-bar'), 'touchStart');
      await fireEvent(screen.getByTestId('e-block-0'), 'blur');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByTestId('e-bar')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await fireEvent(screen.getByTestId('e-block-0'), 'blur');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.queryByTestId('e-bar')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('undo brings back the last change; typing in one go is a single step', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="one two" onChange={onChange} testID="e" />));
    await focusBlock();
    expect(screen.getByTestId('e-undo').props.accessibilityState.disabled).toBe(true);
    await tab('font');
    await select('e-block-0', 0, 3);
    await fireEvent.press(screen.getByTestId('e-b'));
    expect(screen.getByTestId('e-undo').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('e-i'));
    expect(last(onChange).blocks[0]).toMatchObject({
      runs: [{ m: { b: 1, i: 1 } }, { s: ' two' }],
    });
    await fireEvent.press(screen.getByTestId('e-undo'));
    expect(last(onChange).blocks[0]).toMatchObject({
      runs: [{ s: 'one', m: { b: 1 } }, { s: ' two' }],
    });
    await fireEvent.press(screen.getByTestId('e-undo'));
    expect(last(onChange).blocks[0]).toMatchObject({ runs: [{ s: 'one two' }] });
    expect(screen.getByTestId('e-undo').props.accessibilityState.disabled).toBe(true);
    // scritto di fila: un solo passo
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'one twoa');
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'one twoab');
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'one twoabc');
    await fireEvent.press(screen.getByTestId('e-undo'));
    expect(last(onChange).blocks[0]).toMatchObject({ runs: [{ s: 'one two' }] });
    expect(screen.getByTestId('e-undo').props.accessibilityState.disabled).toBe(true);
  });

  test('the soft break puts a line break inside the same list point', async () => {
    const onChange = jest.fn();
    const li = JSON.stringify({ v: 2, blocks: [{ t: 'li', lvl: 1, runs: [{ s: 'abcd' }] }] });
    await render(wrap(<RichEditor value={li} onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('list');
    await select('e-block-0', 2, 2);
    await fireEvent.press(screen.getByTestId('e-softbreak'));
    const d = last(onChange);
    expect(d.blocks).toHaveLength(1);
    expect(d.blocks[0]).toMatchObject({ t: 'li', runs: [{ s: 'ab\ncd' }] });
    // il capo già dentro non spezza il blocco quando si scrive dell'altro
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'ab\ncdX');
    expect(last(onChange).blocks).toHaveLength(1);
    // un a capo nuovo, invece, lo spezza dove è stato scritto
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'ab\n\ncdX');
    expect(last(onChange).blocks).toHaveLength(2);
  });

  test('pasting several lines makes a block for each', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value={null} onChange={onChange} testID="e" />));
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'a\nb\nc');
    expect(last(onChange).blocks.map((b) => (b as { runs: { s: string }[] }).runs[0]?.s)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  test('the code panel: block button, line highlight, and a language turns a line into code', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="x = 1" onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('code');
    expect(screen.getByTestId('e-code').props.accessibilityState.selected).toBe(false);
    // la riga evidenziata c'è solo su una riga di codice
    await fireEvent.press(screen.getByTestId('e-codehl'));
    expect(onChange).not.toHaveBeenCalled();
    // scegliere una lingua trasforma la riga in codice
    await fireEvent.press(screen.getByTestId('e-lang-cpp'));
    expect(last(onChange).blocks[0]).toMatchObject({ code: 'cpp' });
    expect(screen.getByTestId('e-lang-cpp').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('e-codehl'));
    expect(last(onChange).blocks[0]).toMatchObject({ code: 'cpp', hl: 1 });
    expect(screen.getByTestId('e-codehl').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('e-codehl'));
    expect(last(onChange).blocks[0]).not.toHaveProperty('hl');
    // il tasto «blocco di codice» lo toglie
    await fireEvent.press(screen.getByTestId('e-code'));
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'p' });
    expect(last(onChange).blocks[0]).not.toHaveProperty('code');
  });

  test('the formula panel: inline, block, and the two switches', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="area a b" onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('math');
    await select('e-block-0', 5, 6);
    await fireEvent.press(screen.getByTestId('e-mathinline'));
    expect(last(onChange).blocks[0]).toMatchObject({
      runs: [{ s: 'area ' }, { x: 'a' }, { s: ' b' }],
    });
    // il tasto «a blocco» fa dell'intera riga una formula
    await fireEvent.press(screen.getByTestId('e-mathblock'));
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'fx' });
    expect(screen.getByTestId('e-mathblock').props.accessibilityState.selected).toBe(true);
    // spenti per difetto
    expect(screen.getByTestId('e-dollars').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('e-smart').props.accessibilityState.selected).toBe(false);
    await fireEvent.press(screen.getByTestId('e-dollars'));
    expect(screen.getByTestId('e-dollars').props.accessibilityState.selected).toBe(true);
  });

  test('with the dollar switch on, typing $...$ makes an inline formula; off, the dollars stay', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value={null} onChange={onChange} testID="e" />));
    await focusBlock();
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'costs $5$ ok');
    expect(last(onChange).blocks[0]).toMatchObject({ runs: [{ s: 'costs $5$ ok' }] });
    await fireEvent.changeText(screen.getByTestId('e-block-0'), '');
    await tab('math');
    await fireEvent.press(screen.getByTestId('e-dollars'));
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'let $x^2$ be');
    expect(last(onChange).blocks[0]).toMatchObject({
      runs: [{ s: 'let ' }, { x: 'x^2' }, { s: ' be' }],
    });
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'let x^2 be\n');
    await fireEvent.changeText(screen.getByTestId('e-block-1'), '$$a+b$$');
    expect(last(onChange).blocks[1]).toMatchObject({ t: 'fx', tex: 'a+b' });
  });

  test('with the smart switch on, a LaTeX word becomes a formula when you press space', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value={null} onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('math');
    await fireEvent.press(screen.getByTestId('e-smart'));
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'the angle \\omega ');
    expect(last(onChange).blocks[0]).toMatchObject({
      runs: [{ s: 'the angle ' }, { x: '\\omega' }],
    });
    // da sola sulla riga diventa una formula a blocco
    await fireEvent.changeText(screen.getByTestId('e-block-0'), 'a^2 ');
    expect(last(onChange).blocks[0]).toMatchObject({ t: 'fx', tex: 'a^2' });
  });

  test('clear formatting removes the marks of the selection', async () => {
    const onChange = jest.fn();
    await render(wrap(<RichEditor value="one two" onChange={onChange} testID="e" />));
    await focusBlock();
    await tab('font');
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
    await focusBlock();
    expect(screen.queryByTestId('e-lang-python')).toBeNull();
    await tab('code');
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
    await tab('font');
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
    await focusBlock();
    await tab('list');
    await fireEvent.press(screen.getByTestId('e-in'));
    expect(parseDoc(onChange.mock.calls.at(-1)![0] as string).blocks[0]).toMatchObject({ lvl: 2 });
  });
});
