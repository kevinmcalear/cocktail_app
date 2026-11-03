import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { extractColors, uploadLogo } from '@/hooks/useBarEditor';
import { isUnknownFaceError } from '@/lib/brand';
import { extractBrandColorsFromUri } from '@/lib/extractBrandColors';
import { uriToBase64 } from '@/lib/imageBase64';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';
import type { Enum } from '@/types/db';

import type { VenueBrandRow } from './useVenueBrandRow';

// The read is its own small file, so lists that only check a bar's look don't load the editor (B13).
export { useVenueBrand, type VenueBrandRow } from './useVenueBrandRow';

export type VenueBrandPatch = Partial<Omit<VenueBrandRow, 'id' | 'name' | 'slug' | 'display_face'> & { display_face: Enum<'venue_display_face'> }>;

/**
 * Save brand fields. Only venue admins can update a bar (the bars_update
 * policy), and the database checks the tint and short name again. If the
 * database doesn't have the picked display face yet (the app reached people
 * before its migration), the rest is saved and the venue keeps its face:
 * resolves `{ faceKept: true }`.
 */
export function useSaveVenueBrand(barId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: VenueBrandPatch): Promise<{ faceKept: boolean }> => {
      const { error } = await supabase.from('bars').update(patch).eq('id', barId!);
      if (!error) return { faceKept: false };
      if (!patch.display_face || !isUnknownFaceError(error)) throw error;
      const { display_face: _face, ...rest } = patch;
      if (Object.keys(rest).length === 0) return { faceKept: true };
      const retry = await supabase.from('bars').update(rest).eq('id', barId!);
      if (retry.error) throw retry.error;
      return { faceKept: true };
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['venue-brand', barId] });
      // The switcher, theme and legacy settings read the venue from these.
      client.invalidateQueries({ queryKey: ['bars'] });
      client.invalidateQueries({ queryKey: ['bar', barId] });
    },
  });
}

export interface PickedBrandImage {
  url: string;
  /** Suggested accents from the image, for a logo. */
  colors: string[];
}

/**
 * Pick a square image and upload it through upload-bar-logo (which stores it
 * and returns its URL; saving it to the venue is a separate step, so the
 * preview can show it first). Returns null if the person cancels.
 */
export async function pickBrandImage(barId: string, withColors: boolean): Promise<PickedBrandImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;
  const uri = result.assets[0].uri;
  const base64 = await uriToBase64(uri);
  // One request: the upload answers with the logo's colours too. Read them on the device where it can (the web),
  // and never let a colour read that fails lose the upload (it used to send the same photo twice, and either failing lost both).
  const [upload, local] = await Promise.all([
    uploadLogo(barId, base64),
    withColors ? extractBrandColorsFromUri(uri).catch(() => null) : Promise.resolve(null),
  ]);
  if (!upload?.imageUrl) throw new Error('The image didn’t upload. Try again.');
  const found = withColors ? (local ?? upload) : null;
  const colors = [found?.primaryColor, found?.secondaryColor].filter((c): c is string => !!c);
  return { url: upload.imageUrl, colors };
}

/**
 * A photo of the room (the bar top, the neon sign), for a logo with no colour
 * in it (canvas Theme-flow-mono): its colours only. Nothing is kept: the
 * function only reads the colours (extract_only).
 */
export async function pickPhotoColours(barId: string): Promise<string[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.length) return null;
  const uri = result.assets[0].uri;
  const found = await extractColors(barId, uri, await uriToBase64(uri));
  return [found?.primaryColor, found?.secondaryColor].filter((c): c is string => !!c).map((c) => c.toUpperCase());
}

/** What Remove background gives: the new logo and its original, or that the server can't do it yet. */
export type RemovedBackground = { url: string; original: string } | 'unavailable';

/**
 * Takes the logo's flat background out (upload-bar-logo's remove_background:
 * a flood fill from the edge, no paid service) and returns the new image's URL
 * and the original's; the original stays stored, for Use original.
 * 'unavailable' while the deployed function is older than this (it asks for an
 * image instead). Otherwise throws with the server's words, such as "This logo
 * has no plain background to remove".
 */
export async function removeLogoBackground(barId: string, logoUrl: string): Promise<RemovedBackground> {
  try {
    const done = await invokeFunction<{ imageUrl?: string; originalUrl?: string } | null>('upload-bar-logo', { action: 'remove_background', bar_id: barId, logo_url: logoUrl });
    return done?.imageUrl ? { url: done.imageUrl, original: done.originalUrl ?? logoUrl } : 'unavailable';
  } catch (e) {
    if (e instanceof Error && /image_base64/.test(e.message)) return 'unavailable';
    throw e;
  }
}
