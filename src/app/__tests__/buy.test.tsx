import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { MediaQueue } from '@/core/media/mediaQueue';
import { FakeEngine } from '@/core/speech/__tests__/fakeEngine';
import { phoneEngine } from '@/core/speech/recognizer';
import { pickImage } from '@/core/media/pickImage';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { CategoriesRepo } from '@/features/buy/categoriesRepo';
import { TasksRepo } from '@/features/tasks/repo';

import BuyScreen from '../(tabs)/buy';

jest.mock('@/core/media/pickImage', () => ({ pickImage: jest.fn() }));

// il microfono è finto: si "dice" una frase dal test
jest.mock('@/core/speech/recognizer', () => {
  const { FakeEngine: Fake } = jest.requireActual('@/core/speech/__tests__/fakeEngine');
  return { ...jest.requireActual('@/core/speech/recognizer'), phoneEngine: new Fake() };
});
const mockEngine = phoneEngine as unknown as FakeEngine;

let mockStyle: 'standard' | 'paper' = 'standard';
let mockServices: unknown;
const mockChanged = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/core/app/AppProvider', () => ({
  useApp: () => ({
    services: mockServices,
    version: 0,
    changed: mockChanged,
    uiStyle: mockStyle,
    syncInfo: { status: 'idle', lastSyncAt: null, pending: 0 },
  }),
}));

function setup() {
  const db = memoryDb();
  migrate(db);
  const categories = new CategoriesRepo(db);
  const tasks = new TasksRepo(db);
  const spesa = categories.create('spesa', '#E8B86B');
  tasks.create(
    { title: 'Oat milk', buy_category_uuid: spesa, buy_price_cents: 189, buy_priority: 2 },
    { listType: 'buy' },
  );
  tasks.create({ title: 'Phone case', buy_price_cents: 1290 }, { listType: 'buy' });
  const done = tasks.create({ title: 'Bread' }, { listType: 'buy' });
  tasks.update(done, { is_done: true });
  const media = new MediaQueue(
    db,
    { put: async () => ({ name: 'x.jpg' }), remove: async () => undefined },
    { delete: () => undefined },
  );
  const privateImages = { get: jest.fn(() => Promise.resolve(null)) };
  mockServices = {
    db,
    tasks,
    categories,
    media,
    privateImages,
    scheduler: { trigger: jest.fn() },
  };
  return { tasks, categories, db };
}

const renderIt = () =>
  render(
    <ThemeProvider>
      <BuyScreen />
    </ThemeProvider>,
  );

describe.each(['standard', 'paper'] as const)('To buy screen (%s)', (style) => {
  beforeEach(() => {
    mockStyle = style;
    mockChanged.mockClear();
  });

  test('shows groups, totals and the cart', async () => {
    setup();
    await renderIt();
    expect(screen.getByDisplayValue('Oat milk')).toBeTruthy();
    expect(screen.getByDisplayValue('Phone case')).toBeTruthy();
    expect(screen.getByText(/spesa/i)).toBeTruthy();
    expect(screen.getAllByText(/€/, { exact: false }).length).toBeGreaterThan(0);
  });

  test('quick add reads price, #category and priority', async () => {
    const { tasks, categories } = setup();
    await renderIt();
    const input = screen.getByPlaceholderText(/milk 1\.20/i);
    await fireEvent.changeText(input, 'Dish soap 2,50 #spesa !1');
    await fireEvent(input, 'submitEditing');
    const added = tasks.list('buy').find((t) => t.title === 'Dish soap')!;
    expect(added).toMatchObject({
      buy_price_cents: 250,
      buy_priority: 1,
      buy_category_uuid: categories.list()[0]!.uuid,
    });
    expect(mockChanged).toHaveBeenCalled();
  });

  test('the microphone fills the bar while you speak and adds one item when you stop', async () => {
    const { tasks, categories } = setup();
    mockEngine.starts.length = 0;
    await renderIt();
    await fireEvent.press(screen.getByTestId('buy-mic'));
    await act(async () => undefined);
    expect(mockEngine.starts).toHaveLength(1);
    await act(async () => mockEngine.say(['dish soap 2,50 hash'], false));
    expect(screen.getByDisplayValue('dish soap 2,50 hash')).toBeTruthy();
    await act(async () => mockEngine.say(['dish soap 2,50'], true));
    await act(async () => mockEngine.finish()); // la frase è finita: una sola, quindi l'ascolto si chiude
    const added = tasks.list('buy').find((t) => t.title === 'dish soap')!;
    expect(added).toMatchObject({ buy_price_cents: 250 });
    expect(categories.list().length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue('dish soap 2,50')).toBeNull(); // la barra si svuota
    expect(mockChanged).toHaveBeenCalled();
  });

  test('without permission the microphone says dictation is not available and adds nothing', async () => {
    const { tasks } = setup();
    mockEngine.granted = false;
    const before = tasks.list('buy').length;
    await renderIt();
    await fireEvent.press(screen.getByTestId('buy-mic'));
    await act(async () => undefined);
    expect(screen.getByTestId('buy-mic-error')).toBeTruthy();
    expect(tasks.list('buy')).toHaveLength(before);
    mockEngine.granted = true;
  });

  test('a new #category is created on the fly', async () => {
    const { tasks, categories } = setup();
    await renderIt();
    const input = screen.getByPlaceholderText(/milk 1\.20/i);
    await fireEvent.changeText(input, 'headphones #gifts');
    await fireEvent(input, 'submitEditing');
    expect(categories.list().map((c) => c.name)).toContain('gifts');
    expect(
      tasks.list('buy').find((t) => t.title === 'headphones')!.buy_category_uuid,
    ).not.toBeNull();
  });

  test('a photo for an item goes to the upload queue from the details', async () => {
    const { tasks, db } = setup();
    (pickImage as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///docs/milk.jpg',
      mime: 'image/jpeg',
    });
    await renderIt();
    await fireEvent.press(screen.getAllByLabelText('Details')[0]!);
    const milk = tasks.list('buy').find((x) => x.title === 'Oat milk')!;
    await fireEvent.press(screen.getByTestId(`buy-img-${milk.uuid}-library`));
    expect(db.all('SELECT tbl, row_uuid, slot, op FROM media_queue')).toEqual([
      { tbl: 'todos', row_uuid: milk.uuid, slot: 'buy_image', op: 'put' },
    ]);
  });
});
