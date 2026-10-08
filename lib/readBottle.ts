import * as ImagePicker from 'expo-image-picker';

import { uriToBase64 } from '@/lib/imageBase64';
import { invokeFunction } from '@/lib/invokeFunction';
import type { BottleReading } from '@/supabase/functions/_shared/bottleRead';

export type { BottleReading };

/** A photo of one or more bottles, picked or taken. */
export interface BottlePhoto {
  uri: string;
  mimeType: string;
}

// Labels are big print; this keeps the upload small and quick.
const QUALITY = 0.6;

const toPhoto = (result: ImagePicker.ImagePickerResult): BottlePhoto | null =>
  result.canceled || !result.assets[0] ? null : { uri: result.assets[0].uri, mimeType: result.assets[0].mimeType ?? 'image/jpeg' };

/** A photo from the library. Null when cancelled. */
export async function pickBottlePhoto(): Promise<BottlePhoto | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Allow access to your photos to read a bottle from one.');
  return toPhoto(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: QUALITY }));
}

/** A photo from the camera. Null when cancelled. */
export async function takeBottlePhoto(): Promise<BottlePhoto | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Allow camera access in Settings to photograph a bottle.');
  return toPhoto(await ImagePicker.launchCameraAsync({ quality: QUALITY }));
}

/** Reads the labels in the photo (read-bottle): brand, name, kind and ABV of each bottle. */
export async function readBottlePhoto(photo: BottlePhoto): Promise<BottleReading[]> {
  const base64 = await uriToBase64(photo.uri);
  const reading = await invokeFunction<{ bottles?: BottleReading[] }>('read-bottle', { photo: { base64, mime_type: photo.mimeType } });
  if (!reading?.bottles?.length) throw new Error('Couldn’t read a label in that photo. Try closer, with the front label facing you.');
  return reading.bottles;
}
