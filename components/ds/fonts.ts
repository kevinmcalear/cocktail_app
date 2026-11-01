import { FontDisplay, type FontSource } from 'expo-font';

import {
  Belleza_400Regular,
  Besley_500Medium,
  Besley_500Medium_Italic,
  BigShoulders_800ExtraBold,
  BricolageGrotesque_600SemiBold,
  IMFellEnglish_400Regular,
  IMFellEnglish_400Regular_Italic,
  Imbue_400Regular,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Redaction_400Regular,
  Redaction_400Regular_Italic,
  Redaction_700Bold,
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

/** The rest of the app's own face: Redaction's italic and bold. */
export const LATER_FONTS = {
  [fontFamilies.nameItalic]: swap(Redaction_400Regular_Italic),
  [fontFamilies.nameBold]: swap(Redaction_700Bold),
};

export const APP_FONTS = { ...FIRST_PAINT_FONTS, ...LATER_FONTS };

/**
 * A bar's face, fetched only when a venue on screen uses it (or the type
 * picker shows it), so nobody else downloads it. components/ds/faces.ts
 * loads them.
 */
export const LAZY_FACE_FONTS: Partial<Record<DisplayFace, Record<string, FontSource>>> = {
  newsreader: { [fontFamilies.newsreader]: swap(Newsreader_400Regular), [fontFamilies.newsreaderItalic]: swap(Newsreader_400Regular_Italic) },
  fell: { [fontFamilies.fell]: swap(IMFellEnglish_400Regular), [fontFamilies.fellItalic]: swap(IMFellEnglish_400Regular_Italic) },
  imbue: { [fontFamilies.imbue]: swap(Imbue_400Regular) },
  besley: { [fontFamilies.besley]: swap(Besley_500Medium), [fontFamilies.besleyItalic]: swap(Besley_500Medium_Italic) },
  bricolage: { [fontFamilies.bricolage]: swap(BricolageGrotesque_600SemiBold) },
  belleza: { [fontFamilies.belleza]: swap(Belleza_400Regular) },
  shoulders: { [fontFamilies.shoulders]: swap(BigShoulders_800ExtraBold) },
};
