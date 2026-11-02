import { onlineManager, useMutation, useQuery } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { useUserId } from '@/ctx/AuthContext';
import { uriToBase64 } from '@/lib/imageBase64';
import { supabase, UPLOAD_CACHE_SECONDS } from '@/lib/supabase';

const BUCKET = 'handover';
/** A signed link lasts an hour; the query refreshes it well before. */
const LINK_SECONDS = 60 * 60;

/** How long an upload may take before the sheet says it didn't go. */
export const PHOTO_UPLOAD_MS = 30_000;

/** The photo couldn't go up: no signal, or it took too long. The sheet says so. */
export class PhotoOfflineError extends Error {
  constructor() {
    super('No signal. The rest of the note is still here.');
  }
}

/**
 * "Add a photo" under Anything broken: pick a photo and store it in the
 * private handover bucket under <bar id>/<you>/ (the storage policy allows
 * that folder at a bar you work at, 30 a day). Resolves the path to save with
 * the note, or null when the person cancels. Needs signal, like every photo.
 * networkMode always: with the default ('online') a mutation with no signal
 * pauses before it starts and stays pending ("Adding the photo..." forever),
 * so it fails straight away instead and the sheet shows the toast.
 * ponytail: storage upload takes no AbortSignal, so a stalled upload is only
 * raced, not cancelled; if it lands late the file sits unused (db:health lists those).
 */
export function handoverPhotoMutation(barId: string, me: string | null) {
  return {
    networkMode: 'always' as const,
    // The sheet shows its own toast; no global one on top.
    onError: () => {},
    mutationFn: async (): Promise<string | null> => {
      if (!onlineManager.isOnline()) throw new PhotoOfflineError();
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.length || !me) return null;
      const uri = result.assets[0].uri;
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const path = `${barId}/${me}/${Date.now()}.${safeExt}`;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const upload = (async () =>
        supabase.storage.from(BUCKET).upload(path, decode(await uriToBase64(uri)), {
          contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
          upsert: false,
          cacheControl: UPLOAD_CACHE_SECONDS,
        }))();
      const late = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PhotoOfflineError()), PHOTO_UPLOAD_MS);
      });
      try {
        const { error } = await Promise.race([upload, late]);
        // No status: the request never reached the server (offline).
        if (error) throw (error as { status?: number }).status ? error : new PhotoOfflineError();
      } finally {
        clearTimeout(timer);
      }
      return path;
    },
  };
}

export function useAddHandoverPhoto(barId: string) {
  return useMutation(handoverPhotoMutation(barId, useUserId()));
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
