import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithProviders } from '@/jest.setup';
import type { EditSection as Section } from '@/lib/menuLayout';
import type { MenuDrink } from '@/types/menus';

import { EMPTY_DRAFT } from '@/lib/drinkWizard';
import { draftSlot, useDrinkWizardStore } from '@/store/useDrinkWizardStore';

import { EditSection } from './EditSection';

const MockView = View;
jest.mock('expo-image', () => ({ Image: () => <MockView /> }));
const mockPush = jest.fn();
const mockOpen = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/ds/DrawnSketch', () => ({ DrawnSketch: () => null }));
jest.mock('@/hooks/useSuggestedPrice', () => ({ useSuggestedPrice: () => null }));
jest.mock('../page/MenuDrawing', () => ({ MenuDrawing: () => null }));

const drink = (id: string, name: string): MenuDrink => ({ id, name, kind: 'cocktail', line: '', price: '12', imageUrl: null, isSketch: false, glass: null });
const section: Section = { key: 's1', id: 's1', name: 'Stirred', minItems: 0, maxItems: null, allowedTypes: [], drinks: [drink('a', 'Americano'), drink('b', 'Pellican'), drink('c', 'Dirty Martini')] };

async function renderSection(over: Partial<Section> = {}, props: { onRemove?: jest.Mock; onAdd?: jest.Mock; onSettings?: jest.Mock; priced?: boolean } = {}) {
  const onMove = jest.fn();
  await renderWithProviders(
    <EditSection
      section={{ ...section, ...over }}
      barId={null}
      ink="colour"
      made={['b']}
      onSettings={props.onSettings ?? jest.fn()}
      onAdd={props.onAdd ?? jest.fn()}
      onRemove={props.onRemove ?? jest.fn()}
      onReorder={jest.fn()}
      onMove={onMove}
      onOpen={mockOpen}
      pricing={props.priced ? () => ({ menuName: 'Autumn', barId: 'bar', onPrice: jest.fn(), onMenuPrice: jest.fn() }) : undefined}
      elsewhere={{}}
    />
  );
  return onMove;
}

const key = (name: string, k: string) => fireEvent(screen.getByRole('button', { name: `Reorder ${name}` }), 'keyDown', { key: k, preventDefault: jest.fn() });

test('the focused handle moves its drink with the arrow keys, and stops at the ends', async () => {
  const onMove = await renderSection();
  await key('Pellican', 'ArrowUp');
  await key('Pellican', 'ArrowDown');
  await key('Americano', 'ArrowUp');
  await key('Dirty Martini', 'ArrowDown');
  await key('Pellican', 'Enter');
  expect(onMove.mock.calls).toEqual([
    [1, 0],
    [1, 2],
  ]);
});

test('each row has a minus that takes it off, the pencil opens the section, and the last row adds to it', async () => {
  const onRemove = jest.fn();
  const onAdd = jest.fn();
  const onSettings = jest.fn();
  await renderSection({}, { onRemove, onAdd, onSettings });
  await fireEvent.press(screen.getByRole('button', { name: 'Take Pellican off this menu' }));
  expect(onRemove).toHaveBeenCalledWith('b');
  await fireEvent.press(screen.getByRole('button', { name: 'Add a drink to Stirred' }));
  expect(onAdd).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Stirred: rename, rules, move, paste a list' }));
  expect(onSettings).toHaveBeenCalled();
  expect(screen.getByText('New')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Pellican: move, open, delete' }));
  expect(mockOpen).toHaveBeenCalledWith(section.drinks[1]);
  expect(screen.queryByRole('button', { name: /price 12/ })).toBeNull();
});

test('a venue row’s price box opens the drink’s price and this menu’s under it', async () => {
  await renderSection({}, { priced: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Americano: price 12. Change it' }));
  expect(screen.getByText('On Autumn only')).toBeTruthy();
});

test('a section short of its rule says so in one amber line', async () => {
  await renderSection({ allowedTypes: ['cocktail', 'beer', 'wine'], minItems: 4, maxItems: 5 });
  expect(screen.getByText('4 to 5 drinks · 3 in · needs one more')).toBeTruthy();
});

test('a drink started for the section and not saved shows on it, and Keep going opens its draft', async () => {
  const kept = (name: string, updatedAt: number) => ({ draft: { ...EMPTY_DRAFT, id: name, name }, step: 'ingredients' as const, updatedAt });
  useDrinkWizardStore.setState({ kept: { [draftSlot('home', { menuSectionId: 's1', name: 'Salty Boy' })]: kept('Salty Boy', 2) } });
  await renderSection();
  await fireEvent.press(screen.getByRole('button', { name: 'Salty Boy, draft. Keep going' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/add-cocktail', params: { menuSectionId: 's1', name: 'salty boy' } });
  useDrinkWizardStore.setState({ kept: {} });
});
