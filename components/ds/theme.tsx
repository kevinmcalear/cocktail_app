import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Theme } from 'tamagui';

import { backbar, DEFAULT_ACCENT, type BackbarColors, type BackbarScheme, type DisplayFace } from '@/constants/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { accentFill, readableAccent } from '@/lib/color';
import { neutralsFor } from '@/lib/palette';

import { backbarThemeProps } from './backbarThemeProps';
import { useLoadedFace } from './faces';

interface Brand {
  accent: string;
  displayFace: DisplayFace;
  /** A venue's dark ground; every other neutral, in both schemes, is built from it (lib/palette). Callers pass only readable ones (lib/brand). */
  groundTint?: string;
}

const BrandContext = createContext<Brand>({ accent: DEFAULT_ACCENT, displayFace: 'instrument' });
const SchemeContext = createContext<BackbarScheme | null>(null);

/** The active venue's accent and display face. Step 2 feeds this from `bars`. */
export function BrandProvider({ accent, displayFace, groundTint, children }: Partial<Brand> & { children: ReactNode }) {
  const parent = useContext(BrandContext);
  // A face that loads on demand shows as Instrument Serif until its file is in.
  const face = useLoadedFace(displayFace ?? parent.displayFace);
  const value = useMemo(
    () => ({
      accent: accent ?? parent.accent,
      displayFace: face,
      groundTint: groundTint ?? parent.groundTint,
    }),
    [accent, face, groundTint, parent]
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
  const { accent, displayFace, groundTint } = useContext(BrandContext);
  return useMemo(() => {
    const c = neutralsFor(scheme, groundTint);
    return {
      scheme,
      c,
      accentText: readableAccent(accent, c.ground),
      // Button text is whichever ink reads better on the accent (Kevin, 28 Oct: no hand pick).
      accentFill: accentFill(accent, backbar.dark.ground, backbar.light.surface),
      displayFace,
    };
  }, [scheme, accent, displayFace, groundTint]);
}
