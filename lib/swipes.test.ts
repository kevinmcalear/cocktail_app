import { usePendingWants } from '@/store/usePendingWants';

import { settlePendingWants } from './swipes';

const mockInsert = jest.fn();
let mockError: { code: string } | null = null;
jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ insert: async (rows: unknown) => (mockInsert(rows), { error: mockError }) }) },
}));

beforeEach(() => {
  mockInsert.mockReset();
  mockError = null;
  usePendingWants.getState().clear();
});

// Second look 12 Nov: first run's Wants held for the age check were lost if the person never confirmed
// in that screen. They wait on the device until the age check answers.
test('held Wants wait while the age is unknown, save once it is confirmed, and drop when it is under age', async () => {
  usePendingWants.getState().hold(['a', 'b']);
  expect(await settlePendingWants('unknown')).toBe(false);
  expect(mockInsert).not.toHaveBeenCalled();
  expect(usePendingWants.getState().ids).toEqual(['a', 'b']);

  expect(await settlePendingWants('confirmed')).toBe(true);
  expect(mockInsert).toHaveBeenCalledWith([
    { kind: 'drink', item_id: 'a', source: 'swipe' },
    { kind: 'drink', item_id: 'b', source: 'swipe' },
  ]);
  expect(usePendingWants.getState().ids).toEqual([]);

  usePendingWants.getState().hold(['c']);
  expect(await settlePendingWants('under_age')).toBe(false);
  expect(usePendingWants.getState().ids).toEqual([]);
  expect(mockInsert).toHaveBeenCalledTimes(1);
});

test('a save that fails keeps them for the next answer', async () => {
  usePendingWants.getState().hold(['a']);
  mockError = { code: '500' };
  expect(await settlePendingWants('confirmed')).toBe(false);
  expect(usePendingWants.getState().ids).toEqual(['a']);
});
