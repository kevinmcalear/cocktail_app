import { renderHook } from '@testing-library/react-native';

import { useEffectiveRole, useMaxRealRole } from '@/hooks/useViewAs';
import { useAppStore } from '@/store/useAppStore';

// Query results by the first queryKey segment: 'bars' (useBars) and 'viewAs'.
let mockQueryData: Record<string, unknown> = {};

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: mockQueryData[queryKey[0]], isLoading: false }),
  useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useQueryClient: () => ({}),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

const bars = [
  { bar_id: 'admin-bar', role_level: 40 },
  { bar_id: 'staff-bar', role_level: 20 },
];

async function renderValue<T>(hook: () => T, data: Record<string, unknown>, selectedBarId: string | null = null) {
  useAppStore.setState({ selectedBarId });
  mockQueryData = data;
  const { result, unmount } = await renderHook(hook);
  await unmount();
  return result.current;
}

describe('useEffectiveRole', () => {
  test('uses the role for the selected venue', async () => {
    expect(await renderValue(() => useEffectiveRole(), { bars }, 'admin-bar')).toBe(40);
    expect(await renderValue(() => useEffectiveRole(), { bars }, 'staff-bar')).toBe(20);
  });

  test('view-as lowers the role but never raises it', async () => {
    expect(await renderValue(() => useEffectiveRole(), { bars, viewAs: 30 }, 'admin-bar')).toBe(30);
    expect(await renderValue(() => useEffectiveRole(), { bars, viewAs: 30 }, 'staff-bar')).toBe(20);
  });

  test('an explicit venue overrides the selected one', async () => {
    expect(await renderValue(() => useEffectiveRole('staff-bar'), { bars }, 'admin-bar')).toBe(20);
  });

  test('is Guest for an unknown venue or while bars are loading', async () => {
    expect(await renderValue(() => useEffectiveRole(), { bars }, 'other-bar')).toBe(10);
    expect(await renderValue(() => useEffectiveRole(), { bars: undefined }, 'admin-bar')).toBe(10);
  });
});

test('useMaxRealRole is the highest real membership, Guest with none', async () => {
  expect(await renderValue(() => useMaxRealRole(), { bars })).toBe(40);
  expect(await renderValue(() => useMaxRealRole(), { bars: [] })).toBe(10);
});
