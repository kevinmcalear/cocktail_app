import { FontDisplay, type FontSource } from 'expo-font';

import {
  BricolageGrotesque_600SemiBold,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  JosefinSans_600SemiBold,
  PlayfairDisplay_400Regular,
  Redaction_400Regular,
  Redaction_400Regular_Italic,
  Redaction_700Bold,
  PlayfairDisplay_400Regular_Italic,
  TenorSans_400Regular,
} from './fontFiles';
import { fontFamilies, type DisplayFace } from '@/constants/tokens';

// On web, show fallback text at once and swap the face in when it arrives,
// rather than hiding text until it does.
const swap = (uri: number): FontSource => ({ uri, display: FontDisplay.SWAP });

/**
 * The face on screen at first paint: names, in Redaction. Everything else is
 * the system font, which needs no file. The web export preloads this.
 */
export const FIRST_PAINT_FONTS = {
  [fontFamilies.name]: swap(Redaction_400Regular),
};

/** The rest: Redaction's italic and bold, and the venue faces most venues use. */
export const LATER_FONTS = {
  [fontFamilies.nameItalic]: swap(Redaction_400Regular_Italic),
  [fontFamilies.nameBold]: swap(Redaction_700Bold),
  [fontFamilies.fraunces]: swap(Fraunces_400Regular),
  [fontFamilies.frauncesItalic]: swap(Fraunces_400Regular_Italic),
  [fontFamilies.bricolage]: swap(BricolageGrotesque_600SemiBold),
};

export const APP_FONTS = { ...FIRST_PAINT_FONTS, ...LATER_FONTS };

/**
 * Display faces fetched only when a venue on screen uses one (or the brand
 * picker shows them), so nobody else downloads them. components/ds/faces.ts
 * loads them.
 */
export const LAZY_FACE_FONTS: Partial<Record<DisplayFace, Record<string, FontSource>>> = {
  playfair: { [fontFamilies.playfair]: swap(PlayfairDisplay_400Regular), [fontFamilies.playfairItalic]: swap(PlayfairDisplay_400Regular_Italic) },
  josefin: { [fontFamilies.josefin]: swap(JosefinSans_600SemiBold) },
  tenor: { [fontFamilies.tenor]: swap(TenorSans_400Regular) },
};
