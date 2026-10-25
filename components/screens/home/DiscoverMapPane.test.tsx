import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { DiscoverBar, DiscoverDrink, DrinkFilter } from '@/lib/discoverDrinks';
import type { Area } from '@/lib/nearMe';

import type { MapLayer } from './DiscoverControls';
import { DiscoverMapPane } from './DiscoverMapPane';
import { PickedBar } from './SelectedBar';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useDiscover', () => ({
  useDebounced: (v: unknown) => v,
  useDiscoverRankings: () => ({ data: undefined, isLoading: false }),
  useTopBars: () => ({ data: undefined, isLoading: false }), useDrinkPick: () => null,
}));
let mockScores: Record<string, number> = {};
jest.mock('@/hooks/useFlavor', () => ({ useItemScores: () => ({ data: mockScores }) }));
let mockTopDrinks: unknown[] = [];
// The server's side: every drink here, which of them are martinis, and the area's bars.
let mockDrinks: DiscoverDrink[] = [];
let mockMartinis = new Set<string>();
let mockBars: DiscoverBar[] = [];
// The bars query's own state, when a test needs it (a new city still showing the last area's bars).
let mockBarsQuery: { data: DiscoverBar[]; isPending: boolean; isPlaceholderData: boolean } | null = null;
const page = (drinks: DiscoverDrink[]) => ({ drinks, totals: { drinks: drinks.length, bars: 1 }, isLoading: false, hasMore: false, isLoadingMore: false, loadMore: () => {}, error: null });
jest.mock('@/hooks/useDiscoverDrinks', () => ({
  useDiscoverBars: () => mockBarsQuery ?? { data: mockBars, isPending: false, isPlaceholderData: false },
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
jest.mock('@/hooks/useSpecMatches', () => ({ useVersionLabel: () => undefined, useBarVersions: () => ({}), useSpecMatches: () => ({ data: undefined }) }));
jest.mock('@/hooks/useBarFacts', () => ({ useBarFacts: () => ({ data: null }) }));
jest.mock('@/hooks/useBarBrands', () => ({ useBarBrand: () => null }));
jest.mock('@/components/screens/kept/LoveBarButton', () => ({ LoveBarButton: () => null }));
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
  const BottomSheet = forwardRef(function BottomSheet({ children, handleComponent: Handle }: { children: React.ReactNode; handleComponent?: React.ComponentType<{ animatedIndex: { value: number } }> }, ref) {
    useImperativeHandle(ref, () => ({ snapToIndex: mockSnap }));
    return <View>{Handle ? <Handle animatedIndex={{ value: 1 }} /> : null}{children}</View>;
  });
  return { __esModule: true, default: BottomSheet, BottomSheetScrollView: ScrollView, BottomSheetFlatList: FlatList };
});
let mockCamera: { latitude: number; longitude: number; zoom: number } | null = null; // the camera the map was last given
jest.mock('./DiscoverMap', () => {
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    mapAvailable: true,
    DiscoverMap: ({ pins, onSelect, camera }: { pins: { id: string; name: string; top?: string }[]; onSelect: (id: string) => void; camera: typeof mockCamera }) => (
      <>
        {(mockCamera = camera) && null}
        {pins.map((p) => (
          <Pressable key={p.id} role="button" accessibilityLabel={`pin ${p.name}${p.top ? ` (${p.top})` : ''}`} onPress={() => onSelect(p.id)} />
        ))}
      </>
    ),
  };
});

const area: Area = { kind: 'anywhere' };
const bar: DiscoverBar = {
  id: 'b1', handle: 'caretakers', name: "Caretaker's Cottage", logo: null, locality: 'Melbourne CBD', city: 'Melbourne', countryCode: 'AU',
  latitude: -37.81, longitude: 144.96, closed: false, closedYear: null, drinks: 0,
};

function drink(id: string, name: string, styles: string[] = [], match: DiscoverDrink['match'] = null, why: string | null = null): DiscoverDrink {
  if (styles.includes('martini')) mockMartinis.add(id);
  return {
    id, name, description: `${name} note`, imageUrl: null, barId: bar.id,
    bar: { name: bar.name, handle: bar.handle, logo: null, locality: bar.locality, city: bar.city },
    menu: { onNow: false, past: null, order: 1 }, rank: 6, match, why, distance: null,
  };
}

const more = { total: null, hasMore: false, loadMore: () => {}, loading: false };

