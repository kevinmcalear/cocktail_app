import { useMutation, useQuery } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { useUserId } from '@/ctx/AuthContext';
import { uriToBase64 } from '@/lib/imageBase64';
import { supabase, UPLOAD_CACHE_SECONDS } from '@/lib/supabase';

const BUCKET = 'handover';
/** A signed link lasts an hour; the query refreshes it well before. */
const LINK_SECONDS = 60 * 60;

/**
 * "Add a photo" under Anything broken: pick a photo and store it in the
 * private handover bucket under <bar id>/<you>/ (the storage policy allows
 * that folder at a bar you work at, 30 a day). Resolves the path to save with
 * the note, or null when the person cancels. Needs signal, like every photo.
 */
export function useAddHandoverPhoto(barId: string) {
  const me = useUserId();
  return useMutation({
    mutationFn: async (): Promise<string | null> => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.length || !me) return null;
      const uri = result.assets[0].uri;
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const path = `${barId}/${me}/${Date.now()}.${safeExt}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, decode(await uriToBase64(uri)), {
        contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
        upsert: false,
        cacheControl: UPLOAD_CACHE_SECONDS,
      });
      if (error) throw error;
      return path;
    },
  });
}

/** A handover photo's link, signed for an hour (the bucket is private: only the bar's people see it). */
export function useHandoverPhoto(path: string | null) {
  return useQuery({
    queryKey: ['handover-photo', path],
    enabled: !!path,
    staleTime: (LINK_SECONDS / 2) * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, LINK_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
