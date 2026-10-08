// Deep imports per weight: each package's index registers every weight it ships.
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { IBMPlexSans_600SemiBold_Italic } from '@expo-google-fonts/ibm-plex-sans/600SemiBold_Italic';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import { FontDisplay, type FontSource } from 'expo-font';

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