/** `kinds`: a style's best needs one picked. `title`: the list's, "Drinks anywhere" browsing. */
interface Extra { from?: { latitude: number; longitude: number } | null; pick?: { id: string | null; onPick: (pin: unknown) => void }; kinds?: string[]; layer?: MapLayer; topBars?: boolean; browse?: React.ReactNode; title?: string }

function renderPane(drinks: DiscoverDrink[], pick: { id: string; name: string } | null = null, mode: 'side' | 'sheet' = 'side', search = '', { title = 'Martinis anywhere', ...extra }: Extra = {}) {
  mockDrinks = drinks;
  mockBars = [{ ...bar, drinks: drinks.length }];
  return renderWithTamagui(
    <DiscoverMapPane
      mode={mode}
      area={area}
      onArea={() => {}}
      drink={pick}
      filter={{ kinds: extra.kinds ?? [], search, area }}
      results={{ drinks, more, barsById: new Map([[bar.id, bar]]), isLoading: false, title }}
      layer="drinks"
      {...extra}
    />
  );
}

beforeEach(() => (mockMartinis = new Set()));

test("a drinks pin's card says how many drinks are there, beside its actions (g048)", async () => {
  const drinks = [drink('d1', 'House Martini'), drink('d2', 'Bamboo'), drink('d3', 'Vesper'), drink('d4', 'Martini No. 4')];
  await renderPane(drinks);
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  expect(screen.getByText('4 drinks here')).toBeTruthy();
  expect(screen.getByText('House Martini')).toBeTruthy();
  expect(screen.getByText('Martini No. 4')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open bar' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
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
  expect(screen.queryByText(/Caretaker's Cottage ·/)).toBeNull(); // its rows don't repeat the bar
  expect(screen.getByRole('link', { name: /Open the bar$/ })).toBeTruthy(); // the bar's row, no Open bar button
  expect(screen.queryByRole('button', { name: /^Back to all/ })).toBeNull(); // the header's pill goes back (DiscoverControls)
});

test('searching, pins name the best match and a tapped bar leads with the drink, then the bar', async () => {
  mockTopDrinks = [];
  const drinks = [
    drink('d1', 'Dirty Martini', [], { kind: 'name', text: null }),
    drink('d2', 'Gibson', [], { kind: 'riff', text: 'Martini' }, 'Riff on a Martini'),
    drink('d3', 'Sbagliato', [], { kind: 'line', text: 'Martini Rosso' }, 'Has Martini Rosso'),
  ];
  await renderPane(drinks, { id: 'martini', name: 'Martini' }, 'sheet', 'martini');

  // The weaker match sits under its own heading, saying why.
  expect(screen.getByText('Also mentions “martini”')).toBeTruthy();
  expect(screen.getByText(/Has Martini Rosso/)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage (Dirty Martini)" }));
  expect(screen.getByRole('heading', { name: 'Dirty Martini' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open drink' })).toBeTruthy();
  // The matches page one at a time, the next peeking (disc-search-pin); then the bar, as a link.
  expect(screen.getByText("1 of 3 at Caretaker's Cottage")).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Back to all/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Next: Gibson, Riff on a Martini' }));
  expect(screen.getByText("2 of 3 at Caretaker's Cottage")).toBeTruthy();
  expect(screen.getByText('At')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Open the bar$/ })).toBeTruthy();
});

test('on wide screens the card leads with the matching drink too', async () => {
  mockTopDrinks = [];
  await renderPane([drink('d1', 'Dirty Martini', [], { kind: 'name', text: null }), drink('d2', 'Bamboo')], null, 'side', 'martini');
  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage (Dirty Martini)" }));
  expect(screen.getByRole('heading', { name: 'Dirty Martini' })).toBeTruthy();
  expect(screen.getByText('Bamboo')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Open the bar$/ })).toBeTruthy();
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

test('Martinis best first lists every martini at the bar, scores beside the scored ones only', async () => {
  mockTopDrinks = [];
  mockScores = { d2: 9.2 };
  const drinks = [drink('d1', 'House Martini', ['martini']), drink('d2', 'Gibson', ['martini']), drink('d3', 'Bamboo')];
  await renderPane(drinks, { id: 'martini', name: 'Martini' }, 'side', '', { kinds: ['martini'], layer: 'best' });

  await fireEvent.press(screen.getByRole('button', { name: "pin Caretaker's Cottage" }));

  // A style is picked, so the card leads with its best martini (one 9.2, no "ranked by" line), then the next.
  expect(screen.getAllByText('9.2')).toHaveLength(1);
  expect(screen.getByLabelText('Next: House Martini')).toBeTruthy();
  expect(screen.queryByText('Bamboo')).toBeNull();
  expect(screen.queryByText('Not ranked yet')).toBeNull();
});

test('searching on a phone with somewhere to count from, Nearest lists the closest first with how far', async () => {
  const drinks = [drink('d1', 'Dirty Martini', [], { kind: 'name', text: null }), drink('d2', 'Gibson', [], { kind: 'riff', text: 'Martini' }, 'Riff on a Martini')];
  await renderPane(drinks, null, 'sheet', 'martini', { from: { latitude: -37.8, longitude: 144.97 }, layer: 'nearest' });
  const rows = screen.getAllByText(/^(Dirty Martini|Gibson)$/).map((n) => n.props.children?.props?.text ?? n.props.children);
  expect(rows).toEqual(['Gibson', 'Dirty Martini']);
  // Metres or miles, as the device's region uses.
  expect(screen.getByText(/400 m|0\.2 mi/)).toBeTruthy();
});

test('phones: the sheet says what the map shows, the shelves lead only while browsing, and See all lists the top bars', async () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const shelves = <Text>the shelves</Text>;
  await renderPane([drink('d1', 'Dirty Martini')], null, 'sheet', '', { browse: shelves, title: 'Drinks anywhere' });
  expect(screen.getByRole('button', { name: 'Drinks anywhere, 1 bar. Show the list' })).toBeTruthy();
  expect(screen.getByText('the shelves')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'All drinks anywhere' })).toBeTruthy();
  await renderPane([drink('d1', 'Dirty Martini', ['martini'])], { id: 'martini', name: 'Martini' }, 'sheet', '', { browse: shelves, kinds: ['martini'], layer: 'best' });
  expect(screen.queryByText('the shelves')).toBeNull();
  // Top bars' See all lists the bars in the sheet, in place of the drinks.
  await renderPane([drink('d1', 'Dirty Martini')], null, 'sheet', '', { topBars: true });
  expect(screen.getByRole('button', { name: /^Top bars anywhere/ })).toBeTruthy();
  expect(screen.getByText('No bars anywhere on Cocktail yet.')).toBeTruthy();
  expect(screen.queryByText('Dirty Martini')).toBeNull();
});

test('on wide screens a tapped pin goes to the list, not a card over the map', async () => {
  const onPick = jest.fn();
  await renderPane([drink('d1', 'Dirty Martini', [], { kind: 'name', text: null })], { id: 'martini', name: 'Martini' }, 'side', 'martini', { pick: { id: null, onPick } });
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
  // Its martinis are counted (the bar's other drinks aren't martinis); the rows stay in the list.
  expect(screen.getByText('2 drinks here')).toBeTruthy();
  expect(screen.queryByText('Bamboo')).toBeNull();
});

test('switching to a city fits its bars, not the last area\'s still on screen', async () => {
  const nyc: DiscoverBar = { ...bar, id: 'b2', name: 'Dante', city: 'New York', countryCode: 'US', latitude: 40.73, longitude: -74.0, drinks: 3 };
  const results = { drinks: [], more, barsById: new Map(), isLoading: false, title: 'Drinks' };
  const pane = (where: Area) => <DiscoverMapPane mode="side" area={where} onArea={() => {}} drink={null} filter={{ kinds: [], search: '', area: where }} results={results} layer="drinks" />;
  mockBarsQuery = { data: [{ ...bar, drinks: 2 }, nyc], isPending: false, isPlaceholderData: false };
  const { rerender } = await renderWithTamagui(pane(area));
  const anywhere = mockCamera;

  // New York picked: its bars are loading, the query still holds anywhere's. The map waits.
  const city: Area = { kind: 'city', city: 'New York', country_code: 'US', label: 'New York' };
  mockBarsQuery = { ...mockBarsQuery, isPlaceholderData: true };
  await rerender(pane(city));
  expect(mockCamera).toEqual(anywhere);

  // They land: the camera is on New York, close in.
  mockBarsQuery = { data: [nyc], isPending: false, isPlaceholderData: false };
  await rerender(pane(city));
  expect(mockCamera).toMatchObject({ latitude: 40.73, longitude: -74.0 });
  expect(mockCamera!.zoom).toBeGreaterThan(10);
  mockBarsQuery = null;
});
