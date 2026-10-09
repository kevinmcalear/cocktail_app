import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { MenuDrink } from '@/types/menus';

import { GoLiveSheet } from './GoLiveSheet';

const MockView = View;
const mockSchedule = jest.fn();
jest.mock('@/hooks/useMenuMutations', () => ({ useScheduleMenu: () => ({ mutateAsync: mockSchedule, isPending: false }) }));
jest.mock('expo-image', () => ({ Image: () => <MockView /> }));
jest.mock('@/components/ds/DrawnSketch', () => ({ DrawnSketch: () => null }));

const drink = (id: string): MenuDrink => ({ id, name: id, kind: 'cocktail', line: '', price: '12', imageUrl: 'https://x.test/a.jpg', isSketch: false, glass: null });
const menu = (drinks: number) => ({
  id: 'm1',
  name: 'Winter menu',
  barId: 'bar',
  coverUrl: null,
  coverPosition: 50,
  sections: [{ id: 's1', name: 'Stirred', minItems: 2, maxItems: null, allowedTypes: [], drinks: Array.from({ length: drinks }, (_, i) => drink(`d${i}`)) }],
});

beforeEach(() => mockSchedule.mockReset());

test('a short section stops it going on, and says so', async () => {
  await renderWithTamagui(<GoLiveSheet visible onClose={jest.fn()} menu={menu(1)} others={[]} onDone={jest.fn()} />);
  expect(screen.getByText('Stirred needs 1 more drink')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Put it on now' })).toBeDisabled();
});

test('the When answer opens its choices in place, and the button follows it', async () => {
  const onDone = jest.fn();
  await renderWithTamagui(<GoLiveSheet visible onClose={jest.fn()} menu={menu(2)} others={[]} onDone={onDone} />);
  expect(screen.queryByRole('radio', { name: 'Tomorrow' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'When: Now' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Tomorrow' }));
  expect(screen.getByRole('button', { name: /^When: Tomorrow, / })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Schedule for / }));
  expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({ menuId: 'm1', replaceIds: [] }));
  expect(mockSchedule.mock.calls[0][0].startsAt).not.toBeNull();
  expect(onDone).toHaveBeenCalled();
});
