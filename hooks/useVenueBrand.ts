import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { extractColors, uploadLogo } from '@/hooks/useBarEditor';
import type { DbDisplayFace } from '@/lib/brand';
import { uriToBase64 } from '@/lib/imageBase64';
import { supabase } from '@/lib/supabase';

export interface VenueBrandRow {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  display_face: DbDisplayFace;
  ground_tint: string | null;
  short_name: string | null;
  icon_url: string | null;
}

export type VenueBrandPatch = Partial<Omit<VenueBrandRow, 'id' | 'name' | 'slug'>>;

const COLUMNS = 'id, name, slug, logo_url, primary_color, secondary_color, display_face, ground_tint, short_name, icon_url';

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
 * policy), and the database checks the tint and short name again.
 */
export function useSaveVenueBrand(barId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: VenueBrandPatch) => {
      const { error } = await supabase.from('bars').update(patch).eq('id', barId!);
      if (error) throw error;
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
