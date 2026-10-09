import { act, renderHook } from '@testing-library/react-native';

import { useMapMoves } from '@/hooks/useMapMoves';
import type { Viewport } from '@/lib/discoverMap';

// useDiscover pulls in Supabase; the map only needs its debounce, which settles at once here.
jest.mock('@/hooks/useDiscover', () => ({ useDebounced: (v: unknown) => v }));

// Near me opens on the person's neighbourhood.
const fit = { latitude: -37.81, longitude: 144.96, zoom: 13.5 };
const view: Viewport = { ...fit, latitudeDelta: 0.02, longitudeDelta: 0.02 };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function render(follow: boolean) {
  const onSearch = jest.fn();
  const hook = await renderHook(({ follow }: { follow: boolean }) => useMapMoves(fit, follow, onSearch), { initialProps: { follow } });
  const move = (v: Viewport) => act(() => hook.result.current.onMove(v));
  const settle = () => act(() => jest.advanceTimersByTime(400));
  return { hook, onSearch, move, settle };
}

test('browsing, a move far enough searches once the map settles', async () => {
  const { hook, onSearch, move, settle } = await render(true);

  await move({ ...view, latitude: -37.811 });
  await settle();
  expect(onSearch).not.toHaveBeenCalled();

  await move({ ...view, zoom: 12 });
  expect(onSearch).not.toHaveBeenCalled();
  await settle();
  expect(onSearch).toHaveBeenCalledWith({ ...view, zoom: 12 });
  expect(hook.result.current.offer).toBeNull();

  // A nudge from the view just searched doesn't search again; another big move does.
  await move({ ...view, zoom: 12.1 });
  await settle();
  expect(onSearch).toHaveBeenCalledTimes(1);
  await move({ ...view, zoom: 14 });
  await settle();
  expect(onSearch).toHaveBeenCalledTimes(2);
});

test('a quick second move replaces the first', async () => {
  const { onSearch, move, settle } = await render(true);
  await move({ ...view, zoom: 12 });
  await move({ ...view, zoom: 11 });
  await settle();
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenCalledWith({ ...view, zoom: 11 });
});

test('searching, a move is offered, and searched only when asked', async () => {
  const { hook, onSearch, move, settle } = await render(false);
  await move({ ...view, zoom: 12 });
  await settle();
  expect(onSearch).not.toHaveBeenCalled();

  const offer = hook.result.current.offer;
  expect(offer).toEqual({ ...view, zoom: 12 });
  await act(() => hook.result.current.search(offer!));
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(hook.result.current.offer).toBeNull();
});

test('a move still settling when the map goes away does not search', async () => {
  const { hook, onSearch, move, settle } = await render(true);
  await move({ ...view, zoom: 12 });
  await hook.unmount();
  await settle();
  expect(onSearch).not.toHaveBeenCalled();
});
