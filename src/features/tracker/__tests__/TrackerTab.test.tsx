import { fireEvent, render, screen } from '@testing-library/react-native';
import { useReducer } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/core/i18n';
import { memoryDb } from '@/core/db/__tests__/testDb';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import type { AiTableFn } from '../ConnectionBlock';
import { TrackerRepo } from '../repo';
import { TrackerTab } from '../TrackerTab';

const P = '11111111-1111-7111-8111-111111111111';

function Harness({ repo, aiTable }: { repo: TrackerRepo; aiTable?: AiTableFn }) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider>
        <TrackerTab repo={repo} project={P} changed={bump} aiTable={aiTable} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
const setup = async (aiTable?: AiTableFn) => {
  const repo = new TrackerRepo(memoryDb());
  await render(<Harness repo={repo} aiTable={aiTable} />);
  return repo;
};

describe('TrackerTab', () => {
  it('parte vuoto e aggiunge un contatore che sale col +', async () => {
    const repo = await setup();
    expect(screen.getByText('Your tracker is empty')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-counter'));
    expect(repo.count(P)).toBe(1);
    await fireEvent.press(screen.getByTestId('tr-counter-plus'));
    await fireEvent.press(screen.getByTestId('tr-counter-plus'));
    expect(screen.getByTestId('tr-counter-value').props.children).toBe('2');
  });

  it('una tabella calcola la formula e il totale della colonna', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-table'));
    for (const [cell, v] of [
      ['A1', '2'],
      ['A2', '3'],
    ] as const) {
      const input = screen.getByTestId(`tr-cell-${cell}`);
      await fireEvent(input, 'focus');
      await fireEvent.changeText(input, v);
      await fireEvent(input, 'blur');
    }
    expect(screen.getByTestId('tr-total-A').props.children).toBe('5');
    const b1 = screen.getByTestId('tr-cell-B1');
    await fireEvent(b1, 'focus');
    await fireEvent.changeText(b1, '=A1*10');
    await fireEvent(b1, 'blur');
    expect(screen.getByTestId('tr-cell-B1').props.value).toBe('20');
  });

  it('Programmazione: i modelli Blind 75 e sfida giornaliera si aggiungono già riempiti', async () => {
    const repo = await setup();
    for (const id of ['blind75', 'streak']) {
      await fireEvent.press(screen.getByTestId('tr-add-block'));
      await fireEvent.press(screen.getByTestId('tr-pick-advanced'));
      await fireEvent.press(screen.getByTestId('tr-pick-programming'));
      await fireEvent.press(screen.getByTestId(`tr-pick-${id}`));
    }
    const [first, second] = repo.blocks(P);
    expect(first?.kind).toBe('checklist');
    expect((first?.data as { items: unknown[] }).items).toHaveLength(75);
    expect(second?.kind).toBe('table');
    expect(first?.title).toBe('Blind 75');
  });

  it('NeetCode: aggiunge un problema da fare, lo registra, e compare fra i risolti', async () => {
    const repo = await setup();
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-advanced'));
    await fireEvent.press(screen.getByTestId('tr-pick-programming'));
    await fireEvent.press(screen.getByTestId('tr-pick-review'));
    expect(screen.getByTestId('nc-sub').props.children).toContain('0');
    await fireEvent.press(screen.getByTestId('nc-tab-todo'));
    await fireEvent.press(screen.getByTestId('nc-todo-1'));
    await fireEvent.press(screen.getByTestId('nc-pattern-Arrays & Hashing'));
    await fireEvent.press(screen.getByTestId('nc-rating-2'));
    await fireEvent.press(screen.getByTestId('nc-save'));
    const data = repo.blocks(P)[0]?.data as { items: Record<string, { rating: number }> };
    expect(data.items['1']?.rating).toBe(2);
    await fireEvent.press(screen.getByTestId('nc-tab-solved'));
    expect(screen.getByTestId('nc-solved-1')).toBeTruthy();
  });

  it("NeetCode: scegli 3 da ripassare e l'esito resta salvato per oggi", async () => {
    const repo = await setup();
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-advanced'));
    await fireEvent.press(screen.getByTestId('tr-pick-programming'));
    await fireEvent.press(screen.getByTestId('tr-pick-review'));
    await fireEvent.press(screen.getByTestId('nc-tab-todo'));
    await fireEvent.press(screen.getByTestId('nc-select'));
    await fireEvent.press(screen.getByTestId('nc-pick-1'));
    await fireEvent.press(screen.getByTestId('nc-add-selected'));
    await fireEvent.press(screen.getByTestId('nc-tab-today'));
    await fireEvent.press(screen.getByTestId('nc-pick-review'));
    const data = repo.blocks(P)[0]?.data as { picks: { review: number[] } | null };
    expect(data.picks?.review).toEqual([1]);
  });

  it('Connection: an address plus pasted data builds a table, and pasting again updates it', async () => {
    const repo = await setup();
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-advanced'));
    await fireEvent.press(screen.getByTestId('tr-pick-connection'));
    await fireEvent(screen.getByTestId('cx-url'), 'endEditing', {
      nativeEvent: { text: 'https://neetcode.io/practice' },
    });
    await fireEvent.changeText(screen.getByTestId('cx-paste'), 'name,n\nTwo Sum,1');
    await fireEvent.press(screen.getByTestId('cx-build'));
    let blocks = repo.blocks(P);
    expect(blocks.map((b) => b.kind)).toEqual(['connection', 'table']);
    expect(blocks[1]?.title).toBe('neetcode.io');
    await fireEvent.changeText(screen.getByTestId('cx-paste'), 'name,n\nTwo Sum,1\nLRU,2');
    await fireEvent.press(screen.getByTestId('cx-build'));
    blocks = repo.blocks(P);
    expect(blocks).toHaveLength(2); // la stessa tabella, aggiornata
    expect((blocks[1]?.config as { rows: number }).rows).toBe(3);
  });

  it('Connection with AI: the pasted page goes to the AI and the table it returns is saved', async () => {
    const aiTable = jest.fn(async () => ({
      cols: 2,
      rows: 2,
      cells: { A1: 'Team', B1: 'Pts', A2: 'Inter', B2: '9' },
    }));
    const repo = await setup(aiTable);
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-advanced'));
    await fireEvent.press(screen.getByTestId('tr-pick-connection'));
    expect(screen.getByTestId('cx-ai').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('cx-paste'), 'Standings Inter 9 points ...');
    await fireEvent.changeText(screen.getByTestId('cx-ai-wish'), 'only the table');
    await fireEvent.press(screen.getByTestId('cx-ai'));
    expect(aiTable).toHaveBeenCalledWith('Standings Inter 9 points ...', 'only the table');
    const blocks = repo.blocks(P);
    expect(blocks.map((b) => b.kind)).toEqual(['connection', 'table']);
    expect((blocks[1]?.data as { cells: Record<string, string> }).cells.A2).toBe('Inter');
  });

  it('Connection with AI: the server message is shown and nothing is created', async () => {
    const aiTable = jest.fn(async () => {
      throw new Error('The AI is busy right now. Try again in a minute.');
    });
    const repo = await setup(aiTable);
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-advanced'));
    await fireEvent.press(screen.getByTestId('tr-pick-connection'));
    await fireEvent.changeText(screen.getByTestId('cx-paste'), 'some page');
    await fireEvent.press(screen.getByTestId('cx-ai'));
    expect(screen.getByTestId('cx-msg').props.children).toContain('busy');
    expect(repo.blocks(P).map((b) => b.kind)).toEqual(['connection']);
  });

  it('Connection: without the AI function there is no AI button', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('tr-add-block'));
    await fireEvent.press(screen.getByTestId('tr-pick-advanced'));
    await fireEvent.press(screen.getByTestId('tr-pick-connection'));
    expect(screen.queryByTestId('cx-ai')).toBeNull();
  });
});
