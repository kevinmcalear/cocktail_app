/**
 * A venue's brand as the app uses it, and the rules the database enforces on
 * it (bars_ground_tint_check, bars_short_name_check), so the brand screen can
 * say what's wrong before saving.
 */
import { backbar, type DisplayFace } from '@/constants/tokens';
import { contrast, isHexColor } from '@/lib/color';

/** The database's venue_display_face values, and the app's names for them. */
const FACE_FROM_DB: Record<string, DisplayFace> = {
  instrument_serif: 'instrument',
  fraunces: 'fraunces',
  bricolage_grotesque: 'bricolage',
};

export type DbDisplayFace = 'instrument_serif' | 'fraunces' | 'bricolage_grotesque';

export function faceFromDb(value: string | null | undefined): DisplayFace {
  return FACE_FROM_DB[value ?? ''] ?? 'instrument';
}

export function faceToDb(face: DisplayFace): DbDisplayFace {
  return face === 'fraunces' ? 'fraunces' : face === 'bricolage' ? 'bricolage_grotesque' : 'instrument_serif';
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
 * A ground tint is only used when dark-mode text still reads on it; a tint
 * too light for that is ignored rather than making the app unreadable.
 */
export function usableGroundTint(tint: string | null | undefined): string | null {
  if (!tint || !isHexColor(tint)) return null;
  return contrast(backbar.dark.ink, tint) >= MIN_TINT_CONTRAST ? tint : null;
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
