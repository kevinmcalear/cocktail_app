import { config } from '@tamagui/config/v3'
import { createFont, createTamagui } from 'tamagui'

import { palette } from './constants/palette'
import { backbar } from './constants/tokens'

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

// The redesign's colours (constants/tokens.ts), as sub-themes that redesigned
// screens opt into with components/ds BackbarTheme. Existing screens keep the
// themes above until they're replaced.
const backbarThemeFrom = (b: (typeof backbar)['light' | 'dark']) => ({
  color: b.ink,
  background: b.ground,
  backgroundStrong: b.surface,
  borderColor: b.line,
  color1: b.ground,
  color2: b.surface,
  color8: b.ink,
  color9: b.ink,
  color11: b.muted,
})

const light = { ...config.themes.light, ...themeFrom(palette.light) }
const dark = { ...config.themes.dark, ...themeFrom(palette.dark), color2: palette.dark.surface }

// Only the themes the app renders. The v3 config's colour, alt and surface
// themes (900 in all) went into an inline <style> on every web page (2.7 MB of
// index.html). Button, Input, TextArea and Card still look themselves up by
// component name, so their light and dark sub-themes stay. The v3 config
// builds those at runtime but leaves them out of its types.
type ComponentTheme = `${'light' | 'dark'}_${'Button' | 'Input' | 'TextArea' | 'Card'}`;
const v3 = config.themes as unknown as Record<ComponentTheme, typeof config.themes.light>;
const customThemes = {
  light,
  dark,
  light_Button: v3.light_Button,
  dark_Button: v3.dark_Button,
  light_Input: v3.light_Input,
  dark_Input: v3.dark_Input,
  light_TextArea: v3.light_TextArea,
  dark_TextArea: v3.dark_TextArea,
  light_Card: v3.light_Card,
  dark_Card: v3.dark_Card,
  light_backbar: { ...light, ...backbarThemeFrom(backbar.light) },
  dark_backbar: { ...dark, ...backbarThemeFrom(backbar.dark) },
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
