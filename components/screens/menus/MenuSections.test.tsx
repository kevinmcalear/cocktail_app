import { screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MenuDrink } from '@/types/menus';

import { MenuSections } from './MenuSections';

const MockView = View;
const MockText = Text;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useCocktails', () => ({ usePrefetchCocktail: () => jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => <MockView testID="photo" /> }));
// The drawing itself needs the drink's sketch inputs from the server; the test only needs to know which drink it draws.
jest.mock('@/components/ds/DrawnSketch', () => ({ DrawnSketch: ({ itemId }: { itemId: string }) => <MockText testID="sketch">{itemId}</MockText> }));

const drink = (id: string, name: string, imageUrl: string | null): MenuDrink => ({ id, name, kind: 'cocktail', line: 'Gin, vermouth', price: null, imageUrl, isSketch: false, glass: null });
const sections = [{ id: 's1', name: 'Drinks', drinks: [drink('d1', 'Americano', 'https://x.test/americano.jpg'), drink('d2', 'Pellican', null)] }];
const hidden = { includeHiddenElements: true };

test('the guest card shows each drink’s photo, or its sketch drawn from its own id, with one Sketch note', async () => {
  await renderWithTamagui(<MenuSections sections={sections} variant="card" pictures="above" />);
  expect(screen.getAllByTestId('photo', hidden)).toHaveLength(1);
  expect(screen.getByTestId('sketch', hidden).props.children).toBe('d2');
  expect(screen.getByText('Sketch')).toBeTruthy();
  expect(screen.getByText('Pellican')).toBeTruthy();
});

test('beside the names, a card of photos needs no Sketch note', async () => {
  const photos = [{ ...sections[0], drinks: [sections[0].drinks[0]] }];
  await renderWithTamagui(<MenuSections sections={photos} variant="card" pictures="beside" />);
  expect(screen.getAllByTestId('photo', hidden)).toHaveLength(1);
  expect(screen.queryByText('Sketch')).toBeNull();
});

test('with pictures off, the card is names and lines only', async () => {
  await renderWithTamagui(<MenuSections sections={sections} variant="card" pictures="none" />);
  expect(screen.queryByTestId('photo', hidden)).toBeNull();
  expect(screen.queryByTestId('sketch', hidden)).toBeNull();
  expect(screen.queryByText('Sketch')).toBeNull();
  expect(screen.getByText('Americano')).toBeTruthy();
});
