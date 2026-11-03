import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_ACCENT, type BackbarColors, type BackbarScheme, type DisplayFace } from '@/constants/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMoreContrast } from '@/hooks/useMoreContrast';
import { neutralsFor } from '@/lib/palette';
import { themeColours } from '@/lib/theme';

import { useLoadedFace } from './faces';

interface Brand {
  accent: string;
  displayFace: DisplayFace;
  /** A venue's dark ground; every other neutral, in both schemes, is built from it (lib/palette). Callers pass only readable ones (lib/brand). */
  groundTint?: string;
}

const BrandContext = createContext<Brand>({ accent: DEFAULT_ACCENT, displayFace: 'redaction' });
const SchemeContext = createContext<BackbarScheme | null>(null);

/** The active venue's accent and display face. Step 2 feeds this from `bars`. */
/** `groundTint` null is no tint (a preview of Neutral); left out, it's the parent's. */
export function BrandProvider({ accent, displayFace, groundTint, children }: Partial<Omit<Brand, 'groundTint'>> & { groundTint?: string | null; children: ReactNode }) {
  const parent = useContext(BrandContext);
  // A face that loads on demand shows as Redaction until its file is in.
  const face = useLoadedFace(displayFace ?? parent.displayFace);
  const value = useMemo(
    () => ({
      accent: accent ?? parent.accent,
      displayFace: face,
      groundTint: groundTint === undefined ? parent.groundTint : (groundTint ?? undefined),
    }),
    [accent, face, groundTint, parent]
  );
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

/** Forces a scheme for a subtree (the gallery shows both). */
export function BackbarTheme({ scheme, children }: { scheme?: BackbarScheme; children: ReactNode }) {
  const appScheme = useColorScheme();
  const resolved = scheme ?? appScheme;
  return <SchemeContext.Provider value={resolved}>{children}</SchemeContext.Provider>;
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
  const moreContrast = useMoreContrast();
  return useMemo(() => {
    const c = neutralsFor(scheme, groundTint);
    // The guard rails (lib/theme): the button held off the page with a label that reads, text in its own shade.
    const t = themeColours(accent, c.ground, scheme === 'dark');
    return {
      scheme,
      c,
      // Increase Contrast overrides the bar: buttons and its text go ink (canvas th-n-guard).
      accentText: moreContrast ? c.ink : t.text,
      accentFill: moreContrast ? { fill: c.ink, text: c.ground } : { fill: t.fill, text: t.onFill },
      displayFace,
    };
  }, [scheme, accent, displayFace, groundTint, moreContrast]);
}
