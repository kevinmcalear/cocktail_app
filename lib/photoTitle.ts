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

/** One photo in the hero: its quiet room and its width over its height (images.width / height). */
export interface PhotoRoom {
  zone: TextZone | null | undefined;
  /** A 4:5 crop when the size isn't known. */
  aspect?: number | null;
}

/** The hero's photos as titleSpot reads them. */
export const photoRooms = (photos: { textZone?: TextZone | null; aspect?: number | null }[]): PhotoRoom[] => photos.map((p) => ({ zone: p.textZone, aspect: p.aspect }));

interface TitleSpot {
  /** Every photo the hero can swipe to: the title stays put, so it needs room in all of them. */
  photos: PhotoRoom[];
  /** The frame the photos fill (contentFit cover, centred). */
  width: number;
  height: number;
  /** What's free of the bar above and the fade below, in the frame's points. */
  from: number;
  to: number;
  /** The page's muted ink, what the rail checks. */
  muted: string;
}

/**
 * The title's room in a photo frame, or null when the title goes under the
 * photo (boards Decided-photo-top, Decided-photo-under, Desk-photo-side-*):
 * the scan's quiet room as the frame crops it, clear of the bar and the fade,
 * at least TITLE_ROOM tall, and the title reads there. With several photos,
 * the room they all share. The page still measures the title against it
 * (ItemShell): a long name can need more. Checked by lib/photoTitle.check.ts.
 */
export function titleSpot({ photos, width, height, from, to, muted }: TitleSpot): { top: number; bottom: number } | null {
  if (!photos.length) return null;
  let top = from;
  let bottom = to;
  for (const { zone, aspect } of photos) {
    if (!zone || !titleReads(muted, zone)) return null;
    // ponytail: photos without a size (older rows until the image-sizes backfill) are taken as the pickers' 4:5 crop.
    const ratio = aspect && aspect > 0 ? aspect : 4 / 5;
    // Cover: a frame wider than the photo crops its top and bottom.
    const shown = width / height > ratio ? width / ratio : height;
    const offset = (height - shown) / 2;
    top = Math.max(top, offset + zone.top * shown);
    bottom = Math.min(bottom, offset + zone.bottom * shown);
  }
  return bottom - top >= TITLE_ROOM ? { top: Math.round(top), bottom: Math.round(bottom) } : null;
}
