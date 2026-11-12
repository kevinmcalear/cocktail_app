import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { MutationObserver, onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client';

import { isKeptWrite, resendWrite } from '@/lib/keptWrites';
import { persistOptions, queryClient, resumeSavedWrites } from '@/lib/react-query';

let sent = 0;
let mockFailures: Error[] = [];
let mockOrder: string[] = [];
const mockSend = (v?: { id?: string }) => {
  sent++;
  if (v?.id) mockOrder.push(v.id);
  const failure = mockFailures.shift();
  return failure ? Promise.reject(failure) : Promise.resolve();
};

jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('@/hooks/useCocktails', () => ({ updateCocktailFn: () => mockSend(), deleteCocktailFn: () => mockSend() }));
const mockSaved = jest.fn(() => Promise.resolve());
jest.mock('@/hooks/barWrites', () => ({
  BAR_WRITES: {
    zoneCount: { key: ['bar-write', 'zone-count'], send: () => mockSend(), refresh: () => [] },
    menuLayout: { key: ['bar-write', 'menu-layout'], send: (v: { id: string }) => mockSend(v), refresh: () => [], scope: { id: 'offline-writes' } },
    bottle: { key: ['bar-write', 'bottle'], send: () => mockSend().then(() => 'drink'), refresh: () => [], saved: (...a: unknown[]) => mockSaved(...(a as [])) },
  },
}));

const mockDrinkSaved = jest.fn();
jest.mock('@/lib/drinkSaveLoader', () => ({
  loadDrinkSave: async () => ({
  createDrink: (v: { id: string }) => mockSend(v).then(() => ({ id: v.id, warnings: [], created: [], later: [] })),
  newDrinkSaved: (...a: unknown[]) => mockDrinkSaved(...a),
  newDrinkFailed: () => undefined,
  }),
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
  mockOrder = [];
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

const write = (key: string[], id: string) => new MutationObserver<unknown, Error, { id: string }>(queryClient, { mutationKey: key }).mutate({ id });
const tick = () => new Promise((done) => setTimeout(done, 20));

test('a new drink and then a menu edit made offline send once each, in that order, after a relaunch', async () => {
  const persister = memoryPersister();
  onlineManager.setOnline(false);
  void write(['bar-write', 'new-drink'], 'drink').catch(() => {});
  void write(['bar-write', 'menu-layout'], 'menu').catch(() => {});
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  expect(persister.saved()?.clientState.mutations).toHaveLength(2);
  queryClient.getMutationCache().clear();
  onlineManager.setOnline(true);
  await persistQueryClientRestore({ queryClient, persister });
  await resumeSavedWrites();
  await tick();
  expect(mockOrder).toEqual(['drink', 'menu']);
  expect(mockDrinkSaved).toHaveBeenCalledTimes(1);
  // Once in, they leave the cache: nothing is listed as waiting, nothing sends twice.
  expect(queryClient.getMutationCache().getAll().filter(isKeptWrite)).toHaveLength(0);
  await queryClient.resumePausedMutations();
  expect(sent).toBe(2);
});

test('a write refused after it waited is kept, saved, and sends again from Send', async () => {
  const persister = memoryPersister();
  onlineManager.setOnline(false);
  const refused = write(['bar-write', 'menu-layout'], 'menu').catch(() => 'refused');
  await tick();
  mockFailures = [Object.assign(new Error('You can’t change this menu.'), { code: '42501' })];
  onlineManager.setOnline(true);
  // The app's provider resumes on reconnect; this client isn't mounted.
  void queryClient.resumePausedMutations();
  expect(await refused).toBe('refused');
  await tick();
  const [kept] = queryClient.getMutationCache().getAll().filter(isKeptWrite);
  expect(kept?.state.status).toBe('error');
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  expect(persister.saved()?.clientState.mutations).toHaveLength(1);

  resendWrite(queryClient, kept);
  await tick();
  expect(sent).toBe(2);
  expect(queryClient.getMutationCache().getAll().filter(isKeptWrite)).toHaveLength(0);
});

test('a write refused while its screen is open is the screen’s to say: it is not kept', async () => {
  mockFailures = [Object.assign(new Error('nope'), { code: '42501' })];
  await expect(write(['bar-write', 'menu-layout'], 'menu')).rejects.toThrow('nope');
  await tick();
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
});
