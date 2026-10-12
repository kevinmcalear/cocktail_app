import * as ImagePicker from 'expo-image-picker';


/** A page of a printed menu, picked or taken. */
export interface MenuPhoto {
  uri: string;
  mimeType: string;
  /** The file's name, when it came from a file (a drop, the file chooser). */
  name?: string;
}

export const MAX_MENU_PHOTOS = 4;

/** Shown when someone says no to Google AI: nothing was sent. */
export const AI_DECLINED = 'Nothing was sent. Reading a photo uses Google AI, so it needs your OK first.';

// Small enough that four pages fit one request, sharp enough to read print.
const QUALITY = 0.5;

const toPhotos = (result: ImagePicker.ImagePickerResult): MenuPhoto[] =>
  result.canceled ? [] : result.assets.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' }));

/** Pages from the photo library, up to `limit`. Empty when cancelled. */
export async function pickMenuPhotos(limit: number): Promise<MenuPhoto[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Allow access to your photos to read a menu from them.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: limit, quality: QUALITY });
  return toPhotos(result).slice(0, limit);
}

/** One page from the camera. Empty when cancelled. */
export async function takeMenuPhoto(): Promise<MenuPhoto[]> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Allow camera access in Settings to photograph a menu.');
  return toPhotos(await ImagePicker.launchCameraAsync({ quality: QUALITY }));
}
