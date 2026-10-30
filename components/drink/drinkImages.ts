import { decode } from 'base64-arraybuffer';
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { imageExtFromUri, uriToBase64 } from '@/lib/imageBase64';
import { isHeroLink } from '@/lib/itemImages';
import { canUseCamera } from '@/lib/photoAccess';
import { supabase, UPLOAD_CACHE_SECONDS } from '@/lib/supabase';
import { offerCutout } from '@/store/useCutoutOffer';

/**
 * `cutout`: a venue's drink photo, so offer to lift the drink off its background (store/useCutoutOffer). `square`: crop 1:1 (an ingredient's photo), not 4:5.
 * `several`: pick up to this many at once (no crop then, and the cut-out is only offered for one).
 */
type PickOptions = { cutout?: boolean; square?: boolean; several?: number };

/** Lets the user pick photos; returns their local URIs. */
export async function pickDrinkPhotos({ cutout = false, square = false, several = 1 }: PickOptions = {}): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    ...(several > 1 ? { allowsMultipleSelection: true, selectionLimit: several } : { allowsEditing: true }),
    aspect: square ? [1, 1] : [4, 5],
    quality: 0.8,
  });
  if (result.canceled) return [];
  const uris = result.assets.map((asset) => asset.uri);
  return cutout && uris.length === 1 ? [await offerCutout(uris[0])] : uris;
}

/** Asks for camera access and takes one photo; returns its local URI, or null if cancelled. */
export async function takeDrinkPhoto({ cutout = false, square = false }: PickOptions = {}): Promise<string | null> {
  if (!(await canUseCamera())) return null;
  const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: square ? [1, 1] : [4, 5], quality: 0.8 });
  const uri = result.canceled ? null : (result.assets[0]?.uri ?? null);
  return uri && cutout ? offerCutout(uri) : uri;
}

/** Whether this build can crop a photo it already has. Builds from before Draw my glass lack the native module. */
export function canCropPhotos(): boolean {
  return Platform.OS === 'web' || !!requireOptionalNativeModule('ExpoImageManipulator');
}

/**
 * A new local copy of a photo cut to `rect` (lib/photoCrop.ts). A PNG (a
 * cut-out) stays a PNG, so its background stays clear. The photo can be saved
 * already (a URL) or just picked.
 */
export async function cropPhoto(uri: string, rect: { originX: number; originY: number; width: number; height: number }, png: boolean): Promise<string> {
  // Loaded only here: importing it on a build without the module throws.
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const web = Platform.OS === 'web';
  // Native crops local files: a saved photo is fetched to the cache first.
  const local = !web && /^https?:/.test(uri) ? (await FileSystem.downloadAsync(uri, `${FileSystem.cacheDirectory}crop_${Date.now()}.${png ? 'png' : 'jpg'}`)).uri : uri;
  const image = await ImageManipulator.manipulate(local).crop(rect).renderAsync();
  const saved = await image.saveAsync({ compress: 0.85, format: png ? SaveFormat.PNG : SaveFormat.JPEG, base64: web });
  // The web hands back a blob: URL, which has no file type; a data: URL keeps it for the upload (imageExtFromUri).
  return web && saved.base64 ? `data:image/${png ? 'png' : 'jpeg'};base64,${saved.base64}` : saved.uri;
}

/** Uploads a local photo to the drinks bucket at `folder/`; returns its new `images` row id. */
export async function uploadDrinkPhoto(uri: string, folder: string): Promise<{ id: string; url: string } | null> {
  const ext = imageExtFromUri(uri);
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const arrayBuffer = decode(await uriToBase64(uri));

  const { error: uploadError } = await supabase.storage.from('drinks').upload(fileName, arrayBuffer, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: false,
    cacheControl: UPLOAD_CACHE_SECONDS,
  });
  if (uploadError) return null;

  const { data: publicUrlData } = supabase.storage.from('drinks').getPublicUrl(fileName);
  const { data: imgData, error: imgError } = await supabase
    .from('images')
    .insert({ url: publicUrlData.publicUrl })
    .select()
    .single();
  if (imgError || !imgData) return null;
  return { id: imgData.id, url: publicUrlData.publicUrl };
}

/**
 * The `images` row id for a photo being saved: an already-hosted URL is
 * looked up (or recorded), and a local file is uploaded to `folder/`.
 */
export async function imageIdFor(uri: string, folder: string): Promise<string | null> {
  try {
    if (uri.startsWith('http')) {
      const { data: existing } = await supabase.from('images').select('id').eq('url', uri).limit(1).maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await supabase.from('images').insert({ url: uri }).select().single();
      return !error && created ? created.id : null;
    }
    return (await uploadDrinkPhoto(uri, folder))?.id ?? null;
  } catch (error) {
    console.error('Image upload flow exception:', error);
    return null;
  }
}

/**
 * Sets an item's hero picture links to `imageIds`, in order. With `replace`,
 * hero links not in the list are removed. Links that stay are updated in place
 * rather than deleted and re-created, so what the server knows about each one
 * (whether a photo may be out of date) survives the save. Service photos (side,
 * top, garnish, hand-off) belong to the drink page's Service section and are
 * never touched here.
 */
export async function setItemImages(itemId: string, imageIds: string[], { replace }: { replace: boolean }) {
  const { data: links, error } = await supabase
    .from('item_images')
    .select('id, image_id, sort_order, angle')
    .eq('item_id', itemId);
  if (error) throw error;
  const existing = (links ?? []).filter(isHeroLink);
  const servicePhotos = new Set((links ?? []).filter((link) => !isHeroLink(link)).map((link) => link.image_id));
  const linkByImage = new Map(existing.map((link) => [link.image_id, link]));
  const heroIds = imageIds.filter((id) => !servicePhotos.has(id));

  if (replace) {
    const keep = new Set(heroIds);
    const removed = existing.filter((link) => !link.image_id || !keep.has(link.image_id)).map((link) => link.id);
    if (removed.length) {
      const { error: deleteError } = await supabase.from('item_images').delete().in('id', removed);
      if (deleteError) throw deleteError;
    }
  }

  const added: { item_id: string; image_id: string; sort_order: number }[] = [];
  for (const [index, imageId] of heroIds.entries()) {
    const link = linkByImage.get(imageId);
    if (!link) {
      added.push({ item_id: itemId, image_id: imageId, sort_order: index });
    } else if (Number(link.sort_order) !== index) {
      const { error: updateError } = await supabase.from('item_images').update({ sort_order: index }).eq('id', link.id);
      if (updateError) throw updateError;
    }
  }
  if (added.length) {
    const { error: insertError } = await supabase.from('item_images').insert(added);
    if (insertError) throw insertError;
  }
}
