import { useMutation } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { useUserId } from '@/ctx/AuthContext';
import { imageExtFromUri, uriToBase64 } from '@/lib/imageBase64';
import { supabase } from '@/lib/supabase';

/** tell_us: "Doing something different?". The rest are Report a problem's kinds. */
export type NoteKind = 'tell_us' | 'broken' | 'wrong' | 'slow' | 'data' | 'other';

export interface NoteInput {
  kind: NoteKind;
  /** Where it was sent from, as the sheet shows it: "Adding a drink › Ice". */
  screen: string;
  drinkName?: string | null;
  barId?: string | null;
  body: string;
  /** A picked photo (a local uri), uploaded with the note. Its id names the file, so a retry after a failed send reuses the upload instead of adding another. */
  photo?: { uri: string; id: string } | null;
}

/** The app version and device, sent with every note ("1.5.0", "ios 26.1"). */
export function appAndDevice(): { app_version: string; device: string } {
  return {
    app_version: Constants.expoConfig?.version ?? 'unknown',
    // On the web, the browser and system (the user agent) say more than a version.
    device: (Platform.OS === 'web' ? `web ${globalThis.navigator?.userAgent ?? ''}` : `${Platform.OS} ${String(Platform.Version ?? '')}`).trim().slice(0, 300),
  };
}

/**
 * Sends a note to the Cocktail team (feedback_notes, readable only by the
 * sender and the team): the photo first, into the private feedback bucket
 * under the sender's folder, then the row. Fails straight away when offline
 * (networkMode always) so the sheet can keep what was typed and say so,
 * instead of a write that waits unseen.
 */
export function useSendNote() {
  const userId = useUserId();
  return useMutation({
    networkMode: 'always',
    // The sheet says what went wrong itself; no global error toast.
    onError: () => {},
    mutationFn: async (note: NoteInput): Promise<void> => {
      if (!userId) throw new Error('Sign in to send this.');
      let photoPath: string | null = null;
      if (note.photo) {
        const ext = imageExtFromUri(note.photo.uri);
        photoPath = `${userId}/${note.photo.id}.${ext}`;
        const { error } = await supabase.storage
          .from('feedback')
          .upload(photoPath, decode(await uriToBase64(note.photo.uri)), { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });
        // Already there: an earlier try uploaded it before the note failed.
        if (error && !/exists|duplicate/i.test(error.message)) throw error;
      }
      const { error } = await supabase.from('feedback_notes').insert({
        user_id: userId,
        kind: note.kind,
        screen: note.screen,
        drink_name: note.drinkName?.trim() || null,
        bar_id: note.barId ?? null,
        body: note.body.trim(),
        photo_path: photoPath,
        ...appAndDevice(),
      });
      if (error) throw error;
    },
  });
}
