import type { TextStyle } from 'react-native';

/**
 * Back Bar design tokens: the single source for the redesign's colour, type,
 * shape, space, motion and layout. The rules behind them are in
 * docs/design_system.md. Components read these through components/ds; screens
 * should use the ds components rather than these values directly.
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
    tilePaper: '#2A2622', // behind small drawings painted for night (ingredient thumbnails), so a tile is not a cream square on black
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
    tilePaper: '#EFE9DD',
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

/** The map's "You are here" dot, with a halo of itself at 22% (disc-map). Not a status colour. */
export const MAP_ME = '#8FB7E8';

/**
 * The day a batch was made, as the stripe on its label: the kitchen day-dot
 * colours (Monday blue to Sunday black), indexed by Date.getDay() (Sunday 0).
 * Printed on white in both themes, and always beside the day written out.
 */
export const dayHues = ['#1A1714', '#2F6DB5', '#E3B505', '#C8372D', '#7A4E2D', '#3F8A3A', '#E07020'] as const;

/**
 * A run sheet's guest venue and brands, as the dot on each owner chip (the
 * host takes the accent). Always beside the party's name, never alone.
 */
export const partyHues = ['#D0643B', '#8FB3E8', '#9CC9A0', '#C9A0DC', '#E8C25A', '#7FC4C0'] as const;

/** The printed run sheet: black on white, whatever the theme (run sheet board "Sheet"). */
export const printPaper = { paper: '#FFFFFF', ink: '#1A1714', muted: '#555049', rule: '#C9C2B6', hairline: '#E6E0D6' } as const;

/**
 * What leaves the app as a picture (lib/paper, Bet-poster): the warm paper a
 * top three sits on by day and its night ground, the light panel a bar's
 * drinks are drawn on, and the cream ink on a bar's colour.
 */
export const posterPaper = { day: '#F3E6DA', night: '#241D18', panel: '#F6E7DA', cream: '#FFF6EE' } as const;

/** The accent when there's no venue brand: bar-light amber. */
export const DEFAULT_ACCENT = '#E4B062';

/** Two made-up venues, for the gallery and tests. Real venues come from `bars`. */
export const SAMPLE_BRANDS = {
  littleRye: { name: 'Little Rye', accent: '#D0643B', displayFace: 'instrument' as const },
  paleMoth: { name: 'Pale Moth', accent: '#B9A8F5', displayFace: 'imbue' as const },
};

/**
 * Type (Kevin, 3 Nov 2026: "the board's fonts"; it replaced the 31 Oct pick of
 * Redaction and the system font): Instrument Serif for names and titles,
 * Geist for body text, Geist Mono for eyebrows and labels in capitals,
 * tabular figures for amounts. The drink editor's figures set in Geist Mono
 * too (Miss-steps). Nothing under 13. These are the only font
 * families the app sets (npm run check:design). Paper is the one exception:
 * what prints (lib/paper) sets labels, caps and amounts in the platform's
 * typewriter face (components/paper/PaperPage), as Bet-labels and Bet-print draw them.
 */

/** Registered font family names (components/ds/fonts.ts). One family per file: a custom face ignores fontWeight on Android. */
export const fontFamilies = {
  name: 'InstrumentSerif',
  nameItalic: 'InstrumentSerifItalic',
  sans: 'Geist',
  sansMedium: 'GeistMedium',
  sansSemiBold: 'GeistSemiBold',
  mono: 'GeistMono',
  monoMedium: 'GeistMonoMedium',
  newsreader: 'Newsreader',
  newsreaderItalic: 'NewsreaderItalic',
  fell: 'IMFellEnglish',
  fellItalic: 'IMFellEnglishItalic',
  imbue: 'Imbue',
  besley: 'Besley',
  besleyItalic: 'BesleyItalic',
  bricolage: 'BricolageGrotesque',
  belleza: 'Belleza',
  shoulders: 'BigShoulders',
} as const;

/** The body face (Geist), for the few places that set a family outside a text style (chart labels). */
export const systemFont = fontFamilies.sans;

/** The typewriter face, for paper only (components/paper/PaperPage): the platform's own mono, so nothing loads. */
export const typewriterFont = process.env.EXPO_OS === 'ios' ? 'Menlo' : process.env.EXPO_OS === 'android' ? 'monospace' : 'ui-monospace, Menlo, Consolas, monospace';

