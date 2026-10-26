import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import { canUseCamera } from './photoAccess';

jest.mock('expo-image-picker', () => ({ getCameraPermissionsAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() }));

const get = ImagePicker.getCameraPermissionsAsync as jest.Mock;
const request = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

beforeEach(() => jest.clearAllMocks());

test('already allowed: the camera opens without asking', async () => {
  get.mockResolvedValue({ granted: true, canAskAgain: true });
  expect(await canUseCamera()).toBe(true);
  expect(request).not.toHaveBeenCalled();
});

test('not asked yet: asks, and a no given just now gets no second message', async () => {
  get.mockResolvedValue({ granted: false, canAskAgain: true });
  request.mockResolvedValue({ granted: false, canAskAgain: false });
  expect(await canUseCamera()).toBe(false);
  expect(request).toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});

test('turned off: says so, and Open Settings opens Settings', async () => {
  get.mockResolvedValue({ granted: false, canAskAgain: false });
  expect(await canUseCamera()).toBe(false);
  expect(request).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons.map((b) => b.text)).toEqual(['Not now', 'Open Settings']);
  buttons[1].onPress!();
  expect(openSettings).toHaveBeenCalled();
});
