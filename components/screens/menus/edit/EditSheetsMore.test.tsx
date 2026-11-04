import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { MenuDrink } from '@/types/menus';

import type { LayoutEditor } from '../useLayoutEditor';
import { RowMenuSheet } from './EditSheetsMore';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
// Only Americano is the person's own to delete.
jest.mock('@/hooks/useCocktails', () => ({ useCanDeleteDrink: (id?: string) => id === 'a' }));
jest.mock('@/hooks/useMenuMutations', () => ({ useCreateMenu: () => ({}), useSaveLayout: () => ({}), useSetMenuEnd: () => ({}) }));

const drink = (id: string, name: string): MenuDrink => ({ id, name, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: false, glass: null });
const sections = [
  { key: 's1', id: 's1', name: 'Stirred', minItems: 0, maxItems: null, allowedTypes: [], drinks: [drink('a', 'Americano'), drink('b', 'Pellican')] },
  { key: 's2', id: 's2', name: 'Shaken', minItems: 0, maxItems: null, allowedTypes: [], drinks: [] },
];
const editor = () =>
  ({ layout: { sections }, section: (k: string) => sections.find((s) => s.key === k) ?? null, moveTo: jest.fn(), move: jest.fn(), deleteDrink: jest.fn() }) as unknown as LayoutEditor & {
    moveTo: jest.Mock;
    move: jest.Mock;
    deleteDrink: jest.Mock;
  };

test('a row’s menu moves a drink to another section or to the top, and opens it', async () => {
  const ed = editor();
  await renderWithProviders(<RowMenuSheet editor={ed} sectionKey="s1" drink={sections[0].drinks[1]} onClose={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Delete drink' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Move to top' }));
  expect(ed.move).toHaveBeenCalledWith('s1', 1, 0);
  await fireEvent.press(screen.getByRole('button', { name: 'Move to another section' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Shaken' }));
  expect(ed.moveTo).toHaveBeenCalledWith('s1', 'b', 's2');
});

test('Delete drink shows only for a drink the person may delete', async () => {
  const ed = editor();
  await renderWithProviders(<RowMenuSheet editor={ed} sectionKey="s1" drink={sections[0].drinks[0]} onClose={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Move to top' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete drink' }));
  expect(ed.deleteDrink).toHaveBeenCalledWith(sections[0].drinks[0]);
});
