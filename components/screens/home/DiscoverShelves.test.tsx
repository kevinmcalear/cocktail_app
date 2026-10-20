import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { pickShelves } from '@/lib/discoverShelves';

import { BarAway } from './DrinksAtBars';
import { DiscoverShelves } from './DiscoverShelves';

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
  const shelves = pickShelves({ where: 'near you', around, style: 'martini', styled: around, zero: around.slice(0, 2) });
  const onKind = jest.fn();
  const onShowBar = jest.fn();
  await renderWithTamagui(<DiscoverShelves shelves={shelves} onKind={onKind} onShowBar={onShowBar} />);

  expect(screen.getByRole('heading', { name: 'On menus around you' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Martinis, three ways' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Zero-proof near you' })).toBeNull();
  expect(screen.getAllByRole('link', { name: 'Drink 1. Bar a. Nolita' })).toHaveLength(2);
  await fireEvent(screen.getAllByRole('link', { name: 'Drink 1. Bar a. Nolita' })[0], 'hoverIn');
  expect(onShowBar).toHaveBeenCalledWith('a');

  expect(screen.getByText('Based on your taste')).toBeTruthy();
  await fireEvent.press(screen.getByText('Based on your taste'));
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
});

test('no shelves, nothing at all', async () => {
  const shelves = pickShelves({ where: 'near you', around: [drink('1', 'a'), drink('2', 'a')], style: null, styled: [], zero: [] });
  await renderWithTamagui(<DiscoverShelves shelves={shelves} />);
  expect(screen.queryByRole('heading')).toBeNull();
});
