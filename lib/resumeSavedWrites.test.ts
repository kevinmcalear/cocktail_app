import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { MutationObserver, onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client';

import { dropUnsentWrites } from '@/lib/authCache';
import { discardWrite, isKeptWrite, resendWrite, setWriteOwner } from '@/lib/keptWrites';
import { persistOptions, queryClient, resumeSavedWrites, savedQueryFiles } from '@/lib/react-query';

let sent = 0;
let mockFailures: Error[] = [];
let mockOrder: string[] = [];
let mockLayoutsSent: unknown[] = [];
let mockPricesSent: unknown[] = [];
let mockHang = false;
const mockSend = (v?: { id?: string }) => {
  sent++;
  if (v?.id) mockOrder.push(v.id);
  if (mockHang) return new Promise(() => {});
  const failure = mockFailures.shift();
  return failure ? Promise.reject(failure) : Promise.resolve();
};

jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'));
// Placing a drink in a waiting layout never reaches the database; its client's timers would keep the run open.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
const mockReported = jest.fn();
jest.mock('@/lib/monitoring', () => ({ reportError: (...a: unknown[]) => mockReported(...a) }));
jest.mock('@/hooks/useCocktails', () => ({ updateCocktailFn: () => mockSend(), deleteCocktailFn: () => mockSend() }));
const mockSaved = jest.fn(() => Promise.resolve());
jest.mock('@/hooks/barWrites', () => ({
  BAR_WRITES: {
    zoneCount: { key: ['bar-write', 'zone-count'], send: () => mockSend(), refresh: () => [['run-sheet', 'm1']] },
    menuLayout: {
      key: ['bar-write', 'menu-layout'],
      send: (v: { id: string; args?: unknown }) => {
        mockLayoutsSent.push(JSON.parse(JSON.stringify(v.args ?? null)));
        mockPricesSent.push((v as { prices?: unknown }).prices);
        return mockSend(v);
      },
      refresh: () => [],
      scope: { id: 'offline-writes' },
    },
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
  loadMadeForSection: async () => jest.requireActual('@/hooks/madeForSection'),
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
  mockLayoutsSent = [];
  mockPricesSent = [];
  mockHang = false;
  mockReported.mockClear();
  setWriteOwner(undefined);
  queryClient.getMutationCache().clear();
});
afterEach(() => onlineManager.setOnline(true));

test('a write saved offline is sent when the cache comes back', async () => {
  await writeOfflineThenRelaunch(['updateCocktail']);
  resumeSavedWrites();
  await tick();
  expect(sent).toBe(1);
  expect(queryClient.getMutationCache().getAll()[0].state.status).toBe('success');
});

test('still offline at launch, the write waits instead of failing', async () => {
  await writeOfflineThenRelaunch(['deleteCocktail']);
  jest.mocked(NetInfo.fetch).mockResolvedValueOnce(offline);
  resumeSavedWrites();
  await tick();
  expect(sent).toBe(0);
  expect(queryClient.getMutationCache().getAll()[0].state.isPaused).toBe(true);
});

test("a write that can't be sent after a relaunch isn't saved", async () => {
  const persister = await writeOfflineThenRelaunch(['stock-write', 'bar']);
  expect(persister.saved()?.clientState.mutations).toEqual([]);
});

test('a count made behind the bar with no signal is sent after a relaunch', async () => {
  await writeOfflineThenRelaunch(['bar-write', 'zone-count']);
  resumeSavedWrites();
  await tick();
  expect(sent).toBe(1);
});

// Review of #1181: a bottle saved on the phone, then the app quit, came in with no label photo, toast or recents.
test('a bottle saved offline does what follows a save (its photo, its toast) after a relaunch too', async () => {
  mockSaved.mockClear();
  await writeOfflineThenRelaunch(['bar-write', 'bottle']);
  resumeSavedWrites();
  await tick();
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
  resumeSavedWrites();
  await tick();
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
  // Its reason is saved with it, so after a relaunch it still says why.
  expect(JSON.parse(JSON.stringify(persister.saved()?.clientState.mutations[0].state.error)).message).toBe('You can’t change this menu.');

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

test('a menu edited again offline sends only its newest layout; another menu keeps its own', async () => {
  onlineManager.setOnline(false);
  const layout = (menuId: string, id: string) => new MutationObserver<unknown, Error, { menuId: string; id: string }>(queryClient, { mutationKey: ['bar-write', 'menu-layout'] }).mutate({ menuId, id });
  void layout('m1', 'first').catch(() => {});
  void layout('m2', 'other').catch(() => {});
  void layout('m1', 'second').catch(() => {});
  await tick();
  expect(queryClient.getMutationCache().getAll().filter(isKeptWrite)).toHaveLength(2);
  onlineManager.setOnline(true);
  await queryClient.resumePausedMutations();
  await tick();
  expect(mockOrder).toEqual(['other', 'second']);
});

// A bartender adds a drink to a section with no signal, then edits that menu: once back, the drink is in that section,
// sent with the menu's waiting layout (which would otherwise leave it off), once.
test('a drink made offline from a menu section ends up in that section when it sends, then the menu edit keeps it', async () => {
  const persister = memoryPersister();
  onlineManager.setOnline(false);
  const section = { key: 's1', id: 's1', name: 'Sours', minItems: 1, maxItems: null, allowedTypes: ['cocktail'], drinks: [] };
  const layout = { name: 'Autumn', coverUrl: null, coverPosition: 50, sections: [section] };
  const drink = { id: 'drink', draft: { name: 'Pine Fizz' }, menuSectionId: 's1', queued: true };
  const menu = { id: 'menu', menuId: 'm1', name: 'Autumn', layout, args: { p_menu_id: 'm1', p_sections: [{ id: 's1', item_ids: [] }] }, prices: {}, queued: true };
  void new MutationObserver<unknown, Error, unknown>(queryClient, { mutationKey: ['bar-write', 'new-drink'] }).mutate(drink).catch(() => {});
  void new MutationObserver<unknown, Error, unknown>(queryClient, { mutationKey: ['bar-write', 'menu-layout'] }).mutate(menu).catch(() => {});
  // Closed and opened again before the signal comes back.
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  queryClient.getMutationCache().clear();
  await persistQueryClientRestore({ queryClient, persister });
  onlineManager.setOnline(true);
  resumeSavedWrites();
  await tick();
  await tick();
  expect(mockOrder).toEqual(['drink', 'menu']);
  expect(mockLayoutsSent).toHaveLength(1);
  expect((mockLayoutsSent[0] as { p_sections: { item_ids: string[] }[] }).p_sections[0].item_ids).toEqual(['drink']);
});

// Review H1: a price changed offline, then another edit to the same menu: the newer layout carries the price.
test('a menu edited again offline still sends the price the older edit held', async () => {
  onlineManager.setOnline(false);
  const layout = (id: string, prices: Record<string, string>) =>
    new MutationObserver<unknown, Error, unknown>(queryClient, { mutationKey: ['bar-write', 'menu-layout'] }).mutate({ menuId: 'm1', id, prices });
  void layout('price', { A: '19' }).catch(() => {});
  void layout('rename', {}).catch(() => {});
  await tick();
  onlineManager.setOnline(true);
  await queryClient.resumePausedMutations();
  await tick();
  expect(mockOrder).toEqual(['rename']);
  expect(mockPricesSent).toEqual([{ A: '19' }]);
});

// Review H2: sign-out drops every write the last person left, refused ones too, and storage keeps none.
test('signing out drops a refused write too, and the saved row holds no writes', async () => {
  await AsyncStorage.clear();
  onlineManager.setOnline(false);
  const refused = write(['bar-write', 'menu-layout'], 'menu').catch(() => 'refused');
  await tick();
  mockFailures = [Object.assign(new Error('Name taken'), { code: '23505' })];
  onlineManager.setOnline(true);
  void queryClient.resumePausedMutations();
  expect(await refused).toBe('refused');
  await tick();
  expect(queryClient.getMutationCache().getAll().filter(isKeptWrite)).toHaveLength(1);
  dropUnsentWrites(queryClient);
  await tick();
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  const row = JSON.parse((await AsyncStorage.getItem('REACT_QUERY_OFFLINE_CACHE')) ?? '{"clientState":{"mutations":[]}}');
  expect(row.clientState.mutations).toEqual([]);
});

// Review H2: a write is only ever sent as the person who made it.
test('a saved write made by someone else is dropped, not sent: after a relaunch, and from Send', async () => {
  setWriteOwner('a');
  const persister = memoryPersister();
  onlineManager.setOnline(false);
  void write(['bar-write', 'zone-count'], 'count').catch(() => {});
  await tick();
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  expect(persister.saved()?.clientState.mutations[0].state).toMatchObject({ owner: 'a' });
  queryClient.getMutationCache().clear();
  onlineManager.setOnline(true);
  setWriteOwner('b');
  await persistQueryClientRestore({ queryClient, persister });
  resumeSavedWrites();
  await tick();
  await tick();
  expect(sent).toBe(0);
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);

  // Kept and refused as a, then Send pressed with b signed in.
  setWriteOwner('a');
  onlineManager.setOnline(false);
  const refused = write(['bar-write', 'menu-layout'], 'menu').catch(() => 'refused');
  await tick();
  mockFailures = [Object.assign(new Error('nope'), { code: '42501' })];
  onlineManager.setOnline(true);
  void queryClient.resumePausedMutations();
  await refused;
  await tick();
  const [kept] = queryClient.getMutationCache().getAll().filter(isKeptWrite);
  setWriteOwner('b');
  sent = 0;
  resendWrite(queryClient, kept);
  await tick();
  expect(sent).toBe(0);
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  // Second review, 4: each drop is reported, by kind and where, with no one's id in it.
  expect(mockReported.mock.calls.map(([, about]) => about)).toEqual([
    { kind: 'zone-count', where: 'relaunch' },
    { kind: 'menu-layout', where: 'resend' },
  ]);
  expect(JSON.stringify(mockReported.mock.calls)).not.toMatch(/"a"|"b"/);
});

// Review M1: killed while a waiting write is sending: it's still saved, and goes again after the relaunch.
test('a waiting write that is sending stays saved until the database answers', async () => {
  const persister = memoryPersister();
  onlineManager.setOnline(false);
  void write(['bar-write', 'menu-layout'], 'menu').catch(() => {});
  await tick();
  mockHang = true;
  onlineManager.setOnline(true);
  void queryClient.resumePausedMutations();
  await tick();
  expect(sent).toBe(1);
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  expect(persister.saved()?.clientState.mutations).toHaveLength(1);
  // The app is killed; it opens again with signal.
  queryClient.getMutationCache().clear();
  mockHang = false;
  await persistQueryClientRestore({ queryClient, persister });
  resumeSavedWrites();
  await tick();
  await tick();
  expect(sent).toBe(2);
  expect(mockOrder).toEqual(['menu', 'menu']);
});

// Second review S1: the one killed mid-send is first in its line; the ones behind it waited on it, and it was
// only sent again after them, so nothing ever sent again.
test.each([
  ['two drinks', ['new-drink', 'new-drink']],
  ['three drinks', ['new-drink', 'new-drink', 'new-drink']],
  ['two menu edits', ['menu-layout', 'menu-layout']],
  ['three menu edits', ['menu-layout', 'menu-layout', 'menu-layout']],
  ['a drink, a menu edit and a drink', ['new-drink', 'menu-layout', 'new-drink']],
])('killed while the first of %s was sending: after the relaunch all go, once each, in order', async (_name, kinds) => {
  const persister = memoryPersister();
  onlineManager.setOnline(false);
  const ids = kinds.map((kind, i) => `${kind}-${i + 1}`);
  kinds.forEach((kind, i) => void write(['bar-write', kind], ids[i]).catch(() => {}));
  await tick();
  // Signal comes back: the first starts sending, the rest wait behind it. Then the app is killed.
  mockHang = true;
  onlineManager.setOnline(true);
  void queryClient.resumePausedMutations();
  await tick();
  expect(mockOrder).toEqual([ids[0]]);
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  expect(persister.saved()?.clientState.mutations).toHaveLength(kinds.length);
  queryClient.getMutationCache().clear();
  mockHang = false;
  mockOrder = [];
  await persistQueryClientRestore({ queryClient, persister });
  resumeSavedWrites();
  for (let i = 0; i < kinds.length + 1; i++) await tick();
  expect(mockOrder).toEqual(ids);
  expect(queryClient.getMutationCache().getAll().filter((w) => w.state.status === 'pending')).toHaveLength(0);
});

// Second review S2: the first screen never waits on a send.
test('the app opens with a send that never answers and no owner known yet', async () => {
  const persister = memoryPersister();
  setWriteOwner('a');
  onlineManager.setOnline(false);
  void write(['bar-write', 'new-drink'], 'drink').catch(() => {});
  void write(['bar-write', 'menu-layout'], 'menu').catch(() => {});
  await tick();
  mockHang = true;
  onlineManager.setOnline(true);
  void queryClient.resumePausedMutations();
  await tick();
  await persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });
  queryClient.getMutationCache().clear();
  setWriteOwner(undefined);
  // As PersistQueryClientProvider runs it: restore, then onSuccess, then the app renders.
  const opened = persistQueryClientRestore({ queryClient, persister }).then(() => resumeSavedWrites()).then(() => 'opened');
  expect(await Promise.race([opened, tick().then(() => 'stuck')])).toBe('opened');
});

test('the app opens with no signal, the writes waiting', async () => {
  const persister = await writeOfflineThenRelaunch(['bar-write', 'zone-count']);
  queryClient.getMutationCache().clear();
  jest.mocked(NetInfo.fetch).mockResolvedValueOnce(offline);
  const opened = persistQueryClientRestore({ queryClient, persister }).then(() => resumeSavedWrites()).then(() => 'opened');
  expect(await Promise.race([opened, tick().then(() => 'stuck')])).toBe('opened');
  await tick();
  expect(queryClient.getMutationCache().getAll()[0].state.isPaused).toBe(true);
});

test('a stored row that can’t be read is set aside, and the app opens without it', async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('REACT_QUERY_OFFLINE_CACHE', '{"clientState":{"mutations":[{"mutationKey"');
  await expect(persistQueryClientRestore({ queryClient, ...persistOptions })).resolves.toBeUndefined();
  const aside = JSON.parse((await AsyncStorage.getItem('REACT_QUERY_SET_ASIDE')) ?? 'null');
  expect(aside.items).toBe('{"clientState":{"mutations":[{"mutationKey"');
  expect(mockReported).toHaveBeenCalledTimes(1);
});

test('a broken write comes back as didn’t send; one that can’t be sent is set aside; the rest restore', async () => {
  await AsyncStorage.clear();
  onlineManager.setOnline(false);
  void write(['bar-write', 'zone-count'], 'whole').catch(() => {});
  await tick();
  const row = JSON.parse((await AsyncStorage.getItem('REACT_QUERY_OFFLINE_CACHE')) ?? '{}');
  row.clientState.mutations.push({ mutationKey: ['bar-write', 'zone-count'], state: { variables: { id: 'broken' }, status: 'sending?' } }, { mutationKey: 'no key' }, 42);
  row.clientState.queries.push(null, { queryKey: 'x' });
  await AsyncStorage.setItem('REACT_QUERY_OFFLINE_CACHE', JSON.stringify(row));
  queryClient.getMutationCache().clear();
  await persistQueryClientRestore({ queryClient, ...persistOptions });
  const writes = queryClient.getMutationCache().getAll();
  expect(writes.map((w) => [(w.state.variables as { id: string }).id, w.state.status, isKeptWrite(w)])).toEqual([
    ['whole', 'pending', true],
    ['broken', 'error', true],
  ]);
  const aside = JSON.parse((await AsyncStorage.getItem('REACT_QUERY_SET_ASIDE')) ?? 'null');
  expect(aside.items).toEqual([{ mutationKey: 'no key' }, 42]);
});

// Review M2: Discard takes the change off the screen too, from the copy saved with the write.
test('discarding a waiting run sheet change puts the sheet back as it was', async () => {
  const key = ['run-sheet', 'm1', 'u'];
  queryClient.setQueryData(key, 'before');
  onlineManager.setOnline(false);
  void new MutationObserver<unknown, Error, { id: string }, { key: string[]; before: string }>(queryClient, {
    mutationKey: ['bar-write', 'zone-count'],
    onMutate: () => {
      queryClient.setQueryData(key, 'swapped');
      return { key, before: 'before' };
    },
  })
    .mutate({ id: 'swap' })
    .catch(() => {});
  await tick();
  expect(queryClient.getQueryData(key)).toBe('swapped');
  const [waiting] = queryClient.getMutationCache().getAll().filter(isKeptWrite);
  const written = jest.spyOn(savedQueryFiles, 'write').mockResolvedValue();
  discardWrite(queryClient, waiting);
  expect(queryClient.getQueryData(key)).toBe('before');
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  // The sheet's file gets the copy put back too (the refetch after it once stopped that), so a relaunch shows it.
  await tick();
  expect(written.mock.calls.map(([, v]) => (v as { state: { data: unknown } }).state.data)).toContain('before');
  written.mockRestore();
});
