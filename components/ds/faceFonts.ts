import type { FontSource } from 'expo-font';

import type { DisplayFace } from '@/constants/tokens';

import { LAZY_FACE_FONTS } from './lazyFaces';

/** A lazy face's font files (the web fetches them on demand: faceFonts.web.ts). */
export const faceFonts = (face: DisplayFace): Promise<Record<string, FontSource> | undefined> => Promise.resolve(LAZY_FACE_FONTS[face]);
