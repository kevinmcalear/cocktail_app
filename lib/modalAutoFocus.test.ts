import type { ComponentRef, RefObject } from 'react';
import { Keyboard, type TextInput } from 'react-native';

import { focusInModal } from './modalAutoFocus';

const fakeInput = () => {
  const input = { focus: jest.fn(), blur: jest.fn() };
  return { input, ref: { current: input } as unknown as RefObject<ComponentRef<typeof TextInput> | null> };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('stops once the keyboard is up', () => {
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  const { input, ref } = fakeInput();
  focusInModal(ref);
  jest.runAllTimers();
  expect(input.focus).toHaveBeenCalledTimes(1);
  expect(input.blur).not.toHaveBeenCalled();
});

test('asks again until the keyboard shows, then stops', () => {
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  const { input, ref } = fakeInput();
  focusInModal(ref);
  jest.advanceTimersByTime(150);
  visible.mockReturnValue(true);
  jest.runAllTimers();
  expect(input.focus).toHaveBeenCalledTimes(2);
  expect(input.blur).toHaveBeenCalledTimes(1);
});

test('gives up after its tries, and once the sheet has closed', () => {
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  const a = fakeInput();
  focusInModal(a.ref, 3);
  jest.runAllTimers();
  expect(a.input.focus).toHaveBeenCalledTimes(3);

  const b = fakeInput();
  focusInModal(b.ref);
  b.ref.current = null;
  jest.runAllTimers();
  expect(b.input.focus).toHaveBeenCalledTimes(1);
  expect(b.input.blur).not.toHaveBeenCalled();
});
