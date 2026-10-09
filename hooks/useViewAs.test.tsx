import { renderHook } from '@testing-library/react-native';

import { useCanEditItem, useEffectiveRole, useMaxRealRole } from '@/hooks/useViewAs';

// Query results by the first queryKey segment: 'bars' (useBars), 'viewAs' and
// 'canEditItem' (the can_edit_item RPC).
let mockQueryData: Record<string, unknown> = {};

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: mockQueryData[queryKey[0]], isLoading: false }),
  useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useQueryClient: () => ({}),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'user-1' } })));

const bars = [
  { bar_id: 'admin-bar', role_level: 40 },
  { bar_id: 'staff-bar', role_level: 20 },
];

async function renderValue<T>(hook: () => T, data: Record<string, unknown>) {
  mockQueryData = data;
  const { result, unmount } = await renderHook(hook);
  await unmount();
  return result.current;
}

describe('useEffectiveRole', () => {
  test('uses the role at that venue', async () => {
    expect(await renderValue(() => useEffectiveRole('admin-bar'), { bars })).toBe(40);
    expect(await renderValue(() => useEffectiveRole('staff-bar'), { bars })).toBe(20);
  });

  test('view-as lowers the role but never raises it', async () => {
    expect(await renderValue(() => useEffectiveRole('admin-bar'), { bars, viewAs: 30 })).toBe(30);
    expect(await renderValue(() => useEffectiveRole('staff-bar'), { bars, viewAs: 30 })).toBe(20);
  });

  test('no venue is a guest', async () => {
    expect(await renderValue(() => useEffectiveRole(null), { bars })).toBe(10);
  });

  test('is Guest for an unknown venue or while bars are loading', async () => {
    expect(await renderValue(() => useEffectiveRole('other-bar'), { bars })).toBe(10);
    expect(await renderValue(() => useEffectiveRole('admin-bar'), { bars: undefined })).toBe(10);
  });
});

describe('useCanEditItem', () => {
  const adminBarItem = { id: 'sour', bar_id: 'admin-bar' };
  const staffBarItem = { id: 'fizz', bar_id: 'staff-bar' };
  const sharedItem = { id: 'gin', bar_id: null };

  test('uses the role at the item\'s venue', async () => {
    expect(await renderValue(() => useCanEditItem(adminBarItem), { bars })).toBe(true);
    expect(await renderValue(() => useCanEditItem(staffBarItem), { bars })).toBe(false);
  });

  test('view-as caps the venue role', async () => {
    expect(await renderValue(() => useCanEditItem(adminBarItem), { bars, viewAs: 35 })).toBe(true);
    expect(await renderValue(() => useCanEditItem(adminBarItem), { bars, viewAs: 30 })).toBe(false);
  });

  test('a venue item ignores the shared-item answer', async () => {
    expect(await renderValue(() => useCanEditItem(staffBarItem), { bars, canEditItem: true })).toBe(false);
  });

  test('a shared item follows the server: its creator or a catalog admin', async () => {
    expect(await renderValue(() => useCanEditItem(sharedItem), { bars, canEditItem: true })).toBe(true);
    expect(await renderValue(() => useCanEditItem(sharedItem), { bars, canEditItem: false })).toBe(false);
    expect(await renderValue(() => useCanEditItem(sharedItem), { bars })).toBe(false);
  });

  test('view-as below Drink Creator hides editing on shared items too', async () => {
    expect(await renderValue(() => useCanEditItem(sharedItem), { bars, canEditItem: true, viewAs: 35 })).toBe(true);
    expect(await renderValue(() => useCanEditItem(sharedItem), { bars, canEditItem: true, viewAs: 30 })).toBe(false);
    expect(await renderValue(() => useCanEditItem(sharedItem), { bars, canEditItem: true, viewAs: 10 })).toBe(false);
  });

  test('is false while the item is loading', async () => {
    expect(await renderValue(() => useCanEditItem(undefined), { bars, canEditItem: true })).toBe(false);
  });
});

test('useMaxRealRole is the highest real membership, Guest with none', async () => {
  expect(await renderValue(() => useMaxRealRole(), { bars })).toBe(40);
  expect(await renderValue(() => useMaxRealRole(), { bars: [] })).toBe(10);
});
