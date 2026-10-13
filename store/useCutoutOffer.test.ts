/* eslint-disable @typescript-eslint/no-require-imports -- a fresh copy of the modules per test, after jest.resetModules */
// The photo cut-out's OTA guard: binaries built before the SubjectCutout
// native module (and the web) get this JS by update, and must hide the option
// and keep the original photo instead of crashing.

const mockRequireOptional = jest.fn();
jest.mock('expo', () => ({ requireOptionalNativeModule: (name: string) => mockRequireOptional(name) }));

type Store = typeof import('./useCutoutOffer');
type Wrapper = typeof import('@/modules/subject-cutout');

beforeEach(() => {
  jest.resetModules();
  mockRequireOptional.mockReset();
});

test('without the native module the option is hidden and the original is kept', async () => {
  mockRequireOptional.mockReturnValue(null);
  const { cutout, cutoutAvailable } = require('@/modules/subject-cutout') as Wrapper;
  const { offerCutout, useCutoutOffer } = require('./useCutoutOffer') as Store;
  expect(mockRequireOptional).toHaveBeenCalledWith('SubjectCutout');
  expect(cutoutAvailable).toBe(false);
  expect(await cutout('file:///photo.jpg')).toBeNull();
  expect(await offerCutout('file:///photo.jpg')).toBe('file:///photo.jpg');
  expect(useCutoutOffer.getState().offer).toBeNull();
});

test('an older iOS (no foreground mask) hides the option too', async () => {
  const native = { isSupported: () => false, cutout: jest.fn() };
  mockRequireOptional.mockReturnValue(native);
  const { offerCutout } = require('./useCutoutOffer') as Store;
  expect(await offerCutout('file:///photo.jpg')).toBe('file:///photo.jpg');
  expect(native.cutout).not.toHaveBeenCalled();
});

test('no host on screen to ask: the original is kept, nothing waits forever', async () => {
  const native = { isSupported: () => true, cutout: jest.fn() };
  mockRequireOptional.mockReturnValue(native);
  const { offerCutout } = require('./useCutoutOffer') as Store;
  expect(await offerCutout('file:///photo.jpg')).toBe('file:///photo.jpg');
  expect(native.cutout).not.toHaveBeenCalled();
});

test('no subject found: nothing is offered, the original is kept', async () => {
  mockRequireOptional.mockReturnValue({ isSupported: () => true, cutout: async () => ({ reason: 'no-subject' }) });
  const { offerCutout, registerCutoutHost, useCutoutOffer } = require('./useCutoutOffer') as Store;
  registerCutoutHost('host');
  expect(await offerCutout('file:///photo.jpg')).toBe('file:///photo.jpg');
  expect(useCutoutOffer.getState().offer).toBeNull();
});

test('a cut-out is offered and the choice is what gets uploaded', async () => {
  mockRequireOptional.mockReturnValue({ isSupported: () => true, cutout: async () => ({ uri: 'file:///cut.png', width: 4, height: 5 }) });
  const { offerCutout, registerCutoutHost, useCutoutOffer } = require('./useCutoutOffer') as Store;
  const unregister = registerCutoutHost('host');
  const picked = offerCutout('file:///photo.jpg');
  await new Promise((resolve) => setImmediate(resolve));
  const offer = useCutoutOffer.getState().offer;
  expect(offer).toMatchObject({ original: 'file:///photo.jpg', cutout: 'file:///cut.png' });
  offer!.choose(offer!.cutout);
  expect(await picked).toBe('file:///cut.png');
  expect(useCutoutOffer.getState().offer).toBeNull();
  unregister();
  expect(useCutoutOffer.getState().hosts).toEqual([]);
});
