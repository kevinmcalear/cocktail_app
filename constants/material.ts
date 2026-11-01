/**
 * Android's Material 3 measures on the drink and item pages (boards And-page,
 * And-photo), in dp. Only Android's own files read these, so they stay out of
 * the web's bundles.
 */
export const material = {
  /** The top app bar, under the status bar. */
  bar: 64,
  /** The bar's inset from the screen's edges. */
  barInset: 4,
  /** An icon button's touch box. */
  iconButton: 48,
  /** A button's height, and an icon button's circle over a photo. */
  control: 40,
  /** Label large, Material's button text. */
  label: { fontSize: 14, lineHeight: 20, letterSpacing: 0.14 },
  /** The Makes menu's rows, Compose text. */
  menuText: { fontSize: 15 },
} as const;
