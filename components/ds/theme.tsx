import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Theme } from 'tamagui';

import { backbar, DEFAULT_ACCENT, type BackbarColors, type BackbarScheme, type DisplayFace } from '@/constants/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { accentFill, readableAccent } from '@/lib/color';

import { backbarThemeProps } from './backbarThemeProps';

interface Brand {
  accent: string;
  displayFace: DisplayFace;
  /** A venue's tint for the dark ground; callers pass only readable ones (lib/brand). */
  groundTint?: string;
}

const BrandContext = createContext<Brand>({ accent: DEFAULT_ACCENT, displayFace: 'instrument' });
const SchemeContext = createContext<BackbarScheme | null>(null);

/** The active venue's accent and display face. Step 2 feeds this from `bars`. */
export function BrandProvider({ accent, displayFace, groundTint, children }: Partial<Brand> & { children: ReactNode }) {
  const parent = useContext(BrandContext);
  const value = useMemo(
    () => ({
      accent: accent ?? parent.accent,
      displayFace: displayFace ?? parent.displayFace,
      groundTint: groundTint ?? parent.groundTint,
    }),
    [accent, displayFace, groundTint, parent]
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
    const c = scheme === 'dark' && groundTint ? { ...backbar.dark, ground: groundTint } : backbar[scheme];
    return {
      scheme,
      c,
      accentText: readableAccent(accent, c.ground),
      accentFill: accentFill(accent, backbar.dark.ground, backbar.light.surface),
      displayFace,
    };
  }, [scheme, accent, displayFace, groundTint]);
}
