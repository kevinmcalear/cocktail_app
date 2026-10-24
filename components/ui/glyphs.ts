/**
 * Every icon in the app, in the bar kit style (whole-app canvas, Shell page,
 * nav-icons): a 24-point box, a 1.7 stroke, round caps and joins. `d` is the
 * line; `f` is the shape that fills (the accent at 22%) when the icon is on,
 * or always for a `.fill` name; `solid` fills `f` in full (a loved heart, a
 * dot). One table for iOS, Android and web: IconSymbol draws it in app, and
 * scripts/nav-tab-icons.ts renders the tab bar's images from it.
 *
 * Names are SF Symbol names, so call sites read the same on every platform.
 * `place.*` are the shell's places: use them wherever a place is meant.
 */
/** The icon stroke, in the glyph's 24-point box (nav-icons board). */
export const ICON_STROKE = 1.7;
/** How much of the colour fills an icon that's on. */
export const ICON_FILL = 0.22;

export interface Glyph {
  d: string;
  f?: string;
  solid?: boolean;
  /** Draw `f` without being asked: the `.fill` names. */
  on?: boolean;
  /** Tonight's page carries the service day's date. */
  day?: boolean;
}

const C = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const R = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
const filled = (g: Glyph): Glyph => ({ ...g, on: true });

// --- shapes more than one icon shares ---
const PAGE = R(4, 5, 16, 15, 2.5);
const CAL: Glyph = { d: PAGE + 'M8 3v4M16 3v4M4 10h16', f: PAGE };
const RING = C(12, 12, 9);
const SPEC_BOOK = 'M5.5 4.5h11a2 2 0 0 1 2 2v14h-11a2 2 0 0 1-2-2z';
const MENU_CARD = R(5.5, 3.5, 13, 17, 1.5);
const TUB = 'M6.5 7h11l-1 12.6a1.5 1.5 0 0 1-1.5 1.4H9a1.5 1.5 0 0 1-1.5-1.4z';
const MARK = 'M17.5 20.5L12 16.5l-5.5 4v-15a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2z';
const PIN = 'M12 21.5s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z';
const BOTTLE = 'M6 20.5v-8.5l1.6-2.2V5.5h1.8v4.3L11 12v8.5z';
const HEART = 'M19.5 5.6a4.7 4.7 0 0 0-6.6 0L12 6.5l-.9-.9a4.7 4.7 0 0 0-6.6 6.6l.9.9L12 19.7l6.6-6.6.9-.9a4.7 4.7 0 0 0 0-6.6z';
const PERSON = C(12, 8, 3.8) + 'M5 20.5v-1a4.5 4.5 0 0 1 4.5-4.5h5a4.5 4.5 0 0 1 4.5 4.5v1';
const TEAM = C(9, 8, 3) + 'M3.5 19.5c.6-3 2.8-5 5.5-5s4.9 2 5.5 5' + C(16.5, 8.5, 2.5) + 'M16 14.5c2.4 0 4.1 1.7 4.6 4.5';
const YOU = C(12, 12, 8.5) + C(12, 10, 3) + 'M6.6 18.3c1.3-2 3.2-3 5.4-3s4.1 1 5.4 3';
const PALETTE = 'M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2.6-1.8 4.5-4 4.5h-3c-2.5 0-3 2-1.5 4z';
const SLIDERS = 'M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20' + C(15, 7, 2.5) + C(9, 17, 2.5);
const SHIELD = 'M12 21s7.5-3.6 7.5-9.3V5.6L12 3 4.5 5.6v6.1C4.5 17.4 12 21 12 21z';
const LOCK = R(4.5, 10.5, 15, 10.5, 2);
const GLASS = 'M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0z';
const BEER = 'M6 8h9v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z';
const LEAF = 'M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-14 15';
const FLASK = 'M9 3h6M10 3v6.5L5.2 18a1.6 1.6 0 0 0 1.4 2.5h10.8a1.6 1.6 0 0 0 1.4-2.5L14 9.5V3';
const FLASK_FILL = 'M7.6 14.5h8.8l1.8 3.5a1.6 1.6 0 0 1-1.4 2.5H6.6a1.6 1.6 0 0 1-1.4-2.5z';
const DROP = 'M12 3.2l5.2 5.3a7.3 7.3 0 1 1-10.4 0z';
const STAR = 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z';
const CAMERA = 'M21.5 18.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3.2l1.8-2.8h5l1.8 2.8h3.2a2 2 0 0 1 2 2z';
const PHOTO = R(3.5, 3.5, 17, 17, 2.5);
const BUBBLE = 'M20.5 14.5a2 2 0 0 1-2 2H8l-4.5 4v-15a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z';
const FOLDER = 'M20.5 18.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4.5l2 2.8h6.5a2 2 0 0 1 2 2z';
const TAG = 'M20 13.4l-6.6 6.6a1.9 1.9 0 0 1-2.7 0L3.5 12.8V3.5h9.3l7.2 7.2a1.9 1.9 0 0 1 0 2.7z';
const MAP = 'M2.5 6.5v14l6-3 7 3 6-3v-14l-6 3-7-3z';
const DOC = 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z';
const PRINTER = 'M6.5 17.5h-2a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2';
const SEARCH = C(10.5, 10.5, 6.5) + 'M15.4 15.4l5.1 5.1';
const EYE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z';
const HOURGLASS = 'M6.5 3.5h11M6.5 20.5h11M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.5-8 8.5s8 4 8 8.5';
const CARD_BACK = 'M8 4.5h10.5a1.5 1.5 0 0 1 1.5 1.5v10';
const CARD = R(4, 8, 12.5, 12.5, 1.5);

