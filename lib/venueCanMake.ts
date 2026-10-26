// Can the venue make it: venue_can_make's answer for a page of drinks
// (supabase/migrations/20261121300000_venue_can_make.sql) and the words a
// search result says (QA Q37). The server does the matching; this reads it.

import type { Json } from '@/types/db';

export interface VenueCanMake {
  canMake: boolean;
  /** How many things it's short of. `missing` names the first three. */
  missingCount: number;
  missing: { id: string; name: string }[];
}

interface Row {
  drink_id: string;
  can_make: boolean;
  missing_count: number;
  missing: Json;
}

/** The rows by drink id. A drink whose spec the caller can't read has none. */
export function byDrink(rows: readonly Row[]): Record<string, VenueCanMake> {
  return Object.fromEntries(
    rows.map((r) => [
      r.drink_id,
      { canMake: r.can_make, missingCount: r.missing_count, missing: Array.isArray(r.missing) ? (r.missing as { id: string; name: string }[]) : [] },
    ])
  );
}

/**
 * "Can make", or what's missing by name (board w3-can-make, A): "Missing 2:
 * Suze, Lillet Blanc", and past the three the server names, "Missing 5:
 * Cappelletti, Cynar, Prosecco and 2 more". With no names (hidden from the
 * caller), just the count.
 */
export function canMakeLabel(v: VenueCanMake): string {
  if (v.canMake) return 'Can make';
  const names = v.missing.slice(0, 3).map((m) => m.name);
  if (!names.length) return `Missing ${v.missingCount}`;
  const rest = v.missingCount - names.length;
  return `Missing ${v.missingCount}: ${names.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`;
}
