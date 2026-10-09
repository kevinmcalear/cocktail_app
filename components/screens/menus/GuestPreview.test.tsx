import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MenuDrink } from '@/types/menus';

import { GuestPreview } from './GuestPreview';
import type { LayoutEditor } from './useLayoutEditor';

const MockView = View;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useCocktails', () => ({ usePrefetchCocktail: () => jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => <MockView /> }));
jest.mock('@/components/ds/DrawnSketch', () => ({ DrawnSketch: () => null }));

const drink = (id: string, name: string): MenuDrink => ({ id, name, kind: 'cocktail', line: 'Gin, vermouth', price: null, imageUrl: null, isSketch: false, glass: null });

// Only what the preview reads: the layout as it stands in the editor, not the saved menu.
const editor = (name: string, drinks: MenuDrink[]) =>
  ({
    menu: { id: 'm1', startsAt: null },
    layout: { name, sections: [{ key: 'k1', id: null, name: 'Drinks', minItems: 0, maxItems: null, allowedTypes: [], drinks }] },
  }) as unknown as LayoutEditor;

test('the preview sets the unsaved layout as the guest card', async () => {
  await renderWithTamagui(<GuestPreview editor={editor('Halloween party', [drink('a', 'Americano'), drink('b', 'Pellican')])} venue={null} />);
  expect(screen.getByRole('heading', { name: 'Halloween party' })).toBeTruthy();
  expect(screen.getByText('Americano')).toBeTruthy();
  expect(screen.getByText('Pellican')).toBeTruthy();
  expect(screen.getByText('Sketch')).toBeTruthy();
  expect(screen.queryByText(/Add drinks and they show up here/)).toBeNull();
});

test('an empty menu says what will show up there', async () => {
  await renderWithTamagui(<GuestPreview editor={editor('', [])} venue={null} />);
  expect(screen.getByRole('heading', { name: 'Menu' })).toBeTruthy();
  expect(screen.getByText(/Add drinks and they show up here/)).toBeTruthy();
});
