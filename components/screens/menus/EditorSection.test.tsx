import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { EditSection } from '@/lib/menuLayout';
import type { MenuDrink } from '@/types/menus';

import { EditorSection } from './EditorSection';

const MockView = View;
jest.mock('expo-image', () => ({ Image: () => <MockView /> }));
jest.mock('@/components/ds/DrawnSketch', () => ({ DrawnSketch: () => null }));
// The plain drag list: the nested one (native, inside the editor's scroll container) loops under Jest's gesture mocks.
jest.mock('@/components/recipe/FormScrollContainer', () => ({ ...jest.requireActual('@/components/recipe/FormScrollContainer'), supportsNestableDrag: false }));

const drink = (id: string, name: string): MenuDrink => ({ id, name, kind: 'cocktail', line: '', price: '12', imageUrl: 'https://x.test/a.jpg', isSketch: false, glass: null });
const section: EditSection = { key: 's1', id: 's1', name: 'Drinks', minItems: 0, maxItems: null, allowedTypes: [], drinks: [drink('a', 'Americano'), drink('b', 'Pellican'), drink('c', 'Dirty Martini')] };

async function renderSection() {
  const onMove = jest.fn();
  await renderWithTamagui(
    <EditorSection section={section} onAdd={jest.fn()} onSettings={jest.fn()} onRemove={jest.fn()} onReorder={jest.fn()} onMove={onMove} />
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
  expect(screen.getByRole('button', { name: 'Remove Pellican' })).toBeTruthy();
});
