import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { DiscoverDrink } from '@/lib/discoverDrinks';

import { gridColumns, TileGrid } from './TileGrid';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useCocktails', () => ({ usePrefetchCocktail: () => () => {} }));
jest.mock('@/hooks/useBarBrands', () => ({ useBarBrand: () => null }));

const drink = (id: string, barId: string): DiscoverDrink => ({
  id,
  name: `Drink ${id}`,
  description: null,
  imageUrl: null,
  barId,
  bar: { name: `Bar ${barId}`, handle: barId, logo: null, locality: 'Nolita', city: 'New York' },
  menu: { onNow: true, past: null, order: 0 },
  styles: [],
  pos: null,
  rank: 0,
  match: null,
  why: null,
  distance: null,
});

test('wide grids fit 112 px tiles: three in a 428 list, four in 640', () => {
  // The list's width less its 32 px gutters.
  expect(gridColumns(428 - 64)).toBe(3);
  expect(gridColumns(640 - 64)).toBe(4);
  // A picked bar's card (16 px inside): its own tiles may be 100 wide.
  expect(gridColumns(428 - 64 - 34, 100)).toBe(3);
  expect(gridColumns(640 - 64 - 34, 100)).toBe(4);
  expect(gridColumns(0)).toBe(1);
});

test('a grid shows two rows, and Show all opens the rest in place', async () => {
  const drinks = Array.from({ length: 10 }, (_, i) => drink(String(i), `b${i}`));
  await renderWithProviders(<TileGrid drinks={drinks} showAll="Show all 10 drinks" />);
  // Before layout: three across, so six.
  expect(screen.getAllByRole('link')).toHaveLength(6);
  await fireEvent.press(screen.getByRole('button', { name: 'Show all 10 drinks' }));
  expect(screen.getAllByRole('link')).toHaveLength(10);
  expect(screen.getByText('Show fewer')).toBeTruthy();
});
