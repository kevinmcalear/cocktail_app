/**
 * The app's colours, in one place. Tamagui's light and dark themes
 * (tamagui.config.ts) and the plain React Native `Colors` (constants/theme.ts)
 * both read from here.
 *
 * The chrome is neutral "ink" in both modes, so each venue's own logo and
 * colours, and the drink photos, carry the colour. Text colours meet WCAG AA
 * (4.5:1) on both the page and card backgrounds.
 *
 * In Tamagui components, use the theme's adaptive status colours:
 * `$red10` (destructive), `$green10` (done), `$orange10` (in progress).
 * Outside Tamagui (icons, StyleSheet), use `STATUS` below.
 */
export const palette = {
  light: {
    background: '#F9F9FB', // page
    surface: '#FFFFFF', // cards, sheets, inputs
    text: '#1C1C1E',
    muted: '#6B6B70', // secondary text: 5.0:1 on page, 5.3:1 on cards
    border: 'rgba(0, 0, 0, 0.1)',
    ink: '#1C1C1E', // primary buttons (with `surface` text), links, selection
    glass: 'rgba(255, 255, 255, 0.72)',
    glassBorder: 'rgba(0, 0, 0, 0.08)',
    tabIconInactive: 'rgba(28, 28, 30, 0.55)', // on the glass tab bar, 3:1 or better
    warningText: '#9A6700', // drafts / in progress as text or small icons: 4.6:1 on page
  },
  dark: {
    background: '#161618',
    surface: '#232326',
    text: '#F2F2F7',
    muted: '#A1A1AA', // 7.1:1 on page, 6.1:1 on cards
    border: 'rgba(255, 255, 255, 0.1)',
    ink: '#F2F2F7',
    glass: 'rgba(35, 35, 38, 0.65)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    tabIconInactive: 'rgba(242, 242, 247, 0.5)',
    warningText: '#E5A93B', // 8.7:1 on page
  },
} as const;

export type ColorSchemeName = keyof typeof palette;

/**
 * Status colours for fills, dots and borders. `warning` is only 2:1 on the light
 * page, so amber text and small icons use `palette[scheme].warningText` instead.
 * Text on a status fill should be black (`#000`), not white.
 */
export const STATUS = {
  danger: '#E5484D',
  success: '#30A46C',
  warning: '#E5A93B',
  info: '#4A90E2',
} as const;
