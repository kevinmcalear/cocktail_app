import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Camera access, checked before every launchCameraAsync. Asks while the phone
 * still can. Once the person has said no, only Settings can turn it back on,
 * so it says that, with Open Settings. A no given just now isn't argued with.
 * Resolves true when the camera may open.
 *
 * The photo library needs no check: launchImageLibraryAsync opens the system
 * picker, which hands over only the photos picked and works with Photos access
 * off. Asking for the whole library only gave people a way to break it.
 */
export async function canUseCamera(): Promise<boolean> {
  const before = await ImagePicker.getCameraPermissionsAsync();
  if (before.granted) return true;
  if (before.canAskAgain) return (await ImagePicker.requestCameraPermissionsAsync()).granted;
  Alert.alert('Camera access is off', 'Turn on Camera for this app in Settings to take a photo.', [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => void Linking.openSettings() },
  ]);
  return false;
}
