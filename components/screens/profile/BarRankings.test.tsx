import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { BarTopDrink } from '@/lib/barTopDrinks';

import { BarRankings } from './BarRankings';

const mockPush = jest.fn();
let mockUser: { id: string } | null = { id: 'me' };
let mockRows: BarTopDrink[] = [];

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: mockUser })));
jest.mock('@/hooks/useRankings', () => ({ useBarTopDrinks: () => ({ data: mockRows, isLoading: false, error: null }) }));
jest.mock('../safety/AgeGate', () => ({ useAgeGate: () => ({ gate: (go: () => void) => go(), sheet: null }) }));
jest.mock('./RankPickSheet', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    RankPickSheet: ({ visible, drinks, onPick, onDismiss }: { visible: boolean; drinks: { name: string }[]; onPick: (d: unknown) => void; onDismiss?: () => void }) =>
      visible
        ? drinks.map((d) => (
            <Text
              key={d.name}
              onPress={() => {
                onPick(d);
                onDismiss?.();
              }}
            >{`Pick ${d.name}`}</Text>
          ))
        : null,
  };
});
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
  menu_from: null,
  menu_to: null,
  ...over,
});

const gimlet = row({ item_id: 'a', name: 'House Gimlet', bar_id: 'b1', ranked_as_name: 'Gimlet', position: 1, score: 8.4, rankers: 64, menu: 'current', menu_from: 2026, menu_to: 2026 });
const early = row({ item_id: 'b', name: 'Early Bird', rankers: 3, menu: 'past', menu_from: 2024, menu_to: 2025 });
const fresh = row({ item_id: 'c', name: 'Old Flame', menu: 'past', menu_from: 2019, menu_to: 2019 });

beforeEach(() => {
  mockPush.mockClear();
  mockUser = { id: 'me' };
  mockRows = [];
});

test('scored drinks with their score, ratings and menu, then early ones; drinks nobody has rated stay in the picker', async () => {
  mockRows = [gimlet, early, fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  expect(screen.getByText('8.4')).toBeTruthy();
  expect(screen.getByText('Gimlet · 64 ratings · on now')).toBeTruthy();
  expect(screen.getByText('Early')).toBeTruthy();
  expect(screen.getByText('3 ratings')).toBeTruthy();
  expect(screen.getByText('Past · 2024 to 2025')).toBeTruthy();
  expect(screen.queryByText('Old Flame')).toBeNull();
  expect(screen.getByText('Had something here? Your ranking moves this list.')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Number 1: House Gimlet, a Gimlet. Score 8.4 from 64 ratings. On the menu now. Open'));
  expect(mockPush).toHaveBeenCalledWith('/d/a');
});

test('no scores yet: says how a drink gets one', async () => {
  mockRows = [early, fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  expect(screen.getByText('Ranked so far')).toBeTruthy();
  expect(screen.getByText(/^No drink here has a score yet\./)).toBeTruthy();
});

test('nobody has ranked anything: asks to be the first', async () => {
  mockRows = [fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  expect(screen.getByText('Nobody has ranked a drink at Little Rye yet. Had something here? Be the first.')).toBeTruthy();
});

test('Rank a drink picks one of the bar’s drinks and ranks it here; signed out, it asks you to sign in', async () => {
  mockRows = [gimlet, fresh];
  await renderWithTamagui(<BarRankings bar={bar} />);
  await fireEvent.press(screen.getByLabelText('Rank a drink'));
  await fireEvent.press(screen.getByText('Pick Old Flame'));
  expect(screen.getByText('Ranking Old Flame at Little Rye')).toBeTruthy();

  mockUser = null;
  await renderWithTamagui(<BarRankings bar={bar} />);
  await fireEvent.press(screen.getByLabelText('Sign in to rank'));
  expect(mockPush).toHaveBeenCalledWith('/auth/login');
});
