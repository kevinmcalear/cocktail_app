/* eslint-disable @typescript-eslint/no-require-imports -- a fresh copy of the module per test, after jest.resetModules */
// The OTA guard in lib/shake.ts: on a binary without the accelerometer native
// module (the 1.3.0 store builds), expo-sensors must never be loaded.

const mockRequireOptional = jest.fn();
const mockLoaded = jest.fn();

jest.mock('expo', () => ({ requireOptionalNativeModule: (name: string) => mockRequireOptional(name) }));
jest.mock('expo-sensors', () => {
  mockLoaded();
  return {
    Accelerometer: {
      setUpdateInterval: jest.fn(),
      addListener: (fn: (m: { x: number; y: number; z: number }) => void) => {
        (globalThis as { emit?: typeof fn }).emit = fn;
        return { remove: jest.fn() };
      },
    },
  };
});

beforeEach(() => {
  jest.resetModules();
  mockRequireOptional.mockReset();
  mockLoaded.mockReset();
});

test('an old binary without the native module never loads expo-sensors', () => {
  mockRequireOptional.mockReturnValue(null);
  const { canListenForShakes, listenForShakes } = require('./shake') as typeof import('./shake');
  expect(canListenForShakes()).toBe(false);
  expect(listenForShakes(jest.fn())).toBeNull();
  expect(mockRequireOptional).toHaveBeenCalledWith('ExponentAccelerometer');
  expect(mockLoaded).not.toHaveBeenCalled();
});

test('a binary with the module listens and fires once per shake', () => {
  mockRequireOptional.mockReturnValue({});
  const { listenForShakes } = require('./shake') as typeof import('./shake');
  const onShake = jest.fn();
  const stop = listenForShakes(onShake);
  expect(stop).toEqual(expect.any(Function));
  expect(mockLoaded).toHaveBeenCalledTimes(1);
  const emit = (globalThis as { emit?: (m: { x: number; y: number; z: number }) => void }).emit!;
  for (let i = 0; i < 6; i++) emit({ x: 2.4, y: 1, z: -1 });
  expect(onShake).toHaveBeenCalledTimes(1);
});
