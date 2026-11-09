import { act, render, renderHook, screen } from '@testing-library/react-native';
import { createContext, useContext } from 'react';
import { Platform, Text } from 'react-native';

import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useUnderSeeThrough } from '@/components/nav/useUnderSeeThrough.web';

let mockFocused = false;
// Under a create wizard's dialog (useUnderSeeThrough), as MountOnFocus sees it.
let mockUnder = false;
// The root state the web hook walks: the tabs, or a create wizard over them.
let mockRoot: unknown = { index: 0, routes: [{ name: '(tabs)' }] };
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused, useRootNavigationState: () => mockRoot }));
jest.mock('@/components/nav/useUnderSeeThrough', () => ({ useUnderSeeThrough: () => mockUnder }));
afterEach(() => {
  mockFocused = false;
  mockUnder = false;
});
// The freeze waits a tick after the blur; these tests move the clock themselves.
jest.useFakeTimers();

test('a tab mounts on its first focus and stays mounted after', async () => {
  mockFocused = false;
  const tab = () => (
    <MountOnFocus>
      <Text>Library</Text>
    </MountOnFocus>
  );
  const { rerender } = await render(tab());
  expect(screen.queryByText('Library')).toBeNull();

  mockFocused = true;
  await rerender(tab());
  expect(screen.getByText('Library')).toBeTruthy();

  mockFocused = false;
  await rerender(tab());
  expect(screen.getByText('Library')).toBeTruthy();
});

test('on web, a tab you leave stops re-rendering until you come back', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const Shelf = createContext('Gin');
  let renders = 0;
  function Bottle() {
    renders += 1;
    return <Text>{useContext(Shelf)}</Text>;
  }
  const tab = (bottle: string) => (
    <Shelf.Provider value={bottle}>
      <MountOnFocus>
        <Bottle />
      </MountOnFocus>
    </Shelf.Provider>
  );
  mockFocused = true;
  const { rerender } = await render(tab('Gin'));
  mockFocused = false;
  await rerender(tab('Gin'));
  await act(async () => jest.runAllTimers());
  const left = renders;

  await rerender(tab('Rum'));
  await rerender(tab('Mezcal'));
  expect(renders).toBe(left);

  mockFocused = true;
  await rerender(tab('Mezcal'));
  expect(screen.getByText('Mezcal')).toBeTruthy();
  expect(renders).toBe(left + 1);
});

test('on web, under a create wizard the tab mounts and keeps rendering, as the page under its dialog', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const Shelf = createContext('Gin');
  function Bottle() {
    return <Text>{useContext(Shelf)}</Text>;
  }
  const tab = (bottle: string) => (
    <Shelf.Provider value={bottle}>
      <MountOnFocus>
        <Bottle />
      </MountOnFocus>
    </Shelf.Provider>
  );
  // A link straight to /add-beer: Tonight was never focused, and it still shows under the dialog.
  mockUnder = true;
  const { rerender } = await render(tab('Gin'));
  await act(async () => jest.runAllTimers());
  expect(screen.getByText('Gin')).toBeTruthy();
  await rerender(tab('Rum'));
  await act(async () => jest.runAllTimers());
  expect(screen.getByText('Rum')).toBeTruthy();

  // Saved, its page replaces the dialog: the tab under it freezes.
  mockUnder = false;
  await rerender(tab('Rum'));
  await act(async () => jest.runAllTimers());
  await rerender(tab('Mezcal'));
  expect(screen.queryByText('Mezcal')).toBeNull();
});

test('the web hook finds a create wizard wherever it sits in the root state, on a wide window only', async () => {
  const wide = (width: number) => jest.spyOn(jest.requireActual<typeof import('react-native')>('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
  wide(1440);
  mockRoot = { index: 0, routes: [{ name: '__root', state: { index: 1, routes: [{ name: '(tabs)' }, { name: 'add-beer' }] } }] };
  expect((await renderHook(() => useUnderSeeThrough())).result.current).toBe(true);
  mockRoot = { index: 0, routes: [{ name: '__root', state: { index: 0, routes: [{ name: '(tabs)' }, { name: 'add-beer' }] } }] };
  expect((await renderHook(() => useUnderSeeThrough())).result.current).toBe(false);
  // Phone width: the wizard is a whole page, not a dialog over the tab.
  wide(390);
  mockRoot = { index: 1, routes: [{ name: '(tabs)' }, { name: 'add-ingredient' }] };
  expect((await renderHook(() => useUnderSeeThrough())).result.current).toBe(false);
  jest.restoreAllMocks();
});
