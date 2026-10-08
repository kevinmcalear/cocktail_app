import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client';

import { clearUserData } from '@/lib/clearUserData';
import { persistOptions, queryClient } from '@/lib/react-query';

// Who the Supabase client would send a write as, and whose writes went out.
let signedIn: string | null = null;
const sentAs: (string | null)[] = [];
const mockSend = () => {
  sentAs.push(signedIn);
  return Promise.resolve();
};

jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'));
jest.mock('@/hooks/useCocktails', () => ({ updateCocktailFn: () => mockSend(), deleteCocktailFn: () => mockSend() }));
jest.mock('@/hooks/useIngredients', () => ({ updateIngredientFn: () => mockSend(), addIngredientFn: () => mockSend() }));
jest.mock('@/lib/aiConsent', () => ({ AI_CONSENT_KEY: 'ai-consent' }));

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

/** Someone edits a drink with no connection: the write pauses, waiting to go online. */
function editOffline(client: QueryClient) {
  onlineManager.setOnline(false);
  void new MutationObserver<unknown, Error, { id: string }>(client, { mutationKey: ['updateCocktail'] }).mutate({ id: 'drink' }).catch(() => {});
}

beforeEach(() => {
  sentAs.length = 0;
  queryClient.clear();
  queryClient.getMutationCache().clear();
  queryClient.mount();
});
afterEach(() => {
  queryClient.unmount();
  onlineManager.setOnline(true);
});

test("a write left unsent at sign-out never goes out as the next person", async () => {
  signedIn = 'a';
  editOffline(queryClient);
  expect(queryClient.getMutationCache().getAll().filter((m) => m.state.isPaused)).toHaveLength(1);

  signedIn = null;
  await clearUserData();
  signedIn = 'b';
  onlineManager.setOnline(true);
  await queryClient.resumePausedMutations();

  expect(sentAs).toEqual([]);
});

test("a write saved for the next launch is forgotten at sign-out", async () => {
  const persister = memoryPersister();
  const save = () => persistQueryClientSave({ queryClient, persister, dehydrateOptions: persistOptions.dehydrateOptions });

  signedIn = 'a';
  editOffline(queryClient);
  await save();
  // Saved so it can resume after a relaunch.
  expect(persister.saved()?.clientState.mutations).toHaveLength(1);

  signedIn = null;
  await clearUserData();
  await save();

  // The next launch restores the cache, then someone else signs in and the app comes online.
  const relaunched = new QueryClient();
  relaunched.setMutationDefaults(['updateCocktail'], { mutationFn: mockSend });
  relaunched.mount();
  await persistQueryClientRestore({ queryClient: relaunched, persister });
  signedIn = 'b';
  onlineManager.setOnline(true);
  await relaunched.resumePausedMutations();
  relaunched.unmount();

  expect(persister.saved()?.clientState.mutations).toEqual([]);
  expect(sentAs).toEqual([]);
});

test('a write already sent keeps going: signing out only drops unsent ones', async () => {
  signedIn = 'a';
  let finish = () => {};
  const sending = new Promise<void>((resolve) => { finish = resolve; });
  queryClient.setMutationDefaults(['slowWrite'], { mutationFn: () => { sentAs.push(signedIn); return sending; } });
  const done = new MutationObserver(queryClient, { mutationKey: ['slowWrite'] }).mutate(undefined);
  await new Promise((r) => setTimeout(r, 0)); // sent, waiting on the reply

  signedIn = null;
  await clearUserData();
  finish();
  await done;

  expect(sentAs).toEqual(['a']);
});
