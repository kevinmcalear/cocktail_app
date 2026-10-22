import { useMutation } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { useUserId } from '@/ctx/AuthContext';
import { imageExtFromUri, uriToBase64 } from '@/lib/imageBase64';
import { supabase } from '@/lib/supabase';
import { useNoteDrafts } from '@/store/useNoteDrafts';

/** tell_us: "Doing something different?". The rest are Report a problem's kinds. */
export type NoteKind = 'tell_us' | 'broken' | 'wrong' | 'slow' | 'data' | 'other';

export interface NoteInput {
  kind: NoteKind;
  /** Where it was sent from, as the sheet shows it: "Adding a drink › Ice". */
  screen: string;
  drinkName?: string | null;
  barId?: string | null;
  body: string;
  photo?: NotePhoto | null;
  /** The kept words' key in useNoteDrafts, cleared once the note is in (even if the sheet has gone by then). */
  draftKey?: string;
}

/**
 * A picked photo (a local uri, and its type when the picker says), uploaded
 * with the note. Its id names the file, so a retry after a failed send reuses
 * the upload instead of adding another.
 */
export interface NotePhoto {
  uri: string;
  id: string;
  type: string | null;
}

/** The file types the feedback bucket takes, by extension. */
const PHOTO_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif' };

/**
 * The photo's extension and type: the picker's type when it gives one (a web
 * pick has no file name), else the file name's. An iPhone photo can be HEIC
 * and stays HEIC. Anything else unknown goes as a JPEG, as most picks are.
 */
export function photoType(photo: Pick<NotePhoto, 'uri' | 'type'>): { ext: string; contentType: string } {
  const fromType = Object.keys(PHOTO_TYPES).find((k) => PHOTO_TYPES[k] === photo.type?.toLowerCase());
  // imageExtFromUri knows the rest; HEIC isn't one the other buckets take, so it's read here.
  const heic = /\.(heic|heif)$/i.exec(photo.uri.split('?')[0])?.[1].toLowerCase();
  const ext = fromType ?? heic ?? imageExtFromUri(photo.uri).replace('jpeg', 'jpg');
  return { ext, contentType: PHOTO_TYPES[ext] };
}

/** What the sheet says when a send fails: the daily limit (the database's own hint), signed out, refused, or most likely offline. */
export function sendFailure(error: unknown): string {
  const e = error as { code?: string; hint?: string; message?: string } | null;
  if (e?.hint === 'notes_daily_limit') return 'Couldn’t send it: that’s a lot of notes for one day. What you wrote is kept here, so try again tomorrow.';
  if (e?.message === 'Sign in to send this.') return 'Sign in to send this. What you wrote is kept here.';
  if (e?.code === 'photo_refused') return 'That photo couldn’t be sent (too big, or too many today). Remove it and send the words, or try another.';
  // The server answered and said no (a code), so being online won't fix it.
  if (e?.code) return 'Couldn’t send it. What you wrote is kept here. If it keeps happening, tell us from Settings › Report a problem.';
  return 'Couldn’t send it. What you wrote is kept here, so try again when you’re online.';
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
    // Here, not in the sheet's mutate(): a send that lands after the sheet has gone still clears the words.
    onSuccess: (_data, note) => {
      if (note.draftKey) useNoteDrafts.getState().save(note.draftKey, null);
    },
    mutationFn: async (note: NoteInput): Promise<void> => {
      if (!userId) throw new Error('Sign in to send this.');
      let photoPath: string | null = null;
      if (note.photo) {
        const { ext, contentType } = photoType(note.photo);
        photoPath = `${userId}/${note.photo.id}.${ext}`;
        const { error } = await supabase.storage
          .from('feedback')
          .upload(photoPath, decode(await uriToBase64(note.photo.uri)), { contentType, upsert: false });
        // Already there: an earlier try uploaded it before the note failed.
        if (error && !/exists|duplicate/i.test(error.message)) {
          // The server said no (too big, too many today): say it's the photo. No status: offline, as it is.
          throw (error as { status?: number }).status ? Object.assign(new Error(error.message), { code: 'photo_refused' }) : error;
        }
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
      if (error) {
        // Refused (a code: the daily limit, a bar they've left): take the photo back out rather than
        // leave it with no note. Offline or timed out, keep it: a retry reuses it (same path). The
        // database won't remove one a note points at, so a send that did land keeps its photo.
        // ponytail: a photo from a send given up offline stays; a sweep of unreferenced files would catch it.
        if (photoPath && error.code) await supabase.storage.from('feedback').remove([photoPath]).catch(() => {});
        throw error;
      }
    },
  });
}
