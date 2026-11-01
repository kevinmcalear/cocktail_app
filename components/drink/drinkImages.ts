import { decode } from 'base64-arraybuffer';
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { imageExtFromUri, uriToBase64 } from '@/lib/imageBase64';
import { isHeroLink } from '@/lib/itemImages';
import { pageCopyPath } from '@/lib/thumbnails';
import { canUseCamera } from '@/lib/photoAccess';
import { readPhotoPixels } from '@/lib/photoPixels';
import { supabase, UPLOAD_CACHE_SECONDS } from '@/lib/supabase';
import { offerCutout } from '@/store/useCutoutOffer';
import { LAYOUT_WIDTH, readPhotoLayout } from '@/supabase/functions/_shared/photoLayout';
import type { Insert, Json } from '@/types/db';

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

/** The widest a photo is kept: a page at 3x on the widest phone, and the full-screen viewer. */
const KEEP_WIDTH = 2048;
/** The page copy's width (lib/thumbnails.ts). */
const PAGE_WIDTH = 1080;

interface Sized {
  /** The photo at most KEEP_WIDTH wide, and its page copy at most PAGE_WIDTH. */
  kept: string;
  page: string;
  width: number;
  height: number;
  /** Null on the web, which can't make one: the image-palette worker adds it there. */
  thumbhash: string | null;
}

/**
 * The photo made smaller on the phone before it uploads (decision
 * image-pipeline): a phone camera's 4000 px photo is 2 to 3 MB, a page needs
 * 1080 px. JPEG at 0.8, or PNG for a cut-out so it stays clear. Null where the
 * build can't (no image manipulator): the original uploads as before.
 */
async function sizedCopies(uri: string, png: boolean): Promise<Sized | null> {
  if (!canCropPhotos()) return null;
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const web = Platform.OS === 'web';
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const at = async (width: number) => {
    const image = await ImageManipulator.manipulate(uri).resize({ width: Math.min(width, original.width) }).renderAsync();
    const saved = await image.saveAsync({ compress: 0.8, format: png ? SaveFormat.PNG : SaveFormat.JPEG, base64: web });
    // The web hands back a blob: URL with no type; a data: URL keeps it (as cropPhoto does).
    return { uri: web && saved.base64 ? `data:image/${png ? 'png' : 'jpeg'};base64,${saved.base64}` : saved.uri, width: saved.width, height: saved.height };
  };
  const kept = await at(KEEP_WIDTH);
  const page = await at(PAGE_WIDTH);
  const thumbhash = web ? null : await (await import('expo-image')).Image.generateThumbhashAsync(page.uri).catch(() => null);
  return { kept: kept.uri, page: page.uri, width: kept.width, height: kept.height, thumbhash };
}

/**
 * How the photo lays out its page (images.brightness, text_zone): read here,
 * not by the worker, so the page is right the first time it opens. Never
 * failing the photo: without it the page is dark with the title under the photo.
 */
async function photoLayoutOf(uri: string): Promise<{ brightness: number; text_zone: Json } | null> {
  const pixels = await readPhotoPixels(uri, { width: LAYOUT_WIDTH }).catch(() => null);
  if (!pixels) return null;
  const { brightness, textZone } = readPhotoLayout(pixels.rgba, pixels.width, pixels.height);
  return { brightness, text_zone: textZone ? { ...textZone } : null };
}

async function uploadFile(path: string, uri: string, ext: string) {
  return supabase.storage.from('drinks').upload(path, decode(await uriToBase64(uri)), {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: false,
    cacheControl: UPLOAD_CACHE_SECONDS,
  });
}

/**
 * Uploads a local photo to the drinks bucket at `folder/`; returns its new
 * `images` row id. Made smaller first where the phone can (sizedCopies), with
 * its page copy beside it; the row gets its size and ThumbHash, the ThumbHash
 * only once the page copy is up (the app asks for that copy only then).
 */
export async function uploadDrinkPhoto(uri: string, folder: string): Promise<{ id: string; url: string } | null> {
  const original = imageExtFromUri(uri);
  const sized = await sizedCopies(uri, original === 'png').catch(() => null);
  // Resized, it's a JPEG (or a PNG cut-out) whatever it came as.
  const ext = sized ? (original === 'png' ? 'png' : 'jpg') : original;
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  const { error: uploadError } = await uploadFile(fileName, sized?.kept ?? uri, ext);
  if (uploadError) return null;
  // Never failing the photo: without its page copy the page shows the photo itself.
  const pageUp = sized ? !(await uploadFile(pageCopyPath(fileName), sized.page, ext).catch((e: Error) => ({ error: e }))).error : false;

  const { data: publicUrlData } = supabase.storage.from('drinks').getPublicUrl(fileName);
  const url = publicUrlData.publicUrl;
  const size = sized ? { width: sized.width, height: sized.height, ...(pageUp && sized.thumbhash ? { thumbhash: sized.thumbhash } : {}) } : {};
  // A cut-out sits on the drawing paper: nothing of it decides the page.
  const layout = original === 'png' ? null : await photoLayoutOf(sized?.page ?? uri);
  const insert = (row: Insert<'images'>) => supabase.from('images').insert(row).select('id').single();
  let saved = await insert({ url, ...size, ...layout });
  // Before the photo-layout migration (20261206000000) is in, those columns aren't there yet: the photo still saves.
  if (saved.error && layout && /brightness|text_zone/.test(saved.error.message)) saved = await insert({ url, ...size });
  if (saved.error || !saved.data) return null;
  return { id: saved.data.id, url };
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
