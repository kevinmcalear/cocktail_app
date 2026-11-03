import { FontDisplay, type FontSource } from 'expo-font';

import {
  Redaction_400Regular,
  Redaction_400Regular_Italic,
  Redaction_700Bold,
} from './fontFiles';
import { fontFamilies } from '@/constants/tokens';

// On web, show fallback text at once and swap the face in when it arrives,
// rather than hiding text until it does.
export const swap = (uri: number): FontSource => ({ uri, display: FontDisplay.SWAP });

/**
 * The face on screen at first paint: names, in Redaction. Everything else is
 * the system font, which needs no file. The web export preloads this.
 */
export const FIRST_PAINT_FONTS = {
  [fontFamilies.name]: swap(Redaction_400Regular),
};

/** The rest of the app's own face: Redaction's italic and bold. */
export const LATER_FONTS = {
  [fontFamilies.nameItalic]: swap(Redaction_400Regular_Italic),
  [fontFamilies.nameBold]: swap(Redaction_700Bold),
};

export const APP_FONTS = { ...FIRST_PAINT_FONTS, ...LATER_FONTS };
