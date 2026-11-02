/**
 * Android's Material 3 measures on the drink and item pages (boards And-page,
 * And-photo), in dp. Mostly Android's own files read these (the FAB's size is
 * also read where the FAB tells the toast its top), so they stay small.
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
  /** The FAB's label, Compose text. */
  fabText: { fontSize: 16, fontWeight: '500' },
  /** A FAB's height, plain or extended, and the plain one's width. */
  fab: 56,
  /** A list tile: 56 tall, its group's ends round and its seams nearly square. */
  tile: { height: 56, end: 20, seam: 4 },
} as const;
