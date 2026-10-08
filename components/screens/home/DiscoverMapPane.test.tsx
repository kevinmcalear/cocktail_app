import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { DiscoverBar, DiscoverDrink, DrinkFilter } from '@/lib/discoverDrinks';
import type { Area } from '@/lib/nearMe';

import { DiscoverMapPane } from './DiscoverMapPane';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useDiscover', () => ({
  useDebounced: (v: unknown) => v,
  useDiscoverRankings: () => ({ data: undefined, isLoading: false }),
  useTopBars: () => ({ data: undefined, isLoading: false }),
}));
let mockScores: Record<string, number> = {};
jest.mock('@/hooks/useFlavor', () => ({ useItemScores: () => ({ data: mockScores }) }));
let mockTopDrinks: unknown[] = [];
// The server's side: every drink here, which of them are martinis, and the area's bars.
let mockDrinks: DiscoverDrink[] = [];
let mockMartinis = new Set<string>();
let mockBars: DiscoverBar[] = [];
const page = (drinks: DiscoverDrink[]) => ({ drinks, totals: { drinks: drinks.length, bars: 1 }, isLoading: false, hasMore: false, isLoadingMore: false, loadMore: () => {}, error: null });
jest.mock('@/hooks/useDiscoverDrinks', () => ({
  useDiscoverBars: () => ({ data: mockBars, isPending: false }),
  useTileBars: () => ({ bars: [], isLoading: false }),
  useDiscoverList: (f: DrinkFilter, o: { barId?: string | null; enabled?: boolean }) =>
    page(!o.enabled ? [] : f.kinds.includes('martini') ? mockDrinks.filter((d) => mockMartinis.has(d.id)) : o.barId ? mockDrinks.filter((d) => d.barId === o.barId) : mockDrinks),
}));
jest.mock('@/hooks/useRankings', () => ({ useBarTopDrinks: () => ({ data: mockTopDrinks }) }));
// The phone sheet: its content shows, and snapping is recorded.
const mockSnap = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const { ScrollView, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const BottomSheet = forwardRef(function BottomSheet({ children }: { children: React.ReactNode }, ref) {
    useImperativeHandle(ref, () => ({ snapToIndex: mockSnap }));
    return <View>{children}</View>;
  });
  return { __esModule: true, default: BottomSheet, BottomSheetScrollView: ScrollView };
});
jest.mock('./DiscoverMap', () => {
  const { Pressable } = require('react-native');
  return {
    mapAvailable: true,
    DiscoverMap: ({ pins, onSelect }: { pins: { id: string; name: string }[]; onSelect: (id: string) => void }) => (
      <>
        {pins.map((p) => (
          <Pressable key={p.id} role="button" accessibilityLabel={`pin ${p.name}`} onPress={() => onSelect(p.id)} />
        ))}
      </>
    ),
  };
});

const area: Area = { kind: 'anywhere' };
const bar: DiscoverBar = {
  id: 'b1',
  handle: 'caretakers',
  name: "Caretaker's Cottage",
  logo: null,
  locality: 'Melbourne CBD',
  city: 'Melbourne',
  countryCode: 'AU',
  latitude: -37.81,
  longitude: 144.96,
  closed: false,
  closedYear: null,
  drinks: 0,
};

function drink(id: string, name: string, styles: string[] = []): DiscoverDrink {
  if (styles.includes('martini')) mockMartinis.add(id);
  return {
    id,
    name,
    description: `${name} note`,
    imageUrl: null,
    barId: bar.id,
    bar: { name: bar.name, handle: bar.handle, logo: null, locality: bar.locality, city: bar.city },
    menu: { onNow: false, past: null, order: 1 },
    rank: 6,
  };
}

const more = { total: null, hasMore: false, loadMore: () => {}, loading: false };

