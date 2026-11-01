// A person's own allergies on the phone and the account. Kept apart from
// lib/allergens.ts because hooks/useGuestAllergies.ts sits in the web's
// every-page chunk and must not pull the whole allergen module in with it.
import type { Allergen } from '@/lib/allergens';

/** Two lists of allergies as one, so a list picked on a phone never drops one from the account. Null: neither was ever set. */
export function mergeAllergies(a: readonly Allergen[] | null | undefined, b: readonly Allergen[] | null | undefined): Allergen[] | null {
  if (!a && !b) return null;
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

/** The phone's copy of an account's allergies, saved with whose it is. */
export const allergyCopy = (userId: string, allergies: readonly Allergen[]) => JSON.stringify({ userId, allergies });

/** Reads that copy back for its owner only, so one person's list never reaches the next on a shared phone. */
export function allergyCopyFor(raw: string | null | undefined, userId: string): Allergen[] | null {
  if (!raw) return null;
  const copy = JSON.parse(raw) as { userId: string; allergies: Allergen[] };
  return copy.userId === userId ? copy.allergies : null;
}