const G = {
  // --- the shell's places (nav-icons board) ---
  'place.tonight': { ...CAL, day: true },
  'place.library': { d: SPEC_BOOK + 'M5.5 18.5a2 2 0 0 1 2-2h11M9 8h6l-3 3.2zM12 11.2v2.6M10.5 13.8h3', f: SPEC_BOOK },
  'place.menus': { d: MENU_CARD + 'M9.5 7.5h5M8.5 11.5h7M8.5 14.5h7M8.5 17.5h4', f: MENU_CARD },
  'place.prep': { d: 'M5.5 4.5h13v2.5h-13z' + TUB + 'M9 12.5h6v3H9z', f: TUB },
  'place.study': { d: CARD_BACK + CARD + 'M8.6 12.3a1.7 1.7 0 1 1 2.5 1.5c-.6.3-.85.7-.85 1.3M10.25 17.6h.01', f: CARD },
  'place.discover': { d: PIN + 'M9.6 8h4.8L12 10.6zM12 10.6v2.2M10.8 12.8h2.4', f: PIN },
  'place.history': { d: HOURGLASS, f: 'M9.5 20h5c0-1.6-1.2-2.6-2.5-3.4-1.3.8-2.5 1.8-2.5 3.4z' },
  'place.week': { d: CAL.d + 'M7.5 13.5h.01M10.5 13.5h.01M13.5 13.5h.01M16.5 13.5h.01M7.5 16.8h.01M10.5 16.8h.01M13.5 16.8h.01', f: PAGE },
  'place.backbar': { d: 'M3 20.5h18' + BOTTLE + 'M13.5 20.5v-6.8c0-1 .9-1.6 1.7-2V9h1.6v2.7c.8.4 1.7 1 1.7 2v6.8', f: BOTTLE },
  'place.mybar': { d: 'M6.5 21V11.8c0-1.2 1-2 1.6-2.6V4.5h2.2v4.7c.6.6 1.6 1.4 1.6 2.6V21zM14 13h6l-.7 7.2a1 1 0 0 1-1 .8h-2.6a1 1 0 0 1-1-.8zM14.3 16h5.4', f: 'M14.3 16h5.4l-.4 4.2a1 1 0 0 1-1 .8h-2.6a1 1 0 0 1-1-.8z' },
  'place.collection': { d: MARK + 'M9.8 7.5h4.4L12 9.9zM12 9.9v2', f: MARK },
  'place.you': { d: YOU, f: C(12, 12, 8.5) },
  'place.team': { d: TEAM, f: C(9, 8, 3) },
  'place.brand': { d: PALETTE + 'M8 11.5h.01M10.5 7.8h.01M14.8 7.8h.01', f: PALETTE },
  'place.roles': { d: C(8, 15.5, 3.8) + 'M10.8 12.8L19.5 4M16.5 7l2.2 2.2M14 9.5l1.8 1.8', f: C(8, 15.5, 3.8) },
  'place.settings': { d: SLIDERS, f: C(15, 7, 2.5) + C(9, 17, 2.5) },

  // --- moving around ---
  'chevron.right': { d: 'M9.5 5.5L16 12l-6.5 6.5' },
  'chevron.left': { d: 'M14.5 5.5L8 12l6.5 6.5' },
  'chevron.up': { d: 'M5.5 15L12 8.5l6.5 6.5' },
  'chevron.down': { d: 'M5.5 9L12 15.5 18.5 9' },
  'arrow.left': { d: 'M19 12H5M11.5 5.5L5 12l6.5 6.5' },
  'arrow.right': { d: 'M5 12h14M12.5 5.5L19 12l-6.5 6.5' },
  'arrow.up': { d: 'M12 19V5M5.5 11.5L12 5l6.5 6.5' },
  'arrow.up.right': { d: 'M7 17L17 7M8.5 7H17v8.5' },
  'arrow.up.to.line': { d: 'M5 4h14M12 20V8.5M6.5 14L12 8.5l5.5 5.5' },
  'arrow.up.and.down': { d: 'M8 4v16M4.5 7.5L8 4l3.5 3.5M16 20V4M12.5 16.5L16 20l3.5-3.5' },
  'arrow.turn.down.right': { d: 'M4.5 4v7a4 4 0 0 0 4 4h11M15.5 11l4 4-4 4' },
  'arrow.uturn.backward': { d: 'M9 14L4.5 9.5 9 5M4.5 9.5h10a5 5 0 0 1 0 10H11' },
  'arrow.clockwise': { d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.5H15' },
  'clock.arrow.circlepath': { d: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9M12 8v4l2.8 1.8' },
  'arrow.up.right.square': { d: 'M18.5 13.5v5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h5M14.5 3.5h6v6M10.5 13.5l10-10' },
  'arrow.triangle.turn.up.right.diamond': { d: 'M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM9 15v-2.5a2 2 0 0 1 2-2h4.5M13.5 8.5l2 2-2 2', f: 'M12 2.8l9.2 9.2-9.2 9.2L2.8 12z' },
  'rectangle.portrait.and.arrow.right': { d: 'M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4M15.5 16.5L20 12l-4.5-4.5M20 12H9' },
  'line.3.horizontal': { d: 'M4 6.5h16M4 12h16M4 17.5h16' },
  'line.horizontal.3': { d: 'M4 6.5h16M4 12h16M4 17.5h16' },
  'line.3.horizontal.decrease': { d: 'M4 6.5h16M7 12h10M10 17.5h4' },
  ellipsis: { d: C(5.5, 12, 1.1) + C(12, 12, 1.1) + C(18.5, 12, 1.1), f: C(5.5, 12, 1.1) + C(12, 12, 1.1) + C(18.5, 12, 1.1), solid: true, on: true },
  'circle.grid.3x3.fill': { d: '', f: C(9, 6, 1.6) + C(15, 6, 1.6) + C(9, 12, 1.6) + C(15, 12, 1.6) + C(9, 18, 1.6) + C(15, 18, 1.6), solid: true, on: true },

  // --- doing things ---
  plus: { d: 'M12 5v14M5 12h14' },
  minus: { d: 'M5 12h14' },
  'plus.circle': { d: RING + 'M12 8v8M8 12h8', f: RING },
  'plus.circle.fill': filled({ d: RING + 'M12 8v8M8 12h8', f: RING }),
  'plus.square': { d: PHOTO + 'M12 8v8M8 12h8', f: PHOTO },
  xmark: { d: 'M6 6l12 12M18 6L6 18' },
  'xmark.circle.fill': filled({ d: RING + 'M9 9l6 6M15 9l-6 6', f: RING }),
  checkmark: { d: 'M4.5 12.5l4.5 4.5L19.5 6.5' },
  'checkmark.circle.fill': filled({ d: RING + 'M8 12.3l2.8 2.8L16.2 9.7', f: RING }),
  'checkmark.seal.fill': filled({
    d: 'M12 3l2.3 1.6 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21l-2.3-1.6-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.1zM9 12l2 2 4-4',
    f: 'M12 3l2.3 1.6 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21l-2.3-1.6-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.1z',
  }),
  pencil: { d: 'M16.5 4a2.5 2.5 0 0 1 3.5 3.5L8 19.5l-4.5 1 1-4.5z', f: 'M16.5 4a2.5 2.5 0 0 1 3.5 3.5L8 19.5l-4.5 1 1-4.5z' },
  trash: { d: 'M4 6.5h16M18 6.5v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-12M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5M10 11v5.5M14 11v5.5' },
  'square.and.arrow.up': { d: 'M5 12v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12M16 7l-4-4-4 4M12 3v12' },
  'square.and.arrow.down': { d: 'M12 3v11M7.5 9.5L12 14l4.5-4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
  'doc.on.doc': { d: R(8.5, 8.5, 12, 12, 2) + 'M15.5 5.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5', f: R(8.5, 8.5, 12, 12, 2) },
  'square.on.square': { d: R(8.5, 8.5, 12, 12, 2) + 'M15.5 5.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5', f: R(8.5, 8.5, 12, 12, 2) },
  'doc.on.clipboard': { d: 'M15.5 4.5H17a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h1.5' + R(8.5, 3, 7, 3.5, 1) },
  link: { d: 'M10 13.5a4.5 4.5 0 0 0 6.8.5l2.7-2.7a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5M14 10.5a4.5 4.5 0 0 0-6.8-.5l-2.7 2.7a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5' },
  magnifyingglass: { d: SEARCH, f: C(10.5, 10.5, 6.5) },
  'plus.magnifyingglass': { d: SEARCH + 'M10.5 8v5M8 10.5h5', f: C(10.5, 10.5, 6.5) },
  'minus.magnifyingglass': { d: SEARCH + 'M8 10.5h5', f: C(10.5, 10.5, 6.5) },
  'play.fill': filled({ d: 'M7 4.5l12 7.5-12 7.5z', f: 'M7 4.5l12 7.5-12 7.5z' }),
  'paperplane.fill': filled({ d: 'M20.5 3.5L10.5 13.5M20.5 3.5l-6 17-4-7-7-4z', f: 'M20.5 3.5l-6 17-4-7-7-4z' }),
  printer: { d: 'M6.5 8.5v-5h11v5' + PRINTER + R(6.5, 13.5, 11, 7, 1), f: R(6.5, 13.5, 11, 7, 1) },
  scissors: { d: C(6.5, 6.5, 2.8) + C(6.5, 17.5, 2.8) + 'M19.5 4.5L8.6 15.4M14.3 14.3l5.2 5.2M8.6 8.6L12 12' },
  'hand.tap': { d: 'M4 4l6.5 15.5 2.3-6.7 6.7-2.3zM13 13l6 6' },
  'chevron.left.forwardslash.chevron.right': { d: 'M16 17.5l5.5-5.5L16 6.5M8 6.5L2.5 12 8 17.5' },
  'switch.2': { d: R(2.5, 7, 19, 10, 5) + C(16.5, 12, 2.6), f: C(16.5, 12, 2.6) },
  'slider.horizontal.3': { d: SLIDERS, f: C(15, 7, 2.5) + C(9, 17, 2.5) },
  gearshape: { d: SLIDERS, f: C(15, 7, 2.5) + C(9, 17, 2.5) },
  'sun.min': { d: SLIDERS, f: C(15, 7, 2.5) + C(9, 17, 2.5) },
  'square.grid.2x2': { d: R(3.5, 3.5, 7, 7, 1.5) + R(13.5, 3.5, 7, 7, 1.5) + R(3.5, 13.5, 7, 7, 1.5) + R(13.5, 13.5, 7, 7, 1.5) },
  'list.bullet': { d: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01' },
  'list.number': { d: 'M10 6.5h10M10 12h10M10 17.5h10M4 5.5l1.5-1v4.5M3.8 14.3a1.4 1.4 0 0 1 2.6.6c0 1-2.6 2-2.6 3.1h2.8' },
  'text.alignleft': { d: MENU_CARD + 'M9.5 7.5h5M8.5 11.5h7M8.5 14.5h7M8.5 17.5h4', f: MENU_CARD },
  'rectangle.stack': { d: CARD_BACK + CARD, f: CARD },

  // --- people ---
  person: { d: PERSON, f: C(12, 8, 3.8) },
  'person.crop.circle': { d: YOU, f: C(12, 12, 8.5) },
  'person.circle.fill': filled({ d: YOU, f: C(12, 12, 8.5) }),
  'person.2.fill': filled({ d: TEAM, f: C(9, 8, 3) }),
  'person.badge.plus': { d: C(9.5, 8, 3.8) + 'M3 20.5v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1M19 8v6M16 11h6', f: C(9.5, 8, 3.8) },
  'person.badge.minus': { d: C(9.5, 8, 3.8) + 'M3 20.5v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1M16 11h6', f: C(9.5, 8, 3.8) },
  envelope: { d: R(3, 5, 18, 14, 2) + 'M3.5 6.5l8.5 6.5 8.5-6.5', f: R(3, 5, 18, 14, 2) },
  'bubble.left': { d: BUBBLE, f: BUBBLE },
  phone: { d: 'M20.5 16.4v2.6a1.8 1.8 0 0 1-2 1.8 17.6 17.6 0 0 1-7.7-2.7 17.3 17.3 0 0 1-5.3-5.3A17.6 17.6 0 0 1 2.8 5.1 1.8 1.8 0 0 1 4.6 3.1h2.6a1.8 1.8 0 0 1 1.8 1.5c.1.9.4 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9L8.1 10.1a14.2 14.2 0 0 0 5.3 5.3l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.6 1.9z' },
  globe: { d: RING + 'M3 12h18M12 3a13.5 13.5 0 0 1 3.6 9 13.5 13.5 0 0 1-3.6 9 13.5 13.5 0 0 1-3.6-9A13.5 13.5 0 0 1 12 3z', f: RING },
  instagram: { d: R(3.5, 3.5, 17, 17, 5) + C(12, 12, 4) + 'M17.2 6.8h.01' },

  // --- the bar ---
  house: { d: 'M3.5 10L12 3.5l8.5 6.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19zM9.5 20.5v-7h5v7', f: 'M3.5 10L12 3.5l8.5 6.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z' },
  'house.fill': filled({ d: 'M3.5 10L12 3.5l8.5 6.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19zM9.5 20.5v-7h5v7', f: 'M3.5 10L12 3.5l8.5 6.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z' }),
  'building.2': { d: 'M4.5 20.5V6.5l8-3v17M12.5 9h7v11.5M3 20.5h18M7.5 9.5h2M7.5 13h2M7.5 16.5h2M15.5 12.5h1.5M15.5 16h1.5', f: 'M4.5 20.5V6.5l8-3v17z' },
  'building.2.fill': filled({ d: 'M4.5 20.5V6.5l8-3v17M12.5 9h7v11.5M3 20.5h18M7.5 9.5h2M7.5 13h2M7.5 16.5h2M15.5 12.5h1.5M15.5 16h1.5', f: 'M4.5 20.5V6.5l8-3v17z' }),
  wineglass: { d: GLASS + 'M12 12.5V20M8.5 20h7', f: GLASS },
  'wineglass.fill': filled({ d: GLASS + 'M12 12.5V20M8.5 20h7', f: GLASS }),
  'mug.fill': filled({ d: BEER + 'M15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 5.5c1-1.5 3-1.5 4.5 0 1.5-1.5 3.5-1.5 4.5 0', f: BEER }),
  flask: { d: FLASK + 'M7.6 14.5h8.8', f: FLASK_FILL },
  'hammer.fill': filled({ d: 'M14.5 6.5l3 3M4 20l8.5-8.5M11 5l4-1.5 5.5 5.5L19 13l-8-8z', f: 'M11 5l4-1.5 5.5 5.5L19 13z' }),
  snowflake: { d: 'M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5' },
  'leaf.fill': filled({ d: LEAF + 'M5 19l7.5-7.5', f: LEAF }),
  'drop.fill': filled({ d: DROP, f: DROP }),
  'thermometer.medium': { d: 'M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0zM12 11v5.5', f: C(12, 17.5, 2) },
  sparkles: { d: 'M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z', f: 'M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z' },
  '8.circle': { d: RING + C(12, 11, 4.2) + C(12, 9.6, 1.2) + C(12, 12.4, 1.5), f: RING },
  target: { d: RING + C(12, 12, 5.5) + C(12, 12, 2), f: C(12, 12, 2) },
  'circle.lefthalf.filled': { d: RING + 'M12 3v18', f: 'M12 3a9 9 0 0 0 0 18z', solid: true, on: true },
  percent: { d: 'M18.5 5.5l-13 13' + C(7, 7, 2.3) + C(17, 17, 2.3) },
  'dollarsign.circle.fill': filled({ d: RING + 'M14.8 8.8h-3.6a1.8 1.8 0 0 0 0 3.6h1.6a1.8 1.8 0 0 1 0 3.6H9.2M12 7v1.8M12 16v1.5', f: RING }),
  trophy: { d: 'M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H5a2.5 2.5 0 0 0 2.5 4.5M16.5 6H19a2.5 2.5 0 0 1-2.5 4.5M12 13.5v3.5M8.5 20.5h7M9.5 20.5c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5', f: 'M7.5 4h9v5a4.5 4.5 0 0 1-9 0z' },
  star: { d: STAR, f: STAR },
  heart: { d: HEART, f: HEART },
  'heart.fill': { d: HEART, f: HEART, solid: true, on: true },
  bookmark: { d: MARK, f: MARK },
  'bookmark.fill': filled({ d: MARK, f: MARK }),
  book: { d: SPEC_BOOK + 'M5.5 18.5a2 2 0 0 1 2-2h11', f: SPEC_BOOK },
  'book.fill': filled({ d: SPEC_BOOK + 'M5.5 18.5a2 2 0 0 1 2-2h11', f: SPEC_BOOK }),
  safari: { d: RING + 'M15.5 8.5l-2 5-5 2 2-5z', f: 'M15.5 8.5l-2 5-5 2 2-5z' },
  calendar: CAL,
  clock: { d: RING + 'M12 7.5V12l3 2', f: RING },
  'paintpalette.fill': filled({ d: PALETTE + 'M8 11.5h.01M10.5 7.8h.01M14.8 7.8h.01', f: PALETTE }),
  'map.fill': filled({ d: MAP + 'M8.5 3.5v14M15.5 6.5v14', f: MAP }),
  'mappin.and.ellipse': { d: 'M12 17s5.5-4.6 5.5-9a5.5 5.5 0 0 0-11 0c0 4.4 5.5 9 5.5 9z' + C(12, 8, 2) + 'M7.5 17.5c-2 .4-3.5 1.1-3.5 1.8 0 1.2 3.6 2.2 8 2.2s8-1 8-2.2c0-.7-1.5-1.4-3.5-1.8', f: C(12, 8, 2) },
  location: { d: 'M12 21.5s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.5 11 6.5 11z' + C(12, 10.5, 2.3), f: C(12, 10.5, 2.3) },
  'location.fill': filled({ d: 'M3.5 11l17-7.5-7.5 17-2-7.5z', f: 'M3.5 11l17-7.5-7.5 17-2-7.5z' }),
  flag: { d: 'M5 15s1-1 4-1 5 2 8 2 3-1 3-1V4s-1 1-3 1-5-2-8-2-4 1-4 1zM5 21.5V15', f: 'M5 15s1-1 4-1 5 2 8 2 3-1 3-1V4s-1 1-3 1-5-2-8-2-4 1-4 1z' },
  pin: { d: 'M9 3.5h6l-1 5.5 3 3H7l3-3zM12 12v8.5', f: 'M9 3.5h6l-1 5.5 3 3H7l3-3z' },
  'pin.fill': filled({ d: 'M9 3.5h6l-1 5.5 3 3H7l3-3zM12 12v8.5', f: 'M9 3.5h6l-1 5.5 3 3H7l3-3z' }),
  'folder.fill': filled({ d: FOLDER, f: FOLDER }),
  'tag.fill': filled({ d: TAG + 'M8 8h.01', f: TAG }),
  camera: { d: CAMERA + C(12, 13.5, 3.5), f: C(12, 13.5, 3.5) },
  'camera.fill': filled({ d: CAMERA + C(12, 13.5, 3.5), f: CAMERA }),
  photo: { d: PHOTO + C(9, 9, 1.5) + 'M20.5 15l-5-5L4.5 20.5', f: PHOTO },
  doc: { d: DOC + 'M14 3v5h5M9 13h6M9 17h4', f: DOC },
  'doc.text': { d: DOC + 'M14 3v5h5M9 13h6M9 17h6', f: DOC },
  'doc.plaintext': { d: DOC + 'M14 3v5h5', f: DOC },
  'note.text': { d: DOC + 'M14 3v5h5M9 13h6M9 17h6', f: DOC },
  'sun.max.fill': filled({ d: C(12, 12, 4) + 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4', f: C(12, 12, 4) }),
  'circle.fill': { d: '', f: C(12, 12, 6), solid: true, on: true },

  // --- safety and state ---
  'lock.shield.fill': filled({ d: SHIELD, f: SHIELD }),
  'lock.fill': filled({ d: LOCK + 'M8 10.5V7.5a4 4 0 0 1 8 0v3', f: LOCK }),
  'lock.open.fill': filled({ d: LOCK + 'M8 10.5V7.5a4 4 0 0 1 7.9-.9', f: LOCK }),
  'key.fill': filled({ d: C(8, 15.5, 3.8) + 'M10.8 12.8L19.5 4M16.5 7l2.2 2.2M14 9.5l1.8 1.8', f: C(8, 15.5, 3.8) }),
  eye: { d: EYE + C(12, 12, 3), f: C(12, 12, 3) },
  'eye.slash': { d: 'M10 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.1M6.3 6.3A16.6 16.6 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.7-1.8M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18' },
  nosign: { d: RING + 'M5.6 5.6l12.8 12.8' },
  'info.circle': { d: RING + 'M12 16v-4.5M12 8h.01', f: RING },
  'exclamationmark.circle': { d: RING + 'M12 7.5V12M12 16h.01', f: RING },
  'exclamationmark.triangle': { d: 'M10.3 4.2L2.6 17.5a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01', f: 'M10.3 4.2L2.6 17.5a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z' },
  questionmark: { d: RING + 'M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.5-2.6 2.5M12 16.5h.01', f: RING },
  'wifi.slash': { d: 'M3 3l18 18M16.6 10.9a10 10 0 0 1 2.4 1.6M5 12.5a10 10 0 0 1 4.9-2.3M10.7 5.1A15 15 0 0 1 21.5 9M2.5 9a15 15 0 0 1 4.3-2.7M8.8 16a5 5 0 0 1 6.4 0M12 19.5h.01' },
} satisfies Record<string, Glyph>;

export type GlyphName = keyof typeof G;
export const GLYPHS: Record<GlyphName, Glyph> = G;
export const glyphNames = Object.keys(G) as GlyphName[];
