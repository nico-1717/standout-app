import { fireEvent, render, screen } from '@testing-library/react-native';

import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import '@/core/i18n';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { CategoriesRepo } from '@/features/buy/categoriesRepo';
import { TasksRepo } from '@/features/tasks/repo';

import BuyScreen from '../(tabs)/buy';

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
  mockServices = { db, tasks, categories, scheduler: { trigger: jest.fn() } };
  return { tasks, categories };
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
});
