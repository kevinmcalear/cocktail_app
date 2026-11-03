import type { ComponentProps } from 'react';

import { SketchTintPicker } from '@/components/ds';
import { usePhotoColours } from '@/hooks/useSketchTint';

/**
 * The drawing's colour while the drink is being added: Auto, worked out from
 * the spec as it's written, or one of the house watercolours, which holds
 * while the spec changes; with a photo, its colours first. Saved with the
 * drink as its sketch colour, the one the drink page's Colour button changes
 * later. Read once it's shown (the draft page's Colour row, the desktop's
 * drink card).
 */
export function DraftTintPicker({ photo, ...picker }: Omit<ComponentProps<typeof SketchTintPicker>, 'photo'> & { photo?: string | null }) {
  const colours = usePhotoColours(photo);
  return <SketchTintPicker {...picker} photo={photo && colours ? { uri: photo, colours } : null} />;
}
