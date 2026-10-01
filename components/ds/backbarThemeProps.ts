import type { BackbarScheme } from '@/constants/tokens';

/**
 * Props for the Tamagui Theme inside BackbarTheme. `forceClassName` keeps its
 * web markup the same whatever the parent's scheme is: without it Tamagui adds
 * a wrapper span only when the scheme differs from the parent's. The static
 * export renders light under light (no wrapper), but a route hydrates after
 * the root has already switched to dark, so on a dark device it hydrated light
 * under dark (wrapper) and React threw the tree away (#418).
 */
export function backbarThemeProps(scheme: BackbarScheme) {
  return { name: scheme === 'dark' ? 'dark_backbar' : 'light_backbar', forceClassName: true } as const;
}
