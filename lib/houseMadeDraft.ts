/**
 * Something you make (board Add-house), as its draft is kept on the device
 * (store/useHouseMadeWizardStore) and in the account (hooks/useDraftSync):
 * the name as typed and the recipe so far. Kept apart from the recipe steps'
 * rules (lib/prepKinds), so the sync, which every page mounts, stays small.
 */
import type { PrepDraft, RecipeStep } from './prepKinds';

export interface HouseMadeDraft {
  /** Stamped on the first change: the same draft on every device. */
  id?: string;
  name: string;
  /** The recipe so far; null until the steps have written one. */
  prep: PrepDraft | null;
}

export type HouseMadeStep = RecipeStep;

export const EMPTY_HOUSE_MADE: HouseMadeDraft = { name: '', prep: null };

/** Anything typed or picked: closing asks "Leave it for now?" and keeps it (Kevin, 8 Nov: "Later on close"). */
export const filledHouseMade = (d: HouseMadeDraft) => !!(d.name.trim() || d.prep);

/** One unsaved house-made per place: 'house:home', 'house:<venue id>'. */
export const houseMadePlace = (barId: string | null | undefined) => `house:${barId || 'home'}`;

/** A house-made's slot among the account's wizard drafts; a drink's starts with its place, a beer's with 'beer:'. */
export const isHouseMadeSlot = (slot: string) => slot.startsWith('house:');

/** The venue a house-made's slot is at; null at home. */
export function houseMadeBar(slot: string): string | null {
  const place = slot.slice('house:'.length);
  return place === 'home' ? null : place;
}
