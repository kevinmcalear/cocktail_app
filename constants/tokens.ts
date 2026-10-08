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

/**
 * One hue per drink family (lib/drinkTree.ts FAMILIES), for the history
 * timeline's dots and lanes. Always shown beside the family's name, never as
 * the only signal. "trunk" is Punch, the shared root.
 */
export const familyHues = {
  dark: {
    oldfashioned: '#E0A05A',
    martini: '#9DB8D4',
    negroni: '#F07A6A',
    sour: '#B5CF6A',
    sidecar: '#F2B04C',
    highball: '#6CC6D8',
    tiki: '#EE8FAE',
    flip: '#C8A9DC',
    trunk: '#A59C90',
  },
  light: {
    oldfashioned: '#A8641E',
    martini: '#4F6E8C',
    negroni: '#B33A2E',
    sour: '#6B8A2A',
    sidecar: '#C47A12',
    highball: '#2C8296',
    tiki: '#B0506E',
    flip: '#8A6A9E',
    trunk: '#6B645B',
  },
} as const;

/**
 * The palate flower's four families (lib/palate.ts FAMILY), a quarter of the
 * wheel each. Always beside the taste's name, never the only signal; light
 * steps darker to hold 3:1 on paper.
 */
export const palateHues = {
  dark: { bright: '#E9B65C', green: '#9DC28B', fire: '#EE8466', body: '#C3A6D6' },
  light: { bright: '#A86E12', green: '#4E7A3E', fire: '#B4472E', body: '#7E5F96' },
} as const;

/** The accent when there's no venue brand: bar-light amber. */
export const DEFAULT_ACCENT = '#E4B062';

/** Dark grounds a venue can pick from for its brand (all keep body text above 7:1). */
export const GROUND_TINTS = [
  { label: 'Walnut', hex: '#1A1410' },
  { label: 'Forest', hex: '#0F1812' },
  { label: 'Ink', hex: '#0F131C' },
  { label: 'Plum', hex: '#181019' },
] as const;

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

/**
 * Six text styles. Nothing below 13. Display and title leave room above the
 * ascenders: iOS bottom-aligns a line set tighter than its font, so a
 * lineHeight of 1 cuts the tops off. Checked by components/ds/displayClip.check.ts.
 */
export const type = {
  display: { fontSize: 56, lineHeight: 64, letterSpacing: -1 },
  title: { fontSize: 34, lineHeight: 38, letterSpacing: -0.4 },
  headline: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  spec: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
} as const;

export type TypeStyle = keyof typeof type;

/**
 * Bottom padding, in points, under every text style on iOS, so a paragraph
 * never draws a line short. Why: components/ds/Text.tsx. Checked by
 * components/ds/textSlack.check.ts.
 */
export const textSlack = 0.01;

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

/**
 * The magic eight ball (components/screens/eightball). A black ball with an
 * ink-blue window in both themes, like the toy; its ring and triangle edge
 * take the venue accent.
 */
export const eightBall = {
  shine: '#3A352F',
  body: '#141210',
  edge: '#0A0908',
  window: '#0F131C',
  triangle: '#1F2E4A',
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
