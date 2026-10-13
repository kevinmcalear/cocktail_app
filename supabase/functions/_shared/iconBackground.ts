/** The app's colours for an icon background the venue hasn't set (constants/tokens.ts). */
const DEFAULT_ACCENT = "#E4B062";
const DARK_GROUND = "#0E0D0C";
const CREAM = "#F3EEE6";

export type IconBackground = "accent" | "ground" | "cream";

/**
 * A venue's home-screen icon background, as Brand's Rust / Walnut / Cream
 * tiles pick it: its accent, its dark ground, or cream. An opaque RGBA number
 * (imagescript's colour), or null to keep the logo's own corner colour.
 */
export function iconBackground(b: { icon_background: IconBackground | null; primary_color: string | null; ground_tint: string | null }): number | null {
  const hex = b.icon_background === "accent"
    ? b.primary_color ?? DEFAULT_ACCENT
    : b.icon_background === "ground"
    ? b.ground_tint ?? DARK_GROUND
    : b.icon_background === "cream"
    ? CREAM
    : null;
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}
