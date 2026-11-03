import type { FontSource } from 'expo-font';

import type { DisplayFace } from '@/constants/tokens';

/** A lazy face's font files, fetched with the first bar that uses a face. */
export const faceFonts = (face: DisplayFace): Promise<Record<string, FontSource> | undefined> => import('./lazyFaces').then((m) => m.LAZY_FACE_FONTS[face]);
