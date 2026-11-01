import { fireEvent, screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { renderWithProviders } from '@/jest.setup';

import { BeerWineScreen } from './BeerWineScreen';

const mockPush = jest.fn();
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
  Redirect: () => null,
}));
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
  await fireEvent.press(screen.getByRole('button', { name: 'Add to favorites' }));
  expect(mockToggleFavorite).toHaveBeenCalledWith('beer-b1');
  await fireEvent.press(screen.getByRole('button', { name: 'Edit beer' }));
  expect(mockPush).toHaveBeenCalledWith('/beer/beer-b1/edit');
});
