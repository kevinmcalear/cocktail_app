// Native loads the TTFs straight from @expo-google-fonts (Instrument Serif, Geist,
// Geist Mono: SIL OFL 1.1). Web loads WOFF2 copies of the same files instead
// (fontFiles.web.ts). Deep imports per weight: each package's index registers
// every weight it ships. Redaction stays embedded natively (app.json) as the
// face a venue could once pick; nothing loads it now.
export { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
export { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
export { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
export { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
export { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
export { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
