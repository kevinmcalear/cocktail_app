import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { StaffList } from './StaffList';

const show = (canEdit: boolean) => renderWithProviders(<StaffList barId="bar" canEdit={canEdit} onNow={onNow} past={past} />);

const mockMutate = jest.fn();
// Drinks here linked to a classic; the staff list's own linked drink is among them.
let mockLinked: { id: string; name: string; classicName: string }[] = [];
const onNow = new Set(['d1']);
const past = new Set(['paloma']);

// The real list, with its last props kept so a test can drop rows on it.
type MockRow = { itemId: string };
const mockList: { props: { data: MockRow[]; onDragEnd: (e: { data: MockRow[]; from: number; to: number }) => void }; orders: string[] } = { props: { data: [], onDragEnd: () => {} }, orders: [] };
jest.mock('react-native-draggable-flatlist', () => {
  const real = jest.requireActual('react-native-draggable-flatlist');
  const { createElement, forwardRef } = jest.requireActual('react');
  return {
    ...real,
    __esModule: true,
    default: forwardRef((props: typeof mockList.props, ref: unknown) => {
      mockList.props = props;
      mockList.orders.push(props.data.map((r) => r.itemId).join());
      return createElement(real.default, { ...props, ref });
    }),
  };
});
jest.mock('expo-router',() => ({ useRouter: () => ({ push: jest.fn() }) }));
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
  useBarRiffs: () => ({ data: mockLinked }),
  useStaffListEdit: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

const ranked = [...Array.from({ length: 10 }, (_, i) => `d${i + 1}`), 'paloma'];

beforeEach(() => {
  mockMutate.mockClear();
  mockLinked = [];
});

test('reads in order with where each drink stands, and a cut line after the top 10', async () => {
  await show(false);
  expect(screen.getByText('TOP 10')).toBeTruthy();
  expect(screen.queryByText('TOP 20')).toBeNull();
  expect(screen.getByLabelText('1. Drink 1 On menu, open')).toBeTruthy();
  expect(screen.getByLabelText('2. Drink 2 Off menu, open')).toBeTruthy();
  expect(screen.getByLabelText('11. Paloma Old drink, open')).toBeTruthy();
  expect(screen.getByText('NOT RANKED YET · 1')).toBeTruthy();
  expect(screen.queryByLabelText('Move Paloma')).toBeNull();
  expect(screen.queryByText('Add a drink')).toBeNull();
});

test('a Drink Creator moves a drink with the buttons behind its grip', async () => {
  await show(true);
  await fireEvent.press(screen.getByLabelText('Move Paloma'));
  await fireEvent.press(screen.getByRole('button', { name: 'Move up' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: [...ranked.slice(0, 9), 'paloma', 'd10'] });

  await fireEvent.press(screen.getByRole('button', { name: 'Take out of the ranking' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: ranked.slice(0, 10) });
});

test('screen readers move a drink with actions on its grip', async () => {
  await show(true);
  await fireEvent(screen.getByLabelText('Move Drink 2'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: ['d2', 'd1', ...ranked.slice(2)] });
});

test('ranks an unranked drink at the end, and removes one', async () => {
  await show(true);
  await fireEvent.press(screen.getByLabelText('Move House Daiquiri'));
  await fireEvent.press(screen.getByRole('button', { name: 'Rank it' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'order', itemIds: [...ranked, 'daiquiri'] });
  await fireEvent.press(screen.getByRole('button', { name: 'Remove from the list' }));
  expect(mockMutate).toHaveBeenLastCalledWith({ op: 'remove', itemId: 'daiquiri' });
});

test('a Not ranked drink has the same grip, and every row drops chevrons', async () => {
  await show(true);
  expect(screen.getByLabelText('Move House Daiquiri')).toBeTruthy();
  expect(screen.queryByLabelText('Move Paloma up')).toBeNull();
});

test('every other drink linked to a classic sits under Not ranked yet, and ranking one puts it on the list', async () => {
  mockLinked = [
    { id: 'daiquiri', name: 'House Daiquiri', classicName: 'Daiquiri' },
    { id: 'americano', name: 'Americano', classicName: 'Americano' },
  ];
  await show(true);
  expect(screen.getByText('NOT RANKED YET · 2')).toBeTruthy();
  expect(screen.getByLabelText('Americano Off menu, open')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Move Americano'));
  expect(screen.queryByRole('button', { name: 'Remove from the list' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Rank it' }));
  expect(mockMutate).toHaveBeenLastCalledWith({
    op: 'order',
    itemIds: [...ranked, 'americano'],
    join: [{ itemId: 'americano', rank: null, name: 'Americano', classicName: 'Americano', imageUrl: null }],
  });
});

test('a drop that leaves the ranking as it was saves nothing and puts the rows back', async () => {
  mockLinked = [
    { id: 'daiquiri', name: 'House Daiquiri', classicName: 'Daiquiri' },
    { id: 'americano', name: 'Americano', classicName: 'Americano' },
  ];
  await show(true);
  const ids = () => mockList.props.data.map((r) => r.itemId);
  const before = ids();
  const rows = mockList.props.data;
  // Under the line, Americano dropped below House Daiquiri: the ranking is the same.
  const swapped = [...rows.slice(0, -2), rows[rows.length - 1], rows[rows.length - 2]];
  await act(async () => mockList.props.onDragEnd({ data: swapped, from: rows.length - 2, to: rows.length - 1 }));
  expect(mockMutate).not.toHaveBeenCalled();
  await act(async () => new Promise((r) => requestAnimationFrame(() => r(null))));
  // The list keeps rows where they were dropped until its data's order changes: it gets the drop, then the saved order.
  expect(mockList.orders.slice(-2)).toEqual([swapped.map((r) => r.itemId).join(), before.join()]);
});
