import { act, renderHook } from '@testing-library/react-native';

import { useBottleToast, type BottleDone } from './useBottleToast';

const mockShow = jest.fn();
const mockUndo = jest.fn();
const mockPutBack = jest.fn();
const mockPointBack = jest.fn();
const mockRestock = jest.fn();

jest.mock('@/components/ds', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/hooks/useBulk', () => ({ useUndoSwap: () => ({ mutateAsync: mockUndo }) }));
jest.mock('@/hooks/useBackBar', () => ({
  useBottleSpots: () => ({ putBack: { mutateAsync: mockPutBack }, pointBack: { mutateAsync: mockPointBack }, restock: { mutateAsync: mockRestock } }),
}));

const SPOT = { id: 'spot-1', bar_id: 'rye', item_id: 'vida', zone_id: 'z', shelf: null, container: null, photo_url: null, par_amount: null, par_unit: null, sort_order: 1 };
const STOCK = { item_id: 'vida', source: 'drink' as const, from_name: 'Ash Garden', added_at: '2026-10-01T12:00:00.000Z' };
const OFF: BottleDone = { title: 'Vida is off the back bar', bottle: { id: 'vida', name: 'Vida' }, replaceWith: null, undone: [], moved: [], removed: [SPOT], stock: STOCK };

async function undoIt(done: BottleDone) {
  const { result } = await renderHook(() => useBottleToast('rye'));
  result.current(done);
  await act(async () => {
    mockShow.mock.calls[0][0].action.onPress();
  });
}

beforeEach(() => jest.clearAllMocks());

test('Undo after Take it off puts the spots and the stock row back', async () => {
  await undoIt(OFF);
  expect(mockPutBack).toHaveBeenCalledWith([SPOT]);
  expect(mockRestock).toHaveBeenCalledWith(STOCK);
  expect(mockShow).toHaveBeenCalledTimes(1);
});

test('spots that cannot go back still leave the stock row back, and it says so', async () => {
  mockPutBack.mockRejectedValueOnce(new Error('zone gone'));
  await undoIt(OFF);
  expect(mockRestock).toHaveBeenCalledWith(STOCK);
  expect(mockShow).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Couldn’t undo all of it' }));
});
