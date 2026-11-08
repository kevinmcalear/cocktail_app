import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useDraftSync } from '@/hooks/useDraftSync';
import { EMPTY_BEER_WINE } from '@/lib/beerWineDraft';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';
import { useDraftSyncStore } from '@/store/useDraftSyncStore';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';

type Row = { user_id: string; entity_type: string; slot: string; bar_id: string | null; draft_data: { draft: Record<string, unknown> } };

let mockRows: { slot: string; draft_data: unknown }[] = [];
const mockUpserts: Row[] = [];
const mockDeletes: Record<string, unknown>[] = [];

jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
// The account's drafts: reads give mockRows, writes are recorded.
jest.mock('@/lib/supabase', () => {
  const chain = (done: () => unknown, filter: Record<string, unknown> = {}) => {
    const c = {
      eq: (col: string, v: unknown) => {
        filter[col] = v;
        return c;
      },
      lte: () => c,
      then: (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, fail),
    };
    return c;
  };
  return {
    jsonAs: (v: unknown) => v,
    supabase: {
      from: () => ({
        select: () => chain(() => ({ data: mockRows, error: null })),
        upsert: (row: Row) => {
          mockUpserts.push(row);
          return Promise.resolve({ error: null });
        },
        delete: () => {
          const filter: Record<string, unknown> = {};
          return chain(() => {
            mockDeletes.push(filter);
            return { error: null };
          }, filter);
        },
      }),
    },
  };
});

// No garbage-collection timer left running once a test is done.
let client = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
afterEach(() => client.clear());

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  // Each store reads the device's copy first, so what a test sets isn't overwritten by it.
  await Promise.all([useBeerWineWizardStore.persist.rehydrate(), useDrinkWizardStore.persist.rehydrate(), useDraftSyncStore.persist.rehydrate()]);
  useBeerWineWizardStore.setState({ kept: {}, cleared: [] });
  useDrinkWizardStore.setState({ kept: {}, cleared: [] });
  useDraftSyncStore.setState({ seen: [] });
  mockRows = [];
  mockUpserts.length = 0;
  mockDeletes.length = 0;
});

test('a beer kept on this phone only, before syncing, goes to the account on the first read, without its photo', async () => {
  const photo = { uri: 'file:///label.jpg', mimeType: 'image/jpeg' };
  useBeerWineWizardStore.setState({ kept: { 'beer:home': { draft: { ...EMPTY_BEER_WINE, name: 'Pils', photo }, step: 'style', updatedAt: 5 } } });
  const { unmount } = await renderHook(() => useDraftSync(), { wrapper });
  await waitFor(() => expect(mockUpserts).toHaveLength(1));
  const row = mockUpserts[0];
  expect(row).toMatchObject({ user_id: 'u1', entity_type: 'drink_wizard', slot: 'beer:home', bar_id: null });
  expect(row.draft_data.draft.name).toBe('Pils');
  expect('photo' in row.draft_data.draft).toBe(false);
  // Still on this phone, photo and all, for offline.
  expect(useBeerWineWizardStore.getState().kept['beer:home'].draft.photo).toEqual(photo);
  await unmount();
});

test('a beer an older version read into the drink wizard goes from it, and arrives in its own', async () => {
  const beer = { draft: { ...EMPTY_BEER_WINE, name: '' }, step: 'name', updatedAt: 3 };
  // ponytail: cast because an older version kept it under the drink's type; the shape is the point of the test.
  useDrinkWizardStore.setState({ kept: { 'beer:home': beer as never } });
  useDraftSyncStore.setState({ seen: ['beer:home'] });
  mockRows = [{ slot: 'beer:home', draft_data: { ...beer, draft: { ...beer.draft, name: 'Pils' } } }];
  const { unmount } = await renderHook(() => useDraftSync(), { wrapper });
  await waitFor(() => expect(useBeerWineWizardStore.getState().kept['beer:home']?.draft.name).toBe('Pils'));
  expect(useDrinkWizardStore.getState().kept['beer:home']).toBeUndefined();
  expect(mockUpserts).toHaveLength(0);
  await unmount();
});

test("the account's beer or wine arrives in its own wizard, a drink in the drink's; dropping it takes it out of the account", async () => {
  mockRows = [
    { slot: 'wine:bar-1', draft_data: { draft: { ...EMPTY_BEER_WINE, name: 'Gravner' }, step: 'name', updatedAt: 9 } },
    { slot: 'home', draft_data: { draft: { ...EMPTY_DRAFT, name: 'Salty Boy' }, step: 'name', updatedAt: 9 } },
  ];
  const { unmount } = await renderHook(() => useDraftSync(), { wrapper });
  await waitFor(() => expect(useBeerWineWizardStore.getState().kept['wine:bar-1']?.draft.name).toBe('Gravner'));
  expect(useBeerWineWizardStore.getState().kept.home).toBeUndefined();
  expect(useDrinkWizardStore.getState().kept.home?.draft.name).toBe('Salty Boy');
  expect(useDrinkWizardStore.getState().kept['wine:bar-1']).toBeUndefined();
  expect(useDraftSyncStore.getState().seen.sort()).toEqual(['home', 'wine:bar-1']);

  // Don't keep it: gone here, then from the account once things settle.
  useBeerWineWizardStore.getState().clear('wine:bar-1');
  await waitFor(() => expect(mockDeletes).toEqual([{ user_id: 'u1', entity_type: 'drink_wizard', slot: 'wine:bar-1' }]), { timeout: 4000 });
  expect(useDraftSyncStore.getState().seen).toEqual(['home']);
  expect(mockUpserts).toHaveLength(0);
  await unmount();
});
