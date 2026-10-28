/**
 * A venue's brand as the app uses it, and the rules the database enforces on
 * it (bars_ground_tint_check, bars_short_name_check), so the brand screen can
 * say what's wrong before saving.
 */
import { backbar, type DisplayFace } from '@/constants/tokens';
import { contrast, isHexColor } from '@/lib/color';
import { neutralsFrom } from '@/lib/palette';

/** The app's display faces and their venue_display_face values in the database. */
const FACE_TO_DB = {
  instrument: 'instrument_serif',
  fraunces: 'fraunces',
  playfair: 'playfair_display',
  bricolage: 'bricolage_grotesque',
  josefin: 'josefin_sans',
  tenor: 'tenor_sans',
} as const satisfies Record<DisplayFace, string>;

export type DbDisplayFace = (typeof FACE_TO_DB)[DisplayFace];

/** A face this app doesn't know (a newer one) shows as Instrument Serif. */
export function faceFromDb(value: string | null | undefined): DisplayFace {
  return (Object.keys(FACE_TO_DB) as DisplayFace[]).find((f) => FACE_TO_DB[f] === value) ?? 'instrument';
}

export function faceToDb(face: DisplayFace): DbDisplayFace {
  return FACE_TO_DB[face];
}

/**
 * The display_face to save: the stored value as it is while the picked face
 * still reads as it (so a face this build doesn't know survives a save of
 * other fields), else the picked one. A stored value came from
 * bars.display_face, so the database has it even when this build's types don't.
 */
export function faceToSave(picked: DisplayFace, stored: string | null | undefined): DbDisplayFace {
  return stored && faceFromDb(stored) === picked ? (stored as DbDisplayFace) : faceToDb(picked);
}

/** The database turned down a display face it doesn't have yet (the app shipped before its migration). */
export function isUnknownFaceError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === '22P02' && /venue_display_face/.test(err.message ?? '');
}

/** "d0643b" or " #D0643B " to "#D0643B"; anything else (short forms too) to null. */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : null;
}

// Body text must stay comfortably readable on a tinted dark ground.
const MIN_TINT_CONTRAST = 7;

/**
 * A ground tint is only used when dark-mode text still reads on it, quiet
 * text included; a tint too light for that is ignored rather than making the
 * app unreadable.
 */
export function usableGroundTint(tint: string | null | undefined): string | null {
  if (!tint || !isHexColor(tint)) return null;
  if (contrast(backbar.dark.ink, tint) < MIN_TINT_CONTRAST) return null;
  const dark = neutralsFrom(tint).dark;
  return contrast(dark.muted, dark.ground) >= 4.5 ? tint : null;
}

export interface BrandDraft {
  accent: string;
  groundTint: string;
  shortName: string;
}

/** What's wrong with a draft, in words, keyed by field. Empty when it can be saved. */
export function brandProblems(draft: BrandDraft): Partial<Record<keyof BrandDraft, string>> {
  const out: Partial<Record<keyof BrandDraft, string>> = {};
  if (draft.accent.trim() && !normalizeHex(draft.accent)) out.accent = 'Use a hex colour like #D0643B.';
  if (draft.groundTint.trim()) {
    const tint = normalizeHex(draft.groundTint);
    if (!tint) out.groundTint = 'Use a hex colour like #1A1410, or leave it empty.';
    else if (!usableGroundTint(tint)) out.groundTint = 'Too light: text wouldn’t read on it in dark mode. Pick a darker shade.';
  }
  const name = draft.shortName.trim();
  if (name.length > 12) out.shortName = 'Keep it to 12 characters so it fits under the icon.';
  return out;
}

/**
 * A bar page's public brand (bar_brands): its venue's logo, accent, display
 * face and short name, which anyone may see (Kevin, 12 Oct). Plain JSON for
 * the query cache. `accent` is null unless it's a hex colour.
 */
export interface PublicBrand {
  logo: string | null;
  accent: string | null;
  face: DisplayFace;
  shortName: string | null;
}

/** A bar_brands row. */
export interface PublicBrandRow {
  profile_id: string;
  logo_url: string | null;
  primary_color: string | null;
  display_face: string | null;
  short_name: string | null;
}

export function toPublicBrand(r: Omit<PublicBrandRow, 'profile_id'>): PublicBrand {
  return { logo: r.logo_url || null, accent: isHexColor(r.primary_color) ? r.primary_color : null, face: faceFromDb(r.display_face), shortName: r.short_name || null };
}

/** What a bar's monogram draws in (BarMark): its accent and face, or null to use the app's. */
export function markBrand(brand: Pick<PublicBrand, 'accent' | 'face'> | null | undefined): { accent: string; face: DisplayFace } | null {
  return brand?.accent ? { accent: brand.accent, face: brand.face } : null;
}
