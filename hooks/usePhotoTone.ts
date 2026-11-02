import { useQuery } from '@tanstack/react-query';

import { readPhotoPixels } from '@/lib/photoPixels';
import { photoTone } from '@/lib/photoTone';

/** A few rows are enough to tell a bright photo from a dark one. */
const TONE_ROWS = 24;

/**
 * Whether the photo at `url` makes a light page or a dark one, read once on
 * the device and kept (a stored photo's address changes when the photo does).
 * Until it is read, and when it can't be, a photo reads as dark.
 */
export function usePhotoTone(url: string | null): 'light' | 'dark' {
  const { data } = useQuery({
    queryKey: ['photo-tone', url],
    enabled: !!url,
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const pixels = await readPhotoPixels(url!, TONE_ROWS);
      return pixels ? photoTone(pixels.data) : 'dark';
    },
  });
  return data ?? 'dark';
}
