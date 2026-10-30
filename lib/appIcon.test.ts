// The OTA guard in lib/appIcon.ts: store builds made before
// expo-alternate-app-icons have no native module, so Settings shows no App
// icon row and nothing throws.
import { appIconChoices, currentAppIcon, DEFAULT_APP_ICON, setAppIcon } from './appIcon';

const mockRequireOptional = jest.fn();
jest.mock('expo', () => ({ requireOptionalNativeModule: (name: string) => mockRequireOptional(name) }));

beforeEach(() => mockRequireOptional.mockReset());

test('a build without the native module offers no icons and stays on Default', async () => {
  mockRequireOptional.mockReturnValue(null);
  expect(appIconChoices()).toBeNull();
  expect(currentAppIcon()).toBe(DEFAULT_APP_ICON);
  await expect(setAppIcon('ThreeHorses')).resolves.toBeUndefined();
  expect(mockRequireOptional).toHaveBeenCalledWith('ExpoAlternateAppIcons');
});

test('a device that cannot switch icons offers none', () => {
  mockRequireOptional.mockReturnValue({ supportsAlternateIcons: false });
  expect(appIconChoices()).toBeNull();
});

test('a build with the module lists Default first and sets by name, Default as null', async () => {
  const setAlternateAppIcon = jest.fn().mockResolvedValue(null);
  mockRequireOptional.mockReturnValue({ supportsAlternateIcons: true, getAppIconName: () => 'ThreeHorses', setAlternateAppIcon });
  // Jest runs with __DEV__ on, so placeholder icons are listed too.
  expect(appIconChoices()?.map((c) => c.id)).toEqual([DEFAULT_APP_ICON, 'CaretakersCottage', 'ThreeHorses']);
  expect(currentAppIcon()).toBe('ThreeHorses');
  await setAppIcon(DEFAULT_APP_ICON);
  expect(setAlternateAppIcon).toHaveBeenCalledWith(null);
  await setAppIcon('CaretakersCottage');
  expect(setAlternateAppIcon).toHaveBeenCalledWith('CaretakersCottage');
});