/** Geist at the app's weights; `figures` for amounts, so columns line up. Spread into a style. */
export const font: Record<'regular' | 'medium' | 'semiBold' | 'figures' | 'figuresMedium' | 'mono' | 'monoMedium', TextStyle> = {
  regular: { fontFamily: fontFamilies.sans },
  medium: { fontFamily: fontFamilies.sansMedium },
  semiBold: { fontFamily: fontFamilies.sansSemiBold },
  figures: { fontFamily: fontFamilies.sans, fontVariant: ['tabular-nums'] },
  figuresMedium: { fontFamily: fontFamilies.sansMedium, fontVariant: ['tabular-nums'] },
  /** Geist Mono: the drink editor's figures and units (Miss-steps). */
  mono: { fontFamily: fontFamilies.mono },
  /** Geist Mono medium: eyebrows, labels in capitals, the editor's amounts. */
  monoMedium: { fontFamily: fontFamilies.monoMedium },
};

/** Eyebrows and labels set in capitals: Geist Mono (components/ds/Text). */
export const monoFont: TextStyle = font.monoMedium;

/**
 * The faces names can be set in (Kevin, 31 Oct 2026: one per style on the
 * type picker, all SIL OFL): the app's own (Instrument Serif), then Book, Worn, Deco,
 * Tavern, Modern, Poster and Sign. All but Instrument Serif load only when a venue
 * uses them (components/ds/faces.ts). `scale` sets each at the same visual
 * height as Instrument Serif; `spacing` is letter spacing in em; `upper` faces are
 * set in capitals (their names and credits: constants/faceInfo). Faces with no italic of their own stay upright.
 * `ascender` and `descent` are per em, measured with fontTools from the files
 * the app ships (Instrument Serif from @expo-google-fonts): the hhea descent, and
 * the tallest of d h k l f b and the capitals A H E I T, italic included.
 * nameStyle gives a name the line height they need.
 */
export const displayFaces = {
  instrument: { regular: fontFamilies.name, italic: fontFamilies.nameItalic, scale: 1, spacing: 0, upper: false, ascender: 0.748, descent: 0.31 },
  newsreader: { regular: fontFamilies.newsreader, italic: fontFamilies.newsreaderItalic, scale: 0.92, spacing: 0, upper: false, ascender: 0.715, descent: 0.265 },
  fell: { regular: fontFamilies.fell, italic: fontFamilies.fellItalic, scale: 0.95, spacing: 0, upper: false, ascender: 0.752, descent: 0.363 },
  imbue: { regular: fontFamilies.imbue, italic: fontFamilies.imbue, scale: 1.08, spacing: 0, upper: false, ascender: 0.755, descent: 0.25 },
  besley: { regular: fontFamilies.besley, italic: fontFamilies.besleyItalic, scale: 0.8, spacing: 0, upper: false, ascender: 0.791, descent: 0.425 },
  bricolage: { regular: fontFamilies.bricolage, italic: fontFamilies.bricolage, scale: 0.84, spacing: -0.025, upper: false, ascender: 0.712, descent: 0.27 },
  belleza: { regular: fontFamilies.belleza, italic: fontFamilies.belleza, scale: 0.72, spacing: 0.04, upper: true, ascender: 0.692, descent: 0.224 },
  shoulders: { regular: fontFamilies.shoulders, italic: fontFamilies.shoulders, scale: 1.05, spacing: 0.01, upper: true, ascender: 0.81, descent: 0.214 },
} as const;

export type DisplayFace = keyof typeof displayFaces;

/** Points a name's line keeps above its tallest letters (components/ds/displayClip.check.ts). */
export const NAME_ROOM = 1;

/**
 * A name set in a face at a size: the face, scaled to sit at Instrument Serif's
 * height, with its letter spacing and capitals. The line height is the
 * size's own, or taller where the face needs it: iOS sits a line set tighter
 * than its font one descent above its foot and cuts off whatever reaches past
 * the top, so the line keeps NAME_ROOM above the face's tallest letters
 * (Imbue's titles at its 1.08 scale, for one).
 */
export function nameStyle(face: DisplayFace, size: { fontSize: number; lineHeight: number }, italic = false): TextStyle {
  const f = displayFaces[face];
  const fontSize = Math.round(size.fontSize * f.scale);
  return {
    fontFamily: italic ? f.italic : f.regular,
    fontSize,
    lineHeight: Math.max(size.lineHeight, Math.ceil(fontSize * (f.ascender + f.descent) + NAME_ROOM)),
    ...(f.spacing ? { letterSpacing: f.spacing * fontSize } : null),
    ...(f.upper ? { textTransform: 'uppercase' } : null),
  };
}

