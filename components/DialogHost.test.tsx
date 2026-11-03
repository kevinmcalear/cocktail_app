// Web dialogs: on the web the host loads straight after the first render
// (components/nav/RootHosts.web.tsx). A confirm asked before it mounts waits
// in the dialog store, so it still shows once the host is in, and its promise
// still settles.
import { fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DialogHost } from './DialogHost';
import { renderWithProviders } from '@/jest.setup';
import { confirmAsync, installWebAlert } from '@/lib/dialogs';
import { useDialogStore } from '@/store/useDialogStore';

const os = Platform.OS;
beforeAll(() => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  // The card listens for Escape and Enter on the window, which the native test environment has no events on.
  Object.assign(window, { addEventListener: jest.fn(), removeEventListener: jest.fn() });
  installWebAlert();
});
afterAll(() => Object.defineProperty(Platform, 'OS', { value: os, configurable: true }));
afterEach(() => useDialogStore.setState({ queue: [] }));

test('a confirm asked before the host mounts shows once it does, and resolves', async () => {
  const answer = confirmAsync({ title: 'Discard changes?', message: 'Your unsaved edits will be lost.', confirmText: 'Discard', destructive: true });
  await renderWithProviders(<DialogHost />);
  expect(screen.getByText('Discard changes?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Discard'));
  await expect(answer).resolves.toBe(true);
  expect(useDialogStore.getState().queue).toHaveLength(0);
});

test('two asked before it mounts show one after the other', async () => {
  const first = confirmAsync({ title: 'First?', message: 'One' });
  const second = confirmAsync({ title: 'Second?', message: 'Two' });
  await renderWithProviders(<DialogHost />);
  await fireEvent.press(screen.getByText('Cancel'));
  await expect(first).resolves.toBe(false);
  expect(await screen.findByText('Second?')).toBeTruthy();
  await fireEvent.press(screen.getByText('OK'));
  await expect(second).resolves.toBe(true);
});
