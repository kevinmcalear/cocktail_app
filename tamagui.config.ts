import { config } from '@tamagui/config/v3'
import { createTamagui } from 'tamagui'

// Custom Cocktail App Themes based on existing constants/theme.ts
const customThemes = {
  ...config.themes,
  light: {
    ...config.themes.light,
    color: '#000000',
    background: '#F2F2F7', // System Gray 6
    backgroundStrong: '#ffffff',
    borderColor: 'rgba(0,0,0,0.1)',
    color1: '#F2F2F7',    // mapping custom tint logic
    color8: '#007AFF',    // System Blue Primary
    color9: '#007AFF',    
    color11: '#8E8E93',   // Icon gray
  },
  dark: {
    ...config.themes.dark,
    color: '#FFFFFF',
    background: '#000000', // Pure black
    backgroundStrong: '#1C1C1E', // System Gray 6 dark
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color1: '#000000',
    color2: '#1C1C1E', // standard surface
    color8: '#FFFFFF', // High-contrast primary
    color9: '#FFFFFF', 
    color11: '#98989D', // System Gray dark
  },
}

const tamaguiConfig = createTamagui({
  ...config,
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
