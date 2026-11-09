import { act, render, screen } from '@testing-library/react-native';
import { createContext, useContext } from 'react';
import { Platform, Text } from 'react-native';

import { MountOnFocus } from '@/components/nav/MountOnFocus';

let mockFocused = false;
// The root stack's top route: the tabs, or a create wizard over them.
let mockTop = '(tabs)';
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused, useRootNavigationState: () => ({ index: 0, routes: [{ name: mockTop }] }) }));
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
  const tab = (bottle: string) => (
    <Shelf.Provider value={bottle}>
      <MountOnFocus>
        <Bottle />
      </MountOnFocus>
    </Shelf.Provider>
  );
  function Bottle() {
    return <Text>{useContext(Shelf)}</Text>;
  }
  // A link straight to /add-beer: Tonight was never focused, and it still shows under the dialog.
  mockFocused = false;
  mockTop = 'add-beer';
  const { rerender } = await render(tab('Gin'));
  await act(async () => jest.runAllTimers());
  expect(screen.getByText('Gin')).toBeTruthy();
  await rerender(tab('Rum'));
  await act(async () => jest.runAllTimers());
  expect(screen.getByText('Rum')).toBeTruthy();

  // Saved, its page replaces the dialog: the tab under it freezes.
  mockTop = 'beer/[id]';
  await rerender(tab('Rum'));
  await act(async () => jest.runAllTimers());
  await rerender(tab('Mezcal'));
  expect(screen.queryByText('Mezcal')).toBeNull();
  mockTop = '(tabs)';
});
