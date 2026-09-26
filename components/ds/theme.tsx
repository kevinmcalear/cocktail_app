import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque';
import { Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Theme } from 'tamagui';

import { backbar, DEFAULT_ACCENT, fontFamilies, type BackbarColors, type BackbarScheme, type DisplayFace } from '@/constants/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { accentFill, readableAccent } from '@/lib/color';

interface Brand {
  accent: string;
  displayFace: DisplayFace;
}

const BACKBAR_FONTS = {
  [fontFamilies.instrument]: InstrumentSerif_400Regular,
  [fontFamilies.instrumentItalic]: InstrumentSerif_400Regular_Italic,
  [fontFamilies.fraunces]: Fraunces_400Regular,
  [fontFamilies.frauncesItalic]: Fraunces_400Regular_Italic,
  [fontFamilies.bricolage]: BricolageGrotesque_600SemiBold,
  [fontFamilies.body]: Geist_400Regular,
  [fontFamilies.bodyMedium]: Geist_500Medium,
  [fontFamilies.bodySemiBold]: Geist_600SemiBold,
  [fontFamilies.mono]: GeistMono_400Regular,
  [fontFamilies.monoMedium]: GeistMono_500Medium,
};

const BrandContext = createContext<Brand>({ accent: DEFAULT_ACCENT, displayFace: 'instrument' });
const SchemeContext = createContext<BackbarScheme | null>(null);

/** The active venue's accent and display face. Step 2 feeds this from `bars`. */
export function BrandProvider({ accent, displayFace, children }: Partial<Brand> & { children: ReactNode }) {
  const parent = useContext(BrandContext);
  const value = useMemo(
    () => ({ accent: accent ?? parent.accent, displayFace: displayFace ?? parent.displayFace }),
    [accent, displayFace, parent]
  );
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

/**
 * Forces a scheme for a subtree (the gallery shows both), and switches the
 * Tamagui theme under it to the Back Bar colours so plain Tamagui primitives
 * inside redesigned screens match.
 */
export function BackbarTheme({ scheme, children }: { scheme?: BackbarScheme; children: ReactNode }) {
  const appScheme = useColorScheme();
  const resolved = scheme ?? appScheme;
  // ponytail: the redesign's fonts load here rather than in the root layout, so
  // the current screens don't wait for them. Native waits (no fallback flash);
  // web renders straight away and swaps when they arrive.
  const [fontsLoaded] = useFonts(BACKBAR_FONTS);
  if (!fontsLoaded && Platform.OS !== 'web') return null;
  return (
    <SchemeContext.Provider value={resolved}>
      <Theme name={resolved === 'dark' ? 'dark_backbar' : 'light_backbar'}>{children}</Theme>
    </SchemeContext.Provider>
  );
}

export interface Ds {
  scheme: BackbarScheme;
  c: BackbarColors;
  /** The venue accent, adjusted to read as text on this scheme's ground. */
  accentText: string;
  /** Fill and text for primary buttons in the venue accent. */
  accentFill: { fill: string; text: string };
  displayFace: DisplayFace;
}

/** Colours and brand for the current subtree. */
export function useDs(): Ds {
  const appScheme = useColorScheme();
  const scheme = useContext(SchemeContext) ?? appScheme;
  const { accent, displayFace } = useContext(BrandContext);
  return useMemo(() => {
    const c = backbar[scheme];
    return {
      scheme,
      c,
      accentText: readableAccent(accent, c.ground),
      accentFill: accentFill(accent, backbar.dark.ground, backbar.light.surface),
      displayFace,
    };
  }, [scheme, accent, displayFace]);
}
