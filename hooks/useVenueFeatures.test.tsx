import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSetVenueFeature, useVenueFeatures, venueFeaturesKey } from '@/hooks/useVenueFeatures';

// jest.setup.tsx stands in for this hook everywhere else.
jest.unmock('@/hooks/useVenueFeatures');

type Result = { data: unknown; error: { code: string } | null };
let mockRead: Result = { data: null, error: null };
let mockReads = 0;
let mockRpc: Result = { data: null, error: null };
let mockRpcArgs: unknown = null;
let mockAdvanced = false;
const mockSetAdvanced = jest.fn();

jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue' }) }));
jest.mock('@/hooks/useActiveVenue', () => {
  const venue = { id: 'rye', name: 'Little Rye' };
  return { useActiveVenue: () => ({ active: venue, venues: [venue], isLoading: false }) };
});
// Advanced options lives in bars.advanced_options, behind its own hook.
jest.mock('@/hooks/useAdvancedOptions', () => ({
  useBarAdvanced: () => mockAdvanced,
  useSetBarAdvanced: () => ({ mutate: mockSetAdvanced, error: null }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (_name: string, args: unknown) => {
      mockRpcArgs = args;
      return mockRpc;
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            mockReads += 1;
            return mockRead;
          },
        }),
      }),
    }),
  },
}));

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
// The app's default: queries retry. The read must not need it.
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });

beforeEach(() => {
  mockReads = 0;
  mockRead = { data: null, error: null };
  mockRpc = { data: null, error: null };
  mockRpcArgs = null;
  mockAdvanced = false;
  mockSetAdvanced.mockReset();
});

test('a venue with nothing switched on: no Tonight, and its home is Drinks', async () => {
  mockRead = { data: { enabled_features: [] }, error: null };
  const { result } = await renderHook(() => useVenueFeatures(), { wrapper: wrapper(newClient()) });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.has('tonight')).toBe(false);
  expect(result.current.home).toBe('/drinks');
});

test('the switches read back, unknown keys kept but not counted, Advanced from its own home', async () => {
  mockRead = { data: { enabled_features: ['tonight', 'disco', 'advanced'] }, error: null };
  const client = newClient();
  const { result } = await renderHook(() => useVenueFeatures(), { wrapper: wrapper(client) });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.has('tonight')).toBe(true);
  expect(result.current.home).toBe('/');
  expect(result.current.has('advanced')).toBe(false);
  expect(result.current.on).toEqual(['tonight']);
  expect(client.getQueryData(venueFeaturesKey('rye'))).toEqual(['tonight', 'disco', 'advanced']);
});

test('a read that fails never throws or retries: the column missing means none', async () => {
  mockRead = { data: null, error: { code: '42703' } };
  const { result } = await renderHook(() => useVenueFeatures(), { wrapper: wrapper(newClient()) });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.on).toEqual([]);
  expect(mockReads).toBe(1);
});

test('offline: a failed read keeps the saved switches', async () => {
  mockRead = { data: null, error: { code: 'PGRST301' } };
  const client = newClient();
  client.setQueryData(venueFeaturesKey('rye'), ['prep']);
  await client.invalidateQueries({ queryKey: venueFeaturesKey('rye') });
  const { result } = await renderHook(() => useVenueFeatures(), { wrapper: wrapper(client) });
  await waitFor(() => expect(mockReads).toBe(1));
  expect(result.current.has('prep')).toBe(true);
});

test('a switch changes one key on the server, and the list it sends back is kept', async () => {
  mockRead = { data: { enabled_features: ['disco'] }, error: null };
  mockRpc = { data: ['disco', 'tonight'], error: null };
  const client = newClient();
  const { result } = await renderHook(() => useSetVenueFeature('rye'), { wrapper: wrapper(client) });
  await waitFor(() => expect(result.current.features).toEqual(['disco']));
  mockRead = { data: { enabled_features: ['disco', 'tonight'] }, error: null };
  result.current.set('tonight', true);
  await waitFor(() => expect(client.getQueryData(venueFeaturesKey('rye'))).toEqual(['disco', 'tonight']));
  expect(mockRpcArgs).toEqual({ p_bar_id: 'rye', p_feature: 'tonight', p_enabled: true });
});

test('Advanced options writes bars.advanced_options, not the list', async () => {
  mockRead = { data: { enabled_features: [] }, error: null };
  const { result } = await renderHook(() => useSetVenueFeature('rye'), { wrapper: wrapper(newClient()) });
  await waitFor(() => expect(mockReads).toBe(1));
  result.current.set('advanced', true);
  expect(mockSetAdvanced).toHaveBeenCalledWith(true);
  expect(mockRpcArgs).toBeNull();
});

test('a switch that fails goes back and says so', async () => {
  mockRead = { data: { enabled_features: [] }, error: null };
  mockRpc = { data: null, error: { code: '42501' } };
  const client = newClient();
  const { result } = await renderHook(() => useSetVenueFeature('rye'), { wrapper: wrapper(client) });
  await waitFor(() => expect(mockReads).toBe(1));
  result.current.set('prep', true);
  await waitFor(() => expect(result.current.error).toMatch(/Check your connection/));
  expect(client.getQueryData(venueFeaturesKey('rye'))).toEqual([]);
});
