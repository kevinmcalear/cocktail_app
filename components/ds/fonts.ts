import { FontDisplay, type FontSource } from 'expo-font';

import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  GeistMono_500Medium,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from './fontFiles';
import { fontFamilies } from '@/constants/tokens';

// On web, show fallback text at once and swap the face in when it arrives,
// rather than hiding text until it does.
export const swap = (uri: number): FontSource => ({ uri, display: FontDisplay.SWAP });

/**
 * The faces on screen at first paint: names in Instrument Serif, text in
 * Geist's regular and medium, and the capitals in Geist Mono. The web export
 * preloads these.
 */
export const FIRST_PAINT_FONTS = {
  [fontFamilies.name]: swap(InstrumentSerif_400Regular),
  [fontFamilies.sans]: swap(Geist_400Regular),
  [fontFamilies.sansMedium]: swap(Geist_500Medium),
  [fontFamilies.monoMedium]: swap(GeistMono_500Medium),
};

/** The rest of the app's own faces: the italic and Geist's semibold. */
export const LATER_FONTS = {
  [fontFamilies.nameItalic]: swap(InstrumentSerif_400Regular_Italic),
  [fontFamilies.sansSemiBold]: swap(Geist_600SemiBold),
};

export const APP_FONTS = { ...FIRST_PAINT_FONTS, ...LATER_FONTS };
