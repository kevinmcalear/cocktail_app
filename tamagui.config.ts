import { config } from '@tamagui/config/v3'
import { createFont, createTamagui } from 'tamagui'

import { palette } from './constants/palette'

// ponytail: Inter for system UI; cocktail/menu presentation opts into IBMPlexSansItalic explicitly
const bodyFont = createFont({
  ...config.fonts.body,
  family: 'Inter',
  face: {
    normal: { normal: 'Inter' },
    400: { normal: 'Inter' },
    500: { normal: 'InterMedium' },
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold' },
  }
})

const headingFont = createFont({
  ...config.fonts.heading,
  family: 'Inter',
  face: {
    ...config.fonts.heading.face,
    normal: { normal: 'Inter' },
    400: { normal: 'Inter' },
    500: { normal: 'InterMedium' },
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold' },
    800: { normal: 'InterBold' },
    900: { normal: 'InterBold' },
  }
})

// Light and dark themes from the app palette (constants/palette.ts).
const themeFrom = (p: (typeof palette)['light' | 'dark']) => ({
  color: p.text,
  background: p.background,
  backgroundStrong: p.surface,
  borderColor: p.border,
  color1: p.background,
  color8: p.ink, // primary: buttons, links, selection
  color9: p.ink,
  color11: p.muted, // secondary text
  warningText: p.warningText, // drafts / in progress, as text or small icons
})

const customThemes = {
  ...config.themes,
  light: { ...config.themes.light, ...themeFrom(palette.light) },
  dark: { ...config.themes.dark, ...themeFrom(palette.dark), color2: palette.dark.surface },
}

const tamaguiConfig = createTamagui({
  ...config,
  fonts: {
    ...config.fonts,
    heading: headingFont,
    body: bodyFont,
  },
  themes: customThemes,
  settings: {
    ...config.settings,
    // This tells Tamagui to use React Native's continuous curve (squircle) for all border radii
    defaultProps: {
      Card: {
        borderCurve: 'continuous',
      },
      Button: {
        borderCurve: 'continuous',
      }
    }
  }
})

type Conf = typeof tamaguiConfig
declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig
