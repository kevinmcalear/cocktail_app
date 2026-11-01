import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useStartBarClaim } from '@/hooks/useBarClaims';
import { useLogMade } from '@/hooks/useMade';
import { setAnalyticsClient, setAnalyticsOptOut } from '@/lib/analytics';

// The two launch events PostHog never received (drink_made, claim_started):
// each must reach the client once its save succeeds.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: async () => ({ error: null }) }),
    rpc: async () => ({ data: { id: 'c', status: 'pending', profile_id: 'p' }, error: null }),
  },
}));

const sent: { event: string; props?: unknown }[] = [];
beforeAll(() => {
  process.env.EXPO_PUBLIC_POSTHOG_KEY = 'test';
  setAnalyticsOptOut(false);
  setAnalyticsClient({ capture: (event, props) => void sent.push({ event, props }) });
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

test('logging a made drink sends drink_made', async () => {
  const { result } = await renderHook(() => useLogMade(), { wrapper });
  await act(() =>
    result.current.mutateAsync({ item_id: 'd', had_on: '2026-10-31', compared: null, swaps: [], note: null, rank_entry_id: null, on_profile: false, photoUri: null })
  );
  expect(sent.find((s) => s.event === 'drink_made')).toEqual({ event: 'drink_made', props: { compared: 'none', swaps: 0, photo: false, shown: false } });
});

test('starting a bar claim sends claim_started', async () => {
  const { result } = await renderHook(() => useStartBarClaim(), { wrapper });
  await act(() => result.current.mutateAsync({ profileId: 'p', method: 'email', barId: null, note: '' }));
  expect(sent.find((s) => s.event === 'claim_started')).toEqual({ event: 'claim_started', props: { method: 'email', approved: false } });
});
