import { Platform } from 'react-native';

import { currentProps, pressedProps } from './a11yState';

const setOS = (os: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const original = Platform.OS;
afterEach(() => setOS(original));

test.each(['ios', 'android'] as const)('%s keeps the selected state native screen readers announce', (os) => {
  setOS(os);
  expect(pressedProps(true)).toEqual({ 'aria-selected': true });
  expect(pressedProps(false)).toEqual({ 'aria-selected': false });
  expect(currentProps(true)).toEqual({ 'aria-selected': true });
  expect(currentProps(false, 'true')).toEqual({ 'aria-selected': false });
});

test('web uses aria-pressed for toggles and aria-current for the current item', () => {
  setOS('web');
  expect(pressedProps(true)).toEqual({ 'aria-pressed': true });
  expect(pressedProps(false)).toEqual({ 'aria-pressed': false });
  expect(currentProps(true)).toEqual({ 'aria-current': 'page' });
  expect(currentProps(true, 'true')).toEqual({ 'aria-current': 'true' });
  // Absent rather than "false", so screen readers say nothing on the other items.
  expect(currentProps(false)).toEqual({ 'aria-current': undefined });
});
