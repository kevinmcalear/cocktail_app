import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';

import { handoverPhotoMutation, PhotoOfflineError, PHOTO_UPLOAD_MS } from '@/hooks/useHandoverPhoto';

const mockPick = jest.fn();
const mockUpload = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: () => mockPick() }));
jest.mock('@/lib/imageBase64', () => ({ uriToBase64: async () => '' }));
jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'me' }));
jest.mock('@/lib/supabase', () => ({ UPLOAD_CACHE_SECONDS: '3600', supabase: { storage: { from: () => ({ upload: () => mockUpload() }) } } }));

const add = () => new MutationObserver(new QueryClient(), handoverPhotoMutation('bar', 'me')).mutate();

beforeEach(() => {
  mockPick.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] });
  mockUpload.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => {
  onlineManager.setOnline(true);
  jest.useRealTimers();
});

test('with no signal it fails straight away instead of pausing', async () => {
  onlineManager.setOnline(false);
  await expect(add()).rejects.toBeInstanceOf(PhotoOfflineError);
  expect(mockPick).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
});

test('an upload that never reached the server says no signal', async () => {
  mockUpload.mockResolvedValue({ error: new Error('Network request failed') });
  await expect(add()).rejects.toBeInstanceOf(PhotoOfflineError);
});

test('an upload that stalls gives up after the limit', async () => {
  jest.useFakeTimers();
  mockUpload.mockReturnValue(new Promise(() => {}));
  const done = expect(add()).rejects.toBeInstanceOf(PhotoOfflineError);
  await jest.advanceTimersByTimeAsync(PHOTO_UPLOAD_MS);
  await done;
});

test('online, it resolves the stored path', async () => {
  await expect(add()).resolves.toMatch(/^bar\/me\/\d+\.jpg$/);
});
