import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, Stack, Tabs, useLocalSearchParams } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import * as TabStack from '@/app/(tabs)/(1-tonight,2-drinks,3-discover,4-you)/_layout';
import DrinksTab from '@/app/(tabs)/(2-drinks)/drinks';
import { BreakpointOverride } from '@/components/ds';
import { renderWithProviders } from '@/jest.setup';
import { drinkInPane, useDrinksFirstRow } from '@/hooks/useDrinksSplit';
import { TABS } from '@/lib/tabs';

import { ScreenHeader } from './ScreenHeader';

// The real tab stack layout and Drinks page, with the window's nav and the mode set per test.
let mockNav: 'tabs' | 'rail' | 'sidebar' = 'sidebar';
let mockMode: 'venue' | 'home' = 'venue';
jest.mock('@/hooks/useIsWideWeb', () => ({
  ...jest.requireActual<object>('@/hooks/useIsWideWeb'),
  useWebNav: () => mockNav,
  useIsWideWeb: () => mockNav !== 'tabs',
  useWebNavWidth: () => 0,
}));
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode, setMode: jest.fn() }) }));
jest.mock('@/components/screens/venue/DeleteVenue', () => ({ VenueDeleteBanner: () => null }));
// The New sheet's lists read Supabase; the sheet itself is what's checked here.
// Add reads where things land and the clipboard; the sheet itself is what's checked here.
jest.mock('@/hooks/useBringInPlace', () => ({ useBringInPlace: () => ({ barId: null, venueName: null, heldBack: null, loading: false }) }));
jest.mock('@/lib/clipboardPeek', () => ({ UNREAD_CLIP: '\u0000unread', peekClipboard: async () => null, readClipboard: async () => null }));
jest.mock('@/hooks/useDrinkDesk', () => ({ useMenuSectionPlace: () => ({ data: undefined }) }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [] }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }), useCapabilityOpensAt: () => ({ data: 35 }) }));
jest.mock('@/hooks/useSearchMine', () => ({ useSearchMine: () => ({ venueId: null, canAdd: true, label: 'Your drinks' }) }));

// The list stands in as two rows that open as its rows do (useOpenBeside), and counts its mounts.
let mockMounts = 0;
jest.mock('@/components/screens/drinks/StaffDrinks', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useOpenBeside } = jest.requireActual<typeof import('@/hooks/useDrinksSplit')>('@/hooks/useDrinksSplit');
  function StaffDrinks({ beside }: { beside?: boolean }) {
    useEffect(() => void (mockMounts += 1), []);
    const { picked, open } = useOpenBeside();
    return (
      <View>
        <Text>{beside ? `list beside, ${picked ?? 'none'} picked` : 'library'}</Text>
        {['1', '2'].map((id) => (
          <Pressable key={id} role="button" accessibilityLabel={`Drink ${id}`} onPress={() => open(`/cocktail/${id}`)} />
        ))}
      </View>
    );
  }
  return { StaffDrinks };
});
// The real one lazy-loads the list, which Jest can't; it is the same screen.
jest.mock('@/components/nav/RootLazy', () => {
  const { StaffDrinks } = jest.requireMock<typeof import('@/components/screens/drinks/StaffDrinks')>('@/components/screens/drinks/StaffDrinks');
  return { DrinksBeside: () => <StaffDrinks beside /> };
});
// Drinks' first page on a desktop shows the list's first row (useDrinksFirstRow): a drink as its pane, here a stand-in.
jest.mock('@/components/screens/drinks/DrinksPanes', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { DrinkPane: ({ id }: { id: string }) => <Text>{`pane ${id}`}</Text>, OtherPane: ({ item }: { item: { name: string } }) => <Text>{`other ${item.name}`}</Text> };
});
jest.mock('@/components/screens/drinks/HomeDrinks', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { HomeDrinks: () => <Text>home drinks</Text> };
});

const SHARED = '(tabs)/(1-tonight,2-drinks,3-discover,4-you)';
// The layout takes expo-router's `segment` prop, which the mock config's type doesn't know.
const SharedLayout = { ...TabStack, default: TabStack.default as unknown as () => ReactElement };
const page = (name: string) =>
  function Page() {
    return <Text>{name}</Text>;
  };
function Drink() {
  return <Text>{`drink ${useLocalSearchParams<{ id: string }>().id}`}</Text>;
}

function open(url: string) {
  return renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': () => (
        <Tabs>
          {[...TABS.map((t) => t.route), 'search'].map((name) => (
            <Tabs.Screen key={name} name={name} />
          ))}
        </Tabs>
      ),
      [`${SHARED}/_layout`]: SharedLayout,
      '(tabs)/(1-tonight)/index': page('tonight'),
      [`${SHARED}/cocktail/[id]/index`]: Drink,
      [`${SHARED}/prep`]: page('prep'),
      '(tabs)/(2-drinks)/drinks': DrinksTab,
      '(tabs)/(3-discover)/discover': page('discover'),
      '(tabs)/(4-you)/you': page('you'),
      '(tabs)/search/index': page('search'),
    },
    { initialUrl: url },
  );
}

