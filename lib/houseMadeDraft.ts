/**
 * Something you make (board Add-house), as its draft is kept on the device
 * (store/useHouseMadeWizardStore) and in the account (hooks/useDraftSync):
 * the name as typed and the recipe so far. Kept apart from the recipe steps'
 * rules (lib/prepKinds), so the sync, which every page mounts, stays small.
 */
import type { PrepDraft } from './prepKinds';

/** The three steps of a recipe made in-house, in order (make-anything-steps-1 and 2, steps 4 to 6). */
export const RECIPE_STEPS = ['kind', 'recipe', 'method'] as const;
export type RecipeStep = (typeof RECIPE_STEPS)[number];

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

/** Where house-mades are left: 'house:home', 'house:<venue id>'. */
export const houseMadePlace = (barId: string | null | undefined) => `house:${barId || 'home'}`;

/** One unsaved house-made's slot, its own at its place ('house:home:<id>'): starting another never writes over one left before. */
export const houseMadeSlot = (barId: string | null | undefined, id: string) => `${houseMadePlace(barId)}:${id}`;

/** A house-made's slot among the account's wizard drafts; a drink's starts with its place, a beer's with 'beer:'. */
export const isHouseMadeSlot = (slot: string) => slot.startsWith('house:');

/** The venue a house-made's slot is at; null at home. */
export function houseMadeBar(slot: string): string | null {
  const place = slot.slice('house:'.length).split(':')[0];
  return place === 'home' ? null : place;
}

/** The house-mades left at a place with something in them, newest first: Add's Pick up where you left off and House-made's Drafts list each. */
export function houseMadesAt<K extends { draft: HouseMadeDraft; updatedAt: number }>(kept: Record<string, K>, barId: string | null | undefined): [string, K][] {
  return Object.entries(kept)
    .filter(([slot, k]) => isHouseMadeSlot(slot) && houseMadeBar(slot) === (barId || null) && filledHouseMade({ ...EMPTY_HOUSE_MADE, ...k.draft }))
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
}
