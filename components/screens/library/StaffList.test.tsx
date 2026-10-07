import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { StaffList } from './StaffList';

const mockMutate = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useDiscover', () => ({
  useDrinkLists: () => ({ data: [{ id: 'catalog-daiquiri', name: 'Daiquiri' }] }),
}));
jest.mock('@/hooks/useStaffList', () => ({
  useStaffList: () => ({
    data: [
      { itemId: 'martini', rank: 1, name: 'Martini', classicName: null, imageUrl: null },
      { itemId: 'negroni', rank: 2, name: 'Negroni', classicName: null, imageUrl: null },
      { itemId: 'paloma', rank: 11, name: 'Paloma', classicName: null, imageUrl: null },
      { itemId: 'daiquiri', rank: null, name: 'House Daiquiri', classicName: 'Daiquiri', imageUrl: null },
    ],
    isLoading: false,
    error: null,
  }),
  useBarRiffs: () => ({ data: [] }),
  useStaffListEdit: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

beforeEach(() => mockMutate.mockClear());

test('reads in rank order with cut lines at 10 and 20, then the unranked', async () => {
  await renderWithTamagui(<StaffList barId="bar" canEdit={false} opensAt="Drink Creator" />);
  expect(screen.getByText('Top 10')).toBeTruthy();
  expect(screen.getByText('Top 20')).toBeTruthy();
  expect(screen.queryByText('Top 50')).toBeNull();
  expect(screen.getByText('Also on the list')).toBeTruthy();
  expect(screen.getByText('Ordering this list opens at Drink Creator.')).toBeTruthy();
  expect(screen.queryByText('Edit the list')).toBeNull();
});

test('a Drink Creator moves a drink up, ranks one, and takes one out', async () => {
  await renderWithTamagui(<StaffList barId="bar" canEdit opensAt="Drink Creator" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Edit the list' }));

  await fireEvent.press(screen.getByLabelText('Move Paloma up'));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: ['martini', 'paloma', 'negroni'] });

  await fireEvent.press(screen.getByLabelText('Rank House Daiquiri at the end'));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: ['martini', 'negroni', 'paloma', 'daiquiri'] });

  await fireEvent.press(screen.getByLabelText('Take Martini out of the ranking'));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: ['negroni', 'paloma'] });

  await fireEvent.press(screen.getByLabelText('Remove House Daiquiri from the staff list'));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'remove', itemId: 'daiquiri' });
});

test('the top drink can’t move up', async () => {
  await renderWithTamagui(<StaffList barId="bar" canEdit opensAt="Drink Creator" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Edit the list' }));
  await fireEvent.press(screen.getByLabelText('Move Martini up'));
  expect(mockMutate).not.toHaveBeenCalled();
});
