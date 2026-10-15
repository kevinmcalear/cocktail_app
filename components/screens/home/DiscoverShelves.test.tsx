import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { pickShelves } from '@/lib/discoverShelves';

import { DiscoverShelves } from './DiscoverShelves';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useCocktails', () => ({ usePrefetchCocktail: () => () => {} }));

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
  await renderWithTamagui(<DiscoverShelves shelves={shelves} onKind={onKind} />);

  expect(screen.getByRole('heading', { name: 'On menus around you' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Martinis, three ways' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Zero-proof near you' })).toBeNull();
  expect(screen.getAllByRole('link', { name: 'Drink 1. Bar a · Nolita' })).toHaveLength(2);

  // The first shelf is the list below, so it has no See all.
  expect(screen.queryByRole('button', { name: 'See all: On menus around you' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'See all: Martinis, three ways' }));
  expect(onKind).toHaveBeenCalledWith('martini');
});

test('no shelves, nothing at all', async () => {
  const shelves = pickShelves({ where: 'near you', around: [drink('1', 'a'), drink('2', 'a')], style: null, styled: [], zero: [] });
  await renderWithTamagui(<DiscoverShelves shelves={shelves} />);
  expect(screen.queryByRole('heading')).toBeNull();
});