const DISPLAY_FAMILIES = new Set<string>([fontFamilies.name, fontFamilies.nameItalic, fontFamilies.newsreader, fontFamilies.newsreaderItalic, fontFamilies.fell, fontFamilies.fellItalic, fontFamilies.imbue, fontFamilies.besley, fontFamilies.besleyItalic, fontFamilies.bricolage, fontFamilies.belleza, fontFamilies.shoulders]);

/**
 * The weight a text style needs when its caller swapped a display face into a
 * system variant (a name set in the bar's face on a Headline or Caption). The
 * faces are single-weight files, and on Android a 500 or 600 weight left on
 * one measures the line narrower than it draws, so the last word drops out of
 * sight ("House drink" read "House"). Undefined when nothing needs resetting:
 * the family is the system font, or the caller set its own weight.
 * Checked by components/ds/faceWeight.check.ts.
 */
export function faceWeightReset(fontFamily: unknown, fontWeight: unknown): { fontWeight: '400' } | undefined {
  return typeof fontFamily === 'string' && DISPLAY_FAMILIES.has(fontFamily) && fontWeight === undefined ? { fontWeight: '400' } : undefined;
}

/** Names set in the display face on rows (22/26) and on a menu's card (24/28), as the canvas draws them. */
export const displayName = {
  row: { fontSize: 22, lineHeight: 26 },
  card: { fontSize: 24, lineHeight: 28 },
  /** At the top of Android's drink and item pages (And-page). */
  page: { fontSize: 46, lineHeight: 52, letterSpacing: 0 },
} as const;

/** A score set as the moment's one big figure: where a rank landed (Prod-rank-A "9.0", 96 on phones). */
export const scoreFigure = { fontSize: 96, lineHeight: 108 } as const;

/** The smallest text the app sets, in points (check:design holds every size to it). */
export const MIN_FONT_SIZE = 13;

/**
 * Nine text styles. Nothing below 13. Display, head and title leave room
 * above the ascenders: iOS bottom-aligns a line set tighter than its font, so a
 * lineHeight of 1 cuts the tops off. Checked by components/ds/displayClip.check.ts.
 */
