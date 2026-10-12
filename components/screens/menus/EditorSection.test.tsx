import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { EditSection } from '@/lib/menuLayout';
import type { MenuDrink } from '@/types/menus';

import { EditorSection } from './EditorSection';

const MockView = View;
jest.mock('expo-image', () => ({ Image: () => <MockView /> }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/ds/DrawnSketch', () => ({ DrawnSketch: () => null }));
// The plain drag list: the nested one (native, inside the editor's scroll container) loops under Jest's gesture mocks.
jest.mock('@/components/recipe/FormScrollContainer', () => ({ ...jest.requireActual('@/components/recipe/FormScrollContainer'), supportsNestableDrag: false }));

const drink = (id: string, name: string): MenuDrink => ({ id, name, kind: 'cocktail', line: '', price: '12', imageUrl: 'https://x.test/a.jpg', isSketch: false, glass: null });
const section: EditSection = { key: 's1', id: 's1', name: 'Drinks', minItems: 0, maxItems: null, allowedTypes: [], drinks: [drink('a', 'Americano'), drink('b', 'Pellican'), drink('c', 'Dirty Martini')] };

const other: EditSection = { ...section, key: 's2', id: 's2', name: 'Sours', drinks: [] };
const onMoveTo = jest.fn();

async function renderSection() {
  const onMove = jest.fn();
  await renderWithTamagui(
    <EditorSection section={section} sections={[section, other]} onSettings={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onMove={onMove} onMoveTo={onMoveTo} />
  );
  return onMove;
}

const key = (name: string, k: string) => fireEvent(screen.getByRole('button', { name: `Reorder ${name}` }), 'keyDown', { key: k, preventDefault: jest.fn() });

test('the focused grip moves its drink with the arrow keys, and stops at the ends', async () => {
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

test('rows have no up and down buttons: drag, keys and the screen reader actions move drinks', async () => {
  await renderSection();
  expect(screen.queryByRole('button', { name: /^Move .* (up|down)$/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Pellican options' })).toBeTruthy();
});

test('a row’s ... menu moves a drink to another section, or to the top', async () => {
  const onMove = await renderSection();
  await fireEvent.press(screen.getByRole('button', { name: 'Pellican options' }));
  expect(screen.getByRole('button', { name: 'Open the drink' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Move to top' }));
  expect(onMove).toHaveBeenLastCalledWith(1, 0);
  await fireEvent.press(screen.getByRole('button', { name: 'Pellican options' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to another section' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sours' }));
  expect(onMoveTo).toHaveBeenLastCalledWith('b', 's2');
});

test('one amber line says what the section needs, and no Add a drink without onAdd', async () => {
  await renderWithTamagui(
    <EditorSection section={{ ...section, allowedTypes: ['cocktail', 'beer', 'wine'], minItems: 4, maxItems: 5 }} sections={[section]} onSettings={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onMove={jest.fn()} onMoveTo={jest.fn()} />
  );
  expect(screen.getByText('4 to 5 drinks · 3 in · needs one more')).toBeTruthy();
  expect(screen.queryByText('Add a drink')).toBeNull();
});
