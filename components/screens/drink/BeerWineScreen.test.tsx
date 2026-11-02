import { act, fireEvent, screen } from '@testing-library/react-native';
import { Fragment, type ReactNode } from 'react';
import 'react-native-gesture-handler/jestSetup';

import { renderWithProviders } from '@/jest.setup';

import { BeerWineScreen } from './BeerWineScreen';

// burnt ships untranspiled ESM; the toast isn't what's tested here.
jest.mock('burnt', () => ({ toast: jest.fn() }));

const mockPush = jest.fn();
// The page's tools sit in the native bar, so they arrive as the stack's options.
const mockOptions: { unstable_headerRightItems?: () => { type: string; label?: string; accessibilityLabel?: string; onPress?: () => void; element?: ReactNode }[] } = {};
const mockToggleFavorite = jest.fn();
const lager = {
  id: 'b1',
  name: 'Little Rye Lager',
  brand_maker: 'Bellwoods',
  abv: 4.8,
  price: 9,
  description: 'Crisp and bready.',
  notes: 'Pour it in the pint, not the stein.',
  bar_id: null,
  item_images: [],
  item_categories: [{ category_id: 'c1' }],
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'beer-b1' }),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useNavigation: () => ({ setOptions: (o: object) => Object.assign(mockOptions, o) }),
  Redirect: () => null,
}));
jest.mock('@/hooks/useShareSlug', () => ({ useShareSlug: () => ({ data: 'little-rye-lager' }) }));
jest.mock('@/hooks/useBeers', () => ({ useBeer: (id: string) => ({ data: id === 'b1' ? lager : undefined, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/hooks/useWines', () => ({ useWine: () => ({ data: undefined, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/hooks/useDropdowns', () => ({ useDropdowns: () => ({ data: { categories: [{ id: 'c1', name: 'Lager' }], glassware: [] } }) }));
jest.mock('@/hooks/useFavorites', () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: mockToggleFavorite }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));
jest.mock('@/hooks/useTrackRecent', () => ({ useTrackRecent: () => undefined, recentEntry: () => null }));
jest.mock('@/hooks/useViewAs', () => ({ useCanEditItem: () => true, useEffectiveRole: () => 10 }));
jest.mock('@/hooks/useTeamRole', () => ({ useTeamRole: () => null }));
jest.mock('@/hooks/useFlavor', () => ({ useItemFlavor: () => ({ data: null }), useMyTaste: () => ({ data: null }), useFlavorBaseline: () => ({ data: null }) }));

test('a beer reads like a drink page: its style, maker, then tastes and the facts a menu gives', async () => {
  await renderWithProviders(<BeerWineScreen kind="beer" />);

  expect(screen.getAllByText('Little Rye Lager').length).toBeGreaterThan(0);
  expect(screen.getByText('Beer · Lager')).toBeTruthy();
  expect(screen.getByText('Bellwoods')).toBeTruthy();
  expect(screen.getByLabelText('Strength: 4.8%')).toBeTruthy();
  expect(screen.getByLabelText('Pour: $9')).toBeTruthy();
  expect(screen.getByText('Crisp and bready.')).toBeTruthy();
  expect(screen.getByText('Pour it in the pint, not the stein.')).toBeTruthy();

  // Favourites keep the prefixed id they always had; Edit opens its edit page.
  const barItem = (name: string) => mockOptions.unstable_headerRightItems?.().find((i) => (i.accessibilityLabel ?? i.label) === name);
  await act(async () => barItem('Add to favorites')?.onPress?.());
  expect(mockToggleFavorite).toHaveBeenCalledWith('beer-b1');
  // Edit is the board's ink pill, a custom item: render the bar's custom items and press it.
  const custom = mockOptions.unstable_headerRightItems?.().filter((i) => i.type === 'custom') ?? [];
  await renderWithProviders(<>{custom.map((i, n) => <Fragment key={n}>{i.element}</Fragment>)}</>);
  fireEvent.press(screen.getByLabelText('Edit beer'));
  expect(mockPush).toHaveBeenCalledWith('/beer/beer-b1/edit');
});
