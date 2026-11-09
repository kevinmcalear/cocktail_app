import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { MutationObserver, onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client';

import { persistOptions, queryClient, resumeSavedWrites } from '@/lib/react-query';

let sent = 0;
let mockFailures: Error[] = [];
const mockSend = () => {
  sent++;
  const failure = mockFailures.shift();
  return failure ? Promise.reject(failure) : Promise.resolve();
};

jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('@/hooks/useCocktails', () => ({ updateCocktailFn: () => mockSend(), deleteCocktailFn: () => mockSend() }));
const mockSaved = jest.fn(() => Promise.resolve());
jest.mock('@/hooks/barWrites', () => ({
  BAR_WRITES: {
    zoneCount: { key: ['bar-write', 'zone-count'], send: () => mockSend(), refresh: () => [] },
    bottle: { key: ['bar-write', 'bottle'], send: () => mockSend().then(() => 'drink'), refresh: () => [], saved: (...a: unknown[]) => mockSaved(...(a as [])) },
  },
}));

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
  mockFailures = [];
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

test('a count made behind the bar with no signal is sent after a relaunch', async () => {
  await writeOfflineThenRelaunch(['bar-write', 'zone-count']);
  await resumeSavedWrites();
  expect(sent).toBe(1);
});

// Review of #1181: a bottle saved on the phone, then the app quit, came in with no label photo, toast or recents.
test('a bottle saved offline does what follows a save (its photo, its toast) after a relaunch too', async () => {
  mockSaved.mockClear();
  await writeOfflineThenRelaunch(['bar-write', 'bottle']);
  await resumeSavedWrites();
  expect(sent).toBe(1);
  expect(mockSaved).toHaveBeenCalledWith(queryClient, 'drink', { id: 'drink' });
});

test('a write that starts waiting is saved at once, not at the next throttled save', async () => {
  await AsyncStorage.clear();
  onlineManager.setOnline(false);
  void new MutationObserver<unknown, Error, { id: string }>(queryClient, { mutationKey: ['bar-write', 'zone-count'] }).mutate({ id: 'count' }).catch(() => {});
  await new Promise((done) => setTimeout(done, 20));
  const row = JSON.parse((await AsyncStorage.getItem('REACT_QUERY_OFFLINE_CACHE')) ?? '{}');
  expect(row.clientState.mutations).toHaveLength(1);
  expect(row.clientState.mutations[0].state.variables).toEqual({ id: 'count' });
});

test('a dropped connection tries again instead of losing the write; a refusal does not', async () => {
  mockFailures = [new TypeError('Network request failed')];
  await new MutationObserver<unknown, Error, { id: string }>(queryClient, { mutationKey: ['bar-write', 'zone-count'] }).mutate({ id: 'count' });
  expect(sent).toBe(2);

  sent = 0;
  mockFailures = [Object.assign(new Error('new row violates row-level security policy'), { code: '42501' })];
  await expect(new MutationObserver<unknown, Error, { id: string }>(queryClient, { mutationKey: ['bar-write', 'zone-count'] }).mutate({ id: 'count' })).rejects.toThrow('row-level');
  expect(sent).toBe(1);
});