beforeEach(() => {
  mockNav = 'sidebar';
  mockMode = 'venue';
  mockMounts = 0;
  useDrinksFirstRow.setState({ item: null, ready: true });
});

test('from 1200 at a venue, a drink opens beside the list at its own URL, and Back closes it', async () => {
  const r = await open('/drinks');
  expect(await screen.findByText('list beside, none picked')).toBeTruthy();
  expect(screen.getByText('Pick a drink to see it here.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Drink 1' }));
  expect(r.getPathname()).toBe('/cocktail/1');
  expect(r.getSegments()).toEqual(['(tabs)', '(2-drinks)', 'cocktail', '[id]']);
  expect(screen.getByText('drink 1')).toBeTruthy();
  expect(screen.getByText('list beside, 1 picked')).toBeTruthy();

  // The next pick replaces it, and the list is the same one throughout (its scroll and filters stay).
  await fireEvent.press(screen.getByRole('button', { name: 'Drink 2' }));
  expect(r.getPathname()).toBe('/cocktail/2');
  expect(screen.getByText('list beside, 2 picked')).toBeTruthy();
  await act(async () => router.back());
  expect(r.getPathname()).toBe('/drinks');
  expect(screen.getByText('list beside, none picked')).toBeTruthy();
  expect(mockMounts).toBe(1);
});

test('from 1200, Drinks opens on the list\'s first row rather than a blank page, and says nothing while the list loads', async () => {
  useDrinksFirstRow.setState({ item: null, ready: false });
  await open('/drinks');
  expect(await screen.findByText('list beside, none picked')).toBeTruthy();
  expect(screen.queryByText('Pick a drink to see it here.')).toBeNull();
  await act(async () => useDrinksFirstRow.setState({ item: { id: 'b', name: 'Bolo Tie', category: 'Cocktail' } as never, ready: true }));
  expect(screen.getByText('pane b')).toBeTruthy();
  await act(async () => useDrinksFirstRow.setState({ item: { id: 'g', name: 'Gin', category: 'Ingredient' } as never, ready: true }));
  expect(screen.getByText('other Gin')).toBeTruthy();
});

test('another page on the Drinks stack takes the width, and the list comes back with Back', async () => {
  await open('/drinks');
  await screen.findByText('list beside, none picked');
  await act(async () => router.push('/prep'));
  expect(screen.getByText('prep')).toBeTruthy();
  expect(screen.queryByText('list beside, none picked')).toBeNull();
  await act(async () => router.back());
  expect(screen.getByText('list beside, none picked')).toBeTruthy();
  expect(mockMounts).toBe(1);
});

test('below 1200, Drinks stays one column', async () => {
  mockNav = 'rail';
  const r = await open('/drinks');
  expect(screen.getByText('library')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Drink 1' }));
  expect(r.getPathname()).toBe('/cocktail/1');
  expect(screen.queryByText(/list beside/)).toBeNull();
});

test('at home, Drinks is your drinks, shelf and menus, one column', async () => {
  mockMode = 'home';
  await open('/drinks');
  expect(screen.getByText('home drinks')).toBeTruthy();
  expect(screen.queryByText(/list beside/)).toBeNull();
});

// A cold link (or a refresh) opens a drink on Tonight's stack (lib/tabs.ts), as the whole page.
test('a cold drink link opens on Tonight, with no list beside it', async () => {
  const r = await open('/cocktail/1');
  expect(r.getSegments()).toEqual(['(tabs)', '(1-tonight)', 'cocktail', '[id]']);
  expect(screen.getByText('drink 1')).toBeTruthy();
  expect(screen.queryByText(/list beside/)).toBeNull();
});

test('only a drink page counts as the drink in the pane', () => {
  expect(drinkInPane('/cocktail/abc')).toBe('abc');
  expect(drinkInPane('/cocktail/abc/edit')).toBeNull();
  expect(drinkInPane('/drinks')).toBeNull();
});

test('from 1200 the top row ends in + Add, which opens Add', async () => {
  await renderWithProviders(
    <BreakpointOverride value="desktop">
      <ScreenHeader />
    </BreakpointOverride>,
  );
  await fireEvent.press(screen.getByRole('button', { name: /^Add: name a drink/ }));
  expect(await screen.findByLabelText('Name a drink, paste a link, or describe it')).toBeTruthy();
});

test('the list beside a drink (a tablet layout) leaves Add to the page', async () => {
  await renderWithProviders(
    <BreakpointOverride value="tablet">
      <ScreenHeader />
    </BreakpointOverride>,
  );
  expect(screen.queryByRole('button', { name: /^Add: name a drink/ })).toBeNull();
});