export const type = {
  display: { fontSize: 56, lineHeight: 64, letterSpacing: -1 },
  /** A main tab's name at the top of its page (Tonight, Drinks, Discover, You), 40 as the Prod-* boards set it. */
  head: { fontSize: 40, lineHeight: 46, letterSpacing: -0.4 },
  /** A list's name under its eyebrow, with the chevron (Tonight's "Autumn"), 30 as the Prod-* boards set it. */
  listHead: { fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  title: { fontSize: 34, lineHeight: 38, letterSpacing: -0.4 },
  headline: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  spec: { fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  /** Tabs and compact buttons, where the canvas sets them at 15 (What to make's tabs, Add both). */
  label: { fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
} as const;

export type TypeStyle = keyof typeof type;

/**
 * Bottom padding, in points, under every text style on iOS, so a paragraph
 * never draws a line short. Why: components/ds/Text.tsx. Checked by
 * components/ds/textSlack.check.ts.
 */
export const textSlack = 0.01;

/**
 * `mark`: shapes drawn inside a card that can be only a few points tall, like
 * zones on the back bar plan. `chip`: Material 3 filter chips on Android (8dp).
 */
export const radius = { mark: 4, chip: 8, control: 12, card: 22, sheet: 36, pill: 999 } as const;

/** 4-point grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const layout = {
  breakpoints: { tablet: 768, desktop: 1200 },
  gutter: { phone: 16, tablet: 24, desktop: 32 },
  minTapTarget: 44,
  /** Android's FAB (Material 3): 56 dp tall, plain or extended, and the plain one as wide. */
  fab: 56,
  /** Desktop's phone previews of a drink page: about an iPhone's width, in points. */
  phoneFrame: 390,
  /**
   * The phone photo hero's height, as a share of the screen under the status
   * bar. 0.3 is Eddie's (asked twice, 13 and 27 Oct); the boards draw 585 of
   * 844, which is 0.675 here. This one number changes it.
   */
  photoHero: 0.3,
  /** The photo beside the spec, from the split up (board Desk-photo-side-*). */
  photoPanel: 500,
  /**
   * How wide a page's column grows. Pages sit left, next to the sidebar
   * (components/nav/Page.tsx): text for lists and forms, wide for plans and grids.
   */
  page: { text: 760, wide: 1240 },
  /** The list's column beside a page: Library's panes on a tablet (the tablet board's width). */
  listPane: 360,
  /** Drinks' list beside the drink on a desktop, from 1200 (board Keep-desk; Kevin, 1 Nov). */
  listPaneDesk: 460,
  /** The pane beside a menu page on a desktop: a drink, or a swap (Menu-desk, Menu-l-desk). */
  menuPaneDesk: 520,
  /** The narrowest a menu row's column may be on a desktop before the page runs one column (Menu-desk: about 390 drawn). */
  menuColumnMin: 340,
  /** Screens and components past this many lines get split (enforced by check:design). */
  maxScreenLines: 300,
} as const;

/**
 * The magic eight ball (components/screens/eightball), in both themes and
 * every venue, like the toy: a black ball, a black window, and a glowing
 * electric-blue die face with small white capitals. No venue accent: the
 * real one has none.
 */
export const eightBall = {
  shine: '#3A352F',
  body: '#141210',
  edge: '#0A0908',
  window: '#040507',
  /** The face: bright in the middle, darker at its edges, a soft glow around it. */
  faceCore: '#4A72FF',
  face: '#2747E6',
  faceEdge: '#1A2FAE',
  glow: '#2D50FF',
  /** The faces next to it, tipping away into the dark. */
  neighbour: '#0C1856',
  text: '#E4ECFF',
  /** The other side: a white circle with a black 8, shown while the bar thinks. */
  eightFace: '#F3EFE8',
  eightShade: '#CFC8BC',
  eightInk: '#0B0A09',
  /** The window's clear rim and the shine on it. */
  rim: 'rgba(255,255,255,0.10)',
  glass: '#FFFFFF',
  /** The answer's size on the face: capitals, the first letter of each word a little bigger, as printed on the toy. */
  type: {
    normal: { lead: 12, rest: 9, lineHeight: 11, letterSpacing: 0.5 },
    small: { lead: 9.5, rest: 7.5, lineHeight: 9, letterSpacing: 0.3 },
  },
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

/**
 * A drink's drawing at its sizes, in points (decision drawing-sizes,
 * components/ds/DrinkDrawing): a guest's hero (260 to 300), a staff page's
 * smaller hero so the spec stays above the fold, the larger middle of a
 * menu's three (Menu-page), a tile, a menu page's row, and a row (56 or more:
 * under that a drawing is a smudge).
 */
export const drawing = { hero: 280, heroStaff: 180, middle: 206, tile: 160, menuRow: 64, row: 56 } as const;

/**
 * A menu page's cover photo: it runs 470 down from the top of the screen
 * (Menu-g-photo-dark), across the page's column (760 at most on a wide
 * screen). The cover picker crops to this shape.
 */
export const menuCover = { height: 470, column: 760 } as const;

/** A menu card's band of drawings or cover on a list of menus (Menu-shelf). */
export const menuBandHeight = 176;

/** How the colour pours into a drawing as it appears: fills the glass bottom up, after a beat. Reduce Motion skips it. */
export const pour = { delay: 200, ms: 1100 } as const;

/** How deep and slow a loading placeholder breathes (components/ds/Pulse). */
export const pulse = { low: 0.45, ms: 900 } as const;

export type SpringName = keyof typeof springs;

/**
 * A row picked up to drag it (components/ds/DragRow; drag options 1B, 2C,
 * 3B, Kevin 27 Oct): it grows a little, leans the way it moves and rests a
 * little leant, sits over the others on a shadow (elevation on Android), the
 * others ease aside to show its slot, and let go it eases into it.
 */
export const lift = {
  scale: 1.03,
  /** Degrees: while held, as it moves (per point a second), and at most. Reduce Motion: none. */
  lean: { rest: 1.2, perSpeed: 0.03, max: 7 },
  /** The held card's edge. */
  border: 1.5,
  shadow: { shadowColor: backbar.dark.ground, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 8 },
  /** Ms: picking it up, the others easing aside, and easing into its slot. */
  ms: { pick: 120, slide: 200, land: 180 },
  /** On a touch screen a row lifts after this hold, so a swipe over it still scrolls. */
  holdMs: 200,
} as const;

/**
 * Status colours for fills, dots and borders. `warning` is only 2:1 on the
 * light ground, so amber text and small icons need a darker shade. Text on a
 * status fill should be black (`#000`), not white.
 */
export const STATUS = {
  danger: '#E5484D',
  success: '#30A46C',
  warning: '#E5A93B',
  info: '#4A90E2',
} as const;
