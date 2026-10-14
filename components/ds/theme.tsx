import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Theme } from 'tamagui';

import { backbar, DEFAULT_ACCENT, type BackbarColors, type BackbarScheme, type DisplayFace } from '@/constants/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ACCENT_INK } from '@/lib/brandColours';
import { accentFill, readableAccent } from '@/lib/color';

import { backbarThemeProps } from './backbarThemeProps';
import { useLoadedFace } from './faces';

interface Brand {
  accent: string;
  displayFace: DisplayFace;
  /** A venue's tint for the dark ground; callers pass only readable ones (lib/brand). */
  groundTint?: string;
  /** Text on accent buttons: the venue's pick, else whichever reads better. */
  accentText?: 'cream' | 'ink';
}

const BrandContext = createContext<Brand>({ accent: DEFAULT_ACCENT, displayFace: 'instrument' });
const SchemeContext = createContext<BackbarScheme | null>(null);

/** The active venue's accent and display face. Step 2 feeds this from `bars`. */
export function BrandProvider({ accent, displayFace, groundTint, accentText, children }: Partial<Brand> & { children: ReactNode }) {
  const parent = useContext(BrandContext);
  // A face that loads on demand shows as Instrument Serif until its file is in.
  const face = useLoadedFace(displayFace ?? parent.displayFace);
  const value = useMemo(
    () => ({
      accent: accent ?? parent.accent,
      displayFace: face,
      groundTint: groundTint ?? parent.groundTint,
      accentText: accentText ?? parent.accentText,
    }),
    [accent, face, groundTint, accentText, parent]
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
  return (
    <SchemeContext.Provider value={resolved}>
      <Theme {...backbarThemeProps(resolved)}>{children}</Theme>
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
  const { accent, displayFace, groundTint, accentText } = useContext(BrandContext);
  return useMemo(() => {
    const c = scheme === 'dark' && groundTint ? { ...backbar.dark, ground: groundTint } : backbar[scheme];
    return {
      scheme,
      c,
      accentText: readableAccent(accent, c.ground),
      accentFill: accentText ? accentFill(accent, ACCENT_INK.ink, ACCENT_INK.cream, accentText === 'ink' ? 'dark' : 'light') : accentFill(accent, backbar.dark.ground, backbar.light.surface),
      displayFace,
    };
  }, [scheme, accent, displayFace, groundTint, accentText]);
}
