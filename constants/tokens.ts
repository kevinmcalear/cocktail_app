/**
 * Back Bar design tokens: the single source for the redesign's colour, type,
 * shape, space, motion and layout. The rules behind them are in
 * docs/design_system.md. Components read these through components/ds; screens
 * should use the ds components rather than these values directly.
 *
 * The current (pre-redesign) screens still use constants/palette.ts.
 */

/** Service (dark) is the default; prep (light) is for daytime work. */
export const backbar = {
  dark: {
    ground: '#0E0D0C',
    surface: '#1A1816',
    raised: '#23201C',
    ink: '#F3EEE6',
    muted: '#A59C90', // 7.3:1 on ground
    faint: '#7A7166', // decorative and disabled only, not for text people must read
    line: 'rgba(243, 238, 230, 0.10)',
    lineStrong: 'rgba(243, 238, 230, 0.20)',
    glass: 'rgba(38, 34, 30, 0.55)',
    glassBorder: 'rgba(255, 255, 255, 0.14)',
    scrim: 'rgba(14, 13, 12, 0.62)',
    paper: '#EFE9DD', // behind house-style sketches, in both themes
    sketchInk: '#3B342C',
  },
  light: {
    ground: '#F6F3EE',
    surface: '#FFFFFF',
    raised: '#EFEAE2',
    ink: '#1A1714',
    muted: '#6B645B', // 5.3:1 on ground
    faint: '#A39A8E',
    line: 'rgba(26, 23, 20, 0.08)',
    lineStrong: 'rgba(26, 23, 20, 0.16)',
    glass: 'rgba(255, 255, 255, 0.62)',
    glassBorder: 'rgba(0, 0, 0, 0.07)',
    scrim: 'rgba(246, 243, 238, 0.72)',
    paper: '#EFE9DD',
    sketchInk: '#3B342C',
  },
} as const;

export type BackbarScheme = keyof typeof backbar;
export type BackbarColors = { [K in keyof (typeof backbar)['dark']]: string };

/** The accent when there's no venue brand: bar-light amber. */
export const DEFAULT_ACCENT = '#E4B062';

/** Two made-up venues, for the gallery and tests. Real venues come from `bars`. */
export const SAMPLE_BRANDS = {
  littleRye: { name: 'Little Rye', accent: '#D0643B', displayFace: 'instrument' as const },
  paleMoth: { name: 'Pale Moth', accent: '#B9A8F5', displayFace: 'fraunces' as const },
};

/** Font family names, as registered with useFonts in app/_layout.tsx. */
export const fontFamilies = {
  instrument: 'InstrumentSerif',
  instrumentItalic: 'InstrumentSerifItalic',
  fraunces: 'Fraunces',
  frauncesItalic: 'FrauncesItalic',
  bricolage: 'BricolageGrotesque',
  body: 'Geist',
  bodyMedium: 'GeistMedium',
  bodySemiBold: 'GeistSemiBold',
  mono: 'GeistMono',
  monoMedium: 'GeistMonoMedium',
} as const;

/** The display faces a venue can pick for drink and menu names. */
export const displayFaces = {
  instrument: { label: 'Instrument Serif', regular: fontFamilies.instrument, italic: fontFamilies.instrumentItalic },
  fraunces: { label: 'Fraunces', regular: fontFamilies.fraunces, italic: fontFamilies.frauncesItalic },
  bricolage: { label: 'Bricolage Grotesque', regular: fontFamilies.bricolage, italic: fontFamilies.bricolage },
} as const;

export type DisplayFace = keyof typeof displayFaces;

/** Six text styles. Nothing below 13. */
export const type = {
  display: { fontSize: 56, lineHeight: 56, letterSpacing: -1 },
  title: { fontSize: 34, lineHeight: 38, letterSpacing: -0.4 },
  headline: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  spec: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
} as const;

export type TypeStyle = keyof typeof type;

/** `mark`: shapes drawn inside a card that can be only a few points tall, like zones on the back bar plan. */
export const radius = { mark: 4, control: 12, card: 22, sheet: 36, pill: 999 } as const;

/** 4-point grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const layout = {
  breakpoints: { tablet: 768, desktop: 1200 },
  gutter: { phone: 16, tablet: 24, desktop: 32 },
  minTapTarget: 44,
  /** Screens and components past this many lines get split (enforced by check:design). */
  maxScreenLines: 300,
} as const;

/** Reanimated withSpring configs. Use these three and nothing else. */
export const springs = {
  /** Taps, toggles, chips. */
  snap: { damping: 26, stiffness: 380, mass: 1 },
  /** Sheets, zoom transitions. */
  glide: { damping: 30, stiffness: 180, mass: 1 },
  /** Liquid, the spec glass, playful moments. */
  pour: { damping: 12, stiffness: 120, mass: 1 },
} as const;

export type SpringName = keyof typeof springs;
