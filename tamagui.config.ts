import { config } from '@tamagui/config/v3'
import { createFont, createTamagui } from 'tamagui'

const bodyFont = createFont({
  ...config.fonts.body,
  family: 'IBMPlexSans',
  face: {
    normal: { normal: 'IBMPlexSans' },
    400: { normal: 'IBMPlexSans' },
    700: { normal: 'IBMPlexSansBold' },
  }
})

const headingFont = createFont({
  ...config.fonts.heading,
  family: 'IBMPlexSans',
  face: {
    ...config.fonts.heading.face,
    normal: { normal: 'IBMPlexSans' },
    400: { normal: 'IBMPlexSans' },
    700: { normal: 'IBMPlexSansBold' },
    800: { normal: 'IBMPlexSansBold' },
    900: { normal: 'IBMPlexSansBold' },
  }
})

// Custom Cocktail App Themes based on existing constants/theme.ts
const customThemes = {
  ...config.themes,
  light: {
    ...config.themes.light,
    color: '#2C2C2E',
    background: '#F9F9FB', // Warm, airy off-white
    backgroundStrong: '#ffffff',
    borderColor: 'rgba(0,0,0,0.1)',
    color1: '#F9F9FB',
    color8: '#007AFF',    // System Blue Primary
    color9: '#007AFF',    
    color11: '#8E8E93',   // Icon gray
  },
  dark: {
    ...config.themes.dark,
    color: '#F2F2F7',
    background: '#161618', // Deep warm charcoal
    backgroundStrong: '#232326', // Elevated dark gray
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color1: '#161618',
    color2: '#232326', // standard surface
    color8: '#F2F2F7', // High-contrast primary
    color9: '#F2F2F7', 
    color11: '#A1A1AA', // zinc-400
  },
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
