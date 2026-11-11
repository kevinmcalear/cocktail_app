// jest.setup.tsx installs the technique library before every test file, so
// this file swaps in a fresh module registry (no library) at load time and
// takes React, the testing library and the gate from it, all one copy.
jest.resetModules();
// The library's lazy chunk never arrives (offline, or a deploy removed it).
jest.doMock('@/lib/techniques/library', () => {
  throw new Error('Loading chunk 7 failed');
});
/* eslint-disable @typescript-eslint/no-require-imports -- taken from the fresh registry above, so require, not import */
const rtl: typeof import('@testing-library/react-native') = require('@testing-library/react-native');
const { Text }: typeof import('react-native') = require('react-native');
const { onlineManager }: typeof import('@tanstack/react-query') = require('@tanstack/react-query');
const { TechniquesGate }: typeof import('./TechniquesGate') = require('./TechniquesGate');
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const failedTitle = 'Couldn’t load the technique library.';

test('the gate says the library failed after the second miss, and the wording follows the connection', async () => {
  await rtl.render(
    <TechniquesGate fallback={<Text>Waiting</Text>}>
      <Text>Library</Text>
    </TechniquesGate>,
  );
  // One miss is a hiccup: still the fallback.
  await rtl.act(async () => {});
  expect(rtl.screen.getByText('Waiting')).toBeTruthy();

  // The retry a couple of seconds later fails too: now it says so.
  await rtl.act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(rtl.screen.getByText(failedTitle)).toBeTruthy();
  expect(rtl.screen.getByText('Try again, or reload if it keeps happening.')).toBeTruthy();
  expect(rtl.screen.queryByText('Library')).toBeNull();

  // The line changes with the connection, without a tap.
  await rtl.act(async () => onlineManager.setOnline(false));
  expect(rtl.screen.getByText('Check your connection and try again.')).toBeTruthy();
  await rtl.act(async () => onlineManager.setOnline(true));
  expect(rtl.screen.getByText('Try again, or reload if it keeps happening.')).toBeTruthy();
});

test('a card that can go without shows nothing on failure', async () => {
  await rtl.render(
    <TechniquesGate onFailure="none">
      <Text>Library</Text>
    </TechniquesGate>,
  );
  await rtl.act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(rtl.screen.queryByText(failedTitle)).toBeNull();
  expect(rtl.screen.queryByText('Library')).toBeNull();
});
