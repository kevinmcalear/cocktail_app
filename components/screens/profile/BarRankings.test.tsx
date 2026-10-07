import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { BarTopDrink } from '@/lib/barTopDrinks';

import { BarRankings } from './BarRankings';

const mockPush = jest.fn();
let mockUser: { id: string } | null = { id: 'me' };
let mockRows: BarTopDrink[] = [];

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/hooks/useRankings', () => ({ useBarTopDrinks: () => ({ data: mockRows, isLoading: false, error: null }) }));
jest.mock('../safety/AgeGate', () => ({ useAgeGate: () => ({ gate: (go: () => void) => go(), sheet: null }) }));
jest.mock('../rank/RankActions', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { RankFlow: ({ item, atBar }: { item: { name: string }; atBar: { display_name: string } }) => <Text>{`Ranking ${item.name} at ${atBar.display_name}`}</Text> };
});

const bar = { id: 'p1', display_name: 'Little Rye', locality: 'Fitzroy', city: 'Melbourne', country_code: 'AU', is_closed: false };
const row = (over: Partial<BarTopDrink> & { item_id: string; name: string }): BarTopDrink => ({
  position: null,
  bar_id: null,
  ranked_as_item_id: over.item_id,
  ranked_as_name: null,
  image_url: 'https://example.test/drink.jpg',
  image_is_generated: false,
  score: null,
  rankers: 0,
  menu: null,
  ...over,
});

const gimlet = row({ item_id: 'a', name: 'House Gimlet', bar_id: 'b1', ranked_as_name: 'Gimlet', position: 1, score: 8.4, rankers: 22, menu: 'current' });
const early = row({ item_id: 'b', name: 'Early Bird', rankers: 3 });
const fresh = row({ item_id: 'c', name: 'Old Flame', menu: 'past' });

beforeEach(() => {
  mockPush.mockClear();
  mockUser = { id: 'me' };
  mockRows = [];
});

test('scored drinks first with their score, then early ones and ones nobody has ranked', async () => {
  mockRows = [gimlet, early, fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  expect(screen.getByText('8.4')).toBeTruthy();
  expect(screen.getByText('Gimlet · 22 people ranked')).toBeTruthy();
  expect(screen.getByText('On the menu')).toBeTruthy();
  expect(screen.getByText('Early')).toBeTruthy();
  expect(screen.getByText('3 people ranked')).toBeTruthy();
  expect(screen.getByText('Not ranked yet')).toBeTruthy();
  expect(screen.getByText('Past menu')).toBeTruthy();
  expect(screen.queryByText('No scores here yet')).toBeNull();

  await fireEvent.press(screen.getByLabelText('Number 1: House Gimlet, a Gimlet. Score 8.4, 22 people ranked. On the menu. Open'));
  expect(mockPush).toHaveBeenCalledWith('/d/a');
});

test('no scores yet: invites people to rank, and lists what they can rank', async () => {
  mockRows = [early, fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  expect(screen.getByText('No scores here yet')).toBeTruthy();
  expect(screen.getByText('Ranked so far')).toBeTruthy();
  expect(screen.getByText('Old Flame')).toBeTruthy();
});

test('nobody has ranked anything: asks to be the first', async () => {
  mockRows = [fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  expect(screen.getByText('Be the first to rank a drink here')).toBeTruthy();
});

test('Rank opens the comparison sheet at this bar; signed out, it asks you to sign in', async () => {
  mockRows = [gimlet, fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  await fireEvent.press(screen.getAllByLabelText('Rank')[1]);
  expect(screen.getByText('Ranking Old Flame at Little Rye')).toBeTruthy();

  mockUser = null;
  await renderWithTamagui(<BarRankings bar={bar} />);
  expect(screen.getByText('Had one of these here? Sign in to rank it.')).toBeTruthy();
  await fireEvent.press(screen.getAllByLabelText('Rank')[0]);
  expect(mockPush).toHaveBeenCalledWith('/auth/login');
});