function renderPane(drinks: DiscoverDrink[], pick: { id: string; name: string } | null = null, mode: 'side' | 'sheet' = 'side') {
  mockDrinks = drinks;
  mockBars = [{ ...bar, drinks: drinks.length }];
  return renderWithTamagui(
    <DiscoverMapPane
      mode={mode}
      area={area}
      onArea={() => {}}
      drink={pick}
      filter={{ kinds: [], search: '', area }}
      results={{ drinks, more, barsById: new Map([[bar.id, bar]]), isLoading: false, title: 'Martinis anywhere' }}
    />
  );
}

beforeEach(() => {
  mockMartinis = new Set();
});

test('a drinks pin lists those cocktails in the card', async () => {
  const drinks = [drink('d1', 'House Martini'), drink('d2', 'Bamboo'), drink('d3', 'Vesper'), drink('d4', 'Martini No. 4')];
  await renderPane(drinks);

  expect(screen.queryByText('House Martini')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  expect(screen.getByText('House Martini')).toBeTruthy();
  expect(screen.getByText('Bamboo')).toBeTruthy();
  expect(screen.getByText('Vesper')).toBeTruthy();
  expect(screen.queryByText('Martini No. 4')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Show all 4' }));
  expect(screen.getByText('Martini No. 4')).toBeTruthy();
});

test("on phones the card previews the bar's drinks and Show all opens the sheet", async () => {
  const drinks = [drink('d1', 'House Martini'), drink('d2', 'Bamboo'), drink('d3', 'Vesper'), drink('d4', 'Martini No. 4')];
  await renderPane(drinks, null, 'sheet');
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  // The card and the sheet's list both show the first ones; only the sheet has the fourth.
  expect(screen.getAllByText('House Martini')).toHaveLength(2);
  expect(screen.getAllByText('Martini No. 4')).toHaveLength(1);

  await fireEvent.press(screen.getByRole('button', { name: 'Show all 4' }));
  expect(mockSnap).toHaveBeenLastCalledWith(2);
  await fireEvent.press(screen.getByRole('button', { name: 'Show the list' }));
  expect(mockSnap).toHaveBeenLastCalledWith(1);
});

test("the card shows the bar's top drinks once they have scores", async () => {
  const top = (item_id: string, name: string, position: number | null, score: number | null) => ({
    position, item_id, name, bar_id: null, ranked_as_item_id: item_id, ranked_as_name: null, image_url: null, image_is_generated: null,
    score, rankers: score === null ? 3 : 30, menu: null, menu_from: null, menu_to: null,
  });
  mockTopDrinks = [top('t1', 'Smoke & Fig Old Fashioned', 1, 9.4), top('t2', 'Rye Garden Highball', 2, 9), top('t3', 'Early Bird', null, null)];
  await renderPane([drink('d1', 'House Martini')]);
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  expect(screen.getByText('Top drinks here')).toBeTruthy();
  expect(screen.getByText('Smoke & Fig Old Fashioned')).toBeTruthy();
  expect(screen.getByText('9.4')).toBeTruthy();
  expect(screen.getByText('9.0')).toBeTruthy();
  expect(screen.queryByText('Early Bird')).toBeNull();
});

test('an early bar\'s card has no top drinks block', async () => {
  mockTopDrinks = [];
  await renderPane([drink('d1', 'House Martini')]);
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));
  expect(screen.queryByText('Top drinks here')).toBeNull();
});

test('Best Martini lists every martini at the bar, scores beside the scored ones only', async () => {
  mockTopDrinks = [];
  mockScores = { d2: 9.2 };
  const drinks = [drink('d1', 'House Martini', ['martini']), drink('d2', 'Gibson', ['martini']), drink('d3', 'Bamboo')];
  await renderPane(drinks, { id: 'martini', name: 'Martini' });

  await fireEvent.press(screen.getByRole('radio', { name: 'Best Martini' }));
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  // The bar's score is its best martini's, with no "ranked by" line; the scored martini leads.
  expect(screen.getAllByText('9.2')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Gibson. score 9.2. Gibson note, open' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'House Martini. House Martini note, open' })).toBeTruthy();
  expect(screen.queryByText('Bamboo')).toBeNull();
  expect(screen.queryByText('Not ranked yet')).toBeNull();
});
