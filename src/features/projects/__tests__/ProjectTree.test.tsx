import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

import { ProjectPicker } from '../ProjectPicker';
import { ProjectTree } from '../ProjectTree';
import type { Project } from '../logic';

const make = (
  uuid: string,
  name: string,
  parent: string | null,
  rest: Partial<Project> = {},
): Project =>
  ({
    uuid,
    parent_uuid: parent,
    name,
    notes: '',
    status: 'active',
    color: '#FF9500',
    color_edited: 0,
    target_date: null,
    due_date: null,
    todo_enabled: 0,
    is_favorite: 0,
    sort_key: uuid,
    ...rest,
  }) as Project;

// Tesi › Capitolo 1 › Paragrafo A ; Tesi › Capitolo 2 ; Palestra (preferito)
const tree = [
  make('a', 'Tesi', null),
  make('b', 'Capitolo 1', 'a'),
  make('c', 'Paragrafo A', 'b'),
  make('d', 'Capitolo 2', 'a'),
  make('e', 'Palestra', null, { is_favorite: 1 }),
];
const wrap = (el: React.ReactElement) => <ThemeProvider>{el}</ThemeProvider>;

describe('the project selector (as smart as the website one)', () => {
  test('the tree starts closed; the arrow opens a branch', async () => {
    await render(wrap(<ProjectTree projects={tree} value={null} onPick={jest.fn()} />));
    expect(screen.getByTestId('project-pick-a')).toBeTruthy();
    expect(screen.queryByTestId('project-pick-b')).toBeNull();
    await fireEvent.press(screen.getByTestId('project-arrow-a'));
    expect(screen.getByTestId('project-pick-b')).toBeTruthy();
    expect(screen.queryByTestId('project-pick-c')).toBeNull();
  });

  test('it opens already unrolled down to the chosen project, and one level under it', async () => {
    await render(wrap(<ProjectTree projects={tree} value="b" onPick={jest.fn()} />));
    expect(screen.getByTestId('project-pick-b')).toBeTruthy();
    expect(screen.getByTestId('project-pick-c')).toBeTruthy();
    expect(screen.getByTestId('project-pick-d')).toBeTruthy();
  });

  test('favourites come first with their path in small; none can be hidden; extras stay on top', async () => {
    const onPick = jest.fn();
    await render(
      wrap(
        <ProjectPicker
          projects={[...tree, make('f', 'Squat', 'e', { is_favorite: 1 })]}
          value={null}
          extras={[{ id: 'all', label: 'Everything' }]}
          hideNone
          onPick={onPick}
        />,
      ),
    );
    expect(screen.getByText('Everything')).toBeTruthy();
    expect(screen.queryByTestId('project-pick-none')).toBeNull();
    // il preferito compare due volte, in cima e nell'albero; «Squat» ha accanto il suo percorso
    expect(screen.getAllByText('Palestra').length).toBe(3);
    expect(screen.getAllByText('Squat').length).toBe(1);
    await fireEvent.press(screen.getByTestId('project-pick-all'));
    expect(onPick).toHaveBeenCalledWith('all');
  });

  test('search keeps the matches with their parents, and offers to create when nothing matches', async () => {
    const onCreate = jest.fn(() => 'new1');
    const onPick = jest.fn();
    await render(
      wrap(<ProjectTree projects={tree} value={null} onPick={onPick} onCreate={onCreate} />),
    );
    await fireEvent.changeText(screen.getByTestId('project-search'), 'paragrafo');
    expect(screen.getByTestId('project-pick-a')).toBeTruthy();
    expect(screen.getByTestId('project-pick-b')).toBeTruthy();
    expect(screen.getByTestId('project-pick-c')).toBeTruthy();
    expect(screen.queryByTestId('project-pick-d')).toBeNull();
    expect(screen.queryByTestId('project-pick-e')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('project-search'), 'Zumba');
    await fireEvent.press(screen.getByTestId('project-create-from-search'));
    expect(onCreate).toHaveBeenCalledWith('Zumba');
    expect(onPick).toHaveBeenCalledWith('new1');
  });

  test('«New project» asks for a name and picks the new project', async () => {
    const onCreate = jest.fn(() => 'new2');
    const onPick = jest.fn();
    await render(
      wrap(<ProjectPicker projects={tree} value={null} onPick={onPick} onCreate={onCreate} />),
    );
    await fireEvent.press(screen.getByTestId('project-new'));
    await fireEvent.changeText(screen.getByTestId('project-new-name'), '  Nuovo  ');
    await fireEvent.press(screen.getByTestId('project-new-save'));
    expect(onCreate).toHaveBeenCalledWith('Nuovo');
    expect(onPick).toHaveBeenCalledWith('new2');
  });
});
