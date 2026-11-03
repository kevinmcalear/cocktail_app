import { supabase } from '@/lib/supabase';

// The glass-photos bucket. Removing a photo sits apart from useGlassDrawing:
// the glassware hooks every bar and home screen reads need only this.
export const BUCKET = 'glass-photos';

/** Takes a photo out of the bucket. A file left behind is only clutter, so a failure is let go. */
export async function removeGlassPhoto(path: string | null | undefined) {
  if (path)
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => {});
}
