import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { MutationObserver, onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client';

import { persistOptions, queryClient, resumeSavedWrites } from '@/lib/react-query';

let sent = 0;
const mockSend = () => {
  sent++;
  return Promise.resolve();
};

jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('@/hooks/useCocktails', () => ({ updateCocktailFn: () => mockSend(), deleteCocktailFn: () => mockSend() }));

/** The persisted cache blob, as the app's persister would save it. */
function memoryPersister(): Persister & { saved: () => PersistedClient | undefined } {
  let saved: PersistedClient | undefined;
  return {
    persistClient: async (c) => { saved = c; },
    restoreClient: async () => saved,
    removeClient: async () => { saved = undefined; },
    saved: () => saved,
  };
}

/** A write made with no connection, saved, then the app closed and reopened. */
async function writeOfflineThenRelaunch(key: string[]) {
  const persister = memoryPersister();
  onlineManager.setOnline(false);
  void new MutationObserver<unknown, Error, { id: string }>(queryClient, { mutationKey: key, mutationFn: mockSend }).mutate({ id: 'drink' }).catch(() => {});
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  queryClient.getMutationCache().clear();
  // Before NetInfo's first event the app thinks it's online.
  onlineManager.setOnline(true);
  await persistQueryClientRestore({ queryClient, persister });
  return persister;
}

const offline = { isConnected: false } as NetInfoState;

beforeEach(() => {
  sent = 0;
  queryClient.getMutationCache().clear();
});
afterEach(() => onlineManager.setOnline(true));

test('a write saved offline is sent when the cache comes back', async () => {
  await writeOfflineThenRelaunch(['updateCocktail']);
  await resumeSavedWrites();
  expect(sent).toBe(1);
  expect(queryClient.getMutationCache().getAll()[0].state.status).toBe('success');
});

test('still offline at launch, the write waits instead of failing', async () => {
  await writeOfflineThenRelaunch(['deleteCocktail']);
  jest.mocked(NetInfo.fetch).mockResolvedValueOnce(offline);
  await resumeSavedWrites();
  expect(sent).toBe(0);
  expect(queryClient.getMutationCache().getAll()[0].state.isPaused).toBe(true);
});

test("a write that can't be sent after a relaunch isn't saved", async () => {
  const persister = await writeOfflineThenRelaunch(['stock-write', 'bar']);
  expect(persister.saved()?.clientState.mutations).toEqual([]);
});
