// Pigments for the drawn sketches (lib/sketch): the paper, the pencils, and
// the colours of foam, vessels and garnishes. The drink's own colour comes
// from its drawing inputs.

export const SKETCH = {
  graphite: '#3D3934',
  charcoal: '#1E1A17',
  sepia: '#2B221B',
  paper: '#EFE9DD',
  lift: '#F8F4EC',
  smudge: '#8F887E',
  crumb: '#7C756C',
  washEdge: '#1A1210',
  pool: '#2A1A14',
  glassGrey: '#8E9BA2',
  mute: '#9A9086',
  homeMug: '#E6DCCB',
  capFoam: '#F7F2E8',
  crema: '#D7AE7C',
  cremaStreak: '#A87443',
  cremaShadow: '#8A5E36',
  froth: '#FFF9EC',
  white: '#FFFFFF',
  foamShadow: '#8C7F6C',
  julepMetal: '#B4B6B2',
  tikiClay: '#9A6A44',
  copper: '#C27A48',
  ceramicGlaze: '#6F8E8A',
  orangePeel: '#E07B26',
  lemonPeel: '#E6C43A',
  grapefruitPeel: '#E8806A',
  limeWheel: '#B5CC5E',
  lemonWheel: '#EED45A',
  orangeWheel: '#F0A040',
  cucumber: '#C8DCA0',
  cherry: '#7E0E24',
  olive: '#7C8E3A',
  onion: '#EEE8D8',
  limeWedge: '#A9C454',
  mint: '#3E8E4A',
  mintLight: '#4FA35A',
  herb: '#3F6E3A',
  herbLight: '#4F7E44',
  berry: '#B8174A',
  strawberry: '#D8303E',
  leaf: '#4F8F3A',
  pineapple: '#EBC64E',
  coffeeBean: '#3A2416',
  spice: '#7A4A26',
  petal: '#E596B6',
  pollen: '#F0C83A',
  salt: '#9A948C',
  sugar: '#D8C8A0',
  ginger: '#D59A35',
  chili: '#C0301E',
  apple: '#E8E0A8',
  // bar kit (lib/sketch/kit.ts): cool steel, appliance enamel, a scale's display, a torch flame
  steel: '#A3ADB2',
  steelDark: '#4F5A60',
  enamel: '#E9E4DA',
  rubber: '#2E2A28',
  lcd: '#A9BFA0',
  water: '#A7C7D6',
  flame: '#5B8BD8',
  butane: '#C8553D',
} as const;

/** Drink colours for the gallery's sample sketches (components/ds/gallery). */
export const SKETCH_SAMPLES = {
  martini: '#efe3b0',
  daiquiri: '#e6e4a6',
  manhattan: '#8a3a16',
  negroni: '#a8202e',
  redWine: '#7a1022',
  champagne: '#e8d27a',
  spritz: '#f05a1a',
  brandy: '#8a4a12',
  lager: '#d9961c',
  irishCoffee: '#3a2010',
  cream: '#f4eedd',
} as const;

/** The clear swatch: painted thin, as a clear drink is. The rules' clear (sketchRules.ts DRINK_COLORS.clear). */
export const SKETCH_CLEAR_TINT = '#f2f2ec';

/**
 * The colours a drink's editor can paint its sketch instead of the one worked
 * out from its spec (items.sketch_liquid; lib/sketch/types.ts liquidOf).
 * Lowercase, as the database stores them. Picked to read apart on the paper,
 * with several ways out of a menu of stirred browns. The hex is what's saved,
 * so changing one leaves drinks on the old colour: add, don't edit.
 */
export const SKETCH_TINTS = [
  { key: 'amber', label: 'Amber', hex: '#c98a35' },
  { key: 'mahogany', label: 'Mahogany', hex: '#6e2c1c' },
  { key: 'garnet', label: 'Garnet', hex: '#6f1426' },
  { key: 'red', label: 'Deep red', hex: '#b3202e' },
  { key: 'rose', label: 'Rose', hex: '#d0697a' },
  { key: 'blush', label: 'Blush', hex: '#efb7ae' },
  { key: 'gold', label: 'Pale gold', hex: '#e1b84c' },
  { key: 'straw', label: 'Straw', hex: '#e9dc96' },
  { key: 'olive', label: 'Olive', hex: '#8a8b3c' },
  { key: 'smoke', label: 'Smoky grey', hex: '#77726e' },
  { key: 'water', label: 'Clear', hex: SKETCH_CLEAR_TINT },
] as const;
export type SketchTint = (typeof SKETCH_TINTS)[number];
