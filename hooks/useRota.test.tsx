import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSaveShifts } from './useRota';

const mockSend = jest.fn();
jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'user-1' }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/barWrites', () => ({ BAR_WRITES: { shifts: { key: ['bar-write', 'shifts'], send: (w: object) => mockSend(w), refresh: () => [] } } }));

test('a refused save hands over a retry that sends the same write again', async () => {
  mockSend.mockRejectedValueOnce(new Error('no')).mockResolvedValueOnce(undefined);
  let retry: (() => void) | undefined;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>;
  const { result, unmount } = await renderHook(() => useSaveShifts('bar-1', (r) => (retry = r)), { wrapper });
  await act(async () => result.current.mutate({ removed: ['s1'] }));
  await waitFor(() => expect(retry).toBeDefined());
  // Leaving the rota screen unmounts the hook; Try again still sends.
  unmount();
  await act(async () => retry?.());
  await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2));
  expect(mockSend).toHaveBeenLastCalledWith({ barId: 'bar-1', rows: [], removed: ['s1'] });
});
