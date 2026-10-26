import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** A photo picked with its file name, which says which bottle it is more often than not. */
export interface NamedPhoto {
  uri: string;
  fileName: string;
  mimeType: string;
}

/** A folder or a pick of many: its photos, and the folder's name when there was one. */
export interface PhotoFolder {
  name: string | null;
  photos: NamedPhoto[];
}

// ponytail: a brand's whole range in one go; a bigger folder goes in a few picks (Add more).
export const MAX_FOLDER_PHOTOS = 60;

/** The images among picked or dropped files, as NamedPhotos (blob URLs). */
export function photosFromFiles(files: ArrayLike<File> | null | undefined): NamedPhoto[] {
  return Array.from(files ?? [])
    .filter((file) => file.type.startsWith('image/'))
    .slice(0, MAX_FOLDER_PHOTOS)
    .map((file) => ({ uri: URL.createObjectURL(file), fileName: file.name, mimeType: file.type }));
}

/**
 * Web (and the desktop shell) at `folder`: the browser's folder chooser, so a
 * brand can hand over its packshot folder as it is; a phone's browser, which
 * can't choose folders, picks many images. Phones: many photos from the
 * library at once. Empty when cancelled.
 */
export async function pickPhotoFolder({ folder }: { folder: boolean }): Promise<PhotoFolder> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      if (folder) input.setAttribute('webkitdirectory', '');
      else input.accept = 'image/*';
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        const path = (files[0] as (File & { webkitRelativePath?: string }) | undefined)?.webkitRelativePath ?? '';
        resolve({ name: path.includes('/') ? path.split('/')[0] : null, photos: photosFromFiles(files) });
      };
      input.oncancel = () => resolve({ name: null, photos: [] });
      input.click();
    });
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_FOLDER_PHOTOS, quality: 0.8 });
  if (result.canceled) return { name: null, photos: [] };
  return {
    name: null,
    photos: result.assets.map((a, i) => ({ uri: a.uri, fileName: a.fileName ?? `Photo ${i + 1}`, mimeType: a.mimeType ?? 'image/jpeg' })),
  };
}
