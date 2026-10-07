import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { StaffList } from './StaffList';

const show = (canEdit: boolean) => renderWithTamagui(<StaffList barId="bar" canEdit={canEdit} onNow={onNow} past={past} />);

const mockMutate = jest.fn();
const onNow = new Set(['d1']);
const past = new Set(['paloma']);

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useDiscover', () => ({
  useDrinkLists: () => ({ data: [{ id: 'catalog-daiquiri', name: 'Daiquiri' }] }),
}));
jest.mock('@/hooks/useStaffList', () => ({
  useStaffList: () => ({
    data: [
      ...Array.from({ length: 10 }, (_, i) => ({ itemId: `d${i + 1}`, rank: i + 1, name: `Drink ${i + 1}`, classicName: null, imageUrl: null })),
      { itemId: 'paloma', rank: 11, name: 'Paloma', classicName: null, imageUrl: null },
      { itemId: 'daiquiri', rank: null, name: 'House Daiquiri', classicName: 'Daiquiri', imageUrl: null },
    ],
    isLoading: false,
    error: null,
  }),
  useBarRiffs: () => ({ data: [] }),
  useStaffListEdit: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

const ranked = [...Array.from({ length: 10 }, (_, i) => `d${i + 1}`), 'paloma'];

beforeEach(() => mockMutate.mockClear());

test('reads in order with where each drink stands, and a cut line after the top 10', async () => {
  await show(false);
  expect(screen.getByText('TOP 10')).toBeTruthy();
  expect(screen.queryByText('TOP 20')).toBeNull();
  expect(screen.getByLabelText('1. Drink 1 On menu, open')).toBeTruthy();
  expect(screen.getByLabelText('2. Drink 2 Off menu, open')).toBeTruthy();
  expect(screen.getByLabelText('11. Paloma Past, open')).toBeTruthy();
  expect(screen.getByText('NOT RANKED')).toBeTruthy();
  expect(screen.queryByLabelText('Reorder Paloma')).toBeNull();
  expect(screen.queryByText('Add a drink')).toBeNull();
});

test('a Drink Creator moves a drink with the buttons behind its grip', async () => {
  await show(true);
  await fireEvent.press(screen.getByLabelText('Reorder Paloma'));
  await fireEvent.press(screen.getByRole('button', { name: 'Move up' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: [...ranked.slice(0, 9), 'paloma', 'd10'] });

  await fireEvent.press(screen.getByRole('button', { name: 'Take out of the ranking' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: ranked.slice(0, 10) });
});

test('screen readers move a drink with actions on its grip', async () => {
  await show(true);
  await fireEvent(screen.getByLabelText('Reorder Drink 2'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: ['d2', 'd1', ...ranked.slice(2)] });
});

test('ranks an unranked drink at the end, and removes one', async () => {
  await show(true);
  await fireEvent.press(screen.getByLabelText('Change House Daiquiri'));
  await fireEvent.press(screen.getByRole('button', { name: 'Rank it' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: [...ranked, 'daiquiri'] });
  await fireEvent.press(screen.getByRole('button', { name: 'Remove from the list' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'remove', itemId: 'daiquiri' });
});
