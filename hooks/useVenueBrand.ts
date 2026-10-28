import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { extractColors, uploadLogo } from '@/hooks/useBarEditor';
import { isUnknownFaceError } from '@/lib/brand';
import { uriToBase64 } from '@/lib/imageBase64';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';
import type { Enum } from '@/types/db';

export interface VenueBrandRow {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  /** A venue_display_face value; one this build doesn't know reads as Instrument Serif (lib/brand faceFromDb). */
  display_face: string;
  ground_tint: string | null;
  short_name: string | null;
  icon_url: string | null;
  /** The home-screen icon's background: 'accent', 'ground' or 'cream', or null for the logo's own colour. */
  icon_background: 'accent' | 'ground' | 'cream' | null;
}

export type VenueBrandPatch = Partial<Omit<VenueBrandRow, 'id' | 'name' | 'slug' | 'display_face'> & { display_face: Enum<'venue_display_face'> }>;

const COLUMNS = 'id, name, slug, logo_url, primary_color, secondary_color, display_face, ground_tint, short_name, icon_url, icon_background';

/** A venue's brand: logo, accent, display face, dark ground tint, home-screen icon and short name. */
export function useVenueBrand(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue-brand', barId],
    enabled: !!barId,
    queryFn: async (): Promise<VenueBrandRow> => {
      const { data, error } = await supabase.from('bars').select(COLUMNS).eq('id', barId!).single();
      if (error) throw error;
      return data as VenueBrandRow;
    },
  });
}

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
  const [upload, found] = await Promise.all([
    uploadLogo(barId, base64),
    withColors ? extractColors(barId, uri, base64) : Promise.resolve(null),
  ]);
  if (!upload.imageUrl) throw new Error('The image didn’t upload. Try again.');
  const colors = [found?.primaryColor, found?.secondaryColor].filter((c): c is string => !!c);
  return { url: upload.imageUrl, colors };
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
