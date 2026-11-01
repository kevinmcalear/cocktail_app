import { contrast, toHex } from '@/lib/color';
import { luminanceOf, type TextZone } from '@/supabase/functions/_shared/photoLayout';

/** The quiet room a title needs in the photo, in points: its eyebrow, name and credit, with air round them. */
export const TITLE_ROOM = 150;
/** WCAG AA for the small lines (the eyebrow, the credit). */
const AA = 4.5;

/** A grey at this lightness (L*, 0 to 1). */
function grey(light: number): string {
  const y = luminanceOf(light);
  const v = 255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055);
  return toHex([v, v, v]);
}

/**
 * The mid-tone rail (themes-midtone, "trust the rail, check real photos"):
 * whether the title's small lines, in the page's muted ink, read at 4.5:1
 * against the quiet room's lighter parts. No board draws a scrim for a
 * mid-tone photo, so where they wouldn't, the title goes under the photo.
 */
export function titleReads(muted: string, zone: TextZone): boolean {
  return contrast(muted, grey(zone.light)) >= AA;
}

interface TitleSpot {
  zone: TextZone | null | undefined;
  /** The photo's width over its height (images.width / height); a 4:5 crop when they aren't known. */
  aspect?: number | null;
  /** The frame the photo fills (contentFit cover, centred). */
  width: number;
  height: number;
  /** What's free of the bar above and the fade below, in the frame's points. */
  from: number;
  to: number;
  /** The page's muted ink, what the rail checks. */
  muted: string;
}

/**
 * Where the title's room starts in a photo frame, or null when the title goes
 * under the photo (boards Decided-photo-top, Decided-photo-under,
 * Desk-photo-side-*): the scan's quiet room as the frame crops it, clear of
 * the bar and the fade, at least TITLE_ROOM tall, and the title reads there.
 * Checked by lib/photoTitle.check.ts.
 */
export function titleSpot({ zone, aspect, width, height, from, to, muted }: TitleSpot): number | null {
  if (!zone || !titleReads(muted, zone)) return null;
  // ponytail: photos without a size (older rows until the image-sizes backfill) are taken as the pickers' 4:5 crop.
  const ratio = aspect && aspect > 0 ? aspect : 4 / 5;
  // Cover: a frame wider than the photo crops its top and bottom.
  const shown = width / height > ratio ? width / ratio : height;
  const offset = (height - shown) / 2;
  const top = Math.max(from, offset + zone.top * shown);
  const bottom = Math.min(to, offset + zone.bottom * shown);
  return bottom - top >= TITLE_ROOM ? Math.round(top) : null;
}
