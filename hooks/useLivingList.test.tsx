import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { NOT_CHANGED, useListChanges } from '@/hooks/useLivingList';

// Each write resolves to mockResult; the rows it says it changed decide success.
type Result = { data: unknown; error: { message: string } | null };
let mockResult: Result = { data: null, error: null };

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain = { update: () => chain, delete: () => chain, eq: () => chain, select: () => chain, then: (done: (r: Result) => unknown) => Promise.resolve(mockResult).then(done) };
      return chain;
    },
  },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useListChanges('menu-1'), { wrapper });
}

describe('a list change the server refuses', () => {
  test('Take off that changes no rows (RLS) fails, so the error toast shows', async () => {
    mockResult = { data: [], error: null };
    const { result } = await setup();
    await act(async () => {
      await expect(result.current.takeOff.mutateAsync({ rowId: 'row-1' })).rejects.toThrow(NOT_CHANGED);
    });
  });

  test('Take off that changes its row succeeds', async () => {
    mockResult = { data: [{ id: 'row-1' }], error: null };
    const { result } = await setup();
    await act(async () => {
      await expect(result.current.takeOff.mutateAsync({ rowId: 'row-1' })).resolves.toBeUndefined();
    });
  });

  test('Approve, turn down and hide fail the same way', async () => {
    mockResult = { data: [], error: null };
    const { result } = await setup();
    await act(async () => {
      await expect(result.current.approve.mutateAsync('row-1')).rejects.toThrow(NOT_CHANGED);
      await expect(result.current.turnDown.mutateAsync({ rowId: 'row-1', waiting: 'on' })).rejects.toThrow(NOT_CHANGED);
      await expect(result.current.hide.mutateAsync(true)).rejects.toThrow(NOT_CHANGED);
    });
  });
});
