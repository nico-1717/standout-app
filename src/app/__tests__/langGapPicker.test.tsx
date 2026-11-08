import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { ExamplesBlock } from '@/features/languages/ExamplesBlock';
import { LanguagesRepo } from '@/features/languages/repo';
import { ProjectsRepo } from '@/features/projects/repo';

jest.mock('@/core/speech/speak', () => ({ speak: jest.fn(), stopSpeaking: jest.fn() }));

function setup(text: string, word = 'house') {
  const db = memoryDb();
  migrate(db);
  const languages = new LanguagesRepo(db, 7, new ProjectsRepo(db));
  const course = languages.addCourse('fr', 'en-GB', 'en') as string;
  const deck = languages.createDeck(course, { name: 'Home' })!;
  const target = languages.addWord(deck, { word, translation: 'maison' })!;
  const ex = languages.addExample(target, false, text)!;
  return { languages, target, ex };
}

function Host({ repo, target, word }: { repo: LanguagesRepo; target: string; word: string }) {
  const [, setN] = useState(0);
  return (
    <ThemeProvider>
      <ExamplesBlock
        repo={repo}
        target={target}
        word={word}
        isChild={false}
        tag="t"
        onChange={() => setN((n) => n + 1)}
      />
    </ThemeProvider>
  );
}

describe('example hidden part', () => {
  test('shows what the game hides by itself, marked as automatic', async () => {
    const { languages, target, ex } = setup('The house is big');
    await render(<Host repo={languages} target={target} word="house" />);
    expect(screen.getByTestId(`t-hidden-${ex}`)).toHaveTextContent('house (auto)');
  });

  test('picking words by hand saves them; Automatic puts the default back', async () => {
    const { languages, target, ex } = setup('The house is big');
    await render(<Host repo={languages} target={target} word="house" />);
    await fireEvent.press(screen.getByTestId(`t-gap-edit-${ex}`));
    const p = `t-gap-${ex}`;
    // keys: The(0) house(1) is(2) big(3). The automatic choice (house) is on: add "is big", drop "house".
    await fireEvent.press(screen.getByTestId(`${p}-key-1`));
    await fireEvent.press(screen.getByTestId(`${p}-key-2`));
    await fireEvent.press(screen.getByTestId(`${p}-key-3`));
    await fireEvent.press(screen.getByTestId(`${p}-done`));
    expect(languages.examples(target)[0]!.gap_text).toBe('is big');
    expect(screen.getByTestId(`t-hidden-${ex}`)).toHaveTextContent('is big');

    await fireEvent.press(screen.getByTestId(`t-gap-edit-${ex}`));
    await fireEvent.press(screen.getByTestId(`${p}-auto`));
    await fireEvent.press(screen.getByTestId(`${p}-done`));
    expect(languages.examples(target)[0]!.gap_text).toBeNull();
  });

  test('two separate pieces are kept as pieces; cancel changes nothing', async () => {
    const { languages, target, ex } = setup('I want you to come', 'know');
    await render(<Host repo={languages} target={target} word="know" />);
    expect(screen.getByTestId(`t-hidden-${ex}`)).toHaveTextContent('—');
    await fireEvent.press(screen.getByTestId(`t-gap-edit-${ex}`));
    const p = `t-gap-${ex}`;
    for (const k of [0, 1, 3]) await fireEvent.press(screen.getByTestId(`${p}-key-${k}`));
    await fireEvent.press(screen.getByTestId(`${p}-done`));
    expect(languages.examples(target)[0]!.gap_text).toBe('[[0,"I want"],[11,"to"]]');
    expect(screen.getByTestId(`t-hidden-${ex}`)).toHaveTextContent('I want … to');

    await fireEvent.press(screen.getByTestId(`t-gap-edit-${ex}`));
    await fireEvent.press(screen.getByTestId(`${p}-clear`));
    await fireEvent.press(screen.getByTestId(`${p}-cancel`));
    expect(languages.examples(target)[0]!.gap_text).toBe('[[0,"I want"],[11,"to"]]');
  });
});

describe('example listen button', () => {
  test('reads the sentence in the studied language, with the dashes filled by the word', async () => {
    const speak = jest.requireMock('@/core/speech/speak').speak as jest.Mock;
    const { languages, target, ex } = setup('___ is big');
    await render(
      <ThemeProvider>
        <ExamplesBlock
          repo={languages}
          target={target}
          word="house"
          voice="en-GB"
          isChild={false}
          tag="t"
          onChange={() => undefined}
        />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByTestId(`t-ex-speak-${ex}`));
    expect(speak).toHaveBeenCalledWith(
      'house is big',
      'en-GB',
      expect.objectContaining({ once: true }),
    );
  });
});
