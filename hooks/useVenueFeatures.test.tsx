import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSetVenueFeature, useVenueFeatures, venueFeaturesKey } from '@/hooks/useVenueFeatures';

// The app can run before the migration that adds bars.enabled_features: the
// read and the write then fail with an unknown-column error.
type Result = { data: unknown; error: { code: string } | null };
let mockRead: Result = { data: null, error: null };
let mockWrite: Result = { data: null, error: null };
let mockReads = 0;
// set_venue_feature: missing before its migration (PGRST202).
let mockRpc: Result = { data: null, error: { code: 'PGRST202' } };
let mockWritten: unknown = null;

jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: 'venue' }) }));
jest.mock('@/hooks/useActiveVenue', () => {
  const venue = { id: 'rye', name: 'Little Rye' };
  return { useActiveVenue: () => ({ active: venue, venues: [venue] }) };
});
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async () => mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            mockReads += 1;
            return mockRead;
          },
        }),
      }),
      update: (row: { enabled_features: unknown }) => {
        mockWritten = row.enabled_features;
        return { eq: () => ({ select: () => ({ single: async () => mockWrite }) }) };
      },
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
  mockWrite = { data: null, error: null };
  mockRpc = { data: null, error: { code: 'PGRST202' } };
  mockWritten = null;
});

test('before the migration: the read fails once, and the venue gets the default three', async () => {
  mockRead = { data: null, error: { code: '42703' } };
  const client = newClient();
  const { result } = await renderHook(() => useVenueFeatures(), { wrapper: wrapper(client) });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.has('tonight')).toBe(false);
  expect(client.getQueryData(venueFeaturesKey('rye'))).toEqual([]);
  expect(mockReads).toBe(1);
});

test('after it: the switches read back, unknown keys kept but not counted', async () => {
  mockRead = { data: { enabled_features: ['tonight', 'disco'] }, error: null };
  const client = newClient();
  const { result } = await renderHook(() => useVenueFeatures(), { wrapper: wrapper(client) });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.has('tonight')).toBe(true);
  expect(client.getQueryData(venueFeaturesKey('rye'))).toEqual(['tonight', 'disco']);
  expect(result.current.on).toEqual(['tonight']);
});

test('a switch changes one key on the server, and the list it sends back is kept', async () => {
  mockRead = { data: { enabled_features: ['disco'] }, error: null };
  mockRpc = { data: ['disco', 'tonight'], error: null };
  const client = newClient();
  const { result } = await renderHook(() => useSetVenueFeature('rye'), { wrapper: wrapper(client) });
  await waitFor(() => expect(result.current.features).toEqual(['disco']));
  // The refetch after it reads what the server now has.
  mockRead = { data: { enabled_features: ['disco', 'tonight'] }, error: null };
  result.current.set('tonight', true);
  await waitFor(() => expect(client.getQueryData(venueFeaturesKey('rye'))).toEqual(['disco', 'tonight']));
  expect(mockWritten).toBeNull();
});

test('before set_venue_feature: the whole list is written, keeping keys this build doesn’t know', async () => {
  mockRead = { data: { enabled_features: ['disco'] }, error: null };
  const client = newClient();
  const { result } = await renderHook(() => useSetVenueFeature('rye'), { wrapper: wrapper(client) });
  await waitFor(() => expect(result.current.features).toEqual(['disco']));
  result.current.set('tonight', true);
  await waitFor(() => expect(mockWritten).toEqual(['tonight', 'disco']));
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

test('a switch that can’t save yet says so calmly and goes back', async () => {
  mockRead = { data: null, error: { code: '42703' } };
  mockWrite = { data: null, error: { code: 'PGRST204' } };
  const client = newClient();
  const { result } = await renderHook(() => useSetVenueFeature('rye'), { wrapper: wrapper(client) });
  await waitFor(() => expect(mockReads).toBe(1));
  result.current.set('tonight', true);
  await waitFor(() => expect(result.current.error).toMatch(/after the next update/));
  expect(result.current.features).toEqual([]);
});
