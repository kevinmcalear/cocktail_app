import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Share } from 'react-native';

import { useStartBarClaim } from '@/hooks/useBarClaims';
import { useLogMade } from '@/hooks/useMade';
import { setAnalyticsClient, setAnalyticsOptOut } from '@/lib/analytics';
import { noteDoor, noteRankedSignedOut, noteSignIn } from '@/lib/analyticsDoor';
import { deviceStore } from '@/lib/deviceStore';
import { shareLink, shareOrCopy, shareText } from '@/lib/shareLink';

// burnt ships untranspiled ESM; the toast isn't what's tested here.
jest.mock('burnt', () => ({ toast: jest.fn() }));
jest.mock('@/lib/deviceStore', () => {
  const saved = new Map<string, string>();
  return {
    deviceStore: {
      getItem: async (key: string) => saved.get(key) ?? null,
      setItem: async (key: string, value: string) => void saved.set(key, value),
      removeItem: async (key: string) => void saved.delete(key),
    },
  };
});

// The two launch events PostHog never received (drink_made, claim_started):
// each must reach the client once its save succeeds. Production has no made
// drinks and no claims yet, so nothing has been lost so far; this keeps it so.
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

beforeEach(() => {
  sent.length = 0;
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

describe('the guest loop', () => {
  beforeEach(() => deviceStore.removeItem('analytics_door_v1'));
  const returning = { email_confirmed_at: '2026-09-01T12:00:00Z', last_sign_in_at: '2026-10-10T12:00:00Z' };
  const brandNew = { email_confirmed_at: '2026-10-10T12:00:00.100Z', last_sign_in_at: '2026-10-10T12:00:00.400Z' };

  test('ranking signed out sends ranked_signed_out, and signing in sends kept once', async () => {
    noteRankedSignedOut();
    noteRankedSignedOut();
    expect(sent).toEqual([
      { event: 'ranked_signed_out', props: { held: false } },
      { event: 'ranked_signed_out', props: { held: false } },
    ]);
    noteSignIn(returning);
    await waitFor(() => expect(sent.at(-1)).toEqual({ event: 'kept', props: { ranks: 2 } }));
    expect(sent.some((s) => s.event === 'sign_up')).toBe(false);
    expect(await deviceStore.getItem('analytics_door_v1')).toBeNull();
    sent.length = 0;
    noteSignIn(returning);
    await deviceStore.getItem('analytics_door_v1');
    expect(sent).toEqual([]);
  });

  test('a new account sends sign_up with its way in, or direct', async () => {
    noteDoor('table');
    noteRankedSignedOut();
    sent.length = 0;
    noteSignIn(brandNew);
    await waitFor(() =>
      expect(sent).toEqual([
        { event: 'sign_up', props: { source: 'table' } },
        { event: 'kept', props: { ranks: 1 } },
      ]),
    );
    sent.length = 0;
    noteSignIn(brandNew);
    await waitFor(() => expect(sent).toEqual([{ event: 'sign_up', props: { source: 'direct' } }]));
  });

  test('a door is held until sign-in, and the first one stays', async () => {
    noteDoor('table');
    noteDoor('shared');
    noteRankedSignedOut();
    await waitFor(async () => expect(JSON.parse((await deviceStore.getItem('analytics_door_v1')) ?? '{}')).toEqual({ door: 'table', ranks: 1 }));
  });
});

describe('shared', () => {
  let action: string;
  beforeEach(() => {
    action = Share.sharedAction;
    jest.spyOn(Share, 'share').mockImplementation(async () => ({ action, activityType: undefined }));
  });

  test('sending a link or text counts, with what it was', async () => {
    await shareLink('https://x', 'A drink', 'drink');
    await shareOrCopy('https://x', 'A profile', 'profile');
    await shareText('a batch', 'A batch', 'batch');
    expect(sent).toEqual([
      { event: 'shared', props: { what: 'drink', how: 'sheet' } },
      { event: 'shared', props: { what: 'profile', how: 'sheet' } },
      { event: 'shared', props: { what: 'batch', how: 'sheet' } },
    ]);
  });

  test('closing the sheet does not', async () => {
    action = Share.dismissedAction;
    await shareLink('https://x', 'A drink', 'drink');
    await shareText('a batch', 'A batch', 'batch');
    expect(sent).toEqual([]);
  });
});
