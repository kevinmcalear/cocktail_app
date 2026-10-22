import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { pickShelves } from '@/lib/discoverShelves';

import { BarAway } from './DrinksAtBars';
import { DiscoverShelves, gridColumns, TileGrid } from './DiscoverShelves';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useCocktails', () => ({ usePrefetchCocktail: () => () => {} }));
jest.mock('@/hooks/useBarBrands', () => ({ useBarBrand: () => null }));
jest.mock('@/hooks/useFlavor', () => ({ useMyTaste: () => ({ data: { taste: { sweet: 0.8 } } }) }));

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

test('only shelves with three drinks show, and See all sets that filter', async () => {
  const around = [drink('1', 'a'), drink('2', 'b'), drink('3', 'c')];
  // Two zero-proof drinks: too few, so no zero-proof shelf.
  const picked = pickShelves({ where: 'near you', around, style: 'martini', styled: around, zero: around.slice(0, 2) });
  // As hooks/useDiscoverShelves marks the first shelf once a taste orders it.
  const shelves = picked.map((s) => (s.key === 'around' ? { ...s, note: 'Based on your taste', taste: true } : s));
  expect(picked[0].note).toBe('One from each bar');
  const onKind = jest.fn();
  const onShowBar = jest.fn();
  await renderWithTamagui(<DiscoverShelves shelves={shelves} onKind={onKind} onShowBar={onShowBar} />);

  expect(screen.getByRole('heading', { name: 'On menus around you' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Martinis, three ways' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Zero-proof near you' })).toBeNull();
  expect(screen.getAllByRole('link', { name: 'Drink 1. Bar a. Nolita' })).toHaveLength(2);
  await fireEvent(screen.getAllByRole('link', { name: 'Drink 1. Bar a. Nolita' })[0], 'hoverIn');
  expect(onShowBar).toHaveBeenCalledWith('a');

  await fireEvent.press(screen.getByRole('link', { name: 'Based on your taste. Open your taste' }));
  expect(mockPush).toHaveBeenCalledWith('/taste');

  // The first shelf is the list below, so it has no See all.
  expect(screen.queryByRole('button', { name: 'See all: On menus around you' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'See all: Martinis, three ways' }));
  expect(onKind).toHaveBeenCalledWith('martini');
});

test('how far sits on the picture, in miles or kilometres as the device measures', async () => {
  const around = [drink('1', 'a'), drink('2', 'b'), drink('3', 'c')];
  const shelves = pickShelves({ where: 'near you', around, style: null, styled: [], zero: [] });
  await renderWithTamagui(
    <BarAway.Provider value={() => '0.2 mi'}>
      <DiscoverShelves shelves={shelves} />
    </BarAway.Provider>,
  );
  expect(screen.getByRole('link', { name: 'Drink 1. Bar a. 0.2 mi' })).toBeTruthy();
  expect(screen.getAllByText('0.2 mi')).toHaveLength(3);
  // No taste behind it: the plain note, not a link to the taste page.
  expect(screen.getByText('One from each bar')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Open your taste/ })).toBeNull();
});

test('no shelves, nothing at all', async () => {
  const shelves = pickShelves({ where: 'near you', around: [drink('1', 'a'), drink('2', 'a')], style: null, styled: [], zero: [] });
  await renderWithTamagui(<DiscoverShelves shelves={shelves} />);
  expect(screen.queryByRole('heading')).toBeNull();
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
  await renderWithTamagui(<TileGrid drinks={drinks} showAll="Show all 10 drinks" />);
  // Before layout: three across, so six.
  expect(screen.getAllByRole('link')).toHaveLength(6);
  await fireEvent.press(screen.getByRole('button', { name: 'Show all 10 drinks' }));
  expect(screen.getAllByRole('link')).toHaveLength(10);
  expect(screen.getByText('Show fewer')).toBeTruthy();
});
