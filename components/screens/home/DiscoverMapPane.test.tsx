import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { DiscoverBar, DiscoverDrink, DrinkFilter } from '@/lib/discoverDrinks';
import type { Area } from '@/lib/nearMe';

import { DiscoverMapPane } from './DiscoverMapPane';
import { PickedBar } from './SelectedBar';

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
  useDiscoverList: (f: DrinkFilter, o: { barId?: string | null; enabled?: boolean; from?: unknown }) =>
    page(
      !o.enabled
        ? []
        : o.from
          ? // Nearest: the same drinks, closest first, each with its distance.
            [...mockDrinks].reverse().map((d, i) => ({ ...d, distance: 400 + i * 1000 }))
          : f.kinds.includes('martini')
            ? mockDrinks.filter((d) => mockMartinis.has(d.id))
            : o.barId
              ? mockDrinks.filter((d) => d.barId === o.barId)
              : mockDrinks
    ),
}));
jest.mock('@/hooks/useRankings', () => ({ useBarTopDrinks: () => ({ data: mockTopDrinks }) }));
// The hero's Collect and Rank have their own tests; here they only need to be there.
jest.mock('@/components/screens/published/CollectButton', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { CollectButton: () => <Text>Collect</Text> };
});
jest.mock('@/components/screens/rank/RankActions', () => ({ RankFlow: () => null }));
jest.mock('@/components/screens/safety/AgeGate', () => ({ useAgeGate: () => ({ gate: (run: () => void) => run(), sheet: null, underAge: false }) }));
jest.mock('@/ctx/AuthContext', () => ({ useSignedIn: () => true }));
// The phone sheet: its content shows, and snapping is recorded.
const mockSnap = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const { FlatList, ScrollView, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const BottomSheet = forwardRef(function BottomSheet({ children }: { children: React.ReactNode }, ref) {
    useImperativeHandle(ref, () => ({ snapToIndex: mockSnap }));
    return <View>{children}</View>;
  });
  return { __esModule: true, default: BottomSheet, BottomSheetScrollView: ScrollView, BottomSheetFlatList: FlatList };
});
jest.mock('./DiscoverMap', () => {
  const { Pressable } = require('react-native');
  return {
    mapAvailable: true,
    DiscoverMap: ({ pins, onSelect }: { pins: { id: string; name: string; top?: string }[]; onSelect: (id: string) => void }) => (
      <>
        {pins.map((p) => (
          <Pressable key={p.id} role="button" accessibilityLabel={`pin ${p.name}${p.top ? ` (${p.top})` : ''}`} onPress={() => onSelect(p.id)} />
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

function drink(id: string, name: string, styles: string[] = [], match: DiscoverDrink['match'] = null, why: string | null = null): DiscoverDrink {
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
    match,
    why,
    distance: null,
  };
}

const more = { total: null, hasMore: false, loadMore: () => {}, loading: false };

interface Extra {
  from?: { latitude: number; longitude: number } | null;
  pick?: { id: string | null; onPick: (pin: unknown) => void; onLayer: (layer: string) => void };
}

function renderPane(drinks: DiscoverDrink[], pick: { id: string; name: string } | null = null, mode: 'side' | 'sheet' = 'side', search = '', extra: Extra = {}) {
  mockDrinks = drinks;
  mockBars = [{ ...bar, drinks: drinks.length }];
  return renderWithTamagui(
    <DiscoverMapPane
      mode={mode}
      area={area}
      onArea={() => {}}
      drink={pick}
      filter={{ kinds: [], search, area }}
      results={{ drinks, more, barsById: new Map([[bar.id, bar]]), isLoading: false, title: 'Martinis anywhere' }}
      {...extra}
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

test('on phones a tapped bar opens the sheet on it, not a card over the map', async () => {
  const drinks = [drink('d1', 'House Martini'), drink('d2', 'Bamboo'), drink('d3', 'Vesper'), drink('d4', 'Martini No. 4')];
  await renderPane(drinks, null, 'sheet');
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  // Halfway up, every drink there once (no floating card repeating them), no search so no drink leads.
  expect(mockSnap).toHaveBeenLastCalledWith(1);
  expect(screen.getAllByText('House Martini')).toHaveLength(1);
  expect(screen.getAllByText('Martini No. 4')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Open drink' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'All results' }));
  expect(screen.getByRole('button', { name: 'Show the list' })).toBeTruthy();
});

test('searching, pins name the best match and a tapped bar leads with the drink, then the bar', async () => {
  mockTopDrinks = [];
  const drinks = [
    drink('d1', 'Dirty Martini', [], { kind: 'name', text: null }),
    drink('d2', 'Gibson', [], { kind: 'riff', text: 'Martini' }, 'Riff on a Martini'),
    drink('d3', 'Sbagliato', [], { kind: 'line', text: 'Martini Rosso' }, 'Has Martini Rosso'),
  ];
  await renderPane(drinks, { id: 'martini', name: 'Martini' }, 'sheet', 'martini');

  // The layers read as a sort while searching.
  expect(screen.getByRole('radio', { name: 'Best match' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Top rated' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Top bars' })).toBeNull();
  // The weaker match sits under its own heading, saying why.
  expect(screen.getByText('Also mentions “martini”')).toBeTruthy();
  expect(screen.getByText('Has Martini Rosso')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage (Dirty Martini)" }));
  expect(screen.getByRole('heading', { name: 'Dirty Martini' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open drink' })).toBeTruthy();
  expect(screen.getByText('At')).toBeTruthy();
  expect(screen.getByText('More here for “martini”')).toBeTruthy();
  expect(screen.getByText('Riff on a Martini')).toBeTruthy();
});

test('on wide screens the card leads with the matching drink too', async () => {
  mockTopDrinks = [];
  await renderPane([drink('d1', 'Dirty Martini', [], { kind: 'name', text: null }), drink('d2', 'Bamboo')], null, 'side', 'martini');
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage (Dirty Martini)" }));
  expect(screen.getByRole('heading', { name: 'Dirty Martini' })).toBeTruthy();
  expect(screen.getByText('Bamboo')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open bar' })).toBeTruthy();
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

test('searching on a phone with somewhere to count from, Nearest lists the closest first with how far', async () => {
  const drinks = [drink('d1', 'Dirty Martini', [], { kind: 'name', text: null }), drink('d2', 'Gibson', [], { kind: 'riff', text: 'Martini' }, 'Riff on a Martini')];
  await renderPane(drinks, null, 'sheet', 'martini', { from: { latitude: -37.8, longitude: 144.97 } });
  await fireEvent.press(screen.getByRole('radio', { name: 'Nearest' }));
  const rows = screen.getAllByText(/^(Dirty Martini|Gibson)$/).map((n) => n.props.children);
  expect(rows).toEqual(['Gibson', 'Dirty Martini']);
  // Metres or miles, as the device's region uses.
  expect(screen.getByText(/400 m|0\.2 mi/)).toBeTruthy();
});

test('no Nearest without a search, or without somewhere to count from', async () => {
  await renderPane([drink('d1', 'Dirty Martini')], null, 'sheet', '', { from: { latitude: -37.8, longitude: 144.97 } });
  expect(screen.queryByRole('radio', { name: 'Nearest' })).toBeNull();
  await renderPane([drink('d1', 'Dirty Martini')], null, 'sheet', 'martini');
  expect(screen.queryByRole('radio', { name: 'Nearest' })).toBeNull();
});

test('on wide screens a tapped pin goes to the list, not a card over the map', async () => {
  const onPick = jest.fn();
  const onLayer = jest.fn();
  await renderPane([drink('d1', 'Dirty Martini', [], { kind: 'name', text: null })], { id: 'martini', name: 'Martini' }, 'side', 'martini', { pick: { id: null, onPick, onLayer } });
  await fireEvent.press(screen.getByRole('radio', { name: 'Top rated' }));
  expect(onLayer).toHaveBeenLastCalledWith('best');
  await fireEvent.press(screen.getByRole('radio', { name: 'Best match' }));
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage (Dirty Martini)" }));
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: bar.id }));
  expect(screen.queryByRole('button', { name: 'Open drink' })).toBeNull();
});

test("the drink that leads can be opened, collected and ranked", async () => {
  mockTopDrinks = [];
  await renderPane([drink('d1', 'Dirty Martini', [], { kind: 'name', text: null })], null, 'side', 'martini');
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage (Dirty Martini)" }));
  expect(screen.getByRole('button', { name: 'Open drink' })).toBeTruthy();
  expect(screen.getByText('Collect')).toBeTruthy();
  expect(screen.getByRole('button', { name: "Rank Dirty Martini against others you've had" })).toBeTruthy();
});

test("the wide list's tapped bar shows Top rated scores, as the map does", async () => {
  mockTopDrinks = [];
  mockScores = { d2: 9.2 };
  mockDrinks = [drink('d1', 'House Martini', ['martini']), drink('d2', 'Gibson', ['martini']), drink('d3', 'Bamboo')];
  const pin = { id: bar.id, handle: bar.handle, name: bar.name, logo: null, place: 'Melbourne', latitude: bar.latitude!, longitude: bar.longitude!, score: null, position: null, rankers: 0 };
  await renderWithTamagui(<PickedBar pin={pin} filter={{ kinds: [], search: '', area }} best={{ id: 'martini', name: 'Martini' }} onClose={() => {}} />);
  // The scored martini leads; the bar's other drinks aren't martinis.
  const rows = screen.getAllByRole('button', { name: /, open$/ }).map((b) => b.props.accessibilityLabel);
  expect(rows).toEqual(['Gibson. score 9.2. Gibson note, open', 'House Martini. House Martini note, open']);
  expect(screen.queryByText('Bamboo')).toBeNull();
});
