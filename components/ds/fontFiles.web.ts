// Web serves WOFF2: the same @expo-google-fonts TTFs, converted losslessly
// (no subsetting), at about a third of the size. All are SIL OFL 1.1, which
// allows the conversion; the licences sit beside the files. After bumping an
// @expo-google-fonts package, regenerate each file with fontTools:
//   python -c "from fontTools.ttLib import TTFont; f = TTFont('<ttf>'); f.flavor = 'woff2'; f.save('<woff2>')"
export { default as Belleza_400Regular } from '@/assets/fonts/web/Belleza_400Regular.woff2';
export { default as Besley_500Medium } from '@/assets/fonts/web/Besley_500Medium.woff2';
export { default as Besley_500Medium_Italic } from '@/assets/fonts/web/Besley_500Medium_Italic.woff2';
export { default as BigShoulders_800ExtraBold } from '@/assets/fonts/web/BigShoulders_800ExtraBold.woff2';
export { default as BricolageGrotesque_600SemiBold } from '@/assets/fonts/web/BricolageGrotesque_600SemiBold.woff2';
export { default as IMFellEnglish_400Regular } from '@/assets/fonts/web/IMFellEnglish_400Regular.woff2';
export { default as IMFellEnglish_400Regular_Italic } from '@/assets/fonts/web/IMFellEnglish_400Regular_Italic.woff2';
export { default as Imbue_400Regular } from '@/assets/fonts/web/Imbue_400Regular.woff2';
export { default as Newsreader_400Regular } from '@/assets/fonts/web/Newsreader_400Regular.woff2';
export { default as Newsreader_400Regular_Italic } from '@/assets/fonts/web/Newsreader_400Regular_Italic.woff2';
// Redaction: Fontsource's WOFF2 as published (@fontsource/redaction 5.3.0, latin, SIL OFL 1.1).
export { default as Redaction_400Regular } from '@/assets/fonts/web/Redaction-Regular.woff2';
export { default as Redaction_400Regular_Italic } from '@/assets/fonts/web/Redaction-Italic.woff2';
export { default as Redaction_700Bold } from '@/assets/fonts/web/Redaction-Bold.woff2';
