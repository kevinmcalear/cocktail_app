/**
 * The six colours a bar can start from when it has no logo to take one from:
 * colours from a bar, not an app builder's defaults (Kevin, 31 Oct, themes-flow
 * "bar presets"). The background is picked on its own (lib/palette).
 */
export const BAR_COLOURS = [
  { name: 'Campari red', hex: '#C41E2A' },
  { name: 'Vermouth oxblood', hex: '#6B1F2A' },
  { name: 'Brass', hex: '#B08D3C' },
  { name: 'Absinthe green', hex: '#7F9F2F' },
  { name: 'Ink navy', hex: '#1F2D4A' },
  { name: 'Copper', hex: '#B87333' },
] as const;
