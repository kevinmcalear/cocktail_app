// Native loads the TTFs straight from @expo-google-fonts, and Redaction from
// assets/fonts/redaction (converted from Fontsource's WOFF, SIL OFL 1.1).
// Web loads WOFF2 copies of the same files instead (fontFiles.web.ts).
// Deep imports per weight: each package's index registers every weight it ships.
export { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
export { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
export { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
export { JosefinSans_600SemiBold } from '@expo-google-fonts/josefin-sans/600SemiBold';
export { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display/400Regular';
export { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display/400Regular_Italic';
export { TenorSans_400Regular } from '@expo-google-fonts/tenor-sans/400Regular';
export { default as Redaction_400Regular } from '@/assets/fonts/redaction/Redaction-Regular.ttf';
export { default as Redaction_400Regular_Italic } from '@/assets/fonts/redaction/Redaction-Italic.ttf';
export { default as Redaction_700Bold } from '@/assets/fonts/redaction/Redaction-Bold.ttf';
