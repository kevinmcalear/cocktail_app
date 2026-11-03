import type { FontSource } from 'expo-font';

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
} from './faceFiles';
import { swap } from './fonts';
import { fontFamilies, type DisplayFace } from '@/constants/tokens';

/**
 * A bar's face, fetched only when a venue on screen uses it (or the type
 * picker shows it), so nobody else downloads it. components/ds/faces.ts
 * loads them (through faceFonts, so the web fetches this file with the first
 * bar that uses a face, not with every page).
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
