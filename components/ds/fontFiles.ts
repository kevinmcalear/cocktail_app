// Native loads the TTFs straight from @expo-google-fonts, and Redaction from
// assets/fonts/redaction (converted from Fontsource's WOFF, SIL OFL 1.1).
// Web loads WOFF2 copies of the same files instead (faceFiles.web.ts, fontFiles.web.ts).
// Deep imports per weight: each package's index registers every weight it ships.
export { default as Redaction_400Regular } from '@/assets/fonts/redaction/Redaction-Regular.ttf';
export { default as Redaction_400Regular_Italic } from '@/assets/fonts/redaction/Redaction-Italic.ttf';
export { default as Redaction_700Bold } from '@/assets/fonts/redaction/Redaction-Bold.ttf';
