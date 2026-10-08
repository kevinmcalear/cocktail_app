import { FontDisplay, type FontSource } from 'expo-font';

import {
  BricolageGrotesque_600SemiBold,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  GeistMono_400Regular,
  GeistMono_500Medium,
  IBMPlexSans_600SemiBold_Italic,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from './fontFiles';
import { fontFamilies } from '@/constants/tokens';

// On web, show fallback text at once and swap the face in when it arrives,
// rather than hiding text until it does.
const swap = (uri: number): FontSource => ({ uri, display: FontDisplay.SWAP });

/**
 * The faces on screen at first paint (ds body, caption, headline and the
 * default display face). The web export preloads these.
 */
export const FIRST_PAINT_FONTS = {
  [fontFamilies.body]: swap(Geist_400Regular),
  [fontFamilies.bodyMedium]: swap(Geist_500Medium),
  [fontFamilies.bodySemiBold]: swap(Geist_600SemiBold),
  [fontFamilies.instrument]: swap(InstrumentSerif_400Regular),
};

/**
 * The rest: venue display faces, italics, spec numbers, and Inter and IBM Plex
 * for the screens still built on Tamagui (cocktail edit, beer and wine).
 */
export const LATER_FONTS = {
  [fontFamilies.instrumentItalic]: swap(InstrumentSerif_400Regular_Italic),
  [fontFamilies.fraunces]: swap(Fraunces_400Regular),
  [fontFamilies.frauncesItalic]: swap(Fraunces_400Regular_Italic),
  [fontFamilies.bricolage]: swap(BricolageGrotesque_600SemiBold),
  [fontFamilies.mono]: swap(GeistMono_400Regular),
  [fontFamilies.monoMedium]: swap(GeistMono_500Medium),
  Inter: swap(Inter_400Regular),
  InterMedium: swap(Inter_500Medium),
  InterSemiBold: swap(Inter_600SemiBold),
  InterBold: swap(Inter_700Bold),
  // presentation accent for cocktail/menu titles, not system UI
  IBMPlexSansItalic: swap(IBMPlexSans_600SemiBold_Italic),
};

export const APP_FONTS = { ...FIRST_PAINT_FONTS, ...LATER_FONTS };
